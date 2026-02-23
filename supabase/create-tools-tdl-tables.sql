-- To Do List Tool Database Schema
-- All tables prefixed with 'tools_tdl_'
-- Matches UI: categories (e.g. Home, Work, Kids, Errands), tasks per category.
-- RLS uses (select auth.uid()) per design_system.md.

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
-- UPDATED_AT TRIGGERS (with secure search_path per design_system.md)
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
