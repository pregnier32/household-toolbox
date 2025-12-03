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
    const { data: maintenanceData, error: maintenanceError } = await supabaseServer
      .from('settings')
      .select('value')
      .eq('key', 'site_maintenance')
      .single();

    if (maintenanceError && maintenanceError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is okay for first time
      console.error('Error fetching site maintenance setting:', maintenanceError);
      return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 });
    }

    // Get the platform fee setting
    const { data: platformFeeData, error: platformFeeError } = await supabaseServer
      .from('settings')
      .select('value')
      .eq('key', 'platform_fee')
      .single();

    if (platformFeeError && platformFeeError.code !== 'PGRST116') {
      console.error('Error fetching platform fee setting:', platformFeeError);
    }

    // If no setting exists, return defaults
    const setting = maintenanceData?.value || { signUpsDisabled: false };
    const platformFeeSetting = platformFeeData?.value || { amount: 5.00 };
    const platformFeeAmount = typeof platformFeeSetting === 'object' && 'amount' in platformFeeSetting
      ? Number(platformFeeSetting.amount)
      : 5.00;

    return NextResponse.json({ 
      setting,
      platformFee: platformFeeAmount
    });
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
    const { signUpsDisabled, platformFee } = body;

    // Update site maintenance setting if provided
    if (signUpsDisabled !== undefined) {
      if (typeof signUpsDisabled !== 'boolean') {
        return NextResponse.json(
          { error: 'signUpsDisabled must be a boolean' },
          { status: 400 }
        );
      }

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
    }

    // Update platform fee setting if provided
    if (platformFee !== undefined) {
      if (typeof platformFee !== 'number' || platformFee < 0) {
        return NextResponse.json(
          { error: 'platformFee must be a non-negative number' },
          { status: 400 }
        );
      }

      const { error } = await supabaseServer
        .from('settings')
        .upsert(
          {
            key: 'platform_fee',
            value: { amount: platformFee },
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'key',
          }
        );

      if (error) {
        console.error('Error saving platform fee setting:', error);
        return NextResponse.json({ error: 'Failed to save platform fee' }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      setting: signUpsDisabled !== undefined ? { signUpsDisabled } : undefined,
      platformFee: platformFee !== undefined ? platformFee : undefined
    });
  } catch (error) {
    console.error('Error in site maintenance API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

