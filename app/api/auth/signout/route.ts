import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/session';
import { createSupabaseAuthServerClient } from '@/lib/supabaseAuthServer';

const SESSION_COOKIE_NAME = 'household-toolbox-session';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createSupabaseAuthServerClient();
    await supabase.auth.signOut();
  } catch {
    console.error('Supabase Auth sign-out failed');
  }

  try {
    await deleteSession();
  } catch {
    console.error('Legacy session sign-out failed');
  }

  const response = NextResponse.json(
    { success: true },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
  const expire = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };
  response.cookies.set(SESSION_COOKIE_NAME, '', expire);
  response.cookies.delete({ name: SESSION_COOKIE_NAME, path: '/' });
  return response;
}
