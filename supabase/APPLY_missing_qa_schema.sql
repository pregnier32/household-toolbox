-- Combined live-schema gaps from Sep 12–13 QA (Meal Planner, Shopping List,
-- Travel Log, Event Budget expense splits).
--
-- Safe to re-run. Does not include Home Maintenance (already live) or planned
-- HSA receipts / End of Life Planner tables.
--
-- After this succeeds, reload types:
--   npm run supabase:types

-- ============================================================================
-- EVENT BUDGET PLANNER: tools_ebp_expense_splits (SMS-214)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_ebp_expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES tools_ebp_expenses(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES tools_ebp_vendors(id) ON DELETE RESTRICT,

  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  display_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ebp_expense_splits_expense_id ON tools_ebp_expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_ebp_expense_splits_vendor_id ON tools_ebp_expense_splits(vendor_id);

CREATE OR REPLACE FUNCTION update_ebp_expense_splits_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_ebp_expense_splits_updated_at ON tools_ebp_expense_splits;
CREATE TRIGGER trigger_update_ebp_expense_splits_updated_at
  BEFORE UPDATE ON tools_ebp_expense_splits
  FOR EACH ROW
  EXECUTE FUNCTION update_ebp_expense_splits_updated_at();

ALTER TABLE tools_ebp_expense_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ebp: Users can view their own expense splits" ON tools_ebp_expense_splits;
CREATE POLICY "ebp: Users can view their own expense splits" ON tools_ebp_expense_splits
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_ebp_expenses x
      JOIN tools_ebp_events e ON e.id = x.event_id
      WHERE x.id = tools_ebp_expense_splits.expense_id
        AND e.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "ebp: Users can insert their own expense splits" ON tools_ebp_expense_splits;
CREATE POLICY "ebp: Users can insert their own expense splits" ON tools_ebp_expense_splits
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_ebp_expenses x
      JOIN tools_ebp_events e ON e.id = x.event_id
      WHERE x.id = tools_ebp_expense_splits.expense_id
        AND e.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "ebp: Users can update their own expense splits" ON tools_ebp_expense_splits;
CREATE POLICY "ebp: Users can update their own expense splits" ON tools_ebp_expense_splits
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_ebp_expenses x
      JOIN tools_ebp_events e ON e.id = x.event_id
      WHERE x.id = tools_ebp_expense_splits.expense_id
        AND e.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_ebp_expenses x
      JOIN tools_ebp_events e ON e.id = x.event_id
      WHERE x.id = tools_ebp_expense_splits.expense_id
        AND e.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "ebp: Users can delete their own expense splits" ON tools_ebp_expense_splits;
CREATE POLICY "ebp: Users can delete their own expense splits" ON tools_ebp_expense_splits
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_ebp_expenses x
      JOIN tools_ebp_events e ON e.id = x.event_id
      WHERE x.id = tools_ebp_expense_splits.expense_id
        AND e.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- MEAL PLANNER
-- ============================================================================
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

ALTER TABLE tools_mp_plan_assignments
  ADD COLUMN IF NOT EXISTS is_leftover BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE tools_mp_meals
  ADD COLUMN IF NOT EXISTS scale NUMERIC NOT NULL DEFAULT 1;

ALTER TABLE tools_mp_plans
  ADD COLUMN IF NOT EXISTS grocery_checked_item_ids UUID[] NOT NULL DEFAULT '{}';

-- ============================================================================
-- SHOPPING LIST
-- ============================================================================
ALTER TABLE tools_sl_list_items
  ADD COLUMN IF NOT EXISTS is_checked BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE tools_sl_list_items
  ADD COLUMN IF NOT EXISTS quantity NUMERIC;

ALTER TABLE tools_sl_list_items
  ADD COLUMN IF NOT EXISTS unit TEXT;

-- ============================================================================
-- TRAVEL LOG
-- ============================================================================
ALTER TABLE tools_tl_trips
  ADD COLUMN IF NOT EXISTS add_to_dashboard BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tl_trips_add_to_dashboard
  ON tools_tl_trips(add_to_dashboard)
  WHERE add_to_dashboard = true;

-- Reload PostgREST so new table/columns are visible immediately
NOTIFY pgrst, 'reload schema';
