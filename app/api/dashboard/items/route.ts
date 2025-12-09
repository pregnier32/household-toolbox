import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Fetch dashboard items for the current user
export async function GET(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'calendar_event', 'action_item', or 'both'
    const status = searchParams.get('status'); // 'pending', 'completed', 'cancelled'
    const month = searchParams.get('month'); // 'YYYY-MM' format for calendar filtering
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Build query with tool information
    let query = supabaseServer
      .from('dashboard_items')
      .select(`
        *,
        tools!tool_id (
          id,
          name
        )
      `)
      .eq('user_id', user.id);

    // Filter by type if provided
    if (type) {
      if (type === 'both') {
        query = query.in('type', ['calendar_event', 'both']);
      } else {
        query = query.or(`type.eq.${type},type.eq.both`);
      }
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    } else if (type === 'action_item') {
      // Default to pending for action items if no status specified
      query = query.eq('status', 'pending');
    }
    // Note: calendar_event type doesn't default to pending status filter

    // Filter by month for calendar items
    if (month && (type === 'calendar_event' || type === 'both')) {
      const [year, monthNum] = month.split('-');
      const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59);
      query = query
        .gte('scheduled_date', startDate.toISOString())
        .lte('scheduled_date', endDate.toISOString());
    }

    // Order by due_date or scheduled_date
    if (type === 'action_item' || type === 'both') {
      query = query.order('due_date', { ascending: true });
    } else {
      query = query.order('scheduled_date', { ascending: true });
    }

    // Apply pagination
    if (limit) {
      query = query.limit(parseInt(limit));
    }
    if (offset) {
      query = query.range(parseInt(offset), parseInt(offset) + (limit ? parseInt(limit) - 1 : 49));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching dashboard items:', error);
      // Check if table doesn't exist
      if (error.message?.includes('does not exist') || 
          error.message?.includes('schema cache') ||
          error.code === '42P01' ||
          error.code === 'PGRST116') {
        return NextResponse.json({ 
          error: 'Dashboard items table not set up. Please run the migration SQL file (create-dashboard-items-table.sql) in your Supabase SQL Editor.',
          items: []
        }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to fetch dashboard items', items: [] }, { status: 500 });
    }

    console.log(`Fetched ${data?.length || 0} dashboard items`);
    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error('Error in dashboard items API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new dashboard item
export async function POST(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      tool_id,
      title,
      description,
      type,
      due_date,
      scheduled_date,
      priority,
      status = 'pending',
      metadata = {},
    } = body;

    // Validate required fields
    if (!tool_id || !title || !type) {
      return NextResponse.json(
        { error: 'tool_id, title, and type are required' },
        { status: 400 }
      );
    }

    // Validate type
    if (!['calendar_event', 'action_item', 'both'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be calendar_event, action_item, or both' },
        { status: 400 }
      );
    }

    // Validate that at least one date is provided based on type
    if (type === 'calendar_event' && !scheduled_date) {
      return NextResponse.json(
        { error: 'scheduled_date is required for calendar_event type' },
        { status: 400 }
      );
    }

    if (type === 'action_item' && !due_date) {
      return NextResponse.json(
        { error: 'due_date is required for action_item type' },
        { status: 400 }
      );
    }

    // Insert the item
    const { data, error } = await supabaseServer
      .from('dashboard_items')
      .insert({
        user_id: user.id,
        tool_id,
        title,
        description,
        type,
        due_date: due_date || null,
        scheduled_date: scheduled_date || null,
        priority: priority || null,
        status,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating dashboard item:', error);
      return NextResponse.json({ error: 'Failed to create dashboard item' }, { status: 500 });
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    console.error('Error in dashboard items API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
