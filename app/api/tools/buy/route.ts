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

    // Check if user already has this tool (any status - active, trial, inactive, etc.)
    const { data: existingUserTool, error: checkError } = await supabaseServer
      .from('users_tools')
      .select('id, status, has_used_trial, trial_start_date')
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
      
      // If user has it but it's inactive, check if they've used their trial
      // If they have used their trial (has_used_trial = TRUE or trial_start_date IS NOT NULL),
      // reactivate as 'active' (no new trial)
      // Otherwise, give them their first trial
      const hasUsedTrial = existingUserTool.has_used_trial === true || existingUserTool.trial_start_date !== null;
      
      if (hasUsedTrial) {
        // They've used their trial before, reactivate as active (no new trial)
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

        return NextResponse.json({ 
          message: 'Tool reactivated (trial already used)', 
          userTool: updatedUserTool 
        });
      } else {
        // They haven't used their trial yet, give them their first trial
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
            has_used_trial: true, // Mark that they've used their trial
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingUserTool.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating user tool:', updateError);
          return NextResponse.json({ error: 'Failed to start trial' }, { status: 500 });
        }

        // Set billing_date on users table if this is their first tool
        const { data: userData } = await supabaseServer
          .from('users')
          .select('billing_date')
          .eq('id', user.id)
          .single();

        if (!userData?.billing_date) {
          // Check if this is their first tool
          const { data: allUserTools } = await supabaseServer
            .from('users_tools')
            .select('id')
            .eq('user_id', user.id)
            .in('status', ['active', 'trial'])
            .limit(2);

          // If they only have 1 tool (the one we just updated), this is their first tool
          if (allUserTools && allUserTools.length === 1) {
            // Set billing_date to 8 days from now (7-day trial + 1 day)
            const billingDate = new Date(now);
            billingDate.setDate(billingDate.getDate() + 8);
            
            const { error: billingDateError } = await supabaseServer
              .from('users')
              .update({ billing_date: billingDate.toISOString().split('T')[0] })
              .eq('id', user.id);

            if (billingDateError) {
              console.error('Error setting billing_date:', billingDateError);
              // Don't fail the request, just log the error
            }
          }
        }

        return NextResponse.json({ 
          message: '7-day free trial started!', 
          userTool: updatedUserTool 
        });
      }
    }

    // Insert new record into users_tools table with 7-day trial
    // This is their first time purchasing this tool, so they get a trial
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
      has_used_trial: true, // Mark that they've used their trial (first time purchase gets trial)
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
      
      // Note: billing_active will be synced nightly by cron job
      // No need to sync immediately for performance
      
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

    // Set billing_date on users table if this is their first tool
    // Check if user already has billing_date set
    const { data: userData } = await supabaseServer
      .from('users')
      .select('billing_date')
      .eq('id', user.id)
      .single();

    if (!userData?.billing_date) {
      // Check if this is their first tool (they should only have this one now)
      const { data: allUserTools } = await supabaseServer
        .from('users_tools')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['active', 'trial'])
        .limit(2); // Get up to 2 to check if there's more than 1

      // If they only have 1 tool (the one we just created), this is their first tool
      if (allUserTools && allUserTools.length === 1) {
        // Set billing_date to 8 days from now (7-day trial + 1 day)
        const billingDate = new Date(now);
        billingDate.setDate(billingDate.getDate() + 8);
        
        const { error: billingDateError } = await supabaseServer
          .from('users')
          .update({ billing_date: billingDate.toISOString().split('T')[0] })
          .eq('id', user.id);

        if (billingDateError) {
          console.error('Error setting billing_date:', billingDateError);
          // Don't fail the request, just log the error
        }
      }
    }

    // Note: billing_active will be synced nightly by cron job
    // No need to sync immediately for performance

    return NextResponse.json(
      { message: '7-day free trial started!', userTool: newUserTool },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in buy tool API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

