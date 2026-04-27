-- Add add_to_dashboard column to care plan items table
ALTER TABLE tools_PCS_care_plan_items
ADD COLUMN IF NOT EXISTS add_to_dashboard BOOLEAN DEFAULT true;

