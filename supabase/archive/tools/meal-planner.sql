-- Meal Planner — current schema
-- Safe to re-run. Creates anything missing. Does not delete user rows.
-- Includes tables, later columns, attachment tables, and storage policies for bucket "meal-planner".
-- Run in the Supabase SQL editor.

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
  FOR SELECT TO authenticated USING (public.can_access_user_data(user_id));
DROP POLICY IF EXISTS "Users can insert their own mp items" ON tools_mp_items;
CREATE POLICY "Users can insert their own mp items" ON tools_mp_items
  FOR INSERT TO authenticated WITH CHECK (public.can_access_user_data(user_id));
DROP POLICY IF EXISTS "Users can update their own mp items" ON tools_mp_items;
CREATE POLICY "Users can update their own mp items" ON tools_mp_items
  FOR UPDATE TO authenticated USING (public.can_access_user_data(user_id)) WITH CHECK (public.can_access_user_data(user_id));
DROP POLICY IF EXISTS "Users can delete their own mp items" ON tools_mp_items;
CREATE POLICY "Users can delete their own mp items" ON tools_mp_items
  FOR DELETE TO authenticated USING (public.can_access_user_data(user_id));

-- Meal types: user CRUD on own rows
DROP POLICY IF EXISTS "Users can view their own mp meal types" ON tools_mp_meal_types;
CREATE POLICY "Users can view their own mp meal types" ON tools_mp_meal_types
  FOR SELECT TO authenticated USING (public.can_access_user_data(user_id));
DROP POLICY IF EXISTS "Users can insert their own mp meal types" ON tools_mp_meal_types;
CREATE POLICY "Users can insert their own mp meal types" ON tools_mp_meal_types
  FOR INSERT TO authenticated WITH CHECK (public.can_access_user_data(user_id));
DROP POLICY IF EXISTS "Users can update their own mp meal types" ON tools_mp_meal_types;
CREATE POLICY "Users can update their own mp meal types" ON tools_mp_meal_types
  FOR UPDATE TO authenticated USING (public.can_access_user_data(user_id)) WITH CHECK (public.can_access_user_data(user_id));
DROP POLICY IF EXISTS "Users can delete their own mp meal types" ON tools_mp_meal_types;
CREATE POLICY "Users can delete their own mp meal types" ON tools_mp_meal_types
  FOR DELETE TO authenticated USING (public.can_access_user_data(user_id));

-- Meals: user CRUD on own rows
DROP POLICY IF EXISTS "Users can view their own mp meals" ON tools_mp_meals;
CREATE POLICY "Users can view their own mp meals" ON tools_mp_meals
  FOR SELECT TO authenticated USING (public.can_access_user_data(user_id));
DROP POLICY IF EXISTS "Users can insert their own mp meals" ON tools_mp_meals;
CREATE POLICY "Users can insert their own mp meals" ON tools_mp_meals
  FOR INSERT TO authenticated WITH CHECK (public.can_access_user_data(user_id));
DROP POLICY IF EXISTS "Users can update their own mp meals" ON tools_mp_meals;
CREATE POLICY "Users can update their own mp meals" ON tools_mp_meals
  FOR UPDATE TO authenticated USING (public.can_access_user_data(user_id)) WITH CHECK (public.can_access_user_data(user_id));
DROP POLICY IF EXISTS "Users can delete their own mp meals" ON tools_mp_meals;
CREATE POLICY "Users can delete their own mp meals" ON tools_mp_meals
  FOR DELETE TO authenticated USING (public.can_access_user_data(user_id));

-- Meal ingredients: access via meal ownership
DROP POLICY IF EXISTS "Users can view their own mp meal ingredients" ON tools_mp_meal_ingredients;
CREATE POLICY "Users can view their own mp meal ingredients" ON tools_mp_meal_ingredients
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_mp_meals m WHERE m.id = meal_id AND public.can_access_user_data(m.user_id)));
DROP POLICY IF EXISTS "Users can insert their own mp meal ingredients" ON tools_mp_meal_ingredients;
CREATE POLICY "Users can insert their own mp meal ingredients" ON tools_mp_meal_ingredients
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tools_mp_meals m WHERE m.id = meal_id AND public.can_access_user_data(m.user_id)));
DROP POLICY IF EXISTS "Users can update their own mp meal ingredients" ON tools_mp_meal_ingredients;
CREATE POLICY "Users can update their own mp meal ingredients" ON tools_mp_meal_ingredients
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_mp_meals m WHERE m.id = meal_id AND public.can_access_user_data(m.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM tools_mp_meals m WHERE m.id = meal_id AND public.can_access_user_data(m.user_id)));
DROP POLICY IF EXISTS "Users can delete their own mp meal ingredients" ON tools_mp_meal_ingredients;
CREATE POLICY "Users can delete their own mp meal ingredients" ON tools_mp_meal_ingredients
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_mp_meals m WHERE m.id = meal_id AND public.can_access_user_data(m.user_id)));

-- Plans: user CRUD on own rows
DROP POLICY IF EXISTS "Users can view their own mp plans" ON tools_mp_plans;
CREATE POLICY "Users can view their own mp plans" ON tools_mp_plans
  FOR SELECT TO authenticated USING (public.can_access_user_data(user_id));
DROP POLICY IF EXISTS "Users can insert their own mp plans" ON tools_mp_plans;
CREATE POLICY "Users can insert their own mp plans" ON tools_mp_plans
  FOR INSERT TO authenticated WITH CHECK (public.can_access_user_data(user_id));
DROP POLICY IF EXISTS "Users can update their own mp plans" ON tools_mp_plans;
CREATE POLICY "Users can update their own mp plans" ON tools_mp_plans
  FOR UPDATE TO authenticated USING (public.can_access_user_data(user_id)) WITH CHECK (public.can_access_user_data(user_id));
DROP POLICY IF EXISTS "Users can delete their own mp plans" ON tools_mp_plans;
CREATE POLICY "Users can delete their own mp plans" ON tools_mp_plans
  FOR DELETE TO authenticated USING (public.can_access_user_data(user_id));

-- Plan assignments: access via plan ownership
DROP POLICY IF EXISTS "Users can view their own mp plan assignments" ON tools_mp_plan_assignments;
CREATE POLICY "Users can view their own mp plan assignments" ON tools_mp_plan_assignments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_mp_plans p WHERE p.id = plan_id AND public.can_access_user_data(p.user_id)));
DROP POLICY IF EXISTS "Users can insert their own mp plan assignments" ON tools_mp_plan_assignments;
CREATE POLICY "Users can insert their own mp plan assignments" ON tools_mp_plan_assignments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tools_mp_plans p WHERE p.id = plan_id AND public.can_access_user_data(p.user_id)));
DROP POLICY IF EXISTS "Users can update their own mp plan assignments" ON tools_mp_plan_assignments;
CREATE POLICY "Users can update their own mp plan assignments" ON tools_mp_plan_assignments
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_mp_plans p WHERE p.id = plan_id AND public.can_access_user_data(p.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM tools_mp_plans p WHERE p.id = plan_id AND public.can_access_user_data(p.user_id)));
DROP POLICY IF EXISTS "Users can delete their own mp plan assignments" ON tools_mp_plan_assignments;
CREATE POLICY "Users can delete their own mp plan assignments" ON tools_mp_plan_assignments
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_mp_plans p WHERE p.id = plan_id AND public.can_access_user_data(p.user_id)));


-- Add is_active to tools_mp_meals for existing databases (run if table already existed without this column)
ALTER TABLE tools_mp_meals ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_mp_meals_is_active ON tools_mp_meals(is_active);


-- Recipe scale factor for Meal Planner grocery quantities.
-- Safe to rerun. Old meals without scale read as 1.

ALTER TABLE tools_mp_meals
  ADD COLUMN IF NOT EXISTS scale NUMERIC NOT NULL DEFAULT 1;


-- Named day slots for Meal Planner (Breakfast / Lunch / Dinner).
-- Safe to rerun. Legacy rows with NULL slot_key still read (single meal → Dinner).

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


-- Leftover / cook-once flag on Meal Planner day assignments.
-- Safe to rerun. Old rows without the flag still count as cook.

ALTER TABLE tools_mp_plan_assignments
  ADD COLUMN IF NOT EXISTS is_leftover BOOLEAN NOT NULL DEFAULT false;


-- Persist checked-off state for Meal Planner grocery modal lines (per plan).
-- Safe to rerun.

ALTER TABLE tools_mp_plans
  ADD COLUMN IF NOT EXISTS grocery_checked_item_ids UUID[] NOT NULL DEFAULT '{}';


-- Meal Planner attachments: multiple optional files per meal.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `meal-planner` storage bucket at
-- {userId}/{mealId}/{timestamp}-{filename}
--
-- Do not attach files to plans, plan assignments, items, meal types, or the
-- grocery modal. Plan assignments are deleted and re-inserted on every plan
-- save, so a day-slot file store would orphan or cascade-delete on Save.

CREATE TABLE IF NOT EXISTS tools_mp_meal_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES tools_mp_meals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_meal_attachments_meal_id ON tools_mp_meal_attachments(meal_id);
CREATE INDEX IF NOT EXISTS idx_mp_meal_attachments_user_id ON tools_mp_meal_attachments(user_id);

ALTER TABLE tools_mp_meal_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own meal planner attachments" ON tools_mp_meal_attachments;
CREATE POLICY "Users can view their own meal planner attachments" ON tools_mp_meal_attachments
  FOR SELECT
  TO authenticated
  USING (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can insert their own meal planner attachments" ON tools_mp_meal_attachments;
CREATE POLICY "Users can insert their own meal planner attachments" ON tools_mp_meal_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can update their own meal planner attachments" ON tools_mp_meal_attachments;
CREATE POLICY "Users can update their own meal planner attachments" ON tools_mp_meal_attachments
  FOR UPDATE
  TO authenticated
  USING (public.can_access_user_data(user_id))
  WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can delete their own meal planner attachments" ON tools_mp_meal_attachments;
CREATE POLICY "Users can delete their own meal planner attachments" ON tools_mp_meal_attachments
  FOR DELETE
  TO authenticated
  USING (public.can_access_user_data(user_id));


-- Storage policies for bucket "meal-planner".
-- Create that bucket in Supabase Storage if it does not exist yet.
DROP POLICY IF EXISTS "meal-planner: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "meal-planner: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "meal-planner: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "meal-planner: Users can delete their own files" ON storage.objects;

CREATE POLICY "meal-planner: Users can upload to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'meal-planner' AND
  public.can_access_storage_owner((storage.foldername(name))[1])
);

CREATE POLICY "meal-planner: Users can read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'meal-planner' AND
  public.can_access_storage_owner((storage.foldername(name))[1])
);

CREATE POLICY "meal-planner: Users can update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'meal-planner' AND
  public.can_access_storage_owner((storage.foldername(name))[1])
)
WITH CHECK (
  bucket_id = 'meal-planner' AND
  public.can_access_storage_owner((storage.foldername(name))[1])
);

CREATE POLICY "meal-planner: Users can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'meal-planner' AND
  public.can_access_storage_owner((storage.foldername(name))[1])
);


NOTIFY pgrst, 'reload schema';
