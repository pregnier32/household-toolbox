import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/admin/cron-logs
 * Fetches cron job execution logs (superadmin only)
 * Query params:
 * - job_name: Filter by job name (optional)
 * - status: Filter by status (success, error, warning) (optional)
 * - limit: Number of records to return (default: 100, max: 500)
 * - offset: Pagination offset (default: 0)
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const jobName = searchParams.get('job_name');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabaseServer
      .from('cron_job_logs')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (jobName) {
      query = query.eq('job_name', jobName);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: logs, error: logsError, count } = await query;

    if (logsError) {
      console.error('Error fetching cron logs:', logsError);
      return NextResponse.json(
        { error: 'Failed to fetch cron logs', details: logsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      logs: logs || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('Error in cron logs API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

