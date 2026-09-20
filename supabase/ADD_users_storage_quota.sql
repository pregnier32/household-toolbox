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
