-- End of Life Planner — plan edit/restore activity (SMS-282).
-- Safe to re-run.

BEGIN;

ALTER TABLE tools_eolp_plans
  ADD COLUMN IF NOT EXISTS history_events JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
