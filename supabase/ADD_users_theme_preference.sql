-- Adds persisted UI theme preference to users table.
-- Safe to rerun.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS theme_preference TEXT;

UPDATE users
SET theme_preference = 'dark'
WHERE theme_preference IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_theme_preference_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_theme_preference_check
      CHECK (theme_preference IN ('light', 'dark'));
  END IF;
END $$;

ALTER TABLE users
  ALTER COLUMN theme_preference SET DEFAULT 'dark';

COMMIT;
