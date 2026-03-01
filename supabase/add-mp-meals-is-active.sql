-- Add is_active to tools_mp_meals for existing databases (run if table already existed without this column)
ALTER TABLE tools_mp_meals ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_mp_meals_is_active ON tools_mp_meals(is_active);
