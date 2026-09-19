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
