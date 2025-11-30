-- Create settings table to store application settings like email templates
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on key for faster lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Enable Row Level Security
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow only service role (server-side) to read/write settings
-- This ensures settings can only be accessed from server-side code
CREATE POLICY "Service role can manage settings" ON settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Note: Settings should only be accessed via server-side code using the service role key
-- The API routes in app/api/admin/* handle authentication and authorization

