import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { syncUserBillingActive } from '@/lib/billing-sync';
import { logCronJobExecution } from '@/lib/cron-logger';

/**
 * Admin endpoint to sync billing_active for all users
 * This should be run once after creating the billing tables to populate initial data
 * 
 * GET /api/admin/billing/sync-all - Sync all users
 * GET /api/admin/billing/sync-all?userId=xxx - Sync specific user
 */
export async function GET(request: NextRequest) {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const startedAt = new Date().toISOString();
  const jobName = 'billing-sync-manual';

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (userId) {
      // Sync specific user
      const result = await syncUserBillingActive(userId);
      if (!result.success) {
        await logCronJobExecution({
          job_name: jobName,
          status: 'error',
          message: 'Failed to sync user billing',
          error_details: result.error,
          execution_data: { started_at: startedAt, userId, type: 'single_user' },
        });
        
        return NextResponse.json(
          { error: 'Failed to sync user', details: result.error },
          { status: 500 }
        );
      }
      
      await logCronJobExecution({
        job_name: jobName,
        status: 'success',
        message: 'User billing synced successfully',
        execution_data: { started_at: startedAt, userId, type: 'single_user' },
      });
      
      return NextResponse.json({ 
        message: 'User billing synced successfully',
        userId 
      });
    }
    
    // Sync all users with active/trial tools
    const { data: usersWithTools, error: usersError } = await supabaseServer
      .from('users_tools')
      .select('user_id')
      .in('status', ['active', 'trial'])
      .order('user_id');
    
    if (usersError) {
      console.error('Error fetching users with tools:', usersError);
      
      await logCronJobExecution({
        job_name: jobName,
        status: 'error',
        message: 'Failed to fetch users with tools',
        error_details: usersError.message,
        execution_data: { started_at: startedAt, type: 'all_users' },
      });
      
      return NextResponse.json(
        { error: 'Failed to fetch users', details: usersError.message },
        { status: 500 }
      );
    }
    
    if (!usersWithTools || usersWithTools.length === 0) {
      const response = NextResponse.json({ 
        message: 'No users with active tools found',
        count: 0
      });
      
      await logCronJobExecution({
        job_name: jobName,
        status: 'success',
        message: 'No users with active tools found',
        execution_data: { started_at: startedAt, type: 'all_users', total: 0, successful: 0, failed: 0 },
      });
      
      return response;
    }
    
    // Get unique user IDs
    const uniqueUserIds = [...new Set(usersWithTools.map(ut => ut.user_id))];
    
    // Sync each user
    const results = await Promise.allSettled(
      uniqueUserIds.map(userId => syncUserBillingActive(userId))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => 
      r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    );
    
    const responseData = {
      message: `Sync completed`,
      total: uniqueUserIds.length,
      successful,
      failed: failed.length,
      details: failed.length > 0 ? {
        errors: failed.map((f, i) => ({
          userId: uniqueUserIds[i],
          error: f.status === 'rejected' 
            ? f.reason?.message || 'Unknown error'
            : f.value.error || 'Unknown error'
        }))
      } : undefined
    };
    
    // Log the execution
    await logCronJobExecution({
      job_name: jobName,
      status: failed.length > 0 ? 'warning' : 'success',
      message: `Sync completed: ${successful} successful, ${failed.length} failed`,
      error_details: failed.length > 0 ? JSON.stringify(responseData.details) : undefined,
      execution_data: { 
        started_at: startedAt, 
        type: 'all_users',
        total: uniqueUserIds.length,
        successful,
        failed: failed.length,
      },
    });
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error in sync-all billing API:', error);
    
    await logCronJobExecution({
      job_name: jobName,
      status: 'error',
      message: 'Internal server error during billing sync',
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

