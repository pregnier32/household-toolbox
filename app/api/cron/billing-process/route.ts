import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { syncUserBillingActive } from '@/lib/billing-sync';
import { logCronJobExecution } from '@/lib/cron-logger';

/**
 * Vercel Cron Job: Process billing records
 * This endpoint is called nightly to:
 * 1. Sync all users' billing_active records from their current users_tools
 * 2. Move processed records from billing_active to billing_history
 * 
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/billing-process",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const jobName = 'billing-process';

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Step 1: Sync all users' billing_active records from their current users_tools
    // This ensures billing_active is up-to-date before archiving
    const { data: usersWithTools, error: usersError } = await supabaseServer
      .from('users_tools')
      .select('user_id')
      .in('status', ['active', 'trial', 'pending_cancellation'])
      .order('user_id');
    
    if (usersError) {
      console.error('Error fetching users with tools:', usersError);
      const errorResponse = NextResponse.json(
        { error: 'Failed to fetch users', details: usersError.message },
        { status: 500 }
      );
      
      await logCronJobExecution({
        job_name: jobName,
        status: 'error',
        message: 'Failed to fetch users with tools',
        error_details: usersError.message,
        execution_data: { started_at: startedAt, today },
      });
      
      return errorResponse;
    }
    
    const uniqueUserIds = usersWithTools ? [...new Set(usersWithTools.map(ut => ut.user_id))] : [];
    
    // Sync each user's billing records
    const syncResults = await Promise.allSettled(
      uniqueUserIds.map(userId => syncUserBillingActive(userId))
    );
    
    const syncSuccessful = syncResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const syncFailed = syncResults.filter(r => 
      r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    );
    
    if (syncFailed.length > 0) {
      console.warn(`Failed to sync ${syncFailed.length} users' billing records`);
    }
    
    // Get all records from billing_active that should be processed
    // (billing_date is today or in the past, and status is pending)
    const { data: recordsToProcess, error: fetchError } = await supabaseServer
      .from('billing_active')
      .select('*')
      .lte('billing_date', today)
      .eq('status', 'pending');
    
    if (fetchError) {
      console.error('Error fetching billing records:', fetchError);
      const errorResponse = NextResponse.json(
        { error: 'Failed to fetch billing records', details: fetchError.message },
        { status: 500 }
      );
      
      await logCronJobExecution({
        job_name: jobName,
        status: 'error',
        message: 'Failed to fetch billing records',
        error_details: fetchError.message,
        execution_data: { 
          started_at: startedAt, 
          today,
          sync: {
            total: uniqueUserIds.length,
            successful: syncSuccessful,
            failed: syncFailed.length,
          },
        },
      });
      
      return errorResponse;
    }
    
    if (!recordsToProcess || recordsToProcess.length === 0) {
      const response = NextResponse.json({ 
        message: 'No records to process',
        count: 0,
        date: today
      });
      
      await logCronJobExecution({
        job_name: jobName,
        status: 'success',
        message: 'No records to process',
        execution_data: { 
          started_at: startedAt, 
          today,
          sync: {
            total: uniqueUserIds.length,
            successful: syncSuccessful,
            failed: syncFailed.length,
          },
          archive: {
            count: 0,
            date: today,
          },
        },
      });
      
      return response;
    }
    
    // Prepare records for billing_history
    const historyRecords = recordsToProcess.map(record => ({
      user_id: record.user_id,
      billing_period_start: record.billing_period_start,
      billing_period_end: record.billing_period_end,
      billing_date: record.billing_date,
      item_type: record.item_type,
      tool_id: record.tool_id,
      tool_name: record.tool_name,
      amount: record.amount,
      status: 'processed' as const, // TODO: Update based on actual payment processing result
      users_tools_id: record.users_tools_id,
      processed_at: new Date().toISOString(),
      created_at: record.created_at,
      updated_at: new Date().toISOString(),
      payment_intent_id: null,
      invoice_id: null,
      notes: null,
    }));
    
    // Insert into billing_history
    const { error: insertError } = await supabaseServer
      .from('billing_history')
      .insert(historyRecords);
    
    if (insertError) {
      console.error('Error inserting into billing_history:', insertError);
      const errorResponse = NextResponse.json(
        { error: 'Failed to insert billing history', details: insertError.message },
        { status: 500 }
      );
      
      await logCronJobExecution({
        job_name: jobName,
        status: 'error',
        message: 'Failed to insert billing history',
        error_details: insertError.message,
        execution_data: { 
          started_at: startedAt, 
          today,
          sync: {
            total: uniqueUserIds.length,
            successful: syncSuccessful,
            failed: syncFailed.length,
          },
          archive: {
            count: recordsToProcess.length,
            date: today,
          },
        },
      });
      
      return errorResponse;
    }
    
    // Delete from billing_active
    const idsToDelete = recordsToProcess.map(r => r.id);
    const { error: deleteError } = await supabaseServer
      .from('billing_active')
      .delete()
      .in('id', idsToDelete);
    
    if (deleteError) {
      console.error('Error deleting from billing_active:', deleteError);
      // Note: Records were already inserted into history, so this is a cleanup issue
      // In production, you might want to handle this differently (e.g., mark as processed instead of delete)
      const errorResponse = NextResponse.json(
        { 
          error: 'Failed to delete from billing_active', 
          details: deleteError.message,
          warning: 'Records were moved to history but not removed from active table'
        },
        { status: 500 }
      );
      
      await logCronJobExecution({
        job_name: jobName,
        status: 'warning',
        message: 'Records moved to history but failed to delete from active table',
        error_details: deleteError.message,
        execution_data: { 
          started_at: startedAt, 
          today,
          sync: {
            total: uniqueUserIds.length,
            successful: syncSuccessful,
            failed: syncFailed.length,
          },
          archive: {
            count: recordsToProcess.length,
            date: today,
          },
        },
      });
      
      return errorResponse;
    }

    // After billing is processed, change pending_cancellation tools to inactive
    // Get all users_tools records that are pending_cancellation and have been billed today
    const { data: pendingCancellationTools, error: pendingCancelError } = await supabaseServer
      .from('users_tools')
      .select('id, user_id')
      .eq('status', 'pending_cancellation');

    if (pendingCancelError) {
      console.error('Error fetching pending cancellation tools:', pendingCancelError);
    } else if (pendingCancellationTools && pendingCancellationTools.length > 0) {
      // Get unique user IDs
      const userIdsWithPending = [...new Set(pendingCancellationTools.map(t => t.user_id))];
      
      // For each user, check if their billing date has passed
      const toolsToInactivate: string[] = [];
      
      for (const userId of userIdsWithPending) {
        // Get user's billing day
        const { data: userTools, error: userToolsError } = await supabaseServer
          .from('users_tools')
          .select('created_at, trial_end_date, status')
          .eq('user_id', userId)
          .in('status', ['active', 'trial', 'pending_cancellation'])
          .order('created_at', { ascending: true })
          .limit(1);

        if (userToolsError || !userTools || userTools.length === 0) continue;

        const oldestTool = userTools[0];
        let billingDate: Date;
        
        if (oldestTool.status === 'trial' && oldestTool.trial_end_date) {
          billingDate = new Date(oldestTool.trial_end_date);
        } else {
          const createdDate = new Date(oldestTool.created_at);
          billingDate = new Date(createdDate);
          billingDate.setDate(billingDate.getDate() + 7);
        }
        
        const billingDay = billingDate.getDate();
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const thisMonthBilling = new Date(currentYear, currentMonth, billingDay);
        thisMonthBilling.setHours(0, 0, 0, 0);
        const nowStartOfDay = new Date(now);
        nowStartOfDay.setHours(0, 0, 0, 0);

        // If billing date has passed today, mark tools for inactivation
        if (nowStartOfDay >= thisMonthBilling) {
          const userPendingTools = pendingCancellationTools
            .filter(t => t.user_id === userId)
            .map(t => t.id);
          toolsToInactivate.push(...userPendingTools);
        }
      }

      // Inactivate all tools that have been billed
      if (toolsToInactivate.length > 0) {
        const { error: inactivateError } = await supabaseServer
          .from('users_tools')
          .update({
            status: 'inactive',
            updated_at: new Date().toISOString(),
          })
          .in('id', toolsToInactivate);

        if (inactivateError) {
          console.error('Error inactivating pending cancellation tools:', inactivateError);
        } else {
          console.log(`Inactivated ${toolsToInactivate.length} tools after billing`);
        }
      }
    }
    
    const successResponse = NextResponse.json({
      message: `Successfully processed ${recordsToProcess.length} billing records`,
      sync: {
        total: uniqueUserIds.length,
        successful: syncSuccessful,
        failed: syncFailed.length,
      },
      archive: {
        count: recordsToProcess.length,
        date: today,
      },
      records: recordsToProcess.map(r => ({
        id: r.id,
        user_id: r.user_id,
        item_type: r.item_type,
        amount: r.amount,
      }))
    });
    
    // Log successful execution
    await logCronJobExecution({
      job_name: jobName,
      status: syncFailed.length > 0 ? 'warning' : 'success',
      message: `Successfully processed ${recordsToProcess.length} billing records`,
      error_details: syncFailed.length > 0 ? `${syncFailed.length} users failed to sync` : undefined,
      execution_data: { 
        started_at: startedAt, 
        today,
        sync: {
          total: uniqueUserIds.length,
          successful: syncSuccessful,
          failed: syncFailed.length,
        },
        archive: {
          count: recordsToProcess.length,
          date: today,
        },
      },
    });
    
    return successResponse;
  } catch (error) {
    console.error('Error in billing process cron job:', error);
    
    await logCronJobExecution({
      job_name: jobName,
      status: 'error',
      message: 'Internal server error',
      error_details: error instanceof Error ? error.message : 'Unknown error',
      execution_data: { started_at: startedAt },
    });
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

