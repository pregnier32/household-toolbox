-- Create Storage Bucket for Important Documents Tool
-- This bucket stores important documents (warranties, policies, records, etc.)

-- Note: Storage buckets in Supabase are created via the Storage API or Dashboard
-- This SQL script provides the bucket configuration that should be applied

-- To create the bucket manually:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New bucket"
-- 3. Name: important-documents
-- 4. Public: true (or false if you want to use signed URLs)
-- 5. File size limit: 10MB
-- 6. Allowed MIME types: image/*, application/pdf

-- Storage Bucket Policies (RLS for Storage)
-- These policies ensure users can only access their own files

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "important-documents: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "important-documents: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "important-documents: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "important-documents: Users can delete their own files" ON storage.objects;

-- Policy: Allow authenticated users to upload files to their own folder
CREATE POLICY "important-documents: Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'important-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to read their own files
CREATE POLICY "important-documents: Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'important-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "important-documents: Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'important-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'important-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "important-documents: Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'important-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
