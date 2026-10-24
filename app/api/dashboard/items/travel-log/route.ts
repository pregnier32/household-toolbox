import { NextRequest } from 'next/server';
import { CALENDAR_SOURCE_TRAVEL_TRIP } from '@/lib/calendarPins';
import { calendarSourceResponse, loadTravelItems } from '@/lib/dashboard-calendar';

export async function GET(request: NextRequest) {
  return calendarSourceResponse(request, {
    sourceType: CALENDAR_SOURCE_TRAVEL_TRIP,
    logLabel: 'travel log',
    load: loadTravelItems,
  });
}
