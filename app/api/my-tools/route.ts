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
    // First, check for expired trials and convert them to active
    // Only if trial columns exist (gracefully handle if migration hasn't been run)
    const now = new Date().toISOString();
    try {
      const { error: expireError } = await supabaseServer
        .from('users_tools')
        .update({
          status: 'active',
          updated_at: now,
        })
        .eq('user_id', user.id)
        .eq('status', 'trial')
        .lt('trial_end_date', now);

      if (expireError && !expireError.message?.includes('column') && !expireError.message?.includes('does not exist')) {
        console.error('Error expiring trials:', expireError);
      }
    } catch (expireErr) {
      // Ignore errors if trial columns don't exist yet
      console.log('Trial expiration check skipped (columns may not exist yet)');
    }

    // Fetch user's active and trial tools with tool details and promo code info
    // First try with trial fields, if that fails, try without them (for backward compatibility)
    let userTools;
    let error;
    
    // Try with trial fields first
    const { data: toolsWithTrial, error: errorWithTrial } = await supabaseServer
      .from('users_tools')
      .select(`
        id,
        price,
        status,
        created_at,
        updated_at,
        promo_code_id,
        promo_expiration_date,
        trial_start_date,
        trial_end_date,
        tools (
          id,
          name,
          tool_tip
        ),
        promo_codes (
          id,
          code
        )
      `)
      .eq('user_id', user.id)
      .in('status', ['active', 'trial'])
      .order('created_at', { ascending: false });

    if (errorWithTrial && (errorWithTrial.message?.includes('column') || errorWithTrial.message?.includes('does not exist'))) {
      // Trial columns don't exist yet, fetch without them
      console.log('Trial columns not found, fetching without trial fields');
      const { data: toolsWithoutTrial, error: errorWithoutTrial } = await supabaseServer
        .from('users_tools')
        .select(`
          id,
          price,
          status,
          created_at,
          updated_at,
          promo_code_id,
          promo_expiration_date,
          tools (
            id,
            name,
            tool_tip
          ),
          promo_codes (
            id,
            code
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      userTools = toolsWithoutTrial;
      error = errorWithoutTrial;
    } else {
      userTools = toolsWithTrial;
      error = errorWithTrial;
    }

    if (error) {
      console.error('Error fetching user tools:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch tools',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ tools: userTools || [] });
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

    if (userTool.status !== 'active' && userTool.status !== 'trial') {
      return NextResponse.json(
        { error: 'Tool is already inactive' },
        { status: 400 }
      );
    }

    // If tool is in trial, clear trial dates when inactivating
    const updateData: any = {
      status: 'inactive',
      updated_at: new Date().toISOString(),
    };

    if (userTool.status === 'trial') {
      updateData.trial_start_date = null;
      updateData.trial_end_date = null;
    }

    // Update tool status to inactive
    const { data: updatedTool, error: updateError } = await supabaseServer
      .from('users_tools')
      .update(updateData)
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

