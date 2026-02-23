-- Healthcare Appts and History Tool Database Schema
-- All tables prefixed with 'tools_hcah_'
-- Matches UI: headers (family members), appointment records, documents per record.
--
-- Storage: Bucket 'heathcare-appt-history' (10MB limit, image/*, application/pdf).
-- Apply RLS policies per design_system.md. See create-healthcare-appts-history-storage-bucket.sql.

-- ============================================================================
-- HEADERS (family members, e.g. Family1, Family2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hcah_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  card_color TEXT DEFAULT '#10b981',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hcah_headers_user_id ON tools_hcah_headers(user_id);
CREATE INDEX IF NOT EXISTS idx_hcah_headers_tool_id ON tools_hcah_headers(tool_id);
CREATE INDEX IF NOT EXISTS idx_hcah_headers_user_tool ON tools_hcah_headers(user_id, tool_id);

-- ============================================================================
-- DEFAULT HEADERS (optional seed: Family1, Family2 for first-time setup)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hcah_default_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  card_color TEXT DEFAULT '#10b981',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hcah_default_headers_display_order ON tools_hcah_default_headers(display_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hcah_default_headers_name ON tools_hcah_default_headers(name);

-- ============================================================================
-- APPOINTMENT RECORDS (one per visit; belongs to a header)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hcah_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  header_id UUID NOT NULL REFERENCES tools_hcah_headers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  is_upcoming BOOLEAN NOT NULL DEFAULT true,
  care_facility TEXT,
  provider_info TEXT,
  reason_for_visit TEXT,
  pre_visit_notes TEXT,
  post_visit_notes TEXT,
  show_on_dashboard_calendar BOOLEAN DEFAULT false,
  total_billed TEXT,
  insurance_paid TEXT,
  current_amount_due TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patient responsibility is derived: total_billed - insurance_paid (not stored)

CREATE INDEX IF NOT EXISTS idx_hcah_records_header_id ON tools_hcah_records(header_id);
CREATE INDEX IF NOT EXISTS idx_hcah_records_user_id ON tools_hcah_records(user_id);
CREATE INDEX IF NOT EXISTS idx_hcah_records_tool_id ON tools_hcah_records(tool_id);
CREATE INDEX IF NOT EXISTS idx_hcah_records_appointment_date ON tools_hcah_records(appointment_date);
CREATE INDEX IF NOT EXISTS idx_hcah_records_is_upcoming ON tools_hcah_records(is_upcoming);
CREATE INDEX IF NOT EXISTS idx_hcah_records_user_tool ON tools_hcah_records(user_id, tool_id);

-- ============================================================================
-- DOCUMENTS (multiple per record; stored in storage bucket, metadata here)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_hcah_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES tools_hcah_records(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size BIGINT,
  file_type TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hcah_documents_record_id ON tools_hcah_documents(record_id);
CREATE INDEX IF NOT EXISTS idx_hcah_documents_record_order ON tools_hcah_documents(record_id, display_order);

-- ============================================================================
-- UPDATED_AT TRIGGERS (with secure search_path)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_hcah_headers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_hcah_records_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_hcah_default_headers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_hcah_headers_updated_at ON tools_hcah_headers;
CREATE TRIGGER trigger_update_hcah_headers_updated_at
  BEFORE UPDATE ON tools_hcah_headers
  FOR EACH ROW
  EXECUTE FUNCTION update_hcah_headers_updated_at();

DROP TRIGGER IF EXISTS trigger_update_hcah_records_updated_at ON tools_hcah_records;
CREATE TRIGGER trigger_update_hcah_records_updated_at
  BEFORE UPDATE ON tools_hcah_records
  FOR EACH ROW
  EXECUTE FUNCTION update_hcah_records_updated_at();

DROP TRIGGER IF EXISTS trigger_update_hcah_default_headers_updated_at ON tools_hcah_default_headers;
CREATE TRIGGER trigger_update_hcah_default_headers_updated_at
  BEFORE UPDATE ON tools_hcah_default_headers
  FOR EACH ROW
  EXECUTE FUNCTION update_hcah_default_headers_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (optimized: (select auth.uid()) per design_system)
-- ============================================================================
ALTER TABLE tools_hcah_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_hcah_default_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_hcah_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_hcah_documents ENABLE ROW LEVEL SECURITY;

-- Headers
DROP POLICY IF EXISTS "Users can view their own headers" ON tools_hcah_headers;
CREATE POLICY "Users can view their own headers" ON tools_hcah_headers
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own headers" ON tools_hcah_headers;
CREATE POLICY "Users can insert their own headers" ON tools_hcah_headers
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own headers" ON tools_hcah_headers;
CREATE POLICY "Users can update their own headers" ON tools_hcah_headers
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own headers" ON tools_hcah_headers;
CREATE POLICY "Users can delete their own headers" ON tools_hcah_headers
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Default headers (read-only for all authenticated; used to seed user headers)
DROP POLICY IF EXISTS "Anyone can view default headers" ON tools_hcah_default_headers;
CREATE POLICY "Anyone can view default headers" ON tools_hcah_default_headers
  FOR SELECT TO authenticated USING (true);

-- Records
DROP POLICY IF EXISTS "Users can view their own records" ON tools_hcah_records;
CREATE POLICY "Users can view their own records" ON tools_hcah_records
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own records" ON tools_hcah_records;
CREATE POLICY "Users can insert their own records" ON tools_hcah_records
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    EXISTS (
      SELECT 1 FROM tools_hcah_headers h
      WHERE h.id = header_id AND h.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own records" ON tools_hcah_records;
CREATE POLICY "Users can update their own records" ON tools_hcah_records
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id AND
    EXISTS (
      SELECT 1 FROM tools_hcah_headers h
      WHERE h.id = header_id AND h.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own records" ON tools_hcah_records;
CREATE POLICY "Users can delete their own records" ON tools_hcah_records
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Documents (access via record -> header -> user)
DROP POLICY IF EXISTS "Users can view their own documents" ON tools_hcah_documents;
CREATE POLICY "Users can view their own documents" ON tools_hcah_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_hcah_records r
      JOIN tools_hcah_headers h ON h.id = r.header_id
      WHERE r.id = tools_hcah_documents.record_id AND h.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own documents" ON tools_hcah_documents;
CREATE POLICY "Users can insert their own documents" ON tools_hcah_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_hcah_records r
      JOIN tools_hcah_headers h ON h.id = r.header_id
      WHERE r.id = tools_hcah_documents.record_id AND h.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own documents" ON tools_hcah_documents;
CREATE POLICY "Users can update their own documents" ON tools_hcah_documents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_hcah_records r
      JOIN tools_hcah_headers h ON h.id = r.header_id
      WHERE r.id = tools_hcah_documents.record_id AND h.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_hcah_records r
      JOIN tools_hcah_headers h ON h.id = r.header_id
      WHERE r.id = tools_hcah_documents.record_id AND h.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own documents" ON tools_hcah_documents;
CREATE POLICY "Users can delete their own documents" ON tools_hcah_documents
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_hcah_records r
      JOIN tools_hcah_headers h ON h.id = r.header_id
      WHERE r.id = tools_hcah_documents.record_id AND h.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- SEED DEFAULT HEADERS (Family1, Family2)
-- ============================================================================
INSERT INTO tools_hcah_default_headers (name, card_color, display_order) VALUES
  ('Family1', '#10b981', 0),
  ('Family2', '#3b82f6', 1)
ON CONFLICT (name) DO NOTHING;
