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
    // Count users where active = 'Y'
    const { count, error } = await supabaseServer
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('active', 'Y');

    if (error) {
      console.error('Error fetching active user count:', error);
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

    // Count active tools
    const { count: activeTrialToolsCount, error: toolsError } = await supabaseServer
      .from('users_tools')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    if (toolsError) {
      console.error('Error fetching active/trial tools count:', toolsError);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Count admin users (admin or superadmin status)
    const { count: adminUserCount, error: adminUserError } = await supabaseServer
      .from('users')
      .select('*', { count: 'exact', head: true })
      .in('user_status', ['admin', 'superadmin']);

    if (adminUserError) {
      console.error('Error fetching admin user count:', adminUserError);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Calculate average active/trial tools per admin user
    const avgToolsPerAdmin = adminUserCount && adminUserCount > 0 
      ? (activeTrialToolsCount || 0) / adminUserCount 
      : 0;

    const { data: usersToolsData, error: usersToolsError } = await supabaseServer
      .from('users_tools')
      .select('tool_id')
      .eq('status', 'active');

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

    // Get users created in the last 12 months, grouped by month
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const { data: usersData, error: usersError } = await supabaseServer
      .from('users')
      .select('created_at')
      .gte('created_at', twelveMonthsAgo.toISOString());

    if (usersError) {
      console.error('Error fetching users by month:', usersError);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Initialize 12 months of data with 0 counts
    const monthsData: { month: string; count: number; monthKey: string }[] = [];
    const now = new Date();
    const monthCounts = new Map<string, number>();
    
    // Initialize all 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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
    const storageStats = await getSiteStorageStats();

    return NextResponse.json({ 
      activeUserCount: count || 0,
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

