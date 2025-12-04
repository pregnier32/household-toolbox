-- Add has_used_trial column to users_tools table
-- This tracks whether a user has used their one-time free trial for a specific tool

-- Add has_used_trial column
ALTER TABLE users_tools 
ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT FALSE;

-- Create index on has_used_trial for efficient lookups
CREATE INDEX IF NOT EXISTS idx_users_tools_has_used_trial ON users_tools(has_used_trial) 
WHERE has_used_trial = TRUE;

-- Backfill: Set has_used_trial = TRUE for any existing records that have trial_start_date
-- This ensures existing trial users are marked as having used their trial
UPDATE users_tools 
SET has_used_trial = TRUE 
WHERE trial_start_date IS NOT NULL;

-- Also set has_used_trial = TRUE for any records that are currently in trial status
-- (in case trial_start_date is null but status is 'trial')
UPDATE users_tools 
SET has_used_trial = TRUE 
WHERE status = 'trial' AND has_used_trial = FALSE;

