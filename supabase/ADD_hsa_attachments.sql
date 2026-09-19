-- HSA Tracker expense receipts: multiple optional files per expense.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `hsa-tracker` storage bucket at
-- {userId}/{expenseId}/{timestamp}-{filename}

CREATE TABLE IF NOT EXISTS tools_hsa_expense_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES tools_hsa_expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hsa_expense_receipts_expense_id ON tools_hsa_expense_receipts(expense_id);
CREATE INDEX IF NOT EXISTS idx_hsa_expense_receipts_user_id ON tools_hsa_expense_receipts(user_id);

ALTER TABLE tools_hsa_expense_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own HSA receipts" ON tools_hsa_expense_receipts;
CREATE POLICY "Users can view their own HSA receipts" ON tools_hsa_expense_receipts
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own HSA receipts" ON tools_hsa_expense_receipts;
CREATE POLICY "Users can insert their own HSA receipts" ON tools_hsa_expense_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own HSA receipts" ON tools_hsa_expense_receipts;
CREATE POLICY "Users can update their own HSA receipts" ON tools_hsa_expense_receipts
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own HSA receipts" ON tools_hsa_expense_receipts;
CREATE POLICY "Users can delete their own HSA receipts" ON tools_hsa_expense_receipts
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
