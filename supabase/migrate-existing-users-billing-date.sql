-- Migration script to set billing_date for existing users
-- This sets billing_date based on their oldest active/trial tool
-- The billing_date is calculated as 8 days after the first tool trial started
-- (7-day trial + 1 day = 8 days from trial_start_date, or created_at + 8 if no trial_start_date)

-- ============================================================================
-- SET billing_date FOR EXISTING USERS
-- ============================================================================

-- Update users who have active/trial tools but no billing_date set
-- Calculate billing_date from their oldest tool:
-- - If tool has trial_end_date, use trial_end_date + 1 day (trial_end_date is 7 days after start, so +1 = 8 days total)
-- - Otherwise, use created_at + 8 days
UPDATE users
SET billing_date = (
  SELECT 
    CASE 
      -- If tool has trial_end_date, billing_date should be 1 day after trial ends
      -- (trial_end_date is 7 days after start, so billing_date = trial_end_date + 1 = 8 days after start)
      WHEN ut.trial_end_date IS NOT NULL THEN (ut.trial_end_date::date + INTERVAL '1 day')::date
      -- Otherwise, use created_at + 8 days
      ELSE (ut.created_at::date + INTERVAL '8 days')::date
    END
  FROM users_tools ut
  WHERE ut.user_id = users.id
    AND ut.status IN ('active', 'trial', 'pending_cancellation')
  ORDER BY ut.created_at ASC
  LIMIT 1
)
WHERE billing_date IS NULL
  AND EXISTS (
    SELECT 1 
    FROM users_tools 
    WHERE user_id = users.id 
    AND status IN ('active', 'trial', 'pending_cancellation')
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check how many users now have billing_date set
-- SELECT COUNT(*) as users_with_billing_date FROM users WHERE billing_date IS NOT NULL;

-- Check how many users still need billing_date (should be 0 if all have tools)
-- SELECT COUNT(*) as users_without_billing_date FROM users WHERE billing_date IS NULL;

-- View sample of updated users
-- SELECT id, email, billing_date FROM users WHERE billing_date IS NOT NULL LIMIT 10;

