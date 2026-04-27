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
