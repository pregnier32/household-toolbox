-- Named day slots for Meal Planner (Breakfast / Lunch / Dinner).
-- Safe to rerun. Legacy rows with NULL slot_key still read (single meal → Dinner).

ALTER TABLE tools_mp_plan_assignments
  ADD COLUMN IF NOT EXISTS slot_key TEXT;

ALTER TABLE tools_mp_plan_assignments
  DROP CONSTRAINT IF EXISTS tools_mp_plan_assignments_slot_key_check;

ALTER TABLE tools_mp_plan_assignments
  ADD CONSTRAINT tools_mp_plan_assignments_slot_key_check
  CHECK (slot_key IS NULL OR slot_key IN ('breakfast', 'lunch', 'dinner'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_plan_assignments_plan_day_slot
  ON tools_mp_plan_assignments(plan_id, day_key, slot_key)
  WHERE slot_key IS NOT NULL;
