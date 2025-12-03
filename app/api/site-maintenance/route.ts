import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Public endpoint to check if sign ups are disabled
// This doesn't require authentication since it's used on the public landing page
export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('settings')
      .select('value')
      .eq('key', 'site_maintenance')
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" which is okay for first time
      console.error('Error fetching site maintenance setting:', error);
      // Default to allowing sign ups if there's an error
      return NextResponse.json({ signUpsDisabled: false });
    }

    // If no setting exists, return default (sign ups enabled)
    const setting = data?.value || { signUpsDisabled: false };

    return NextResponse.json({ signUpsDisabled: setting.signUpsDisabled || false });
  } catch (error) {
    console.error('Error in site maintenance API:', error);
    // Default to allowing sign ups if there's an error
    return NextResponse.json({ signUpsDisabled: false });
  }
}

