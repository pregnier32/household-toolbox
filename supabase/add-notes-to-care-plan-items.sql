-- Add notes column to care plan items table
ALTER TABLE tools_PCS_care_plan_items
ADD COLUMN IF NOT EXISTS notes TEXT;

