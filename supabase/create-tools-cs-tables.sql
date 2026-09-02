-- Cleaning Schedule Tool Database Schema
-- All tables prefixed with 'tools_cs_'
-- Matches UI: CleaningScheduleTool (Schedule, Library, Categories, Export).
--
-- Table layout:
--   Global seed (read-only, copied on first API load):
--     tools_cs_default_categories
--     tools_cs_default_items
--   Per-user working data:
--     tools_cs_categories   — default + custom categories (is_default cannot be deleted)
--     tools_cs_items        — library templates (defaults may be hidden; custom may be deleted)
--     tools_cs_tasks        — one schedule definition per library item + next_due_date
--     tools_cs_completions  — one row per completed occurrence
--
-- Do NOT store expanded future occurrences. Expand on demand for the visible
-- date window (same architecture as Calendar Events).
-- Category icons may come later (nullable icon_key reserved).
--
-- Run in Supabase SQL Editor (idempotent: safe to re-run).
-- After deploy, register tool_id FK indexes in add-performance-indexes.sql
-- if you maintain that file. Account delete cascades via users(id).

-- ============================================================================
-- DEFAULT CATEGORIES (global seed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_cs_default_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  -- Reserved for a later icon pass; unused by the current UI.
  icon_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_default_categories_name
  ON tools_cs_default_categories(name);
CREATE INDEX IF NOT EXISTS idx_cs_default_categories_display_order
  ON tools_cs_default_categories(display_order);

-- ============================================================================
-- DEFAULT LIBRARY ITEMS (global seed — not scheduled)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_cs_default_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL,
  name TEXT NOT NULL,
  category_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_default_items_source_key
  ON tools_cs_default_items(source_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_default_items_category_name
  ON tools_cs_default_items(category_name, name);
CREATE INDEX IF NOT EXISTS idx_cs_default_items_category_name_lookup
  ON tools_cs_default_items(category_name);
CREATE INDEX IF NOT EXISTS idx_cs_default_items_display_order
  ON tools_cs_default_items(display_order);

-- ============================================================================
-- CATEGORIES (per user + tool)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_cs_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  -- Reserved for a later icon pass; unused by the current UI.
  icon_key TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, tool_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cs_categories_user_id ON tools_cs_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_cs_categories_tool_id ON tools_cs_categories(tool_id);
CREATE INDEX IF NOT EXISTS idx_cs_categories_user_tool ON tools_cs_categories(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_cs_categories_is_default ON tools_cs_categories(is_default);
CREATE INDEX IF NOT EXISTS idx_cs_categories_name ON tools_cs_categories(name);

-- ============================================================================
-- LIBRARY ITEMS (per user + tool)
-- Defaults are templates: not scheduled until the user activates them.
-- Hide defaults with is_hidden; never hard-delete is_default rows.
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_cs_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES tools_cs_categories(id) ON DELETE RESTRICT,

  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  -- Stable key from tools_cs_default_items.source_key so later catalog
  -- additions can be copied without duplicating existing defaults.
  source_key TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cs_items_user_id ON tools_cs_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cs_items_tool_id ON tools_cs_items(tool_id);
CREATE INDEX IF NOT EXISTS idx_cs_items_user_tool ON tools_cs_items(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_cs_items_category_id ON tools_cs_items(category_id);
CREATE INDEX IF NOT EXISTS idx_cs_items_is_default ON tools_cs_items(is_default);
CREATE INDEX IF NOT EXISTS idx_cs_items_is_hidden ON tools_cs_items(is_hidden);
CREATE INDEX IF NOT EXISTS idx_cs_items_user_tool_category
  ON tools_cs_items(user_id, tool_id, category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_items_user_tool_source_key
  ON tools_cs_items(user_id, tool_id, source_key)
  WHERE source_key IS NOT NULL;

-- ============================================================================
-- SCHEDULED TASKS (one definition per library item)
-- History = is_active false. Reactivate the same row; do not insert a second.
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_cs_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES tools_cs_items(id) ON DELETE CASCADE,

  frequency TEXT NOT NULL CHECK (frequency IN (
    'every_day',
    'every_x_days',
    'weekly',
    'every_x_weeks',
    'monthly',
    'every_x_months',
    'quarterly',
    'every_6_months',
    'annually',
    'custom',
    'first_weekend'
  )),
  interval_count INTEGER CHECK (interval_count IS NULL OR interval_count >= 1),
  interval_unit TEXT CHECK (interval_unit IS NULL OR interval_unit IN ('days', 'weeks', 'months')),
  days_of_week JSONB,
  day_of_month INTEGER CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)),

  next_due_date DATE NOT NULL,
  last_completed_date DATE,

  is_active BOOLEAN NOT NULL DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  UNIQUE (item_id)
);

CREATE INDEX IF NOT EXISTS idx_cs_tasks_user_id ON tools_cs_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_tool_id ON tools_cs_tasks(tool_id);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_user_tool ON tools_cs_tasks(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_user_tool_active ON tools_cs_tasks(user_id, tool_id, is_active);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_item_id ON tools_cs_tasks(item_id);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_is_active ON tools_cs_tasks(is_active);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_next_due_date ON tools_cs_tasks(next_due_date);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_frequency ON tools_cs_tasks(frequency);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_days_of_week
  ON tools_cs_tasks USING GIN (days_of_week)
  WHERE days_of_week IS NOT NULL;

-- ============================================================================
-- COMPLETIONS (history of finished occurrences)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_cs_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tools_cs_tasks(id) ON DELETE CASCADE,

  scheduled_date DATE NOT NULL,
  completed_date DATE NOT NULL,
  lateness TEXT NOT NULL CHECK (lateness IN ('Early', 'On time', 'Late')),

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cs_completions_user_id ON tools_cs_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_cs_completions_tool_id ON tools_cs_completions(tool_id);
CREATE INDEX IF NOT EXISTS idx_cs_completions_user_tool ON tools_cs_completions(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_cs_completions_task_id ON tools_cs_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_cs_completions_completed_date
  ON tools_cs_completions(completed_date DESC);
CREATE INDEX IF NOT EXISTS idx_cs_completions_scheduled_date
  ON tools_cs_completions(scheduled_date DESC);

-- ============================================================================
-- UPDATED_AT + DEFAULT-PROTECTION TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_tools_cs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_tools_cs_default_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF OLD.is_default THEN
    RAISE EXCEPTION 'Default Cleaning Schedule records cannot be permanently deleted';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_cs_default_categories_updated_at ON tools_cs_default_categories;
CREATE TRIGGER trigger_update_cs_default_categories_updated_at
  BEFORE UPDATE ON tools_cs_default_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_cs_updated_at();

DROP TRIGGER IF EXISTS trigger_update_cs_default_items_updated_at ON tools_cs_default_items;
CREATE TRIGGER trigger_update_cs_default_items_updated_at
  BEFORE UPDATE ON tools_cs_default_items
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_cs_updated_at();

DROP TRIGGER IF EXISTS trigger_update_cs_categories_updated_at ON tools_cs_categories;
CREATE TRIGGER trigger_update_cs_categories_updated_at
  BEFORE UPDATE ON tools_cs_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_cs_updated_at();

DROP TRIGGER IF EXISTS trigger_update_cs_items_updated_at ON tools_cs_items;
CREATE TRIGGER trigger_update_cs_items_updated_at
  BEFORE UPDATE ON tools_cs_items
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_cs_updated_at();

DROP TRIGGER IF EXISTS trigger_update_cs_tasks_updated_at ON tools_cs_tasks;
CREATE TRIGGER trigger_update_cs_tasks_updated_at
  BEFORE UPDATE ON tools_cs_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_cs_updated_at();

DROP TRIGGER IF EXISTS trigger_update_cs_completions_updated_at ON tools_cs_completions;
CREATE TRIGGER trigger_update_cs_completions_updated_at
  BEFORE UPDATE ON tools_cs_completions
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_cs_updated_at();

DROP TRIGGER IF EXISTS trigger_prevent_cs_default_category_delete ON tools_cs_categories;
CREATE TRIGGER trigger_prevent_cs_default_category_delete
  BEFORE DELETE ON tools_cs_categories
  FOR EACH ROW
  EXECUTE FUNCTION prevent_tools_cs_default_delete();

DROP TRIGGER IF EXISTS trigger_prevent_cs_default_item_delete ON tools_cs_items;
CREATE TRIGGER trigger_prevent_cs_default_item_delete
  BEFORE DELETE ON tools_cs_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_tools_cs_default_delete();

-- ============================================================================
-- ROW LEVEL SECURITY (optimized: (select auth.uid()))
-- ============================================================================
ALTER TABLE tools_cs_default_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_cs_default_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_cs_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_cs_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_cs_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_cs_completions ENABLE ROW LEVEL SECURITY;

-- Seed tables (read-only for authenticated users)
DROP POLICY IF EXISTS "cs: Anyone can view default categories" ON tools_cs_default_categories;
CREATE POLICY "cs: Anyone can view default categories" ON tools_cs_default_categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cs: Anyone can view default items" ON tools_cs_default_items;
CREATE POLICY "cs: Anyone can view default items" ON tools_cs_default_items
  FOR SELECT TO authenticated USING (true);

-- Categories
DROP POLICY IF EXISTS "cs: Users can view their own categories" ON tools_cs_categories;
CREATE POLICY "cs: Users can view their own categories" ON tools_cs_categories
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "cs: Users can insert their own categories" ON tools_cs_categories;
CREATE POLICY "cs: Users can insert their own categories" ON tools_cs_categories
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "cs: Users can update their own categories" ON tools_cs_categories;
CREATE POLICY "cs: Users can update their own categories" ON tools_cs_categories
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "cs: Users can delete their own categories" ON tools_cs_categories;
CREATE POLICY "cs: Users can delete their own categories" ON tools_cs_categories
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Items
DROP POLICY IF EXISTS "cs: Users can view their own items" ON tools_cs_items;
CREATE POLICY "cs: Users can view their own items" ON tools_cs_items
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "cs: Users can insert their own items" ON tools_cs_items;
CREATE POLICY "cs: Users can insert their own items" ON tools_cs_items
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "cs: Users can update their own items" ON tools_cs_items;
CREATE POLICY "cs: Users can update their own items" ON tools_cs_items
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "cs: Users can delete their own items" ON tools_cs_items;
CREATE POLICY "cs: Users can delete their own items" ON tools_cs_items
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Tasks
DROP POLICY IF EXISTS "cs: Users can view their own tasks" ON tools_cs_tasks;
CREATE POLICY "cs: Users can view their own tasks" ON tools_cs_tasks
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "cs: Users can insert their own tasks" ON tools_cs_tasks;
CREATE POLICY "cs: Users can insert their own tasks" ON tools_cs_tasks
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "cs: Users can update their own tasks" ON tools_cs_tasks;
CREATE POLICY "cs: Users can update their own tasks" ON tools_cs_tasks
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "cs: Users can delete their own tasks" ON tools_cs_tasks;
CREATE POLICY "cs: Users can delete their own tasks" ON tools_cs_tasks
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Completions
DROP POLICY IF EXISTS "cs: Users can view their own completions" ON tools_cs_completions;
CREATE POLICY "cs: Users can view their own completions" ON tools_cs_completions
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "cs: Users can insert their own completions" ON tools_cs_completions;
CREATE POLICY "cs: Users can insert their own completions" ON tools_cs_completions
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "cs: Users can update their own completions" ON tools_cs_completions;
CREATE POLICY "cs: Users can update their own completions" ON tools_cs_completions
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "cs: Users can delete their own completions" ON tools_cs_completions;
CREATE POLICY "cs: Users can delete their own completions" ON tools_cs_completions
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- ============================================================================
-- SEED DEFAULT CATEGORIES (A–Z, matches Library sidebar)
-- ============================================================================
INSERT INTO tools_cs_default_categories (name, display_order) VALUES
  ('Appliances', 0),
  ('Bathrooms', 1),
  ('Bedrooms', 2),
  ('Floors', 3),
  ('General Household', 4),
  ('Kitchen', 5),
  ('Laundry', 6),
  ('Living Areas', 7),
  ('Outdoor / Garage', 8),
  ('Windows', 9)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SEED DEFAULT LIBRARY ITEMS
-- ============================================================================
INSERT INTO tools_cs_default_items (source_key, name, category_name, description, display_order) VALUES
  ('clean-dishwasher', 'Clean dishwasher', 'Appliances', 'Wipe the door seal and run a cleaner cycle as needed.', 0),
  ('clean-microwave', 'Clean microwave', 'Appliances', 'Wipe interior, turntable, and the outside handle.', 1),
  ('clean-oven', 'Clean oven', 'Appliances', 'Wipe spills and clean the door glass.', 2),
  ('clean-refrigerator', 'Clean refrigerator', 'Appliances', 'Clear expired food and wipe shelves and handles.', 3),
  ('clean-bathroom-sinks', 'Clean bathroom sinks', 'Bathrooms', 'Wipe basins, faucets, and counters.', 4),
  ('clean-mirrors', 'Clean mirrors', 'Bathrooms', 'Wipe glass and frames until streak-free.', 5),
  ('clean-shower-tub', 'Clean shower/tub', 'Bathrooms', 'Scrub walls, tub, and fixtures.', 6),
  ('clean-toilets', 'Clean toilets', 'Bathrooms', 'Scrub the bowl and wipe the seat and handle.', 7),
  ('change-bed-sheets', 'Change bed sheets', 'Bedrooms', 'Strip beds and remake with clean linens.', 8),
  ('vacuum-under-beds', 'Vacuum under beds', 'Bedrooms', 'Clear clutter and vacuum the floor underneath.', 9),
  ('deep-clean-carpets', 'Deep clean carpets', 'Floors', 'Spot-treat and vacuum or shampoo carpets.', 10),
  ('mop-hard-floors', 'Mop hard floors', 'Floors', 'Sweep first, then mop with the right cleaner.', 11),
  ('sweep-entryways', 'Sweep entryways', 'Floors', 'Sweep dirt from doors and high-traffic paths.', 12),
  ('vacuum-floors', 'Vacuum floors', 'Floors', 'Vacuum carpets and hard floors, including edges.', 13),
  ('clean-baseboards', 'Clean baseboards', 'General Household', 'Dust and wipe baseboards room by room.', 14),
  ('empty-trash-cans', 'Empty trash cans', 'General Household', 'Empty bins and replace liners.', 15),
  ('replace-clean-hvac-filter', 'Replace/clean HVAC filter', 'General Household', 'Swap or vacuum the return-air filter.', 16),
  ('wipe-doorknobs', 'Wipe doorknobs', 'General Household', 'Disinfect knobs, handles, and light switches.', 17),
  ('clean-kitchen-counters', 'Clean kitchen counters', 'Kitchen', 'Clear, wipe, and sanitize countertops.', 18),
  ('clean-stove-top', 'Clean stove top', 'Kitchen', 'Wipe burners, grates, and the surrounding surface.', 19),
  ('wipe-kitchen-cabinets', 'Wipe kitchen cabinets', 'Kitchen', 'Wipe fronts, handles, and the area above the stove.', 20),
  ('clean-dryer-lint-area', 'Clean dryer lint area', 'Laundry', 'Empty the lint trap and vacuum the housing.', 21),
  ('sort-laundry', 'Sort laundry', 'Laundry', 'Sort, start a load, and fold what is finished.', 22),
  ('dust-ceiling-fans', 'Dust ceiling fans', 'Living Areas', 'Dust blades and the motor housing.', 23),
  ('dust-furniture', 'Dust furniture', 'Living Areas', 'Dust tables, shelves, and decorative surfaces.', 24),
  ('vacuum-furniture', 'Vacuum furniture', 'Living Areas', 'Vacuum sofas, chairs, and cushions.', 25),
  ('clean-garage', 'Clean garage', 'Outdoor / Garage', 'Sweep the floor and straighten stored items.', 26),
  ('sweep-porch-patio', 'Sweep porch/patio', 'Outdoor / Garage', 'Sweep outdoor living spaces and steps.', 27),
  ('clean-window-sills', 'Clean window sills', 'Windows', 'Wipe sills and tracks of dust and debris.', 28),
  ('wash-windows', 'Wash windows', 'Windows', 'Wash interior glass and wipe the frames.', 29)
ON CONFLICT (source_key) DO NOTHING;
