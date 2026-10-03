import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { buildPromotionReport } from '@/lib/promotion-report-live';

function bounds(range: string, start: string, end: string): { start: string | null; end: string | null } {
  const now = new Date();
  const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  if (range === '7') return { start: daysAgo(7), end: endOfToday };
  if (range === '30') return { start: daysAgo(30), end: endOfToday };
  if (range === '90') return { start: daysAgo(90), end: endOfToday };
  if (range === 'this-month') {
    return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(), end: endOfToday };
  }
  if (range === 'last-month') {
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString(),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(),
    };
  }
  if (range === 'year') return { start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString(), end: endOfToday };
  if (range === 'custom' && start && end) return { start: `${start}T00:00:00.000Z`, end: `${end}T23:59:59.999Z` };
  return { start: null, end: null };
}

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.userStatus !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const range = request.nextUrl.searchParams.get('range') || 'all';
  const window = bounds(range, request.nextUrl.searchParams.get('start') || '', request.nextUrl.searchParams.get('end') || '');
  try {
    const report = await buildPromotionReport(window.start, window.end);
    return NextResponse.json(report);
  } catch (error) {
    console.error('Promotion report failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Promotion reporting could not be loaded.' }, { status: 500 });
  }
}
