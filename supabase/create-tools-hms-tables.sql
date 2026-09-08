-- Home Maintenance Schedule Tool Database Schema
-- All tables prefixed with 'tools_hms_'
-- Matches UI: HomeMaintenanceScheduleTool (Schedule, Library, Categories, Export).
--
-- Table layout:
--   Global seed (read-only, copied on first API load):
--     tools_hms_default_categories
--     tools_hms_default_items
--   Per-user working data:
--     tools_hms_categories   — default + custom categories (is_default cannot be deleted)
--     tools_hms_items        — library templates (defaults may be hidden; custom may be deleted)
--     tools_hms_tasks        — one schedule definition per library item + next_due_date
--     tools_hms_completions  — one row per completed occurrence (optional notes + cost)
--
-- Do NOT store expanded future occurrences. Expand on demand for the visible
-- date window (same architecture as Calendar Events / Cleaning Schedule).
-- Category icons may come later (nullable icon_key reserved).
--
-- Run in Supabase SQL Editor (idempotent: safe to re-run).
-- After deploy, register tool_id FK indexes in add-performance-indexes.sql
-- if you maintain that file. Account delete must unflag is_default then
-- delete items before categories (see lib/user-data-deletion.ts).

-- ============================================================================
-- DEFAULT CATEGORIES (global seed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hms_default_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  -- Reserved for a later icon pass; unused by the current UI.
  icon_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hms_default_categories_name
  ON tools_hms_default_categories(name);
CREATE INDEX IF NOT EXISTS idx_hms_default_categories_display_order
  ON tools_hms_default_categories(display_order);

-- ============================================================================
-- DEFAULT LIBRARY ITEMS (global seed — not scheduled)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hms_default_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL,
  name TEXT NOT NULL,
  category_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  default_location TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hms_default_items_source_key
  ON tools_hms_default_items(source_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hms_default_items_category_name
  ON tools_hms_default_items(category_name, name);
CREATE INDEX IF NOT EXISTS idx_hms_default_items_category_name_lookup
  ON tools_hms_default_items(category_name);
CREATE INDEX IF NOT EXISTS idx_hms_default_items_display_order
  ON tools_hms_default_items(display_order);

-- ============================================================================
-- CATEGORIES (per user + tool)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hms_categories (
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

CREATE INDEX IF NOT EXISTS idx_hms_categories_user_id ON tools_hms_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_hms_categories_tool_id ON tools_hms_categories(tool_id);
CREATE INDEX IF NOT EXISTS idx_hms_categories_user_tool ON tools_hms_categories(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_hms_categories_is_default ON tools_hms_categories(is_default);
CREATE INDEX IF NOT EXISTS idx_hms_categories_name ON tools_hms_categories(name);

-- ============================================================================
-- LIBRARY ITEMS (per user + tool)
-- Defaults are templates: not scheduled until the user activates them.
-- Hide defaults with is_hidden; never hard-delete is_default rows.
-- Editing a default's name/notes/category updates this local copy.
-- The seeded description stays on the default catalog / this row's description;
-- activated schedules override description on tools_hms_tasks.description_override.
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hms_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES tools_hms_categories(id) ON DELETE RESTRICT,

  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  default_location TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  -- Stable key from tools_hms_default_items.source_key so later catalog
  -- additions can be copied without duplicating existing defaults.
  source_key TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_items_user_id ON tools_hms_items(user_id);
CREATE INDEX IF NOT EXISTS idx_hms_items_tool_id ON tools_hms_items(tool_id);
CREATE INDEX IF NOT EXISTS idx_hms_items_user_tool ON tools_hms_items(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_hms_items_category_id ON tools_hms_items(category_id);
CREATE INDEX IF NOT EXISTS idx_hms_items_is_default ON tools_hms_items(is_default);
CREATE INDEX IF NOT EXISTS idx_hms_items_is_hidden ON tools_hms_items(is_hidden);
CREATE INDEX IF NOT EXISTS idx_hms_items_user_tool_category
  ON tools_hms_items(user_id, tool_id, category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hms_items_user_tool_source_key
  ON tools_hms_items(user_id, tool_id, source_key)
  WHERE source_key IS NOT NULL;

-- ============================================================================
-- SCHEDULED TASKS (one definition per library item)
-- History = is_active false. Reactivate the same row; do not insert a second.
-- Service provider is home-specific (on the schedule, not the template).
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hms_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES tools_hms_items(id) ON DELETE CASCADE,

  frequency TEXT NOT NULL CHECK (frequency IN (
    'every_x_days',
    'weekly',
    'every_x_weeks',
    'monthly',
    'every_x_months',
    'quarterly',
    'every_6_months',
    'annually',
    'every_x_years',
    'specific_months',
    'custom'
  )),
  interval_count INTEGER CHECK (interval_count IS NULL OR interval_count >= 1),
  interval_unit TEXT CHECK (interval_unit IS NULL OR interval_unit IN ('days', 'weeks', 'months', 'years')),
  days_of_week JSONB,
  day_of_month INTEGER CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)),
  -- specific_months: JSON array of month numbers 1–12, e.g. [4, 10]
  months JSONB,
  -- specific_months: repeat every X years (default 1)
  interval_years INTEGER CHECK (interval_years IS NULL OR interval_years >= 1),

  next_due_date DATE NOT NULL,
  last_completed_date DATE,

  location TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  description_override TEXT NOT NULL DEFAULT '',

  provider_name TEXT NOT NULL DEFAULT '',
  provider_phone TEXT NOT NULL DEFAULT '',
  provider_website TEXT NOT NULL DEFAULT '',
  provider_notes TEXT NOT NULL DEFAULT '',

  is_active BOOLEAN NOT NULL DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  UNIQUE (item_id)
);

CREATE INDEX IF NOT EXISTS idx_hms_tasks_user_id ON tools_hms_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_hms_tasks_tool_id ON tools_hms_tasks(tool_id);
CREATE INDEX IF NOT EXISTS idx_hms_tasks_user_tool ON tools_hms_tasks(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_hms_tasks_user_tool_active ON tools_hms_tasks(user_id, tool_id, is_active);
CREATE INDEX IF NOT EXISTS idx_hms_tasks_item_id ON tools_hms_tasks(item_id);
CREATE INDEX IF NOT EXISTS idx_hms_tasks_is_active ON tools_hms_tasks(is_active);
CREATE INDEX IF NOT EXISTS idx_hms_tasks_next_due_date ON tools_hms_tasks(next_due_date);
CREATE INDEX IF NOT EXISTS idx_hms_tasks_frequency ON tools_hms_tasks(frequency);
CREATE INDEX IF NOT EXISTS idx_hms_tasks_days_of_week
  ON tools_hms_tasks USING GIN (days_of_week)
  WHERE days_of_week IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hms_tasks_months
  ON tools_hms_tasks USING GIN (months)
  WHERE months IS NOT NULL;

-- ============================================================================
-- COMPLETIONS (history of finished occurrences)
-- cost is optional; NULL means unused (UI shows "—" not $0.00).
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hms_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tools_hms_tasks(id) ON DELETE CASCADE,

  scheduled_date DATE NOT NULL,
  completed_date DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  cost NUMERIC(12, 2) CHECK (cost IS NULL OR cost >= 0),
  lateness TEXT NOT NULL CHECK (lateness IN ('Early', 'On time', 'Late')),

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_completions_user_id ON tools_hms_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_hms_completions_tool_id ON tools_hms_completions(tool_id);
CREATE INDEX IF NOT EXISTS idx_hms_completions_user_tool ON tools_hms_completions(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_hms_completions_task_id ON tools_hms_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_hms_completions_completed_date
  ON tools_hms_completions(completed_date DESC);
CREATE INDEX IF NOT EXISTS idx_hms_completions_scheduled_date
  ON tools_hms_completions(scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_hms_completions_user_tool_completed_year
  ON tools_hms_completions(user_id, tool_id, completed_date DESC);

-- ============================================================================
-- UPDATED_AT + DEFAULT-PROTECTION TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_tools_hms_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_tools_hms_default_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF OLD.is_default THEN
    RAISE EXCEPTION 'Default Home Maintenance Schedule records cannot be permanently deleted';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_hms_default_categories_updated_at ON tools_hms_default_categories;
CREATE TRIGGER trigger_update_hms_default_categories_updated_at
  BEFORE UPDATE ON tools_hms_default_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_hms_updated_at();

DROP TRIGGER IF EXISTS trigger_update_hms_default_items_updated_at ON tools_hms_default_items;
CREATE TRIGGER trigger_update_hms_default_items_updated_at
  BEFORE UPDATE ON tools_hms_default_items
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_hms_updated_at();

DROP TRIGGER IF EXISTS trigger_update_hms_categories_updated_at ON tools_hms_categories;
CREATE TRIGGER trigger_update_hms_categories_updated_at
  BEFORE UPDATE ON tools_hms_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_hms_updated_at();

DROP TRIGGER IF EXISTS trigger_update_hms_items_updated_at ON tools_hms_items;
CREATE TRIGGER trigger_update_hms_items_updated_at
  BEFORE UPDATE ON tools_hms_items
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_hms_updated_at();

DROP TRIGGER IF EXISTS trigger_update_hms_tasks_updated_at ON tools_hms_tasks;
CREATE TRIGGER trigger_update_hms_tasks_updated_at
  BEFORE UPDATE ON tools_hms_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_hms_updated_at();

DROP TRIGGER IF EXISTS trigger_update_hms_completions_updated_at ON tools_hms_completions;
CREATE TRIGGER trigger_update_hms_completions_updated_at
  BEFORE UPDATE ON tools_hms_completions
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_hms_updated_at();

DROP TRIGGER IF EXISTS trigger_prevent_hms_default_category_delete ON tools_hms_categories;
CREATE TRIGGER trigger_prevent_hms_default_category_delete
  BEFORE DELETE ON tools_hms_categories
  FOR EACH ROW
  EXECUTE FUNCTION prevent_tools_hms_default_delete();

DROP TRIGGER IF EXISTS trigger_prevent_hms_default_item_delete ON tools_hms_items;
CREATE TRIGGER trigger_prevent_hms_default_item_delete
  BEFORE DELETE ON tools_hms_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_tools_hms_default_delete();

-- ============================================================================
-- ROW LEVEL SECURITY (optimized: (select auth.uid()))
-- ============================================================================
ALTER TABLE tools_hms_default_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_hms_default_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_hms_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_hms_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_hms_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_hms_completions ENABLE ROW LEVEL SECURITY;

-- Seed tables (read-only for authenticated users)
DROP POLICY IF EXISTS "hms: Anyone can view default categories" ON tools_hms_default_categories;
CREATE POLICY "hms: Anyone can view default categories" ON tools_hms_default_categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "hms: Anyone can view default items" ON tools_hms_default_items;
CREATE POLICY "hms: Anyone can view default items" ON tools_hms_default_items
  FOR SELECT TO authenticated USING (true);

-- Categories
DROP POLICY IF EXISTS "hms: Users can view their own categories" ON tools_hms_categories;
CREATE POLICY "hms: Users can view their own categories" ON tools_hms_categories
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hms: Users can insert their own categories" ON tools_hms_categories;
CREATE POLICY "hms: Users can insert their own categories" ON tools_hms_categories
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hms: Users can update their own categories" ON tools_hms_categories;
CREATE POLICY "hms: Users can update their own categories" ON tools_hms_categories
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hms: Users can delete their own categories" ON tools_hms_categories;
CREATE POLICY "hms: Users can delete their own categories" ON tools_hms_categories
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Items
DROP POLICY IF EXISTS "hms: Users can view their own items" ON tools_hms_items;
CREATE POLICY "hms: Users can view their own items" ON tools_hms_items
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hms: Users can insert their own items" ON tools_hms_items;
CREATE POLICY "hms: Users can insert their own items" ON tools_hms_items
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hms: Users can update their own items" ON tools_hms_items;
CREATE POLICY "hms: Users can update their own items" ON tools_hms_items
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hms: Users can delete their own items" ON tools_hms_items;
CREATE POLICY "hms: Users can delete their own items" ON tools_hms_items
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Tasks
DROP POLICY IF EXISTS "hms: Users can view their own tasks" ON tools_hms_tasks;
CREATE POLICY "hms: Users can view their own tasks" ON tools_hms_tasks
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hms: Users can insert their own tasks" ON tools_hms_tasks;
CREATE POLICY "hms: Users can insert their own tasks" ON tools_hms_tasks
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hms: Users can update their own tasks" ON tools_hms_tasks;
CREATE POLICY "hms: Users can update their own tasks" ON tools_hms_tasks
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hms: Users can delete their own tasks" ON tools_hms_tasks;
CREATE POLICY "hms: Users can delete their own tasks" ON tools_hms_tasks
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Completions
DROP POLICY IF EXISTS "hms: Users can view their own completions" ON tools_hms_completions;
CREATE POLICY "hms: Users can view their own completions" ON tools_hms_completions
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hms: Users can insert their own completions" ON tools_hms_completions;
CREATE POLICY "hms: Users can insert their own completions" ON tools_hms_completions
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hms: Users can update their own completions" ON tools_hms_completions;
CREATE POLICY "hms: Users can update their own completions" ON tools_hms_completions
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "hms: Users can delete their own completions" ON tools_hms_completions;
CREATE POLICY "hms: Users can delete their own completions" ON tools_hms_completions
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- ============================================================================
-- SEED DEFAULT CATEGORIES (A–Z, matches Library sidebar)
-- ============================================================================
INSERT INTO tools_hms_default_categories (name, display_order) VALUES
  ('Appliances', 0),
  ('Electrical', 1),
  ('Exterior', 2),
  ('Garage', 3),
  ('Heating & Cooling', 4),
  ('Lawn & Yard', 5),
  ('Other', 6),
  ('Plumbing', 7),
  ('Roof & Gutters', 8),
  ('Safety', 9),
  ('Seasonal', 10),
  ('Water Systems', 11)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SEED DEFAULT LIBRARY ITEMS
-- ============================================================================
INSERT INTO tools_hms_default_items (source_key, name, category_name, description, display_order) VALUES
  ('replace-furnace-hvac-filter', 'Replace furnace/HVAC filter', 'Heating & Cooling', 'Swap the furnace or HVAC filter for a new one.', 0),
  ('schedule-furnace-inspection-service', 'Schedule furnace inspection/service', 'Heating & Cooling', 'Book annual furnace inspection or service.', 1),
  ('schedule-air-conditioner-inspection-service', 'Schedule air-conditioner inspection/service', 'Heating & Cooling', 'Book seasonal AC inspection or service.', 2),
  ('clean-outdoor-ac-condenser', 'Clean outdoor AC condenser', 'Heating & Cooling', 'Clear debris from the outdoor condenser coils.', 3),
  ('clean-vents-and-registers', 'Clean vents and registers', 'Heating & Cooling', 'Vacuum and wipe supply vents and return registers.', 4),
  ('inspect-clean-air-exchanger-or-hrv', 'Inspect/clean air exchanger or HRV', 'Heating & Cooling', 'Check and clean the HRV or air exchanger.', 5),
  ('replace-humidifier-filter-pad', 'Replace humidifier filter/pad', 'Heating & Cooling', 'Install a new humidifier filter or pad.', 6),
  ('inspect-thermostat-batteries', 'Inspect thermostat batteries', 'Heating & Cooling', 'Check thermostat batteries and replace if needed.', 7),
  ('schedule-chimney-inspection-cleaning', 'Schedule chimney inspection/cleaning', 'Heating & Cooling', 'Book chimney inspection and cleaning.', 8),
  ('flush-water-heater', 'Flush water heater', 'Plumbing', 'Drain and flush sediment from the water heater.', 9),
  ('inspect-water-heater', 'Inspect water heater', 'Plumbing', 'Check the water heater for leaks, rust, and settings.', 10),
  ('inspect-under-sinks-for-leaks', 'Inspect under sinks for leaks', 'Plumbing', 'Look under sinks for drips or moisture.', 11),
  ('inspect-toilets-for-leaks', 'Inspect toilets for leaks', 'Plumbing', 'Check toilets for running water or base leaks.', 12),
  ('inspect-exposed-plumbing-for-leaks', 'Inspect exposed plumbing for leaks', 'Plumbing', 'Scan visible pipes for drips or corrosion.', 13),
  ('winterize-outdoor-faucets', 'Winterize outdoor faucets', 'Plumbing', 'Shut off and drain outdoor faucets before freeze.', 14),
  ('turn-outdoor-water-back-on', 'Turn outdoor water back on', 'Plumbing', 'Restore outdoor water and check for leaks.', 15),
  ('replace-water-softener-salt', 'Replace water softener salt', 'Water Systems', 'Refill the water softener with salt.', 16),
  ('clean-inspect-water-softener', 'Clean/inspect water softener', 'Water Systems', 'Clean and inspect the water softener system.', 17),
  ('replace-whole-house-water-filter', 'Replace whole-house water filter', 'Water Systems', 'Swap the whole-house water filter cartridge.', 18),
  ('replace-refrigerator-water-filter', 'Replace refrigerator water filter', 'Water Systems', 'Install a new refrigerator water filter.', 19),
  ('test-sump-pump', 'Test sump pump', 'Water Systems', 'Pour water into the pit to confirm the pump runs.', 20),
  ('clean-sump-pump-pit', 'Clean sump pump pit', 'Water Systems', 'Remove debris from the sump pump pit.', 21),
  ('inspect-electrical-panel', 'Inspect electrical panel', 'Electrical', 'Check the panel for tripped breakers and scorch marks.', 22),
  ('inspect-outdoor-outlets-and-covers', 'Inspect outdoor outlets and covers', 'Electrical', 'Check outdoor outlets and weather covers.', 23),
  ('test-backup-generator', 'Test backup generator', 'Electrical', 'Run the backup generator and check fuel.', 24),
  ('clean-refrigerator-coils', 'Clean refrigerator coils', 'Appliances', 'Vacuum dust from refrigerator condenser coils.', 25),
  ('clean-range-hood-filter', 'Clean range hood filter', 'Appliances', 'Wash or replace the range hood filter.', 26),
  ('inspect-dishwasher', 'Inspect dishwasher', 'Appliances', 'Check the dishwasher for leaks and spray-arm clogs.', 27),
  ('inspect-garbage-disposal', 'Inspect garbage disposal', 'Appliances', 'Run and check the disposal for leaks or jams.', 28),
  ('clean-dryer-lint-trap', 'Clean dryer lint trap', 'Appliances', 'Clean the dryer lint trap and housing.', 29),
  ('test-smoke-detectors', 'Test smoke detectors', 'Safety', 'Press the test button on each smoke detector.', 30),
  ('test-carbon-monoxide-detectors', 'Test carbon monoxide detectors', 'Safety', 'Test each carbon monoxide detector.', 31),
  ('replace-smoke-detector-batteries', 'Replace smoke detector batteries', 'Safety', 'Install fresh smoke detector batteries.', 32),
  ('replace-co-detector-batteries', 'Replace CO detector batteries', 'Safety', 'Install fresh carbon monoxide detector batteries.', 33),
  ('check-fire-extinguishers', 'Check fire extinguishers', 'Safety', 'Confirm extinguishers are charged and accessible.', 34),
  ('test-gfci-outlets', 'Test GFCI outlets', 'Safety', 'Test and reset GFCI outlets.', 35),
  ('test-sump-pump-backup-battery', 'Test sump pump backup/battery', 'Safety', 'Test the backup sump pump or battery pack.', 36),
  ('inspect-dryer-vent', 'Inspect dryer vent', 'Safety', 'Check the dryer vent for lint buildup.', 37),
  ('clean-dryer-exhaust-duct', 'Clean dryer exhaust duct', 'Safety', 'Clean the dryer exhaust duct to the exterior.', 38),
  ('check-emergency-supplies', 'Check emergency supplies', 'Safety', 'Review flashlights, water, and the emergency kit.', 39),
  ('inspect-siding', 'Inspect siding', 'Exterior', 'Walk the house and check siding for damage.', 40),
  ('inspect-exterior-caulking', 'Inspect exterior caulking', 'Exterior', 'Check caulk at windows, doors, and trim.', 41),
  ('inspect-windows-and-doors', 'Inspect windows and doors', 'Exterior', 'Check seals, locks, and operation.', 42),
  ('inspect-foundation-for-cracks', 'Inspect foundation for cracks', 'Exterior', 'Look for new or widening foundation cracks.', 43),
  ('pressure-wash-siding', 'Pressure wash siding', 'Exterior', 'Pressure wash siding and rinse thoroughly.', 44),
  ('wash-exterior-windows', 'Wash exterior windows', 'Exterior', 'Wash exterior window glass and frames.', 45),
  ('inspect-deck', 'Inspect deck', 'Exterior', 'Check deck boards, rails, and fasteners.', 46),
  ('clean-seal-deck', 'Clean/seal deck', 'Exterior', 'Clean the deck and apply sealer if needed.', 47),
  ('inspect-driveway', 'Inspect driveway', 'Exterior', 'Check the driveway for cracks and settling.', 48),
  ('seal-driveway', 'Seal driveway', 'Exterior', 'Clean and seal the driveway.', 49),
  ('inspect-exterior-lighting', 'Inspect exterior lighting', 'Exterior', 'Test outdoor lights and replace bulbs.', 50),
  ('touch-up-exterior-paint', 'Touch up exterior paint', 'Exterior', 'Touch up peeling or faded exterior paint.', 51),
  ('inspect-roof', 'Inspect roof', 'Roof & Gutters', 'Check shingles, flashing, and signs of wear.', 52),
  ('clean-gutters', 'Clean gutters', 'Roof & Gutters', 'Clear leaves and debris from gutters.', 53),
  ('inspect-downspouts', 'Inspect downspouts', 'Roof & Gutters', 'Confirm downspouts are clear and directed away.', 54),
  ('inspect-garage-door-and-opener', 'Inspect garage door and opener', 'Garage', 'Test the door, opener, and auto-reverse.', 55),
  ('lubricate-garage-door-hardware', 'Lubricate garage door hardware', 'Garage', 'Lubricate rollers, hinges, and tracks.', 56),
  ('inspect-garage-door-weather-sealing', 'Inspect garage door weather sealing', 'Garage', 'Check the bottom seal and side weatherstrip.', 57),
  ('spring-lawn-fertilizer', 'Spring lawn fertilizer', 'Lawn & Yard', 'Apply spring lawn fertilizer.', 58),
  ('summer-lawn-fertilizer', 'Summer lawn fertilizer', 'Lawn & Yard', 'Apply summer lawn fertilizer.', 59),
  ('fall-lawn-fertilizer', 'Fall lawn fertilizer', 'Lawn & Yard', 'Apply fall lawn fertilizer.', 60),
  ('apply-weed-control', 'Apply weed control', 'Lawn & Yard', 'Treat lawn weeds as directed.', 61),
  ('aerate-lawn', 'Aerate lawn', 'Lawn & Yard', 'Aerate compacted lawn areas.', 62),
  ('overseed-lawn', 'Overseed lawn', 'Lawn & Yard', 'Overseed thin or bare lawn areas.', 63),
  ('inspect-sprinkler-irrigation-system', 'Inspect sprinkler/irrigation system', 'Lawn & Yard', 'Check heads, coverage, and leaks.', 64),
  ('winterize-sprinkler-system', 'Winterize sprinkler system', 'Lawn & Yard', 'Blow out and shut down the sprinkler system.', 65),
  ('start-sprinkler-system-in-spring', 'Start sprinkler system in spring', 'Lawn & Yard', 'Restart and adjust the sprinkler system.', 66),
  ('trim-trees', 'Trim trees', 'Lawn & Yard', 'Trim trees away from the house and walkways.', 67),
  ('trim-shrubs', 'Trim shrubs', 'Lawn & Yard', 'Shape and trim shrubs.', 68),
  ('inspect-trees-for-dead-damaged-branches', 'Inspect trees for dead/damaged branches', 'Lawn & Yard', 'Look for dead or hanging branches.', 69),
  ('clean-landscaping-beds', 'Clean landscaping beds', 'Lawn & Yard', 'Weed and tidy landscaping beds.', 70),
  ('fall-leaf-cleanup', 'Fall leaf cleanup', 'Lawn & Yard', 'Rake and remove fallen leaves.', 71),
  ('prepare-home-for-winter', 'Prepare home for winter', 'Seasonal', 'Walk through winter prep for pipes, heat, and drafts.', 72),
  ('prepare-home-for-spring', 'Prepare home for spring', 'Seasonal', 'Walk through spring prep for exterior and systems.', 73),
  ('remove-store-garden-hoses', 'Remove/store garden hoses', 'Seasonal', 'Drain and store garden hoses.', 74),
  ('install-remove-window-screens', 'Install/remove window screens', 'Seasonal', 'Put up or take down window screens.', 75),
  ('inspect-snowblower-before-winter', 'Inspect snowblower before winter', 'Seasonal', 'Service the snowblower before first snow.', 76),
  ('inspect-lawn-mower-before-spring', 'Inspect lawn mower before spring', 'Seasonal', 'Service the mower before mowing season.', 77),
  ('clean-store-lawn-mower', 'Clean/store lawn mower', 'Seasonal', 'Clean and store the mower for the off-season.', 78),
  ('clean-store-patio-furniture', 'Clean/store patio furniture', 'Seasonal', 'Clean and store patio furniture.', 79),
  ('prepare-grill-for-winter-storage', 'Prepare grill for winter/storage', 'Seasonal', 'Clean and cover or store the grill.', 80),
  ('inspect-weather-stripping', 'Inspect weather stripping', 'Seasonal', 'Check door and window weather stripping.', 81),
  ('check-exterior-drainage-before-spring-thaw', 'Check exterior drainage before spring thaw', 'Seasonal', 'Confirm downspouts and grading drain away.', 82),
  ('inspect-home-after-winter', 'Inspect home after winter', 'Seasonal', 'Walk the house for winter damage.', 83),
  ('inspect-attic', 'Inspect attic', 'Other', 'Check the attic for leaks, pests, and insulation gaps.', 84),
  ('inspect-crawlspace', 'Inspect crawlspace', 'Other', 'Check the crawlspace for moisture and pests.', 85),
  ('inspect-basement-for-moisture', 'Inspect basement for moisture', 'Other', 'Look for damp spots, odors, or standing water.', 86)
ON CONFLICT (source_key) DO NOTHING;
