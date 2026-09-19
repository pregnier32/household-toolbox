-- Repair History attachments: multiple optional files per repair record.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `repair-history` storage bucket.
-- New uploads use {userId}/{recordId}/{timestamp}-{filename}.
-- Existing receipt / warranty / picture objects stay at their current paths.
--
-- Do not attach files to Items or categories. Items are catalog rows for the
-- dropdown. Insurance is fields on the same repair — same file store.

CREATE TABLE IF NOT EXISTS tools_rh_record_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES tools_rh_records(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rh_record_attachments_record_id ON tools_rh_record_attachments(record_id);
CREATE INDEX IF NOT EXISTS idx_rh_record_attachments_user_id ON tools_rh_record_attachments(user_id);

ALTER TABLE tools_rh_record_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own repair history attachments" ON tools_rh_record_attachments;
CREATE POLICY "Users can view their own repair history attachments" ON tools_rh_record_attachments
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own repair history attachments" ON tools_rh_record_attachments;
CREATE POLICY "Users can insert their own repair history attachments" ON tools_rh_record_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own repair history attachments" ON tools_rh_record_attachments;
CREATE POLICY "Users can update their own repair history attachments" ON tools_rh_record_attachments
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own repair history attachments" ON tools_rh_record_attachments;
CREATE POLICY "Users can delete their own repair history attachments" ON tools_rh_record_attachments
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Move existing pictures into the shared store (same ids so re-runs skip them).
INSERT INTO tools_rh_record_attachments (id, record_id, user_id, file_url, file_name, file_size, file_type, created_at)
SELECT
  p.id,
  p.record_id,
  r.user_id,
  p.file_url,
  COALESCE(NULLIF(p.file_name, ''), 'Picture'),
  COALESCE(p.file_size, 0)::INTEGER,
  COALESCE(p.file_type, ''),
  COALESCE(p.created_at, NOW())
FROM tools_rh_repair_pictures p
JOIN tools_rh_records r ON r.id = p.record_id
ON CONFLICT (id) DO NOTHING;

-- Move existing receipt files.
INSERT INTO tools_rh_record_attachments (record_id, user_id, file_url, file_name, file_size, file_type, created_at)
SELECT
  r.id,
  r.user_id,
  r.receipt_file_url,
  COALESCE(NULLIF(r.receipt_file_name, ''), 'Receipt'),
  0,
  '',
  COALESCE(r.created_at, NOW())
FROM tools_rh_records r
WHERE r.receipt_file_url IS NOT NULL
  AND TRIM(r.receipt_file_url) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM tools_rh_record_attachments a
    WHERE a.record_id = r.id
      AND a.file_url = r.receipt_file_url
  );

-- Move existing warranty files.
INSERT INTO tools_rh_record_attachments (record_id, user_id, file_url, file_name, file_size, file_type, created_at)
SELECT
  r.id,
  r.user_id,
  r.warranty_file_url,
  COALESCE(NULLIF(r.warranty_file_name, ''), 'Warranty'),
  0,
  '',
  COALESCE(r.created_at, NOW())
FROM tools_rh_records r
WHERE r.warranty_file_url IS NOT NULL
  AND TRIM(r.warranty_file_url) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM tools_rh_record_attachments a
    WHERE a.record_id = r.id
      AND a.file_url = r.warranty_file_url
  );
