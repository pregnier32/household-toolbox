/**
 * Dashboard Calendar pin registry.
 * Stores the user's opt-in only. Dates and titles stay on the source tool row.
 *
 * source_type examples: calendar_event, travel_trip, pet_appointment, repair_warranty, todo_task
 * pin_kind examples: start, end, warranty, reminder_30d, default
 */

export const CALENDAR_SOURCE_CALENDAR_EVENT = 'calendar_event';
export const CALENDAR_PIN_KIND_DEFAULT = 'default';

export type CalendarPin = {
  id: string;
  user_id: string;
  tool_id: string;
  source_type: string;
  source_id: string;
  pin_kind: string;
  created_at: string;
};
