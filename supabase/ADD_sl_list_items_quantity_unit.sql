-- Optional quantity and unit on shopping list line items.
-- Safe to rerun. Existing name-only rows stay valid (columns nullable).

ALTER TABLE tools_sl_list_items
  ADD COLUMN IF NOT EXISTS quantity NUMERIC;

ALTER TABLE tools_sl_list_items
  ADD COLUMN IF NOT EXISTS unit TEXT;
