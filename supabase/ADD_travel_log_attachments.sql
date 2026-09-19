-- Travel Log attachments: multiple optional files per trip.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `travel-log` storage bucket at
-- {userId}/{tripId}/{timestamp}-{filename}
--
-- Do not attach files to lodging or journal notes yet. Those child rows are
-- deleted and re-inserted on every trip save, so a child file store would
-- orphan or cascade-delete on Save.

CREATE TABLE IF NOT EXISTS tools_tl_trip_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES tools_tl_trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tl_trip_attachments_trip_id ON tools_tl_trip_attachments(trip_id);
CREATE INDEX IF NOT EXISTS idx_tl_trip_attachments_user_id ON tools_tl_trip_attachments(user_id);

ALTER TABLE tools_tl_trip_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own travel log attachments" ON tools_tl_trip_attachments;
CREATE POLICY "Users can view their own travel log attachments" ON tools_tl_trip_attachments
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own travel log attachments" ON tools_tl_trip_attachments;
CREATE POLICY "Users can insert their own travel log attachments" ON tools_tl_trip_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own travel log attachments" ON tools_tl_trip_attachments;
CREATE POLICY "Users can update their own travel log attachments" ON tools_tl_trip_attachments
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own travel log attachments" ON tools_tl_trip_attachments;
CREATE POLICY "Users can delete their own travel log attachments" ON tools_tl_trip_attachments
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
