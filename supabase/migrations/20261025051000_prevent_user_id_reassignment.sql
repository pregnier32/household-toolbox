-- Prepared for the production SQL editor. Not applied by this review.
-- Do not run supabase db push. The linked project is production.
--
-- can_access_user_data(owner_id) is true for auth.uid() and for the household
-- admin when the caller is an active member. An authenticated update can therefore
-- move a household row onto the member's own user_id. This trigger blocks every
-- user_id change, including service_role. Inserts made with auth.uid() present
-- must use the household admin id. service_role and the SQL editor have a null
-- auth.uid(), so application inserts are unchanged.
--
-- Reviewed service-role writes:
--   inserts set user_id and do not change an existing value
--   billing invoice, calendar pin, account notice, and end-of-life upserts send
--   the same user_id again; an equal value is allowed
--   account deletion deletes rows or updates other columns
--   billing closure updates deletion_status and writes former_user_id archives
--   release-note reads use the signed-in person, so that table is exempt from
--   the admin-id insert rule and still rejects a user_id change
-- users and household_members are exempt because user_id is the person.

BEGIN;

DO $reassign$
DECLARE
  rel record;
  required_table text;
  installed integer := 0;
BEGIN
  CREATE OR REPLACE FUNCTION public.reject_user_id_change()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $fn$
  DECLARE
    household_admin uuid;
  BEGIN
    IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'user_id cannot be reassigned' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'INSERT'
       AND auth.uid() IS NOT NULL
       AND TG_TABLE_NAME IS DISTINCT FROM 'user_release_note_reads' THEN
      SELECT household.admin_user_id
        INTO household_admin
      FROM public.household_members member
      JOIN public.households household ON household.id = member.household_id
      WHERE member.user_id = auth.uid()
        AND member.status = 'active'
      LIMIT 1;
      IF household_admin IS NULL OR NEW.user_id IS DISTINCT FROM household_admin THEN
        RAISE EXCEPTION 'user_id must be the household admin' USING ERRCODE = '42501';
      END IF;
    END IF;

    RETURN NEW;
  END;
  $fn$;

  REVOKE ALL ON FUNCTION public.reject_user_id_change() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.reject_user_id_change() TO authenticated, service_role;

  FOR rel IN
    SELECT namespace.nspname AS schema_name, relation.relname AS table_name
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_attribute attribute ON attribute.attrelid = relation.oid
    WHERE namespace.nspname = 'public'
      AND relation.relkind = 'r'
      AND attribute.attname = 'user_id'
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND relation.relname NOT IN ('users', 'household_members')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS reject_user_id_change ON %I.%I', rel.schema_name, rel.table_name);
    EXECUTE format('DROP TRIGGER IF EXISTS reject_unowned_user_id ON %I.%I', rel.schema_name, rel.table_name);
    EXECUTE format(
      'CREATE TRIGGER reject_user_id_change BEFORE UPDATE OF user_id ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.reject_user_id_change()',
      rel.schema_name,
      rel.table_name
    );
    EXECUTE format(
      'CREATE TRIGGER reject_unowned_user_id BEFORE INSERT ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.reject_user_id_change()',
      rel.schema_name,
      rel.table_name
    );
    installed := installed + 1;
  END LOOP;

  IF installed < 1 THEN
    RAISE EXCEPTION 'No public tables with user_id were found';
  END IF;

  IF position('auth.uid() IS NOT NULL' IN pg_get_functiondef('public.reject_user_id_change()'::regprocedure)) = 0
     OR position('user_release_note_reads' IN pg_get_functiondef('public.reject_user_id_change()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'reject_user_id_change lost the service-role or release-note exception';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.reject_user_id_change()'::regprocedure, 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.reject_user_id_change()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'the application roles cannot execute reject_user_id_change';
  END IF;
  IF has_function_privilege('anon', 'public.reject_user_id_change()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute reject_user_id_change';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger trigger
    JOIN pg_class relation ON relation.oid = trigger.tgrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND NOT trigger.tgisinternal
      AND relation.relname IN ('users', 'household_members')
      AND trigger.tgname IN ('reject_user_id_change', 'reject_unowned_user_id')
  ) THEN
    RAISE EXCEPTION 'person tables received a user_id trigger';
  END IF;

  FOREACH required_table IN ARRAY ARRAY[
    'tools_note_notes',
    'tools_id_documents',
    'users_tools',
    'billing_invoices',
    'account_notices',
    'calendar_pins',
    'user_release_note_reads'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger trigger
      JOIN pg_class relation ON relation.oid = trigger.tgrelid
      WHERE relation.relname = required_table
        AND NOT trigger.tgisinternal
        AND trigger.tgname = 'reject_user_id_change'
    ) OR NOT EXISTS (
      SELECT 1
      FROM pg_trigger trigger
      JOIN pg_class relation ON relation.oid = trigger.tgrelid
      WHERE relation.relname = required_table
        AND NOT trigger.tgisinternal
        AND trigger.tgname = 'reject_unowned_user_id'
    ) THEN
      RAISE EXCEPTION '% is missing a user_id trigger', required_table;
    END IF;
  END LOOP;
END
$reassign$;

COMMIT;
