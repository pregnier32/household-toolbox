import { NextRequest } from 'next/server';
import { CALENDAR_SOURCE_PET_APPOINTMENT } from '@/lib/calendarPins';
import { calendarSourceResponse, loadPetAppointmentItems } from '@/lib/dashboard-calendar';

export async function GET(request: NextRequest) {
  return calendarSourceResponse(request, {
    sourceType: CALENDAR_SOURCE_PET_APPOINTMENT,
    logLabel: 'pet care',
    load: loadPetAppointmentItems,
  });
}
