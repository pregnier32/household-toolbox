-- Event Budget Planner attachments: event files + expense files.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `event-budget-planner` storage bucket.
-- Event uploads:   {userId}/events/{eventId}/{timestamp}-{filename}
-- Expense uploads: {userId}/expenses/{expenseId}/{timestamp}-{filename}
--
-- Do not attach files to vendors, categories, types, or vendor-split rows.

CREATE TABLE IF NOT EXISTS tools_ebp_event_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES tools_ebp_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ebp_event_attachments_event_id ON tools_ebp_event_attachments(event_id);
CREATE INDEX IF NOT EXISTS idx_ebp_event_attachments_user_id ON tools_ebp_event_attachments(user_id);

ALTER TABLE tools_ebp_event_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own EBP event attachments" ON tools_ebp_event_attachments;
CREATE POLICY "Users can view their own EBP event attachments" ON tools_ebp_event_attachments
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own EBP event attachments" ON tools_ebp_event_attachments;
CREATE POLICY "Users can insert their own EBP event attachments" ON tools_ebp_event_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own EBP event attachments" ON tools_ebp_event_attachments;
CREATE POLICY "Users can update their own EBP event attachments" ON tools_ebp_event_attachments
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own EBP event attachments" ON tools_ebp_event_attachments;
CREATE POLICY "Users can delete their own EBP event attachments" ON tools_ebp_event_attachments
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE TABLE IF NOT EXISTS tools_ebp_expense_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES tools_ebp_expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ebp_expense_attachments_expense_id ON tools_ebp_expense_attachments(expense_id);
CREATE INDEX IF NOT EXISTS idx_ebp_expense_attachments_user_id ON tools_ebp_expense_attachments(user_id);

ALTER TABLE tools_ebp_expense_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own EBP expense attachments" ON tools_ebp_expense_attachments;
CREATE POLICY "Users can view their own EBP expense attachments" ON tools_ebp_expense_attachments
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own EBP expense attachments" ON tools_ebp_expense_attachments;
CREATE POLICY "Users can insert their own EBP expense attachments" ON tools_ebp_expense_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own EBP expense attachments" ON tools_ebp_expense_attachments;
CREATE POLICY "Users can update their own EBP expense attachments" ON tools_ebp_expense_attachments
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own EBP expense attachments" ON tools_ebp_expense_attachments;
CREATE POLICY "Users can delete their own EBP expense attachments" ON tools_ebp_expense_attachments
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
