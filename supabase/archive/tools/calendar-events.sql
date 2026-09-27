-- Calendar Events — current schema
-- Safe to re-run. Creates anything missing. Does not delete user rows.
-- Includes tables, later columns, attachment tables, and storage policies for bucket "calendar-events".
-- Run in the Supabase SQL editor.

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
  USING ((select auth.uid()) = user_id);

-- INSERT policy
DROP POLICY IF EXISTS "Users can insert their own categories" ON tools_ce_categories;
CREATE POLICY "Users can insert their own categories" ON tools_ce_categories
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update their own categories" ON tools_ce_categories;
CREATE POLICY "Users can update their own categories" ON tools_ce_categories
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete their own categories" ON tools_ce_categories;
CREATE POLICY "Users can delete their own categories" ON tools_ce_categories
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- Events RLS Policies
-- ============================================================================

-- SELECT policy
DROP POLICY IF EXISTS "Users can view their own events" ON tools_ce_events;
CREATE POLICY "Users can view their own events" ON tools_ce_events
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- INSERT policy
DROP POLICY IF EXISTS "Users can insert their own events" ON tools_ce_events;
CREATE POLICY "Users can insert their own events" ON tools_ce_events
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update their own events" ON tools_ce_events;
CREATE POLICY "Users can update their own events" ON tools_ce_events
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete their own events" ON tools_ce_events;
CREATE POLICY "Users can delete their own events" ON tools_ce_events
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);


-- Add time column to tools_ce_events table
-- This allows users to specify an optional time for calendar events

ALTER TABLE tools_ce_events 
ADD COLUMN IF NOT EXISTS time TIME;

-- Add comment to explain the column
COMMENT ON COLUMN tools_ce_events.time IS 'Optional time for the event in HH:MM format (24-hour). If NULL, event defaults to 9:00 AM on calendar display.';


-- Calendar Events attachments: multiple optional files per event series.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `calendar-events` storage bucket at
-- {userId}/{eventId}/{timestamp}-{filename}
--
-- Recurring events are one tools_ce_events row (frequency on the series).
-- Files belong to that series — there are no occurrence rows.
-- History (is_active = false) is View/Download only. Reactivate to add or
-- remove files. Do not attach files to categories, Export, or calendar pins.

CREATE TABLE IF NOT EXISTS tools_ce_event_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES tools_ce_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ce_event_attachments_event_id ON tools_ce_event_attachments(event_id);
CREATE INDEX IF NOT EXISTS idx_ce_event_attachments_user_id ON tools_ce_event_attachments(user_id);

ALTER TABLE tools_ce_event_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own calendar event attachments" ON tools_ce_event_attachments;
CREATE POLICY "Users can view their own calendar event attachments" ON tools_ce_event_attachments
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own calendar event attachments" ON tools_ce_event_attachments;
CREATE POLICY "Users can insert their own calendar event attachments" ON tools_ce_event_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own calendar event attachments" ON tools_ce_event_attachments;
CREATE POLICY "Users can update their own calendar event attachments" ON tools_ce_event_attachments
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own calendar event attachments" ON tools_ce_event_attachments;
CREATE POLICY "Users can delete their own calendar event attachments" ON tools_ce_event_attachments
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));


-- Trigger functions with a fixed search_path.
CREATE OR REPLACE FUNCTION update_ce_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_ce_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- Storage policies for bucket "calendar-events".
-- Create that bucket in Supabase Storage if it does not exist yet.
DROP POLICY IF EXISTS "calendar-events: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "calendar-events: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "calendar-events: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "calendar-events: Users can delete their own files" ON storage.objects;

CREATE POLICY "calendar-events: Users can upload to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'calendar-events' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "calendar-events: Users can read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'calendar-events' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "calendar-events: Users can update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'calendar-events' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
)
WITH CHECK (
  bucket_id = 'calendar-events' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "calendar-events: Users can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'calendar-events' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);


DROP INDEX IF EXISTS idx_ce_events_add_to_dashboard;
ALTER TABLE IF EXISTS tools_ce_events DROP COLUMN IF EXISTS add_to_dashboard;


NOTIFY pgrst, 'reload schema';
