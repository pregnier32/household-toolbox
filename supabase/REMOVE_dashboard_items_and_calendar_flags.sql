-- Removes the copied dashboard_items calendar model and per-tool calendar flags/FKs.
-- Run after create-calendar-pins-table.sql. Safe to run multiple times.
--
-- Does not touch leftover KPI widget flags (show_on_dashboard on shopping lists,
-- to-do categories, or goals). Those are a separate unused feature.

-- Drop FKs that point at dashboard_items before dropping the table.
ALTER TABLE IF EXISTS tools_rh_records
  DROP CONSTRAINT IF EXISTS tools_rh_records_warranty_dashboard_item_id_fkey;

ALTER TABLE IF EXISTS tools_st_subscriptions
  DROP CONSTRAINT IF EXISTS tools_st_subscriptions_calendar_reminder_id_fkey;

ALTER TABLE IF EXISTS tools_rh_records
  DROP COLUMN IF EXISTS warranty_dashboard_item_id;

ALTER TABLE IF EXISTS tools_st_subscriptions
  DROP COLUMN IF EXISTS calendar_reminder_id;

ALTER TABLE IF EXISTS tools_st_subscriptions
  DROP COLUMN IF EXISTS add_reminder_to_calendar;

ALTER TABLE IF EXISTS tools_tl_trips
  DROP COLUMN IF EXISTS add_to_dashboard;

DROP INDEX IF EXISTS idx_tl_trips_add_to_dashboard;

ALTER TABLE IF EXISTS tools_ce_events
  DROP COLUMN IF EXISTS add_to_dashboard;

DROP INDEX IF EXISTS idx_ce_events_add_to_dashboard;

ALTER TABLE IF EXISTS tools_pcs_care_plan_items
  DROP COLUMN IF EXISTS add_to_dashboard;

ALTER TABLE IF EXISTS tools_pcs_appointments
  DROP COLUMN IF EXISTS add_to_dashboard;

ALTER TABLE IF EXISTS tools_hcah_records
  DROP COLUMN IF EXISTS show_on_dashboard_calendar;

DROP TABLE IF EXISTS dashboard_items CASCADE;
DROP FUNCTION IF EXISTS update_dashboard_items_updated_at();

NOTIFY pgrst, 'reload schema';
