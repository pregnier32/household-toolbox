-- Move Healthcare Appts storage RLS from the misspelled bucket
-- 'heathcare-appt-history' to 'healthcare-appt-history'.
-- The bucket itself is created via the Storage API; this only updates policies.
-- Safe to re-run.

DROP POLICY IF EXISTS "heathcare-appt-history: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "heathcare-appt-history: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "heathcare-appt-history: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "heathcare-appt-history: Users can delete their own files" ON storage.objects;

DROP POLICY IF EXISTS "healthcare-appt-history: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "healthcare-appt-history: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "healthcare-appt-history: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "healthcare-appt-history: Users can delete their own files" ON storage.objects;

CREATE POLICY "healthcare-appt-history: Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'healthcare-appt-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "healthcare-appt-history: Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'healthcare-appt-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "healthcare-appt-history: Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'healthcare-appt-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'healthcare-appt-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "healthcare-appt-history: Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'healthcare-appt-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
