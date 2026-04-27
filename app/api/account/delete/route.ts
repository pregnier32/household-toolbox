import { NextResponse } from 'next/server';
import { getSession, deleteSession } from '@/lib/session';
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
    await deleteUserAndAssociatedData(user.id);
    await deleteSession();
    return NextResponse.json({ success: true, message: 'Account and all associated data deleted successfully' });
  } catch (error) {
    console.error('Error deleting own account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
