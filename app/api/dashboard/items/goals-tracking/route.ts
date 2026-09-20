import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { CALENDAR_SOURCE_GOAL } from '@/lib/calendarPins';
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
      sourceType: CALENDAR_SOURCE_GOAL,
      toolId: toolId || undefined,
    });

    if (pinnedIds.size === 0) {
      return NextResponse.json({ items: [] });
    }

    let query = supabaseServer
      .from('tools_gt_goals')
      .select('id, title, description, target_date, status, tool_id')
      .eq('user_id', user.id)
      .neq('status', 'Completed')
      .in('id', Array.from(pinnedIds));

    if (toolId) {
      query = query.eq('tool_id', toolId);
    }

    const { data: goals, error } = await query;

    if (error) {
      console.error('Error fetching goals tracking calendar items:', error);
      if (
        error.message?.includes('does not exist') ||
        error.message?.includes('schema cache') ||
        error.code === '42P01' ||
        error.code === 'PGRST116'
      ) {
        return NextResponse.json({ items: [] });
      }
      return NextResponse.json({ error: 'Failed to fetch goals tracking items' }, { status: 500 });
    }

    const items = (goals || [])
      .flatMap((goal) => {
        const targetDate = asDateOnly(goal.target_date);
        if (!targetDate) return [];

        const localDate = parseLocalDate(targetDate);
        if (localDate.getFullYear() !== year || localDate.getMonth() !== month) {
          return [];
        }

        return [
          {
            id: `${goal.id}-${targetDate}`,
            title: goal.title || 'Goal',
            description: goal.description || undefined,
            type: 'calendar_event',
            scheduled_date: formatScheduledDate(targetDate),
            status: 'pending',
            metadata: {
              referenceType: 'goal',
              referenceId: goal.id,
              goalStatus: goal.status,
            },
            tools: goal.tool_id ? { id: goal.tool_id, name: 'Goals Tracking' } : undefined,
          },
        ];
      })
      .sort(
        (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      );

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in goals tracking calendar API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
