import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { ensureToolEntitlement, toolOffersTrial } from '@/lib/user-tool-entitlements';

function purchaseMessage(trialGranted: boolean, isReturning: boolean): string {
  if (trialGranted) {
    return '7-day free trial started. You will not be charged until after 7 days.';
  }
  if (isReturning) {
    return 'Tool added. Your 7-day trial for this tool was already used, so billing starts with this purchase.';
  }
  return 'Tool purchased successfully';
}

async function recordEntitlement(userId: string, tool: { id: string; name: string; price: number }) {
  return ensureToolEntitlement(userId, tool.id, {
    grantTrial: toolOffersTrial(tool),
  });
}

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
      .select('id, name, price, status')
      .eq('id', toolId)
      .single();

    if (toolError || !tool) {
      console.error('Error fetching tool:', toolError);
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    // Check if tool is available for purchase
    // Custom tools cannot be purchased directly - they must be assigned by admin
    if (tool.status !== 'available' && tool.status !== 'active') {
      if (tool.status === 'custom') {
        return NextResponse.json(
          { error: 'This is a custom tool and cannot be purchased directly. Please contact support for access.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'This tool is not available for purchase' },
        { status: 400 }
      );
    }

    // Check if user already has this tool (any status)
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
      // If user already has the tool and it's active, return success
      if (existingUserTool.status === 'active') {
        return NextResponse.json(
          { message: 'You already own this tool', userTool: existingUserTool },
          { status: 200 }
        );
      }

      // Reactivate inactive subscription (no new trial)
      const { data: updatedUserTool, error: updateError } = await supabaseServer
        .from('users_tools')
        .update({
          status: 'active',
          price: tool.price,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUserTool.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user tool:', updateError);
        return NextResponse.json({ error: 'Failed to reactivate tool' }, { status: 500 });
      }

      const entitlement = await recordEntitlement(user.id, tool);
      return NextResponse.json({
        message: purchaseMessage(false, true),
        userTool: updatedUserTool,
        trialGranted: false,
        trialUsed: entitlement.trialUsed,
      });
    }

    const entitlement = await recordEntitlement(user.id, tool);

    // Insert new record into users_tools table as active
    const insertData = {
      user_id: user.id,
      tool_id: toolId,
      status: 'active',
      price: tool.price,
    };

    const { data: newUserTool, error: insertError } = await supabaseServer
      .from('users_tools')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting user tool:', insertError);
      return NextResponse.json({ 
        error: 'Failed to purchase tool',
        details: insertError.message 
      }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: purchaseMessage(entitlement.trialGranted, !entitlement.isFirstStart),
        userTool: newUserTool,
        trialGranted: entitlement.trialGranted,
        trialUsed: entitlement.trialUsed,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in buy tool API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

