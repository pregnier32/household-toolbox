import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * Vercel Cron Job: Process billing records
 * This endpoint is called nightly to move records from billing_active to billing_history
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

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get all records from billing_active that should be processed
    // (billing_date is today or in the past, and status is pending)
    const { data: recordsToProcess, error: fetchError } = await supabaseServer
      .from('billing_active')
      .select('*')
      .lte('billing_date', today)
      .eq('status', 'pending');
    
    if (fetchError) {
      console.error('Error fetching billing records:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch billing records', details: fetchError.message },
        { status: 500 }
      );
    }
    
    if (!recordsToProcess || recordsToProcess.length === 0) {
      return NextResponse.json({ 
        message: 'No records to process',
        count: 0,
        date: today
      });
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
      return NextResponse.json(
        { error: 'Failed to insert billing history', details: insertError.message },
        { status: 500 }
      );
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
      return NextResponse.json(
        { 
          error: 'Failed to delete from billing_active', 
          details: deleteError.message,
          warning: 'Records were moved to history but not removed from active table'
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: `Successfully processed ${recordsToProcess.length} billing records`,
      count: recordsToProcess.length,
      date: today,
      records: recordsToProcess.map(r => ({
        id: r.id,
        user_id: r.user_id,
        item_type: r.item_type,
        amount: r.amount,
      }))
    });
  } catch (error) {
    console.error('Error in billing process cron job:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

