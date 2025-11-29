-- Enable Row Level Security on users table (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow public inserts for user registration
-- This allows anonymous users to create accounts
CREATE POLICY "Allow public user registration" ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Optional: Create a policy to allow users to read their own data
-- This would require authentication, so we'll skip it for now
-- You can add this later when implementing sign-in functionality

