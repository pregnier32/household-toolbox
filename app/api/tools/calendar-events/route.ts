import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Fetch categories and events for the current user
export async function GET(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');
    const categoryId = searchParams.get('categoryId');

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    // Fetch categories
    const { data: categories, error: categoriesError } = await supabaseServer
      .from('tools_ce_categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }

    // Fetch events - if categoryId is provided, filter by category; otherwise get all events
    let events: any[] = [];
    let eventsQuery = supabaseServer
      .from('tools_ce_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId);
    
    if (categoryId) {
      eventsQuery = eventsQuery.eq('category_id', categoryId);
    }
    
    const { data: eventsData, error: eventsError } = await eventsQuery.order('date', { ascending: true });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      // Don't fail if events table doesn't exist yet
      if (eventsError.message?.includes('does not exist') || 
          eventsError.code === '42P01' ||
          eventsError.code === 'PGRST116') {
        events = [];
      } else {
        return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
      }
    } else {
      events = eventsData || [];
    }

    return NextResponse.json({
      categories: categories || [],
      events: events,
    });
  } catch (error) {
    console.error('Error in calendar events GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create or update categories and events
export async function POST(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { toolId, category, event, action } = body;

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    // Handle category operations
    if (action === 'create_category' && category) {
      const { data, error } = await supabaseServer
        .from('tools_ce_categories')
        .insert({
          user_id: user.id,
          tool_id: toolId,
          name: category.name,
          is_default: category.isDefault || false,
          card_color: category.card_color || '#10b981',
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating category:', error);
        return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
      }

      return NextResponse.json({ category: data });
    }

    if (action === 'update_category' && category) {
      const { data, error } = await supabaseServer
        .from('tools_ce_categories')
        .update({
          name: category.name,
          card_color: category.card_color,
        })
        .eq('id', category.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating category:', error);
        return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
      }

      return NextResponse.json({ category: data });
    }

    if (action === 'delete_category' && category?.id) {
      const { error } = await supabaseServer
        .from('tools_ce_categories')
        .delete()
        .eq('id', category.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting category:', error);
        return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Handle event operations
    if (action === 'create_event' && event) {
      const { data, error } = await supabaseServer
        .from('tools_ce_events')
        .insert({
          user_id: user.id,
          tool_id: toolId,
          category_id: event.categoryId,
          title: event.title,
          date: event.date,
          time: event.time || null,
          frequency: event.frequency,
          notes: event.notes || null,
          is_active: event.isActive !== undefined ? event.isActive : true,
          add_to_dashboard: event.addToDashboard !== undefined ? event.addToDashboard : true,
          end_date: event.endDate || null,
          days_of_week: event.daysOfWeek && event.daysOfWeek.length > 0 ? event.daysOfWeek : null,
          day_of_month: event.dayOfMonth || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating event:', error);
        return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
      }

      return NextResponse.json({ event: data });
    }

    if (action === 'update_event' && event) {
      const { data, error } = await supabaseServer
        .from('tools_ce_events')
        .update({
          title: event.title,
          date: event.date,
          time: event.time || null,
          frequency: event.frequency,
          notes: event.notes || null,
          is_active: event.isActive,
          add_to_dashboard: event.addToDashboard,
          end_date: event.endDate || null,
          days_of_week: event.frequency === 'Weekly' && event.daysOfWeek && event.daysOfWeek.length > 0 
            ? event.daysOfWeek 
            : null,
          day_of_month: event.frequency === 'Monthly' ? (event.dayOfMonth || null) : null,
        })
        .eq('id', event.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating event:', error);
        return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
      }

      return NextResponse.json({ event: data });
    }

    if (action === 'inactivate_event' && event?.id) {
      const { data, error } = await supabaseServer
        .from('tools_ce_events')
        .update({
          is_active: false,
          date_inactivated: new Date().toISOString().split('T')[0],
        })
        .eq('id', event.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error inactivating event:', error);
        return NextResponse.json({ error: 'Failed to inactivate event' }, { status: 500 });
      }

      return NextResponse.json({ event: data });
    }

    if (action === 'reactivate_event' && event?.id) {
      const { data, error } = await supabaseServer
        .from('tools_ce_events')
        .update({
          is_active: true,
          date_inactivated: null,
        })
        .eq('id', event.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error reactivating event:', error);
        return NextResponse.json({ error: 'Failed to reactivate event' }, { status: 500 });
      }

      return NextResponse.json({ event: data });
    }

    if (action === 'delete_event' && event?.id) {
      const { error } = await supabaseServer
        .from('tools_ce_events')
        .delete()
        .eq('id', event.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting event:', error);
        return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action or missing data' }, { status: 400 });
  } catch (error) {
    console.error('Error in calendar events POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
