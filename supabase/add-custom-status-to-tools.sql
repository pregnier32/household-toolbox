-- Add 'custom' status to tools table
-- This allows tools to be created for specific customers only
-- Custom tools will only be visible to users who have a users_tools record for that tool

-- Update status CHECK constraint to include 'custom'
ALTER TABLE tools 
DROP CONSTRAINT IF EXISTS tools_status_check;

ALTER TABLE tools 
ADD CONSTRAINT tools_status_check 
CHECK (status IN ('coming_soon', 'available', 'active', 'inactive', 'custom'));

