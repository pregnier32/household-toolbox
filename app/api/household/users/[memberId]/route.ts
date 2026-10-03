import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { removeHouseholdUser } from '@/lib/household';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { memberId } = await params;
    const result = await removeHouseholdUser(user, memberId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/household/users failed', error);
    return NextResponse.json({ error: 'Could not remove that User.' }, { status: 500 });
  }
}
