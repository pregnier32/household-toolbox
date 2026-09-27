import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userStatus: user.userStatus,
      themePreference: user.themePreference,
    },
  });
}

