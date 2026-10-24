import { NextRequest } from 'next/server';
import { dashboardCalendarResponse } from '@/lib/dashboard-calendar';

export async function GET(request: NextRequest) {
  return dashboardCalendarResponse(request);
}
