-- HSA Tracker Tool Database Schema
-- All tables prefixed with 'tools_hsa_'
-- Matches UI: HSA accounts (tabs), deposits, expenses.
-- Receipt file storage is deferred; add tools_hsa_expense_receipts + storage bucket later.
--
-- Run in Supabase SQL Editor (idempotent: safe to re-run).
-- After deploy, add tool_id FK indexes to add-performance-indexes.sql if you maintain that file.

-- ============================================================================
-- ACCOUNTS (HSA account tabs: Self, Spouse, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hsa_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  card_color TEXT NOT NULL DEFAULT '#10b981',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hsa_accounts_user_id ON tools_hsa_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_hsa_accounts_tool_id ON tools_hsa_accounts(tool_id);
CREATE INDEX IF NOT EXISTS idx_hsa_accounts_user_tool ON tools_hsa_accounts(user_id, tool_id);

-- ============================================================================
-- DEFAULT ACCOUNTS (optional seed for first-time setup; read-only for users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hsa_default_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  card_color TEXT NOT NULL DEFAULT '#10b981',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hsa_default_accounts_name ON tools_hsa_default_accounts(name);
CREATE INDEX IF NOT EXISTS idx_hsa_default_accounts_display_order ON tools_hsa_default_accounts(display_order);

-- ============================================================================
-- DEPOSITS
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hsa_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES tools_hsa_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  source TEXT NOT NULL CHECK (source IN ('Payroll', 'Employer', 'Personal', 'Other')),
  tax_year INTEGER NOT NULL CHECK (tax_year >= 1900 AND tax_year <= 2100),
  note TEXT NOT NULL DEFAULT '',
  is_repeatable BOOLEAN NOT NULL DEFAULT false,
  recurrence_frequency TEXT CHECK (
    recurrence_frequency IS NULL
    OR recurrence_frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')
  ),
  recurrence_start DATE,
  recurrence_end DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tools_hsa_deposits_recurrence_consistency CHECK (
    (is_repeatable = false)
    OR (
      is_repeatable = true
      AND recurrence_frequency IS NOT NULL
      AND recurrence_start IS NOT NULL
    )
  ),
  CONSTRAINT tools_hsa_deposits_recurrence_end_after_start CHECK (
    recurrence_end IS NULL
    OR recurrence_start IS NULL
    OR recurrence_end >= recurrence_start
  )
);

CREATE INDEX IF NOT EXISTS idx_hsa_deposits_account_id ON tools_hsa_deposits(account_id);
CREATE INDEX IF NOT EXISTS idx_hsa_deposits_user_id ON tools_hsa_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_hsa_deposits_tool_id ON tools_hsa_deposits(tool_id);
CREATE INDEX IF NOT EXISTS idx_hsa_deposits_user_tool ON tools_hsa_deposits(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_hsa_deposits_date ON tools_hsa_deposits(date);
CREATE INDEX IF NOT EXISTS idx_hsa_deposits_account_tax_year ON tools_hsa_deposits(account_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_hsa_deposits_is_repeatable ON tools_hsa_deposits(is_repeatable) WHERE is_repeatable = true;

-- ============================================================================
-- EXPENSES (receipt files deferred — warn_until_receipt only until storage exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hsa_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES tools_hsa_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  provider_or_store TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (
    category IN ('Doctor Visit', 'Dental', 'Vision', 'Prescription', 'Other')
  ),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('HSA Card', 'Out of Pocket')),
  reimbursed BOOLEAN NOT NULL DEFAULT false,
  reimbursement_date DATE,
  warn_until_receipt BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tools_hsa_expenses_reimbursement_date_only_when_reimbursed CHECK (
    reimbursed = true OR reimbursement_date IS NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_hsa_expenses_account_id ON tools_hsa_expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_hsa_expenses_user_id ON tools_hsa_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_hsa_expenses_tool_id ON tools_hsa_expenses(tool_id);
CREATE INDEX IF NOT EXISTS idx_hsa_expenses_user_tool ON tools_hsa_expenses(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_hsa_expenses_date ON tools_hsa_expenses(date);
CREATE INDEX IF NOT EXISTS idx_hsa_expenses_reimbursable_pending ON tools_hsa_expenses(account_id, date)
  WHERE payment_method = 'Out of Pocket' AND reimbursed = false;

-- ============================================================================
-- UPDATED_AT TRIGGERS (secure search_path per system_design.md)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_hsa_accounts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_hsa_default_accounts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_hsa_deposits_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_hsa_expenses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_hsa_accounts_updated_at ON tools_hsa_accounts;
CREATE TRIGGER trigger_update_hsa_accounts_updated_at
  BEFORE UPDATE ON tools_hsa_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_hsa_accounts_updated_at();

DROP TRIGGER IF EXISTS trigger_update_hsa_default_accounts_updated_at ON tools_hsa_default_accounts;
CREATE TRIGGER trigger_update_hsa_default_accounts_updated_at
  BEFORE UPDATE ON tools_hsa_default_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_hsa_default_accounts_updated_at();

DROP TRIGGER IF EXISTS trigger_update_hsa_deposits_updated_at ON tools_hsa_deposits;
CREATE TRIGGER trigger_update_hsa_deposits_updated_at
  BEFORE UPDATE ON tools_hsa_deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_hsa_deposits_updated_at();

DROP TRIGGER IF EXISTS trigger_update_hsa_expenses_updated_at ON tools_hsa_expenses;
CREATE TRIGGER trigger_update_hsa_expenses_updated_at
  BEFORE UPDATE ON tools_hsa_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_hsa_expenses_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (optimized: (select auth.uid()))
-- ============================================================================
ALTER TABLE tools_hsa_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_hsa_default_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_hsa_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_hsa_expenses ENABLE ROW LEVEL SECURITY;

-- Accounts
DROP POLICY IF EXISTS "hsa: Users can view their own accounts" ON tools_hsa_accounts;
CREATE POLICY "hsa: Users can view their own accounts" ON tools_hsa_accounts
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hsa: Users can insert their own accounts" ON tools_hsa_accounts;
CREATE POLICY "hsa: Users can insert their own accounts" ON tools_hsa_accounts
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hsa: Users can update their own accounts" ON tools_hsa_accounts;
CREATE POLICY "hsa: Users can update their own accounts" ON tools_hsa_accounts
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hsa: Users can delete their own accounts" ON tools_hsa_accounts;
CREATE POLICY "hsa: Users can delete their own accounts" ON tools_hsa_accounts
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Default accounts (read-only seed data)
DROP POLICY IF EXISTS "hsa: Anyone can view default accounts" ON tools_hsa_default_accounts;
CREATE POLICY "hsa: Anyone can view default accounts" ON tools_hsa_default_accounts
  FOR SELECT TO authenticated USING (true);

-- Deposits
DROP POLICY IF EXISTS "hsa: Users can view their own deposits" ON tools_hsa_deposits;
CREATE POLICY "hsa: Users can view their own deposits" ON tools_hsa_deposits
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hsa: Users can insert their own deposits" ON tools_hsa_deposits;
CREATE POLICY "hsa: Users can insert their own deposits" ON tools_hsa_deposits
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM tools_hsa_accounts a
      WHERE a.id = account_id AND a.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "hsa: Users can update their own deposits" ON tools_hsa_deposits;
CREATE POLICY "hsa: Users can update their own deposits" ON tools_hsa_deposits
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM tools_hsa_accounts a
      WHERE a.id = account_id AND a.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "hsa: Users can delete their own deposits" ON tools_hsa_deposits;
CREATE POLICY "hsa: Users can delete their own deposits" ON tools_hsa_deposits
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Expenses
DROP POLICY IF EXISTS "hsa: Users can view their own expenses" ON tools_hsa_expenses;
CREATE POLICY "hsa: Users can view their own expenses" ON tools_hsa_expenses
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hsa: Users can insert their own expenses" ON tools_hsa_expenses;
CREATE POLICY "hsa: Users can insert their own expenses" ON tools_hsa_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM tools_hsa_accounts a
      WHERE a.id = account_id AND a.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "hsa: Users can update their own expenses" ON tools_hsa_expenses;
CREATE POLICY "hsa: Users can update their own expenses" ON tools_hsa_expenses
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM tools_hsa_accounts a
      WHERE a.id = account_id AND a.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "hsa: Users can delete their own expenses" ON tools_hsa_expenses;
CREATE POLICY "hsa: Users can delete their own expenses" ON tools_hsa_expenses
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- ============================================================================
-- SEED DEFAULT ACCOUNTS
-- ============================================================================
INSERT INTO tools_hsa_default_accounts (name, card_color, display_order) VALUES
  ('Self', '#10b981', 0)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- FUTURE: tools_hsa_expense_receipts (when file uploads are implemented)
-- ============================================================================
-- CREATE TABLE tools_hsa_expense_receipts (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   expense_id UUID NOT NULL REFERENCES tools_hsa_expenses(id) ON DELETE CASCADE,
--   file_url TEXT NOT NULL,
--   file_name TEXT,
--   file_size BIGINT,
--   file_type TEXT,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );
-- Storage bucket: hsa-tracker (see system_design.md storage policy template)
