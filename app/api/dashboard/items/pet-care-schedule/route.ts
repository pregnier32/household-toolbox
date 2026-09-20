import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { CALENDAR_SOURCE_PET_APPOINTMENT } from '@/lib/calendarPins';
import { getPinnedSourceIds } from '@/lib/calendarPinsServer';

function asDateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).split('T')[0];
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatScheduledDate(isoDate: string, time?: string | null): string {
  const scheduled = parseLocalDate(isoDate);
  let hours = 9;
  let minutes = 0;
  if (time) {
    const [hourPart, minutePart] = String(time).split(':');
    const parsedHours = Number.parseInt(hourPart, 10);
    const parsedMinutes = Number.parseInt(minutePart, 10);
    if (Number.isFinite(parsedHours) && Number.isFinite(parsedMinutes)) {
      hours = parsedHours;
      minutes = parsedMinutes;
    }
  }
  scheduled.setHours(hours, minutes, 0, 0);
  return scheduled.toISOString();
}

function appointmentTitle(type: string | null | undefined, veterinarian: string | null | undefined): string {
  const typeText = type?.trim();
  if (typeText) return typeText;
  const vetText = veterinarian?.trim();
  if (vetText) return vetText;
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
      sourceType: CALENDAR_SOURCE_PET_APPOINTMENT,
      toolId: toolId || undefined,
    });

    if (pinnedIds.size === 0) {
      return NextResponse.json({ items: [] });
    }

    const { data: appointments, error } = await supabaseServer
      .from('tools_pcs_appointments')
      .select(`
        id,
        pet_id,
        date,
        time,
        type,
        veterinarian,
        notes,
        tools_pcs_pets!pet_id (
          id,
          name,
          tool_id,
          user_id
        )
      `)
      .in('id', Array.from(pinnedIds));

    if (error) {
      console.error('Error fetching pet care calendar items:', error);
      if (
        error.message?.includes('does not exist') ||
        error.message?.includes('schema cache') ||
        error.code === '42P01' ||
        error.code === 'PGRST116'
      ) {
        return NextResponse.json({ items: [] });
      }
      return NextResponse.json({ error: 'Failed to fetch pet care items' }, { status: 500 });
    }

    const items = (appointments || [])
      .flatMap((record) => {
        const pet = Array.isArray(record.tools_pcs_pets) ? record.tools_pcs_pets[0] : record.tools_pcs_pets;
        if (!pet || pet.user_id !== user.id) return [];
        if (toolId && pet.tool_id !== toolId) return [];

        const appointmentDate = asDateOnly(record.date);
        if (!appointmentDate) return [];

        const localDate = parseLocalDate(appointmentDate);
        if (localDate.getFullYear() !== year || localDate.getMonth() !== month) {
          return [];
        }

        return [
          {
            id: `${record.id}-${appointmentDate}`,
            title: appointmentTitle(record.type, record.veterinarian),
            description: record.notes || record.veterinarian || undefined,
            type: 'calendar_event',
            scheduled_date: formatScheduledDate(appointmentDate, record.time),
            status: 'pending',
            metadata: {
              referenceType: 'pet_appointment',
              referenceId: record.id,
              petId: record.pet_id,
              petName: pet.name?.trim() || '',
            },
            tools: pet.tool_id ? { id: pet.tool_id, name: 'Pet Care Schedule' } : undefined,
          },
        ];
      })
      .sort(
        (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      );

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in pet care calendar API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
