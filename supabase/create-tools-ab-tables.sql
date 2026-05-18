-- Address Book Tool Database Schema
-- All tables prefixed with 'tools_ab_'
-- Matches UI: AddressBookTool (addresses tab, tags tab, history, tag filter).
-- Starter tags (Birthday, Graduation, Christmas) are seeded by the API on first use.
--
-- Run in Supabase SQL Editor (idempotent: safe to re-run).
-- After deploy, add tool_id FK indexes to add-performance-indexes.sql if you maintain that file.

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
