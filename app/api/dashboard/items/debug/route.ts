import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Debug endpoint to check all dashboard items
export async function GET(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all dashboard items for the user (no filters)
    const { data, error } = await supabaseServer
      .from('dashboard_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching dashboard items:', error);
      return NextResponse.json({ 
        error: error.message,
        items: [],
        errorCode: error.code
      }, { status: 500 });
    }

    return NextResponse.json({ 
      items: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json({ error: 'Internal server error', items: [] }, { status: 500 });
  }
}
