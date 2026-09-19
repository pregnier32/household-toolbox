-- HMS/Goals-style reminder_days on Cleaning Schedule tasks (in-app preference; no push).
-- Safe to re-run.

ALTER TABLE tools_cs_tasks
  ADD COLUMN IF NOT EXISTS reminder_days INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tools_cs_tasks_reminder_days_check'
  ) THEN
    ALTER TABLE tools_cs_tasks
      ADD CONSTRAINT tools_cs_tasks_reminder_days_check
      CHECK (reminder_days IS NULL OR reminder_days >= 1);
  END IF;
END $$;
