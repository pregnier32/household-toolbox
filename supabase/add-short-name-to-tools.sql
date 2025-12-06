-- Add short_name column to tools table for internal use
-- Maximum length is 6 characters
ALTER TABLE tools
ADD COLUMN IF NOT EXISTS short_name VARCHAR(6);

-- Before creating the unique index, we need to handle any existing duplicate short_name values
-- This will set duplicate short_name values to NULL (keeping only the first occurrence)
-- If you want to keep specific duplicates, you'll need to manually update them first
DO $$
DECLARE
  duplicate_record RECORD;
BEGIN
  -- Find all duplicate short_name values (excluding NULLs)
  FOR duplicate_record IN
    SELECT short_name, COUNT(*) as count
    FROM tools
    WHERE short_name IS NOT NULL
    GROUP BY short_name
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the first occurrence (by created_at or id) and clear the rest
    UPDATE tools
    SET short_name = NULL
    WHERE short_name = duplicate_record.short_name
      AND id NOT IN (
        SELECT id
        FROM tools
        WHERE short_name = duplicate_record.short_name
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      );
    
    RAISE NOTICE 'Cleared duplicate short_name: % (kept first occurrence, cleared % duplicates)', 
      duplicate_record.short_name, duplicate_record.count - 1;
  END LOOP;
END $$;

-- Create unique index on short_name for faster lookups and uniqueness constraint
-- NULL values are allowed (multiple NULLs are allowed in unique constraints)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tools_short_name_unique ON tools(short_name)
WHERE short_name IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN tools.short_name IS 'Short name for internal use only (max 6 characters). Must be unique if provided. Not displayed to users.';
