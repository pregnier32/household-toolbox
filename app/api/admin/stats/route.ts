import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { getSiteStorageStats } from '@/lib/user-storage';

export async function GET() {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { count: adminStatusCount, error: adminStatusError } = await supabaseServer
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('user_status', 'admin');

    if (adminStatusError) {
      console.error('Error fetching admin user count:', adminStatusError);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Count guest users
    const { count: guestCount, error: guestError } = await supabaseServer
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('user_status', 'guest');

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
      supabaseServer.from('users_tools').select('*', { count: 'exact', head: true }).eq('status', 'active'),
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
      supabaseServer.from('users_tools').select('tool_id').eq('status', 'active'),
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

    // Twelve months starting August 2026.
    const chartStart = new Date(2026, 7, 1);

    const { data: usersData, error: usersError } = await supabaseServer
      .from('users')
      .select('created_at')
      .gte('created_at', new Date(Date.UTC(2026, 7, 1)).toISOString())
      .neq('user_status', 'superadmin');

    if (usersError) {
      console.error('Error fetching users by month:', usersError);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    const monthsData: { month: string; count: number; monthKey: string }[] = [];
    const monthCounts = new Map<string, number>();

    for (let i = 0; i < 12; i++) {
      const cursor = new Date(chartStart.getFullYear(), chartStart.getMonth() + i, 1);
      const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthCounts.set(monthKey, 0);
      monthsData.push({ month: monthLabel, count: 0, monthKey });
    }

    // Count users by month
    if (usersData) {
      usersData.forEach((user) => {
        if (user.created_at) {
          const createdDate = new Date(user.created_at);
          const monthKey = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
          const currentCount = monthCounts.get(monthKey) || 0;
          monthCounts.set(monthKey, currentCount + 1);
        }
      });

      // Update monthsData with counts
      monthsData.forEach((item) => {
        item.count = monthCounts.get(item.monthKey) || 0;
      });
    }

    // Remove monthKey from response
    const responseData = monthsData.map(({ month, count }) => ({ month, count }));

    // Legacy billing tables were removed; return zero revenue values until Stripe replaces this.
    const monthlyRevenue = 0;
    const lifetimeRevenue = 0;
    const revenueByDay: { date: string; revenue: number }[] = [];
    const storageStats = await getSiteStorageStats(superadminIds);

    return NextResponse.json({ 
      adminStatusCount: adminStatusCount || 0,
      guestUserCount: guestCount || 0,
      activeTrialToolsCount: activeTrialToolsCount || 0,
      avgToolsPerAdmin: Math.round(avgToolsPerAdmin * 100) / 100, // Round to 2 decimal places
      usersByMonth: responseData,
      toolsByName: toolsByName,
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100, // Round to 2 decimal places
      lifetimeRevenue: Math.round(lifetimeRevenue * 100) / 100, // Round to 2 decimal places
      revenueByDay: revenueByDay,
      documentCount: storageStats.documentCount,
      storageUsedBytes: storageStats.usedBytes,
      storageUsedLabel: storageStats.usedLabel,
    });
  } catch (error) {
    console.error('Error in stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

