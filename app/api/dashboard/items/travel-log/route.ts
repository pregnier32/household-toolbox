import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { CALENDAR_SOURCE_TRAVEL_TRIP } from '@/lib/calendarPins';
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

function tripTitle(name: string | null | undefined): string {
  return name?.trim() || 'Trip';
}

function tripDescription(destination: string, pinKind?: 'start' | 'end'): string | undefined {
  const place = destination.trim();
  if (!pinKind) return place || undefined;
  const label = pinKind === 'start' ? 'Starts' : 'Ends';
  return place ? `${label} · ${place}` : label;
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
      sourceType: CALENDAR_SOURCE_TRAVEL_TRIP,
      toolId: toolId || undefined,
    });

    if (pinnedIds.size === 0) {
      return NextResponse.json({ items: [] });
    }

    let query = supabaseServer
      .from('tools_tl_trips')
      .select('id, trip_name, destination, primary_destination, start_date, end_date, tool_id')
      .eq('user_id', user.id)
      .in('id', Array.from(pinnedIds));

    if (toolId) {
      query = query.eq('tool_id', toolId);
    }

    const { data: trips, error } = await query;

    if (error) {
      console.error('Error fetching travel log calendar items:', error);
      if (
        error.message?.includes('does not exist') ||
        error.message?.includes('schema cache') ||
        error.code === '42P01' ||
        error.code === 'PGRST116'
      ) {
        return NextResponse.json({ items: [] });
      }
      return NextResponse.json({ error: 'Failed to fetch travel log items' }, { status: 500 });
    }

    const items = (trips || [])
      .flatMap((trip) => {
        const startDate = asDateOnly(trip.start_date);
        const endDate = asDateOnly(trip.end_date);
        if (!startDate || !endDate) return [];

        const title = tripTitle(trip.trip_name);
        const destination = String(trip.destination || trip.primary_destination || '').trim();
        const occurrences: Array<{
          date: string;
          pinKind?: 'start' | 'end';
        }> =
          startDate === endDate
            ? [{ date: startDate }]
            : [
                { date: startDate, pinKind: 'start' },
                { date: endDate, pinKind: 'end' },
              ];

        return occurrences.flatMap(({ date, pinKind }) => {
          const localDate = parseLocalDate(date);
          if (localDate.getFullYear() !== year || localDate.getMonth() !== month) {
            return [];
          }

          return [
            {
              id: `${trip.id}-${date}-${pinKind || 'same'}`,
              title,
              description: tripDescription(destination, pinKind),
              type: 'calendar_event',
              scheduled_date: formatScheduledDate(date),
              status: 'pending',
              metadata: {
                referenceType: 'travel_trip',
                referenceId: trip.id,
                pinKind: pinKind || 'same',
                destination,
              },
              tools: trip.tool_id ? { id: trip.tool_id, name: 'Travel Log' } : undefined,
            },
          ];
        });
      })
      .sort(
        (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      );

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in travel log calendar API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
