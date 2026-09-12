-- Persist checked-off state for shopping list line items (View full list).
-- Safe to rerun.

ALTER TABLE tools_sl_list_items
  ADD COLUMN IF NOT EXISTS is_checked BOOLEAN NOT NULL DEFAULT false;
