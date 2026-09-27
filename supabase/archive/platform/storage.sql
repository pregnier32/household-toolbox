-- Per-user storage quota and site-wide storage stats.
-- Safe to re-run. Execute is limited to the service role.

-- User attachment storage quota.
-- Free plan: 200 MB. Paid plan: 1 GB. Extra storage: +1 GB per storage_addon_gb.
-- Safe to re-run.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS storage_plan TEXT NOT NULL DEFAULT 'free';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS storage_addon_gb INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS storage_usage_updated_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_storage_plan_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_storage_plan_check
      CHECK (storage_plan IN ('free', 'paid'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_storage_addon_gb_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_storage_addon_gb_check
      CHECK (storage_addon_gb >= 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION get_user_storage_usage(p_user_id uuid)
RETURNS TABLE(bucket_id text, used_bytes bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = storage, public
AS $$
  SELECT
    o.bucket_id::text,
    COALESCE(SUM((o.metadata->>'size')::bigint), 0)::bigint AS used_bytes
  FROM storage.objects o
  WHERE o.metadata ? 'size'
    AND (
      o.name = p_user_id::text
      OR o.name LIKE p_user_id::text || '/%'
      OR o.name LIKE '%/' || p_user_id::text || '/%'
    )
  GROUP BY o.bucket_id;
$$;

REVOKE ALL ON FUNCTION get_user_storage_usage(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_user_storage_usage(uuid) FROM anon;
REVOKE ALL ON FUNCTION get_user_storage_usage(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_user_storage_usage(uuid) TO service_role;

COMMIT;


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

