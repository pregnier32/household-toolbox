-- Cleanup script to remove generic storage policies that may conflict
-- Run this before running the bucket-specific policy scripts

-- Drop generic policies if they exist (these may have been created for other buckets)
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
