/**
 * Dashboard Calendar pin registry.
 * Stores the user's opt-in only. Dates and titles stay on the source tool row.
 *
 * source_type examples: calendar_event, cleaning_task, budget_event, goal, healthcare_appointment, home_maintenance_task, travel_trip, pet_appointment, repair_warranty, todo_task
 * pin_kind examples: start, end, warranty, reminder_30d, default
 */

export const CALENDAR_SOURCE_CALENDAR_EVENT = 'calendar_event';
export const CALENDAR_SOURCE_CLEANING_TASK = 'cleaning_task';
export const CALENDAR_SOURCE_BUDGET_EVENT = 'budget_event';
export const CALENDAR_SOURCE_GOAL = 'goal';
export const CALENDAR_SOURCE_HEALTHCARE_APPOINTMENT = 'healthcare_appointment';
export const CALENDAR_SOURCE_HOME_MAINTENANCE_TASK = 'home_maintenance_task';
export const CALENDAR_SOURCE_PET_APPOINTMENT = 'pet_appointment';
export const CALENDAR_SOURCE_REPAIR_WARRANTY = 'repair_warranty';
export const CALENDAR_SOURCE_SUBSCRIPTION = 'subscription';
export const CALENDAR_SOURCE_TODO_TASK = 'todo_task';
export const CALENDAR_SOURCE_TRAVEL_TRIP = 'travel_trip';
export const CALENDAR_PIN_KIND_DEFAULT = 'default';
export const CALENDAR_PIN_KIND_WARRANTY = 'warranty';
export const CALENDAR_PIN_KIND_START = 'start';
export const CALENDAR_PIN_KIND_END = 'end';

export type CalendarPin = {
  id: string;
  user_id: string;
  tool_id: string;
  source_type: string;
  source_id: string;
  pin_kind: string;
  created_at: string;
};
