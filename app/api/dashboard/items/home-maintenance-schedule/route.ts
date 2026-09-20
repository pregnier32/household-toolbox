import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { CALENDAR_SOURCE_HOME_MAINTENANCE_TASK } from '@/lib/calendarPins';
import { getPinnedSourceIds } from '@/lib/calendarPinsServer';
import {
  asDateOnly,
  dbToFrequency,
  expandOccurrences,
  toIso,
} from '@/lib/home-maintenance-schedule';

function formatScheduledDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const scheduled = new Date(year, (month || 1) - 1, day || 1, 9, 0, 0, 0);
  return scheduled.toISOString();
}

export async function GET(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const toolId = searchParams.get('toolId');

    if (!monthParam) {
      return NextResponse.json({ error: 'month parameter is required (YYYY-MM format)' }, { status: 400 });
    }

    const [yearStr, monthStr] = monthParam.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;

    if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    const { ids: pinnedIds } = await getPinnedSourceIds({
      userId: user.id,
      sourceType: CALENDAR_SOURCE_HOME_MAINTENANCE_TASK,
      toolId: toolId || undefined,
    });

    if (pinnedIds.size === 0) {
      return NextResponse.json({ items: [] });
    }

    let query = supabaseServer
      .from('tools_hms_tasks')
      .select(`
        id,
        item_id,
        tool_id,
        frequency,
        interval_count,
        interval_unit,
        days_of_week,
        day_of_month,
        months,
        interval_years,
        next_due_date,
        is_active,
        location,
        notes,
        description_override,
        tools_hms_items!item_id (
          id,
          name,
          description,
          notes
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .in('id', Array.from(pinnedIds));

    if (toolId) {
      query = query.eq('tool_id', toolId);
    }

    const { data: tasks, error } = await query;

    if (error) {
      console.error('Error fetching home maintenance calendar items:', error);
      if (
        error.message?.includes('does not exist') ||
        error.message?.includes('schema cache') ||
        error.code === '42P01' ||
        error.code === 'PGRST116'
      ) {
        return NextResponse.json({ items: [] });
      }
      return NextResponse.json({ error: 'Failed to fetch home maintenance items' }, { status: 500 });
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const windowStart = toIso(new Date(year, month, 1));
    const windowEnd = toIso(new Date(year, month + 1, 0));
    const items: Array<{
      id: string;
      title: string;
      description?: string;
      type: string;
      scheduled_date: string;
      status: string;
      metadata: Record<string, unknown>;
      tools?: { id: string; name: string };
    }> = [];

    for (const task of tasks) {
      const item = Array.isArray(task.tools_hms_items) ? task.tools_hms_items[0] : task.tools_hms_items;
      const nextDue = asDateOnly(task.next_due_date);
      if (!nextDue) continue;

      const dates = expandOccurrences(nextDue, dbToFrequency(task), windowStart, windowEnd);
      const description =
        (typeof task.description_override === 'string' && task.description_override.trim()) ||
        item?.notes ||
        item?.description ||
        task.notes ||
        undefined;

      for (const date of dates) {
        items.push({
          id: `${task.id}-${date}`,
          title: item?.name || 'Maintenance task',
          description: description || undefined,
          type: 'calendar_event',
          scheduled_date: formatScheduledDate(date),
          status: 'pending',
          metadata: {
            referenceType: 'home_maintenance_task',
            referenceId: task.id,
            itemId: task.item_id,
            frequency: task.frequency,
            location: task.location || undefined,
          },
          tools: task.tool_id ? { id: task.tool_id, name: 'Home Maintenance Schedule' } : undefined,
        });
      }
    }

    items.sort(
      (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in home maintenance calendar API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
