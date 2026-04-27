-- Household Toolbox database build script (monolithic)
-- As of 2026-04-26
-- This file inlines logic from Supabase SQL scripts.
--
-- TABLE OF CONTENTS
--  1) users-rls-policy.sql
--  2) users-rls-policy-fix.sql
--  3) users-table-improvements.sql
--  4) create-billing-tables.sql
--  5) create-dashboard-items-table.sql
--  6) create-user-dashboard-kpis-table.sql
--  7) create-tools-tdl-tables.sql
--  8) create-tools-sl-tables.sql
--  9) create-tools-gt-tables.sql
-- 10) create-tools-mp-tables.sql
-- 11) create-notes-tables.sql
-- 12) create-important-documents-tables.sql
-- 13) create-calendar-events-tables.sql
-- 14) create-pet-care-schedule-tables.sql
-- 15) create-repair-history-tables.sql
-- 16) create-subscription-tracker-tables.sql
-- 17) create-healthcare-appts-history-tables.sql
-- 18) create-important-documents-storage-bucket.sql
-- 19) create-pet-care-schedule-storage-bucket.sql
-- 20) create-repair-history-storage-bucket.sql
-- 21) create-healthcare-appts-history-storage-bucket.sql
-- 22) cleanup-storage-policies.sql
-- 23) add-billing-date-to-users.sql
-- 24) migrate-existing-users-billing-date.sql
-- 25) add-mp-meals-is-active.sql
-- 26) add-priority-to-care-plan-items.sql
-- 27) add-add-to-dashboard-to-care-plan-items.sql
-- 28) add-add-to-dashboard-to-appointments.sql
-- 29) add-notes-to-care-plan-items.sql
-- 30) add-notes-to-food-entries.sql
-- 31) add-notes-to-veterinary-records.sql
-- 32) add-time-to-calendar-events.sql
-- 33) create-repair-history-defaults.sql
-- 34) update-repair-history-rls-policies.sql
-- 35) fix-function-search-path.sql
-- 36) optimize-rls-policies.sql
-- 37) add-performance-indexes.sql


-- ============================================================================
-- BEGIN FILE: users-rls-policy.sql
-- ============================================================================

-- Enable Row Level Security on users table (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow public inserts for user registration
-- This allows anonymous users to create accounts
CREATE POLICY "Allow public user registration" ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Optional: Create a policy to allow users to read their own data
-- This would require authentication, so we'll skip it for now
-- You can add this later when implementing sign-in functionality


-- ============================================================================
-- END FILE: users-rls-policy.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: users-rls-policy-fix.sql
-- ============================================================================

-- First, drop the existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public user registration" ON users;

-- Enable Row Level Security on users table (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow public inserts for user registration
-- This allows anonymous users to create accounts
-- Note: The service role key should bypass RLS, but this policy serves as a backup
CREATE POLICY "Allow public user registration" ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Verify the policy was created
-- You can check this in Supabase Dashboard under Authentication > Policies


-- ============================================================================
-- END FILE: users-rls-policy-fix.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: users-table-improvements.sql
-- ============================================================================

-- Users Table Improvements
-- This script adds indexes, constraints, and optimizations to the users table

-- ============================================================================
-- 1. ADD MISSING INDEXES (Critical for Performance)
-- ============================================================================

-- Index on email (most frequently queried field)
-- Used in: sign in, sign up, password reset, profile updates
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index on active status (used in filtering active users)
-- Used in: session validation, stats queries
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- Index on user_status (used in admin authorization checks)
-- Used in: admin route authorization
CREATE INDEX IF NOT EXISTS idx_users_user_status ON users(user_status);

-- Composite index for common query pattern: active users by status
CREATE INDEX IF NOT EXISTS idx_users_active_status ON users(active, user_status);

-- Index on created_at for sorting and analytics
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ============================================================================
-- 2. ADD UNIQUE CONSTRAINT ON EMAIL (Data Integrity)
-- ============================================================================

-- Add unique constraint on email if it doesn't exist
-- This ensures no duplicate emails can be inserted
-- Note: This will fail if duplicate emails already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_email_key' 
    AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;

-- ============================================================================
-- 3. ADD UPDATED_AT TIMESTAMP (Audit Trail)
-- ============================================================================

-- Add updated_at column if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON users;
CREATE TRIGGER trigger_update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_users_updated_at();

-- ============================================================================
-- 4. FIELD ANALYSIS & RECOMMENDATIONS
-- ============================================================================

-- NOTE: The following fields should be reviewed:

-- 1. 'user_id' field appears to be redundant with 'id'
--    - Both are UUIDs and 'user_id' is set to the same value as 'id' in signup
--    - Consider removing 'user_id' if it's not used elsewhere
--    - If you need to keep it, add a check constraint: CHECK (user_id = id)

-- 2. 'active' field is TEXT ('Y'/'N') but should ideally be BOOLEAN
--    - Current: active TEXT
--    - Recommended: active BOOLEAN DEFAULT TRUE
--    - Migration would require: UPDATE users SET active = (active = 'Y')::boolean;
--    - This is a breaking change, so only do if you can update all code references

-- 3. 'guest_admin_id' field appears unused in codebase
--    - Only found in TypeScript types, not in actual queries
--    - Consider removing if not needed, or document its purpose

-- 4. 'user_status' could benefit from a CHECK constraint
--    - Add constraint to ensure only valid statuses: 'admin', 'superadmin', etc.
--    - Example: ALTER TABLE users ADD CONSTRAINT users_user_status_check 
--               CHECK (user_status IN ('admin', 'superadmin', 'guest'));

-- ============================================================================
-- 5. OPTIONAL: ADD CHECK CONSTRAINTS (Data Validation)
-- ============================================================================

-- Ensure active is only 'Y' or 'N' (if keeping as TEXT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_active_check' 
    AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_active_check CHECK (active IN ('Y', 'N'));
  END IF;
END $$;

-- Ensure email is lowercase (optional, but recommended)
-- This can be done via application code or a trigger
-- For now, we'll rely on application code to lowercase emails

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify improvements)
-- ============================================================================

-- Check indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users';

-- Check constraints
-- SELECT conname, contype, pg_get_constraintdef(oid) 
-- FROM pg_constraint WHERE conrelid = 'users'::regclass;

-- Check table structure
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'users' 
-- ORDER BY ordinal_position;


-- ============================================================================
-- END FILE: users-table-improvements.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-billing-tables.sql
-- ============================================================================

-- Create billing_active and billing_history tables
-- This script creates the tables for managing active and historical billing records

-- ============================================================================
-- 1. CREATE billing_active TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_active (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  billing_date DATE NOT NULL, -- The day of month when billing occurs
  item_type TEXT NOT NULL CHECK (item_type IN ('tool_subscription', 'platform_fee')),
  tool_id UUID REFERENCES tools(id) ON DELETE SET NULL, -- NULL for platform_fee
  tool_name TEXT, -- Denormalized for quick access
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  users_tools_id UUID REFERENCES users_tools(id) ON DELETE SET NULL, -- Link to source subscription
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraints using partial indexes
CREATE UNIQUE INDEX IF NOT EXISTS unique_platform_fee_per_period 
  ON billing_active(user_id, billing_period_start, billing_period_end) 
  WHERE item_type = 'platform_fee';

CREATE UNIQUE INDEX IF NOT EXISTS unique_tool_subscription_per_period 
  ON billing_active(users_tools_id, billing_period_start, billing_period_end) 
  WHERE item_type = 'tool_subscription' AND users_tools_id IS NOT NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_active_user_id ON billing_active(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_active_billing_date ON billing_active(billing_date);
CREATE INDEX IF NOT EXISTS idx_billing_active_status ON billing_active(status);
CREATE INDEX IF NOT EXISTS idx_billing_active_users_tools_id ON billing_active(users_tools_id);
CREATE INDEX IF NOT EXISTS idx_billing_active_period ON billing_active(billing_period_start, billing_period_end);

-- ============================================================================
-- 2. CREATE billing_history TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  billing_date DATE NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('tool_subscription', 'platform_fee')),
  tool_id UUID REFERENCES tools(id) ON DELETE SET NULL,
  tool_name TEXT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('processed', 'failed', 'refunded')),
  users_tools_id UUID REFERENCES users_tools(id) ON DELETE SET NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Original creation date from billing_active
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Payment processing metadata
  payment_intent_id TEXT,
  invoice_id TEXT,
  notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_history_user_id ON billing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_billing_date ON billing_history(billing_date);
CREATE INDEX IF NOT EXISTS idx_billing_history_processed_at ON billing_history(processed_at);
CREATE INDEX IF NOT EXISTS idx_billing_history_users_tools_id ON billing_history(users_tools_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_period ON billing_history(billing_period_start, billing_period_end);

-- ============================================================================
-- 3. CREATE FUNCTION TO UPDATE updated_at TIMESTAMP
-- ============================================================================

CREATE OR REPLACE FUNCTION update_billing_active_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_billing_active_updated_at
  BEFORE UPDATE ON billing_active
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_active_updated_at();

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE billing_active ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own billing records
CREATE POLICY "Users can view their own active billing" ON billing_active
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own billing history" ON billing_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all records
CREATE POLICY "Service role can manage billing_active" ON billing_active
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage billing_history" ON billing_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- END FILE: create-billing-tables.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-dashboard-items-table.sql
-- ============================================================================

-- Create dashboard_items table for unified dashboard items from all tools
-- This table stores items that can appear in either Calendar view or Action Items

CREATE TABLE IF NOT EXISTS dashboard_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('calendar_event', 'action_item', 'both')),
  due_date TIMESTAMPTZ,
  scheduled_date TIMESTAMPTZ,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dashboard_items_user_type_status 
  ON dashboard_items(user_id, type, status);

CREATE INDEX IF NOT EXISTS idx_dashboard_items_user_scheduled_date 
  ON dashboard_items(user_id, scheduled_date) 
  WHERE scheduled_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dashboard_items_user_due_date 
  ON dashboard_items(user_id, due_date) 
  WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dashboard_items_tool_id 
  ON dashboard_items(tool_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_items_user_status 
  ON dashboard_items(user_id, status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dashboard_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
-- Drop trigger if it exists first
DROP TRIGGER IF EXISTS update_dashboard_items_updated_at ON dashboard_items;
CREATE TRIGGER update_dashboard_items_updated_at
  BEFORE UPDATE ON dashboard_items
  FOR EACH ROW
  EXECUTE FUNCTION update_dashboard_items_updated_at();

-- Enable Row Level Security
ALTER TABLE dashboard_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running the script)
DROP POLICY IF EXISTS "Users can view their own dashboard items" ON dashboard_items;
DROP POLICY IF EXISTS "Users can insert their own dashboard items" ON dashboard_items;
DROP POLICY IF EXISTS "Users can update their own dashboard items" ON dashboard_items;
DROP POLICY IF EXISTS "Users can delete their own dashboard items" ON dashboard_items;

-- Create policy: Users can only see their own items
CREATE POLICY "Users can view their own dashboard items"
  ON dashboard_items
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can insert their own items
CREATE POLICY "Users can insert their own dashboard items"
  ON dashboard_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own items
CREATE POLICY "Users can update their own dashboard items"
  ON dashboard_items
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy: Users can delete their own items
CREATE POLICY "Users can delete their own dashboard items"
  ON dashboard_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- END FILE: create-dashboard-items-table.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-user-dashboard-kpis-table.sql
-- ============================================================================

-- Create user_dashboard_kpis table to store user preferences for displaying KPIs on the main dashboard
-- This allows users to toggle which KPIs from various tools they want to see on their main dashboard

CREATE TABLE IF NOT EXISTS user_dashboard_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  kpi_key TEXT NOT NULL, -- e.g., 'subscription_tracker_total_monthly_spend'
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, tool_id, kpi_key)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_dashboard_kpis_user_tool ON user_dashboard_kpis(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_user_dashboard_kpis_user_enabled ON user_dashboard_kpis(user_id, is_enabled) WHERE is_enabled = true;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_dashboard_kpis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_user_dashboard_kpis_updated_at ON user_dashboard_kpis;
CREATE TRIGGER trigger_update_user_dashboard_kpis_updated_at
  BEFORE UPDATE ON user_dashboard_kpis
  FOR EACH ROW
  EXECUTE FUNCTION update_user_dashboard_kpis_updated_at();

-- Enable Row Level Security
ALTER TABLE user_dashboard_kpis ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own KPI preferences
-- Drop existing policies if they exist, then create them

-- SELECT policy
DROP POLICY IF EXISTS "Users can view their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can view their own dashboard KPIs" ON user_dashboard_kpis
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT policy
DROP POLICY IF EXISTS "Users can insert their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can insert their own dashboard KPIs" ON user_dashboard_kpis
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can update their own dashboard KPIs" ON user_dashboard_kpis
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can delete their own dashboard KPIs" ON user_dashboard_kpis
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- END FILE: create-user-dashboard-kpis-table.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-tools-tdl-tables.sql
-- ============================================================================

-- To Do List Tool Database Schema
-- All tables prefixed with 'tools_tdl_'
-- Matches UI: categories (e.g. Home, Work, Kids, Errands), tasks per category.
-- RLS uses (select auth.uid()) per system_design.md.

-- ============================================================================
-- CATEGORIES (user-created headers: Home, Work, Kids, Errands, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_tdl_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  card_color TEXT DEFAULT '#10b981',
  show_on_dashboard BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tdl_categories_user_id ON tools_tdl_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_tdl_categories_tool_id ON tools_tdl_categories(tool_id);
CREATE INDEX IF NOT EXISTS idx_tdl_categories_user_tool ON tools_tdl_categories(user_id, tool_id);

-- ============================================================================
-- DEFAULT CATEGORIES (seed data: Home, Work, Kids, Errands for first-time setup)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_tdl_default_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  card_color TEXT DEFAULT '#10b981',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tdl_default_categories_display_order ON tools_tdl_default_categories(display_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tdl_default_categories_name ON tools_tdl_default_categories(name);

-- ============================================================================
-- TASKS (one per task; belongs to a category)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_tdl_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES tools_tdl_categories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'In Progress', 'Delayed', 'Completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tdl_tasks_category_id ON tools_tdl_tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tdl_tasks_user_id ON tools_tdl_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tdl_tasks_tool_id ON tools_tdl_tasks(tool_id);
CREATE INDEX IF NOT EXISTS idx_tdl_tasks_user_tool ON tools_tdl_tasks(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_tdl_tasks_due_date ON tools_tdl_tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tdl_tasks_status ON tools_tdl_tasks(status);

-- ============================================================================
-- UPDATED_AT TRIGGERS (with secure search_path per system_design.md)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_tdl_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_tdl_default_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_tdl_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_tdl_categories_updated_at ON tools_tdl_categories;
CREATE TRIGGER trigger_update_tdl_categories_updated_at
  BEFORE UPDATE ON tools_tdl_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_tdl_categories_updated_at();

DROP TRIGGER IF EXISTS trigger_update_tdl_default_categories_updated_at ON tools_tdl_default_categories;
CREATE TRIGGER trigger_update_tdl_default_categories_updated_at
  BEFORE UPDATE ON tools_tdl_default_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_tdl_default_categories_updated_at();

DROP TRIGGER IF EXISTS trigger_update_tdl_tasks_updated_at ON tools_tdl_tasks;
CREATE TRIGGER trigger_update_tdl_tasks_updated_at
  BEFORE UPDATE ON tools_tdl_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tdl_tasks_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (optimized: (select auth.uid()) per design_system)
-- ============================================================================
ALTER TABLE tools_tdl_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_tdl_default_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_tdl_tasks ENABLE ROW LEVEL SECURITY;

-- Categories
DROP POLICY IF EXISTS "Users can view their own categories" ON tools_tdl_categories;
CREATE POLICY "Users can view their own categories" ON tools_tdl_categories
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own categories" ON tools_tdl_categories;
CREATE POLICY "Users can insert their own categories" ON tools_tdl_categories
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own categories" ON tools_tdl_categories;
CREATE POLICY "Users can update their own categories" ON tools_tdl_categories
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own categories" ON tools_tdl_categories;
CREATE POLICY "Users can delete their own categories" ON tools_tdl_categories
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Default categories (read-only; used to seed user categories)
DROP POLICY IF EXISTS "Anyone can view default categories" ON tools_tdl_default_categories;
CREATE POLICY "Anyone can view default categories" ON tools_tdl_default_categories
  FOR SELECT TO authenticated USING (true);

-- Tasks
DROP POLICY IF EXISTS "Users can view their own tasks" ON tools_tdl_tasks;
CREATE POLICY "Users can view their own tasks" ON tools_tdl_tasks
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own tasks" ON tools_tdl_tasks;
CREATE POLICY "Users can insert their own tasks" ON tools_tdl_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    EXISTS (
      SELECT 1 FROM tools_tdl_categories c
      WHERE c.id = category_id AND c.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own tasks" ON tools_tdl_tasks;
CREATE POLICY "Users can update their own tasks" ON tools_tdl_tasks
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id AND
    EXISTS (
      SELECT 1 FROM tools_tdl_categories c
      WHERE c.id = category_id AND c.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own tasks" ON tools_tdl_tasks;
CREATE POLICY "Users can delete their own tasks" ON tools_tdl_tasks
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- ============================================================================
-- SEED DEFAULT CATEGORIES (Home, Work, Kids, Errands)
-- ============================================================================
INSERT INTO tools_tdl_default_categories (name, card_color, display_order) VALUES
  ('Home', '#10b981', 0),
  ('Work', '#3b82f6', 1),
  ('Kids', '#8b5cf6', 2),
  ('Errands', '#f59e0b', 3)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- END FILE: create-tools-tdl-tables.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-tools-sl-tables.sql
-- ============================================================================

-- Shopping List Tool Database Schema
-- All tables prefixed with 'tools_sl_'
-- Supports: master items by category (with default seed), shopping lists (active/history), list items, show_on_dashboard.
-- RLS uses (select auth.uid()) for user isolation.
-- Design system: Database Standards (foreign key indexes, optimized RLS, function search_path).

-- ============================================================================
-- DEFAULT ITEMS (seed: standard starting list by category; used to seed user items)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_sl_default_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sl_default_items_category ON tools_sl_default_items(category);
CREATE INDEX IF NOT EXISTS idx_sl_default_items_display_order ON tools_sl_default_items(display_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sl_default_items_category_name ON tools_sl_default_items(category, name);

-- ============================================================================
-- ITEMS (user's master list; can be seeded from default, then add/remove)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_sl_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sl_items_user_id ON tools_sl_items(user_id);
CREATE INDEX IF NOT EXISTS idx_sl_items_tool_id ON tools_sl_items(tool_id);
CREATE INDEX IF NOT EXISTS idx_sl_items_user_tool ON tools_sl_items(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_sl_items_category ON tools_sl_items(category);

-- ============================================================================
-- LISTS (shopping lists: name, date, active vs history, show on dashboard)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_sl_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  list_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_on_dashboard BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sl_lists_user_id ON tools_sl_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_sl_lists_tool_id ON tools_sl_lists(tool_id);
CREATE INDEX IF NOT EXISTS idx_sl_lists_user_tool ON tools_sl_lists(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_sl_lists_is_active ON tools_sl_lists(is_active);
CREATE INDEX IF NOT EXISTS idx_sl_lists_show_on_dashboard ON tools_sl_lists(show_on_dashboard) WHERE show_on_dashboard = true;

-- ============================================================================
-- LIST ITEMS (junction: which items are in each list; references user's master item)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_sl_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES tools_sl_lists(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES tools_sl_items(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sl_list_items_list_id ON tools_sl_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_sl_list_items_item_id ON tools_sl_list_items(item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sl_list_items_list_item ON tools_sl_list_items(list_id, item_id);

-- ============================================================================
-- UPDATED_AT TRIGGERS (with search_path for security)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_sl_default_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_sl_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_sl_lists_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_sl_default_items_updated_at ON tools_sl_default_items;
CREATE TRIGGER trigger_update_sl_default_items_updated_at
  BEFORE UPDATE ON tools_sl_default_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sl_default_items_updated_at();

DROP TRIGGER IF EXISTS trigger_update_sl_items_updated_at ON tools_sl_items;
CREATE TRIGGER trigger_update_sl_items_updated_at
  BEFORE UPDATE ON tools_sl_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sl_items_updated_at();

DROP TRIGGER IF EXISTS trigger_update_sl_lists_updated_at ON tools_sl_lists;
CREATE TRIGGER trigger_update_sl_lists_updated_at
  BEFORE UPDATE ON tools_sl_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_sl_lists_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE tools_sl_default_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_sl_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_sl_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_sl_list_items ENABLE ROW LEVEL SECURITY;

-- Default items: read-only for authenticated (seed data)
DROP POLICY IF EXISTS "Anyone can view default items" ON tools_sl_default_items;
CREATE POLICY "Anyone can view default items" ON tools_sl_default_items
  FOR SELECT TO authenticated USING (true);

-- Items: user CRUD on own rows
DROP POLICY IF EXISTS "Users can view their own items" ON tools_sl_items;
CREATE POLICY "Users can view their own items" ON tools_sl_items
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert their own items" ON tools_sl_items;
CREATE POLICY "Users can insert their own items" ON tools_sl_items
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update their own items" ON tools_sl_items;
CREATE POLICY "Users can update their own items" ON tools_sl_items
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete their own items" ON tools_sl_items;
CREATE POLICY "Users can delete their own items" ON tools_sl_items
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Lists: user CRUD on own rows
DROP POLICY IF EXISTS "Users can view their own lists" ON tools_sl_lists;
CREATE POLICY "Users can view their own lists" ON tools_sl_lists
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert their own lists" ON tools_sl_lists;
CREATE POLICY "Users can insert their own lists" ON tools_sl_lists
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update their own lists" ON tools_sl_lists;
CREATE POLICY "Users can update their own lists" ON tools_sl_lists
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete their own lists" ON tools_sl_lists;
CREATE POLICY "Users can delete their own lists" ON tools_sl_lists
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- List items: access via list ownership
DROP POLICY IF EXISTS "Users can view their own list items" ON tools_sl_list_items;
CREATE POLICY "Users can view their own list items" ON tools_sl_list_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_sl_lists l WHERE l.id = list_id AND l.user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users can insert their own list items" ON tools_sl_list_items;
CREATE POLICY "Users can insert their own list items" ON tools_sl_list_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tools_sl_lists l WHERE l.id = list_id AND l.user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users can update their own list items" ON tools_sl_list_items;
CREATE POLICY "Users can update their own list items" ON tools_sl_list_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_sl_lists l WHERE l.id = list_id AND l.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM tools_sl_lists l WHERE l.id = list_id AND l.user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users can delete their own list items" ON tools_sl_list_items;
CREATE POLICY "Users can delete their own list items" ON tools_sl_list_items
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_sl_lists l WHERE l.id = list_id AND l.user_id = (select auth.uid())));

-- ============================================================================
-- SEED: Standard starting list (from items_list JSON)
-- ============================================================================
INSERT INTO tools_sl_default_items (category, name, display_order) VALUES
  ('Produce', 'Apples', 0),
  ('Produce', 'Bananas', 1),
  ('Produce', 'Oranges', 2),
  ('Produce', 'Grapes', 3),
  ('Produce', 'Strawberries', 4),
  ('Produce', 'Blueberries', 5),
  ('Produce', 'Lemons', 6),
  ('Produce', 'Limes', 7),
  ('Produce', 'Avocados', 8),
  ('Produce', 'Tomatoes', 9),
  ('Produce', 'Cherry tomatoes', 10),
  ('Produce', 'Lettuce', 11),
  ('Produce', 'Spinach', 12),
  ('Produce', 'Kale', 13),
  ('Produce', 'Carrots', 14),
  ('Produce', 'Celery', 15),
  ('Produce', 'Cucumbers', 16),
  ('Produce', 'Bell peppers', 17),
  ('Produce', 'Onions', 18),
  ('Produce', 'Garlic', 19),
  ('Produce', 'Potatoes', 20),
  ('Produce', 'Sweet potatoes', 21),
  ('Produce', 'Broccoli', 22),
  ('Produce', 'Cauliflower', 23),
  ('Produce', 'Zucchini', 24),
  ('Produce', 'Mushrooms', 25),
  ('Produce', 'Fresh herbs', 26),
  ('Meat & Seafood', 'Chicken breasts', 0),
  ('Meat & Seafood', 'Chicken thighs', 1),
  ('Meat & Seafood', 'Ground beef', 2),
  ('Meat & Seafood', 'Steak', 3),
  ('Meat & Seafood', 'Pork chops', 4),
  ('Meat & Seafood', 'Bacon', 5),
  ('Meat & Seafood', 'Sausage', 6),
  ('Meat & Seafood', 'Deli turkey', 7),
  ('Meat & Seafood', 'Deli ham', 8),
  ('Meat & Seafood', 'Salmon', 9),
  ('Meat & Seafood', 'Shrimp', 10),
  ('Meat & Seafood', 'Canned tuna', 11),
  ('Meat & Seafood', 'Frozen fish fillets', 12),
  ('Dairy & Refrigerated', 'Milk', 0),
  ('Dairy & Refrigerated', 'Almond milk', 1),
  ('Dairy & Refrigerated', 'Oat milk', 2),
  ('Dairy & Refrigerated', 'Butter', 3),
  ('Dairy & Refrigerated', 'Margarine', 4),
  ('Dairy & Refrigerated', 'Eggs', 5),
  ('Dairy & Refrigerated', 'Shredded cheese', 6),
  ('Dairy & Refrigerated', 'Sliced cheese', 7),
  ('Dairy & Refrigerated', 'Cream cheese', 8),
  ('Dairy & Refrigerated', 'Yogurt', 9),
  ('Dairy & Refrigerated', 'Greek yogurt', 10),
  ('Dairy & Refrigerated', 'Sour cream', 11),
  ('Dairy & Refrigerated', 'Cottage cheese', 12),
  ('Dairy & Refrigerated', 'Heavy cream', 13),
  ('Dairy & Refrigerated', 'Coffee creamer', 14),
  ('Bakery & Bread', 'Sandwich bread', 0),
  ('Bakery & Bread', 'Hamburger buns', 1),
  ('Bakery & Bread', 'Hot dog buns', 2),
  ('Bakery & Bread', 'Tortillas', 3),
  ('Bakery & Bread', 'Bagels', 4),
  ('Bakery & Bread', 'English muffins', 5),
  ('Bakery & Bread', 'Dinner rolls', 6),
  ('Bakery & Bread', 'Croissants', 7),
  ('Pantry Staples', 'Rice', 0),
  ('Pantry Staples', 'Pasta', 1),
  ('Pantry Staples', 'Spaghetti', 2),
  ('Pantry Staples', 'Mac & cheese', 3),
  ('Pantry Staples', 'Flour', 4),
  ('Pantry Staples', 'Sugar', 5),
  ('Pantry Staples', 'Brown sugar', 6),
  ('Pantry Staples', 'Powdered sugar', 7),
  ('Pantry Staples', 'Baking soda', 8),
  ('Pantry Staples', 'Baking powder', 9),
  ('Pantry Staples', 'Cornstarch', 10),
  ('Pantry Staples', 'Oats', 11),
  ('Pantry Staples', 'Cereal', 12),
  ('Pantry Staples', 'Pancake mix', 13),
  ('Pantry Staples', 'Syrup', 14),
  ('Pantry Staples', 'Peanut butter', 15),
  ('Pantry Staples', 'Jelly', 16),
  ('Pantry Staples', 'Honey', 17),
  ('Pantry Staples', 'Cooking oil', 18),
  ('Pantry Staples', 'Olive oil', 19),
  ('Pantry Staples', 'Vinegar', 20),
  ('Pantry Staples', 'Soy sauce', 21),
  ('Pantry Staples', 'Ketchup', 22),
  ('Pantry Staples', 'Mustard', 23),
  ('Pantry Staples', 'Mayonnaise', 24),
  ('Pantry Staples', 'Salad dressing', 25),
  ('Pantry Staples', 'Hot sauce', 26),
  ('Pantry Staples', 'Salsa', 27),
  ('Pantry Staples', 'Pasta sauce', 28),
  ('Pantry Staples', 'Canned vegetables', 29),
  ('Pantry Staples', 'Canned beans', 30),
  ('Pantry Staples', 'Canned soup', 31),
  ('Pantry Staples', 'Broth', 32),
  ('Pantry Staples', 'Crackers', 33),
  ('Spices & Seasonings', 'Salt', 0),
  ('Spices & Seasonings', 'Pepper', 1),
  ('Spices & Seasonings', 'Garlic powder', 2),
  ('Spices & Seasonings', 'Onion powder', 3),
  ('Spices & Seasonings', 'Paprika', 4),
  ('Spices & Seasonings', 'Chili powder', 5),
  ('Spices & Seasonings', 'Italian seasoning', 6),
  ('Spices & Seasonings', 'Cinnamon', 7),
  ('Spices & Seasonings', 'Cumin', 8),
  ('Spices & Seasonings', 'Taco seasoning', 9),
  ('Frozen Foods', 'Frozen vegetables', 0),
  ('Frozen Foods', 'Frozen fruit', 1),
  ('Frozen Foods', 'Frozen pizza', 2),
  ('Frozen Foods', 'Ice cream', 3),
  ('Frozen Foods', 'Frozen meals', 4),
  ('Frozen Foods', 'Chicken nuggets', 5),
  ('Frozen Foods', 'Frozen fries', 6),
  ('Snacks', 'Chips', 0),
  ('Snacks', 'Pretzels', 1),
  ('Snacks', 'Popcorn', 2),
  ('Snacks', 'Granola bars', 3),
  ('Snacks', 'Protein bars', 4),
  ('Snacks', 'Trail mix', 5),
  ('Snacks', 'Nuts', 6),
  ('Snacks', 'Cookies', 7),
  ('Snacks', 'Crackers', 8),
  ('Snacks', 'Chocolate', 9),
  ('Beverages', 'Coffee', 0),
  ('Beverages', 'Tea', 1),
  ('Beverages', 'Bottled water', 2),
  ('Beverages', 'Sparkling water', 3),
  ('Beverages', 'Soda', 4),
  ('Beverages', 'Juice', 5),
  ('Beverages', 'Sports drinks', 6),
  ('Beverages', 'Energy drinks', 7),
  ('Paper & Disposable Goods', 'Toilet paper', 0),
  ('Paper & Disposable Goods', 'Paper towels', 1),
  ('Paper & Disposable Goods', 'Facial tissues', 2),
  ('Paper & Disposable Goods', 'Napkins', 3),
  ('Paper & Disposable Goods', 'Aluminum foil', 4),
  ('Paper & Disposable Goods', 'Plastic wrap', 5),
  ('Paper & Disposable Goods', 'Parchment paper', 6),
  ('Paper & Disposable Goods', 'Trash bags', 7),
  ('Paper & Disposable Goods', 'Sandwich bags', 8),
  ('Paper & Disposable Goods', 'Food storage bags', 9),
  ('Cleaning Supplies', 'Dish soap', 0),
  ('Cleaning Supplies', 'Dishwasher pods', 1),
  ('Cleaning Supplies', 'Laundry detergent', 2),
  ('Cleaning Supplies', 'Fabric softener', 3),
  ('Cleaning Supplies', 'Stain remover', 4),
  ('Cleaning Supplies', 'All-purpose cleaner', 5),
  ('Cleaning Supplies', 'Glass cleaner', 6),
  ('Cleaning Supplies', 'Disinfecting wipes', 7),
  ('Cleaning Supplies', 'Sponges', 8),
  ('Cleaning Supplies', 'Scrub brushes', 9),
  ('Cleaning Supplies', 'Broom', 10),
  ('Cleaning Supplies', 'Mop pads', 11),
  ('Cleaning Supplies', 'Toilet cleaner', 12),
  ('Cleaning Supplies', 'Toilet brush', 13),
  ('Personal Care', 'Shampoo', 0),
  ('Personal Care', 'Conditioner', 1),
  ('Personal Care', 'Body wash', 2),
  ('Personal Care', 'Bar soap', 3),
  ('Personal Care', 'Hand soap', 4),
  ('Personal Care', 'Toothpaste', 5),
  ('Personal Care', 'Toothbrushes', 6),
  ('Personal Care', 'Floss', 7),
  ('Personal Care', 'Mouthwash', 8),
  ('Personal Care', 'Deodorant', 9),
  ('Personal Care', 'Razors', 10),
  ('Personal Care', 'Shaving cream', 11),
  ('Personal Care', 'Lotion', 12),
  ('Personal Care', 'Sunscreen', 13),
  ('Personal Care', 'Feminine hygiene products', 14),
  ('Personal Care', 'Cotton balls', 15),
  ('Personal Care', 'Cotton swabs', 16),
  ('Baby', 'Diapers', 0),
  ('Baby', 'Pull-ups', 1),
  ('Baby', 'Baby wipes', 2),
  ('Baby', 'Formula', 3),
  ('Baby', 'Baby food', 4),
  ('Baby', 'Baby shampoo', 5),
  ('Baby', 'Diaper rash cream', 6),
  ('Pet Supplies', 'Dog food', 0),
  ('Pet Supplies', 'Cat food', 1),
  ('Pet Supplies', 'Pet treats', 2),
  ('Pet Supplies', 'Litter', 3),
  ('Pet Supplies', 'Waste bags', 4),
  ('Pet Supplies', 'Pet shampoo', 5),
  ('Health & Medicine', 'Pain relievers', 0),
  ('Health & Medicine', 'Cold medicine', 1),
  ('Health & Medicine', 'Allergy medicine', 2),
  ('Health & Medicine', 'Cough drops', 3),
  ('Health & Medicine', 'Vitamins', 4),
  ('Health & Medicine', 'Bandages', 5),
  ('Health & Medicine', 'Hydrogen peroxide', 6),
  ('Health & Medicine', 'Rubbing alcohol', 7),
  ('Health & Medicine', 'Thermometer', 8),
  ('Household Items', 'Light bulbs', 0),
  ('Household Items', 'Batteries', 1),
  ('Household Items', 'Extension cords', 2),
  ('Household Items', 'Power strips', 3),
  ('Household Items', 'Flashlights', 4),
  ('Household Items', 'Air filters', 5),
  ('Household Items', 'Furnace filters', 6),
  ('Household Items', 'Water filters', 7),
  ('Household Items', 'Smoke detector batteries', 8),
  ('Household Items', 'Command hooks', 9),
  ('Household Items', 'Super glue', 10),
  ('Household Items', 'Duct tape', 11),
  ('Household Items', 'Packing tape', 12),
  ('Household Items', 'Hangers', 13),
  ('Household Items', 'Laundry baskets', 14),
  ('Household Items', 'Lint roller', 15),
  ('Household Items', 'Iron', 16),
  ('Household Items', 'Ironing board cover', 17),
  ('Household Items', 'Garment bags', 18),
  ('Household Items', 'Shoe inserts', 19),
  ('Household Items', 'Bed sheets', 20),
  ('Household Items', 'Pillowcases', 21),
  ('Household Items', 'Pillows', 22),
  ('Household Items', 'Blankets', 23),
  ('Household Items', 'Comforter', 24),
  ('Household Items', 'Mattress protector', 25),
  ('Household Items', 'Towels', 26),
  ('Household Items', 'Washcloths', 27),
  ('Household Items', 'Bath mats', 28),
  ('Household Items', 'Shower curtain', 29),
  ('Household Items', 'Shower curtain liner', 30),
  ('Household Items', 'Dish towels', 31),
  ('Household Items', 'Oven mitts', 32),
  ('Household Items', 'Pot holders', 33),
  ('Household Items', 'Food storage containers', 34),
  ('Household Items', 'Measuring cups', 35),
  ('Household Items', 'Measuring spoons', 36),
  ('Household Items', 'Cutting boards', 37),
  ('Household Items', 'Can opener', 38),
  ('Household Items', 'Kitchen scissors', 39),
  ('Household Items', 'Water bottle', 40),
  ('Household Items', 'Travel mug', 41),
  ('Household Items', 'Lawn bags', 42),
  ('Household Items', 'Garden gloves', 43),
  ('Household Items', 'Ice melt', 44),
  ('Household Items', 'Snow shovel', 45),
  ('Household Items', 'Outdoor light bulbs', 46),
  ('Household Items', 'Charcoal', 47),
  ('Household Items', 'Lighter fluid', 48),
  ('Household Items', 'Bug spray', 49),
  ('Household Items', 'Citronella candles', 50),
  ('Household Items', 'Storage bins', 51),
  ('Household Items', 'Drawer organizers', 52),
  ('Household Items', 'Closet organizers', 53),
  ('Household Items', 'Shelf liners', 54),
  ('Household Items', 'Label stickers', 55),
  ('Household Items', 'Storage baskets', 56)
ON CONFLICT (category, name) DO NOTHING;

-- ============================================================================
-- END FILE: create-tools-sl-tables.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-tools-gt-tables.sql
-- ============================================================================

-- Goals Tracking Tool Database Schema
-- All tables prefixed with 'tools_gt_'
-- Matches UI: categories, goals (with phases/tasks, update notes, reminder), dashboard visibility.
-- RLS uses (select auth.uid()) for user isolation.

-- ============================================================================
-- DEFAULT CATEGORIES (seed data: Home, Finance, Health, Career, Personal)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_gt_default_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  card_color TEXT NOT NULL DEFAULT '#10b981',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_default_categories_name ON tools_gt_default_categories(name);
CREATE INDEX IF NOT EXISTS idx_gt_default_categories_display_order ON tools_gt_default_categories(display_order);

-- ============================================================================
-- CATEGORIES (user-created headers: Home, Finance, Health, Career, Personal, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_gt_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  card_color TEXT NOT NULL DEFAULT '#10b981',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gt_categories_user_id ON tools_gt_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_gt_categories_tool_id ON tools_gt_categories(tool_id);
CREATE INDEX IF NOT EXISTS idx_gt_categories_user_tool ON tools_gt_categories(user_id, tool_id);

-- ============================================================================
-- GOALS (one per goal; belongs to a category)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_gt_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES tools_gt_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  target_date DATE,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  status TEXT NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'In Progress', 'Delayed', 'Completed')),
  percent_complete INTEGER NOT NULL DEFAULT 0 CHECK (percent_complete >= 0 AND percent_complete <= 100),
  show_on_dashboard BOOLEAN NOT NULL DEFAULT false,
  reminder_days INTEGER CHECK (reminder_days IS NULL OR reminder_days >= 1),
  last_update_date DATE,
  use_task_progress_for_percent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gt_goals_user_id ON tools_gt_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_gt_goals_tool_id ON tools_gt_goals(tool_id);
CREATE INDEX IF NOT EXISTS idx_gt_goals_user_tool ON tools_gt_goals(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_gt_goals_category_id ON tools_gt_goals(category_id);
CREATE INDEX IF NOT EXISTS idx_gt_goals_show_on_dashboard ON tools_gt_goals(show_on_dashboard) WHERE show_on_dashboard = true;

-- ============================================================================
-- PHASES (optional groupings of tasks within a goal)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_gt_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES tools_gt_goals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gt_phases_goal_id ON tools_gt_phases(goal_id);

-- ============================================================================
-- TASKS (optional checklist items; belong to a phase and goal)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_gt_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES tools_gt_phases(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES tools_gt_goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gt_tasks_phase_id ON tools_gt_tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_gt_tasks_goal_id ON tools_gt_tasks(goal_id);

-- ============================================================================
-- UPDATE NOTES (progress notes per goal; used for "recent updates" and reminder logic)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_gt_update_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES tools_gt_goals(id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gt_update_notes_goal_id ON tools_gt_update_notes(goal_id);
CREATE INDEX IF NOT EXISTS idx_gt_update_notes_note_date ON tools_gt_update_notes(goal_id, note_date DESC);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_gt_default_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_gt_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_gt_goals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_gt_phases_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_gt_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_gt_update_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_gt_default_categories_updated_at ON tools_gt_default_categories;
CREATE TRIGGER trigger_update_gt_default_categories_updated_at
  BEFORE UPDATE ON tools_gt_default_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_gt_default_categories_updated_at();

DROP TRIGGER IF EXISTS trigger_update_gt_categories_updated_at ON tools_gt_categories;
CREATE TRIGGER trigger_update_gt_categories_updated_at
  BEFORE UPDATE ON tools_gt_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_gt_categories_updated_at();

DROP TRIGGER IF EXISTS trigger_update_gt_goals_updated_at ON tools_gt_goals;
CREATE TRIGGER trigger_update_gt_goals_updated_at
  BEFORE UPDATE ON tools_gt_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_gt_goals_updated_at();

DROP TRIGGER IF EXISTS trigger_update_gt_phases_updated_at ON tools_gt_phases;
CREATE TRIGGER trigger_update_gt_phases_updated_at
  BEFORE UPDATE ON tools_gt_phases
  FOR EACH ROW
  EXECUTE FUNCTION update_gt_phases_updated_at();

DROP TRIGGER IF EXISTS trigger_update_gt_tasks_updated_at ON tools_gt_tasks;
CREATE TRIGGER trigger_update_gt_tasks_updated_at
  BEFORE UPDATE ON tools_gt_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_gt_tasks_updated_at();

DROP TRIGGER IF EXISTS trigger_update_gt_update_notes_updated_at ON tools_gt_update_notes;
CREATE TRIGGER trigger_update_gt_update_notes_updated_at
  BEFORE UPDATE ON tools_gt_update_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_gt_update_notes_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE tools_gt_default_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_gt_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_gt_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_gt_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_gt_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_gt_update_notes ENABLE ROW LEVEL SECURITY;

-- Default categories (read-only; used to seed user categories)
DROP POLICY IF EXISTS "Anyone can view default categories" ON tools_gt_default_categories;
CREATE POLICY "Anyone can view default categories" ON tools_gt_default_categories
  FOR SELECT TO authenticated USING (true);

-- Categories
DROP POLICY IF EXISTS "Users can view their own categories" ON tools_gt_categories;
CREATE POLICY "Users can view their own categories" ON tools_gt_categories
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own categories" ON tools_gt_categories;
CREATE POLICY "Users can insert their own categories" ON tools_gt_categories
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own categories" ON tools_gt_categories;
CREATE POLICY "Users can update their own categories" ON tools_gt_categories
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own categories" ON tools_gt_categories;
CREATE POLICY "Users can delete their own categories" ON tools_gt_categories
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Goals
DROP POLICY IF EXISTS "Users can view their own goals" ON tools_gt_goals;
CREATE POLICY "Users can view their own goals" ON tools_gt_goals
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own goals" ON tools_gt_goals;
CREATE POLICY "Users can insert their own goals" ON tools_gt_goals
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    EXISTS (
      SELECT 1 FROM tools_gt_categories c
      WHERE c.id = category_id AND c.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own goals" ON tools_gt_goals;
CREATE POLICY "Users can update their own goals" ON tools_gt_goals
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id AND
    EXISTS (
      SELECT 1 FROM tools_gt_categories c
      WHERE c.id = category_id AND c.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own goals" ON tools_gt_goals;
CREATE POLICY "Users can delete their own goals" ON tools_gt_goals
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Phases (access via goal ownership)
DROP POLICY IF EXISTS "Users can view their own phases" ON tools_gt_phases;
CREATE POLICY "Users can view their own phases" ON tools_gt_phases
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_gt_goals g WHERE g.id = goal_id AND g.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can insert their own phases" ON tools_gt_phases;
CREATE POLICY "Users can insert their own phases" ON tools_gt_phases
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tools_gt_goals g WHERE g.id = goal_id AND g.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can update their own phases" ON tools_gt_phases;
CREATE POLICY "Users can update their own phases" ON tools_gt_phases
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_gt_goals g WHERE g.id = goal_id AND g.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM tools_gt_goals g WHERE g.id = goal_id AND g.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own phases" ON tools_gt_phases;
CREATE POLICY "Users can delete their own phases" ON tools_gt_phases
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_gt_goals g WHERE g.id = goal_id AND g.user_id = (select auth.uid())));

-- Tasks (access via goal ownership)
DROP POLICY IF EXISTS "Users can view their own tasks" ON tools_gt_tasks;
CREATE POLICY "Users can view their own tasks" ON tools_gt_tasks
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_gt_goals g WHERE g.id = goal_id AND g.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can insert their own tasks" ON tools_gt_tasks;
CREATE POLICY "Users can insert their own tasks" ON tools_gt_tasks
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tools_gt_goals g WHERE g.id = goal_id AND g.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can update their own tasks" ON tools_gt_tasks;
CREATE POLICY "Users can update their own tasks" ON tools_gt_tasks
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_gt_goals g WHERE g.id = goal_id AND g.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM tools_gt_goals g WHERE g.id = goal_id AND g.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own tasks" ON tools_gt_tasks;
CREATE POLICY "Users can delete their own tasks" ON tools_gt_tasks
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_gt_goals g WHERE g.id = goal_id AND g.user_id = (select auth.uid())));

-- Update notes (access via goal ownership)
DROP POLICY IF EXISTS "Users can view their own update notes" ON tools_gt_update_notes;
CREATE POLICY "Users can view their own update notes" ON tools_gt_update_notes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_gt_goals g WHERE g.id = goal_id AND g.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can insert their own update notes" ON tools_gt_update_notes;
CREATE POLICY "Users can insert their own update notes" ON tools_gt_update_notes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tools_gt_goals g WHERE g.id = goal_id AND g.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can update their own update notes" ON tools_gt_update_notes;
CREATE POLICY "Users can update their own update notes" ON tools_gt_update_notes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_gt_goals g WHERE g.id = goal_id AND g.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM tools_gt_goals g WHERE g.id = goal_id AND g.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own update notes" ON tools_gt_update_notes;
CREATE POLICY "Users can delete their own update notes" ON tools_gt_update_notes
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_gt_goals g WHERE g.id = goal_id AND g.user_id = (select auth.uid())));

-- ============================================================================
-- SEED DEFAULT CATEGORIES (Home, Finance, Health, Career, Personal)
-- ============================================================================
INSERT INTO tools_gt_default_categories (name, card_color, display_order) VALUES
  ('Home', '#10b981', 0),
  ('Finance', '#3b82f6', 1),
  ('Health', '#8b5cf6', 2),
  ('Career', '#f59e0b', 3),
  ('Personal', '#ec4899', 4)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- END FILE: create-tools-gt-tables.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-tools-mp-tables.sql
-- ============================================================================

-- Meal Planner Tool Database Schema
-- All tables prefixed with 'tools_mp_'
-- Supports: items (by category), meal types, meals (with ingredients), meal plans (Mon–Sun assignments).
-- RLS uses (select auth.uid()) for user isolation.
-- Design system: Database Standards (foreign key indexes, optimized RLS, function search_path).

-- ============================================================================
-- ITEMS (user's master list; same concept as Shopping List items)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_mp_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_items_user_id ON tools_mp_items(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_items_tool_id ON tools_mp_items(tool_id);
CREATE INDEX IF NOT EXISTS idx_mp_items_user_tool ON tools_mp_items(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_mp_items_category ON tools_mp_items(category);

-- ============================================================================
-- MEAL TYPES (Breakfast, Lunch, Dinner, High-Protein, Vegetarian, Kid-Friendly, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_mp_meal_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_meal_types_user_id ON tools_mp_meal_types(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_meal_types_tool_id ON tools_mp_meal_types(tool_id);
CREATE INDEX IF NOT EXISTS idx_mp_meal_types_user_tool ON tools_mp_meal_types(user_id, tool_id);

-- ============================================================================
-- MEALS (name, type, description, instructions, prep time, difficulty, rating)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_mp_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  meal_type_id UUID REFERENCES tools_mp_meal_types(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  prep_time_minutes INTEGER CHECK (prep_time_minutes IS NULL OR prep_time_minutes >= 0),
  difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard')),
  rating INTEGER NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_meals_user_id ON tools_mp_meals(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_meals_tool_id ON tools_mp_meals(tool_id);
CREATE INDEX IF NOT EXISTS idx_mp_meals_user_tool ON tools_mp_meals(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_mp_meals_meal_type_id ON tools_mp_meals(meal_type_id) WHERE meal_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mp_meals_is_active ON tools_mp_meals(is_active);

-- ============================================================================
-- MEAL INGREDIENTS (junction: which items are ingredients for each meal)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_mp_meal_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES tools_mp_meals(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES tools_mp_items(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_meal_ingredients_meal_id ON tools_mp_meal_ingredients(meal_id);
CREATE INDEX IF NOT EXISTS idx_mp_meal_ingredients_item_id ON tools_mp_meal_ingredients(item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_meal_ingredients_meal_item ON tools_mp_meal_ingredients(meal_id, item_id);

-- ============================================================================
-- PLANS (weekly meal plan: name, start Monday, active vs history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_mp_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_plans_user_id ON tools_mp_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_plans_tool_id ON tools_mp_plans(tool_id);
CREATE INDEX IF NOT EXISTS idx_mp_plans_user_tool ON tools_mp_plans(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_mp_plans_is_active ON tools_mp_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_mp_plans_start_date ON tools_mp_plans(start_date);

-- ============================================================================
-- PLAN ASSIGNMENTS (which meals are assigned to which day: mon–sun)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_mp_plan_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES tools_mp_plans(id) ON DELETE CASCADE,
  day_key TEXT NOT NULL CHECK (day_key IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  meal_id UUID NOT NULL REFERENCES tools_mp_meals(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_plan_assignments_plan_id ON tools_mp_plan_assignments(plan_id);
CREATE INDEX IF NOT EXISTS idx_mp_plan_assignments_meal_id ON tools_mp_plan_assignments(meal_id);
CREATE INDEX IF NOT EXISTS idx_mp_plan_assignments_plan_day ON tools_mp_plan_assignments(plan_id, day_key);

-- ============================================================================
-- UPDATED_AT TRIGGERS (with search_path for security)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_mp_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_mp_meal_types_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_mp_meals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_mp_plans_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_mp_items_updated_at ON tools_mp_items;
CREATE TRIGGER trigger_update_mp_items_updated_at
  BEFORE UPDATE ON tools_mp_items
  FOR EACH ROW
  EXECUTE FUNCTION update_mp_items_updated_at();

DROP TRIGGER IF EXISTS trigger_update_mp_meal_types_updated_at ON tools_mp_meal_types;
CREATE TRIGGER trigger_update_mp_meal_types_updated_at
  BEFORE UPDATE ON tools_mp_meal_types
  FOR EACH ROW
  EXECUTE FUNCTION update_mp_meal_types_updated_at();

DROP TRIGGER IF EXISTS trigger_update_mp_meals_updated_at ON tools_mp_meals;
CREATE TRIGGER trigger_update_mp_meals_updated_at
  BEFORE UPDATE ON tools_mp_meals
  FOR EACH ROW
  EXECUTE FUNCTION update_mp_meals_updated_at();

DROP TRIGGER IF EXISTS trigger_update_mp_plans_updated_at ON tools_mp_plans;
CREATE TRIGGER trigger_update_mp_plans_updated_at
  BEFORE UPDATE ON tools_mp_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_mp_plans_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE tools_mp_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_mp_meal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_mp_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_mp_meal_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_mp_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_mp_plan_assignments ENABLE ROW LEVEL SECURITY;

-- Items: user CRUD on own rows
DROP POLICY IF EXISTS "Users can view their own mp items" ON tools_mp_items;
CREATE POLICY "Users can view their own mp items" ON tools_mp_items
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert their own mp items" ON tools_mp_items;
CREATE POLICY "Users can insert their own mp items" ON tools_mp_items
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update their own mp items" ON tools_mp_items;
CREATE POLICY "Users can update their own mp items" ON tools_mp_items
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete their own mp items" ON tools_mp_items;
CREATE POLICY "Users can delete their own mp items" ON tools_mp_items
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Meal types: user CRUD on own rows
DROP POLICY IF EXISTS "Users can view their own mp meal types" ON tools_mp_meal_types;
CREATE POLICY "Users can view their own mp meal types" ON tools_mp_meal_types
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert their own mp meal types" ON tools_mp_meal_types;
CREATE POLICY "Users can insert their own mp meal types" ON tools_mp_meal_types
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update their own mp meal types" ON tools_mp_meal_types;
CREATE POLICY "Users can update their own mp meal types" ON tools_mp_meal_types
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete their own mp meal types" ON tools_mp_meal_types;
CREATE POLICY "Users can delete their own mp meal types" ON tools_mp_meal_types
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Meals: user CRUD on own rows
DROP POLICY IF EXISTS "Users can view their own mp meals" ON tools_mp_meals;
CREATE POLICY "Users can view their own mp meals" ON tools_mp_meals
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert their own mp meals" ON tools_mp_meals;
CREATE POLICY "Users can insert their own mp meals" ON tools_mp_meals
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update their own mp meals" ON tools_mp_meals;
CREATE POLICY "Users can update their own mp meals" ON tools_mp_meals
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete their own mp meals" ON tools_mp_meals;
CREATE POLICY "Users can delete their own mp meals" ON tools_mp_meals
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Meal ingredients: access via meal ownership
DROP POLICY IF EXISTS "Users can view their own mp meal ingredients" ON tools_mp_meal_ingredients;
CREATE POLICY "Users can view their own mp meal ingredients" ON tools_mp_meal_ingredients
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_mp_meals m WHERE m.id = meal_id AND m.user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users can insert their own mp meal ingredients" ON tools_mp_meal_ingredients;
CREATE POLICY "Users can insert their own mp meal ingredients" ON tools_mp_meal_ingredients
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tools_mp_meals m WHERE m.id = meal_id AND m.user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users can update their own mp meal ingredients" ON tools_mp_meal_ingredients;
CREATE POLICY "Users can update their own mp meal ingredients" ON tools_mp_meal_ingredients
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_mp_meals m WHERE m.id = meal_id AND m.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM tools_mp_meals m WHERE m.id = meal_id AND m.user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users can delete their own mp meal ingredients" ON tools_mp_meal_ingredients;
CREATE POLICY "Users can delete their own mp meal ingredients" ON tools_mp_meal_ingredients
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_mp_meals m WHERE m.id = meal_id AND m.user_id = (select auth.uid())));

-- Plans: user CRUD on own rows
DROP POLICY IF EXISTS "Users can view their own mp plans" ON tools_mp_plans;
CREATE POLICY "Users can view their own mp plans" ON tools_mp_plans
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert their own mp plans" ON tools_mp_plans;
CREATE POLICY "Users can insert their own mp plans" ON tools_mp_plans
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update their own mp plans" ON tools_mp_plans;
CREATE POLICY "Users can update their own mp plans" ON tools_mp_plans
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete their own mp plans" ON tools_mp_plans;
CREATE POLICY "Users can delete their own mp plans" ON tools_mp_plans
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Plan assignments: access via plan ownership
DROP POLICY IF EXISTS "Users can view their own mp plan assignments" ON tools_mp_plan_assignments;
CREATE POLICY "Users can view their own mp plan assignments" ON tools_mp_plan_assignments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_mp_plans p WHERE p.id = plan_id AND p.user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users can insert their own mp plan assignments" ON tools_mp_plan_assignments;
CREATE POLICY "Users can insert their own mp plan assignments" ON tools_mp_plan_assignments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tools_mp_plans p WHERE p.id = plan_id AND p.user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users can update their own mp plan assignments" ON tools_mp_plan_assignments;
CREATE POLICY "Users can update their own mp plan assignments" ON tools_mp_plan_assignments
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_mp_plans p WHERE p.id = plan_id AND p.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM tools_mp_plans p WHERE p.id = plan_id AND p.user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users can delete their own mp plan assignments" ON tools_mp_plan_assignments;
CREATE POLICY "Users can delete their own mp plan assignments" ON tools_mp_plan_assignments
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_mp_plans p WHERE p.id = plan_id AND p.user_id = (select auth.uid())));

-- ============================================================================
-- END FILE: create-tools-mp-tables.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-notes-tables.sql
-- ============================================================================

-- Notes Tool Database Schema
-- All tables prefixed with 'tools_note_'

-- Main notes table - multiple notes per user allowed
CREATE TABLE IF NOT EXISTS tools_note_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  note_name TEXT NOT NULL,
  created_date DATE NOT NULL,
  note TEXT NOT NULL, -- Primary content field (required)
  requires_password_for_view BOOLEAN DEFAULT false,
  view_password_hash TEXT, -- Hashed password using bcrypt or similar
  is_active BOOLEAN DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE, -- When note was inactivated
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tags table - user-defined tags for categorizing notes
CREATE TABLE IF NOT EXISTS tools_note_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE, -- When tag was inactivated
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure unique tag names per user per tool
  UNIQUE(user_id, tool_id, name)
);

-- Junction table for many-to-many relationship between notes and tags
CREATE TABLE IF NOT EXISTS tools_note_note_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES tools_note_notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tools_note_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure a note can't have the same tag twice
  UNIQUE(note_id, tag_id)
);

-- Security questions table - stores security questions and answers for password recovery
CREATE TABLE IF NOT EXISTS tools_note_security_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES tools_note_notes(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL, -- References the question ID from the fixed list (q1, q2, etc.)
  answer_hash TEXT NOT NULL, -- Hashed answer using bcrypt or similar
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure a note can't have duplicate questions
  UNIQUE(note_id, question_id)
);

-- Create indexes for faster lookups
-- Notes table indexes
CREATE INDEX IF NOT EXISTS idx_note_notes_user_tool ON tools_note_notes(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_note_notes_is_active ON tools_note_notes(is_active);
CREATE INDEX IF NOT EXISTS idx_note_notes_created_date ON tools_note_notes(created_date);
CREATE INDEX IF NOT EXISTS idx_note_notes_requires_password ON tools_note_notes(requires_password_for_view) WHERE requires_password_for_view = true;
CREATE INDEX IF NOT EXISTS idx_note_notes_note_name ON tools_note_notes(note_name); -- For search functionality

-- Tags table indexes
CREATE INDEX IF NOT EXISTS idx_note_tags_user_tool ON tools_note_tags(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_is_active ON tools_note_tags(is_active);
CREATE INDEX IF NOT EXISTS idx_note_tags_name ON tools_note_tags(name);

-- Note tags junction table indexes
CREATE INDEX IF NOT EXISTS idx_note_note_tags_note_id ON tools_note_note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_note_tags_tag_id ON tools_note_note_tags(tag_id);

-- Security questions table indexes
CREATE INDEX IF NOT EXISTS idx_note_security_questions_note_id ON tools_note_security_questions(note_id);

-- Functions to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_note_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_note_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_note_security_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_note_notes_updated_at ON tools_note_notes;
CREATE TRIGGER trigger_update_note_notes_updated_at
  BEFORE UPDATE ON tools_note_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_note_notes_updated_at();

DROP TRIGGER IF EXISTS trigger_update_note_tags_updated_at ON tools_note_tags;
CREATE TRIGGER trigger_update_note_tags_updated_at
  BEFORE UPDATE ON tools_note_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_note_tags_updated_at();

DROP TRIGGER IF EXISTS trigger_update_note_security_questions_updated_at ON tools_note_security_questions;
CREATE TRIGGER trigger_update_note_security_questions_updated_at
  BEFORE UPDATE ON tools_note_security_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_note_security_questions_updated_at();

-- Enable Row Level Security
ALTER TABLE tools_note_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_note_note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_note_security_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
-- Drop existing policies if they exist, then create them

-- ============================================================================
-- Notes table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own notes" ON tools_note_notes;
CREATE POLICY "Users can view their own notes" ON tools_note_notes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own notes" ON tools_note_notes;
CREATE POLICY "Users can insert their own notes" ON tools_note_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notes" ON tools_note_notes;
CREATE POLICY "Users can update their own notes" ON tools_note_notes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes" ON tools_note_notes;
CREATE POLICY "Users can delete their own notes" ON tools_note_notes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- Tags table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own tags" ON tools_note_tags;
CREATE POLICY "Users can view their own tags" ON tools_note_tags
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own tags" ON tools_note_tags;
CREATE POLICY "Users can insert their own tags" ON tools_note_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own tags" ON tools_note_tags;
CREATE POLICY "Users can update their own tags" ON tools_note_tags
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own tags" ON tools_note_tags;
CREATE POLICY "Users can delete their own tags" ON tools_note_tags
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- Note tags junction table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can view their own note tags" ON tools_note_note_tags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can insert their own note tags" ON tools_note_note_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM tools_note_tags
      WHERE tools_note_tags.id = tools_note_note_tags.tag_id
      AND tools_note_tags.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can update their own note tags" ON tools_note_note_tags
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM tools_note_tags
      WHERE tools_note_tags.id = tools_note_note_tags.tag_id
      AND tools_note_tags.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can delete their own note tags" ON tools_note_note_tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Security questions table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can view their own security questions" ON tools_note_security_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can insert their own security questions" ON tools_note_security_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can update their own security questions" ON tools_note_security_questions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can delete their own security questions" ON tools_note_security_questions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = auth.uid()
    )
  );

-- ============================================================================
-- END FILE: create-notes-tables.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-important-documents-tables.sql
-- ============================================================================

-- Important Documents Tool Database Schema
-- All tables prefixed with 'tools_id_'

-- Main documents table - multiple documents per user allowed
CREATE TABLE IF NOT EXISTS tools_id_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  uploaded_date DATE NOT NULL,
  effective_date DATE,
  note TEXT,
  file_url TEXT, -- URL or path to stored file (e.g., Supabase Storage)
  file_name TEXT, -- Original filename
  file_size BIGINT CHECK (file_size IS NULL OR file_size <= 10485760), -- File size in bytes (10MB = 10 * 1024 * 1024)
  file_type TEXT, -- MIME type (e.g., 'application/pdf', 'image/jpeg')
  requires_password_for_download BOOLEAN DEFAULT false,
  download_password_hash TEXT, -- Hashed password using bcrypt or similar
  is_active BOOLEAN DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE, -- When document was inactivated
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tags table - user-defined tags for categorizing documents
CREATE TABLE IF NOT EXISTS tools_id_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE, -- When tag was inactivated
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure unique tag names per user per tool
  UNIQUE(user_id, tool_id, name)
);

-- Junction table for many-to-many relationship between documents and tags
CREATE TABLE IF NOT EXISTS tools_id_document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES tools_id_documents(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tools_id_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure a document can't have the same tag twice
  UNIQUE(document_id, tag_id)
);

-- Security questions table - stores security questions and answers for password recovery
CREATE TABLE IF NOT EXISTS tools_id_security_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES tools_id_documents(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL, -- References the question ID from the fixed list (q1, q2, etc.)
  answer_hash TEXT NOT NULL, -- Hashed answer using bcrypt or similar
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure a document can't have duplicate questions
  UNIQUE(document_id, question_id)
);

-- Create indexes for faster lookups
-- Documents table indexes
CREATE INDEX IF NOT EXISTS idx_id_documents_user_tool ON tools_id_documents(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_id_documents_is_active ON tools_id_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_id_documents_uploaded_date ON tools_id_documents(uploaded_date);
CREATE INDEX IF NOT EXISTS idx_id_documents_effective_date ON tools_id_documents(effective_date) WHERE effective_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_id_documents_requires_password ON tools_id_documents(requires_password_for_download) WHERE requires_password_for_download = true;

-- Tags table indexes
CREATE INDEX IF NOT EXISTS idx_id_tags_user_tool ON tools_id_tags(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_id_tags_is_active ON tools_id_tags(is_active);
CREATE INDEX IF NOT EXISTS idx_id_tags_name ON tools_id_tags(name);

-- Document tags junction table indexes
CREATE INDEX IF NOT EXISTS idx_id_document_tags_document_id ON tools_id_document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_id_document_tags_tag_id ON tools_id_document_tags(tag_id);

-- Security questions table indexes
CREATE INDEX IF NOT EXISTS idx_id_security_questions_document_id ON tools_id_security_questions(document_id);

-- Functions to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_id_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_id_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_id_security_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_id_documents_updated_at ON tools_id_documents;
CREATE TRIGGER trigger_update_id_documents_updated_at
  BEFORE UPDATE ON tools_id_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_id_documents_updated_at();

DROP TRIGGER IF EXISTS trigger_update_id_tags_updated_at ON tools_id_tags;
CREATE TRIGGER trigger_update_id_tags_updated_at
  BEFORE UPDATE ON tools_id_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_id_tags_updated_at();

DROP TRIGGER IF EXISTS trigger_update_id_security_questions_updated_at ON tools_id_security_questions;
CREATE TRIGGER trigger_update_id_security_questions_updated_at
  BEFORE UPDATE ON tools_id_security_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_id_security_questions_updated_at();

-- Enable Row Level Security
ALTER TABLE tools_id_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_id_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_id_document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_id_security_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
-- Drop existing policies if they exist, then create them

-- ============================================================================
-- Documents table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own documents" ON tools_id_documents;
CREATE POLICY "Users can view their own documents" ON tools_id_documents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own documents" ON tools_id_documents;
CREATE POLICY "Users can insert their own documents" ON tools_id_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own documents" ON tools_id_documents;
CREATE POLICY "Users can update their own documents" ON tools_id_documents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON tools_id_documents;
CREATE POLICY "Users can delete their own documents" ON tools_id_documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- Tags table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own tags" ON tools_id_tags;
CREATE POLICY "Users can view their own tags" ON tools_id_tags
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own tags" ON tools_id_tags;
CREATE POLICY "Users can insert their own tags" ON tools_id_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own tags" ON tools_id_tags;
CREATE POLICY "Users can update their own tags" ON tools_id_tags
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own tags" ON tools_id_tags;
CREATE POLICY "Users can delete their own tags" ON tools_id_tags
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- Document tags junction table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can view their own document tags" ON tools_id_document_tags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can insert their own document tags" ON tools_id_document_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM tools_id_tags
      WHERE tools_id_tags.id = tools_id_document_tags.tag_id
      AND tools_id_tags.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can update their own document tags" ON tools_id_document_tags
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM tools_id_tags
      WHERE tools_id_tags.id = tools_id_document_tags.tag_id
      AND tools_id_tags.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can delete their own document tags" ON tools_id_document_tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Security questions table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can view their own security questions" ON tools_id_security_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can insert their own security questions" ON tools_id_security_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can update their own security questions" ON tools_id_security_questions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can delete their own security questions" ON tools_id_security_questions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  );

-- ============================================================================
-- END FILE: create-important-documents-tables.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-calendar-events-tables.sql
-- ============================================================================

-- Calendar Events Tool Database Schema
-- All tables prefixed with 'tools_ce_'

-- Categories table - stores calendar event categories (Holiday, Birthday, Anniversary, and user-created)
CREATE TABLE IF NOT EXISTS tools_ce_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false, -- true for Holiday, Birthday, Anniversary
  card_color TEXT, -- Hex color code for category card (e.g., '#ef4444')
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique category names per user per tool
  CONSTRAINT unique_category_name_per_user UNIQUE(user_id, tool_id, name)
);

-- Calendar Events table - stores individual calendar events
CREATE TABLE IF NOT EXISTS tools_ce_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES tools_ce_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL, -- Start date of the event
  frequency TEXT NOT NULL CHECK (frequency IN ('One Time', 'Weekly', 'Monthly', 'Annual')),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  add_to_dashboard BOOLEAN DEFAULT true, -- Whether to show on Dashboard Calendar view
  end_date DATE, -- Optional end date for recurring events
  days_of_week JSONB, -- Array of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday) for Weekly frequency
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31), -- For Monthly frequency
  date_inactivated DATE, -- When event was moved to history
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_ce_categories_user_tool ON tools_ce_categories(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_ce_categories_is_default ON tools_ce_categories(is_default);

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_ce_events_user_tool ON tools_ce_events(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_ce_events_category ON tools_ce_events(category_id);
CREATE INDEX IF NOT EXISTS idx_ce_events_is_active ON tools_ce_events(is_active);
CREATE INDEX IF NOT EXISTS idx_ce_events_date ON tools_ce_events(date);
CREATE INDEX IF NOT EXISTS idx_ce_events_frequency ON tools_ce_events(frequency);
CREATE INDEX IF NOT EXISTS idx_ce_events_add_to_dashboard ON tools_ce_events(add_to_dashboard) WHERE add_to_dashboard = true;
CREATE INDEX IF NOT EXISTS idx_ce_events_date_inactivated ON tools_ce_events(date_inactivated) WHERE date_inactivated IS NOT NULL;

-- GIN index for days_of_week JSONB queries (useful for filtering by specific days)
CREATE INDEX IF NOT EXISTS idx_ce_events_days_of_week ON tools_ce_events USING GIN (days_of_week) WHERE days_of_week IS NOT NULL;

-- Function to automatically update updated_at timestamp for categories
CREATE OR REPLACE FUNCTION update_ce_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically update updated_at timestamp for events
CREATE OR REPLACE FUNCTION update_ce_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_ce_categories_updated_at ON tools_ce_categories;
CREATE TRIGGER trigger_update_ce_categories_updated_at
  BEFORE UPDATE ON tools_ce_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_ce_categories_updated_at();

DROP TRIGGER IF EXISTS trigger_update_ce_events_updated_at ON tools_ce_events;
CREATE TRIGGER trigger_update_ce_events_updated_at
  BEFORE UPDATE ON tools_ce_events
  FOR EACH ROW
  EXECUTE FUNCTION update_ce_events_updated_at();

-- Enable Row Level Security
ALTER TABLE tools_ce_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_ce_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own calendar event data

-- ============================================================================
-- Categories RLS Policies
-- ============================================================================

-- SELECT policy
DROP POLICY IF EXISTS "Users can view their own categories" ON tools_ce_categories;
CREATE POLICY "Users can view their own categories" ON tools_ce_categories
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT policy
DROP POLICY IF EXISTS "Users can insert their own categories" ON tools_ce_categories;
CREATE POLICY "Users can insert their own categories" ON tools_ce_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update their own categories" ON tools_ce_categories;
CREATE POLICY "Users can update their own categories" ON tools_ce_categories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete their own categories" ON tools_ce_categories;
CREATE POLICY "Users can delete their own categories" ON tools_ce_categories
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- Events RLS Policies
-- ============================================================================

-- SELECT policy
DROP POLICY IF EXISTS "Users can view their own events" ON tools_ce_events;
CREATE POLICY "Users can view their own events" ON tools_ce_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT policy
DROP POLICY IF EXISTS "Users can insert their own events" ON tools_ce_events;
CREATE POLICY "Users can insert their own events" ON tools_ce_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update their own events" ON tools_ce_events;
CREATE POLICY "Users can update their own events" ON tools_ce_events
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete their own events" ON tools_ce_events;
CREATE POLICY "Users can delete their own events" ON tools_ce_events
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- END FILE: create-calendar-events-tables.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-pet-care-schedule-tables.sql
-- ============================================================================

-- Pet Care Schedule Tool Database Schema
-- All tables prefixed with 'tools_PCS_'

-- Main pets table - multiple pets per user allowed
CREATE TABLE IF NOT EXISTS tools_PCS_pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pet_type TEXT, -- Standard type (Dog, Cat, etc.)
  custom_pet_type TEXT, -- Custom type if user selected "Other"
  birthdate DATE,
  breed TEXT,
  where_got_pet TEXT,
  weight TEXT, -- Stored as text to allow "25 lbs" or "11 kg"
  color TEXT,
  microchip_number TEXT,
  card_color TEXT, -- Color for the pet card UI (hex color code)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  -- Multiple pets per user per tool are allowed
);

-- Create index on user_id and tool_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_pets_user_tool ON tools_PCS_pets(user_id, tool_id);

-- Food entries table
CREATE TABLE IF NOT EXISTS tools_PCS_food_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES tools_PCS_pets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 star rating
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on pet_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_food_pet_id ON tools_PCS_food_entries(pet_id);
CREATE INDEX IF NOT EXISTS idx_pcs_food_is_current ON tools_PCS_food_entries(is_current);

-- Veterinary records table
CREATE TABLE IF NOT EXISTS tools_PCS_veterinary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES tools_PCS_pets(id) ON DELETE CASCADE,
  veterinarian_name TEXT,
  clinic_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'History')),
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on pet_id and status for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_vet_pet_id ON tools_PCS_veterinary_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_pcs_vet_status ON tools_PCS_veterinary_records(status);

-- Care plan items table
CREATE TABLE IF NOT EXISTS tools_PCS_care_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES tools_PCS_pets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL, -- Daily, Weekly, Monthly, etc.
  is_active BOOLEAN DEFAULT true,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on pet_id and is_active for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_care_pet_id ON tools_PCS_care_plan_items(pet_id);
CREATE INDEX IF NOT EXISTS idx_pcs_care_is_active ON tools_PCS_care_plan_items(is_active);

-- Vaccinations table
CREATE TABLE IF NOT EXISTS tools_PCS_vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES tools_PCS_pets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  veterinarian TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on pet_id and date for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_vacc_pet_id ON tools_PCS_vaccinations(pet_id);
CREATE INDEX IF NOT EXISTS idx_pcs_vacc_date ON tools_PCS_vaccinations(date);

-- Appointments table
CREATE TABLE IF NOT EXISTS tools_PCS_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES tools_PCS_pets(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME,
  type TEXT NOT NULL, -- Annual checkup, Vaccination, Surgery, etc.
  veterinarian TEXT,
  notes TEXT,
  is_upcoming BOOLEAN DEFAULT true, -- Calculated based on date, but stored for performance
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on pet_id, date, and is_upcoming for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_appt_pet_id ON tools_PCS_appointments(pet_id);
CREATE INDEX IF NOT EXISTS idx_pcs_appt_date ON tools_PCS_appointments(date);
CREATE INDEX IF NOT EXISTS idx_pcs_appt_is_upcoming ON tools_PCS_appointments(is_upcoming);

-- Documents table
CREATE TABLE IF NOT EXISTS tools_PCS_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES tools_PCS_pets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  file_url TEXT, -- URL or path to stored file
  file_name TEXT, -- Original filename
  file_size BIGINT, -- File size in bytes
  file_type TEXT, -- MIME type
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on pet_id and date for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_doc_pet_id ON tools_PCS_documents(pet_id);
CREATE INDEX IF NOT EXISTS idx_pcs_doc_date ON tools_PCS_documents(date);

-- Notes table
CREATE TABLE IF NOT EXISTS tools_PCS_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES tools_PCS_pets(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on pet_id and is_current for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_notes_pet_id ON tools_PCS_notes(pet_id);
CREATE INDEX IF NOT EXISTS idx_pcs_notes_is_current ON tools_PCS_notes(is_current);
CREATE INDEX IF NOT EXISTS idx_pcs_notes_date ON tools_PCS_notes(date);

-- Functions to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pcs_pets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pcs_food_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pcs_vet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pcs_care_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pcs_vacc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pcs_appt_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pcs_doc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pcs_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
-- Drop existing triggers if they exist, then create them
DROP TRIGGER IF EXISTS trigger_update_pcs_pets_updated_at ON tools_PCS_pets;
CREATE TRIGGER trigger_update_pcs_pets_updated_at
  BEFORE UPDATE ON tools_PCS_pets
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_pets_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pcs_food_updated_at ON tools_PCS_food_entries;
CREATE TRIGGER trigger_update_pcs_food_updated_at
  BEFORE UPDATE ON tools_PCS_food_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_food_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pcs_vet_updated_at ON tools_PCS_veterinary_records;
CREATE TRIGGER trigger_update_pcs_vet_updated_at
  BEFORE UPDATE ON tools_PCS_veterinary_records
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_vet_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pcs_care_updated_at ON tools_PCS_care_plan_items;
CREATE TRIGGER trigger_update_pcs_care_updated_at
  BEFORE UPDATE ON tools_PCS_care_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_care_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pcs_vacc_updated_at ON tools_PCS_vaccinations;
CREATE TRIGGER trigger_update_pcs_vacc_updated_at
  BEFORE UPDATE ON tools_PCS_vaccinations
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_vacc_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pcs_appt_updated_at ON tools_PCS_appointments;
CREATE TRIGGER trigger_update_pcs_appt_updated_at
  BEFORE UPDATE ON tools_PCS_appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_appt_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pcs_doc_updated_at ON tools_PCS_documents;
CREATE TRIGGER trigger_update_pcs_doc_updated_at
  BEFORE UPDATE ON tools_PCS_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_doc_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pcs_notes_updated_at ON tools_PCS_notes;
CREATE TRIGGER trigger_update_pcs_notes_updated_at
  BEFORE UPDATE ON tools_PCS_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_notes_updated_at();

-- Enable Row Level Security on all tables
ALTER TABLE tools_PCS_pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_PCS_food_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_PCS_veterinary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_PCS_care_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_PCS_vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_PCS_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_PCS_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_PCS_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own pet data
-- Drop existing policies if they exist, then create them
-- Pets table
DROP POLICY IF EXISTS "Users can view their own pets" ON tools_PCS_pets;
CREATE POLICY "Users can view their own pets" ON tools_PCS_pets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own pets" ON tools_PCS_pets;
CREATE POLICY "Users can insert their own pets" ON tools_PCS_pets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own pets" ON tools_PCS_pets;
CREATE POLICY "Users can update their own pets" ON tools_PCS_pets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own pets" ON tools_PCS_pets;
CREATE POLICY "Users can delete their own pets" ON tools_PCS_pets
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Food entries table
DROP POLICY IF EXISTS "Users can view their own food entries" ON tools_PCS_food_entries;
CREATE POLICY "Users can view their own food entries" ON tools_PCS_food_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_food_entries.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own food entries" ON tools_PCS_food_entries;
CREATE POLICY "Users can insert their own food entries" ON tools_PCS_food_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_food_entries.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own food entries" ON tools_PCS_food_entries;
CREATE POLICY "Users can update their own food entries" ON tools_PCS_food_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_food_entries.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_food_entries.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own food entries" ON tools_PCS_food_entries;
CREATE POLICY "Users can delete their own food entries" ON tools_PCS_food_entries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_food_entries.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

-- Veterinary records table
DROP POLICY IF EXISTS "Users can view their own veterinary records" ON tools_PCS_veterinary_records;
CREATE POLICY "Users can view their own veterinary records" ON tools_PCS_veterinary_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_veterinary_records.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own veterinary records" ON tools_PCS_veterinary_records;
CREATE POLICY "Users can insert their own veterinary records" ON tools_PCS_veterinary_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_veterinary_records.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own veterinary records" ON tools_PCS_veterinary_records;
CREATE POLICY "Users can update their own veterinary records" ON tools_PCS_veterinary_records
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_veterinary_records.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_veterinary_records.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own veterinary records" ON tools_PCS_veterinary_records;
CREATE POLICY "Users can delete their own veterinary records" ON tools_PCS_veterinary_records
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_veterinary_records.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

-- Care plan items table
DROP POLICY IF EXISTS "Users can view their own care plan items" ON tools_PCS_care_plan_items;
CREATE POLICY "Users can view their own care plan items" ON tools_PCS_care_plan_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_care_plan_items.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own care plan items" ON tools_PCS_care_plan_items;
CREATE POLICY "Users can insert their own care plan items" ON tools_PCS_care_plan_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_care_plan_items.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own care plan items" ON tools_PCS_care_plan_items;
CREATE POLICY "Users can update their own care plan items" ON tools_PCS_care_plan_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_care_plan_items.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_care_plan_items.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own care plan items" ON tools_PCS_care_plan_items;
CREATE POLICY "Users can delete their own care plan items" ON tools_PCS_care_plan_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_care_plan_items.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

-- Vaccinations table
DROP POLICY IF EXISTS "Users can view their own vaccinations" ON tools_PCS_vaccinations;
CREATE POLICY "Users can view their own vaccinations" ON tools_PCS_vaccinations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_vaccinations.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own vaccinations" ON tools_PCS_vaccinations;
CREATE POLICY "Users can insert their own vaccinations" ON tools_PCS_vaccinations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_vaccinations.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own vaccinations" ON tools_PCS_vaccinations;
CREATE POLICY "Users can update their own vaccinations" ON tools_PCS_vaccinations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_vaccinations.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_vaccinations.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own vaccinations" ON tools_PCS_vaccinations;
CREATE POLICY "Users can delete their own vaccinations" ON tools_PCS_vaccinations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_vaccinations.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

-- Appointments table
DROP POLICY IF EXISTS "Users can view their own appointments" ON tools_PCS_appointments;
CREATE POLICY "Users can view their own appointments" ON tools_PCS_appointments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_appointments.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own appointments" ON tools_PCS_appointments;
CREATE POLICY "Users can insert their own appointments" ON tools_PCS_appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_appointments.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own appointments" ON tools_PCS_appointments;
CREATE POLICY "Users can update their own appointments" ON tools_PCS_appointments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_appointments.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_appointments.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own appointments" ON tools_PCS_appointments;
CREATE POLICY "Users can delete their own appointments" ON tools_PCS_appointments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_appointments.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

-- Documents table
DROP POLICY IF EXISTS "Users can view their own documents" ON tools_PCS_documents;
CREATE POLICY "Users can view their own documents" ON tools_PCS_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_documents.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own documents" ON tools_PCS_documents;
CREATE POLICY "Users can insert their own documents" ON tools_PCS_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_documents.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own documents" ON tools_PCS_documents;
CREATE POLICY "Users can update their own documents" ON tools_PCS_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_documents.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_documents.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own documents" ON tools_PCS_documents;
CREATE POLICY "Users can delete their own documents" ON tools_PCS_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_documents.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

-- Notes table
DROP POLICY IF EXISTS "Users can view their own notes" ON tools_PCS_notes;
CREATE POLICY "Users can view their own notes" ON tools_PCS_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_notes.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own notes" ON tools_PCS_notes;
CREATE POLICY "Users can insert their own notes" ON tools_PCS_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_notes.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own notes" ON tools_PCS_notes;
CREATE POLICY "Users can update their own notes" ON tools_PCS_notes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_notes.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_notes.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own notes" ON tools_PCS_notes;
CREATE POLICY "Users can delete their own notes" ON tools_PCS_notes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_notes.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

-- ============================================================================
-- END FILE: create-pet-care-schedule-tables.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-repair-history-tables.sql
-- ============================================================================

-- Repair History Tool Database Schema
-- All tables prefixed with 'tools_rh_'

-- Headers/Categories table - multiple categories per user allowed (Home, Auto1, Auto2, etc.)
CREATE TABLE IF NOT EXISTS tools_rh_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  card_color TEXT DEFAULT '#10b981', -- Color for the category card UI (hex color code)
  category_type TEXT NOT NULL CHECK (category_type IN ('Home', 'Auto')), -- Home or Auto category
  is_default BOOLEAN DEFAULT false, -- True for default categories (Home, Auto1, Auto2)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id and tool_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_rh_headers_user_tool ON tools_rh_headers(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_rh_headers_category_type ON tools_rh_headers(category_type);

-- History records table - repair/replacement records
CREATE TABLE IF NOT EXISTS tools_rh_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  header_id UUID NOT NULL REFERENCES tools_rh_headers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  item_name TEXT NOT NULL, -- Name of the repaired/replaced item
  type TEXT NOT NULL CHECK (type IN ('repair', 'replace')),
  description TEXT,
  cost TEXT, -- Stored as text to allow various formats (e.g., "$150", "150.00", "Free")
  service_provider TEXT,
  
  -- Receipt and Warranty files
  receipt_file_url TEXT, -- URL or path to stored receipt file
  receipt_file_name TEXT, -- Original filename
  warranty_file_url TEXT, -- URL or path to stored warranty file
  warranty_file_name TEXT, -- Original filename
  warranty_end_date DATE, -- Warranty expiration date
  warranty_dashboard_item_id UUID REFERENCES dashboard_items(id) ON DELETE SET NULL, -- Link to dashboard calendar event for warranty expiration
  
  -- Insurance information
  submitted_to_insurance BOOLEAN DEFAULT false,
  insurance_carrier TEXT,
  claim_number TEXT,
  amount_insurance_paid TEXT, -- Stored as text to allow various formats
  agent_contact_info TEXT,
  claim_notes TEXT,
  
  -- Auto-specific fields
  odometer_reading TEXT, -- Odometer reading at time of repair (for Auto categories)
  
  -- Manual link (Home categories only)
  manual_link TEXT, -- URL to online user manual
  
  -- General notes
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_rh_records_header_id ON tools_rh_records(header_id);
CREATE INDEX IF NOT EXISTS idx_rh_records_user_tool ON tools_rh_records(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_rh_records_date ON tools_rh_records(date);
CREATE INDEX IF NOT EXISTS idx_rh_records_type ON tools_rh_records(type);
CREATE INDEX IF NOT EXISTS idx_rh_records_item_name ON tools_rh_records(item_name);
CREATE INDEX IF NOT EXISTS idx_rh_records_warranty_end_date ON tools_rh_records(warranty_end_date) WHERE warranty_end_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rh_records_warranty_dashboard_item_id ON tools_rh_records(warranty_dashboard_item_id) WHERE warranty_dashboard_item_id IS NOT NULL;

-- Repair pictures table - multiple pictures per record
CREATE TABLE IF NOT EXISTS tools_rh_repair_pictures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES tools_rh_records(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL, -- URL or path to stored image file
  file_name TEXT, -- Original filename
  file_size BIGINT, -- File size in bytes
  file_type TEXT, -- MIME type (e.g., 'image/jpeg', 'image/png')
  display_order INTEGER DEFAULT 0, -- Order for displaying pictures
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_rh_pictures_record_id ON tools_rh_repair_pictures(record_id);
CREATE INDEX IF NOT EXISTS idx_rh_pictures_display_order ON tools_rh_repair_pictures(record_id, display_order);

-- Items table - predefined and user-defined items for Home and Auto categories
-- Items are shared across all headers of the same category_type (Home or Auto)
CREATE TABLE IF NOT EXISTS tools_rh_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  category_type TEXT NOT NULL CHECK (category_type IN ('Home', 'Auto')), -- Home or Auto items
  name TEXT NOT NULL,
  area TEXT NOT NULL, -- Area/category grouping (e.g., 'Interior – Major Systems', 'Engine & Powertrain')
  is_default BOOLEAN DEFAULT false, -- True for system-defined default items
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_rh_items_user_tool ON tools_rh_items(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_rh_items_category_type ON tools_rh_items(category_type);
CREATE INDEX IF NOT EXISTS idx_rh_items_area ON tools_rh_items(area);
CREATE INDEX IF NOT EXISTS idx_rh_items_is_default ON tools_rh_items(is_default);

-- Partial unique index: Ensure unique item names per user per category type (only for non-default items)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rh_items_unique_user_item 
  ON tools_rh_items(user_id, tool_id, category_type, name) 
  WHERE is_default = false;

-- Functions to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rh_headers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_rh_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_rh_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_rh_headers_updated_at ON tools_rh_headers;
CREATE TRIGGER trigger_update_rh_headers_updated_at
  BEFORE UPDATE ON tools_rh_headers
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_headers_updated_at();

DROP TRIGGER IF EXISTS trigger_update_rh_records_updated_at ON tools_rh_records;
CREATE TRIGGER trigger_update_rh_records_updated_at
  BEFORE UPDATE ON tools_rh_records
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_records_updated_at();

DROP TRIGGER IF EXISTS trigger_update_rh_items_updated_at ON tools_rh_items;
CREATE TRIGGER trigger_update_rh_items_updated_at
  BEFORE UPDATE ON tools_rh_items
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_items_updated_at();

-- Enable Row Level Security on all tables
ALTER TABLE tools_rh_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_rh_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_rh_repair_pictures ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_rh_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own repair history data
-- Drop existing policies if they exist, then create them

-- Headers table policies
DROP POLICY IF EXISTS "Users can view their own headers" ON tools_rh_headers;
CREATE POLICY "Users can view their own headers" ON tools_rh_headers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own headers" ON tools_rh_headers;
CREATE POLICY "Users can insert their own headers" ON tools_rh_headers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own headers" ON tools_rh_headers;
CREATE POLICY "Users can update their own headers" ON tools_rh_headers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own headers" ON tools_rh_headers;
CREATE POLICY "Users can delete their own headers" ON tools_rh_headers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Records table policies
DROP POLICY IF EXISTS "Users can view their own records" ON tools_rh_records;
CREATE POLICY "Users can view their own records" ON tools_rh_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own records" ON tools_rh_records;
CREATE POLICY "Users can insert their own records" ON tools_rh_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM tools_rh_headers
      WHERE tools_rh_headers.id = tools_rh_records.header_id
      AND tools_rh_headers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own records" ON tools_rh_records;
CREATE POLICY "Users can update their own records" ON tools_rh_records
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM tools_rh_headers
      WHERE tools_rh_headers.id = tools_rh_records.header_id
      AND tools_rh_headers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own records" ON tools_rh_records;
CREATE POLICY "Users can delete their own records" ON tools_rh_records
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Repair pictures table policies
DROP POLICY IF EXISTS "Users can view their own repair pictures" ON tools_rh_repair_pictures;
CREATE POLICY "Users can view their own repair pictures" ON tools_rh_repair_pictures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own repair pictures" ON tools_rh_repair_pictures;
CREATE POLICY "Users can insert their own repair pictures" ON tools_rh_repair_pictures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own repair pictures" ON tools_rh_repair_pictures;
CREATE POLICY "Users can update their own repair pictures" ON tools_rh_repair_pictures
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own repair pictures" ON tools_rh_repair_pictures;
CREATE POLICY "Users can delete their own repair pictures" ON tools_rh_repair_pictures
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = auth.uid()
    )
  );

-- Items table policies
DROP POLICY IF EXISTS "Users can view their own items" ON tools_rh_items;
CREATE POLICY "Users can view their own items" ON tools_rh_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_default = true);

DROP POLICY IF EXISTS "Users can insert their own items" ON tools_rh_items;
CREATE POLICY "Users can insert their own items" ON tools_rh_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_default = false);

DROP POLICY IF EXISTS "Users can update their own items" ON tools_rh_items;
CREATE POLICY "Users can update their own items" ON tools_rh_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_default = false)
  WITH CHECK (auth.uid() = user_id AND is_default = false);

DROP POLICY IF EXISTS "Users can delete their own items" ON tools_rh_items;
CREATE POLICY "Users can delete their own items" ON tools_rh_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_default = false);

-- ============================================================================
-- END FILE: create-repair-history-tables.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-subscription-tracker-tables.sql
-- ============================================================================

-- Subscription Tracker Tool Database Schema
-- All tables prefixed with 'tools_st_'

-- Main subscriptions table - multiple subscriptions per user allowed
CREATE TABLE IF NOT EXISTS tools_st_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- Can be default category or custom category
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'annual')),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31), -- NULL for annual subscriptions
  billed_date DATE, -- Only for annual subscriptions
  renewal_date DATE, -- Only for annual subscriptions
  add_reminder_to_calendar BOOLEAN DEFAULT false, -- Only for annual subscriptions
  calendar_reminder_id UUID REFERENCES dashboard_items(id) ON DELETE SET NULL, -- Link to dashboard calendar event
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE, -- When subscription was inactivated
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_st_subscriptions_user_tool ON tools_st_subscriptions(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_st_subscriptions_is_active ON tools_st_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_st_subscriptions_frequency ON tools_st_subscriptions(frequency);
CREATE INDEX IF NOT EXISTS idx_st_subscriptions_category ON tools_st_subscriptions(category);
CREATE INDEX IF NOT EXISTS idx_st_subscriptions_renewal_date ON tools_st_subscriptions(renewal_date) WHERE renewal_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_st_subscriptions_calendar_reminder_id ON tools_st_subscriptions(calendar_reminder_id) WHERE calendar_reminder_id IS NOT NULL;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_st_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_st_subscriptions_updated_at ON tools_st_subscriptions;
CREATE TRIGGER trigger_update_st_subscriptions_updated_at
  BEFORE UPDATE ON tools_st_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_st_subscriptions_updated_at();

-- Enable Row Level Security
ALTER TABLE tools_st_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own subscription data
-- Drop existing policies if they exist, then create them

-- SELECT policy
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can view their own subscriptions" ON tools_st_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT policy
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can insert their own subscriptions" ON tools_st_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can update their own subscriptions" ON tools_st_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can delete their own subscriptions" ON tools_st_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================================
-- END FILE: create-subscription-tracker-tables.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-healthcare-appts-history-tables.sql
-- ============================================================================

-- Healthcare Appts and History Tool Database Schema
-- All tables prefixed with 'tools_hcah_'
-- Matches UI: headers (family members), appointment records, documents per record.
--
-- Storage: Bucket 'heathcare-appt-history' (10MB limit, image/*, application/pdf).
-- Apply RLS policies per system_design.md. See create-healthcare-appts-history-storage-bucket.sql.

-- ============================================================================
-- HEADERS (family members, e.g. Family1, Family2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hcah_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  card_color TEXT DEFAULT '#10b981',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hcah_headers_user_id ON tools_hcah_headers(user_id);
CREATE INDEX IF NOT EXISTS idx_hcah_headers_tool_id ON tools_hcah_headers(tool_id);
CREATE INDEX IF NOT EXISTS idx_hcah_headers_user_tool ON tools_hcah_headers(user_id, tool_id);

-- ============================================================================
-- DEFAULT HEADERS (optional seed: Family1, Family2 for first-time setup)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hcah_default_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  card_color TEXT DEFAULT '#10b981',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hcah_default_headers_display_order ON tools_hcah_default_headers(display_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hcah_default_headers_name ON tools_hcah_default_headers(name);

-- ============================================================================
-- APPOINTMENT RECORDS (one per visit; belongs to a header)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hcah_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  header_id UUID NOT NULL REFERENCES tools_hcah_headers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  is_upcoming BOOLEAN NOT NULL DEFAULT true,
  care_facility TEXT,
  provider_info TEXT,
  reason_for_visit TEXT,
  pre_visit_notes TEXT,
  post_visit_notes TEXT,
  show_on_dashboard_calendar BOOLEAN DEFAULT false,
  total_billed TEXT,
  insurance_paid TEXT,
  current_amount_due TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patient responsibility is derived: total_billed - insurance_paid (not stored)

CREATE INDEX IF NOT EXISTS idx_hcah_records_header_id ON tools_hcah_records(header_id);
CREATE INDEX IF NOT EXISTS idx_hcah_records_user_id ON tools_hcah_records(user_id);
CREATE INDEX IF NOT EXISTS idx_hcah_records_tool_id ON tools_hcah_records(tool_id);
CREATE INDEX IF NOT EXISTS idx_hcah_records_appointment_date ON tools_hcah_records(appointment_date);
CREATE INDEX IF NOT EXISTS idx_hcah_records_is_upcoming ON tools_hcah_records(is_upcoming);
CREATE INDEX IF NOT EXISTS idx_hcah_records_user_tool ON tools_hcah_records(user_id, tool_id);

-- ============================================================================
-- DOCUMENTS (multiple per record; stored in storage bucket, metadata here)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hcah_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES tools_hcah_records(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size BIGINT,
  file_type TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hcah_documents_record_id ON tools_hcah_documents(record_id);
CREATE INDEX IF NOT EXISTS idx_hcah_documents_record_order ON tools_hcah_documents(record_id, display_order);

-- ============================================================================
-- UPDATED_AT TRIGGERS (with secure search_path)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_hcah_headers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_hcah_records_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_hcah_default_headers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_hcah_headers_updated_at ON tools_hcah_headers;
CREATE TRIGGER trigger_update_hcah_headers_updated_at
  BEFORE UPDATE ON tools_hcah_headers
  FOR EACH ROW
  EXECUTE FUNCTION update_hcah_headers_updated_at();

DROP TRIGGER IF EXISTS trigger_update_hcah_records_updated_at ON tools_hcah_records;
CREATE TRIGGER trigger_update_hcah_records_updated_at
  BEFORE UPDATE ON tools_hcah_records
  FOR EACH ROW
  EXECUTE FUNCTION update_hcah_records_updated_at();

DROP TRIGGER IF EXISTS trigger_update_hcah_default_headers_updated_at ON tools_hcah_default_headers;
CREATE TRIGGER trigger_update_hcah_default_headers_updated_at
  BEFORE UPDATE ON tools_hcah_default_headers
  FOR EACH ROW
  EXECUTE FUNCTION update_hcah_default_headers_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (optimized: (select auth.uid()) per design_system)
-- ============================================================================
ALTER TABLE tools_hcah_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_hcah_default_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_hcah_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_hcah_documents ENABLE ROW LEVEL SECURITY;

-- Headers
DROP POLICY IF EXISTS "Users can view their own headers" ON tools_hcah_headers;
CREATE POLICY "Users can view their own headers" ON tools_hcah_headers
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own headers" ON tools_hcah_headers;
CREATE POLICY "Users can insert their own headers" ON tools_hcah_headers
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own headers" ON tools_hcah_headers;
CREATE POLICY "Users can update their own headers" ON tools_hcah_headers
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own headers" ON tools_hcah_headers;
CREATE POLICY "Users can delete their own headers" ON tools_hcah_headers
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Default headers (read-only for all authenticated; used to seed user headers)
DROP POLICY IF EXISTS "Anyone can view default headers" ON tools_hcah_default_headers;
CREATE POLICY "Anyone can view default headers" ON tools_hcah_default_headers
  FOR SELECT TO authenticated USING (true);

-- Records
DROP POLICY IF EXISTS "Users can view their own records" ON tools_hcah_records;
CREATE POLICY "Users can view their own records" ON tools_hcah_records
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own records" ON tools_hcah_records;
CREATE POLICY "Users can insert their own records" ON tools_hcah_records
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    EXISTS (
      SELECT 1 FROM tools_hcah_headers h
      WHERE h.id = header_id AND h.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own records" ON tools_hcah_records;
CREATE POLICY "Users can update their own records" ON tools_hcah_records
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id AND
    EXISTS (
      SELECT 1 FROM tools_hcah_headers h
      WHERE h.id = header_id AND h.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own records" ON tools_hcah_records;
CREATE POLICY "Users can delete their own records" ON tools_hcah_records
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Documents (access via record -> header -> user)
DROP POLICY IF EXISTS "Users can view their own documents" ON tools_hcah_documents;
CREATE POLICY "Users can view their own documents" ON tools_hcah_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_hcah_records r
      JOIN tools_hcah_headers h ON h.id = r.header_id
      WHERE r.id = tools_hcah_documents.record_id AND h.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own documents" ON tools_hcah_documents;
CREATE POLICY "Users can insert their own documents" ON tools_hcah_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_hcah_records r
      JOIN tools_hcah_headers h ON h.id = r.header_id
      WHERE r.id = tools_hcah_documents.record_id AND h.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own documents" ON tools_hcah_documents;
CREATE POLICY "Users can update their own documents" ON tools_hcah_documents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_hcah_records r
      JOIN tools_hcah_headers h ON h.id = r.header_id
      WHERE r.id = tools_hcah_documents.record_id AND h.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_hcah_records r
      JOIN tools_hcah_headers h ON h.id = r.header_id
      WHERE r.id = tools_hcah_documents.record_id AND h.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own documents" ON tools_hcah_documents;
CREATE POLICY "Users can delete their own documents" ON tools_hcah_documents
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_hcah_records r
      JOIN tools_hcah_headers h ON h.id = r.header_id
      WHERE r.id = tools_hcah_documents.record_id AND h.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- SEED DEFAULT HEADERS (Family1, Family2)
-- ============================================================================
INSERT INTO tools_hcah_default_headers (name, card_color, display_order) VALUES
  ('Family1', '#10b981', 0),
  ('Family2', '#3b82f6', 1)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- END FILE: create-healthcare-appts-history-tables.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-important-documents-storage-bucket.sql
-- ============================================================================

-- Create Storage Bucket for Important Documents Tool
-- This bucket stores important documents (warranties, policies, records, etc.)

-- Note: Storage buckets in Supabase are created via the Storage API or Dashboard
-- This SQL script provides the bucket configuration that should be applied

-- To create the bucket manually:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New bucket"
-- 3. Name: important-documents
-- 4. Public: true (or false if you want to use signed URLs)
-- 5. File size limit: 10MB
-- 6. Allowed MIME types: image/*, application/pdf

-- Storage Bucket Policies (RLS for Storage)
-- These policies ensure users can only access their own files

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "important-documents: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "important-documents: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "important-documents: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "important-documents: Users can delete their own files" ON storage.objects;

-- Policy: Allow authenticated users to upload files to their own folder
CREATE POLICY "important-documents: Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'important-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to read their own files
CREATE POLICY "important-documents: Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'important-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "important-documents: Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'important-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'important-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "important-documents: Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'important-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- END FILE: create-important-documents-storage-bucket.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-pet-care-schedule-storage-bucket.sql
-- ============================================================================

-- Create Storage Bucket for Pet Care Schedule Tool
-- This bucket stores pet documents

-- Note: Storage buckets in Supabase are created via the Storage API or Dashboard
-- This SQL script provides the bucket configuration that should be applied

-- To create the bucket manually:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New bucket"
-- 3. Name: pet-care-schedule
-- 4. Public: true (or false if you want to use signed URLs)
-- 5. File size limit: 10MB
-- 6. Allowed MIME types: image/*, application/pdf

-- Storage Bucket Policies (RLS for Storage)
-- These policies ensure users can only access their own files

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "pet-care-schedule: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "pet-care-schedule: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "pet-care-schedule: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "pet-care-schedule: Users can delete their own files" ON storage.objects;

-- Policy: Allow authenticated users to upload files to their own folder
CREATE POLICY "pet-care-schedule: Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pet-care-schedule' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to read their own files
CREATE POLICY "pet-care-schedule: Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pet-care-schedule' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "pet-care-schedule: Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pet-care-schedule' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'pet-care-schedule' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "pet-care-schedule: Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pet-care-schedule' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- END FILE: create-pet-care-schedule-storage-bucket.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-repair-history-storage-bucket.sql
-- ============================================================================

-- Create Storage Bucket for Repair History Tool
-- This bucket stores receipts, warranties, and repair pictures

-- Note: Storage buckets in Supabase are created via the Storage API or Dashboard
-- This SQL script provides the bucket configuration that should be applied

-- To create the bucket manually:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New bucket"
-- 3. Name: repair-history
-- 4. Public: true (or false if you want to use signed URLs)
-- 5. File size limit: 10MB
-- 6. Allowed MIME types: image/*, application/pdf

-- Storage Bucket Policies (RLS for Storage)
-- These policies ensure users can only access their own files

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "repair-history: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "repair-history: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "repair-history: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "repair-history: Users can delete their own files" ON storage.objects;

-- Policy: Allow authenticated users to upload files to their own folder
CREATE POLICY "repair-history: Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'repair-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to read their own files
CREATE POLICY "repair-history: Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'repair-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "repair-history: Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'repair-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'repair-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "repair-history: Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'repair-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- END FILE: create-repair-history-storage-bucket.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-healthcare-appts-history-storage-bucket.sql
-- ============================================================================

-- Create Storage Bucket for Healthcare Appts and History Tool
-- This bucket stores appointment-related documents (per record)

-- Note: Storage buckets in Supabase are created via the Storage API or Dashboard
-- This SQL script provides the bucket configuration and RLS policies

-- To create the bucket manually:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New bucket"
-- 3. Name: heathcare-appt-history
-- 4. Public: true (or false if using signed URLs)
-- 5. File size limit: 10MB
-- 6. Allowed MIME types: image/*, application/pdf

-- Storage Bucket Policies (RLS for Storage)
-- Users can only access files in their own folder: {userId}/...

DROP POLICY IF EXISTS "heathcare-appt-history: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "heathcare-appt-history: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "heathcare-appt-history: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "heathcare-appt-history: Users can delete their own files" ON storage.objects;

CREATE POLICY "heathcare-appt-history: Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'heathcare-appt-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "heathcare-appt-history: Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'heathcare-appt-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "heathcare-appt-history: Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'heathcare-appt-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'heathcare-appt-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "heathcare-appt-history: Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'heathcare-appt-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- END FILE: create-healthcare-appts-history-storage-bucket.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: cleanup-storage-policies.sql
-- ============================================================================

-- Cleanup script to remove generic storage policies that may conflict
-- Run this before running the bucket-specific policy scripts

-- Drop generic policies if they exist (these may have been created for other buckets)
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- ============================================================================
-- END FILE: cleanup-storage-policies.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: add-billing-date-to-users.sql
-- ============================================================================

-- Add billing_date column to users table
-- This stores the user's permanent billing date (day of month) that is set when they activate their first tool
-- The billing date is calculated as 8 days after the first tool trial starts (7-day trial + 1 day)

-- ============================================================================
-- 1. ADD billing_date COLUMN
-- ============================================================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS billing_date DATE NULL;

-- ============================================================================
-- 2. ADD INDEX FOR PERFORMANCE
-- ============================================================================

-- Index on billing_date for performance (used in billing queries)
CREATE INDEX IF NOT EXISTS idx_users_billing_date ON users(billing_date);

-- ============================================================================
-- 3. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN users.billing_date IS 'The day of month when billing occurs. Set to 8 days after first tool trial starts. Never changes once set.';


-- ============================================================================
-- END FILE: add-billing-date-to-users.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: migrate-existing-users-billing-date.sql
-- ============================================================================

-- Migration script to set billing_date for existing users
-- This sets billing_date based on their oldest active/trial tool
-- The billing_date is calculated as 8 days after the first tool trial started
-- (7-day trial + 1 day = 8 days from trial_start_date, or created_at + 8 if no trial_start_date)

-- ============================================================================
-- SET billing_date FOR EXISTING USERS
-- ============================================================================

-- Update users who have active/trial tools but no billing_date set
-- Calculate billing_date from their oldest tool:
-- - If tool has trial_end_date, use trial_end_date + 1 day (trial_end_date is 7 days after start, so +1 = 8 days total)
-- - Otherwise, use created_at + 8 days
UPDATE users
SET billing_date = (
  SELECT 
    CASE 
      -- If tool has trial_end_date, billing_date should be 1 day after trial ends
      -- (trial_end_date is 7 days after start, so billing_date = trial_end_date + 1 = 8 days after start)
      WHEN ut.trial_end_date IS NOT NULL THEN (ut.trial_end_date::date + INTERVAL '1 day')::date
      -- Otherwise, use created_at + 8 days
      ELSE (ut.created_at::date + INTERVAL '8 days')::date
    END
  FROM users_tools ut
  WHERE ut.user_id = users.id
    AND ut.status IN ('active', 'trial', 'pending_cancellation')
  ORDER BY ut.created_at ASC
  LIMIT 1
)
WHERE billing_date IS NULL
  AND EXISTS (
    SELECT 1 
    FROM users_tools 
    WHERE user_id = users.id 
    AND status IN ('active', 'trial', 'pending_cancellation')
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check how many users now have billing_date set
-- SELECT COUNT(*) as users_with_billing_date FROM users WHERE billing_date IS NOT NULL;

-- Check how many users still need billing_date (should be 0 if all have tools)
-- SELECT COUNT(*) as users_without_billing_date FROM users WHERE billing_date IS NULL;

-- View sample of updated users
-- SELECT id, email, billing_date FROM users WHERE billing_date IS NOT NULL LIMIT 10;


-- ============================================================================
-- END FILE: migrate-existing-users-billing-date.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: add-mp-meals-is-active.sql
-- ============================================================================

-- Add is_active to tools_mp_meals for existing databases (run if table already existed without this column)
ALTER TABLE tools_mp_meals ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_mp_meals_is_active ON tools_mp_meals(is_active);

-- ============================================================================
-- END FILE: add-mp-meals-is-active.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: add-priority-to-care-plan-items.sql
-- ============================================================================

-- Add priority column to care plan items table
ALTER TABLE tools_PCS_care_plan_items
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high'));


-- ============================================================================
-- END FILE: add-priority-to-care-plan-items.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: add-add-to-dashboard-to-care-plan-items.sql
-- ============================================================================

-- Add add_to_dashboard column to care plan items table
ALTER TABLE tools_PCS_care_plan_items
ADD COLUMN IF NOT EXISTS add_to_dashboard BOOLEAN DEFAULT true;


-- ============================================================================
-- END FILE: add-add-to-dashboard-to-care-plan-items.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: add-add-to-dashboard-to-appointments.sql
-- ============================================================================

-- Add add_to_dashboard column to appointments table
ALTER TABLE tools_PCS_appointments
ADD COLUMN IF NOT EXISTS add_to_dashboard BOOLEAN DEFAULT true;


-- ============================================================================
-- END FILE: add-add-to-dashboard-to-appointments.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: add-notes-to-care-plan-items.sql
-- ============================================================================

-- Add notes column to care plan items table
ALTER TABLE tools_PCS_care_plan_items
ADD COLUMN IF NOT EXISTS notes TEXT;


-- ============================================================================
-- END FILE: add-notes-to-care-plan-items.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: add-notes-to-food-entries.sql
-- ============================================================================

ALTER TABLE tools_PCS_food_entries
ADD COLUMN IF NOT EXISTS notes TEXT;


-- ============================================================================
-- END FILE: add-notes-to-food-entries.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: add-notes-to-veterinary-records.sql
-- ============================================================================

ALTER TABLE tools_PCS_veterinary_records
ADD COLUMN IF NOT EXISTS notes TEXT;


-- ============================================================================
-- END FILE: add-notes-to-veterinary-records.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: add-time-to-calendar-events.sql
-- ============================================================================

-- Add time column to tools_ce_events table
-- This allows users to specify an optional time for calendar events

ALTER TABLE tools_ce_events 
ADD COLUMN IF NOT EXISTS time TIME;

-- Add comment to explain the column
COMMENT ON COLUMN tools_ce_events.time IS 'Optional time for the event in HH:MM format (24-hour). If NULL, event defaults to 9:00 AM on calendar display.';

-- ============================================================================
-- END FILE: add-time-to-calendar-events.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: create-repair-history-defaults.sql
-- ============================================================================

-- Repair History Tool Defaults Table
-- This table stores the default headers and items that are copied to user tables when they add the tool

-- Default headers table
CREATE TABLE IF NOT EXISTS tools_rh_default_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  card_color TEXT DEFAULT '#10b981',
  category_type TEXT NOT NULL CHECK (category_type IN ('Home', 'Auto')),
  display_order INTEGER DEFAULT 0, -- Order for displaying headers
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default items table
CREATE TABLE IF NOT EXISTS tools_rh_default_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_type TEXT NOT NULL CHECK (category_type IN ('Home', 'Auto')),
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  display_order INTEGER DEFAULT 0, -- Order for displaying items within area
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rh_default_headers_category_type ON tools_rh_default_headers(category_type);
CREATE INDEX IF NOT EXISTS idx_rh_default_headers_display_order ON tools_rh_default_headers(display_order);
CREATE INDEX IF NOT EXISTS idx_rh_default_items_category_type ON tools_rh_default_items(category_type);
CREATE INDEX IF NOT EXISTS idx_rh_default_items_area ON tools_rh_default_items(area);
CREATE INDEX IF NOT EXISTS idx_rh_default_items_display_order ON tools_rh_default_items(display_order);

-- Unique constraint: one default header per name/category_type combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_rh_default_headers_unique 
  ON tools_rh_default_headers(category_type, name);

-- Unique constraint: one default item per name/category_type combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_rh_default_items_unique 
  ON tools_rh_default_items(category_type, name);

-- Functions to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rh_default_headers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION update_rh_default_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_catalog;

-- Triggers to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_rh_default_headers_updated_at ON tools_rh_default_headers;
CREATE TRIGGER trigger_update_rh_default_headers_updated_at
  BEFORE UPDATE ON tools_rh_default_headers
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_default_headers_updated_at();

DROP TRIGGER IF EXISTS trigger_update_rh_default_items_updated_at ON tools_rh_default_items;
CREATE TRIGGER trigger_update_rh_default_items_updated_at
  BEFORE UPDATE ON tools_rh_default_items
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_default_items_updated_at();

-- RLS Policies: All authenticated users can read defaults (but not modify)
ALTER TABLE tools_rh_default_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_rh_default_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view default headers" ON tools_rh_default_headers;
CREATE POLICY "Anyone can view default headers" ON tools_rh_default_headers
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view default items" ON tools_rh_default_items;
CREATE POLICY "Anyone can view default items" ON tools_rh_default_items
  FOR SELECT
  TO authenticated
  USING (true);

-- Populate default headers
INSERT INTO tools_rh_default_headers (name, card_color, category_type, display_order) VALUES
  ('Home', '#10b981', 'Home', 1),
  ('Auto1', '#3b82f6', 'Auto', 2),
  ('Auto2', '#8b5cf6', 'Auto', 3)
ON CONFLICT (category_type, name) DO NOTHING;

-- Populate default Home items
INSERT INTO tools_rh_default_items (category_type, name, area, display_order) VALUES
  -- Interior – Major Systems
  ('Home', 'Furnace / Heating System', 'Interior – Major Systems', 1),
  ('Home', 'Air Conditioner (AC)', 'Interior – Major Systems', 2),
  ('Home', 'Heat Pump', 'Interior – Major Systems', 3),
  ('Home', 'Thermostat', 'Interior – Major Systems', 4),
  ('Home', 'Water Heater (Tank / Tankless)', 'Interior – Major Systems', 5),
  ('Home', 'Electrical Panel / Breaker Box', 'Interior – Major Systems', 6),
  ('Home', 'Main Water Shutoff Valve', 'Interior – Major Systems', 7),
  ('Home', 'Plumbing Pipes (Supply / Drain)', 'Interior – Major Systems', 8),
  ('Home', 'Sump Pump', 'Interior – Major Systems', 9),
  ('Home', 'Radon Mitigation System', 'Interior – Major Systems', 10),
  -- Plumbing Fixtures
  ('Home', 'Kitchen Sink', 'Plumbing Fixtures', 1),
  ('Home', 'Bathroom Sink', 'Plumbing Fixtures', 2),
  ('Home', 'Toilet', 'Plumbing Fixtures', 3),
  ('Home', 'Shower', 'Plumbing Fixtures', 4),
  ('Home', 'Bathtub', 'Plumbing Fixtures', 5),
  ('Home', 'Faucets', 'Plumbing Fixtures', 6),
  ('Home', 'Garbage Disposal', 'Plumbing Fixtures', 7),
  ('Home', 'Dishwasher Plumbing Connections', 'Plumbing Fixtures', 8),
  ('Home', 'Water Softener', 'Plumbing Fixtures', 9),
  ('Home', 'Well Pump (if applicable)', 'Plumbing Fixtures', 10),
  -- Electrical & Lighting
  ('Home', 'Electrical Outlets', 'Electrical & Lighting', 1),
  ('Home', 'Light Switches', 'Electrical & Lighting', 2),
  ('Home', 'Light Fixtures', 'Electrical & Lighting', 3),
  ('Home', 'Ceiling Fans', 'Electrical & Lighting', 4),
  ('Home', 'GFCI Outlets', 'Electrical & Lighting', 5),
  ('Home', 'Smoke Detectors', 'Electrical & Lighting', 6),
  ('Home', 'Carbon Monoxide Detectors', 'Electrical & Lighting', 7),
  ('Home', 'Doorbell / Chime', 'Electrical & Lighting', 8),
  -- Appliances
  ('Home', 'Refrigerator', 'Appliances', 1),
  ('Home', 'Dishwasher', 'Appliances', 2),
  ('Home', 'Oven / Range', 'Appliances', 3),
  ('Home', 'Microwave', 'Appliances', 4),
  ('Home', 'Washing Machine', 'Appliances', 5),
  ('Home', 'Dryer', 'Appliances', 6),
  ('Home', 'Garbage Disposal', 'Appliances', 7),
  ('Home', 'Trash Compactor', 'Appliances', 8),
  ('Home', 'Ice Maker', 'Appliances', 9),
  -- Doors, Windows & Insulation
  ('Home', 'Exterior Doors', 'Doors, Windows & Insulation', 1),
  ('Home', 'Interior Doors', 'Doors, Windows & Insulation', 2),
  ('Home', 'Windows', 'Doors, Windows & Insulation', 3),
  ('Home', 'Window Screens', 'Doors, Windows & Insulation', 4),
  ('Home', 'Weatherstripping', 'Doors, Windows & Insulation', 5),
  ('Home', 'Door Locks / Deadbolts', 'Doors, Windows & Insulation', 6),
  ('Home', 'Garage Door', 'Doors, Windows & Insulation', 7),
  ('Home', 'Garage Door Opener', 'Doors, Windows & Insulation', 8),
  ('Home', 'Attic Insulation', 'Doors, Windows & Insulation', 9),
  ('Home', 'Wall Insulation', 'Doors, Windows & Insulation', 10),
  -- Structural & Exterior
  ('Home', 'Roof', 'Structural & Exterior', 1),
  ('Home', 'Gutters / Downspouts', 'Structural & Exterior', 2),
  ('Home', 'Siding', 'Structural & Exterior', 3),
  ('Home', 'Foundation', 'Structural & Exterior', 4),
  ('Home', 'Driveway', 'Structural & Exterior', 5),
  ('Home', 'Walkways / Patios', 'Structural & Exterior', 6),
  ('Home', 'Deck / Porch', 'Structural & Exterior', 7),
  ('Home', 'Fence', 'Structural & Exterior', 8),
  ('Home', 'Retaining Walls', 'Structural & Exterior', 9),
  -- Safety & Security
  ('Home', 'Smoke Detectors', 'Safety & Security', 1),
  ('Home', 'Carbon Monoxide Detectors', 'Safety & Security', 2),
  ('Home', 'Security System', 'Safety & Security', 3),
  ('Home', 'Security Cameras', 'Safety & Security', 4),
  ('Home', 'Door Locks', 'Safety & Security', 5),
  ('Home', 'Window Locks', 'Safety & Security', 6),
  ('Home', 'Fire Extinguishers', 'Safety & Security', 7),
  -- Garage & Storage
  ('Home', 'Garage Door', 'Garage & Storage', 1),
  ('Home', 'Garage Door Opener', 'Garage & Storage', 2),
  ('Home', 'Garage Floor', 'Garage & Storage', 3),
  ('Home', 'Storage Shelving', 'Garage & Storage', 4),
  -- Yard & Outdoor
  ('Home', 'Lawn Mower', 'Yard & Outdoor', 1),
  ('Home', 'Sprinkler System', 'Yard & Outdoor', 2),
  ('Home', 'Outdoor Faucets / Spigots', 'Yard & Outdoor', 3),
  ('Home', 'Outdoor Lighting', 'Yard & Outdoor', 4),
  ('Home', 'Fence', 'Yard & Outdoor', 5),
  ('Home', 'Deck / Patio', 'Yard & Outdoor', 6)
ON CONFLICT (category_type, name) DO NOTHING;

-- Populate default Auto items
INSERT INTO tools_rh_default_items (category_type, name, area, display_order) VALUES
  -- Engine & Routine Maintenance
  ('Auto', 'Oil Change', 'Engine & Routine Maintenance', 1),
  ('Auto', 'Engine Air Filter', 'Engine & Routine Maintenance', 2),
  ('Auto', 'Cabin Air Filter', 'Engine & Routine Maintenance', 3),
  ('Auto', 'Spark Plugs', 'Engine & Routine Maintenance', 4),
  ('Auto', 'Ignition Coils', 'Engine & Routine Maintenance', 5),
  ('Auto', 'Timing Belt / Chain', 'Engine & Routine Maintenance', 6),
  ('Auto', 'Serpentine Belt', 'Engine & Routine Maintenance', 7),
  ('Auto', 'Radiator', 'Engine & Routine Maintenance', 8),
  ('Auto', 'Thermostat (Engine)', 'Engine & Routine Maintenance', 9),
  ('Auto', 'Water Pump', 'Engine & Routine Maintenance', 10),
  ('Auto', 'Coolant / Antifreeze', 'Engine & Routine Maintenance', 11),
  ('Auto', 'Engine Oil', 'Engine & Routine Maintenance', 12),
  ('Auto', 'Transmission Fluid', 'Engine & Routine Maintenance', 13),
  ('Auto', 'Transmission Filter', 'Engine & Routine Maintenance', 14),
  -- Brakes & Suspension
  ('Auto', 'Brake Pads', 'Brakes & Suspension', 1),
  ('Auto', 'Brake Rotors', 'Brakes & Suspension', 2),
  ('Auto', 'Brake Calipers', 'Brakes & Suspension', 3),
  ('Auto', 'Brake Lines', 'Brakes & Suspension', 4),
  ('Auto', 'Brake Fluid', 'Brakes & Suspension', 5),
  ('Auto', 'Shock Absorbers', 'Brakes & Suspension', 6),
  ('Auto', 'Struts', 'Brakes & Suspension', 7),
  ('Auto', 'Suspension Springs', 'Brakes & Suspension', 8),
  ('Auto', 'Control Arms', 'Brakes & Suspension', 9),
  ('Auto', 'Ball Joints', 'Brakes & Suspension', 10),
  ('Auto', 'Tie Rod Ends', 'Brakes & Suspension', 11),
  ('Auto', 'Wheel Bearings', 'Brakes & Suspension', 12),
  -- Tires & Wheels
  ('Auto', 'Tires', 'Tires & Wheels', 1),
  ('Auto', 'Wheel Alignment', 'Tires & Wheels', 2),
  ('Auto', 'Wheel Balancing', 'Tires & Wheels', 3),
  ('Auto', 'Tire Rotation', 'Tires & Wheels', 4),
  ('Auto', 'Wheel Rims', 'Tires & Wheels', 5),
  ('Auto', 'TPMS Sensors', 'Tires & Wheels', 6),
  -- Electrical System
  ('Auto', 'Battery', 'Electrical System', 1),
  ('Auto', 'Alternator', 'Electrical System', 2),
  ('Auto', 'Starter Motor', 'Electrical System', 3),
  ('Auto', 'Headlights', 'Electrical System', 4),
  ('Auto', 'Taillights', 'Electrical System', 5),
  ('Auto', 'Turn Signals', 'Electrical System', 6),
  ('Auto', 'Fuses', 'Electrical System', 7),
  ('Auto', 'Wiring Harness', 'Electrical System', 8),
  -- Exhaust System
  ('Auto', 'Muffler', 'Exhaust System', 1),
  ('Auto', 'Catalytic Converter', 'Exhaust System', 2),
  ('Auto', 'Exhaust Pipes', 'Exhaust System', 3),
  ('Auto', 'O2 Sensors', 'Exhaust System', 4),
  -- Interior & Comfort
  ('Auto', 'Air Conditioning System', 'Interior & Comfort', 1),
  ('Auto', 'Heater Core', 'Interior & Comfort', 2),
  ('Auto', 'Blower Motor', 'Interior & Comfort', 3),
  ('Auto', 'Climate Control Module', 'Interior & Comfort', 4),
  ('Auto', 'Seats', 'Interior & Comfort', 5),
  ('Auto', 'Seat Belts', 'Interior & Comfort', 6),
  ('Auto', 'Dashboard', 'Interior & Comfort', 7),
  ('Auto', 'Radio / Infotainment', 'Interior & Comfort', 8),
  ('Auto', 'Speakers', 'Interior & Comfort', 9),
  -- Body & Exterior
  ('Auto', 'Windshield', 'Body & Exterior', 1),
  ('Auto', 'Windshield Wipers', 'Body & Exterior', 2),
  ('Auto', 'Side Windows', 'Body & Exterior', 3),
  ('Auto', 'Mirrors', 'Body & Exterior', 4),
  ('Auto', 'Paint / Body Work', 'Body & Exterior', 5),
  ('Auto', 'Bumpers', 'Body & Exterior', 6),
  ('Auto', 'Doors', 'Body & Exterior', 7),
  ('Auto', 'Hood', 'Body & Exterior', 8),
  ('Auto', 'Trunk / Hatch', 'Body & Exterior', 9)
ON CONFLICT (category_type, name) DO NOTHING;

-- ============================================================================
-- END FILE: create-repair-history-defaults.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: update-repair-history-rls-policies.sql
-- ============================================================================

-- Update RLS policies to allow users to update and delete their own default items
-- This allows users to edit default items that were copied to their tables

-- Update items table policies
DROP POLICY IF EXISTS "Users can update their own items" ON tools_rh_items;
CREATE POLICY "Users can update their own items" ON tools_rh_items
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own items" ON tools_rh_items;
CREATE POLICY "Users can delete their own items" ON tools_rh_items
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- END FILE: update-repair-history-rls-policies.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: fix-function-search-path.sql
-- ============================================================================

-- Function Search Path Security Fix
-- Addresses Supabase Security Advisor warnings about mutable search_path
-- 
-- This migration fixes all functions by setting an explicit search_path to prevent
-- search path injection attacks. Functions without an explicit search_path can be
-- vulnerable to security issues.
--
-- Pattern: Add SET search_path = public, pg_catalog to all function definitions
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ============================================================================
-- BILLING FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_billing_active_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- CALENDAR EVENTS FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ce_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_ce_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- DASHBOARD FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_dashboard_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- IMPORTANT DOCUMENTS FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_id_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_id_tags_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_id_security_questions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- NOTES FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_note_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_note_tags_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_note_security_questions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PET CARE SCHEDULE FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_pcs_pets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_pcs_food_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_pcs_vet_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_pcs_care_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_pcs_vacc_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_pcs_appt_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_pcs_doc_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_pcs_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- REPAIR HISTORY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_rh_headers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_rh_records_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_rh_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- SUBSCRIPTION TRACKER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_st_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- USER DASHBOARD KPIS FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_dashboard_kpis_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- USERS FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- ADDITIONAL FUNCTIONS (may exist in database but not in migration files)
-- ============================================================================

-- These functions were reported in the warnings but not found in migration files
-- They may have been created directly in the database

CREATE OR REPLACE FUNCTION update_promo_codes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_tools_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_tool_icons_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_users_tools_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- END FILE: fix-function-search-path.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: optimize-rls-policies.sql
-- ============================================================================

-- RLS Policy Performance Optimization Migration
-- Addresses Supabase Performance Advisor warnings about auth.uid() re-evaluation
-- 
-- This migration optimizes all RLS policies by wrapping auth.uid() calls in subqueries
-- to prevent re-evaluation for each row, improving query performance at scale.
--
-- Pattern: Replace auth.uid() with (select auth.uid())
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ============================================================================
-- BILLING TABLES
-- ============================================================================

-- billing_active table
DROP POLICY IF EXISTS "Users can view their own active billing" ON billing_active;
CREATE POLICY "Users can view their own active billing" ON billing_active
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- billing_history table
DROP POLICY IF EXISTS "Users can view their own billing history" ON billing_history;
CREATE POLICY "Users can view their own billing history" ON billing_history
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- CRON JOB LOGS
-- ============================================================================

-- Note: cron_job_logs table doesn't have a user_id column
-- This policy checks if the authenticated user is a superadmin
-- Optimized version: wraps auth.uid() in subquery to prevent re-evaluation
DROP POLICY IF EXISTS "Only superadmins can read cron job logs" ON cron_job_logs;
CREATE POLICY "Only superadmins can read cron job logs" ON cron_job_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND (users.user_status)::text = 'superadmin'
    )
  );

-- ============================================================================
-- DASHBOARD ITEMS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own dashboard items" ON dashboard_items;
CREATE POLICY "Users can view their own dashboard items" ON dashboard_items
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own dashboard items" ON dashboard_items;
CREATE POLICY "Users can insert their own dashboard items" ON dashboard_items
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own dashboard items" ON dashboard_items;
CREATE POLICY "Users can update their own dashboard items" ON dashboard_items
  FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own dashboard items" ON dashboard_items;
CREATE POLICY "Users can delete their own dashboard items" ON dashboard_items
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- CALENDAR EVENTS (tools_ce_*)
-- ============================================================================

-- tools_ce_categories
DROP POLICY IF EXISTS "Users can view their own categories" ON tools_ce_categories;
CREATE POLICY "Users can view their own categories" ON tools_ce_categories
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own categories" ON tools_ce_categories;
CREATE POLICY "Users can insert their own categories" ON tools_ce_categories
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own categories" ON tools_ce_categories;
CREATE POLICY "Users can update their own categories" ON tools_ce_categories
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own categories" ON tools_ce_categories;
CREATE POLICY "Users can delete their own categories" ON tools_ce_categories
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_ce_events
DROP POLICY IF EXISTS "Users can view their own events" ON tools_ce_events;
CREATE POLICY "Users can view their own events" ON tools_ce_events
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own events" ON tools_ce_events;
CREATE POLICY "Users can insert their own events" ON tools_ce_events
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own events" ON tools_ce_events;
CREATE POLICY "Users can update their own events" ON tools_ce_events
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own events" ON tools_ce_events;
CREATE POLICY "Users can delete their own events" ON tools_ce_events
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- IMPORTANT DOCUMENTS (tools_id_*)
-- ============================================================================

-- tools_id_documents
DROP POLICY IF EXISTS "Users can view their own documents" ON tools_id_documents;
CREATE POLICY "Users can view their own documents" ON tools_id_documents
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own documents" ON tools_id_documents;
CREATE POLICY "Users can insert their own documents" ON tools_id_documents
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own documents" ON tools_id_documents;
CREATE POLICY "Users can update their own documents" ON tools_id_documents
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON tools_id_documents;
CREATE POLICY "Users can delete their own documents" ON tools_id_documents
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_id_tags
DROP POLICY IF EXISTS "Users can view their own tags" ON tools_id_tags;
CREATE POLICY "Users can view their own tags" ON tools_id_tags
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own tags" ON tools_id_tags;
CREATE POLICY "Users can insert their own tags" ON tools_id_tags
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own tags" ON tools_id_tags;
CREATE POLICY "Users can update their own tags" ON tools_id_tags
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own tags" ON tools_id_tags;
CREATE POLICY "Users can delete their own tags" ON tools_id_tags
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_id_document_tags
DROP POLICY IF EXISTS "Users can view their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can view their own document tags" ON tools_id_document_tags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can insert their own document tags" ON tools_id_document_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can update their own document tags" ON tools_id_document_tags
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can delete their own document tags" ON tools_id_document_tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

-- tools_id_security_questions (note: this table doesn't have user_id, it references documents)
DROP POLICY IF EXISTS "Users can view their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can view their own security questions" ON tools_id_security_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can insert their own security questions" ON tools_id_security_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can update their own security questions" ON tools_id_security_questions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can delete their own security questions" ON tools_id_security_questions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- NOTES (tools_note_*)
-- ============================================================================

-- tools_note_notes
DROP POLICY IF EXISTS "Users can view their own notes" ON tools_note_notes;
CREATE POLICY "Users can view their own notes" ON tools_note_notes
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own notes" ON tools_note_notes;
CREATE POLICY "Users can insert their own notes" ON tools_note_notes
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own notes" ON tools_note_notes;
CREATE POLICY "Users can update their own notes" ON tools_note_notes
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes" ON tools_note_notes;
CREATE POLICY "Users can delete their own notes" ON tools_note_notes
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_note_tags
DROP POLICY IF EXISTS "Users can view their own tags" ON tools_note_tags;
CREATE POLICY "Users can view their own tags" ON tools_note_tags
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own tags" ON tools_note_tags;
CREATE POLICY "Users can insert their own tags" ON tools_note_tags
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own tags" ON tools_note_tags;
CREATE POLICY "Users can update their own tags" ON tools_note_tags
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own tags" ON tools_note_tags;
CREATE POLICY "Users can delete their own tags" ON tools_note_tags
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_note_note_tags
DROP POLICY IF EXISTS "Users can view their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can view their own note tags" ON tools_note_note_tags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can insert their own note tags" ON tools_note_note_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can update their own note tags" ON tools_note_note_tags
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can delete their own note tags" ON tools_note_note_tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

-- tools_note_security_questions (note: this table doesn't have user_id, it references notes)
DROP POLICY IF EXISTS "Users can view their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can view their own security questions" ON tools_note_security_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can insert their own security questions" ON tools_note_security_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can update their own security questions" ON tools_note_security_questions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can delete their own security questions" ON tools_note_security_questions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- PET CARE SCHEDULE (tools_pcs_*)
-- ============================================================================

-- tools_pcs_pets (note: actual table name may be tools_PCS_pets, but PostgreSQL folds to lowercase)
DROP POLICY IF EXISTS "Users can view their own pets" ON tools_pcs_pets;
CREATE POLICY "Users can view their own pets" ON tools_pcs_pets
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own pets" ON tools_pcs_pets;
CREATE POLICY "Users can insert their own pets" ON tools_pcs_pets
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own pets" ON tools_pcs_pets;
CREATE POLICY "Users can update their own pets" ON tools_pcs_pets
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own pets" ON tools_pcs_pets;
CREATE POLICY "Users can delete their own pets" ON tools_pcs_pets
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_pcs_food_entries
DROP POLICY IF EXISTS "Users can view their own food entries" ON tools_pcs_food_entries;
CREATE POLICY "Users can view their own food entries" ON tools_pcs_food_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_food_entries.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own food entries" ON tools_pcs_food_entries;
CREATE POLICY "Users can insert their own food entries" ON tools_pcs_food_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_food_entries.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own food entries" ON tools_pcs_food_entries;
CREATE POLICY "Users can update their own food entries" ON tools_pcs_food_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_food_entries.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_food_entries.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own food entries" ON tools_pcs_food_entries;
CREATE POLICY "Users can delete their own food entries" ON tools_pcs_food_entries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_food_entries.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

-- tools_pcs_veterinary_records
DROP POLICY IF EXISTS "Users can view their own veterinary records" ON tools_pcs_veterinary_records;
CREATE POLICY "Users can view their own veterinary records" ON tools_pcs_veterinary_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_veterinary_records.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own veterinary records" ON tools_pcs_veterinary_records;
CREATE POLICY "Users can insert their own veterinary records" ON tools_pcs_veterinary_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_veterinary_records.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own veterinary records" ON tools_pcs_veterinary_records;
CREATE POLICY "Users can update their own veterinary records" ON tools_pcs_veterinary_records
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_veterinary_records.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_veterinary_records.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own veterinary records" ON tools_pcs_veterinary_records;
CREATE POLICY "Users can delete their own veterinary records" ON tools_pcs_veterinary_records
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_veterinary_records.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

-- tools_pcs_care_plan_items
DROP POLICY IF EXISTS "Users can view their own care plan items" ON tools_pcs_care_plan_items;
CREATE POLICY "Users can view their own care plan items" ON tools_pcs_care_plan_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_care_plan_items.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own care plan items" ON tools_pcs_care_plan_items;
CREATE POLICY "Users can insert their own care plan items" ON tools_pcs_care_plan_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_care_plan_items.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own care plan items" ON tools_pcs_care_plan_items;
CREATE POLICY "Users can update their own care plan items" ON tools_pcs_care_plan_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_care_plan_items.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_care_plan_items.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own care plan items" ON tools_pcs_care_plan_items;
CREATE POLICY "Users can delete their own care plan items" ON tools_pcs_care_plan_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_care_plan_items.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

-- tools_pcs_vaccinations
DROP POLICY IF EXISTS "Users can view their own vaccinations" ON tools_pcs_vaccinations;
CREATE POLICY "Users can view their own vaccinations" ON tools_pcs_vaccinations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_vaccinations.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own vaccinations" ON tools_pcs_vaccinations;
CREATE POLICY "Users can insert their own vaccinations" ON tools_pcs_vaccinations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_vaccinations.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own vaccinations" ON tools_pcs_vaccinations;
CREATE POLICY "Users can update their own vaccinations" ON tools_pcs_vaccinations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_vaccinations.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_vaccinations.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own vaccinations" ON tools_pcs_vaccinations;
CREATE POLICY "Users can delete their own vaccinations" ON tools_pcs_vaccinations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_vaccinations.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

-- tools_pcs_appointments
DROP POLICY IF EXISTS "Users can view their own appointments" ON tools_pcs_appointments;
CREATE POLICY "Users can view their own appointments" ON tools_pcs_appointments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_appointments.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own appointments" ON tools_pcs_appointments;
CREATE POLICY "Users can insert their own appointments" ON tools_pcs_appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_appointments.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own appointments" ON tools_pcs_appointments;
CREATE POLICY "Users can update their own appointments" ON tools_pcs_appointments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_appointments.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_appointments.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own appointments" ON tools_pcs_appointments;
CREATE POLICY "Users can delete their own appointments" ON tools_pcs_appointments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_appointments.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

-- tools_pcs_documents
DROP POLICY IF EXISTS "Users can view their own documents" ON tools_pcs_documents;
CREATE POLICY "Users can view their own documents" ON tools_pcs_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_documents.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own documents" ON tools_pcs_documents;
CREATE POLICY "Users can insert their own documents" ON tools_pcs_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_documents.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own documents" ON tools_pcs_documents;
CREATE POLICY "Users can update their own documents" ON tools_pcs_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_documents.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_documents.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own documents" ON tools_pcs_documents;
CREATE POLICY "Users can delete their own documents" ON tools_pcs_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_documents.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

-- tools_pcs_notes
DROP POLICY IF EXISTS "Users can view their own notes" ON tools_pcs_notes;
CREATE POLICY "Users can view their own notes" ON tools_pcs_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_notes.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own notes" ON tools_pcs_notes;
CREATE POLICY "Users can insert their own notes" ON tools_pcs_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_notes.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own notes" ON tools_pcs_notes;
CREATE POLICY "Users can update their own notes" ON tools_pcs_notes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_notes.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_notes.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own notes" ON tools_pcs_notes;
CREATE POLICY "Users can delete their own notes" ON tools_pcs_notes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_notes.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- REPAIR HISTORY (tools_rh_*)
-- ============================================================================

-- tools_rh_headers
DROP POLICY IF EXISTS "Users can view their own headers" ON tools_rh_headers;
CREATE POLICY "Users can view their own headers" ON tools_rh_headers
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own headers" ON tools_rh_headers;
CREATE POLICY "Users can insert their own headers" ON tools_rh_headers
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own headers" ON tools_rh_headers;
CREATE POLICY "Users can update their own headers" ON tools_rh_headers
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own headers" ON tools_rh_headers;
CREATE POLICY "Users can delete their own headers" ON tools_rh_headers
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_rh_records
DROP POLICY IF EXISTS "Users can view their own records" ON tools_rh_records;
CREATE POLICY "Users can view their own records" ON tools_rh_records
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own records" ON tools_rh_records;
CREATE POLICY "Users can insert their own records" ON tools_rh_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    EXISTS (
      SELECT 1 FROM tools_rh_headers
      WHERE tools_rh_headers.id = tools_rh_records.header_id
      AND tools_rh_headers.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own records" ON tools_rh_records;
CREATE POLICY "Users can update their own records" ON tools_rh_records
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id AND
    EXISTS (
      SELECT 1 FROM tools_rh_headers
      WHERE tools_rh_headers.id = tools_rh_records.header_id
      AND tools_rh_headers.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own records" ON tools_rh_records;
CREATE POLICY "Users can delete their own records" ON tools_rh_records
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_rh_repair_pictures
DROP POLICY IF EXISTS "Users can view their own repair pictures" ON tools_rh_repair_pictures;
CREATE POLICY "Users can view their own repair pictures" ON tools_rh_repair_pictures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own repair pictures" ON tools_rh_repair_pictures;
CREATE POLICY "Users can insert their own repair pictures" ON tools_rh_repair_pictures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own repair pictures" ON tools_rh_repair_pictures;
CREATE POLICY "Users can update their own repair pictures" ON tools_rh_repair_pictures
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own repair pictures" ON tools_rh_repair_pictures;
CREATE POLICY "Users can delete their own repair pictures" ON tools_rh_repair_pictures
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = (select auth.uid())
    )
  );

-- tools_rh_items
DROP POLICY IF EXISTS "Users can view their own items" ON tools_rh_items;
CREATE POLICY "Users can view their own items" ON tools_rh_items
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id OR is_default = true);

DROP POLICY IF EXISTS "Users can insert their own items" ON tools_rh_items;
CREATE POLICY "Users can insert their own items" ON tools_rh_items
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND is_default = false);

DROP POLICY IF EXISTS "Users can update their own items" ON tools_rh_items;
CREATE POLICY "Users can update their own items" ON tools_rh_items
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id AND is_default = false)
  WITH CHECK ((select auth.uid()) = user_id AND is_default = false);

DROP POLICY IF EXISTS "Users can delete their own items" ON tools_rh_items;
CREATE POLICY "Users can delete their own items" ON tools_rh_items
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id AND is_default = false);

-- ============================================================================
-- SUBSCRIPTION TRACKER (tools_st_*)
-- ============================================================================

-- tools_st_subscriptions
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can view their own subscriptions" ON tools_st_subscriptions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can insert their own subscriptions" ON tools_st_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can update their own subscriptions" ON tools_st_subscriptions
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can delete their own subscriptions" ON tools_st_subscriptions
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- USER DASHBOARD KPIS
-- ============================================================================

-- user_dashboard_kpis
DROP POLICY IF EXISTS "Users can view their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can view their own dashboard KPIs" ON user_dashboard_kpis
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can insert their own dashboard KPIs" ON user_dashboard_kpis
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can update their own dashboard KPIs" ON user_dashboard_kpis
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can delete their own dashboard KPIs" ON user_dashboard_kpis
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- END FILE: optimize-rls-policies.sql
-- ============================================================================


-- ============================================================================
-- BEGIN FILE: add-performance-indexes.sql
-- ============================================================================

-- Performance Optimization Migration
-- Addresses Supabase Database Linter performance suggestions
-- 
-- This migration adds indexes for unindexed foreign keys to improve query performance
-- and optionally removes unused indexes to reduce storage overhead

-- ============================================================================
-- PART 1: ADD INDEXES FOR UNINDEXED FOREIGN KEYS
-- ============================================================================
-- Foreign keys without indexes can cause performance issues during:
-- - JOIN operations
-- - DELETE CASCADE operations
-- - Foreign key constraint checks

-- billing_active table
CREATE INDEX IF NOT EXISTS idx_billing_active_tool_id 
  ON billing_active(tool_id) 
  WHERE tool_id IS NOT NULL;

-- billing_history table
CREATE INDEX IF NOT EXISTS idx_billing_history_tool_id 
  ON billing_history(tool_id) 
  WHERE tool_id IS NOT NULL;

-- tools_ce_categories table
CREATE INDEX IF NOT EXISTS idx_tools_ce_categories_tool_id 
  ON tools_ce_categories(tool_id);

-- tools_ce_events table
CREATE INDEX IF NOT EXISTS idx_tools_ce_events_tool_id 
  ON tools_ce_events(tool_id);

-- tools_id_documents table
CREATE INDEX IF NOT EXISTS idx_tools_id_documents_tool_id 
  ON tools_id_documents(tool_id);

-- tools_id_tags table
CREATE INDEX IF NOT EXISTS idx_tools_id_tags_tool_id 
  ON tools_id_tags(tool_id);

-- tools_note_notes table
CREATE INDEX IF NOT EXISTS idx_tools_note_notes_tool_id 
  ON tools_note_notes(tool_id);

-- tools_note_tags table
CREATE INDEX IF NOT EXISTS idx_tools_note_tags_tool_id 
  ON tools_note_tags(tool_id);

-- tools_pcs_pets table (note: actual table name may be tools_PCS_pets, but PostgreSQL folds to lowercase)
CREATE INDEX IF NOT EXISTS idx_tools_pcs_pets_tool_id 
  ON tools_pcs_pets(tool_id);

-- tools_rh_headers table
CREATE INDEX IF NOT EXISTS idx_tools_rh_headers_tool_id 
  ON tools_rh_headers(tool_id);

-- tools_rh_items table
CREATE INDEX IF NOT EXISTS idx_tools_rh_items_tool_id 
  ON tools_rh_items(tool_id);

-- tools_rh_records table
CREATE INDEX IF NOT EXISTS idx_tools_rh_records_tool_id 
  ON tools_rh_records(tool_id);

-- tools_st_subscriptions table
CREATE INDEX IF NOT EXISTS idx_tools_st_subscriptions_tool_id 
  ON tools_st_subscriptions(tool_id);

-- user_dashboard_kpis table
CREATE INDEX IF NOT EXISTS idx_user_dashboard_kpis_tool_id 
  ON user_dashboard_kpis(tool_id);

-- ============================================================================
-- PART 2: REMOVE UNUSED INDEXES (DEFERRED)
-- ============================================================================
-- This section has been deferred until after the application is fully built.
-- When ready to clean up unused indexes, refer to the Supabase Database Linter
-- report for the complete list of unused indexes to review and remove.

-- ============================================================================
-- END FILE: add-performance-indexes.sql
-- ============================================================================

-- ============================================================================
-- LEGACY CLEANUP: remove deprecated dashboard KPI preferences table
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.user_dashboard_kpis') IS NOT NULL THEN
    EXECUTE 'DROP TABLE public.user_dashboard_kpis CASCADE';
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.update_user_dashboard_kpis_updated_at();

