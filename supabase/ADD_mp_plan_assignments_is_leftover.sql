-- Leftover / cook-once flag on Meal Planner day assignments.
-- Safe to rerun. Old rows without the flag still count as cook.

ALTER TABLE tools_mp_plan_assignments
  ADD COLUMN IF NOT EXISTS is_leftover BOOLEAN NOT NULL DEFAULT false;
