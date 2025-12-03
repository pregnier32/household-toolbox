import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { syncUserBillingActive } from '@/lib/billing-sync';

// POST - Purchase a tool (add to users_tools table)
export async function POST(request: NextRequest) {
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

    // Fetch the tool to get its price
    const { data: tool, error: toolError } = await supabaseServer
      .from('tools')
      .select('id, price, status')
      .eq('id', toolId)
      .single();

    if (toolError || !tool) {
      console.error('Error fetching tool:', toolError);
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    // Check if tool is available for purchase
    if (tool.status !== 'available' && tool.status !== 'active') {
      return NextResponse.json(
        { error: 'This tool is not available for purchase' },
        { status: 400 }
      );
    }

    // Check if user already has this tool
    const { data: existingUserTool, error: checkError } = await supabaseServer
      .from('users_tools')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected if user doesn't have the tool
      console.error('Error checking existing user tool:', checkError);
      return NextResponse.json({ error: 'Failed to check existing purchase' }, { status: 500 });
    }

    if (existingUserTool) {
      // If user already has the tool and it's active or in trial, return success
      if (existingUserTool.status === 'active' || existingUserTool.status === 'trial') {
        return NextResponse.json(
          { message: 'You already own this tool', userTool: existingUserTool },
          { status: 200 }
        );
      }
      // If user has it but it's inactive, start a new trial
      const now = new Date();
      const trialEndDate = new Date(now);
      trialEndDate.setDate(trialEndDate.getDate() + 7);
      
      const { data: updatedUserTool, error: updateError } = await supabaseServer
        .from('users_tools')
        .update({
          status: 'trial',
          price: tool.price,
          trial_start_date: now.toISOString(),
          trial_end_date: trialEndDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUserTool.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user tool:', updateError);
        return NextResponse.json({ error: 'Failed to start trial' }, { status: 500 });
      }

      // Sync billing_active after reactivating tool
      await syncUserBillingActive(user.id);

      return NextResponse.json({ message: 'Trial started', userTool: updatedUserTool });
    }

    // Insert new record into users_tools table with 7-day trial
    const now = new Date();
    const trialEndDate = new Date(now);
    trialEndDate.setDate(trialEndDate.getDate() + 7);
    
    // Try to insert with trial fields first
    let insertData: any = {
      user_id: user.id,
      tool_id: toolId,
      status: 'trial',
      price: tool.price,
      trial_start_date: now.toISOString(),
      trial_end_date: trialEndDate.toISOString(),
    };

    let { data: newUserTool, error: insertError } = await supabaseServer
      .from('users_tools')
      .insert(insertData)
      .select()
      .single();

    // If trial columns don't exist or status 'trial' is not allowed, fall back to 'active'
    if (insertError && (
      insertError.message?.includes('column') || 
      insertError.message?.includes('does not exist') ||
      insertError.message?.includes('check constraint') ||
      insertError.code === '23514' // Check constraint violation
    )) {
      console.log('Trial columns/status not available, creating as active subscription');
      // Fall back to creating as active (for backward compatibility)
      insertData = {
        user_id: user.id,
        tool_id: toolId,
        status: 'active',
        price: tool.price,
      };
      
      const { data: fallbackTool, error: fallbackError } = await supabaseServer
        .from('users_tools')
        .insert(insertData)
        .select()
        .single();

      if (fallbackError) {
        console.error('Error inserting user tool:', fallbackError);
        return NextResponse.json({ 
          error: 'Failed to purchase tool',
          details: fallbackError.message 
        }, { status: 500 });
      }

      newUserTool = fallbackTool;
      
      // Sync billing_active after purchasing tool
      await syncUserBillingActive(user.id);
      
      return NextResponse.json(
        { message: 'Tool purchased successfully', userTool: newUserTool },
        { status: 201 }
      );
    }

    if (insertError) {
      console.error('Error inserting user tool:', insertError);
      return NextResponse.json({ 
        error: 'Failed to purchase tool',
        details: insertError.message 
      }, { status: 500 });
    }

    // Sync billing_active after purchasing tool
    await syncUserBillingActive(user.id);

    return NextResponse.json(
      { message: '7-day free trial started!', userTool: newUserTool },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in buy tool API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

