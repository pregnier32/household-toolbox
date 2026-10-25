-- Rollback for 20261024223000_restrict_helper_function_execute.sql.
-- This file is not in supabase/migrations, so supabase db push will not run it.
-- Run it in the SQL editor only to restore the execute grants observed before that migration.
-- A failure raises and the transaction keeps the restricted grants.

BEGIN;

DO $rollback$
DECLARE
  fn record;
  live_args text;
  signature text;
BEGIN
  CREATE TEMP TABLE previous_fn (
    proname text PRIMARY KEY,
    identity_args text NOT NULL,
    grant_public boolean NOT NULL,
    grant_anon boolean NOT NULL,
    grant_authenticated boolean NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO previous_fn (proname, identity_args, grant_public, grant_anon, grant_authenticated) VALUES
    ('apply_tools_eolp_owner_rls', 'p_table text', true, true, true),
    ('assign_manual_entitlement', 'p_user_id uuid, p_actor uuid, p_effective_at timestamp with time zone, p_note text, p_benefit_type text, p_slot_mode text, p_slot_count integer, p_percent_off numeric, p_amount_cents integer, p_bonus_storage_bytes bigint, p_duration_unit text, p_duration_amount integer, p_display_name text, p_customer_description text, p_tool_ids uuid[]', false, false, false),
    ('assign_promotion', 'p_user_id uuid, p_promotion_id uuid, p_source text, p_assigned_by uuid, p_effective_at timestamp with time zone, p_override boolean, p_note text, p_signup boolean', false, false, false),
    ('can_access_storage_owner', 'folder text', false, true, true),
    ('can_access_user_data', 'owner_id uuid', false, true, true),
    ('claim_billing_lock', 'p_user_id uuid, p_owner text, p_seconds integer', false, false, false),
    ('claim_stripe_event', 'p_event_id text, p_type text, p_livemode boolean, p_owner text, p_seconds integer, p_payload jsonb', false, false, false),
    ('finish_stripe_event', 'p_event_id text, p_owner text, p_status text, p_error text', false, false, false),
    ('get_site_storage_stats', '', false, false, false),
    ('get_user_storage_usage', 'p_user_id uuid', false, false, false),
    ('household_tool_access_locked', 'owner_id uuid', false, true, true),
    ('release_billing_lock', 'p_user_id uuid, p_owner text', false, false, false),
    ('rewrite_household_owner_check', 'expr text', true, true, true),
    ('save_promotion', 'p_actor uuid, p_promotion_id uuid, p_fields jsonb, p_tool_ids uuid[]', false, false, false);

  FOR fn IN SELECT * FROM previous_fn LOOP
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

    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
      INTO signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = fn.proname;

    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', signature);
    IF fn.grant_public THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', signature);
    END IF;
    IF fn.grant_anon THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', signature);
    END IF;
    IF fn.grant_authenticated THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', signature);
    END IF;

    IF has_function_privilege('anon', signature::regprocedure, 'EXECUTE') IS DISTINCT FROM fn.grant_anon THEN
      RAISE EXCEPTION 'anon execute on % was not restored', signature;
    END IF;
    IF has_function_privilege('authenticated', signature::regprocedure, 'EXECUTE') IS DISTINCT FROM (fn.grant_authenticated OR fn.grant_public) THEN
      RAISE EXCEPTION 'authenticated execute on % was not restored', signature;
    END IF;
    IF NOT has_function_privilege('service_role', signature::regprocedure, 'EXECUTE') THEN
      RAISE EXCEPTION 'service_role cannot execute %', signature;
    END IF;
  END LOOP;
END
$rollback$;

COMMIT;
