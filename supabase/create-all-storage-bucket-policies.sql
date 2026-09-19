-- Storage RLS for every Household Toolbox file bucket.
-- Safe to re-run. Does not create buckets; only (re)creates object policies.
-- Path rule: first folder must be the signed-in user's id.
--   {bucket}/{userId}/...
--
-- Run in Supabase Dashboard > SQL Editor.

-- Drop policies from the former misspelled bucket name.
DROP POLICY IF EXISTS "heathcare-appt-history: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "heathcare-appt-history: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "heathcare-appt-history: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "heathcare-appt-history: Users can delete their own files" ON storage.objects;

DO $$
DECLARE
  buckets text[] := ARRAY[
    'address-book',
    'calendar-events',
    'cleaning-schedule',
    'end-of-life-planner',
    'event-budget-planner',
    'goals-tracking',
    'healthcare-appt-history',
    'home-maintenance-schedule',
    'hsa-tracker',
    'important-documents',
    'meal-planner',
    'notes',
    'pet-care-schedule',
    'repair-history',
    'shopping-list',
    'subscription-tracker',
    'to-do-list',
    'travel-log'
  ];
  b text;
BEGIN
  FOREACH b IN ARRAY buckets LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ': Users can upload to their own folder');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ': Users can read their own files');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ': Users can update their own files');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ': Users can delete their own files');

    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)',
      b || ': Users can upload to their own folder',
      b
    );

    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)',
      b || ': Users can read their own files',
      b
    );

    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)',
      b || ': Users can update their own files',
      b,
      b
    );

    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)',
      b || ': Users can delete their own files',
      b
    );
  END LOOP;
END $$;
