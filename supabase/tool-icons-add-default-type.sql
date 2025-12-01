-- Add 'default' to the allowed icon_type values in tool_icons table
-- This allows tools to have a single icon regardless of status

-- Drop the existing constraint
ALTER TABLE tool_icons DROP CONSTRAINT IF EXISTS tool_icons_icon_type_check;

-- Add the new constraint that includes 'default'
ALTER TABLE tool_icons ADD CONSTRAINT tool_icons_icon_type_check 
  CHECK (icon_type IN ('coming_soon', 'available', 'active', 'default'));

