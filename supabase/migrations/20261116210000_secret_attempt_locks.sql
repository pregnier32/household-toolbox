-- Prepared for the production SQL editor. Not applied by this review.
-- Do not run supabase db push. The linked project is production.
-- Rollback: supabase/rollbacks/20261116210000_secret_attempt_locks.sql.
--
-- One lock row per household record. Notes and important documents share this
-- table. The service-role API is the only writer. anon and authenticated get
-- no privileges, and there is no row policy for them to use. user_id is the
-- household data owner, so a member and the admin share one counter.
--
-- A failed check rolls the transaction back.

BEGIN;

DO $lockout$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Missing public.users';
  END IF;
  IF to_regprocedure('public.reject_user_id_change()') IS NULL THEN
    RAISE EXCEPTION 'Missing public.reject_user_id_change()';
  END IF;

  CREATE TABLE IF NOT EXISTS public.secret_attempt_locks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    record_kind text NOT NULL,
    record_id uuid NOT NULL,
    failure_count integer NOT NULL DEFAULT 0,
    locked_until timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT secret_attempt_locks_kind_check CHECK (record_kind IN ('note', 'document')),
    CONSTRAINT secret_attempt_locks_count_check CHECK (failure_count >= 0),
    CONSTRAINT secret_attempt_locks_record_key UNIQUE (user_id, record_kind, record_id)
  );

  ALTER TABLE public.secret_attempt_locks ENABLE ROW LEVEL SECURITY;

  DROP TRIGGER IF EXISTS reject_user_id_change ON public.secret_attempt_locks;
  CREATE TRIGGER reject_user_id_change
    BEFORE UPDATE OF user_id ON public.secret_attempt_locks
    FOR EACH ROW EXECUTE FUNCTION public.reject_user_id_change();

  DROP TRIGGER IF EXISTS reject_unowned_user_id ON public.secret_attempt_locks;
  CREATE TRIGGER reject_unowned_user_id
    BEFORE INSERT ON public.secret_attempt_locks
    FOR EACH ROW EXECUTE FUNCTION public.reject_user_id_change();

  REVOKE ALL ON TABLE public.secret_attempt_locks FROM PUBLIC, anon, authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.secret_attempt_locks TO service_role;

  IF to_regclass('public.secret_attempt_locks') IS NULL THEN
    RAISE EXCEPTION 'secret_attempt_locks was not created';
  END IF;

  IF NOT (
    SELECT relation.relrowsecurity
    FROM pg_class relation
    WHERE relation.oid = 'public.secret_attempt_locks'::regclass
  ) THEN
    RAISE EXCEPTION 'secret_attempt_locks row level security is off';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.secret_attempt_locks'::regclass
      AND constraint_row.contype = 'u'
      AND constraint_row.conname = 'secret_attempt_locks_record_key'
  ) THEN
    RAISE EXCEPTION 'secret_attempt_locks is missing its unique record key';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_trigger trigger
    JOIN pg_class relation ON relation.oid = trigger.tgrelid
    WHERE relation.oid = 'public.secret_attempt_locks'::regclass
      AND NOT trigger.tgisinternal
      AND trigger.tgname IN ('reject_user_id_change', 'reject_unowned_user_id')
  ) <> 2 THEN
    RAISE EXCEPTION 'secret_attempt_locks is missing a user_id trigger';
  END IF;

  IF has_table_privilege('anon', 'public.secret_attempt_locks', 'SELECT')
     OR has_table_privilege('authenticated', 'public.secret_attempt_locks', 'SELECT')
     OR has_table_privilege('anon', 'public.secret_attempt_locks', 'INSERT')
     OR has_table_privilege('authenticated', 'public.secret_attempt_locks', 'INSERT')
     OR has_table_privilege('anon', 'public.secret_attempt_locks', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.secret_attempt_locks', 'UPDATE')
     OR has_table_privilege('anon', 'public.secret_attempt_locks', 'DELETE')
     OR has_table_privilege('authenticated', 'public.secret_attempt_locks', 'DELETE')
     OR has_table_privilege('anon', 'public.secret_attempt_locks', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.secret_attempt_locks', 'TRUNCATE')
     OR has_table_privilege('anon', 'public.secret_attempt_locks', 'TRIGGER')
     OR has_table_privilege('authenticated', 'public.secret_attempt_locks', 'TRIGGER')
     OR has_table_privilege('anon', 'public.secret_attempt_locks', 'REFERENCES')
     OR has_table_privilege('authenticated', 'public.secret_attempt_locks', 'REFERENCES')
  THEN
    RAISE EXCEPTION 'anon or authenticated can use secret_attempt_locks';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.secret_attempt_locks', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.secret_attempt_locks', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.secret_attempt_locks', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.secret_attempt_locks', 'DELETE')
  THEN
    RAISE EXCEPTION 'service_role cannot use secret_attempt_locks';
  END IF;
END
$lockout$;

COMMIT;
