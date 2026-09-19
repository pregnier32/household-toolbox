-- Cleaning Schedule custom-category archive (inactivate / keep data).
-- Safe to re-run.

ALTER TABLE tools_cs_categories
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE tools_cs_categories
  ADD COLUMN IF NOT EXISTS date_inactivated DATE;

CREATE INDEX IF NOT EXISTS idx_cs_categories_is_active ON tools_cs_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_cs_categories_user_tool_active
  ON tools_cs_categories(user_id, tool_id, is_active);
