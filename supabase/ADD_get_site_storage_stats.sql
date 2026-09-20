-- Site-wide storage KPI for Admin Overview.
-- Counts files in the tool attachment buckets and sums metadata size.
-- Safe to re-run.
--
-- The function is SECURITY DEFINER so it can read storage.objects.
-- Only the service role can execute it.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_site_storage_stats()
RETURNS TABLE(document_count bigint, used_bytes bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = storage, public
AS $$
  SELECT
    COUNT(*)::bigint AS document_count,
    COALESCE(
      SUM(
        CASE
          WHEN o.metadata ? 'size' THEN (o.metadata->>'size')::bigint
          ELSE 0
        END
      ),
      0
    )::bigint AS used_bytes
  FROM storage.objects o
  WHERE o.bucket_id = ANY (ARRAY[
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
  ]);
$$;

REVOKE ALL ON FUNCTION public.get_site_storage_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_site_storage_stats() FROM anon;
REVOKE ALL ON FUNCTION public.get_site_storage_stats() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_storage_stats() TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
