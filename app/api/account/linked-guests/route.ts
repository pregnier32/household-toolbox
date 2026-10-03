import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listLinkedGuestAccounts } from '@/lib/user-data-deletion';

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.householdRole === 'user') {
    return NextResponse.json({ guests: [] });
  }

  try {
    const guests = (await listLinkedGuestAccounts([user.id])).get(user.id) ?? [];
    return NextResponse.json({ guests });
  } catch (error) {
    console.error('Error loading linked guest accounts:', error);
    return NextResponse.json({ error: 'Failed to load guest accounts' }, { status: 500 });
  }
}
