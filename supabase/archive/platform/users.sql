-- Users, theme, and shared catalog trigger functions — current schema
-- Safe to re-run.
-- Client access to public.users is denied. The app writes users with the service role.
-- New accounts default to light mode. Existing rows keep the theme they already have.
-- Null theme values are backfilled to dark, which was the original default.

-- Users Table Improvements
-- This script adds indexes, constraints, and optimizations to the users table

-- ============================================================================
-- 1. ADD MISSING INDEXES (Critical for Performance)
-- ============================================================================

-- Index on email (most frequently queried field)
-- Used in: sign in, sign up, password reset, profile updates
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index on active status (used in filtering active users)
-- Used in: session validation, stats queries
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- Index on user_status (used in admin authorization checks)
-- Used in: admin route authorization
CREATE INDEX IF NOT EXISTS idx_users_user_status ON users(user_status);

-- Composite index for common query pattern: active users by status
CREATE INDEX IF NOT EXISTS idx_users_active_status ON users(active, user_status);

-- Index on created_at for sorting and analytics
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ============================================================================
-- 2. ADD UNIQUE CONSTRAINT ON EMAIL (Data Integrity)
-- ============================================================================

-- Add unique constraint on email if it doesn't exist
-- This ensures no duplicate emails can be inserted
-- Note: This will fail if duplicate emails already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_email_key' 
    AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;

-- ============================================================================
-- 3. ADD UPDATED_AT TIMESTAMP (Audit Trail)
-- ============================================================================

-- Add updated_at column if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON users;
CREATE TRIGGER trigger_update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_users_updated_at();

-- ============================================================================
-- 4. FIELD ANALYSIS & RECOMMENDATIONS
-- ============================================================================

-- NOTE: The following fields should be reviewed:

-- 1. 'user_id' field appears to be redundant with 'id'
--    - Both are UUIDs and 'user_id' is set to the same value as 'id' in signup
--    - Consider removing 'user_id' if it's not used elsewhere
--    - If you need to keep it, add a check constraint: CHECK (user_id = id)

-- 2. 'active' field is TEXT ('Y'/'N') but should ideally be BOOLEAN
--    - Current: active TEXT
--    - Recommended: active BOOLEAN DEFAULT TRUE
--    - Migration would require: UPDATE users SET active = (active = 'Y')::boolean;
--    - This is a breaking change, so only do if you can update all code references

-- 3. 'guest_admin_id' field appears unused in codebase
--    - Only found in TypeScript types, not in actual queries
--    - Consider removing if not needed, or document its purpose

-- 4. 'user_status' could benefit from a CHECK constraint
--    - Add constraint to ensure only valid statuses: 'admin', 'superadmin', etc.
--    - Example: ALTER TABLE users ADD CONSTRAINT users_user_status_check 
--               CHECK (user_status IN ('admin', 'superadmin', 'guest'));

-- ============================================================================
-- 5. OPTIONAL: ADD CHECK CONSTRAINTS (Data Validation)
-- ============================================================================

-- Ensure active is only 'Y' or 'N' (if keeping as TEXT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_active_check' 
    AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_active_check CHECK (active IN ('Y', 'N'));
  END IF;
END $$;

-- Ensure email is lowercase (optional, but recommended)
-- This can be done via application code or a trigger
-- For now, we'll rely on application code to lowercase emails

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify improvements)
-- ============================================================================

-- Check indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users';

-- Check constraints
-- SELECT conname, contype, pg_get_constraintdef(oid) 
-- FROM pg_constraint WHERE conrelid = 'users'::regclass;

-- Check table structure
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'users' 
-- ORDER BY ordinal_position;



ALTER TABLE users
  ADD COLUMN IF NOT EXISTS theme_preference TEXT;

UPDATE users
SET theme_preference = 'dark'
WHERE theme_preference IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_theme_preference_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_theme_preference_check
      CHECK (theme_preference IN ('light', 'dark'));
  END IF;
END $$;

ALTER TABLE users
  ALTER COLUMN theme_preference SET DEFAULT 'light';

DROP POLICY IF EXISTS "Allow public user registration" ON public.users;

-- Explicit deny-all client policies on public.users.
-- Safe to re-run.
--
-- Advisor: "RLS Enabled No Policy" after dropping
--   "Allow public user registration"
--
-- All users reads/writes go through supabaseServer (service role), which
-- bypasses RLS. This app does not use Supabase Auth, so there is no
-- auth.uid() to attach a "own row" policy to.
-- A USING (false) policy documents that lock and clears the info warning
-- without reopening INSERT to anon.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all client access to users" ON public.users;
CREATE POLICY "Deny all client access to users" ON public.users
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

NOTIFY pgrst, 'reload schema';


CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_tools_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_tool_icons_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_users_tools_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
