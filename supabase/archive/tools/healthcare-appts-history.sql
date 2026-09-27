-- Healthcare Appointments and History — current schema
-- Safe to re-run. Creates anything missing. Does not delete user rows.
-- Includes tables, later columns, attachment tables, and storage policies for bucket "healthcare-appt-history".
-- Run in the Supabase SQL editor.

-- Healthcare Appts and History Tool Database Schema
-- All tables prefixed with 'tools_hcah_'
-- Matches UI: headers (family members), appointment records, documents per record.
--
-- Storage: Bucket 'healthcare-appt-history' (10MB limit, image/*, application/pdf).
-- Apply RLS policies per system_design.md. See supabase/archive/tools/healthcare-appts-history.sql.

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

-- ============================================================================
-- ROW LEVEL SECURITY (optimized: (select auth.uid()) per design_system)
-- ============================================================================
ALTER TABLE tools_hcah_headers ENABLE ROW LEVEL SECURITY;
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

-- Healthcare appointment attachments: wrap the existing tools_hcah_documents
-- store for the shared paperclip + Attachment modal.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `healthcare-appt-history` storage bucket.
-- New uploads use {userId}/{recordId}/{timestamp}-{filename}.
-- Older objects may still be at documents/{userId}/... — leave them; the
-- download route reads file_url either way.
--
-- Do not attach files to family-member headers or the provider text field.
-- Add to HSA must not copy files. Upcoming vs History is is_upcoming on the
-- same record — files stay editable.

ALTER TABLE tools_hcah_documents
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

UPDATE tools_hcah_documents d
SET user_id = r.user_id
FROM tools_hcah_records r
WHERE d.record_id = r.id
  AND d.user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_hcah_documents_user_id ON tools_hcah_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_hcah_documents_record_id ON tools_hcah_documents(record_id);


-- Healthcare no longer seeds from this catalog. Per-user headers live in tools_hcah_headers.
-- Safe to rerun.

DROP TABLE IF EXISTS tools_hcah_default_headers CASCADE;
DROP FUNCTION IF EXISTS update_hcah_default_headers_updated_at();

NOTIFY pgrst, 'reload schema';


-- Storage policies for bucket "healthcare-appt-history".
-- Create that bucket in Supabase Storage if it does not exist yet.
DROP POLICY IF EXISTS "healthcare-appt-history: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "healthcare-appt-history: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "healthcare-appt-history: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "healthcare-appt-history: Users can delete their own files" ON storage.objects;

CREATE POLICY "healthcare-appt-history: Users can upload to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'healthcare-appt-history' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "healthcare-appt-history: Users can read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'healthcare-appt-history' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "healthcare-appt-history: Users can update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'healthcare-appt-history' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
)
WITH CHECK (
  bucket_id = 'healthcare-appt-history' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "healthcare-appt-history: Users can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'healthcare-appt-history' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);


-- Misspelled bucket policies from the earlier bucket name.
DROP POLICY IF EXISTS "heathcare-appt-history: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "heathcare-appt-history: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "heathcare-appt-history: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "heathcare-appt-history: Users can delete their own files" ON storage.objects;

ALTER TABLE IF EXISTS tools_hcah_records DROP COLUMN IF EXISTS show_on_dashboard_calendar;


NOTIFY pgrst, 'reload schema';
