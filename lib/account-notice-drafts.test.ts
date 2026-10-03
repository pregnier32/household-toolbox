import assert from 'node:assert/strict';
import test from 'node:test';
import { draftAccountNotices } from './account-notice-drafts';
import type { AccountPricingInput } from './account-pricing';

const input: AccountPricingInput = {
  userId: 'user-1',
  accountType: 'personal',
  isTestAccount: false,
  storageUsedBytes: 0,
  storageAddonGb: 0,
  tools: [{
    toolId: 'clean',
    name: 'Cleaning Schedule',
    shelfPriceCents: 200,
    ownedAt: '2026-10-01T15:00:00.000Z',
    trialStartedAt: '2026-10-01T15:00:00.000Z',
    trialUsed: true,
  }],
  assignments: [],
};

test('a trial two days from its end creates one ending notice', () => {
  const drafts = draftAccountNotices(input, new Date('2026-10-06T15:00:00.000Z'));
  assert.equal(drafts.filter((draft) => draft.kind === 'trial_ending').length, 1);
  assert.match(drafts[0].body, /expected monthly cost/i);
  assert.doesNotMatch(drafts[0].body, /will be charged/i);
});

test('the same trial does not warn again on the next evaluation the same day', () => {
  const first = draftAccountNotices(input, new Date('2026-10-06T15:00:00.000Z'));
  const second = draftAccountNotices(input, new Date('2026-10-06T18:00:00.000Z'));
  assert.equal(first[0].eventKey, second[0].eventKey);
});

test('a promotion with no price change does not create an expiration warning', () => {
  const covered: AccountPricingInput = {
    ...input,
    tools: [{ ...input.tools[0], trialStartedAt: null, trialUsed: false }],
    assignments: [
      {
        id: 'slots',
        benefitType: 'free_tool_slots',
        slotMode: 'total',
        slotCount: 2,
        percentOff: null,
        amountCents: null,
        bonusStorageBytes: null,
        effectiveAt: '2026-09-01T00:00:00.000Z',
        expiresAt: null,
        removedAt: null,
        displayName: 'Two free tools',
        publicCode: 'NEWUSER2',
        customerDescription: 'Two free tools',
        source: 'automatic',
        toolIds: [],
      },
      {
        id: 'bonus',
        benefitType: 'free_tool_slots',
        slotMode: 'additional',
        slotCount: 1,
        percentOff: null,
        amountCents: null,
        bonusStorageBytes: null,
        effectiveAt: '2026-09-01T00:00:00.000Z',
        expiresAt: '2026-10-10T00:00:00.000Z',
        removedAt: null,
        displayName: 'Bonus slot',
        publicCode: 'BONUS',
        customerDescription: 'One extra slot',
        source: 'user_entered',
        toolIds: [],
      },
    ],
  };
  const drafts = draftAccountNotices(covered, new Date('2026-10-03T00:00:00.000Z'));
  assert.equal(drafts.some((draft) => draft.kind === 'promotion_expiring'), false);
});
