-- Prepared for the production SQL editor. Not applied by this review.
-- Do not run supabase db push. The linked project is production.
-- 20261025040000 already removes these privileges from users and settings.
-- This migration makes the remaining public tables match.
-- Rollback: supabase/rollbacks/20261025052000_revoke_direct_table_admin_privileges.sql.
--
-- anon and authenticated hold TRUNCATE, TRIGGER, and REFERENCES on public tables.
-- Row level security does not govern TRUNCATE. PostgREST does not expose it, but
-- the grants are broader than the application uses. users_tools and
-- user_tool_entitlements already lack TRUNCATE; this script makes that uniform.
-- SELECT, INSERT, UPDATE, and DELETE grants are left in place.
--
-- A failed check rolls the transaction back.

BEGIN;

DO $privileges$
DECLARE
  rel record;
BEGIN
  FOR rel IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %I.%I FROM anon, authenticated',
      rel.schema_name,
      rel.table_name
    );
  END LOOP;

  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated';

  IF has_table_privilege('authenticated', 'public.settings'::regclass, 'TRUNCATE')
     OR has_table_privilege('anon', 'public.users'::regclass, 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.tools_note_notes'::regclass, 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.users_tools'::regclass, 'TRIGGER') THEN
    RAISE EXCEPTION 'anon or authenticated still has a direct administrative table privilege';
  END IF;
END
$privileges$;

COMMIT;
