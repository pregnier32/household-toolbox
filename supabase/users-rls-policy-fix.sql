-- First, drop the existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public user registration" ON users;

-- Enable Row Level Security on users table (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow public inserts for user registration
-- This allows anonymous users to create accounts
CREATE POLICY "Allow public user registration" ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Verify the policy was created
-- You can check this in Supabase Dashboard under Authentication > Policies

