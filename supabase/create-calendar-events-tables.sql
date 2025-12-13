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
