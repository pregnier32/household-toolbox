-- Prepared only. Do not apply this file with the app deploy or with supabase db push
-- until the release steps say to run it in the SQL editor.
--
-- Verified against the linked Household Toolbox catalog before this revision:
--   one overload of each function below
--   can_access_user_data and can_access_storage_owner are SECURITY DEFINER,
--     owned by postgres, and executable by anon, authenticated, and service_role
--   can_access_user_data calls household_tool_access_locked
--   household_tool_access_locked is SECURITY DEFINER, owned by postgres
--   postgres can execute the lock helper, so revoking anon and authenticated
--     does not break the policy function
--   apply_tools_eolp_owner_rls and rewrite_household_owner_check are SECURITY INVOKER
--     and are executable by PUBLIC, anon, and authenticated
--   billing, promotion, and storage-stat functions are already service_role only
--
-- The script refuses to continue unless those live facts are still true.
-- Any failed check raises, and the surrounding transaction rolls the grants back.

BEGIN;

DO $migration$
DECLARE
  fn record;
  live_args text;
  signature text;
  access_definer boolean;
  access_calls_lock boolean;
  owner_can_execute boolean;
  anon_can boolean;
  authenticated_can boolean;
  service_can boolean;
BEGIN
  CREATE TEMP TABLE expected_fn (
    proname text PRIMARY KEY,
    identity_args text NOT NULL,
    keep_authenticated boolean NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO expected_fn (proname, identity_args, keep_authenticated) VALUES
    ('apply_tools_eolp_owner_rls', 'p_table text', false),
    ('assign_manual_entitlement', 'p_user_id uuid, p_actor uuid, p_effective_at timestamp with time zone, p_note text, p_benefit_type text, p_slot_mode text, p_slot_count integer, p_percent_off numeric, p_amount_cents integer, p_bonus_storage_bytes bigint, p_duration_unit text, p_duration_amount integer, p_display_name text, p_customer_description text, p_tool_ids uuid[]', false),
    ('assign_promotion', 'p_user_id uuid, p_promotion_id uuid, p_source text, p_assigned_by uuid, p_effective_at timestamp with time zone, p_override boolean, p_note text, p_signup boolean', false),
    ('can_access_storage_owner', 'folder text', true),
    ('can_access_user_data', 'owner_id uuid', true),
    ('claim_billing_lock', 'p_user_id uuid, p_owner text, p_seconds integer', false),
    ('claim_stripe_event', 'p_event_id text, p_type text, p_livemode boolean, p_owner text, p_seconds integer, p_payload jsonb', false),
    ('finish_stripe_event', 'p_event_id text, p_owner text, p_status text, p_error text', false),
    ('get_site_storage_stats', '', false),
    ('get_user_storage_usage', 'p_user_id uuid', false),
    ('household_tool_access_locked', 'owner_id uuid', false),
    ('release_billing_lock', 'p_user_id uuid, p_owner text', false),
    ('rewrite_household_owner_check', 'expr text', false),
    ('save_promotion', 'p_actor uuid, p_promotion_id uuid, p_fields jsonb, p_tool_ids uuid[]', false);

  FOR fn IN SELECT proname, identity_args, keep_authenticated FROM expected_fn LOOP
    IF (
      SELECT count(*)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = fn.proname
    ) <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one public.% overload', fn.proname;
    END IF;

    SELECT pg_get_function_identity_arguments(p.oid)
      INTO live_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = fn.proname;

    IF live_args IS DISTINCT FROM fn.identity_args THEN
      RAISE EXCEPTION 'Live signature for % is [%], expected [%]', fn.proname, live_args, fn.identity_args;
    END IF;
  END LOOP;

  SELECT
    access.prosecdef,
    position('household_tool_access_locked' IN access.prosrc) > 0,
    has_function_privilege(access.proowner, lockfn.oid, 'EXECUTE')
  INTO access_definer, access_calls_lock, owner_can_execute
  FROM pg_proc access
  JOIN pg_namespace access_ns ON access_ns.oid = access.pronamespace
  JOIN pg_proc lockfn ON lockfn.proname = 'household_tool_access_locked'
  JOIN pg_namespace lock_ns ON lock_ns.oid = lockfn.pronamespace
  WHERE access_ns.nspname = 'public'
    AND lock_ns.nspname = 'public'
    AND access.proname = 'can_access_user_data';

  IF access_definer IS DISTINCT FROM true
     OR access_calls_lock IS DISTINCT FROM true
     OR owner_can_execute IS DISTINCT FROM true THEN
    RAISE EXCEPTION
      'Refusing to revoke household_tool_access_locked. definer=%, source_calls_lock=%, owner_can_execute=%',
      access_definer, access_calls_lock, owner_can_execute;
  END IF;

  FOR fn IN SELECT proname, keep_authenticated FROM expected_fn LOOP
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
      INTO signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = fn.proname;

    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', signature);
    IF fn.keep_authenticated THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', signature);
    ELSE
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', signature);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', signature);
    END IF;
  END LOOP;

  FOR fn IN SELECT proname, keep_authenticated FROM expected_fn LOOP
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
      INTO signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = fn.proname;

    anon_can := has_function_privilege('anon', signature::regprocedure, 'EXECUTE');
    authenticated_can := has_function_privilege('authenticated', signature::regprocedure, 'EXECUTE');
    service_can := has_function_privilege('service_role', signature::regprocedure, 'EXECUTE');

    IF anon_can THEN
      RAISE EXCEPTION 'anon can still execute %', signature;
    END IF;
    IF authenticated_can IS DISTINCT FROM fn.keep_authenticated THEN
      RAISE EXCEPTION 'authenticated execute on % is %, expected %', signature, authenticated_can, fn.keep_authenticated;
    END IF;
    IF NOT service_can THEN
      RAISE EXCEPTION 'service_role cannot execute %', signature;
    END IF;
  END LOOP;

  IF NOT has_function_privilege(
    (SELECT access.proowner
     FROM pg_proc access
     JOIN pg_namespace n ON n.oid = access.pronamespace
     WHERE n.nspname = 'public' AND access.proname = 'can_access_user_data'),
    (SELECT lockfn.oid
     FROM pg_proc lockfn
     JOIN pg_namespace n ON n.oid = lockfn.pronamespace
     WHERE n.nspname = 'public' AND lockfn.proname = 'household_tool_access_locked'),
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'The owner of can_access_user_data can no longer execute household_tool_access_locked';
  END IF;
END
$migration$;

COMMIT;
