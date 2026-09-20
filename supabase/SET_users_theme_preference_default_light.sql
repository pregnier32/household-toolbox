-- New accounts default to light mode.
-- Existing users keep their current theme_preference.
-- Safe to rerun.

ALTER TABLE users
  ALTER COLUMN theme_preference SET DEFAULT 'light';
