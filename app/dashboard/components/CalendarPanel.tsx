'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarView } from './CalendarView';

const CALENDAR_SOURCES = [
  'calendar-events',
  'cleaning-schedule',
  'event-budget-planner',
  'goals-tracking',
  'healthcare-appts',
  'home-maintenance-schedule',
  'pet-care-schedule',
  'repair-history',
  'subscription-tracker',
  'to-do-list',
  'travel-log',
] as const;

export function CalendarPanel() {
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  const loadCalendarEvents = useCallback(async (month?: string) => {
    const monthParam = month || new Date().toISOString().slice(0, 7);

    try {
      const responses = await Promise.all(
        CALENDAR_SOURCES.map((source) => fetch(`/api/dashboard/items/${source}?month=${monthParam}`))
      );
      const payloads = await Promise.all(responses.map((res) => res.json().catch(() => ({ items: [] }))));
      const calendarEventsItems = payloads.flatMap((data) => data.items || []);

      calendarEventsItems.sort(
        (a: { scheduled_date?: string; due_date?: string }, b: { scheduled_date?: string; due_date?: string }) => {
          const dateA = new Date(a.scheduled_date || a.due_date || 0).getTime();
          const dateB = new Date(b.scheduled_date || b.due_date || 0).getTime();
          return dateA - dateB;
        }
      );

      setCalendarEvents(calendarEventsItems);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      setCalendarEvents([]);
    }
  }, []);

  useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-50">Calendar</h1>
      <p className="mb-6 text-slate-400">View and manage your household calendar events and schedules.</p>
      <CalendarView calendarEvents={calendarEvents} onMonthChange={loadCalendarEvents} />
    </div>
  );
}
