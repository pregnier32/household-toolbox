-- Create Storage Bucket for Healthcare Appts and History Tool
-- This bucket stores appointment-related documents (per record)

-- Note: Storage buckets in Supabase are created via the Storage API or Dashboard
-- This SQL script provides the bucket configuration and RLS policies

-- To create the bucket manually:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New bucket"
-- 3. Name: heathcare-appt-history
-- 4. Public: true (or false if using signed URLs)
-- 5. File size limit: 10MB
-- 6. Allowed MIME types: image/*, application/pdf

-- Storage Bucket Policies (RLS for Storage)
-- Users can only access files in their own folder: {userId}/...

DROP POLICY IF EXISTS "heathcare-appt-history: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "heathcare-appt-history: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "heathcare-appt-history: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "heathcare-appt-history: Users can delete their own files" ON storage.objects;

CREATE POLICY "heathcare-appt-history: Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'heathcare-appt-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "heathcare-appt-history: Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'heathcare-appt-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "heathcare-appt-history: Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'heathcare-appt-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'heathcare-appt-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "heathcare-appt-history: Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'heathcare-appt-history' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
