-- Prepared for the production SQL editor. Not applied by this review.
-- Do not run supabase db push. The linked project is production.
-- Rollback: supabase/rollbacks/20261025040000_revoke_truncate_and_prefix_storage_usage.sql.
--
-- Catalog checked read-only on 2026-10-24 against Household Toolbox
-- (hjbneuicvfbihtbufrxq), before any of these files were applied:
--   get_user_storage_usage(uuid) is SECURITY DEFINER, executable by
--     service_role only, and its body still contains the middle match
--     '%/' || owner id || '/%'
--   can_access_user_data(uuid) is SECURITY DEFINER, calls
--     household_tool_access_locked, and is executable by anon,
--     authenticated, and service_role
--   enforce_household_member_rules() and enforce_household_invitation_limit()
--     take no arguments and are executable by anon, authenticated, and
--     service_role
--   users and settings grant TRUNCATE, TRIGGER, and REFERENCES directly to
--     anon and authenticated. PUBLIC is not in those ACLs.
--
-- Composition with 20261024223000_restrict_helper_function_execute.sql:
--   That file changes EXECUTE grants and does not replace function bodies.
--   This file replaces the storage-usage body and does not change its
--   EXECUTE grants. CREATE OR REPLACE preserves the grants present at apply
--   time, so either file may run first. After both, service_role can execute
--   get_user_storage_usage and anon/authenticated cannot.
--   Do not add auth.uid() to household_tool_access_locked. The other file
--   revokes direct EXECUTE; the function owner can still call it from
--   SECURITY DEFINER can_access_user_data.
--
-- Composition with 20261025052000_revoke_direct_table_admin_privileges.sql:
--   That migration revokes TRUNCATE, TRIGGER, and REFERENCES from anon and
--   authenticated on every public table and from default privileges.
--   The two-table revoke below is the same change for users and settings,
--   and it also names PUBLIC. Apply that migration as well. Revoke is
--   idempotent, so the two files may run in either order.
--
-- 20261025051000_prevent_user_id_reassignment.sql is a separate migration.

BEGIN;

DO $guard$
DECLARE
  usage_count integer;
  usage_args text;
  member_count integer;
  invitation_count integer;
BEGIN
  SELECT count(*) INTO usage_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_user_storage_usage';
  IF usage_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one public.get_user_storage_usage';
  END IF;

  SELECT pg_get_function_identity_arguments(p.oid) INTO usage_args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_user_storage_usage';
  IF usage_args IS DISTINCT FROM 'p_user_id uuid' THEN
    RAISE EXCEPTION 'Live signature for get_user_storage_usage is [%]', usage_args;
  END IF;

  SELECT count(*) INTO member_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'enforce_household_member_rules'
    AND pg_get_function_identity_arguments(p.oid) = '';
  IF member_count <> 1 THEN
    RAISE EXCEPTION 'Expected public.enforce_household_member_rules()';
  END IF;

  SELECT count(*) INTO invitation_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'enforce_household_invitation_limit'
    AND pg_get_function_identity_arguments(p.oid) = '';
  IF invitation_count <> 1 THEN
    RAISE EXCEPTION 'Expected public.enforce_household_invitation_limit()';
  END IF;
END
$guard$;

-- RLS does not apply to TRUNCATE. Leave SELECT, INSERT, UPDATE, and DELETE
-- for the RLS review.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.users FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.settings FROM PUBLIC, anon, authenticated;

-- The application inserts household members and invitations with the service
-- role. If a later policy grants authenticated writes on those tables, that
-- role also needs EXECUTE on the matching trigger function.
REVOKE ALL ON FUNCTION public.enforce_household_member_rules() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_household_member_rules() TO service_role;

REVOKE ALL ON FUNCTION public.enforce_household_invitation_limit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_household_invitation_limit() TO service_role;

-- Count only objects whose key is the owner id or starts with "{owner id}/".
CREATE OR REPLACE FUNCTION public.get_user_storage_usage(p_user_id uuid)
RETURNS TABLE(bucket_id text, used_bytes bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = storage, public
AS $$
  SELECT
    o.bucket_id::text,
    COALESCE(SUM((o.metadata->>'size')::bigint), 0)::bigint AS used_bytes
  FROM storage.objects o
  WHERE o.metadata ? 'size'
    AND (
      o.name = p_user_id::text
      OR o.name LIKE p_user_id::text || '/%'
    )
  GROUP BY o.bucket_id;
$$;

DO $check$
DECLARE
  body text;
BEGIN
  SELECT p.prosrc INTO body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_user_storage_usage';

  IF position($pattern$'%/' || p_user_id::text || '/%'$pattern$ in body) > 0 THEN
    RAISE EXCEPTION 'get_user_storage_usage still counts a nested owner id';
  END IF;

  IF has_table_privilege('anon', 'public.users'::regclass, 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.settings'::regclass, 'TRUNCATE')
     OR has_function_privilege('anon', 'public.enforce_household_member_rules()'::regprocedure, 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.enforce_household_invitation_limit()'::regprocedure, 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.get_user_storage_usage(uuid)'::regprocedure, 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.enforce_household_member_rules()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'Storage migration privilege post-check failed';
  END IF;
END
$check$;

COMMIT;
