import { NextRequest } from 'next/server';
import { CALENDAR_SOURCE_CLEANING_TASK } from '@/lib/calendarPins';
import { calendarSourceResponse, loadCleaningScheduleItems } from '@/lib/dashboard-calendar';

export async function GET(request: NextRequest) {
  return calendarSourceResponse(request, {
    sourceType: CALENDAR_SOURCE_CLEANING_TASK,
    logLabel: 'cleaning schedule',
    load: loadCleaningScheduleItems,
  });
}
