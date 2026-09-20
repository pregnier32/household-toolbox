import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { CALENDAR_SOURCE_HEALTHCARE_APPOINTMENT } from '@/lib/calendarPins';
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

function appointmentTitle(reason: string | null | undefined, facility: string | null | undefined): string {
  const reasonText = reason?.trim();
  if (reasonText) return reasonText;
  const facilityText = facility?.trim();
  if (facilityText) return facilityText;
  return 'Appointment';
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
      sourceType: CALENDAR_SOURCE_HEALTHCARE_APPOINTMENT,
      toolId: toolId || undefined,
    });

    if (pinnedIds.size === 0) {
      return NextResponse.json({ items: [] });
    }

    let query = supabaseServer
      .from('tools_hcah_records')
      .select('id, appointment_date, reason_for_visit, care_facility, provider_info, tool_id, header_id')
      .eq('user_id', user.id)
      .in('id', Array.from(pinnedIds));

    if (toolId) {
      query = query.eq('tool_id', toolId);
    }

    const { data: records, error } = await query;

    if (error) {
      console.error('Error fetching healthcare appointment calendar items:', error);
      if (
        error.message?.includes('does not exist') ||
        error.message?.includes('schema cache') ||
        error.code === '42P01' ||
        error.code === 'PGRST116'
      ) {
        return NextResponse.json({ items: [] });
      }
      return NextResponse.json({ error: 'Failed to fetch healthcare appointment items' }, { status: 500 });
    }

    const headerIds = Array.from(new Set((records || []).map((record) => record.header_id).filter(Boolean)));
    const memberNames = new Map<string, string>();
    if (headerIds.length > 0) {
      const { data: headers } = await supabaseServer
        .from('tools_hcah_headers')
        .select('id, name')
        .eq('user_id', user.id)
        .in('id', headerIds);
      for (const header of headers || []) {
        memberNames.set(header.id, header.name?.trim() || '');
      }
    }

    const items = (records || [])
      .flatMap((record) => {
        const appointmentDate = asDateOnly(record.appointment_date);
        if (!appointmentDate) return [];

        const localDate = parseLocalDate(appointmentDate);
        if (localDate.getFullYear() !== year || localDate.getMonth() !== month) {
          return [];
        }

        return [
          {
            id: `${record.id}-${appointmentDate}`,
            title: appointmentTitle(record.reason_for_visit, record.care_facility),
            description: record.provider_info || undefined,
            type: 'calendar_event',
            scheduled_date: formatScheduledDate(appointmentDate),
            status: 'pending',
            metadata: {
              referenceType: 'healthcare_appointment',
              referenceId: record.id,
              memberName: memberNames.get(record.header_id) || '',
              headerId: record.header_id,
            },
            tools: record.tool_id ? { id: record.tool_id, name: 'Healthcare Appts & History' } : undefined,
          },
        ];
      })
      .sort(
        (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      );

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in healthcare appointment calendar API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
