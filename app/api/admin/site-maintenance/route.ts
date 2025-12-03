import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Fetch site maintenance settings
export async function GET() {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Get the site maintenance setting from settings table
    const { data, error } = await supabaseServer
      .from('settings')
      .select('value')
      .eq('key', 'site_maintenance')
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" which is okay for first time
      console.error('Error fetching site maintenance setting:', error);
      return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 });
    }

    // If no setting exists, return default (sign ups enabled)
    const setting = data?.value || { signUpsDisabled: false };

    return NextResponse.json({ setting });
  } catch (error) {
    console.error('Error in site maintenance API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update site maintenance settings
export async function PUT(request: NextRequest) {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { signUpsDisabled } = body;

    if (typeof signUpsDisabled !== 'boolean') {
      return NextResponse.json(
        { error: 'signUpsDisabled must be a boolean' },
        { status: 400 }
      );
    }

    // Upsert the site maintenance setting
    const { error } = await supabaseServer
      .from('settings')
      .upsert(
        {
          key: 'site_maintenance',
          value: { signUpsDisabled },
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'key',
        }
      );

    if (error) {
      console.error('Error saving site maintenance setting:', error);
      return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 });
    }

    return NextResponse.json({ success: true, setting: { signUpsDisabled } });
  } catch (error) {
    console.error('Error in site maintenance API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

