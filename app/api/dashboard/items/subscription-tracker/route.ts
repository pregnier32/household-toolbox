import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { CALENDAR_SOURCE_SUBSCRIPTION } from '@/lib/calendarPins';
import { getPinnedSourceIds } from '@/lib/calendarPinsServer';

function asDateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).split('T')[0];
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(Math.max(1, day), lastDayOfMonth(year, month));
}

function formatScheduledDate(year: number, month: number, day: number): string {
  const scheduled = new Date(year, month, day);
  scheduled.setHours(9, 0, 0, 0);
  return scheduled.toISOString();
}

function subscriptionTitle(name: string | null | undefined): string {
  return name?.trim() || 'Subscription';
}

function subscriptionDescription(
  amount: number | string | null | undefined,
  frequency: string | null | undefined
): string | undefined {
  const numericAmount = typeof amount === 'number' ? amount : Number.parseFloat(String(amount ?? ''));
  const amountText = Number.isFinite(numericAmount) ? `$${numericAmount.toFixed(2)}` : '';
  const frequencyText = frequency ? String(frequency) : '';
  const parts = [amountText, frequencyText].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
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
      sourceType: CALENDAR_SOURCE_SUBSCRIPTION,
      toolId: toolId || undefined,
    });

    if (pinnedIds.size === 0) {
      return NextResponse.json({ items: [] });
    }

    let query = supabaseServer
      .from('tools_st_subscriptions')
      .select('id, name, amount, frequency, day_of_month, billed_date, renewal_date, notes, tool_id, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .in('id', Array.from(pinnedIds));

    if (toolId) {
      query = query.eq('tool_id', toolId);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      console.error('Error fetching subscription calendar items:', error);
      if (
        error.message?.includes('does not exist') ||
        error.message?.includes('schema cache') ||
        error.code === '42P01' ||
        error.code === 'PGRST116'
      ) {
        return NextResponse.json({ items: [] });
      }
      return NextResponse.json({ error: 'Failed to fetch subscription items' }, { status: 500 });
    }

    const items = (subscriptions || [])
      .flatMap((subscription) => {
        const title = subscriptionTitle(subscription.name);
        const description = subscription.notes || subscriptionDescription(subscription.amount, subscription.frequency);

        if (subscription.frequency === 'monthly') {
          const day = Number(subscription.day_of_month);
          if (!Number.isFinite(day) || day < 1) return [];
          const occurrenceDay = clampDay(year, month, day);
          return [
            {
              id: `${subscription.id}-${year}-${String(month + 1).padStart(2, '0')}-${String(occurrenceDay).padStart(2, '0')}`,
              title,
              description,
              type: 'calendar_event',
              scheduled_date: formatScheduledDate(year, month, occurrenceDay),
              status: 'pending',
              metadata: {
                referenceType: 'subscription',
                referenceId: subscription.id,
                subscriptionName: title,
                frequency: subscription.frequency,
                dayOfMonth: day,
              },
              tools: subscription.tool_id ? { id: subscription.tool_id, name: 'Subscription Tracker' } : undefined,
            },
          ];
        }

        if (subscription.frequency === 'annual') {
          const anchor = asDateOnly(subscription.renewal_date) || asDateOnly(subscription.billed_date);
          if (!anchor) return [];
          const anchorDate = parseLocalDate(anchor);
          if (anchorDate.getMonth() !== month) return [];

          const occurrenceDay = clampDay(year, month, anchorDate.getDate());
          const occurrence = new Date(year, month, occurrenceDay);
          const billed = asDateOnly(subscription.billed_date);
          if (billed) {
            const billedDate = parseLocalDate(billed);
            if (occurrence < new Date(billedDate.getFullYear(), billedDate.getMonth(), 1)) return [];
          }

          return [
            {
              id: `${subscription.id}-${year}-${String(month + 1).padStart(2, '0')}-${String(occurrenceDay).padStart(2, '0')}`,
              title,
              description,
              type: 'calendar_event',
              scheduled_date: formatScheduledDate(year, month, occurrenceDay),
              status: 'pending',
              metadata: {
                referenceType: 'subscription',
                referenceId: subscription.id,
                subscriptionName: title,
                frequency: subscription.frequency,
              },
              tools: subscription.tool_id ? { id: subscription.tool_id, name: 'Subscription Tracker' } : undefined,
            },
          ];
        }

        return [];
      })
      .sort(
        (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      );

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in subscription tracker calendar API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
