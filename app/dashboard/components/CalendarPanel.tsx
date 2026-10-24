'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarView } from './CalendarView';

export function CalendarPanel() {
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  const loadCalendarEvents = useCallback(async (month?: string) => {
    const monthParam = month || new Date().toISOString().slice(0, 7);

    try {
      const response = await fetch(`/api/dashboard/calendar?month=${monthParam}`);
      const data = await response.json().catch(() => ({ items: [] }));
      const calendarEventsItems = [...(data.items || [])];

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
