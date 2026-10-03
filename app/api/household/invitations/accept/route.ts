import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { acceptHouseholdInvitation } from '@/lib/household';

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Sign in to accept this invitation.' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token : '';
    const result = await acceptHouseholdInvitation(user, token);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/household/invitations/accept failed', error);
    return NextResponse.json({ error: 'Could not accept the invitation.' }, { status: 500 });
  }
}
