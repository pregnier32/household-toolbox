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
