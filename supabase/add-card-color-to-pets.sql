-- Add card_color column to tools_PCS_pets table
-- This allows users to customize the color of their pet cards

ALTER TABLE IF EXISTS tools_PCS_pets 
ADD COLUMN IF NOT EXISTS card_color TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN tools_PCS_pets.card_color IS 'Color for the pet card UI (hex color code)';
