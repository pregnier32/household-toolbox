-- Event Budget Planner — current schema
-- Safe to re-run. Creates anything missing. Does not delete user rows.
-- Includes tables, later columns, attachment tables, and storage policies for bucket "event-budget-planner".
-- Run in the Supabase SQL editor.

-- Event Budget Planner Tool Database Schema
-- All tables prefixed with 'tools_ebp_'
-- Matches UI: EventBudgetPlannerTool (Events, Categories, Vendors, Types tabs;
--   per-event category budgets and expenses).
--
-- Table layout:
--   Master lists (per user + tool): categories, types, vendors
--   Default seed tables: tools_ebp_default_categories, tools_ebp_default_types
--   Events: one row per planned event (history = is_active false)
--   Event category budgets: junction — category + budget amount per event
--   Expenses: line items under an event, tied to category + vendor
--   Expense splits: optional extra vendor+amount parts (single-vendor = no split rows)
--
-- Default category/type names are seeded from tools_ebp_default_* on first API load.
--
-- Run in Supabase SQL Editor (idempotent: safe to re-run).
-- After deploy, register tool_id FK indexes in supabase/archive/platform/performance-indexes.sql if you maintain that file.

-- ============================================================================
-- CATEGORIES (master list — Categories tab)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_ebp_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, tool_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ebp_categories_user_id ON tools_ebp_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_ebp_categories_tool_id ON tools_ebp_categories(tool_id);
CREATE INDEX IF NOT EXISTS idx_ebp_categories_user_tool ON tools_ebp_categories(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_ebp_categories_user_tool_active ON tools_ebp_categories(user_id, tool_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ebp_categories_is_active ON tools_ebp_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_ebp_categories_name ON tools_ebp_categories(name);

-- ============================================================================
-- DEFAULT CATEGORIES (read-only seed for first-time user setup)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_ebp_default_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ebp_default_categories_name ON tools_ebp_default_categories(name);
CREATE INDEX IF NOT EXISTS idx_ebp_default_categories_display_order ON tools_ebp_default_categories(display_order);

-- ============================================================================
-- TYPES (master list — Types tab)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_ebp_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, tool_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ebp_types_user_id ON tools_ebp_types(user_id);
CREATE INDEX IF NOT EXISTS idx_ebp_types_tool_id ON tools_ebp_types(tool_id);
CREATE INDEX IF NOT EXISTS idx_ebp_types_user_tool ON tools_ebp_types(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_ebp_types_user_tool_active ON tools_ebp_types(user_id, tool_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ebp_types_is_active ON tools_ebp_types(is_active);
CREATE INDEX IF NOT EXISTS idx_ebp_types_name ON tools_ebp_types(name);

-- ============================================================================
-- DEFAULT TYPES (read-only seed for first-time user setup)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_ebp_default_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ebp_default_types_name ON tools_ebp_default_types(name);
CREATE INDEX IF NOT EXISTS idx_ebp_default_types_display_order ON tools_ebp_default_types(display_order);

-- ============================================================================
-- VENDORS (master list — Vendors tab)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_ebp_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  contact_person TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  service_provided TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',

  is_active BOOLEAN NOT NULL DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, tool_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ebp_vendors_user_id ON tools_ebp_vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_ebp_vendors_tool_id ON tools_ebp_vendors(tool_id);
CREATE INDEX IF NOT EXISTS idx_ebp_vendors_user_tool ON tools_ebp_vendors(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_ebp_vendors_user_tool_active ON tools_ebp_vendors(user_id, tool_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ebp_vendors_is_active ON tools_ebp_vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_ebp_vendors_name ON tools_ebp_vendors(name);

-- ============================================================================
-- EVENTS (Events tab — history = is_active false)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_ebp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  type_id UUID NOT NULL REFERENCES tools_ebp_types(id) ON DELETE RESTRICT,
  notes TEXT NOT NULL DEFAULT '',

  is_active BOOLEAN NOT NULL DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ebp_events_user_id ON tools_ebp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ebp_events_tool_id ON tools_ebp_events(tool_id);
CREATE INDEX IF NOT EXISTS idx_ebp_events_user_tool ON tools_ebp_events(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_ebp_events_user_tool_active ON tools_ebp_events(user_id, tool_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ebp_events_is_active ON tools_ebp_events(is_active);
CREATE INDEX IF NOT EXISTS idx_ebp_events_event_date ON tools_ebp_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_ebp_events_type_id ON tools_ebp_events(type_id);
CREATE INDEX IF NOT EXISTS idx_ebp_events_name ON tools_ebp_events(name);

-- ============================================================================
-- EVENT CATEGORY BUDGETS (category + budget per event)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_ebp_event_category_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES tools_ebp_events(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES tools_ebp_categories(id) ON DELETE RESTRICT,

  budget_amount NUMERIC(12, 2) NOT NULL CHECK (budget_amount > 0),

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  UNIQUE (event_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_ebp_event_category_budgets_event_id
  ON tools_ebp_event_category_budgets(event_id);
CREATE INDEX IF NOT EXISTS idx_ebp_event_category_budgets_category_id
  ON tools_ebp_event_category_budgets(category_id);

-- ============================================================================
-- EXPENSES (line items under an event category)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_ebp_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES tools_ebp_events(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES tools_ebp_categories(id) ON DELETE RESTRICT,
  vendor_id UUID NOT NULL REFERENCES tools_ebp_vendors(id) ON DELETE RESTRICT,

  expense_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  note TEXT NOT NULL DEFAULT '',

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ebp_expenses_event_id ON tools_ebp_expenses(event_id);
CREATE INDEX IF NOT EXISTS idx_ebp_expenses_category_id ON tools_ebp_expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_ebp_expenses_vendor_id ON tools_ebp_expenses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ebp_expenses_event_category ON tools_ebp_expenses(event_id, category_id);
CREATE INDEX IF NOT EXISTS idx_ebp_expenses_expense_date ON tools_ebp_expenses(expense_date DESC);

-- ============================================================================
-- EXPENSE SPLITS (optional multi-vendor tender; omit for single-vendor)
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

-- ============================================================================
-- UPDATED_AT TRIGGERS (secure search_path per system_design.md)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_ebp_default_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_ebp_default_types_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_ebp_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_ebp_types_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_ebp_vendors_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_ebp_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_ebp_event_category_budgets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_ebp_expenses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

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

DROP TRIGGER IF EXISTS trigger_update_ebp_default_categories_updated_at ON tools_ebp_default_categories;
CREATE TRIGGER trigger_update_ebp_default_categories_updated_at
  BEFORE UPDATE ON tools_ebp_default_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_ebp_default_categories_updated_at();

DROP TRIGGER IF EXISTS trigger_update_ebp_default_types_updated_at ON tools_ebp_default_types;
CREATE TRIGGER trigger_update_ebp_default_types_updated_at
  BEFORE UPDATE ON tools_ebp_default_types
  FOR EACH ROW
  EXECUTE FUNCTION update_ebp_default_types_updated_at();

DROP TRIGGER IF EXISTS trigger_update_ebp_categories_updated_at ON tools_ebp_categories;
CREATE TRIGGER trigger_update_ebp_categories_updated_at
  BEFORE UPDATE ON tools_ebp_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_ebp_categories_updated_at();

DROP TRIGGER IF EXISTS trigger_update_ebp_types_updated_at ON tools_ebp_types;
CREATE TRIGGER trigger_update_ebp_types_updated_at
  BEFORE UPDATE ON tools_ebp_types
  FOR EACH ROW
  EXECUTE FUNCTION update_ebp_types_updated_at();

DROP TRIGGER IF EXISTS trigger_update_ebp_vendors_updated_at ON tools_ebp_vendors;
CREATE TRIGGER trigger_update_ebp_vendors_updated_at
  BEFORE UPDATE ON tools_ebp_vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_ebp_vendors_updated_at();

DROP TRIGGER IF EXISTS trigger_update_ebp_events_updated_at ON tools_ebp_events;
CREATE TRIGGER trigger_update_ebp_events_updated_at
  BEFORE UPDATE ON tools_ebp_events
  FOR EACH ROW
  EXECUTE FUNCTION update_ebp_events_updated_at();

DROP TRIGGER IF EXISTS trigger_update_ebp_event_category_budgets_updated_at ON tools_ebp_event_category_budgets;
CREATE TRIGGER trigger_update_ebp_event_category_budgets_updated_at
  BEFORE UPDATE ON tools_ebp_event_category_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_ebp_event_category_budgets_updated_at();

DROP TRIGGER IF EXISTS trigger_update_ebp_expenses_updated_at ON tools_ebp_expenses;
CREATE TRIGGER trigger_update_ebp_expenses_updated_at
  BEFORE UPDATE ON tools_ebp_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_ebp_expenses_updated_at();

DROP TRIGGER IF EXISTS trigger_update_ebp_expense_splits_updated_at ON tools_ebp_expense_splits;
CREATE TRIGGER trigger_update_ebp_expense_splits_updated_at
  BEFORE UPDATE ON tools_ebp_expense_splits
  FOR EACH ROW
  EXECUTE FUNCTION update_ebp_expense_splits_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (optimized: (select auth.uid()))
-- ============================================================================
ALTER TABLE tools_ebp_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_ebp_default_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_ebp_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_ebp_default_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_ebp_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_ebp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_ebp_event_category_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_ebp_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_ebp_expense_splits ENABLE ROW LEVEL SECURITY;

-- Categories
DROP POLICY IF EXISTS "ebp: Users can view their own categories" ON tools_ebp_categories;
CREATE POLICY "ebp: Users can view their own categories" ON tools_ebp_categories
  FOR SELECT TO authenticated USING (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "ebp: Users can insert their own categories" ON tools_ebp_categories;
CREATE POLICY "ebp: Users can insert their own categories" ON tools_ebp_categories
  FOR INSERT TO authenticated WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "ebp: Users can update their own categories" ON tools_ebp_categories;
CREATE POLICY "ebp: Users can update their own categories" ON tools_ebp_categories
  FOR UPDATE TO authenticated
  USING (public.can_access_user_data(user_id))
  WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "ebp: Users can delete their own categories" ON tools_ebp_categories;
CREATE POLICY "ebp: Users can delete their own categories" ON tools_ebp_categories
  FOR DELETE TO authenticated USING (public.can_access_user_data(user_id));

-- Default categories (read-only; used to seed user categories)
DROP POLICY IF EXISTS "ebp: Anyone can view default categories" ON tools_ebp_default_categories;
CREATE POLICY "ebp: Anyone can view default categories" ON tools_ebp_default_categories
  FOR SELECT TO authenticated USING (true);

-- Types
DROP POLICY IF EXISTS "ebp: Users can view their own types" ON tools_ebp_types;
CREATE POLICY "ebp: Users can view their own types" ON tools_ebp_types
  FOR SELECT TO authenticated USING (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "ebp: Users can insert their own types" ON tools_ebp_types;
CREATE POLICY "ebp: Users can insert their own types" ON tools_ebp_types
  FOR INSERT TO authenticated WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "ebp: Users can update their own types" ON tools_ebp_types;
CREATE POLICY "ebp: Users can update their own types" ON tools_ebp_types
  FOR UPDATE TO authenticated
  USING (public.can_access_user_data(user_id))
  WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "ebp: Users can delete their own types" ON tools_ebp_types;
CREATE POLICY "ebp: Users can delete their own types" ON tools_ebp_types
  FOR DELETE TO authenticated USING (public.can_access_user_data(user_id));

-- Default types (read-only; used to seed user types)
DROP POLICY IF EXISTS "ebp: Anyone can view default types" ON tools_ebp_default_types;
CREATE POLICY "ebp: Anyone can view default types" ON tools_ebp_default_types
  FOR SELECT TO authenticated USING (true);

-- Vendors
DROP POLICY IF EXISTS "ebp: Users can view their own vendors" ON tools_ebp_vendors;
CREATE POLICY "ebp: Users can view their own vendors" ON tools_ebp_vendors
  FOR SELECT TO authenticated USING (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "ebp: Users can insert their own vendors" ON tools_ebp_vendors;
CREATE POLICY "ebp: Users can insert their own vendors" ON tools_ebp_vendors
  FOR INSERT TO authenticated WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "ebp: Users can update their own vendors" ON tools_ebp_vendors;
CREATE POLICY "ebp: Users can update their own vendors" ON tools_ebp_vendors
  FOR UPDATE TO authenticated
  USING (public.can_access_user_data(user_id))
  WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "ebp: Users can delete their own vendors" ON tools_ebp_vendors;
CREATE POLICY "ebp: Users can delete their own vendors" ON tools_ebp_vendors
  FOR DELETE TO authenticated USING (public.can_access_user_data(user_id));

-- Events
DROP POLICY IF EXISTS "ebp: Users can view their own events" ON tools_ebp_events;
CREATE POLICY "ebp: Users can view their own events" ON tools_ebp_events
  FOR SELECT TO authenticated USING (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "ebp: Users can insert their own events" ON tools_ebp_events;
CREATE POLICY "ebp: Users can insert their own events" ON tools_ebp_events
  FOR INSERT TO authenticated WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "ebp: Users can update their own events" ON tools_ebp_events;
CREATE POLICY "ebp: Users can update their own events" ON tools_ebp_events
  FOR UPDATE TO authenticated
  USING (public.can_access_user_data(user_id))
  WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "ebp: Users can delete their own events" ON tools_ebp_events;
CREATE POLICY "ebp: Users can delete their own events" ON tools_ebp_events
  FOR DELETE TO authenticated USING (public.can_access_user_data(user_id));

-- Event category budgets (via parent event ownership)
DROP POLICY IF EXISTS "ebp: Users can view their own event category budgets" ON tools_ebp_event_category_budgets;
CREATE POLICY "ebp: Users can view their own event category budgets" ON tools_ebp_event_category_budgets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_ebp_events e
      WHERE e.id = tools_ebp_event_category_budgets.event_id
        AND public.can_access_user_data(e.user_id)
    )
  );

DROP POLICY IF EXISTS "ebp: Users can insert their own event category budgets" ON tools_ebp_event_category_budgets;
CREATE POLICY "ebp: Users can insert their own event category budgets" ON tools_ebp_event_category_budgets
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_ebp_events e
      WHERE e.id = tools_ebp_event_category_budgets.event_id
        AND public.can_access_user_data(e.user_id)
    )
  );

DROP POLICY IF EXISTS "ebp: Users can update their own event category budgets" ON tools_ebp_event_category_budgets;
CREATE POLICY "ebp: Users can update their own event category budgets" ON tools_ebp_event_category_budgets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_ebp_events e
      WHERE e.id = tools_ebp_event_category_budgets.event_id
        AND public.can_access_user_data(e.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_ebp_events e
      WHERE e.id = tools_ebp_event_category_budgets.event_id
        AND public.can_access_user_data(e.user_id)
    )
  );

DROP POLICY IF EXISTS "ebp: Users can delete their own event category budgets" ON tools_ebp_event_category_budgets;
CREATE POLICY "ebp: Users can delete their own event category budgets" ON tools_ebp_event_category_budgets
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_ebp_events e
      WHERE e.id = tools_ebp_event_category_budgets.event_id
        AND public.can_access_user_data(e.user_id)
    )
  );

-- Expenses (via parent event ownership)
DROP POLICY IF EXISTS "ebp: Users can view their own expenses" ON tools_ebp_expenses;
CREATE POLICY "ebp: Users can view their own expenses" ON tools_ebp_expenses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_ebp_events e
      WHERE e.id = tools_ebp_expenses.event_id
        AND public.can_access_user_data(e.user_id)
    )
  );

DROP POLICY IF EXISTS "ebp: Users can insert their own expenses" ON tools_ebp_expenses;
CREATE POLICY "ebp: Users can insert their own expenses" ON tools_ebp_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_ebp_events e
      WHERE e.id = tools_ebp_expenses.event_id
        AND public.can_access_user_data(e.user_id)
    )
  );

DROP POLICY IF EXISTS "ebp: Users can update their own expenses" ON tools_ebp_expenses;
CREATE POLICY "ebp: Users can update their own expenses" ON tools_ebp_expenses
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_ebp_events e
      WHERE e.id = tools_ebp_expenses.event_id
        AND public.can_access_user_data(e.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_ebp_events e
      WHERE e.id = tools_ebp_expenses.event_id
        AND public.can_access_user_data(e.user_id)
    )
  );

DROP POLICY IF EXISTS "ebp: Users can delete their own expenses" ON tools_ebp_expenses;
CREATE POLICY "ebp: Users can delete their own expenses" ON tools_ebp_expenses
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_ebp_events e
      WHERE e.id = tools_ebp_expenses.event_id
        AND public.can_access_user_data(e.user_id)
    )
  );

-- Expense splits (via parent expense → event ownership)
DROP POLICY IF EXISTS "ebp: Users can view their own expense splits" ON tools_ebp_expense_splits;
CREATE POLICY "ebp: Users can view their own expense splits" ON tools_ebp_expense_splits
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_ebp_expenses x
      JOIN tools_ebp_events e ON e.id = x.event_id
      WHERE x.id = tools_ebp_expense_splits.expense_id
        AND public.can_access_user_data(e.user_id)
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
        AND public.can_access_user_data(e.user_id)
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
        AND public.can_access_user_data(e.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_ebp_expenses x
      JOIN tools_ebp_events e ON e.id = x.event_id
      WHERE x.id = tools_ebp_expense_splits.expense_id
        AND public.can_access_user_data(e.user_id)
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
        AND public.can_access_user_data(e.user_id)
    )
  );

-- ============================================================================
-- SEED DEFAULT CATEGORIES
-- ============================================================================
INSERT INTO tools_ebp_default_categories (name, display_order) VALUES
  ('Venue', 0),
  ('Food and Drink', 1),
  ('Decorations', 2),
  ('Entertainment', 3),
  ('Invitations', 4),
  ('Rentals', 5),
  ('Advertising', 6),
  ('Gifts', 7),
  ('Travel', 8),
  ('Supplies', 9),
  ('Miscellaneous', 10)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SEED DEFAULT TYPES
-- ============================================================================
INSERT INTO tools_ebp_default_types (name, display_order) VALUES
  ('Birthday', 0),
  ('Wedding', 1),
  ('Graduation', 2),
  ('Fundraiser', 3),
  ('Vacation', 4),
  ('Business Event', 5)
ON CONFLICT (name) DO NOTHING;


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
  USING (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can insert their own EBP event attachments" ON tools_ebp_event_attachments;
CREATE POLICY "Users can insert their own EBP event attachments" ON tools_ebp_event_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can update their own EBP event attachments" ON tools_ebp_event_attachments;
CREATE POLICY "Users can update their own EBP event attachments" ON tools_ebp_event_attachments
  FOR UPDATE
  TO authenticated
  USING (public.can_access_user_data(user_id))
  WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can delete their own EBP event attachments" ON tools_ebp_event_attachments;
CREATE POLICY "Users can delete their own EBP event attachments" ON tools_ebp_event_attachments
  FOR DELETE
  TO authenticated
  USING (public.can_access_user_data(user_id));

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
  USING (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can insert their own EBP expense attachments" ON tools_ebp_expense_attachments;
CREATE POLICY "Users can insert their own EBP expense attachments" ON tools_ebp_expense_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can update their own EBP expense attachments" ON tools_ebp_expense_attachments;
CREATE POLICY "Users can update their own EBP expense attachments" ON tools_ebp_expense_attachments
  FOR UPDATE
  TO authenticated
  USING (public.can_access_user_data(user_id))
  WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can delete their own EBP expense attachments" ON tools_ebp_expense_attachments;
CREATE POLICY "Users can delete their own EBP expense attachments" ON tools_ebp_expense_attachments
  FOR DELETE
  TO authenticated
  USING (public.can_access_user_data(user_id));


-- Storage policies for bucket "event-budget-planner".
-- Create that bucket in Supabase Storage if it does not exist yet.
DROP POLICY IF EXISTS "event-budget-planner: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "event-budget-planner: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "event-budget-planner: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "event-budget-planner: Users can delete their own files" ON storage.objects;

CREATE POLICY "event-budget-planner: Users can upload to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-budget-planner' AND
  public.can_access_storage_owner((storage.foldername(name))[1])
);

CREATE POLICY "event-budget-planner: Users can read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-budget-planner' AND
  public.can_access_storage_owner((storage.foldername(name))[1])
);

CREATE POLICY "event-budget-planner: Users can update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'event-budget-planner' AND
  public.can_access_storage_owner((storage.foldername(name))[1])
)
WITH CHECK (
  bucket_id = 'event-budget-planner' AND
  public.can_access_storage_owner((storage.foldername(name))[1])
);

CREATE POLICY "event-budget-planner: Users can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'event-budget-planner' AND
  public.can_access_storage_owner((storage.foldername(name))[1])
);


NOTIFY pgrst, 'reload schema';
