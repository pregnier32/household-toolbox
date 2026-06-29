import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { typeId, toolId, name, action } = body;

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    if (action === 'inactivate' && typeId) {
      const { error } = await supabaseServer
        .from('tools_ebp_types')
        .update({ is_active: false, date_inactivated: todayIso() })
        .eq('id', typeId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error inactivating type:', error);
        return NextResponse.json({ error: 'Failed to inactivate type' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'activate' && typeId) {
      const { error } = await supabaseServer
        .from('tools_ebp_types')
        .update({ is_active: true, date_inactivated: null })
        .eq('id', typeId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error activating type:', error);
        return NextResponse.json({ error: 'Failed to activate type' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Type name is required' }, { status: 400 });
    }

    const trimmedName = String(name).trim();

    if (typeId) {
      const { data: existing } = await supabaseServer
        .from('tools_ebp_types')
        .select('id')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .eq('name', trimmedName)
        .neq('id', typeId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: 'A type with this name already exists' }, { status: 400 });
      }

      const { data: updated, error } = await supabaseServer
        .from('tools_ebp_types')
        .update({ name: trimmedName })
        .eq('id', typeId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .select()
        .single();

      if (error) {
        console.error('Error updating type:', error);
        return NextResponse.json({ error: 'Failed to update type' }, { status: 500 });
      }

      return NextResponse.json({ type: updated });
    }

    const { data: existing } = await supabaseServer
      .from('tools_ebp_types')
      .select('id')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .eq('name', trimmedName)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'A type with this name already exists' }, { status: 400 });
    }

    const { data: created, error } = await supabaseServer
      .from('tools_ebp_types')
      .insert({
        user_id: user.id,
        tool_id: toolId,
        name: trimmedName,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating type:', error);
      return NextResponse.json({ error: 'Failed to create type' }, { status: 500 });
    }

    return NextResponse.json({ type: created });
  } catch (error: unknown) {
    console.error('Error in POST /api/tools/event-budget-planner/types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const typeId = searchParams.get('typeId');
    const toolId = searchParams.get('toolId');

    if (!typeId || !toolId) {
      return NextResponse.json({ error: 'Type ID and Tool ID are required' }, { status: 400 });
    }

    const { data: events } = await supabaseServer
      .from('tools_ebp_events')
      .select('id')
      .eq('type_id', typeId)
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .limit(1);

    if (events && events.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete type that is used by events' },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from('tools_ebp_types')
      .delete()
      .eq('id', typeId)
      .eq('user_id', user.id)
      .eq('tool_id', toolId);

    if (error) {
      console.error('Error deleting type:', error);
      return NextResponse.json({ error: 'Failed to delete type' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/tools/event-budget-planner/types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
