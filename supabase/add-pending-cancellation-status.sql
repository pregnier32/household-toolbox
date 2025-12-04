-- Add 'pending_cancellation' status to users_tools table
-- This allows tools to remain active and billable until the next billing cycle

-- Update status CHECK constraint to include 'pending_cancellation'
ALTER TABLE users_tools 
DROP CONSTRAINT IF EXISTS users_tools_status_check;

ALTER TABLE users_tools 
ADD CONSTRAINT users_tools_status_check 
CHECK (status IN ('active', 'inactive', 'cancelled', 'expired', 'trial', 'pending_cancellation'));

-- Add cancellation_effective_date column to track when the cancellation will take effect
ALTER TABLE users_tools
ADD COLUMN IF NOT EXISTS cancellation_effective_date TIMESTAMP WITH TIME ZONE;

-- Create index on cancellation_effective_date for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_tools_cancellation_effective_date ON users_tools(cancellation_effective_date)
WHERE cancellation_effective_date IS NOT NULL;

