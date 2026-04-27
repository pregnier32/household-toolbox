-- Add billing_date column to users table
-- This stores the user's permanent billing date (day of month) that is set when they activate their first tool
-- The billing date is calculated as 8 days after the first tool trial starts (7-day trial + 1 day)

-- ============================================================================
-- 1. ADD billing_date COLUMN
-- ============================================================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS billing_date DATE NULL;

-- ============================================================================
-- 2. ADD INDEX FOR PERFORMANCE
-- ============================================================================

-- Index on billing_date for performance (used in billing queries)
CREATE INDEX IF NOT EXISTS idx_users_billing_date ON users(billing_date);

-- ============================================================================
-- 3. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN users.billing_date IS 'The day of month when billing occurs. Set to 8 days after first tool trial starts. Never changes once set.';

