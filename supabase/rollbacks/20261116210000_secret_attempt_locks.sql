-- Rolls back supabase/migrations/20261116210000_secret_attempt_locks.sql.
-- Not applied by supabase db push. Run only in the SQL editor to remove
-- per-record password lockouts. Saved failure counts cannot be recovered.

BEGIN;

DROP TABLE IF EXISTS public.secret_attempt_locks;

DO $rollback$
BEGIN
  IF to_regclass('public.secret_attempt_locks') IS NOT NULL THEN
    RAISE EXCEPTION 'secret_attempt_locks is still present';
  END IF;
END
$rollback$;

COMMIT;
