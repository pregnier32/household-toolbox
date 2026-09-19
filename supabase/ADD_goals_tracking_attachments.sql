-- Goals Tracking attachments: goal files + update files.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `goals-tracking` storage bucket.
-- Goal uploads:   {userId}/goals/{goalId}/{timestamp}-{filename}
-- Update uploads: {userId}/updates/{noteId}/{timestamp}-{filename}
--
-- Do not attach files to categories, phases, or tasks.
-- Completed is a status field, not History — files stay editable.

CREATE TABLE IF NOT EXISTS tools_gt_goal_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES tools_gt_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gt_goal_attachments_goal_id ON tools_gt_goal_attachments(goal_id);
CREATE INDEX IF NOT EXISTS idx_gt_goal_attachments_user_id ON tools_gt_goal_attachments(user_id);

ALTER TABLE tools_gt_goal_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own GT goal attachments" ON tools_gt_goal_attachments;
CREATE POLICY "Users can view their own GT goal attachments" ON tools_gt_goal_attachments
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own GT goal attachments" ON tools_gt_goal_attachments;
CREATE POLICY "Users can insert their own GT goal attachments" ON tools_gt_goal_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own GT goal attachments" ON tools_gt_goal_attachments;
CREATE POLICY "Users can update their own GT goal attachments" ON tools_gt_goal_attachments
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own GT goal attachments" ON tools_gt_goal_attachments;
CREATE POLICY "Users can delete their own GT goal attachments" ON tools_gt_goal_attachments
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE TABLE IF NOT EXISTS tools_gt_update_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES tools_gt_update_notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gt_update_attachments_note_id ON tools_gt_update_attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_gt_update_attachments_user_id ON tools_gt_update_attachments(user_id);

ALTER TABLE tools_gt_update_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own GT update attachments" ON tools_gt_update_attachments;
CREATE POLICY "Users can view their own GT update attachments" ON tools_gt_update_attachments
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own GT update attachments" ON tools_gt_update_attachments;
CREATE POLICY "Users can insert their own GT update attachments" ON tools_gt_update_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own GT update attachments" ON tools_gt_update_attachments;
CREATE POLICY "Users can update their own GT update attachments" ON tools_gt_update_attachments
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own GT update attachments" ON tools_gt_update_attachments;
CREATE POLICY "Users can delete their own GT update attachments" ON tools_gt_update_attachments
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
