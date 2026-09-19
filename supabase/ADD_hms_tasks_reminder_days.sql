-- Goals-style reminder_days on Home Maintenance tasks (in-app preference; no push).
-- Safe to rerun.

ALTER TABLE tools_hms_tasks
  ADD COLUMN IF NOT EXISTS reminder_days INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tools_hms_tasks_reminder_days_check'
  ) THEN
    ALTER TABLE tools_hms_tasks
      ADD CONSTRAINT tools_hms_tasks_reminder_days_check
      CHECK (reminder_days IS NULL OR reminder_days >= 1);
  END IF;
END $$;
