-- Add time column to tools_ce_events table
-- This allows users to specify an optional time for calendar events

ALTER TABLE tools_ce_events 
ADD COLUMN IF NOT EXISTS time TIME;

-- Add comment to explain the column
COMMENT ON COLUMN tools_ce_events.time IS 'Optional time for the event in HH:MM format (24-hour). If NULL, event defaults to 9:00 AM on calendar display.';
