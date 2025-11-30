'use server';

import { cookies } from 'next/headers';
import { supabaseServer } from './supabaseServer';

const SESSION_COOKIE_NAME = 'household-toolbox-session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function createSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

export async function getSession(): Promise<{ id: string; email: string; firstName: string; lastName?: string; userStatus?: string } | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return null;
  }

  try {
    const { data: user, error } = await supabaseServer
      .from('users')
      .select('id, email, first_name, last_name, active, user_status')
      .eq('id', sessionId)
      .eq('active', 'Y')
      .single();

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name || undefined,
      userStatus: user.user_status || undefined,
    };
  } catch (error) {
    console.error('Session error:', error);
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

