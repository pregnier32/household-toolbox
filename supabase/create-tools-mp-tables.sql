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
