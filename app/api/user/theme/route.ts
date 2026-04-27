import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

export async function PUT(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const themePreference = body?.themePreference;

    if (!['light', 'dark'].includes(themePreference)) {
      return NextResponse.json({ error: 'Invalid theme preference' }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from('users')
      .update({ theme_preference: themePreference })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating theme preference:', error);
      return NextResponse.json({ error: 'Failed to update theme preference' }, { status: 500 });
    }

    return NextResponse.json({ success: true, themePreference });
  } catch (error) {
    console.error('Error in PUT /api/user/theme:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
