import { NextRequest } from 'next/server';
import { CALENDAR_SOURCE_CALENDAR_EVENT } from '@/lib/calendarPins';
import { calendarSourceResponse, loadCalendarEventItems } from '@/lib/dashboard-calendar';

export async function GET(request: NextRequest) {
  return calendarSourceResponse(request, {
    sourceType: CALENDAR_SOURCE_CALENDAR_EVENT,
    logLabel: 'calendar events',
    load: loadCalendarEventItems,
  });
}
