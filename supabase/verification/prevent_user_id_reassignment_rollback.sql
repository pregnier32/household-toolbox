-- Rolls back supabase/verification/prevent_user_id_reassignment.sql.
-- Not in supabase/migrations. Run only in the SQL editor.

BEGIN;

DO $rollback$
DECLARE
  rel record;
BEGIN
  FOR rel IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname AS trigger_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_trigger t ON t.tgrelid = c.oid
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      AND t.tgname IN ('reject_user_id_change', 'reject_unowned_user_id')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', rel.trigger_name, rel.schema_name, rel.table_name);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      AND t.tgname IN ('reject_user_id_change', 'reject_unowned_user_id')
  ) THEN
    RAISE EXCEPTION 'user_id protection triggers are still installed';
  END IF;

  DROP FUNCTION IF EXISTS public.reject_user_id_change();
END
$rollback$;

COMMIT;
