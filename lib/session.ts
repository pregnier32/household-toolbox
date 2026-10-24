'use server';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { supabaseServer } from './supabaseServer';
import { createSupabaseAuthServerClient } from './supabaseAuthServer';
import { readMfaAccess, readMfaAccessForVerifiedLevel } from './mfa-gate';
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

async function readVerifiedClaims(): Promise<{ sub: string; aal?: string } | null> {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const { data, error } = await supabase.auth.getClaims();
    const sub = data?.claims.sub;
    if (error || !sub) return null;
    const aal = data.claims.aal;
    return { sub, aal: aal === 'aal1' || aal === 'aal2' ? aal : undefined };
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

async function loadActiveProfile(userId: string) {
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
  return user;
}

function withHousehold(
  user: NonNullable<Awaited<ReturnType<typeof loadActiveProfile>>>,
  access: Awaited<ReturnType<typeof resolveHouseholdAccess>>
): AppSession {
  return {
    ...toAppSession(user),
    householdReady: access.ready,
    householdId: access.householdId,
    householdRole: access.householdRole,
    householdOwnerId: access.householdOwnerId,
  };
}

async function resolveSession(): Promise<SessionGate> {
  const claims = await readVerifiedClaims();
  if (!claims) return { status: 'anonymous' };

  try {
    const user = await loadActiveProfile(claims.sub);
    if (!user) return { status: 'anonymous' };
    const access = await resolveHouseholdAccess(user.id);
    if (access.ready && access.householdRole === 'admin' && access.householdOwnerId === user.id) {
      try {
        await ensureDefaultAccountEntitlements(user.id);
      } catch (error) {
        console.error('Default entitlement check failed', error instanceof Error ? error.message : 'unknown');
      }
    }
    const appUser = withHousehold(user, access);
    const mfa = await readMfaAccess();
    if (mfa === 'required') return { status: 'mfa_required', user: appUser };
    if (mfa === 'unknown') return { status: 'mfa_unknown', user: appUser };
    return { status: 'ok', user: appUser };
  } catch {
    console.error('Application profile lookup failed for Supabase Auth user', claims.sub);
    return { status: 'anonymous' };
  }
}

export const getSessionGate = cache(resolveSession);

export async function getSession(): Promise<AppSession | null> {
  const gate = await getSessionGate();
  if (gate.status !== 'ok') return null;
  return gate.user;
}

/**
 * Tool, storage, and calendar reads use the household Admin's user id.
 * Verifies the token, the active profile, household membership, and MFA.
 * Skips the default-entitlement grant, which the page gate still runs.
 * A session that has already finished MFA does not list factors again.
 */
async function resolveHouseholdDataSession(): Promise<AppSession | null> {
  const claims = await readVerifiedClaims();
  if (!claims) return null;

  try {
    const user = await loadActiveProfile(claims.sub);
    if (!user) return null;
    const [access, mfa] = await Promise.all([
      resolveHouseholdAccess(user.id),
      readMfaAccessForVerifiedLevel(claims.aal),
    ]);
    if (mfa !== 'open') return null;
    const appUser = withHousehold(user, access);
    if (appUser.id === appUser.householdOwnerId) return appUser;
    return { ...appUser, id: appUser.householdOwnerId };
  } catch {
    console.error('Application profile lookup failed for Supabase Auth user', claims.sub);
    return null;
  }
}

export const getHouseholdDataSession = cache(resolveHouseholdDataSession);

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
