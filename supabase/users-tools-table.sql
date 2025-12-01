-- Create users_tools table to track which tools each user has selected as active
-- Each user can have multiple active tools, so each active tool will have its own record
CREATE TABLE IF NOT EXISTS users_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled', 'expired')),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  promo_code_id UUID REFERENCES promo_codes(id) ON DELETE SET NULL,
  promo_expiration_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure a user can only have one record per tool
  UNIQUE(user_id, tool_id)
);

-- Create index on user_id for faster lookups of user's tools
CREATE INDEX IF NOT EXISTS idx_users_tools_user_id ON users_tools(user_id);

-- Create index on tool_id for faster lookups of tool's users
CREATE INDEX IF NOT EXISTS idx_users_tools_tool_id ON users_tools(tool_id);

-- Create index on status for filtering active/inactive tools
CREATE INDEX IF NOT EXISTS idx_users_tools_status ON users_tools(status);

-- Create index on user_id and status for common query pattern (user's active tools)
CREATE INDEX IF NOT EXISTS idx_users_tools_user_status ON users_tools(user_id, status);

-- Create index on promo_code_id for lookups
CREATE INDEX IF NOT EXISTS idx_users_tools_promo_code_id ON users_tools(promo_code_id);

-- Create index on promo_expiration_date for filtering expired promos
CREATE INDEX IF NOT EXISTS idx_users_tools_promo_expiration ON users_tools(promo_expiration_date);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_users_tools_created_at ON users_tools(created_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_tools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_users_tools_updated_at
  BEFORE UPDATE ON users_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_users_tools_updated_at();

-- Enable Row Level Security
ALTER TABLE users_tools ENABLE ROW LEVEL SECURITY;

-- Create policy to allow only service role (server-side) to manage user tools
-- This ensures user tools can only be accessed from server-side code
-- Authorization logic (ensuring users can only access their own tools) is handled in application code
CREATE POLICY "Service role can manage user tools" ON users_tools
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Note: User tools should only be accessed via server-side code using the service role key
-- The application code will handle authorization to ensure users can only access/modify their own tool subscriptions

