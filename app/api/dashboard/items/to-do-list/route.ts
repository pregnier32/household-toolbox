import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { CALENDAR_SOURCE_TODO_TASK } from '@/lib/calendarPins';
import { getPinnedSourceIds } from '@/lib/calendarPinsServer';

function asDateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).split('T')[0];
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatScheduledDate(isoDate: string): string {
  const scheduled = parseLocalDate(isoDate);
  scheduled.setHours(9, 0, 0, 0);
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
      sourceType: CALENDAR_SOURCE_TODO_TASK,
      toolId: toolId || undefined,
    });

    if (pinnedIds.size === 0) {
      return NextResponse.json({ items: [] });
    }

    let query = supabaseServer
      .from('tools_tdl_tasks')
      .select(`
        id,
        task_name,
        due_date,
        notes,
        status,
        tool_id,
        category_id,
        tools_tdl_categories!category_id (
          id,
          name
        )
      `)
      .eq('user_id', user.id)
      .neq('status', 'Completed')
      .in('id', Array.from(pinnedIds));

    if (toolId) {
      query = query.eq('tool_id', toolId);
    }

    const { data: tasks, error } = await query;

    if (error) {
      console.error('Error fetching to-do list calendar items:', error);
      if (
        error.message?.includes('does not exist') ||
        error.message?.includes('schema cache') ||
        error.code === '42P01' ||
        error.code === 'PGRST116'
      ) {
        return NextResponse.json({ items: [] });
      }
      return NextResponse.json({ error: 'Failed to fetch to-do list items' }, { status: 500 });
    }

    const items = (tasks || [])
      .flatMap((task) => {
        const dueDate = asDateOnly(task.due_date);
        if (!dueDate) return [];

        const localDate = parseLocalDate(dueDate);
        if (localDate.getFullYear() !== year || localDate.getMonth() !== month) {
          return [];
        }

        const category = Array.isArray(task.tools_tdl_categories)
          ? task.tools_tdl_categories[0]
          : task.tools_tdl_categories;
        const categoryName = typeof category?.name === 'string' ? category.name.trim() : '';

        return [
          {
            id: `${task.id}-${dueDate}`,
            title: task.task_name || 'Task',
            description: task.notes || undefined,
            type: 'calendar_event',
            scheduled_date: formatScheduledDate(dueDate),
            status: 'pending',
            metadata: {
              referenceType: 'todo_task',
              referenceId: task.id,
              taskStatus: task.status,
              categoryName,
            },
            tools: task.tool_id ? { id: task.tool_id, name: 'To Do List' } : undefined,
          },
        ];
      })
      .sort(
        (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      );

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in to-do list calendar API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
