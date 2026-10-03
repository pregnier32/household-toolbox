import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { inviteHouseholdUser, listHouseholdDirectory } from '@/lib/household';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await listHouseholdDirectory(user);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.directory);
  } catch (error) {
    console.error('GET /api/household/users failed', error);
    return NextResponse.json({ error: 'Could not load household users.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const result = await inviteHouseholdUser(user, {
      firstName: typeof body.firstName === 'string' ? body.firstName : '',
      email: typeof body.email === 'string' ? body.email : '',
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/household/users failed', error);
    return NextResponse.json({ error: 'Could not send the invitation.' }, { status: 500 });
  }
}
