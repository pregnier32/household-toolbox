-- Read-only aggregate. No object names, ids, or account ids.
SELECT jsonb_build_object(
  'matching_pairs', count(*),
  'distinct_objects', count(DISTINCT object.id),
  'distinct_buckets', count(DISTINCT object.bucket_id),
  'distinct_accounts', count(DISTINCT account.id),
  'match_is_second_segment', count(*) FILTER (
    WHERE split_part(object.name, '/', 2) = account.id::text
  ),
  'match_is_later_segment', count(*) FILTER (
    WHERE split_part(object.name, '/', 2) IS DISTINCT FROM account.id::text
  ),
  'first_segment_is_uuid', count(*) FILTER (
    WHERE split_part(object.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
) AS storage_shape
FROM storage.objects object
JOIN public.users account ON object.name LIKE '%/' || account.id::text || '/%'
WHERE object.name IS DISTINCT FROM account.id::text
  AND object.name NOT LIKE account.id::text || '/%';
