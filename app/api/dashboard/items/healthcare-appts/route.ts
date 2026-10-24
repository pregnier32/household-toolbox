import { NextRequest } from 'next/server';
import { CALENDAR_SOURCE_HEALTHCARE_APPOINTMENT } from '@/lib/calendarPins';
import { calendarSourceResponse, loadHealthcareItems } from '@/lib/dashboard-calendar';

export async function GET(request: NextRequest) {
  return calendarSourceResponse(request, {
    sourceType: CALENDAR_SOURCE_HEALTHCARE_APPOINTMENT,
    logLabel: 'healthcare appointments',
    load: loadHealthcareItems,
  });
}
