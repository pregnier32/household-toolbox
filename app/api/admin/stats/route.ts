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

    return NextResponse.json({ activeUserCount: count || 0 });
  } catch (error) {
    console.error('Error in stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

