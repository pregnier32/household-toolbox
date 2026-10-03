import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { cancelHouseholdInvitation, resendHouseholdInvitation } from '@/lib/household';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { invitationId } = await params;
    const result = await resendHouseholdInvitation(user, invitationId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/household/invitations failed', error);
    return NextResponse.json({ error: 'Could not resend the invitation.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { invitationId } = await params;
    const result = await cancelHouseholdInvitation(user, invitationId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/household/invitations failed', error);
    return NextResponse.json({ error: 'Could not cancel the invitation.' }, { status: 500 });
  }
}
