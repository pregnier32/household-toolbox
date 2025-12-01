-- Create tool_icons table to store different icons for each tool based on status
-- Each tool can have 3 different icons: coming_soon, available, and active
-- 
-- Two storage options:
-- 1. icon_url: Store file path/URL (recommended - use with Supabase Storage)
-- 2. icon_data: Store binary .jpg file data directly in database (BYTEA)
-- At least one must be provided (enforced by check constraint)
CREATE TABLE IF NOT EXISTS tool_icons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  icon_type TEXT NOT NULL CHECK (icon_type IN ('coming_soon', 'available', 'active')),
  icon_url TEXT,
  icon_data BYTEA,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure each tool can only have one icon per type
  UNIQUE(tool_id, icon_type),
  -- Ensure at least one storage method is provided
  CHECK (icon_url IS NOT NULL OR icon_data IS NOT NULL)
);

-- Create index on tool_id for faster lookups when fetching icons for a tool
CREATE INDEX IF NOT EXISTS idx_tool_icons_tool_id ON tool_icons(tool_id);

-- Create index on icon_type for filtering by icon type
CREATE INDEX IF NOT EXISTS idx_tool_icons_icon_type ON tool_icons(icon_type);

-- Create composite index for common query pattern: get icon for a specific tool and type
CREATE INDEX IF NOT EXISTS idx_tool_icons_tool_id_type ON tool_icons(tool_id, icon_type);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_tool_icons_created_at ON tool_icons(created_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tool_icons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_tool_icons_updated_at
  BEFORE UPDATE ON tool_icons
  FOR EACH ROW
  EXECUTE FUNCTION update_tool_icons_updated_at();

-- Enable Row Level Security
ALTER TABLE tool_icons ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read tool icons
-- Icons are public information, but we'll restrict writes to service role
CREATE POLICY "Authenticated users can read tool icons" ON tool_icons
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy to allow service role (server-side) to manage tool icons
-- This ensures icons can only be created/updated from server-side code
CREATE POLICY "Service role can manage tool icons" ON tool_icons
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Note: Tool icons should be managed via server-side code using the service role key
-- Users can view tool icons, but only admins/service role can create/update them
--
-- STORAGE OPTIONS:
-- 
-- Option 1 (RECOMMENDED): Use Supabase Storage + icon_url
--   - Upload .jpg files to Supabase Storage bucket (e.g., 'tool-icons')
--   - Store the public URL or storage path in icon_url column
--   - Benefits: Better performance, easier CDN integration, smaller database
--   - Example: icon_url = 'https://your-project.supabase.co/storage/v1/object/public/tool-icons/tool-1-coming-soon.jpg'
--
-- Option 2: Store binary data directly in database (icon_data)
--   - Store the actual .jpg file bytes in the icon_data BYTEA column
--   - Benefits: Everything in one place, no external storage needed
--   - Drawbacks: Larger database, slower queries, harder to serve via CDN
--   - Use this only if you have a specific requirement to store files in the database

