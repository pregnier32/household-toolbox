import { NextRequest, NextResponse } from 'next/server';
import { acceptHouseholdInvitationSignup } from '@/lib/household';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await acceptHouseholdInvitationSignup({
      token: typeof body.token === 'string' ? body.token : '',
      firstName: typeof body.firstName === 'string' ? body.firstName : '',
      password: typeof body.password === 'string' ? body.password : '',
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, needsEmailConfirmation: result.needsEmailConfirmation });
  } catch (error) {
    console.error('POST /api/household/invitations/accept-signup failed', error);
    return NextResponse.json({ error: 'Could not create the account.' }, { status: 500 });
  }
}
