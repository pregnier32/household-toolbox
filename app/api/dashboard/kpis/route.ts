import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Fetch enabled KPIs for the current user
export async function GET(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');
    const kpiKey = searchParams.get('kpiKey');

    let query = supabaseServer
      .from('user_dashboard_kpis')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_enabled', true);

    if (toolId) {
      query = query.eq('tool_id', toolId);
    }

    if (kpiKey) {
      query = query.eq('kpi_key', kpiKey);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching dashboard KPIs:', error);
      // Check if table doesn't exist
      if (error.message?.includes('does not exist') || 
          error.message?.includes('schema cache') ||
          error.code === '42P01' || 
          error.code === 'PGRST116') {
        return NextResponse.json({ 
          error: 'Dashboard KPIs table not set up. Please run the migration SQL file (create-user-dashboard-kpis-table.sql) in your Supabase SQL Editor.',
          kpis: []
        }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to fetch dashboard KPIs', kpis: [] }, { status: 500 });
    }

    return NextResponse.json({ kpis: data || [] });
  } catch (error) {
    console.error('Error in dashboard KPIs API:', error);
    return NextResponse.json({ error: 'Internal server error', kpis: [] }, { status: 500 });
  }
}

// POST - Create or update a KPI preference
export async function POST(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { toolId, kpiKey, isEnabled } = body;

    if (!toolId || !kpiKey || typeof isEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'toolId, kpiKey, and isEnabled are required' },
        { status: 400 }
      );
    }

    // Use upsert to create or update
    const { data, error } = await supabaseServer
      .from('user_dashboard_kpis')
      .upsert({
        user_id: user.id,
        tool_id: toolId,
        kpi_key: kpiKey,
        is_enabled: isEnabled,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,tool_id,kpi_key'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving dashboard KPI preference:', error);
      // Check if table doesn't exist
      if (error.message?.includes('does not exist') || 
          error.message?.includes('schema cache') ||
          error.code === '42P01' || 
          error.code === 'PGRST116') {
        return NextResponse.json({ 
          error: 'Dashboard KPIs table not set up. Please run the migration SQL file (create-user-dashboard-kpis-table.sql) in your Supabase SQL Editor.'
        }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to save KPI preference' }, { status: 500 });
    }

    return NextResponse.json({ kpi: data });
  } catch (error) {
    console.error('Error in dashboard KPIs API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
