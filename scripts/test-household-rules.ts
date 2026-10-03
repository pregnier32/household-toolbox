import assert from 'node:assert/strict';
import {
  HOUSEHOLD_USER_LIMIT,
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
} from '../lib/household-rules.ts';

assert.equal(HOUSEHOLD_USER_LIMIT, 4);
assert.equal(householdSpotsUsed(2, 2), 4);
assert.equal(canInviteHouseholdUser(2, 2), false);
assert.equal(canInviteHouseholdUser(1, 2), true);
assert.equal(canInviteHouseholdUser(4, 0), false);
assert.equal(canInviteHouseholdUser(0, 0), true);

const now = new Date('2026-10-01T00:00:00.000Z');
const expires = invitationExpiresAt(now);
assert.equal(expires.toISOString(), '2026-10-08T00:00:00.000Z');
assert.equal(isInvitationExpired(expires, now), false);
assert.equal(isInvitationExpired(expires, new Date('2026-10-08T00:00:00.000Z')), true);
assert.equal(isInvitationExpired('2026-10-07T23:59:59.000Z', new Date('2026-10-08T00:00:00.000Z')), true);

const first = generateInvitationToken();
const second = generateInvitationToken();
assert.notEqual(first.token, second.token);
assert.equal(first.tokenHash, hashInvitationToken(first.token));
assert.notEqual(first.tokenHash, second.tokenHash);
assert.equal(isInvitationTokenShape(first.token), true);
assert.equal(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(first.token), false);

assert.equal(isValidEmail('person@example.com'), true);
assert.equal(isValidEmail('not-an-email'), false);
assert.equal(isBlockedHouseholdEmail('Person@Example.com', ['person@example.com']), true);
assert.equal(isBlockedHouseholdEmail('new@example.com', ['person@example.com']), false);

assert.deepEqual(
  evaluateExistingAccountJoin({
    hasMembership: false,
    sameHousehold: false,
    role: null,
    otherUserCount: 0,
    pendingInvitationCount: 0,
    toolCount: 0,
  }),
  { ok: true, retireEmptyHousehold: false }
);

assert.equal(
  evaluateExistingAccountJoin({
    hasMembership: true,
    sameHousehold: false,
    role: 'user',
    otherUserCount: 0,
    pendingInvitationCount: 0,
    toolCount: 0,
  }).ok,
  false
);

assert.deepEqual(
  evaluateExistingAccountJoin({
    hasMembership: true,
    sameHousehold: false,
    role: 'admin',
    otherUserCount: 0,
    pendingInvitationCount: 0,
    toolCount: 0,
  }),
  { ok: true, retireEmptyHousehold: true }
);

assert.equal(
  evaluateExistingAccountJoin({
    hasMembership: true,
    sameHousehold: false,
    role: 'admin',
    otherUserCount: 0,
    pendingInvitationCount: 1,
    toolCount: 0,
  }).ok,
  false
);

assert.equal(
  evaluateExistingAccountJoin({
    hasMembership: true,
    sameHousehold: false,
    role: 'admin',
    otherUserCount: 0,
    pendingInvitationCount: 0,
    toolCount: 1,
  }).ok,
  false
);

console.log('household rules ok');
