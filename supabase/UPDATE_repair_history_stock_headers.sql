-- Repair History stock headers: Home + Auto (replace Auto1/Auto2).
-- Safe to rerun. Does not touch user repair records.

BEGIN;

UPDATE tools_rh_default_headers
SET name = 'Auto'
WHERE name = 'Auto1'
  AND category_type = 'Auto'
  AND NOT EXISTS (
    SELECT 1
    FROM tools_rh_default_headers existing
    WHERE existing.category_type = 'Auto'
      AND existing.name = 'Auto'
  );

DELETE FROM tools_rh_default_headers
WHERE category_type = 'Auto'
  AND name IN ('Auto1', 'Auto2');

INSERT INTO tools_rh_default_headers (name, card_color, category_type, display_order) VALUES
  ('Home', '#10b981', 'Home', 1),
  ('Auto', '#3b82f6', 'Auto', 2)
ON CONFLICT (category_type, name) DO NOTHING;

COMMIT;
