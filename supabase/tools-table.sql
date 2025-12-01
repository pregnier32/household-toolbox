-- Create tools table to store the list of apps/tools that users can sign up for
CREATE TABLE IF NOT EXISTS tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tool_tip TEXT,
  description TEXT,
  price NUMERIC(10, 2) DEFAULT 0.00 NOT NULL CHECK (price >= 0),
  status TEXT NOT NULL DEFAULT 'coming_soon' CHECK (status IN ('coming_soon', 'available', 'active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(name);

-- Create index on status for filtering tools by status
CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_tools_created_at ON tools(created_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_tools_updated_at
  BEFORE UPDATE ON tools
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_updated_at();

-- Enable Row Level Security
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read tools
-- Tools are public information, but we'll restrict writes to service role
CREATE POLICY "Authenticated users can read tools" ON tools
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy to allow service role (server-side) to manage tools
-- This ensures tools can only be created/updated from server-side code
CREATE POLICY "Service role can manage tools" ON tools
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Note: Tools should be managed via server-side code using the service role key
-- Users can view available tools, but only admins/service role can create/update them

