-- Address Book — current schema
-- Safe to re-run. Creates anything missing. Does not delete user rows.
-- Includes tables, later columns, attachment tables, and storage policies for bucket "address-book".
-- Run in the Supabase SQL editor.

-- Address Book Tool Database Schema
-- All tables prefixed with 'tools_ab_'
-- Matches UI: AddressBookTool (addresses tab, tags tab, history, tag filter).
-- Starter tags (Family, Friends, Services, School) are seeded on first use.
--
-- Run in Supabase SQL Editor (idempotent: safe to re-run).
-- After deploy, add tool_id FK indexes to supabase/archive/platform/performance-indexes.sql if you maintain that file.

-- ============================================================================
-- ADDRESSES
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_ab_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  mailing_name TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  street_address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  zip TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ab_addresses_user_id ON tools_ab_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_ab_addresses_tool_id ON tools_ab_addresses(tool_id);
CREATE INDEX IF NOT EXISTS idx_ab_addresses_user_tool ON tools_ab_addresses(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_ab_addresses_user_tool_active ON tools_ab_addresses(user_id, tool_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ab_addresses_is_active ON tools_ab_addresses(is_active);
CREATE INDEX IF NOT EXISTS idx_ab_addresses_mailing_name ON tools_ab_addresses(mailing_name);
CREATE INDEX IF NOT EXISTS idx_ab_addresses_last_name ON tools_ab_addresses(last_name);
CREATE INDEX IF NOT EXISTS idx_ab_addresses_city ON tools_ab_addresses(city);
CREATE INDEX IF NOT EXISTS idx_ab_addresses_email ON tools_ab_addresses(email);

-- ============================================================================
-- TAGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_ab_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tool_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ab_tags_user_id ON tools_ab_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_ab_tags_tool_id ON tools_ab_tags(tool_id);
CREATE INDEX IF NOT EXISTS idx_ab_tags_user_tool ON tools_ab_tags(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_ab_tags_user_tool_active ON tools_ab_tags(user_id, tool_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ab_tags_is_active ON tools_ab_tags(is_active);
CREATE INDEX IF NOT EXISTS idx_ab_tags_name ON tools_ab_tags(name);

-- ============================================================================
-- ADDRESS ↔ TAG (many-to-many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_ab_address_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id UUID NOT NULL REFERENCES tools_ab_addresses(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tools_ab_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (address_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_ab_address_tags_address_id ON tools_ab_address_tags(address_id);
CREATE INDEX IF NOT EXISTS idx_ab_address_tags_tag_id ON tools_ab_address_tags(tag_id);

-- ============================================================================
-- UPDATED_AT TRIGGERS (secure search_path per system_design.md)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_ab_addresses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_ab_tags_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_ab_addresses_updated_at ON tools_ab_addresses;
CREATE TRIGGER trigger_update_ab_addresses_updated_at
  BEFORE UPDATE ON tools_ab_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_ab_addresses_updated_at();

DROP TRIGGER IF EXISTS trigger_update_ab_tags_updated_at ON tools_ab_tags;
CREATE TRIGGER trigger_update_ab_tags_updated_at
  BEFORE UPDATE ON tools_ab_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_ab_tags_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (optimized: (select auth.uid()))
-- ============================================================================
ALTER TABLE tools_ab_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_ab_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_ab_address_tags ENABLE ROW LEVEL SECURITY;

-- Addresses
DROP POLICY IF EXISTS "ab: Users can view their own addresses" ON tools_ab_addresses;
CREATE POLICY "ab: Users can view their own addresses" ON tools_ab_addresses
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ab: Users can insert their own addresses" ON tools_ab_addresses;
CREATE POLICY "ab: Users can insert their own addresses" ON tools_ab_addresses
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ab: Users can update their own addresses" ON tools_ab_addresses;
CREATE POLICY "ab: Users can update their own addresses" ON tools_ab_addresses
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ab: Users can delete their own addresses" ON tools_ab_addresses;
CREATE POLICY "ab: Users can delete their own addresses" ON tools_ab_addresses
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Tags
DROP POLICY IF EXISTS "ab: Users can view their own tags" ON tools_ab_tags;
CREATE POLICY "ab: Users can view their own tags" ON tools_ab_tags
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ab: Users can insert their own tags" ON tools_ab_tags;
CREATE POLICY "ab: Users can insert their own tags" ON tools_ab_tags
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ab: Users can update their own tags" ON tools_ab_tags;
CREATE POLICY "ab: Users can update their own tags" ON tools_ab_tags
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ab: Users can delete their own tags" ON tools_ab_tags;
CREATE POLICY "ab: Users can delete their own tags" ON tools_ab_tags
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Address tags (junction — user must own both address and tag)
DROP POLICY IF EXISTS "ab: Users can view their own address tags" ON tools_ab_address_tags;
CREATE POLICY "ab: Users can view their own address tags" ON tools_ab_address_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_ab_addresses a
      WHERE a.id = tools_ab_address_tags.address_id
        AND a.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "ab: Users can insert their own address tags" ON tools_ab_address_tags;
CREATE POLICY "ab: Users can insert their own address tags" ON tools_ab_address_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_ab_addresses a
      WHERE a.id = tools_ab_address_tags.address_id
        AND a.user_id = (select auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM tools_ab_tags t
      WHERE t.id = tools_ab_address_tags.tag_id
        AND t.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "ab: Users can update their own address tags" ON tools_ab_address_tags;
CREATE POLICY "ab: Users can update their own address tags" ON tools_ab_address_tags
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_ab_addresses a
      WHERE a.id = tools_ab_address_tags.address_id
        AND a.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_ab_addresses a
      WHERE a.id = tools_ab_address_tags.address_id
        AND a.user_id = (select auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM tools_ab_tags t
      WHERE t.id = tools_ab_address_tags.tag_id
        AND t.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "ab: Users can delete their own address tags" ON tools_ab_address_tags;
CREATE POLICY "ab: Users can delete their own address tags" ON tools_ab_address_tags
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_ab_addresses a
      WHERE a.id = tools_ab_address_tags.address_id
        AND a.user_id = (select auth.uid())
    )
  );


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


-- Storage policies for bucket "address-book".
-- Create that bucket in Supabase Storage if it does not exist yet.
DROP POLICY IF EXISTS "address-book: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "address-book: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "address-book: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "address-book: Users can delete their own files" ON storage.objects;

CREATE POLICY "address-book: Users can upload to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'address-book' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "address-book: Users can read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'address-book' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "address-book: Users can update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'address-book' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
)
WITH CHECK (
  bucket_id = 'address-book' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "address-book: Users can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'address-book' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);


NOTIFY pgrst, 'reload schema';
