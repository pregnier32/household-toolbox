'use server';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { supabaseServer } from './supabaseServer';
import { createSupabaseAuthServerClient } from './supabaseAuthServer';
import { readMfaAccess } from './mfa-gate';
import { resolveHouseholdAccess } from './household-access';
import { ensureDefaultAccountEntitlements } from './promotion-service';
import type { HouseholdRole } from './session-types';

/** Stale browsers may still hold this cookie from before Supabase Auth. It is not read for sign-in. */
const LEGACY_SESSION_COOKIE_NAME = 'household-toolbox-session';

export type { HouseholdRole } from './session-types';

export type AppSession = {
  id: string;
  actorId: string;
  email: string;
  firstName: string;
  lastName?: string;
  userStatus?: string;
  themePreference?: 'light' | 'dark';
  householdReady: boolean;
  householdId: string;
  householdRole: HouseholdRole;
  householdOwnerId: string;
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
    actorId: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name || undefined,
    userStatus: user.user_status || undefined,
    themePreference: themePreference(user.theme_preference),
    householdReady: false,
    householdId: user.id,
    householdRole: 'admin',
    householdOwnerId: user.id,
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

export type SessionGate =
  | { status: 'anonymous' }
  | { status: 'mfa_required'; user: AppSession }
  | { status: 'mfa_unknown'; user: AppSession }
  | { status: 'ok'; user: AppSession };

async function resolveSession(): Promise<SessionGate> {
  const userId = await readSupabaseUserId();
  if (!userId) return { status: 'anonymous' };

  try {
    const { data: user, error } = await loadProfile(userId);
    if (error) {
      console.error('Application profile lookup failed for Supabase Auth user', userId);
      return { status: 'anonymous' };
    }
    if (!user) {
      console.error('Supabase Auth user has no public.users row', userId);
      await signOutSupabaseAuth();
      return { status: 'anonymous' };
    }
    if (user.active !== 'Y') {
      console.error('Supabase Auth user is inactive in public.users', userId);
      await signOutSupabaseAuth();
      return { status: 'anonymous' };
    }
    const access = await resolveHouseholdAccess(user.id);
    if (access.ready && access.householdRole === 'admin' && access.householdOwnerId === user.id) {
      try {
        await ensureDefaultAccountEntitlements(user.id);
      } catch (error) {
        console.error('Default entitlement check failed', error instanceof Error ? error.message : 'unknown');
      }
    }
    const appUser: AppSession = {
      ...toAppSession(user),
      householdReady: access.ready,
      householdId: access.householdId,
      householdRole: access.householdRole,
      householdOwnerId: access.householdOwnerId,
    };
    const mfa = await readMfaAccess();
    if (mfa === 'required') return { status: 'mfa_required', user: appUser };
    if (mfa === 'unknown') return { status: 'mfa_unknown', user: appUser };
    return { status: 'ok', user: appUser };
  } catch {
    console.error('Application profile lookup failed for Supabase Auth user', userId);
    return { status: 'anonymous' };
  }
}

export const getSessionGate = cache(resolveSession);

export async function getSession(): Promise<AppSession | null> {
  const gate = await getSessionGate();
  if (gate.status !== 'ok') return null;
  return gate.user;
}

/** Tool, storage, and calendar reads use the household Admin's user id. */
export async function getHouseholdDataSession(): Promise<AppSession | null> {
  const user = await getSession();
  if (!user) return null;
  if (user.id === user.householdOwnerId) return user;
  return { ...user, id: user.householdOwnerId };
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
