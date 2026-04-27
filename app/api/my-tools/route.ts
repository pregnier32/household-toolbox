import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Fetch current user's active tools with details
export async function GET() {
  // Check if user is authenticated
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch user's active tools with tool details
    const { data: userTools, error } = await supabaseServer
      .from('users_tools')
      .select(`
        id,
        price,
        status,
        created_at,
        updated_at,
        tools (
          id,
          name,
          tool_tip
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user tools:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch tools',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      tools: userTools || []
    });
  } catch (error) {
    console.error('Error in my-tools API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Inactivate a user's tool
export async function PUT(request: NextRequest) {
  // Check if user is authenticated
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { toolId } = body;

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    // Verify the tool belongs to the user
    const { data: userTool, error: fetchError } = await supabaseServer
      .from('users_tools')
      .select('id, user_id, status')
      .eq('id', toolId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !userTool) {
      return NextResponse.json({ error: 'Tool not found or access denied' }, { status: 404 });
    }

    if (userTool.status !== 'active' && userTool.status !== 'inactive') {
      return NextResponse.json(
        { error: 'Invalid tool status' },
        { status: 400 }
      );
    }

    if (userTool.status === 'inactive') {
      const { data: reactivatedTool, error: reactivateError } = await supabaseServer
        .from('users_tools')
        .update({
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', toolId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (reactivateError) {
        console.error('Error reactivating tool:', reactivateError);
        return NextResponse.json({ error: 'Failed to reactivate tool' }, { status: 500 });
      }

      return NextResponse.json({ success: true, tool: reactivatedTool, message: 'Tool reactivated' });
    }

    // Update tool status to inactive immediately
    const { data: updatedTool, error: updateError } = await supabaseServer
      .from('users_tools')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString(),
      })
      .eq('id', toolId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error inactivating tool:', updateError);
      return NextResponse.json({ error: 'Failed to inactivate tool' }, { status: 500 });
    }

    return NextResponse.json({ success: true, tool: updatedTool });
  } catch (error) {
    console.error('Error in my-tools API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

