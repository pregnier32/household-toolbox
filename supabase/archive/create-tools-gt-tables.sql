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
