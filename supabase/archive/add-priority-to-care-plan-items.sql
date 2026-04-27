-- Add priority column to care plan items table
ALTER TABLE tools_PCS_care_plan_items
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high'));

