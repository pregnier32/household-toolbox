import { NextRequest } from 'next/server';
import { CALENDAR_SOURCE_REPAIR_WARRANTY } from '@/lib/calendarPins';
import { calendarSourceResponse, loadRepairItems } from '@/lib/dashboard-calendar';

export async function GET(request: NextRequest) {
  return calendarSourceResponse(request, {
    sourceType: CALENDAR_SOURCE_REPAIR_WARRANTY,
    logLabel: 'repair history',
    load: loadRepairItems,
  });
}
