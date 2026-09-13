-- Persist checked-off state for Meal Planner grocery modal lines (per plan).
-- Safe to rerun.

ALTER TABLE tools_mp_plans
  ADD COLUMN IF NOT EXISTS grocery_checked_item_ids UUID[] NOT NULL DEFAULT '{}';
