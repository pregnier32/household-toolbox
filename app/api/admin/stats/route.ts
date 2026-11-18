import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { getSiteStorageStatsAsOf } from '@/lib/user-storage';
import {
  calendarMonthKey,
  liveSubscriptionCharges,
  paymentsFromLedger,
  resolveAsOf,
  revenueByDayOfMonth,
  revenueSummary,
  type LedgerInvoiceRow,
  type LiveSubscriptionRow,
  type PaymentEventRow,
} from '@/lib/admin-overview-stats';

export async function GET(request: NextRequest) {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const asOf = resolveAsOf(request.nextUrl.searchParams.get('asOf'));
    const createdFrom = <T extends { gte: (column: string, value: string) => T }>(query: T): T => (
      query.gte('created_at', asOf.start)
    );

    const { count: adminStatusCount, error: adminStatusError } = await supabaseServer
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('user_status', 'admin')
      .gte('created_at', asOf.start);

    if (adminStatusError) {
      console.error('Error fetching admin user count:', adminStatusError);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Count guest users
    const { count: guestCount, error: guestError } = await supabaseServer
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('user_status', 'guest')
      .gte('created_at', asOf.start);

    if (guestError) {
      console.error('Error fetching guest user count:', guestError);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    const { data: superadminRows, error: superadminError } = await supabaseServer
      .from('users')
      .select('id')
      .eq('user_status', 'superadmin');

    if (superadminError) {
      console.error('Error fetching superadmin accounts:', superadminError);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    const superadminIds = (superadminRows || []).map((row) => row.id);
    const excludeSuperadmin = <T extends { not: (column: string, operator: string, value: string) => T }>(
      query: T,
      column: string,
    ) => (superadminIds.length === 0 ? query : query.not(column, 'in', `(${superadminIds.join(',')})`));

    // Count active tools owned by accounts other than superadmin
    const { count: activeTrialToolsCount, error: toolsError } = await excludeSuperadmin(
      createdFrom(supabaseServer.from('users_tools').select('*', { count: 'exact', head: true }).eq('status', 'active')),
      'user_id',
    );

    if (toolsError) {
      console.error('Error fetching active/trial tools count:', toolsError);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Average uses admin accounts only. Superadmin tools are already left out of the tool count.
    const avgToolsPerAdmin = adminStatusCount && adminStatusCount > 0
      ? (activeTrialToolsCount || 0) / adminStatusCount
      : 0;

    const { data: usersToolsData, error: usersToolsError } = await excludeSuperadmin(
      createdFrom(supabaseServer.from('users_tools').select('tool_id').eq('status', 'active')),
      'user_id',
    );

    if (usersToolsError) {
      console.error('Error fetching users_tools:', usersToolsError);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    const { data: allTools, error: allToolsError } = await supabaseServer
      .from('tools')
      .select('id, name, status')
      .neq('status', 'coming_soon');

    if (allToolsError) {
      console.error('Error fetching tools:', allToolsError);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    const toolCounts = new Map<string, number>();
    (usersToolsData || []).forEach((item) => {
      if (!item.tool_id) return;
      toolCounts.set(item.tool_id, (toolCounts.get(item.tool_id) || 0) + 1);
    });

    const toolsByName = (allTools || [])
      .map((tool) => ({
        id: tool.id,
        name: tool.name,
        value: toolCounts.get(tool.id) || 0,
      }))
      .sort((a, b) => {
        if (b.value !== a.value) return b.value - a.value;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

    const { data: usersData, error: usersError } = await supabaseServer
      .from('users')
      .select('created_at')
      .gte('created_at', asOf.start)
      .neq('user_status', 'superadmin');

    if (usersError) {
      console.error('Error fetching users by month:', usersError);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    const monthCounts = new Map<string, number>(asOf.series.map((item) => [item.monthKey, 0]));

    if (usersData) {
      usersData.forEach((row) => {
        if (!row.created_at) return;
        const monthKey = calendarMonthKey(new Date(row.created_at));
        if (!monthCounts.has(monthKey)) return;
        monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
      });
    }

    const responseData = asOf.series.map((item) => ({
      month: item.month,
      count: monthCounts.get(item.monthKey) || 0,
    }));

    const payments = await loadCollectedPayments(superadminIds);
    const revenue = revenueSummary(payments, asOf.date);
    const revenueByDay = await loadRevenueByDayOfMonth(superadminIds);
    const storageStats = await getSiteStorageStatsAsOf(superadminIds, asOf.start);

    return NextResponse.json({ 
      adminStatusCount: adminStatusCount || 0,
      guestUserCount: guestCount || 0,
      activeTrialToolsCount: activeTrialToolsCount || 0,
      avgToolsPerAdmin: Math.round(avgToolsPerAdmin * 100) / 100, // Round to 2 decimal places
      usersByMonth: responseData,
      toolsByName: toolsByName,
      asOfDate: asOf.date,
      monthlyRevenue: revenue.monthlyRevenue,
      lifetimeRevenue: revenue.lifetimeRevenue,
      revenueByDay,
      documentCount: storageStats.documentCount,
      storageUsedBytes: storageStats.usedBytes,
      storageUsedLabel: storageStats.usedLabel,
    });
  } catch (error) {
    console.error('Error in stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function missingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return error.code === '42P01' || error.code === 'PGRST205' || message.includes('does not exist') || message.includes('schema cache');
}

async function loadCollectedPayments(excludeUserIds: string[]): Promise<{ paidAt: string; amountCents: number }[]> {
  // System Stats reports live collections. Sandbox invoices stay out of the business totals.
  const livemode = true;

  const invoices = await supabaseServer
    .from('billing_invoices')
    .select('stripe_invoice_id, user_id, status, amount_paid_cents, created_at, livemode')
    .gt('amount_paid_cents', 0);
  if (invoices.error) {
    if (!missingRelation(invoices.error)) console.error('Error fetching paid invoices:', invoices.error);
    return [];
  }

  const events = await supabaseServer
    .from('stripe_events')
    .select('type, created_at, payload')
    .in('type', ['invoice.paid', 'payment_intent.succeeded'])
    .eq('livemode', livemode);
  if (events.error && !missingRelation(events.error)) {
    console.error('Error fetching payment timestamps:', events.error);
  }

  const invoiceRows: LedgerInvoiceRow[] = (invoices.data ?? []).flatMap((row) => {
    if (!row.stripe_invoice_id || !row.user_id || !row.created_at) return [];
    return [{
      stripeInvoiceId: row.stripe_invoice_id,
      userId: row.user_id,
      status: row.status ?? '',
      amountPaidCents: Number(row.amount_paid_cents) || 0,
      createdAt: row.created_at,
      livemode: typeof row.livemode === 'boolean' ? row.livemode : null,
    }];
  });
  const eventRows: PaymentEventRow[] = events.error ? [] : (events.data ?? []).flatMap((row) => {
    if (!row.type || !row.created_at) return [];
    return [{ type: row.type, createdAt: row.created_at, payload: row.payload }];
  });

  return paymentsFromLedger({
    invoices: invoiceRows,
    events: eventRows,
    livemode,
    excludeUserIds,
  });
}

async function loadRevenueByDayOfMonth(excludeUserIds: string[]): Promise<{ day: string; revenue: number }[]> {
  try {
    const accounts = await supabaseServer
      .from('billing_accounts')
      .select('user_id, subscription_status, cancel_at_period_end, billing_cycle_anchor, current_period_end, synced_amount_cents, livemode')
      .eq('livemode', true);
    if (accounts.error) {
      if (!missingRelation(accounts.error)) console.error('Error fetching live subscriptions:', accounts.error);
      return revenueByDayOfMonth([]);
    }
    const rows: LiveSubscriptionRow[] = (accounts.data ?? []).flatMap((row) => {
      if (!row.user_id) return [];
      return [{
        userId: row.user_id,
        status: row.subscription_status ?? null,
        cancelAtPeriodEnd: row.cancel_at_period_end === true,
        livemode: typeof row.livemode === 'boolean' ? row.livemode : null,
        billingCycleAnchor: row.billing_cycle_anchor ?? null,
        currentPeriodEnd: row.current_period_end ?? null,
        syncedAmountCents: Number(row.synced_amount_cents) || 0,
      }];
    });
    return revenueByDayOfMonth(liveSubscriptionCharges(rows, excludeUserIds));
  } catch (error) {
    console.error('Error building revenue by day:', error);
    return revenueByDayOfMonth([]);
  }
}

