import { NextRequest } from 'next/server';
import { CALENDAR_SOURCE_HOME_MAINTENANCE_TASK } from '@/lib/calendarPins';
import { calendarSourceResponse, loadHomeMaintenanceItems } from '@/lib/dashboard-calendar';

export async function GET(request: NextRequest) {
  return calendarSourceResponse(request, {
    sourceType: CALENDAR_SOURCE_HOME_MAINTENANCE_TASK,
    logLabel: 'home maintenance',
    load: loadHomeMaintenanceItems,
  });
}
