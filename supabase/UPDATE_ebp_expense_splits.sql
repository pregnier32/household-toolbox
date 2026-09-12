-- Event Budget Planner: optional multi-vendor expense splits (SMS-214).
-- Safe to re-run. Existing single-vendor expenses stay one part (no split rows).

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
