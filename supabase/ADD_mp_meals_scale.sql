-- Recipe scale factor for Meal Planner grocery quantities.
-- Safe to rerun. Old meals without scale read as 1.

ALTER TABLE tools_mp_meals
  ADD COLUMN IF NOT EXISTS scale NUMERIC NOT NULL DEFAULT 1;
