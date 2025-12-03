-- Add trial fields to users_tools table for 7-day free trial functionality

-- Add trial_start_date column
ALTER TABLE users_tools 
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP WITH TIME ZONE;

-- Add trial_end_date column
ALTER TABLE users_tools 
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP WITH TIME ZONE;

-- Add index on trial_end_date for efficient expiration checks
CREATE INDEX IF NOT EXISTS idx_users_tools_trial_end_date ON users_tools(trial_end_date) 
WHERE trial_end_date IS NOT NULL;

-- Add index on status and trial_end_date for finding active trials
CREATE INDEX IF NOT EXISTS idx_users_tools_status_trial ON users_tools(status, trial_end_date) 
WHERE trial_end_date IS NOT NULL;

-- Update status CHECK constraint to include 'trial'
-- First, drop the existing constraint if it exists
ALTER TABLE users_tools 
DROP CONSTRAINT IF EXISTS users_tools_status_check;

-- Add new constraint that includes 'trial'
ALTER TABLE users_tools 
ADD CONSTRAINT users_tools_status_check 
CHECK (status IN ('active', 'inactive', 'cancelled', 'expired', 'trial'));

