-- Removes legacy billing/trial/promo database logic so you can rebuild for Stripe.
-- This script is DATABASE-ONLY (it does not delete app/api/frontend code files).
-- Safe-ish rerun behavior: uses IF EXISTS / guarded DO blocks where possible.

BEGIN;

-- ============================================================================
-- SECTION 1: Remove legacy billing engine tables + function
-- ============================================================================

-- Drop trigger first (safe even if table no longer exists)
DROP TRIGGER IF EXISTS trigger_update_billing_active_updated_at ON billing_active;

-- Drop function used by billing_active updated_at trigger
DROP FUNCTION IF EXISTS update_billing_active_updated_at();

-- Drop billing tables (indexes, policies, and constraints go with them)
DROP TABLE IF EXISTS billing_history;
DROP TABLE IF EXISTS billing_active;

-- ============================================================================
-- SECTION 2A: Remove users.billing_date
-- ============================================================================

DROP INDEX IF EXISTS idx_users_billing_date;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    ALTER TABLE users DROP COLUMN IF EXISTS billing_date;
  END IF;
END $$;

-- ============================================================================
-- SECTION 2B: Remove users_tools promo/trial/cancellation columns
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.users_tools') IS NOT NULL THEN
    ALTER TABLE users_tools DROP COLUMN IF EXISTS promo_code_id;
    ALTER TABLE users_tools DROP COLUMN IF EXISTS promo_expiration_date;
    ALTER TABLE users_tools DROP COLUMN IF EXISTS trial_start_date;
    ALTER TABLE users_tools DROP COLUMN IF EXISTS trial_end_date;
    ALTER TABLE users_tools DROP COLUMN IF EXISTS has_used_trial;
    ALTER TABLE users_tools DROP COLUMN IF EXISTS cancellation_effective_date;
  END IF;
END $$;

-- ============================================================================
-- SECTION 2C: Remove promo code table + platform fee config key
-- ============================================================================

DROP TABLE IF EXISTS promo_codes;

-- Remove platform fee setting keys (supports either table name)
DO $$
BEGIN
  IF to_regclass('public.settings') IS NOT NULL THEN
    DELETE FROM settings WHERE key = 'platform_fee';
  END IF;

  IF to_regclass('public.site_settings') IS NOT NULL THEN
    DELETE FROM site_settings WHERE key = 'platform_fee';
  END IF;
END $$;

-- ============================================================================
-- SECTION 2D: Normalize users_tools.status and remove pending/trial statuses
-- ============================================================================

DO $$
DECLARE
  has_users_tools BOOLEAN;
  status_constraint_name TEXT;
BEGIN
  has_users_tools := to_regclass('public.users_tools') IS NOT NULL;
  IF NOT has_users_tools THEN
    RETURN;
  END IF;

  -- Map legacy statuses to a simplified model
  UPDATE users_tools
  SET status = CASE
    WHEN status = 'trial' THEN 'active'
    WHEN status = 'pending_cancellation' THEN 'inactive'
    ELSE status
  END
  WHERE status IN ('trial', 'pending_cancellation');

  -- Drop existing status CHECK constraint if one exists
  SELECT con.conname
  INTO status_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'users_tools'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  ORDER BY con.oid
  LIMIT 1;

  IF status_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users_tools DROP CONSTRAINT %I', status_constraint_name);
  END IF;

  -- Re-add simplified status constraint
  ALTER TABLE users_tools
    ADD CONSTRAINT users_tools_status_check
    CHECK (status IN ('active', 'inactive'));

  -- Keep default status aligned
  ALTER TABLE users_tools
    ALTER COLUMN status SET DEFAULT 'active';
END $$;

COMMIT;
