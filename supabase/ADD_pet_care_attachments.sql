-- Pet Care Schedule attachments: pet, document, veterinary, vaccination, appointment.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `pet-care-schedule` storage bucket.
-- Pet:          {userId}/pets/{petId}/{timestamp}-{filename}
-- Document:     {userId}/documents/{documentId}/{timestamp}-{filename}
-- Veterinary:   {userId}/veterinary/{recordId}/{timestamp}-{filename}
-- Vaccination:  {userId}/vaccinations/{recordId}/{timestamp}-{filename}
-- Appointment:  {userId}/appointments/{recordId}/{timestamp}-{filename}
--
-- Existing tools_pcs_documents.file_url rows are copied into
-- tools_pcs_document_attachments. Leave the old columns; download reads either.
--
-- Do not attach files to food, care plan, or notes (those children stay replace-all).
-- History / upcoming stay editable. Vaccination "History" is the live list.

CREATE TABLE IF NOT EXISTS tools_pcs_pet_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES tools_pcs_pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcs_pet_attachments_pet_id ON tools_pcs_pet_attachments(pet_id);
CREATE INDEX IF NOT EXISTS idx_pcs_pet_attachments_user_id ON tools_pcs_pet_attachments(user_id);

ALTER TABLE tools_pcs_pet_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own PCS pet attachments" ON tools_pcs_pet_attachments;
CREATE POLICY "Users can view their own PCS pet attachments" ON tools_pcs_pet_attachments
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own PCS pet attachments" ON tools_pcs_pet_attachments;
CREATE POLICY "Users can insert their own PCS pet attachments" ON tools_pcs_pet_attachments
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can update their own PCS pet attachments" ON tools_pcs_pet_attachments;
CREATE POLICY "Users can update their own PCS pet attachments" ON tools_pcs_pet_attachments
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own PCS pet attachments" ON tools_pcs_pet_attachments;
CREATE POLICY "Users can delete their own PCS pet attachments" ON tools_pcs_pet_attachments
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE TABLE IF NOT EXISTS tools_pcs_document_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES tools_pcs_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcs_document_attachments_document_id ON tools_pcs_document_attachments(document_id);
CREATE INDEX IF NOT EXISTS idx_pcs_document_attachments_user_id ON tools_pcs_document_attachments(user_id);

ALTER TABLE tools_pcs_document_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own PCS document attachments" ON tools_pcs_document_attachments;
CREATE POLICY "Users can view their own PCS document attachments" ON tools_pcs_document_attachments
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own PCS document attachments" ON tools_pcs_document_attachments;
CREATE POLICY "Users can insert their own PCS document attachments" ON tools_pcs_document_attachments
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can update their own PCS document attachments" ON tools_pcs_document_attachments;
CREATE POLICY "Users can update their own PCS document attachments" ON tools_pcs_document_attachments
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own PCS document attachments" ON tools_pcs_document_attachments;
CREATE POLICY "Users can delete their own PCS document attachments" ON tools_pcs_document_attachments
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE TABLE IF NOT EXISTS tools_pcs_veterinary_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veterinary_id UUID NOT NULL REFERENCES tools_pcs_veterinary_records(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcs_veterinary_attachments_veterinary_id ON tools_pcs_veterinary_attachments(veterinary_id);
CREATE INDEX IF NOT EXISTS idx_pcs_veterinary_attachments_user_id ON tools_pcs_veterinary_attachments(user_id);

ALTER TABLE tools_pcs_veterinary_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own PCS veterinary attachments" ON tools_pcs_veterinary_attachments;
CREATE POLICY "Users can view their own PCS veterinary attachments" ON tools_pcs_veterinary_attachments
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own PCS veterinary attachments" ON tools_pcs_veterinary_attachments;
CREATE POLICY "Users can insert their own PCS veterinary attachments" ON tools_pcs_veterinary_attachments
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can update their own PCS veterinary attachments" ON tools_pcs_veterinary_attachments;
CREATE POLICY "Users can update their own PCS veterinary attachments" ON tools_pcs_veterinary_attachments
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own PCS veterinary attachments" ON tools_pcs_veterinary_attachments;
CREATE POLICY "Users can delete their own PCS veterinary attachments" ON tools_pcs_veterinary_attachments
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE TABLE IF NOT EXISTS tools_pcs_vaccination_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaccination_id UUID NOT NULL REFERENCES tools_pcs_vaccinations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcs_vaccination_attachments_vaccination_id ON tools_pcs_vaccination_attachments(vaccination_id);
CREATE INDEX IF NOT EXISTS idx_pcs_vaccination_attachments_user_id ON tools_pcs_vaccination_attachments(user_id);

ALTER TABLE tools_pcs_vaccination_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own PCS vaccination attachments" ON tools_pcs_vaccination_attachments;
CREATE POLICY "Users can view their own PCS vaccination attachments" ON tools_pcs_vaccination_attachments
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own PCS vaccination attachments" ON tools_pcs_vaccination_attachments;
CREATE POLICY "Users can insert their own PCS vaccination attachments" ON tools_pcs_vaccination_attachments
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can update their own PCS vaccination attachments" ON tools_pcs_vaccination_attachments;
CREATE POLICY "Users can update their own PCS vaccination attachments" ON tools_pcs_vaccination_attachments
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own PCS vaccination attachments" ON tools_pcs_vaccination_attachments;
CREATE POLICY "Users can delete their own PCS vaccination attachments" ON tools_pcs_vaccination_attachments
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE TABLE IF NOT EXISTS tools_pcs_appointment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES tools_pcs_appointments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcs_appointment_attachments_appointment_id ON tools_pcs_appointment_attachments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_pcs_appointment_attachments_user_id ON tools_pcs_appointment_attachments(user_id);

ALTER TABLE tools_pcs_appointment_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own PCS appointment attachments" ON tools_pcs_appointment_attachments;
CREATE POLICY "Users can view their own PCS appointment attachments" ON tools_pcs_appointment_attachments
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own PCS appointment attachments" ON tools_pcs_appointment_attachments;
CREATE POLICY "Users can insert their own PCS appointment attachments" ON tools_pcs_appointment_attachments
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can update their own PCS appointment attachments" ON tools_pcs_appointment_attachments;
CREATE POLICY "Users can update their own PCS appointment attachments" ON tools_pcs_appointment_attachments
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own PCS appointment attachments" ON tools_pcs_appointment_attachments;
CREATE POLICY "Users can delete their own PCS appointment attachments" ON tools_pcs_appointment_attachments
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

INSERT INTO tools_pcs_document_attachments (document_id, user_id, file_url, file_name, file_size, file_type)
SELECT
  d.id,
  p.user_id,
  d.file_url,
  COALESCE(NULLIF(d.file_name, ''), 'document'),
  COALESCE(d.file_size, 0),
  COALESCE(NULLIF(d.file_type, ''), 'application/octet-stream')
FROM tools_pcs_documents d
JOIN tools_pcs_pets p ON p.id = d.pet_id
WHERE d.file_url IS NOT NULL
  AND d.file_url <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM tools_pcs_document_attachments a
    WHERE a.document_id = d.id
      AND a.file_url = d.file_url
  );
