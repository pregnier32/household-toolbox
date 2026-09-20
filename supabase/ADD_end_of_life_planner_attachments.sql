-- End of Life Planner attachments: files on document, insurance,
-- letter, personal-item, and other-record rows.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `end-of-life-planner` storage bucket at
-- {userId}/documents/{documentId}/{timestamp}-{filename}
-- {userId}/insurance/{insuranceId}/{timestamp}-{filename}
-- {userId}/letters/{letterId}/{timestamp}-{filename}
-- {userId}/personal-items/{itemId}/{timestamp}-{filename}
-- {userId}/other/{recordId}/{timestamp}-{filename}
--
-- Do not attach files to custom fields, sections, contacts, logins,
-- financial rows, home rows, next steps, or 1:1 wish blobs.
-- Document rows are single-file (maxFiles = 1). Other stores allow many.

CREATE TABLE IF NOT EXISTS tools_eolp_document_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES tools_eolp_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_document_attachments_document_id ON tools_eolp_document_attachments(document_id);
CREATE INDEX IF NOT EXISTS idx_eolp_document_attachments_user_id ON tools_eolp_document_attachments(user_id);

ALTER TABLE tools_eolp_document_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own eolp document attachments" ON tools_eolp_document_attachments;
CREATE POLICY "Users can view their own eolp document attachments" ON tools_eolp_document_attachments
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own eolp document attachments" ON tools_eolp_document_attachments;
CREATE POLICY "Users can insert their own eolp document attachments" ON tools_eolp_document_attachments
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can update their own eolp document attachments" ON tools_eolp_document_attachments;
CREATE POLICY "Users can update their own eolp document attachments" ON tools_eolp_document_attachments
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own eolp document attachments" ON tools_eolp_document_attachments;
CREATE POLICY "Users can delete their own eolp document attachments" ON tools_eolp_document_attachments
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE TABLE IF NOT EXISTS tools_eolp_insurance_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_id UUID NOT NULL REFERENCES tools_eolp_insurance(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_insurance_attachments_insurance_id ON tools_eolp_insurance_attachments(insurance_id);
CREATE INDEX IF NOT EXISTS idx_eolp_insurance_attachments_user_id ON tools_eolp_insurance_attachments(user_id);

ALTER TABLE tools_eolp_insurance_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own eolp insurance attachments" ON tools_eolp_insurance_attachments;
CREATE POLICY "Users can view their own eolp insurance attachments" ON tools_eolp_insurance_attachments
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own eolp insurance attachments" ON tools_eolp_insurance_attachments;
CREATE POLICY "Users can insert their own eolp insurance attachments" ON tools_eolp_insurance_attachments
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can update their own eolp insurance attachments" ON tools_eolp_insurance_attachments;
CREATE POLICY "Users can update their own eolp insurance attachments" ON tools_eolp_insurance_attachments
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own eolp insurance attachments" ON tools_eolp_insurance_attachments;
CREATE POLICY "Users can delete their own eolp insurance attachments" ON tools_eolp_insurance_attachments
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE TABLE IF NOT EXISTS tools_eolp_letter_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id UUID NOT NULL REFERENCES tools_eolp_letters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_letter_attachments_letter_id ON tools_eolp_letter_attachments(letter_id);
CREATE INDEX IF NOT EXISTS idx_eolp_letter_attachments_user_id ON tools_eolp_letter_attachments(user_id);

ALTER TABLE tools_eolp_letter_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own eolp letter attachments" ON tools_eolp_letter_attachments;
CREATE POLICY "Users can view their own eolp letter attachments" ON tools_eolp_letter_attachments
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own eolp letter attachments" ON tools_eolp_letter_attachments;
CREATE POLICY "Users can insert their own eolp letter attachments" ON tools_eolp_letter_attachments
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can update their own eolp letter attachments" ON tools_eolp_letter_attachments;
CREATE POLICY "Users can update their own eolp letter attachments" ON tools_eolp_letter_attachments
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own eolp letter attachments" ON tools_eolp_letter_attachments;
CREATE POLICY "Users can delete their own eolp letter attachments" ON tools_eolp_letter_attachments
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE TABLE IF NOT EXISTS tools_eolp_personal_item_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_item_id UUID NOT NULL REFERENCES tools_eolp_personal_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_personal_item_attachments_item_id ON tools_eolp_personal_item_attachments(personal_item_id);
CREATE INDEX IF NOT EXISTS idx_eolp_personal_item_attachments_user_id ON tools_eolp_personal_item_attachments(user_id);

ALTER TABLE tools_eolp_personal_item_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own eolp personal item attachments" ON tools_eolp_personal_item_attachments;
CREATE POLICY "Users can view their own eolp personal item attachments" ON tools_eolp_personal_item_attachments
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own eolp personal item attachments" ON tools_eolp_personal_item_attachments;
CREATE POLICY "Users can insert their own eolp personal item attachments" ON tools_eolp_personal_item_attachments
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can update their own eolp personal item attachments" ON tools_eolp_personal_item_attachments;
CREATE POLICY "Users can update their own eolp personal item attachments" ON tools_eolp_personal_item_attachments
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own eolp personal item attachments" ON tools_eolp_personal_item_attachments;
CREATE POLICY "Users can delete their own eolp personal item attachments" ON tools_eolp_personal_item_attachments
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE TABLE IF NOT EXISTS tools_eolp_other_record_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES tools_eolp_other_records(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eolp_other_record_attachments_record_id ON tools_eolp_other_record_attachments(record_id);
CREATE INDEX IF NOT EXISTS idx_eolp_other_record_attachments_user_id ON tools_eolp_other_record_attachments(user_id);

ALTER TABLE tools_eolp_other_record_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own eolp other record attachments" ON tools_eolp_other_record_attachments;
CREATE POLICY "Users can view their own eolp other record attachments" ON tools_eolp_other_record_attachments
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own eolp other record attachments" ON tools_eolp_other_record_attachments;
CREATE POLICY "Users can insert their own eolp other record attachments" ON tools_eolp_other_record_attachments
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can update their own eolp other record attachments" ON tools_eolp_other_record_attachments;
CREATE POLICY "Users can update their own eolp other record attachments" ON tools_eolp_other_record_attachments
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own eolp other record attachments" ON tools_eolp_other_record_attachments;
CREATE POLICY "Users can delete their own eolp other record attachments" ON tools_eolp_other_record_attachments
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));
