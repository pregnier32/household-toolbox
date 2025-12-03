import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Fetch platform fee amount
// This is a public endpoint (no auth required) as it's just a configuration value
export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('settings')
      .select('value')
      .eq('key', 'platform_fee')
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" which is okay for first time
      console.error('Error fetching platform fee setting:', error);
      // Default to $5.00 if there's an error
      return NextResponse.json({ amount: 5.00 });
    }

    // If no setting exists, return default ($5.00)
    const setting = data?.value || { amount: 5.00 };
    const amount = typeof setting === 'object' && 'amount' in setting 
      ? Number(setting.amount) 
      : 5.00;

    return NextResponse.json({ amount });
  } catch (error) {
    console.error('Error in platform fee API:', error);
    // Default to $5.00 if there's an error
    return NextResponse.json({ amount: 5.00 });
  }
}

