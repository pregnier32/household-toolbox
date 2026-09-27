-- One-time cleanup after disabling KPI/dashboard integrations in tool UIs.
-- Safe to run multiple times.

BEGIN;

WITH target_tools AS (
  SELECT id
  FROM tools
  WHERE name IN (
    'Goals Tracking',
    'Calendar Events',
    'Pet Care Schedule',
    'Healthcare Appts and History',
    'Healthcare Appts & History',
    'To Do List',
    'Shopping List',
    'Repair History',
    'Subscription Tracker'
  )
)
UPDATE tools_gt_goals
SET show_on_dashboard = false
WHERE tool_id IN (SELECT id FROM target_tools)
  AND show_on_dashboard = true;

WITH target_tools AS (
  SELECT id
  FROM tools
  WHERE name IN (
    'Goals Tracking',
    'Calendar Events',
    'Pet Care Schedule',
    'Healthcare Appts and History',
    'Healthcare Appts & History',
    'To Do List',
    'Shopping List',
    'Repair History',
    'Subscription Tracker'
  )
)
UPDATE tools_tdl_categories
SET show_on_dashboard = false
WHERE tool_id IN (SELECT id FROM target_tools)
  AND show_on_dashboard = true;

WITH target_tools AS (
  SELECT id
  FROM tools
  WHERE name IN (
    'Goals Tracking',
    'Calendar Events',
    'Pet Care Schedule',
    'Healthcare Appts and History',
    'Healthcare Appts & History',
    'To Do List',
    'Shopping List',
    'Repair History',
    'Subscription Tracker'
  )
)
UPDATE tools_sl_lists
SET show_on_dashboard = false
WHERE tool_id IN (SELECT id FROM target_tools)
  AND show_on_dashboard = true;

WITH target_tools AS (
  SELECT id
  FROM tools
  WHERE name IN (
    'Goals Tracking',
    'Calendar Events',
    'Pet Care Schedule',
    'Healthcare Appts and History',
    'Healthcare Appts & History',
    'To Do List',
    'Shopping List',
    'Repair History',
    'Subscription Tracker'
  )
)
UPDATE tools_ce_events
SET add_to_dashboard = false
WHERE tool_id IN (SELECT id FROM target_tools)
  AND COALESCE(add_to_dashboard, false) = true;

WITH target_tools AS (
  SELECT id
  FROM tools
  WHERE name IN (
    'Goals Tracking',
    'Calendar Events',
    'Pet Care Schedule',
    'Healthcare Appts and History',
    'Healthcare Appts & History',
    'To Do List',
    'Shopping List',
    'Repair History',
    'Subscription Tracker'
  )
)
UPDATE tools_PCS_care_plan_items
SET add_to_dashboard = false
WHERE pet_id IN (
  SELECT p.id
  FROM tools_PCS_pets p
  WHERE p.tool_id IN (SELECT id FROM target_tools)
)
  AND COALESCE(add_to_dashboard, false) = true;

WITH target_tools AS (
  SELECT id
  FROM tools
  WHERE name IN (
    'Goals Tracking',
    'Calendar Events',
    'Pet Care Schedule',
    'Healthcare Appts and History',
    'Healthcare Appts & History',
    'To Do List',
    'Shopping List',
    'Repair History',
    'Subscription Tracker'
  )
)
UPDATE tools_PCS_appointments
SET add_to_dashboard = false
WHERE pet_id IN (
  SELECT p.id
  FROM tools_PCS_pets p
  WHERE p.tool_id IN (SELECT id FROM target_tools)
)
  AND COALESCE(add_to_dashboard, false) = true;

WITH target_tools AS (
  SELECT id
  FROM tools
  WHERE name IN (
    'Goals Tracking',
    'Calendar Events',
    'Pet Care Schedule',
    'Healthcare Appts and History',
    'Healthcare Appts & History',
    'To Do List',
    'Shopping List',
    'Repair History',
    'Subscription Tracker'
  )
)
UPDATE tools_hcah_records
SET show_on_dashboard_calendar = false
WHERE tool_id IN (SELECT id FROM target_tools)
  AND COALESCE(show_on_dashboard_calendar, false) = true;

WITH target_tools AS (
  SELECT id
  FROM tools
  WHERE name IN (
    'Goals Tracking',
    'Calendar Events',
    'Pet Care Schedule',
    'Healthcare Appts and History',
    'Healthcare Appts & History',
    'To Do List',
    'Shopping List',
    'Repair History',
    'Subscription Tracker'
  )
)
UPDATE tools_rh_records
SET warranty_dashboard_item_id = NULL
WHERE tool_id IN (SELECT id FROM target_tools)
  AND warranty_dashboard_item_id IS NOT NULL;

WITH target_tools AS (
  SELECT id
  FROM tools
  WHERE name IN (
    'Goals Tracking',
    'Calendar Events',
    'Pet Care Schedule',
    'Healthcare Appts and History',
    'Healthcare Appts & History',
    'To Do List',
    'Shopping List',
    'Repair History',
    'Subscription Tracker'
  )
)
UPDATE tools_st_subscriptions
SET calendar_reminder_id = NULL
WHERE tool_id IN (SELECT id FROM target_tools)
  AND calendar_reminder_id IS NOT NULL;

WITH target_tools AS (
  SELECT id
  FROM tools
  WHERE name IN (
    'Goals Tracking',
    'Calendar Events',
    'Pet Care Schedule',
    'Healthcare Appts and History',
    'Healthcare Appts & History',
    'To Do List',
    'Shopping List',
    'Repair History',
    'Subscription Tracker'
  )
)
DELETE FROM dashboard_items
WHERE tool_id IN (SELECT id FROM target_tools);

COMMIT;
