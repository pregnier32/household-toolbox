import { NextRequest } from 'next/server';
import { CALENDAR_SOURCE_SUBSCRIPTION } from '@/lib/calendarPins';
import { calendarSourceResponse, loadSubscriptionItems } from '@/lib/dashboard-calendar';

export async function GET(request: NextRequest) {
  return calendarSourceResponse(request, {
    sourceType: CALENDAR_SOURCE_SUBSCRIPTION,
    logLabel: 'subscription tracker',
    load: loadSubscriptionItems,
  });
}
