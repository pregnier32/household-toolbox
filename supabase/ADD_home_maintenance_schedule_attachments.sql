-- Home Maintenance Schedule attachments: standing files on library items,
-- plus dated proof on completion occurrences.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `home-maintenance-schedule` storage bucket at
-- {userId}/items/{itemId}/{timestamp}-{filename}
-- {userId}/completions/{completionId}/{timestamp}-{filename}
--
-- Do not attach files to scheduled tasks. A task is 1:1 with its library item,
-- so task-level files would duplicate the item store. Provider fields are
-- columns on the task — store provider docs on the item or the completion.

CREATE TABLE IF NOT EXISTS tools_hms_item_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES tools_hms_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_item_attachments_item_id ON tools_hms_item_attachments(item_id);
CREATE INDEX IF NOT EXISTS idx_hms_item_attachments_user_id ON tools_hms_item_attachments(user_id);

ALTER TABLE tools_hms_item_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own home maintenance item attachments" ON tools_hms_item_attachments;
CREATE POLICY "Users can view their own home maintenance item attachments" ON tools_hms_item_attachments
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own home maintenance item attachments" ON tools_hms_item_attachments;
CREATE POLICY "Users can insert their own home maintenance item attachments" ON tools_hms_item_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own home maintenance item attachments" ON tools_hms_item_attachments;
CREATE POLICY "Users can update their own home maintenance item attachments" ON tools_hms_item_attachments
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own home maintenance item attachments" ON tools_hms_item_attachments;
CREATE POLICY "Users can delete their own home maintenance item attachments" ON tools_hms_item_attachments
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE TABLE IF NOT EXISTS tools_hms_completion_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  completion_id UUID NOT NULL REFERENCES tools_hms_completions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_completion_attachments_completion_id ON tools_hms_completion_attachments(completion_id);
CREATE INDEX IF NOT EXISTS idx_hms_completion_attachments_user_id ON tools_hms_completion_attachments(user_id);

ALTER TABLE tools_hms_completion_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own home maintenance completion attachments" ON tools_hms_completion_attachments;
CREATE POLICY "Users can view their own home maintenance completion attachments" ON tools_hms_completion_attachments
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own home maintenance completion attachments" ON tools_hms_completion_attachments;
CREATE POLICY "Users can insert their own home maintenance completion attachments" ON tools_hms_completion_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own home maintenance completion attachments" ON tools_hms_completion_attachments;
CREATE POLICY "Users can update their own home maintenance completion attachments" ON tools_hms_completion_attachments
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own home maintenance completion attachments" ON tools_hms_completion_attachments;
CREATE POLICY "Users can delete their own home maintenance completion attachments" ON tools_hms_completion_attachments
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
