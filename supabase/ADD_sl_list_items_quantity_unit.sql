-- Optional quantity and unit on shopping list line items.
-- Required on live for SMS-198 (View/refresh qty+unit). Safe to rerun.
-- Existing name-only rows stay valid (columns nullable).
-- After apply, PostgREST must see the columns or insert/select still drop qty/unit.

ALTER TABLE tools_sl_list_items
  ADD COLUMN IF NOT EXISTS quantity NUMERIC;

ALTER TABLE tools_sl_list_items
  ADD COLUMN IF NOT EXISTS unit TEXT;

NOTIFY pgrst, 'reload schema';
