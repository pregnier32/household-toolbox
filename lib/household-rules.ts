import { createHash, randomBytes } from 'crypto';

export const HOUSEHOLD_USER_LIMIT = 4;
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

export function householdSpotsUsed(activeUserCount: number, pendingInvitationCount: number): number {
  return Math.max(0, activeUserCount) + Math.max(0, pendingInvitationCount);
}

export function canInviteHouseholdUser(activeUserCount: number, pendingInvitationCount: number): boolean {
  return householdSpotsUsed(activeUserCount, pendingInvitationCount) < HOUSEHOLD_USER_LIMIT;
}

export function isInvitationExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  const expires = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Number.isNaN(expires.getTime()) || expires.getTime() <= now.getTime();
}

export function invitationExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_MS);
}

export function generateInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isInvitationTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export type ExistingAccountJoin =
  | { ok: true; retireEmptyHousehold: boolean }
  | { ok: false; message: string };

const ALREADY_IN_HOUSEHOLD =
  'You already belong to a Household Toolbox account, so this invitation cannot move you. A login can only be in one household.';

export function evaluateExistingAccountJoin(input: {
  hasMembership: boolean;
  sameHousehold: boolean;
  role: 'admin' | 'user' | null;
  otherUserCount: number;
  pendingInvitationCount: number;
  toolCount: number;
}): ExistingAccountJoin {
  if (!input.hasMembership) return { ok: true, retireEmptyHousehold: false };
  if (input.sameHousehold && input.role === 'user') return { ok: true, retireEmptyHousehold: false };
  if (input.sameHousehold && input.role === 'admin') {
    return { ok: false, message: 'You are already the Admin of this household.' };
  }
  if (input.role === 'user') return { ok: false, message: ALREADY_IN_HOUSEHOLD };
  const emptySoloAdmin =
    input.role === 'admin' &&
    input.otherUserCount === 0 &&
    input.pendingInvitationCount === 0 &&
    input.toolCount === 0;
  if (emptySoloAdmin) return { ok: true, retireEmptyHousehold: true };
  return { ok: false, message: ALREADY_IN_HOUSEHOLD };
}

export function isBlockedHouseholdEmail(email: string, existingEmails: string[]): boolean {
  const normalized = normalizeEmail(email);
  return existingEmails.some((existing) => normalizeEmail(existing) === normalized);
}
