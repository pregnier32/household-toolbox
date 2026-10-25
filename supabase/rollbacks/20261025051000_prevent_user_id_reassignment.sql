-- Rolls back supabase/migrations/20261025051000_prevent_user_id_reassignment.sql.
-- Not applied by supabase db push.

BEGIN;

DO $rollback$
DECLARE
  rel record;
BEGIN
  FOR rel IN
    SELECT namespace.nspname AS schema_name, relation.relname AS table_name, trigger.tgname AS trigger_name
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_trigger trigger ON trigger.tgrelid = relation.oid
    WHERE namespace.nspname = 'public'
      AND NOT trigger.tgisinternal
      AND trigger.tgname IN ('reject_user_id_change', 'reject_unowned_user_id')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', rel.trigger_name, rel.schema_name, rel.table_name);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger trigger
    JOIN pg_class relation ON relation.oid = trigger.tgrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND NOT trigger.tgisinternal
      AND trigger.tgname IN ('reject_user_id_change', 'reject_unowned_user_id')
  ) THEN
    RAISE EXCEPTION 'user_id protection triggers are still installed';
  END IF;

  DROP FUNCTION IF EXISTS public.reject_user_id_change();
END
$rollback$;

COMMIT;
