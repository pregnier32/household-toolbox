-- Address Book attachments: multiple optional files per address.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `address-book` storage bucket at
-- {userId}/{addressId}/{timestamp}-{filename}
--
-- Files belong to the address, not to tags. tools_ab_address_tags is
-- deleted and re-inserted on every save, so a tag file store would orphan.
-- History (is_active = false) is View/Download only. Restore to add or
-- remove files. No paperclip on tags.

CREATE TABLE IF NOT EXISTS tools_ab_address_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id UUID NOT NULL REFERENCES tools_ab_addresses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ab_address_attachments_address_id
  ON tools_ab_address_attachments(address_id);
CREATE INDEX IF NOT EXISTS idx_ab_address_attachments_user_id
  ON tools_ab_address_attachments(user_id);

ALTER TABLE tools_ab_address_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own address attachments" ON tools_ab_address_attachments;
CREATE POLICY "Users can view their own address attachments" ON tools_ab_address_attachments
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own address attachments" ON tools_ab_address_attachments;
CREATE POLICY "Users can insert their own address attachments" ON tools_ab_address_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own address attachments" ON tools_ab_address_attachments;
CREATE POLICY "Users can update their own address attachments" ON tools_ab_address_attachments
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own address attachments" ON tools_ab_address_attachments;
CREATE POLICY "Users can delete their own address attachments" ON tools_ab_address_attachments
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
