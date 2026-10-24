import { NextRequest } from 'next/server';
import { CALENDAR_SOURCE_GOAL } from '@/lib/calendarPins';
import { calendarSourceResponse, loadGoalItems } from '@/lib/dashboard-calendar';

export async function GET(request: NextRequest) {
  return calendarSourceResponse(request, {
    sourceType: CALENDAR_SOURCE_GOAL,
    logLabel: 'goals tracking',
    load: loadGoalItems,
  });
}
