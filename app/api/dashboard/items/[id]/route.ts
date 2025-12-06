import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// PUT - Update a dashboard item
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;
    const body = await request.json();

    // Build update object (only include provided fields)
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.type !== undefined) {
      if (!['calendar_event', 'action_item', 'both'].includes(body.type)) {
        return NextResponse.json(
          { error: 'type must be calendar_event, action_item, or both' },
          { status: 400 }
        );
      }
      updateData.type = body.type;
    }
    if (body.due_date !== undefined) updateData.due_date = body.due_date || null;
    if (body.scheduled_date !== undefined) updateData.scheduled_date = body.scheduled_date || null;
    if (body.priority !== undefined) {
      if (body.priority && !['low', 'medium', 'high'].includes(body.priority)) {
        return NextResponse.json(
          { error: 'priority must be low, medium, or high' },
          { status: 400 }
        );
      }
      updateData.priority = body.priority || null;
    }
    if (body.status !== undefined) {
      if (!['pending', 'completed', 'cancelled'].includes(body.status)) {
        return NextResponse.json(
          { error: 'status must be pending, completed, or cancelled' },
          { status: 400 }
        );
      }
      updateData.status = body.status;
    }
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    // Update the item (only if it belongs to the user)
    const { data, error } = await supabaseServer
      .from('dashboard_items')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating dashboard item:', error);
      return NextResponse.json({ error: 'Failed to update dashboard item' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Dashboard item not found' }, { status: 404 });
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    console.error('Error in dashboard items API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a dashboard item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;

    // Delete the item (only if it belongs to the user)
    const { error } = await supabaseServer
      .from('dashboard_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting dashboard item:', error);
      return NextResponse.json({ error: 'Failed to delete dashboard item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in dashboard items API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
