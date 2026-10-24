import { NextRequest } from 'next/server';
import { CALENDAR_SOURCE_TODO_TASK } from '@/lib/calendarPins';
import { calendarSourceResponse, loadTodoItems } from '@/lib/dashboard-calendar';

export async function GET(request: NextRequest) {
  return calendarSourceResponse(request, {
    sourceType: CALENDAR_SOURCE_TODO_TASK,
    logLabel: 'to-do list',
    load: loadTodoItems,
  });
}
