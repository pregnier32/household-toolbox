import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { CALENDAR_SOURCE_REPAIR_WARRANTY } from '@/lib/calendarPins';
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

function warrantyTitle(itemName: string | null | undefined): string {
  const name = itemName?.trim();
  if (name) return `${name} warranty`;
  return 'Warranty';
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
      sourceType: CALENDAR_SOURCE_REPAIR_WARRANTY,
      toolId: toolId || undefined,
    });

    if (pinnedIds.size === 0) {
      return NextResponse.json({ items: [] });
    }

    let query = supabaseServer
      .from('tools_rh_records')
      .select('id, item_name, warranty_end_date, service_provider, notes, tool_id, header_id')
      .eq('user_id', user.id)
      .in('id', Array.from(pinnedIds));

    if (toolId) {
      query = query.eq('tool_id', toolId);
    }

    const { data: records, error } = await query;

    if (error) {
      console.error('Error fetching repair history calendar items:', error);
      if (
        error.message?.includes('does not exist') ||
        error.message?.includes('schema cache') ||
        error.code === '42P01' ||
        error.code === 'PGRST116'
      ) {
        return NextResponse.json({ items: [] });
      }
      return NextResponse.json({ error: 'Failed to fetch repair history items' }, { status: 500 });
    }

    const headerIds = Array.from(new Set((records || []).map((record) => record.header_id).filter(Boolean)));
    const headerNames = new Map<string, string>();
    if (headerIds.length > 0) {
      const { data: headers } = await supabaseServer
        .from('tools_rh_headers')
        .select('id, name')
        .eq('user_id', user.id)
        .in('id', headerIds);
      for (const header of headers || []) {
        headerNames.set(header.id, header.name?.trim() || '');
      }
    }

    const items = (records || [])
      .flatMap((record) => {
        const warrantyDate = asDateOnly(record.warranty_end_date);
        if (!warrantyDate) return [];

        const localDate = parseLocalDate(warrantyDate);
        if (localDate.getFullYear() !== year || localDate.getMonth() !== month) {
          return [];
        }

        return [
          {
            id: `${record.id}-${warrantyDate}`,
            title: warrantyTitle(record.item_name),
            description: record.service_provider || record.notes || undefined,
            type: 'calendar_event',
            scheduled_date: formatScheduledDate(warrantyDate),
            status: 'pending',
            metadata: {
              referenceType: 'repair_warranty',
              referenceId: record.id,
              headerName: headerNames.get(record.header_id) || '',
              headerId: record.header_id,
            },
            tools: record.tool_id ? { id: record.tool_id, name: 'Repair History' } : undefined,
          },
        ];
      })
      .sort(
        (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      );

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in repair history calendar API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
