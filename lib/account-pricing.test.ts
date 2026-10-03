import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyPricingDiscounts,
  calculateAccountPricing,
  effectiveFreeSlots,
  type AccountPricingInput,
  type PricingAssignmentInput,
  type PricingToolInput,
} from './account-pricing';

const NOW = new Date('2026-10-03T15:00:00.000Z');

function tool(partial: Partial<PricingToolInput> & Pick<PricingToolInput, 'toolId'>): PricingToolInput {
  return {
    name: partial.toolId,
    shelfPriceCents: 200,
    ownedAt: '2026-09-01T00:00:00.000Z',
    trialStartedAt: null,
    trialUsed: false,
    ...partial,
  };
}

function assignment(partial: Partial<PricingAssignmentInput> & Pick<PricingAssignmentInput, 'id' | 'benefitType'>): PricingAssignmentInput {
  return {
    slotMode: null,
    slotCount: null,
    percentOff: null,
    amountCents: null,
    bonusStorageBytes: null,
    effectiveAt: '2026-09-01T00:00:00.000Z',
    expiresAt: null,
    removedAt: null,
    displayName: partial.id,
    publicCode: null,
    customerDescription: 'Benefit',
    source: 'automatic',
    toolIds: [],
    ...partial,
  };
}

function account(partial: Partial<AccountPricingInput>): AccountPricingInput {
  return {
    userId: 'user-1',
    accountType: 'personal',
    isTestAccount: false,
    storageUsedBytes: 0,
    storageAddonGb: 0,
    tools: [],
    assignments: [],
    ...partial,
  };
}

test('free slots use the highest total plus additions', () => {
  assert.equal(effectiveFreeSlots([
    assignment({ id: 'a', benefitType: 'free_tool_slots', slotMode: 'total', slotCount: 2 }),
    assignment({ id: 'b', benefitType: 'free_tool_slots', slotMode: 'total', slotCount: 4 }),
    assignment({ id: 'c', benefitType: 'free_tool_slots', slotMode: 'additional', slotCount: 3 }),
  ]), 7);
});

test('oldest owned tools take free slots; a specific tool does not consume one', () => {
  const state = calculateAccountPricing(account({
    tools: [
      tool({ toolId: 'old', ownedAt: '2026-01-01T00:00:00.000Z' }),
      tool({ toolId: 'mid', ownedAt: '2026-02-01T00:00:00.000Z' }),
      tool({ toolId: 'home', ownedAt: '2026-03-01T00:00:00.000Z' }),
      tool({ toolId: 'new', ownedAt: '2026-04-01T00:00:00.000Z' }),
    ],
    assignments: [
      assignment({ id: 'slots', benefitType: 'free_tool_slots', slotMode: 'total', slotCount: 2 }),
      assignment({ id: 'home', benefitType: 'specific_tools', toolIds: ['home'] }),
    ],
  }), NOW);
  const byId = Object.fromEntries(state.tools.map((item) => [item.toolId, item]));
  assert.equal(byId.old.freeSlotCovered, true);
  assert.equal(byId.mid.freeSlotCovered, true);
  assert.equal(byId.home.specificPromotionCovered, true);
  assert.equal(byId.home.freeSlotCovered, false);
  assert.equal(byId.new.accessLabel, 'Payment Setup Needed');
  assert.equal(state.effectiveMonthlyCents, 200);
  assert.equal(state.freeSlotsRemaining, 0);
});

test('an open trial is not billable and does not take a free slot', () => {
  const state = calculateAccountPricing(account({
    tools: [
      tool({ toolId: 'trial', trialUsed: true, trialStartedAt: '2026-10-01T15:00:00.000Z', ownedAt: '2026-10-01T15:00:00.000Z' }),
      tool({ toolId: 'kept', ownedAt: '2026-01-01T00:00:00.000Z' }),
    ],
    assignments: [assignment({ id: 'slots', benefitType: 'free_tool_slots', slotMode: 'total', slotCount: 1 })],
  }), NOW);
  const trial = state.tools.find((item) => item.toolId === 'trial');
  assert.equal(trial?.accessLabel, 'Free Trial');
  assert.equal(trial?.daysRemaining, 5);
  assert.equal(state.tools.find((item) => item.toolId === 'kept')?.freeSlotCovered, true);
  assert.equal(state.effectiveMonthlyCents, 0);
});

test('a finished trial with no slot becomes payment setup needed', () => {
  const state = calculateAccountPricing(account({
    tools: [tool({ toolId: 'done', trialUsed: true, trialStartedAt: '2026-09-01T00:00:00.000Z' })],
  }), NOW);
  assert.equal(state.tools[0].trialPreviouslyUsed, true);
  assert.equal(state.tools[0].accessLabel, 'Payment Setup Needed');
});

test('fixed discount cannot go below zero and is not a credit', () => {
  const result = applyPricingDiscounts(400, [
    assignment({ id: 'fixed', benefitType: 'fixed_amount', amountCents: 500 }),
  ]);
  assert.equal(result.effectiveMonthlyCents, 0);
  assert.equal(result.fixedDiscountCents, 400);
});

test('percentages apply one after another, then 100% off clears the remainder', () => {
  const sequential = applyPricingDiscounts(1000, [
    assignment({ id: 'p20', benefitType: 'percentage', percentOff: 20 }),
    assignment({ id: 'p10', benefitType: 'percentage', percentOff: 10 }),
  ]);
  assert.equal(sequential.effectiveMonthlyCents, 720);
  const cleared = applyPricingDiscounts(1000, [
    assignment({ id: 'p20', benefitType: 'percentage', percentOff: 20 }),
    assignment({ id: 'full', benefitType: 'percent_100' }),
  ]);
  assert.equal(cleared.effectiveMonthlyCents, 0);
  assert.equal(cleared.fullDiscountCents, 800);
});

test('expired, removed, and future assignments are ignored', () => {
  const state = calculateAccountPricing(account({
    tools: [tool({ toolId: 'a' })],
    assignments: [
      assignment({ id: 'gone', benefitType: 'percent_100', expiresAt: '2026-10-01T00:00:00.000Z' }),
      assignment({ id: 'removed', benefitType: 'percent_100', removedAt: '2026-09-01T00:00:00.000Z' }),
      assignment({ id: 'later', benefitType: 'percent_100', effectiveAt: '2026-11-01T00:00:00.000Z' }),
    ],
  }), NOW);
  assert.equal(state.effectiveMonthlyCents, 200);
  assert.equal(state.activePromotions.length, 0);
});

test('an assignment that ends at the exact clock is no longer active', () => {
  const state = calculateAccountPricing(account({
    tools: [tool({ toolId: 'a' })],
    assignments: [assignment({ id: 'ends', benefitType: 'percent_100', expiresAt: NOW.toISOString() })],
  }), NOW);
  assert.equal(state.activePromotions.length, 0);
});

test('storage base is 200 MB at $0 and 1 GB when a monthly amount is expected', () => {
  const free = calculateAccountPricing(account({
    storageAddonGb: 1,
    assignments: [assignment({ id: 'bonus', benefitType: 'bonus_storage', bonusStorageBytes: 50 })],
  }), NOW);
  assert.equal(free.baseStorageBytes, 200 * 1024 * 1024);
  assert.equal(free.effectiveStorageBytes, 200 * 1024 * 1024 + 1024 * 1024 * 1024 + 50);

  const paid = calculateAccountPricing(account({
    tools: [tool({ toolId: 'a' })],
  }), NOW);
  assert.equal(paid.baseStorageBytes, 1024 * 1024 * 1024);
  assert.equal(paid.paymentSetupWouldBeNeeded, true);
});

test('the same inputs at a later date project the price after a trial ends', () => {
  const input = account({
    tools: [tool({
      toolId: 'trial',
      trialUsed: true,
      trialStartedAt: '2026-10-01T15:00:00.000Z',
      ownedAt: '2026-10-01T15:00:00.000Z',
    })],
  });
  const today = calculateAccountPricing(input, NOW);
  const later = calculateAccountPricing(input, new Date('2026-10-09T15:00:00.000Z'));
  assert.equal(today.effectiveMonthlyCents, 0);
  assert.equal(later.effectiveMonthlyCents, 200);
});
