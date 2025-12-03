import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

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

    // Count tools with active or trial status
    const { count: activeTrialToolsCount, error: toolsError } = await supabaseServer
      .from('users_tools')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'trial']);

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

    // Get tools with active or trial status, grouped by tool name
    const { data: toolsData, error: toolsDataError } = await supabaseServer
      .from('users_tools')
      .select(`
        tool_id,
        tools (
          name
        )
      `)
      .in('status', ['active', 'trial']);

    if (toolsDataError) {
      console.error('Error fetching tools by name:', toolsDataError);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Group by tool name and count
    const toolCounts = new Map<string, number>();
    if (toolsData) {
      toolsData.forEach((item) => {
        // Supabase returns related data as an array, even for one-to-one relationships
        const tools = item.tools as { name: string }[] | null;
        const tool = tools && tools.length > 0 ? tools[0] : null;
        const toolName = tool?.name || 'Unknown';
        const currentCount = toolCounts.get(toolName) || 0;
        toolCounts.set(toolName, currentCount + 1);
      });
    }

    // Convert to array format for the pie chart
    const toolsByName = Array.from(toolCounts.entries()).map(([name, count]) => ({
      name,
      value: count
    }));

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

    return NextResponse.json({ 
      activeUserCount: count || 0,
      guestUserCount: guestCount || 0,
      activeTrialToolsCount: activeTrialToolsCount || 0,
      avgToolsPerAdmin: Math.round(avgToolsPerAdmin * 100) / 100, // Round to 2 decimal places
      usersByMonth: responseData,
      toolsByName: toolsByName
    });
  } catch (error) {
    console.error('Error in stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

