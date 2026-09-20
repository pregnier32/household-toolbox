import { NextResponse } from 'next/server';
import { getSession, deleteSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { deleteUserAndAssociatedData } from '@/lib/user-data-deletion';

export async function DELETE() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent accidental platform lockout.
  if (user.userStatus === 'superadmin') {
    return NextResponse.json(
      { error: 'Superadmin accounts cannot self-delete from this screen' },
      { status: 400 }
    );
  }

  try {
    const { count, error: toolsCountError } = await supabaseServer
      .from('users_tools')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (toolsCountError) {
      console.error('Error checking owned tools before account delete:', toolsCountError);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    if ((count || 0) > 0) {
      return NextResponse.json(
        {
          error: 'Remove all tools from My Tools before deleting your account',
          remainingTools: count,
        },
        { status: 400 }
      );
    }

    await deleteUserAndAssociatedData(user.id);
    await deleteSession();
    return NextResponse.json({ success: true, message: 'Account and all associated data deleted successfully' });
  } catch (error) {
    console.error('Error deleting own account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
