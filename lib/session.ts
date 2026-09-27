'use server';

import { cookies } from 'next/headers';
import { supabaseServer } from './supabaseServer';
import { createSupabaseAuthServerClient } from './supabaseAuthServer';

/** Stale browsers may still hold this cookie from before Supabase Auth. It is not read for sign-in. */
const LEGACY_SESSION_COOKIE_NAME = 'household-toolbox-session';

export type AppSession = {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  userStatus?: string;
  themePreference?: 'light' | 'dark';
};

function themePreference(value: string | null | undefined): 'light' | 'dark' | undefined {
  if (value === 'light' || value === 'dark') return value;
  return undefined;
}

function toAppSession(user: {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  user_status: string | null;
  theme_preference: string | null;
}): AppSession {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name || undefined,
    userStatus: user.user_status || undefined,
    themePreference: themePreference(user.theme_preference),
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

async function signOutSupabaseAuth() {
  try {
    const supabase = await createSupabaseAuthServerClient();
    await supabase.auth.signOut();
  } catch {
    console.error('Supabase Auth sign-out failed for an invalid application account');
  }
}

export async function getSession(): Promise<AppSession | null> {
  const userId = await readSupabaseUserId();
  if (!userId) return null;

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
    return toAppSession(user);
  } catch {
    console.error('Application profile lookup failed for Supabase Auth user', userId);
    return null;
  }
}

/** Expires a leftover pre-Auth cookie. Sign-in does not read it. */
export async function clearStaleLegacySessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: LEGACY_SESSION_COOKIE_NAME,
    path: '/',
  });
  cookieStore.set(LEGACY_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    expires: new Date(0),
    path: '/',
  });
}
