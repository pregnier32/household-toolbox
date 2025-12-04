import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Fetch tools for a specific user (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } }
) {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const resolvedParams = await Promise.resolve(params);
    const userId = resolvedParams.userId;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Fetch user's active and trial tools with tool details
    const { data: userTools, error } = await supabaseServer
      .from('users_tools')
      .select(`
        id,
        price,
        status,
        created_at,
        updated_at,
        trial_start_date,
        trial_end_date,
        tools (
          id,
          name,
          tool_tip,
          description,
          price
        )
      `)
      .eq('user_id', userId)
      .in('status', ['active', 'trial', 'pending_cancellation'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user tools:', error);
      return NextResponse.json({ error: 'Failed to fetch user tools' }, { status: 500 });
    }

    return NextResponse.json({ tools: userTools || [] });
  } catch (error) {
    console.error('Error in user tools API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a user tool's status (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } }
) {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const resolvedParams = await Promise.resolve(params);
    const userId = resolvedParams.userId;
    const body = await request.json();
    const { usersToolsId, status } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!usersToolsId) {
      return NextResponse.json({ error: 'Users Tools ID is required' }, { status: 400 });
    }

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['active', 'trial', 'inactive', 'pending_cancellation'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify the tool belongs to the specified user
    const { data: userTool, error: fetchError } = await supabaseServer
      .from('users_tools')
      .select('id, user_id, status')
      .eq('id', usersToolsId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !userTool) {
      return NextResponse.json({ error: 'Tool not found or does not belong to this user' }, { status: 404 });
    }

    // Build update data
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    // If changing from trial to inactive, clear trial dates
    if (userTool.status === 'trial' && status === 'inactive') {
      updateData.trial_start_date = null;
      updateData.trial_end_date = null;
    }

    // If changing to trial and it wasn't trial before, set trial dates
    if (status === 'trial' && userTool.status !== 'trial') {
      const now = new Date();
      const trialEndDate = new Date(now);
      trialEndDate.setDate(trialEndDate.getDate() + 7);
      updateData.trial_start_date = now.toISOString();
      updateData.trial_end_date = trialEndDate.toISOString();
      updateData.has_used_trial = true;
    }

    // Update the tool status
    const { data: updatedTool, error: updateError } = await supabaseServer
      .from('users_tools')
      .update(updateData)
      .eq('id', usersToolsId)
      .eq('user_id', userId)
      .select(`
        id,
        price,
        status,
        created_at,
        updated_at,
        trial_start_date,
        trial_end_date,
        tools (
          id,
          name,
          tool_tip,
          description,
          price
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating user tool status:', updateError);
      return NextResponse.json({ error: 'Failed to update tool status' }, { status: 500 });
    }

    return NextResponse.json({ tool: updatedTool, message: 'Tool status updated successfully' });
  } catch (error) {
    console.error('Error in user tools API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

