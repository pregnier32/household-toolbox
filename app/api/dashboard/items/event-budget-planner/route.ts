import { NextRequest } from 'next/server';
import { CALENDAR_SOURCE_BUDGET_EVENT } from '@/lib/calendarPins';
import { calendarSourceResponse, loadBudgetEventItems } from '@/lib/dashboard-calendar';

export async function GET(request: NextRequest) {
  return calendarSourceResponse(request, {
    sourceType: CALENDAR_SOURCE_BUDGET_EVENT,
    logLabel: 'event budget planner',
    load: loadBudgetEventItems,
  });
}
