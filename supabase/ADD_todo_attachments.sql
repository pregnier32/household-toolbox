-- To-Do List attachments: multiple optional files per task.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `to-do-list` storage bucket at
-- {userId}/{taskId}/{timestamp}-{filename}

CREATE TABLE IF NOT EXISTS tools_tdl_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tools_tdl_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tdl_attachments_task_id ON tools_tdl_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_tdl_attachments_user_id ON tools_tdl_attachments(user_id);

ALTER TABLE tools_tdl_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own to-do attachments" ON tools_tdl_attachments;
CREATE POLICY "Users can view their own to-do attachments" ON tools_tdl_attachments
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own to-do attachments" ON tools_tdl_attachments;
CREATE POLICY "Users can insert their own to-do attachments" ON tools_tdl_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own to-do attachments" ON tools_tdl_attachments;
CREATE POLICY "Users can update their own to-do attachments" ON tools_tdl_attachments
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own to-do attachments" ON tools_tdl_attachments;
CREATE POLICY "Users can delete their own to-do attachments" ON tools_tdl_attachments
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
