-- Rolls back supabase/migrations/20261025040000_revoke_truncate_and_prefix_storage_usage.sql.
-- Not applied by supabase db push.
-- Restores the previous storage-usage body, including the nested owner-id match,
-- and the previous TRUNCATE, TRIGGER, and REFERENCES grants on users and settings.
-- Does not restore helper EXECUTE grants changed by
-- 20261024223000_restrict_helper_function_execute.sql.
-- Does not restore TRUNCATE, TRIGGER, or REFERENCES on any other table.
-- If 20261025052000 has already been applied, this reopens those privileges on
-- users and settings until 20261025052000 is applied again.

BEGIN;

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
      OR o.name LIKE '%/' || p_user_id::text || '/%'
    )
  GROUP BY o.bucket_id;
$$;

GRANT TRUNCATE, REFERENCES, TRIGGER ON TABLE public.users TO anon, authenticated;
GRANT TRUNCATE, REFERENCES, TRIGGER ON TABLE public.settings TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enforce_household_member_rules() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_household_invitation_limit() TO anon, authenticated;

DO $check$
DECLARE
  body text;
BEGIN
  SELECT p.prosrc INTO body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_user_storage_usage';

  IF position($pattern$'%/' || p_user_id::text || '/%'$pattern$ in body) = 0 THEN
    RAISE EXCEPTION 'storage usage rollback did not restore the previous match';
  END IF;

  IF NOT has_table_privilege('anon', 'public.users'::regclass, 'TRUNCATE')
     OR NOT has_table_privilege('authenticated', 'public.settings'::regclass, 'TRUNCATE')
     OR NOT has_function_privilege('anon', 'public.enforce_household_member_rules()'::regprocedure, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.enforce_household_invitation_limit()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'storage usage rollback privilege check failed';
  END IF;
END
$check$;

COMMIT;
