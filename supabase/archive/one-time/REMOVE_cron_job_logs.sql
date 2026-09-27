-- Removes legacy cron job logs storage now that cron logging UI/API were removed.
-- Safe to rerun.

BEGIN;

-- Drop RLS policy first when table exists (safe if already missing)
DO $$
BEGIN
  IF to_regclass('public.cron_job_logs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Only superadmins can read cron job logs" ON cron_job_logs';
  END IF;
END $$;

-- Drop cron job logs table (removes indexes/constraints/policies with it)
DROP TABLE IF EXISTS cron_job_logs;

COMMIT;
