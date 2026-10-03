import { supabaseServer } from './supabaseServer';
import { createSupabaseAuthServerClient } from './supabaseAuthServer';
import { authCallbackUrl, getAuthAppOrigin } from './auth-app-origin';
import { sendHouseholdInvitationEmail, sendWelcomeEmailForNewUser } from './email';
import type { AppSession } from './session';
import {
  canInviteHouseholdUser,
  evaluateExistingAccountJoin,
  generateInvitationToken,
  hashInvitationToken,
  householdSpotsUsed,
  invitationExpiresAt,
  isBlockedHouseholdEmail,
  isInvitationExpired,
  isInvitationTokenShape,
  isValidEmail,
  normalizeEmail,
  HOUSEHOLD_USER_LIMIT,
} from './household-rules';

const SETUP_MESSAGE = 'Household sharing is not set up yet. Run supabase/archive/platform/households.sql in the Supabase SQL editor.';
const ADMIN_ONLY = 'Only the household Admin can manage users.';

export type HouseholdUserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'active';
  joinedAt: string;
};

export type HouseholdInvitationRow = {
  id: string;
  firstName: string;
  email: string;
  status: 'pending';
  invitedAt: string;
  expiresAt: string;
  expired: boolean;
};

export type HouseholdDirectory = {
  spotsUsed: number;
  spotLimit: number;
  canInvite: boolean;
  users: HouseholdUserRow[];
  invitations: HouseholdInvitationRow[];
};

type InvitationRecord = {
  id: string;
  household_id: string;
  invited_email: string;
  invited_first_name: string;
  invited_by_user_id: string;
  status: string;
  expires_at: string;
};

function adminGuard(user: AppSession): string | null {
  if (!user.householdReady) return SETUP_MESSAGE;
  if (user.householdRole !== 'admin') return ADMIN_ONLY;
  return null;
}

async function countUserSpots(householdId: string): Promise<{ activeUsers: number; pending: number }> {
  const [members, invitations] = await Promise.all([
    supabaseServer
      .from('household_members')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .eq('role', 'user')
      .eq('status', 'active'),
    supabaseServer
      .from('household_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .eq('status', 'pending'),
  ]);
  if (members.error) throw members.error;
  if (invitations.error) throw invitations.error;
  return { activeUsers: members.count || 0, pending: invitations.count || 0 };
}

async function householdEmails(householdId: string): Promise<string[]> {
  const members = await supabaseServer
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('status', 'active');
  if (members.error) throw members.error;
  const userIds = (members.data || []).map((row) => row.user_id);
  const emails: string[] = [];
  if (userIds.length > 0) {
    const profiles = await supabaseServer.from('users').select('email').in('id', userIds);
    if (profiles.error) throw profiles.error;
    emails.push(...(profiles.data || []).map((row) => row.email));
  }
  const pending = await supabaseServer
    .from('household_invitations')
    .select('invited_email')
    .eq('household_id', householdId)
    .eq('status', 'pending');
  if (pending.error) throw pending.error;
  emails.push(...(pending.data || []).map((row) => row.invited_email));
  return emails;
}

async function adminFirstName(userId: string): Promise<string> {
  const profile = await supabaseServer.from('users').select('first_name').eq('id', userId).maybeSingle();
  return profile.data?.first_name?.trim() || 'A household Admin';
}

function acceptUrl(token: string): string {
  return `${getAuthAppOrigin()}/invite/${token}`;
}

async function loadInvitationByToken(token: string): Promise<InvitationRecord | null> {
  if (!isInvitationTokenShape(token)) return null;
  const result = await supabaseServer
    .from('household_invitations')
    .select('id, household_id, invited_email, invited_first_name, invited_by_user_id, status, expires_at')
    .eq('token_hash', hashInvitationToken(token))
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

function invitationState(invitation: InvitationRecord | null): 'invalid' | 'cancelled' | 'accepted' | 'expired' | 'valid' {
  if (!invitation) return 'invalid';
  if (invitation.status === 'cancelled') return 'cancelled';
  if (invitation.status === 'accepted') return 'accepted';
  if (invitation.status !== 'pending') return 'invalid';
  if (isInvitationExpired(invitation.expires_at)) return 'expired';
  return 'valid';
}

export async function listHouseholdDirectory(user: AppSession): Promise<{ ok: true; directory: HouseholdDirectory } | { ok: false; error: string; status: number }> {
  const denied = adminGuard(user);
  if (denied) return { ok: false, error: denied, status: user.householdRole === 'admin' ? 503 : 403 };

  const spots = await countUserSpots(user.householdId);
  const members = await supabaseServer
    .from('household_members')
    .select('id, user_id, joined_at')
    .eq('household_id', user.householdId)
    .eq('role', 'user')
    .eq('status', 'active')
    .order('joined_at', { ascending: true });
  if (members.error) throw members.error;

  const userIds = (members.data || []).map((row) => row.user_id);
  const profiles = userIds.length
    ? await supabaseServer.from('users').select('id, email, first_name, last_name').in('id', userIds)
    : { data: [], error: null };
  if (profiles.error) throw profiles.error;
  const profileById = new Map((profiles.data || []).map((row) => [row.id, row]));

  const invitations = await supabaseServer
    .from('household_invitations')
    .select('id, invited_first_name, invited_email, created_at, expires_at')
    .eq('household_id', user.householdId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (invitations.error) throw invitations.error;

  return {
    ok: true,
    directory: {
      spotsUsed: householdSpotsUsed(spots.activeUsers, spots.pending),
      spotLimit: HOUSEHOLD_USER_LIMIT,
      canInvite: canInviteHouseholdUser(spots.activeUsers, spots.pending),
      users: (members.data || []).map((row) => {
        const profile = profileById.get(row.user_id);
        return {
          id: row.id,
          firstName: profile?.first_name || 'User',
          lastName: profile?.last_name || '',
          email: profile?.email || '',
          status: 'active' as const,
          joinedAt: row.joined_at,
        };
      }),
      invitations: (invitations.data || []).map((row) => ({
        id: row.id,
        firstName: row.invited_first_name,
        email: row.invited_email,
        status: 'pending' as const,
        invitedAt: row.created_at,
        expiresAt: row.expires_at,
        expired: isInvitationExpired(row.expires_at),
      })),
    },
  };
}

export async function inviteHouseholdUser(
  user: AppSession,
  input: { firstName: string; email: string }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const denied = adminGuard(user);
  if (denied) return { ok: false, error: denied, status: user.householdRole === 'admin' ? 503 : 403 };

  const firstName = input.firstName.trim();
  const email = normalizeEmail(input.email || '');
  if (!firstName || firstName.length > 80) {
    return { ok: false, error: 'First name is required.', status: 400 };
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: 'Enter a valid email address.', status: 400 };
  }

  const spots = await countUserSpots(user.householdId);
  if (!canInviteHouseholdUser(spots.activeUsers, spots.pending)) {
    return { ok: false, error: 'All 4 User spots are in use.', status: 400 };
  }

  const existingEmails = await householdEmails(user.householdId);
  if (isBlockedHouseholdEmail(email, existingEmails)) {
    return { ok: false, error: 'That email already belongs to this household or has a pending invitation.', status: 400 };
  }

  const { token, tokenHash } = generateInvitationToken();
  const inserted = await supabaseServer
    .from('household_invitations')
    .insert({
      household_id: user.householdId,
      invited_email: email,
      invited_first_name: firstName,
      invited_by_user_id: user.actorId,
      token_hash: tokenHash,
      status: 'pending',
      expires_at: invitationExpiresAt().toISOString(),
    })
    .select('id')
    .maybeSingle();

  if (inserted.error || !inserted.data) {
    if (inserted.error?.code === '23505' || (inserted.error?.message || '').includes('limit')) {
      return { ok: false, error: 'That email already has a pending invitation, or all User spots are in use.', status: 400 };
    }
    console.error('Household invitation insert failed', inserted.error?.code ?? 'unknown');
    return { ok: false, error: 'Could not send the invitation.', status: 500 };
  }

  const mailed = await sendHouseholdInvitationEmail({
    to: email,
    firstName,
    adminFirstName: await adminFirstName(user.actorId),
    acceptUrl: acceptUrl(token),
  });
  if (!mailed.success) {
    await supabaseServer.from('household_invitations').delete().eq('id', inserted.data.id);
    return { ok: false, error: 'The invitation email could not be sent. Nothing was saved.', status: 502 };
  }
  return { ok: true };
}

async function loadOwnedInvitation(user: AppSession, invitationId: string): Promise<InvitationRecord | null> {
  const result = await supabaseServer
    .from('household_invitations')
    .select('id, household_id, invited_email, invited_first_name, invited_by_user_id, status, expires_at')
    .eq('id', invitationId)
    .eq('household_id', user.householdId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

export async function resendHouseholdInvitation(
  user: AppSession,
  invitationId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const denied = adminGuard(user);
  if (denied) return { ok: false, error: denied, status: user.householdRole === 'admin' ? 503 : 403 };
  const invitation = await loadOwnedInvitation(user, invitationId);
  if (!invitation || invitation.status !== 'pending') {
    return { ok: false, error: 'That invitation is no longer pending.', status: 404 };
  }

  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = invitationExpiresAt().toISOString();
  const updated = await supabaseServer
    .from('household_invitations')
    .update({ token_hash: tokenHash, expires_at: expiresAt })
    .eq('id', invitation.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (updated.error || !updated.data) {
    console.error('Household invitation resend failed', updated.error?.code ?? 'missing');
    return { ok: false, error: 'Could not resend the invitation.', status: updated.error ? 500 : 404 };
  }

  const mailed = await sendHouseholdInvitationEmail({
    to: invitation.invited_email,
    firstName: invitation.invited_first_name,
    adminFirstName: await adminFirstName(user.actorId),
    acceptUrl: acceptUrl(token),
  });
  if (!mailed.success) {
    return { ok: false, error: 'A new invitation link was created, but the email could not be sent. Try resend again.', status: 502 };
  }
  return { ok: true };
}

export async function cancelHouseholdInvitation(
  user: AppSession,
  invitationId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const denied = adminGuard(user);
  if (denied) return { ok: false, error: denied, status: user.householdRole === 'admin' ? 503 : 403 };
  const updated = await supabaseServer
    .from('household_invitations')
    .update({ status: 'cancelled', token_hash: generateInvitationToken().tokenHash })
    .eq('id', invitationId)
    .eq('household_id', user.householdId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (updated.error || !updated.data) {
    console.error('Household invitation cancel failed', updated.error?.code ?? 'missing');
    return { ok: false, error: 'Could not cancel the invitation.', status: updated.error ? 500 : 404 };
  }
  return { ok: true };
}

export async function removeHouseholdUser(
  user: AppSession,
  memberId: string
): Promise<{ ok: true; firstName: string } | { ok: false; error: string; status: number }> {
  const denied = adminGuard(user);
  if (denied) return { ok: false, error: denied, status: user.householdRole === 'admin' ? 503 : 403 };

  const member = await supabaseServer
    .from('household_members')
    .select('id, user_id, role, household_id')
    .eq('id', memberId)
    .eq('household_id', user.householdId)
    .maybeSingle();
  if (member.error) throw member.error;
  if (!member.data || member.data.role !== 'user') {
    return { ok: false, error: 'That User is not in this household.', status: 404 };
  }
  if (member.data.user_id === user.actorId || member.data.user_id === user.householdOwnerId) {
    return { ok: false, error: 'The household Admin cannot be removed.', status: 400 };
  }

  const profile = await supabaseServer.from('users').select('first_name').eq('id', member.data.user_id).maybeSingle();
  const removed = await supabaseServer.from('household_members').delete().eq('id', member.data.id).eq('role', 'user');
  if (removed.error) {
    console.error('Household user remove failed', removed.error.code ?? 'unknown');
    return { ok: false, error: 'Could not remove that User.', status: 500 };
  }
  return { ok: true, firstName: profile.data?.first_name || 'This User' };
}

export async function previewHouseholdInvitation(token: string): Promise<{
  state: 'invalid' | 'cancelled' | 'accepted' | 'expired' | 'valid';
  firstName?: string;
  email?: string;
  adminFirstName?: string;
}> {
  let invitation: InvitationRecord | null = null;
  try {
    invitation = await loadInvitationByToken(token);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === '42P01' || code === 'PGRST205') return { state: 'invalid' };
    throw error;
  }
  const state = invitationState(invitation);
  if (!invitation || state === 'invalid') return { state };
  return {
    state,
    firstName: invitation.invited_first_name,
    email: invitation.invited_email,
    adminFirstName: await adminFirstName(invitation.invited_by_user_id),
  };
}

async function membershipForUser(userId: string): Promise<{
  householdId: string;
  role: 'admin' | 'user';
} | null> {
  const member = await supabaseServer
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (member.error) throw member.error;
  if (!member.data) return null;
  return {
    householdId: member.data.household_id,
    role: member.data.role === 'user' ? 'user' : 'admin',
  };
}

async function attachUserToInvitation(userId: string, invitation: InvitationRecord): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const membership = await membershipForUser(userId);
  let otherUserCount = 0;
  let pendingInvitationCount = 0;
  let toolCount = 0;
  if (membership && membership.householdId !== invitation.household_id && membership.role === 'admin') {
    const [users, pending, tools] = await Promise.all([
      supabaseServer
        .from('household_members')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', membership.householdId)
        .eq('role', 'user')
        .eq('status', 'active'),
      supabaseServer
        .from('household_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', membership.householdId)
        .eq('status', 'pending'),
      supabaseServer
        .from('users_tools')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);
    otherUserCount = users.count || 0;
    pendingInvitationCount = pending.count || 0;
    toolCount = tools.count || 0;
  }

  const decision = evaluateExistingAccountJoin({
    hasMembership: Boolean(membership),
    sameHousehold: membership?.householdId === invitation.household_id,
    role: membership?.role ?? null,
    otherUserCount,
    pendingInvitationCount,
    toolCount,
  });
  if (!decision.ok) return { ok: false, error: decision.message, status: 409 };

  if (decision.retireEmptyHousehold && membership) {
    const retired = await supabaseServer.from('households').delete().eq('id', membership.householdId).eq('admin_user_id', userId);
    if (retired.error) {
      console.error('Empty household retire failed', retired.error.code ?? 'unknown');
      return { ok: false, error: 'Could not join this household.', status: 500 };
    }
  }

  if (!(membership && membership.householdId === invitation.household_id && membership.role === 'user')) {
    const inserted = await supabaseServer.from('household_members').insert({
      household_id: invitation.household_id,
      user_id: userId,
      role: 'user',
      status: 'active',
    });
    if (inserted.error && inserted.error.code !== '23505') {
      console.error('Household member insert failed', inserted.error.code ?? 'unknown');
      return { ok: false, error: 'Could not join this household.', status: 500 };
    }
  }

  const accepted = await supabaseServer
    .from('household_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by_user_id: userId,
    })
    .eq('id', invitation.id)
    .eq('status', 'pending');
  if (accepted.error) {
    console.error('Household invitation accept update failed', accepted.error.code ?? 'unknown');
    return { ok: false, error: 'Could not finish accepting the invitation.', status: 500 };
  }
  return { ok: true };
}

export async function acceptHouseholdInvitation(
  user: AppSession,
  token: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const invitation = await loadInvitationByToken(token);
  const state = invitationState(invitation);
  if (!invitation || state === 'invalid' || state === 'cancelled') {
    return { ok: false, error: 'This invitation link is not valid.', status: 400 };
  }
  if (state === 'accepted') return { ok: true };
  if (state === 'expired') {
    return { ok: false, error: 'This invitation has expired. Ask the household Admin to resend it.', status: 400 };
  }
  if (normalizeEmail(user.email) !== normalizeEmail(invitation.invited_email)) {
    return {
      ok: false,
      error: `This invitation was sent to ${invitation.invited_email}. Sign in with that email to accept it.`,
      status: 403,
    };
  }
  return attachUserToInvitation(user.actorId, invitation);
}

export async function acceptHouseholdInvitationSignup(input: {
  token: string;
  firstName: string;
  password: string;
}): Promise<{ ok: true; needsEmailConfirmation: boolean } | { ok: false; error: string; status: number }> {
  const firstName = input.firstName.trim();
  if (!firstName || firstName.length > 80) return { ok: false, error: 'First name is required.', status: 400 };
  if (!input.password || input.password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters long.', status: 400 };
  }

  const invitation = await loadInvitationByToken(input.token);
  const state = invitationState(invitation);
  if (!invitation || state === 'invalid' || state === 'cancelled') {
    return { ok: false, error: 'This invitation link is not valid.', status: 400 };
  }
  if (state === 'expired') {
    return { ok: false, error: 'This invitation has expired. Ask the household Admin to resend it.', status: 400 };
  }
  if (state === 'accepted') return { ok: true, needsEmailConfirmation: false };

  const email = normalizeEmail(invitation.invited_email);
  const existing = await supabaseServer.from('users').select('id').eq('email', email).maybeSingle();
  if (existing.error) {
    console.error('Invitation signup lookup failed');
    return { ok: false, error: 'Could not create the account.', status: 500 };
  }
  if (existing.data) {
    return { ok: false, error: 'An account with this email already exists. Sign in to accept the invitation.', status: 409 };
  }

  const supabase = await createSupabaseAuthServerClient();
  const created = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { emailRedirectTo: authCallbackUrl('/dashboard') },
  });
  if (created.error || !created.data.user) {
    if (created.error?.code === 'user_already_exists') {
      return { ok: false, error: 'An account with this email already exists. Sign in to accept the invitation.', status: 409 };
    }
    console.error('Invitation auth signup failed', created.error?.code ?? 'no_user');
    return { ok: false, error: 'Could not create the account.', status: 500 };
  }
  if ((created.data.user.identities ?? []).length === 0) {
    return { ok: false, error: 'An account with this email already exists. Sign in to accept the invitation.', status: 409 };
  }

  const userId = created.data.user.id;
  const insertedProfile = await supabaseServer.from('users').insert({
    id: userId,
    email,
    first_name: firstName,
    last_name: '',
    active: 'Y',
    user_status: 'guest',
    theme_preference: 'light',
    user_id: userId,
  });
  if (insertedProfile.error) {
    console.error('Invitation profile insert failed', userId);
    await supabaseServer.auth.admin.deleteUser(userId);
    await supabase.auth.signOut();
    return { ok: false, error: 'Could not create the account.', status: 500 };
  }

  const attached = await attachUserToInvitation(userId, invitation);
  if (!attached.ok) {
    await supabaseServer.from('users').delete().eq('id', userId);
    await supabaseServer.auth.admin.deleteUser(userId);
    await supabase.auth.signOut();
    return attached;
  }

  const needsEmailConfirmation = !created.data.user.email_confirmed_at;
  if (needsEmailConfirmation) {
    if (created.data.session) await supabase.auth.signOut();
    return { ok: true, needsEmailConfirmation: true };
  }

  await sendWelcomeEmailForNewUser({ userId, to: email, firstName });
  return { ok: true, needsEmailConfirmation: false };
}
