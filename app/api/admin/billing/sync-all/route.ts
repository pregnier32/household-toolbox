import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { syncUserBillingActive } from '@/lib/billing-sync';

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

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (userId) {
      // Sync specific user
      const result = await syncUserBillingActive(userId);
      if (!result.success) {
        return NextResponse.json(
          { error: 'Failed to sync user', details: result.error },
          { status: 500 }
        );
      }
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
      return NextResponse.json(
        { error: 'Failed to fetch users', details: usersError.message },
        { status: 500 }
      );
    }
    
    if (!usersWithTools || usersWithTools.length === 0) {
      return NextResponse.json({ 
        message: 'No users with active tools found',
        count: 0
      });
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
    
    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Error in sync-all billing API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

