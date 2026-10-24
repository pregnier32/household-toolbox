import { NextRequest, NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  CALENDAR_SOURCE_BUDGET_EVENT,
  CALENDAR_SOURCE_CALENDAR_EVENT,
  CALENDAR_SOURCE_CLEANING_TASK,
  CALENDAR_SOURCE_GOAL,
  CALENDAR_SOURCE_HEALTHCARE_APPOINTMENT,
  CALENDAR_SOURCE_HOME_MAINTENANCE_TASK,
  CALENDAR_SOURCE_PET_APPOINTMENT,
  CALENDAR_SOURCE_REPAIR_WARRANTY,
  CALENDAR_SOURCE_SUBSCRIPTION,
  CALENDAR_SOURCE_TODO_TASK,
  CALENDAR_SOURCE_TRAVEL_TRIP,
} from '@/lib/calendarPins';
import { getPinnedIdsBySource, getPinnedSourceIds } from '@/lib/calendarPinsServer';
import {
  asDateOnly as cleaningAsDateOnly,
  dbToFrequency as cleaningDbToFrequency,
  expandOccurrences as expandCleaningOccurrences,
  toIso as cleaningToIso,
} from '@/lib/cleaning-schedule';
import {
  asDateOnly as maintenanceAsDateOnly,
  dbToFrequency as maintenanceDbToFrequency,
  expandOccurrences as expandMaintenanceOccurrences,
  toIso as maintenanceToIso,
} from '@/lib/home-maintenance-schedule';
import { isQuarterMonth, quarterAnchorMonthIndex } from '@/lib/subscription-schedule';

export type DashboardCalendarItem = {
  id: string;
  title: string;
  description?: string;
  type: string;
  scheduled_date: string;
  priority?: string;
  status: string;
  metadata: Record<string, unknown>;
  tools?: { id: string; name: string };
};

export type CalendarLoadArgs = {
  userId: string;
  year: number;
  month: number;
  toolId?: string;
  pinnedIds: Set<string>;
};

export class CalendarSourceError extends Error {}

type MonthParse = { ok: true; year: number; month: number } | { ok: false; error: string };

function isMissingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST116' ||
    error.message?.includes('does not exist') === true ||
    error.message?.includes('schema cache') === true
  );
}

function asDateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).split('T')[0];
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function wallClock(isoDate: string, hours = 9, minutes = 0): string {
  const [yearStr, monthStr, dayStr] = asDateOnly(isoDate).split('-');
  const monthText = String(Number(monthStr)).padStart(2, '0');
  const dayText = String(Number(dayStr)).padStart(2, '0');
  const hourText = String(hours).padStart(2, '0');
  const minuteText = String(minutes).padStart(2, '0');
  return `${yearStr}-${monthText}-${dayText}T${hourText}:${minuteText}:00`;
}

function localIsoAtNine(isoDate: string): string {
  const scheduled = parseLocalDate(isoDate);
  scheduled.setHours(9, 0, 0, 0);
  return scheduled.toISOString();
}

function sortItems(items: DashboardCalendarItem[]): DashboardCalendarItem[] {
  return items.sort(
    (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
  );
}

function inMonth(isoDate: string, year: number, month: number): boolean {
  const localDate = parseLocalDate(isoDate);
  return localDate.getFullYear() === year && localDate.getMonth() === month;
}

export function parseCalendarMonth(monthParam: string | null): MonthParse {
  if (!monthParam) {
    return { ok: false, error: 'month parameter is required (YYYY-MM format)' };
  }
  const [yearStr, monthStr] = monthParam.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
    return { ok: false, error: 'Invalid month format. Use YYYY-MM' };
  }
  return { ok: true, year, month };
}

function applyToolId<T extends { eq: (column: string, value: string) => T }>(query: T, toolId?: string): T {
  if (!toolId) return query;
  return query.eq('tool_id', toolId);
}

export async function loadCalendarEventItems({
  userId,
  year,
  month,
  toolId,
  pinnedIds,
}: CalendarLoadArgs): Promise<DashboardCalendarItem[]> {
  if (pinnedIds.size === 0) return [];

  let query = supabaseServer
    .from('tools_ce_events')
    .select(`
      id,
      title,
      date,
      time,
      frequency,
      notes,
      is_active,
      end_date,
      days_of_week,
      day_of_month,
      category_id,
      tool_id,
      tools_ce_categories!category_id (
        id,
        name,
        card_color
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('id', Array.from(pinnedIds));
  query = applyToolId(query, toolId);

  const { data: events, error } = await query;
  if (error) {
    console.error('Error fetching calendar events:', error);
    if (isMissingTable(error)) return [];
    throw new CalendarSourceError('Failed to fetch calendar events');
  }

  const lastDayOfMonth = new Date(year, month + 1, 0);
  const items: DashboardCalendarItem[] = [];

  for (const event of events || []) {
    const startDate = parseLocalDate(event.date);
    const endDate = event.end_date ? parseLocalDate(event.end_date) : null;
    const isInDateRange = (date: Date): boolean => {
      if (date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    };
    const formatScheduledDate = (date: Date, time?: string | null): string => {
      const scheduled = new Date(date);
      if (time) {
        const [hours, minutes] = time.split(':').map(Number);
        scheduled.setHours(hours, minutes || 0, 0, 0);
      } else {
        scheduled.setHours(9, 0, 0, 0);
      }
      return scheduled.toISOString();
    };

    const category = Array.isArray(event.tools_ce_categories)
      ? event.tools_ce_categories[0]
      : event.tools_ce_categories;
    const push = (
      scheduledDate: string,
      metadata: Record<string, unknown>
    ) => {
      items.push({
        id: `${event.id}-${scheduledDate}`,
        title: event.title,
        description: event.notes || undefined,
        type: 'calendar_event',
        scheduled_date: scheduledDate,
        priority: undefined,
        status: 'pending',
        metadata: {
          ...metadata,
          categoryName: category?.name,
          categoryColor: category?.card_color,
        },
        tools: event.tool_id ? { id: event.tool_id, name: 'Calendar Events' } : undefined,
      });
    };

    if (event.frequency === 'One Time') {
      if (startDate.getFullYear() === year && startDate.getMonth() === month && isInDateRange(startDate)) {
        push(formatScheduledDate(startDate), {
          referenceType: 'calendar_event',
          referenceId: event.id,
          categoryId: event.category_id,
          frequency: event.frequency,
        });
      }
    } else if (event.frequency === 'Weekly' && Array.isArray(event.days_of_week) && event.days_of_week.length > 0) {
      for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const currentDate = new Date(year, month, day);
        if (
          event.days_of_week.includes(currentDate.getDay()) &&
          isInDateRange(currentDate) &&
          currentDate >= startDate
        ) {
          push(formatScheduledDate(currentDate, event.time), {
            referenceType: 'calendar_event',
            referenceId: event.id,
            categoryId: event.category_id,
            frequency: event.frequency,
            daysOfWeek: event.days_of_week,
          });
        }
      }
    } else if (event.frequency === 'Monthly' && event.day_of_month) {
      if (event.day_of_month <= lastDayOfMonth.getDate()) {
        const occurrenceDate = new Date(year, month, event.day_of_month);
        if (isInDateRange(occurrenceDate) && occurrenceDate >= startDate) {
          push(formatScheduledDate(occurrenceDate), {
            referenceType: 'calendar_event',
            referenceId: event.id,
            categoryId: event.category_id,
            frequency: event.frequency,
            dayOfMonth: event.day_of_month,
          });
        }
      }
    } else if (event.frequency === 'Annual') {
      if (month === startDate.getMonth() && startDate.getDate() <= lastDayOfMonth.getDate()) {
        const occurrenceDate = new Date(year, month, startDate.getDate());
        if (isInDateRange(occurrenceDate) && occurrenceDate >= startDate) {
          push(formatScheduledDate(occurrenceDate, event.time), {
            referenceType: 'calendar_event',
            referenceId: event.id,
            categoryId: event.category_id,
            frequency: event.frequency,
          });
        }
      }
    }
  }

  return items;
}

export async function loadCleaningScheduleItems({
  userId,
  year,
  month,
  toolId,
  pinnedIds,
}: CalendarLoadArgs): Promise<DashboardCalendarItem[]> {
  if (pinnedIds.size === 0) return [];

  let query = supabaseServer
    .from('tools_cs_tasks')
    .select(`
      id,
      item_id,
      tool_id,
      frequency,
      interval_count,
      interval_unit,
      days_of_week,
      day_of_month,
      next_due_date,
      is_active,
      tools_cs_items!item_id (
        id,
        name,
        description,
        notes
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('id', Array.from(pinnedIds));
  query = applyToolId(query, toolId);

  const { data: tasks, error } = await query;
  if (error) {
    console.error('Error fetching cleaning schedule calendar items:', error);
    if (isMissingTable(error)) return [];
    throw new CalendarSourceError('Failed to fetch cleaning schedule items');
  }

  const windowStart = cleaningToIso(new Date(year, month, 1));
  const windowEnd = cleaningToIso(new Date(year, month + 1, 0));
  const seenOccurrence = new Set<string>();
  const items: DashboardCalendarItem[] = [];

  for (const task of tasks || []) {
    const item = Array.isArray(task.tools_cs_items) ? task.tools_cs_items[0] : task.tools_cs_items;
    const nextDue = cleaningAsDateOnly(task.next_due_date);
    if (!nextDue) continue;
    const dates = expandCleaningOccurrences(nextDue, cleaningDbToFrequency(task), windowStart, windowEnd);
    for (const date of dates) {
      const occurrenceKey = `${task.item_id || task.id}-${date}`;
      if (seenOccurrence.has(occurrenceKey)) continue;
      seenOccurrence.add(occurrenceKey);
      const [y, m, d] = date.split('-').map(Number);
      const scheduled = new Date(y, (m || 1) - 1, d || 1, 9, 0, 0, 0);
      items.push({
        id: `${task.id}-${date}`,
        title: item?.name || 'Cleaning task',
        description: item?.notes || item?.description || undefined,
        type: 'calendar_event',
        scheduled_date: scheduled.toISOString(),
        status: 'pending',
        metadata: {
          referenceType: 'cleaning_task',
          referenceId: task.id,
          itemId: task.item_id,
          frequency: task.frequency,
        },
        tools: task.tool_id ? { id: task.tool_id, name: 'Cleaning Schedule' } : undefined,
      });
    }
  }

  return items;
}

export async function loadHomeMaintenanceItems({
  userId,
  year,
  month,
  toolId,
  pinnedIds,
}: CalendarLoadArgs): Promise<DashboardCalendarItem[]> {
  if (pinnedIds.size === 0) return [];

  let query = supabaseServer
    .from('tools_hms_tasks')
    .select(`
      id,
      item_id,
      tool_id,
      frequency,
      interval_count,
      interval_unit,
      days_of_week,
      day_of_month,
      months,
      interval_years,
      next_due_date,
      is_active,
      location,
      notes,
      description_override,
      tools_hms_items!item_id (
        id,
        name,
        description,
        notes
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('id', Array.from(pinnedIds));
  query = applyToolId(query, toolId);

  const { data: tasks, error } = await query;
  if (error) {
    console.error('Error fetching home maintenance calendar items:', error);
    if (isMissingTable(error)) return [];
    throw new CalendarSourceError('Failed to fetch home maintenance items');
  }

  const windowStart = maintenanceToIso(new Date(year, month, 1));
  const windowEnd = maintenanceToIso(new Date(year, month + 1, 0));
  const items: DashboardCalendarItem[] = [];

  for (const task of tasks || []) {
    const item = Array.isArray(task.tools_hms_items) ? task.tools_hms_items[0] : task.tools_hms_items;
    const nextDue = maintenanceAsDateOnly(task.next_due_date);
    if (!nextDue) continue;
    const dates = expandMaintenanceOccurrences(nextDue, maintenanceDbToFrequency(task), windowStart, windowEnd);
    const description =
      (typeof task.description_override === 'string' && task.description_override.trim()) ||
      item?.notes ||
      item?.description ||
      task.notes ||
      undefined;
    for (const date of dates) {
      const [y, m, d] = date.split('-').map(Number);
      const scheduled = new Date(y, (m || 1) - 1, d || 1, 9, 0, 0, 0);
      items.push({
        id: `${task.id}-${date}`,
        title: item?.name || 'Maintenance task',
        description: description || undefined,
        type: 'calendar_event',
        scheduled_date: scheduled.toISOString(),
        status: 'pending',
        metadata: {
          referenceType: 'home_maintenance_task',
          referenceId: task.id,
          itemId: task.item_id,
          frequency: task.frequency,
          location: task.location || undefined,
        },
        tools: task.tool_id ? { id: task.tool_id, name: 'Home Maintenance Schedule' } : undefined,
      });
    }
  }

  return items;
}

export async function loadGoalItems({
  userId,
  year,
  month,
  toolId,
  pinnedIds,
}: CalendarLoadArgs): Promise<DashboardCalendarItem[]> {
  if (pinnedIds.size === 0) return [];

  let query = supabaseServer
    .from('tools_gt_goals')
    .select('id, title, description, target_date, status, tool_id')
    .eq('user_id', userId)
    .neq('status', 'Completed')
    .in('id', Array.from(pinnedIds));
  query = applyToolId(query, toolId);

  const { data: goals, error } = await query;
  if (error) {
    console.error('Error fetching goals tracking calendar items:', error);
    if (isMissingTable(error)) return [];
    throw new CalendarSourceError('Failed to fetch goals tracking items');
  }

  return (goals || []).flatMap((goal) => {
    const targetDate = asDateOnly(goal.target_date);
    if (!targetDate || !inMonth(targetDate, year, month)) return [];
    return [
      {
        id: `${goal.id}-${targetDate}`,
        title: goal.title || 'Goal',
        description: goal.description || undefined,
        type: 'calendar_event',
        scheduled_date: localIsoAtNine(targetDate),
        status: 'pending',
        metadata: {
          referenceType: 'goal',
          referenceId: goal.id,
          goalStatus: goal.status,
        },
        tools: goal.tool_id ? { id: goal.tool_id, name: 'Goals Tracking' } : undefined,
      },
    ];
  });
}

export async function loadBudgetEventItems({
  userId,
  year,
  month,
  toolId,
  pinnedIds,
}: CalendarLoadArgs): Promise<DashboardCalendarItem[]> {
  if (pinnedIds.size === 0) return [];

  let query = supabaseServer
    .from('tools_ebp_events')
    .select('id, name, notes, event_date, tool_id, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('id', Array.from(pinnedIds));
  query = applyToolId(query, toolId);

  const { data: events, error } = await query;
  if (error) {
    console.error('Error fetching event budget planner calendar items:', error);
    if (isMissingTable(error)) return [];
    throw new CalendarSourceError('Failed to fetch event budget planner items');
  }

  return (events || []).flatMap((event) => {
    const eventDate = asDateOnly(event.event_date);
    if (!eventDate || !inMonth(eventDate, year, month)) return [];
    return [
      {
        id: `${event.id}-${eventDate}`,
        title: event.name || 'Event',
        description: event.notes || undefined,
        type: 'calendar_event',
        scheduled_date: localIsoAtNine(eventDate),
        status: 'pending',
        metadata: {
          referenceType: 'budget_event',
          referenceId: event.id,
        },
        tools: event.tool_id ? { id: event.tool_id, name: 'Event Budget Planner' } : undefined,
      },
    ];
  });
}

export async function loadTodoItems({
  userId,
  year,
  month,
  toolId,
  pinnedIds,
}: CalendarLoadArgs): Promise<DashboardCalendarItem[]> {
  if (pinnedIds.size === 0) return [];

  let query = supabaseServer
    .from('tools_tdl_tasks')
    .select(`
      id,
      task_name,
      due_date,
      notes,
      status,
      tool_id,
      category_id,
      tools_tdl_categories!category_id (
        id,
        name
      )
    `)
    .eq('user_id', userId)
    .neq('status', 'Completed')
    .in('id', Array.from(pinnedIds));
  query = applyToolId(query, toolId);

  const { data: tasks, error } = await query;
  if (error) {
    console.error('Error fetching to-do list calendar items:', error);
    if (isMissingTable(error)) return [];
    throw new CalendarSourceError('Failed to fetch to-do list items');
  }

  return (tasks || []).flatMap((task) => {
    const dueDate = asDateOnly(task.due_date);
    if (!dueDate || !inMonth(dueDate, year, month)) return [];
    const category = Array.isArray(task.tools_tdl_categories)
      ? task.tools_tdl_categories[0]
      : task.tools_tdl_categories;
    const categoryName = typeof category?.name === 'string' ? category.name.trim() : '';
    return [
      {
        id: `${task.id}-${dueDate}`,
        title: task.task_name || 'Task',
        description: task.notes || undefined,
        type: 'calendar_event',
        scheduled_date: wallClock(dueDate),
        status: 'pending',
        metadata: {
          referenceType: 'todo_task',
          referenceId: task.id,
          taskStatus: task.status,
          categoryName,
        },
        tools: task.tool_id ? { id: task.tool_id, name: 'To Do List' } : undefined,
      },
    ];
  });
}

export async function loadRepairItems({
  userId,
  year,
  month,
  toolId,
  pinnedIds,
}: CalendarLoadArgs): Promise<DashboardCalendarItem[]> {
  if (pinnedIds.size === 0) return [];

  let query = supabaseServer
    .from('tools_rh_records')
    .select('id, item_name, warranty_end_date, service_provider, notes, tool_id, header_id')
    .eq('user_id', userId)
    .in('id', Array.from(pinnedIds));
  query = applyToolId(query, toolId);

  const { data: records, error } = await query;
  if (error) {
    console.error('Error fetching repair history calendar items:', error);
    if (isMissingTable(error)) return [];
    throw new CalendarSourceError('Failed to fetch repair history items');
  }

  const headerIds = Array.from(new Set((records || []).map((record) => record.header_id).filter(Boolean)));
  const headerNames = new Map<string, string>();
  if (headerIds.length > 0) {
    const { data: headers } = await supabaseServer
      .from('tools_rh_headers')
      .select('id, name')
      .eq('user_id', userId)
      .in('id', headerIds);
    for (const header of headers || []) {
      headerNames.set(header.id, header.name?.trim() || '');
    }
  }

  return (records || []).flatMap((record) => {
    const warrantyDate = asDateOnly(record.warranty_end_date);
    if (!warrantyDate || !inMonth(warrantyDate, year, month)) return [];
    const name = record.item_name?.trim();
    return [
      {
        id: `${record.id}-${warrantyDate}`,
        title: name ? `${name} warranty` : 'Warranty',
        description: record.service_provider || record.notes || undefined,
        type: 'calendar_event',
        scheduled_date: wallClock(warrantyDate),
        status: 'pending',
        metadata: {
          referenceType: 'repair_warranty',
          referenceId: record.id,
          headerName: headerNames.get(record.header_id) || '',
          headerId: record.header_id,
        },
        tools: record.tool_id ? { id: record.tool_id, name: 'Repair History' } : undefined,
      },
    ];
  });
}

export async function loadHealthcareItems({
  userId,
  year,
  month,
  toolId,
  pinnedIds,
}: CalendarLoadArgs): Promise<DashboardCalendarItem[]> {
  if (pinnedIds.size === 0) return [];

  let query = supabaseServer
    .from('tools_hcah_records')
    .select('id, appointment_date, reason_for_visit, care_facility, provider_info, tool_id, header_id')
    .eq('user_id', userId)
    .in('id', Array.from(pinnedIds));
  query = applyToolId(query, toolId);

  const { data: records, error } = await query;
  if (error) {
    console.error('Error fetching healthcare appointment calendar items:', error);
    if (isMissingTable(error)) return [];
    throw new CalendarSourceError('Failed to fetch healthcare appointment items');
  }

  const headerIds = Array.from(new Set((records || []).map((record) => record.header_id).filter(Boolean)));
  const memberNames = new Map<string, string>();
  if (headerIds.length > 0) {
    const { data: headers } = await supabaseServer
      .from('tools_hcah_headers')
      .select('id, name')
      .eq('user_id', userId)
      .in('id', headerIds);
    for (const header of headers || []) {
      memberNames.set(header.id, header.name?.trim() || '');
    }
  }

  return (records || []).flatMap((record) => {
    const appointmentDate = asDateOnly(record.appointment_date);
    if (!appointmentDate || !inMonth(appointmentDate, year, month)) return [];
    const reasonText = record.reason_for_visit?.trim();
    const facilityText = record.care_facility?.trim();
    return [
      {
        id: `${record.id}-${appointmentDate}`,
        title: reasonText || facilityText || 'Appointment',
        description: record.provider_info || undefined,
        type: 'calendar_event',
        scheduled_date: localIsoAtNine(appointmentDate),
        status: 'pending',
        metadata: {
          referenceType: 'healthcare_appointment',
          referenceId: record.id,
          memberName: memberNames.get(record.header_id) || '',
          headerId: record.header_id,
        },
        tools: record.tool_id ? { id: record.tool_id, name: 'Healthcare Appts & History' } : undefined,
      },
    ];
  });
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(Math.max(1, day), lastDayOfMonth(year, month));
}

function paddedWallClock(year: number, month: number, day: number): string {
  const monthText = String(month + 1).padStart(2, '0');
  const dayText = String(day).padStart(2, '0');
  return `${year}-${monthText}-${dayText}T09:00:00`;
}

export async function loadSubscriptionItems({
  userId,
  year,
  month,
  toolId,
  pinnedIds,
}: CalendarLoadArgs): Promise<DashboardCalendarItem[]> {
  if (pinnedIds.size === 0) return [];

  let query = supabaseServer
    .from('tools_st_subscriptions')
    .select('id, name, amount, frequency, day_of_month, billed_date, renewal_date, date_added, notes, tool_id, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('id', Array.from(pinnedIds));
  query = applyToolId(query, toolId);

  const { data: subscriptions, error } = await query;
  if (error) {
    console.error('Error fetching subscription calendar items:', error);
    if (isMissingTable(error)) return [];
    throw new CalendarSourceError('Failed to fetch subscription items');
  }

  return (subscriptions || []).flatMap((subscription) => {
    const title = subscription.name?.trim() || 'Subscription';
    const numericAmount = typeof subscription.amount === 'number'
      ? subscription.amount
      : Number.parseFloat(String(subscription.amount ?? ''));
    const amountText = Number.isFinite(numericAmount) ? `$${numericAmount.toFixed(2)}` : '';
    const frequencyText = subscription.frequency ? String(subscription.frequency) : '';
    const amountLine = [amountText, frequencyText].filter(Boolean).join(' · ');
    const description = subscription.notes || amountLine || undefined;
    const tool = subscription.tool_id ? { id: subscription.tool_id, name: 'Subscription Tracker' } : undefined;

    if (subscription.frequency === 'monthly' || subscription.frequency === 'quarterly') {
      const day = Number(subscription.day_of_month);
      if (!Number.isFinite(day) || day < 1) return [];
      if (subscription.frequency === 'quarterly') {
        const anchorMonth = quarterAnchorMonthIndex(
          asDateOnly(subscription.billed_date),
          asDateOnly(subscription.date_added)
        );
        if (anchorMonth == null || !isQuarterMonth(month, anchorMonth)) return [];
      }
      const occurrenceDay = clampDay(year, month, day);
      return [
        {
          id: `${subscription.id}-${year}-${String(month + 1).padStart(2, '0')}-${String(occurrenceDay).padStart(2, '0')}`,
          title,
          description,
          type: 'calendar_event',
          scheduled_date: paddedWallClock(year, month, occurrenceDay),
          status: 'pending',
          metadata: {
            referenceType: 'subscription',
            referenceId: subscription.id,
            subscriptionName: title,
            frequency: subscription.frequency,
            dayOfMonth: day,
          },
          tools: tool,
        },
      ];
    }

    if (subscription.frequency === 'annual') {
      const anchor = asDateOnly(subscription.renewal_date) || asDateOnly(subscription.billed_date);
      if (!anchor) return [];
      const anchorDate = parseLocalDate(anchor);
      if (anchorDate.getMonth() !== month) return [];
      const occurrenceDay = clampDay(year, month, anchorDate.getDate());
      const occurrence = new Date(year, month, occurrenceDay);
      const billed = asDateOnly(subscription.billed_date);
      if (billed) {
        const billedDate = parseLocalDate(billed);
        if (occurrence < new Date(billedDate.getFullYear(), billedDate.getMonth(), 1)) return [];
      }
      return [
        {
          id: `${subscription.id}-${year}-${String(month + 1).padStart(2, '0')}-${String(occurrenceDay).padStart(2, '0')}`,
          title,
          description,
          type: 'calendar_event',
          scheduled_date: paddedWallClock(year, month, occurrenceDay),
          status: 'pending',
          metadata: {
            referenceType: 'subscription',
            referenceId: subscription.id,
            subscriptionName: title,
            frequency: subscription.frequency,
          },
          tools: tool,
        },
      ];
    }

    return [];
  });
}

export async function loadPetAppointmentItems({
  userId,
  year,
  month,
  toolId,
  pinnedIds,
}: CalendarLoadArgs): Promise<DashboardCalendarItem[]> {
  if (pinnedIds.size === 0) return [];

  const { data: appointments, error } = await supabaseServer
    .from('tools_pcs_appointments')
    .select(`
      id,
      pet_id,
      date,
      time,
      type,
      veterinarian,
      notes,
      tools_pcs_pets!pet_id (
        id,
        name,
        tool_id,
        user_id
      )
    `)
    .in('id', Array.from(pinnedIds));

  if (error) {
    console.error('Error fetching pet care calendar items:', error);
    if (isMissingTable(error)) return [];
    throw new CalendarSourceError('Failed to fetch pet care items');
  }

  return (appointments || []).flatMap((record) => {
    const pet = Array.isArray(record.tools_pcs_pets) ? record.tools_pcs_pets[0] : record.tools_pcs_pets;
    if (!pet || pet.user_id !== userId) return [];
    if (toolId && pet.tool_id !== toolId) return [];
    const appointmentDate = asDateOnly(record.date);
    if (!appointmentDate || !inMonth(appointmentDate, year, month)) return [];
    let hours = 9;
    let minutes = 0;
    if (record.time) {
      const [hourPart, minutePart] = String(record.time).split(':');
      const parsedHours = Number.parseInt(hourPart, 10);
      const parsedMinutes = Number.parseInt(minutePart, 10);
      if (Number.isFinite(parsedHours) && Number.isFinite(parsedMinutes)) {
        hours = parsedHours;
        minutes = parsedMinutes;
      }
    }
    const typeText = record.type?.trim();
    const vetText = record.veterinarian?.trim();
    return [
      {
        id: `${record.id}-${appointmentDate}`,
        title: typeText || vetText || 'Appointment',
        description: record.notes || record.veterinarian || undefined,
        type: 'calendar_event',
        scheduled_date: wallClock(appointmentDate, hours, minutes),
        status: 'pending',
        metadata: {
          referenceType: 'pet_appointment',
          referenceId: record.id,
          petId: record.pet_id,
          petName: pet.name?.trim() || '',
        },
        tools: pet.tool_id ? { id: pet.tool_id, name: 'Pet Care Schedule' } : undefined,
      },
    ];
  });
}

export async function loadTravelItems({
  userId,
  year,
  month,
  toolId,
  pinnedIds,
}: CalendarLoadArgs): Promise<DashboardCalendarItem[]> {
  if (pinnedIds.size === 0) return [];

  let query = supabaseServer
    .from('tools_tl_trips')
    .select('id, trip_name, destination, primary_destination, start_date, end_date, tool_id')
    .eq('user_id', userId)
    .in('id', Array.from(pinnedIds));
  query = applyToolId(query, toolId);

  const { data: trips, error } = await query;
  if (error) {
    console.error('Error fetching travel log calendar items:', error);
    if (isMissingTable(error)) return [];
    throw new CalendarSourceError('Failed to fetch travel log items');
  }

  return (trips || []).flatMap((trip) => {
    const startDate = asDateOnly(trip.start_date);
    const endDate = asDateOnly(trip.end_date);
    if (!startDate || !endDate) return [];
    const title = trip.trip_name?.trim() || 'Trip';
    const destination = String(trip.destination || trip.primary_destination || '').trim();
    const occurrences: Array<{ date: string; pinKind?: 'start' | 'end' }> =
      startDate === endDate
        ? [{ date: startDate }]
        : [
            { date: startDate, pinKind: 'start' },
            { date: endDate, pinKind: 'end' },
          ];

    return occurrences.flatMap(({ date, pinKind }) => {
      if (!inMonth(date, year, month)) return [];
      const place = destination;
      const description = pinKind
        ? place
          ? `${pinKind === 'start' ? 'Starts' : 'Ends'} · ${place}`
          : pinKind === 'start'
            ? 'Starts'
            : 'Ends'
        : place || undefined;
      return [
        {
          id: `${trip.id}-${date}-${pinKind || 'same'}`,
          title,
          description,
          type: 'calendar_event',
          scheduled_date: wallClock(date),
          status: 'pending',
          metadata: {
            referenceType: 'travel_trip',
            referenceId: trip.id,
            pinKind: pinKind || 'same',
            destination,
          },
          tools: trip.tool_id ? { id: trip.tool_id, name: 'Travel Log' } : undefined,
        },
      ];
    });
  });
}

const CALENDAR_LOADERS: Array<{
  sourceType: string;
  load: (args: CalendarLoadArgs) => Promise<DashboardCalendarItem[]>;
}> = [
  { sourceType: CALENDAR_SOURCE_CALENDAR_EVENT, load: loadCalendarEventItems },
  { sourceType: CALENDAR_SOURCE_CLEANING_TASK, load: loadCleaningScheduleItems },
  { sourceType: CALENDAR_SOURCE_BUDGET_EVENT, load: loadBudgetEventItems },
  { sourceType: CALENDAR_SOURCE_GOAL, load: loadGoalItems },
  { sourceType: CALENDAR_SOURCE_HEALTHCARE_APPOINTMENT, load: loadHealthcareItems },
  { sourceType: CALENDAR_SOURCE_HOME_MAINTENANCE_TASK, load: loadHomeMaintenanceItems },
  { sourceType: CALENDAR_SOURCE_PET_APPOINTMENT, load: loadPetAppointmentItems },
  { sourceType: CALENDAR_SOURCE_REPAIR_WARRANTY, load: loadRepairItems },
  { sourceType: CALENDAR_SOURCE_SUBSCRIPTION, load: loadSubscriptionItems },
  { sourceType: CALENDAR_SOURCE_TODO_TASK, load: loadTodoItems },
  { sourceType: CALENDAR_SOURCE_TRAVEL_TRIP, load: loadTravelItems },
];

export async function loadDashboardCalendarItems({
  userId,
  year,
  month,
  toolId,
  pins,
}: {
  userId: string;
  year: number;
  month: number;
  toolId?: string;
  pins: Map<string, Set<string>>;
}): Promise<DashboardCalendarItem[]> {
  const batches = await Promise.all(
    CALENDAR_LOADERS.map(async ({ sourceType, load }) => {
      const pinnedIds = pins.get(sourceType) ?? new Set<string>();
      if (pinnedIds.size === 0) return [];
      try {
        return await load({ userId, year, month, toolId, pinnedIds });
      } catch (error) {
        console.error(`Calendar source ${sourceType} failed`, error);
        return [];
      }
    })
  );

  return sortItems(batches.flat());
}

export async function calendarSourceResponse(
  request: NextRequest,
  options: {
    sourceType: string;
    logLabel: string;
    load: (args: CalendarLoadArgs) => Promise<DashboardCalendarItem[]>;
  }
) {
  const user = await getHouseholdDataSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseCalendarMonth(searchParams.get('month'));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const toolId = searchParams.get('toolId') || undefined;
    const { ids } = await getPinnedSourceIds({
      userId: user.id,
      sourceType: options.sourceType,
      toolId,
    });
    const items = sortItems(
      await options.load({
        userId: user.id,
        year: parsed.year,
        month: parsed.month,
        toolId,
        pinnedIds: ids,
      })
    );
    return NextResponse.json({ items });
  } catch (error) {
    console.error(`Error in ${options.logLabel} calendar API:`, error);
    if (error instanceof CalendarSourceError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function dashboardCalendarResponse(request: NextRequest) {
  const user = await getHouseholdDataSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseCalendarMonth(searchParams.get('month'));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const toolId = searchParams.get('toolId') || undefined;
    const pins = await getPinnedIdsBySource({ userId: user.id, toolId });
    const items = await loadDashboardCalendarItems({
      userId: user.id,
      year: parsed.year,
      month: parsed.month,
      toolId,
      pins,
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in dashboard calendar API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
