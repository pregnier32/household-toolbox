-- Notes attachments: multiple optional files per note.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `notes` storage bucket at
-- {userId}/{noteId}/{timestamp}-{filename}

CREATE TABLE IF NOT EXISTS tools_note_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES tools_note_notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_attachments_note_id ON tools_note_attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_note_attachments_user_id ON tools_note_attachments(user_id);

ALTER TABLE tools_note_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own note attachments" ON tools_note_attachments;
CREATE POLICY "Users can view their own note attachments" ON tools_note_attachments
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own note attachments" ON tools_note_attachments;
CREATE POLICY "Users can insert their own note attachments" ON tools_note_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own note attachments" ON tools_note_attachments;
CREATE POLICY "Users can update their own note attachments" ON tools_note_attachments
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own note attachments" ON tools_note_attachments;
CREATE POLICY "Users can delete their own note attachments" ON tools_note_attachments
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
