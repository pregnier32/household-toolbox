'use server';

import { cookies } from 'next/headers';
import { supabaseServer } from './supabaseServer';
import { createSupabaseAuthServerClient } from './supabaseAuthServer';

const SESSION_COOKIE_NAME = 'household-toolbox-session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type AppSession = {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  userStatus?: string;
  themePreference?: 'light' | 'dark';
  /** Which identity check produced this session. Callers must not authorize from this field. */
  authSource?: 'supabase' | 'legacy';
};

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

function themePreference(value: string | null | undefined): 'light' | 'dark' | undefined {
  if (value === 'light' || value === 'dark') return value;
  return undefined;
}

function toAppSession(
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string | null;
    user_status: string | null;
    theme_preference: string | null;
  },
  authSource: 'supabase' | 'legacy',
): AppSession {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name || undefined,
    userStatus: user.user_status || undefined,
    themePreference: themePreference(user.theme_preference),
    authSource,
  };
}

async function loadProfile(userId: string) {
  return supabaseServer
    .from('users')
    .select('id, email, first_name, last_name, active, user_status, theme_preference')
    .eq('id', userId)
    .maybeSingle();
}

async function readSupabaseUserId(): Promise<string | null> {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims.sub) return null;
    return data.claims.sub;
  } catch {
    console.error('Supabase Auth session check failed');
    return null;
  }
}

async function sessionFromSupabase(): Promise<AppSession | null | 'fallback'> {
  const userId = await readSupabaseUserId();
  if (!userId) return 'fallback';

  try {
    const { data: user, error } = await loadProfile(userId);
    if (error) {
      console.error('Application profile lookup failed for Supabase Auth user', userId);
      return null;
    }
    if (!user) {
      console.error('Supabase Auth user has no public.users row', userId);
      await signOutSupabaseAuth();
      return null;
    }
    if (user.active !== 'Y') {
      console.error('Supabase Auth user is inactive in public.users', userId);
      await signOutSupabaseAuth();
      return null;
    }
    return toAppSession(user, 'supabase');
  } catch {
    console.error('Application profile lookup failed for Supabase Auth user', userId);
    return null;
  }
}

async function signOutSupabaseAuth() {
  try {
    const supabase = await createSupabaseAuthServerClient();
    await supabase.auth.signOut();
  } catch {
    console.error('Supabase Auth sign-out failed for an invalid application account');
  }
}

async function sessionFromLegacyCookie(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;

  try {
    const { data: user, error } = await loadProfile(sessionId);
    if (error || !user || user.active !== 'Y') return null;
    return toAppSession(user, 'legacy');
  } catch {
    console.error('Legacy session lookup failed');
    return null;
  }
}

export async function getSession(): Promise<AppSession | null> {
  const supabaseSession = await sessionFromSupabase();
  if (supabaseSession !== 'fallback') return supabaseSession;
  return sessionFromLegacyCookie();
}

export async function deleteSession() {
  const cookieStore = await cookies();
  // Path must match createSession or the browser keeps the cookie after Sign Out.
  cookieStore.delete({
    name: SESSION_COOKIE_NAME,
    path: '/',
  });
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    expires: new Date(0),
    path: '/',
  });
}

