import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateAccountPricing,
  parsePreviewEffectiveAt,
  shiftPreviewDate,
  upcomingBillingEvents,
  type AccountPricingInput,
  type PricingAssignmentInput,
  type PricingToolInput,
} from './account-pricing';
import { assembleBillingPreview, previewAccess } from './billing-preview';

const NOW = new Date('2026-10-03T15:00:00.000Z');

function tool(partial: Partial<PricingToolInput> & Pick<PricingToolInput, 'toolId'>): PricingToolInput {
  return {
    name: partial.name || partial.toolId,
    shelfPriceCents: 1000,
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
    publicCode: partial.publicCode ?? null,
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

test('an empty preview date means the actual clock', () => {
  const parsed = parsePreviewEffectiveAt('', NOW);
  assert.equal(parsed?.toISOString(), NOW.toISOString());
  assert.equal(parsePreviewEffectiveAt('today', NOW)?.toISOString(), NOW.toISOString());
});

test('a shortcut is counted from the actual time, not the simulated time', () => {
  const plus30 = shiftPreviewDate(NOW, 30);
  assert.equal(plus30.toISOString(), '2026-11-02T15:00:00.000Z');
  assert.equal(shiftPreviewDate(NOW, 30).toISOString(), shiftPreviewDate(plus30, 0).toISOString() === plus30.toISOString() ? '2026-11-02T15:00:00.000Z' : '');
  assert.notEqual(shiftPreviewDate(plus30, 30).toISOString(), plus30.toISOString());
});

test('a calendar day keeps the actual UTC time, and an invalid day is rejected', () => {
  assert.equal(parsePreviewEffectiveAt('2026-12-15', NOW)?.toISOString(), '2026-12-15T15:00:00.000Z');
  assert.equal(parsePreviewEffectiveAt('2025-01-01', NOW)?.toISOString(), '2025-01-01T15:00:00.000Z');
  assert.equal(parsePreviewEffectiveAt('2026-02-31', NOW), null);
  assert.equal(parsePreviewEffectiveAt('not-a-date', NOW), null);
});

test('a finished trial is billable at the exact end and covered before it', () => {
  const input = account({
    tools: [tool({ toolId: 'travel', name: 'Travel Log', shelfPriceCents: 200, trialUsed: true, trialStartedAt: '2026-10-01T15:00:00.000Z' })],
  });
  assert.equal(calculateAccountPricing(input, NOW).effectiveMonthlyCents, 0);
  assert.equal(calculateAccountPricing(input, new Date('2026-10-08T15:00:00.000Z')).effectiveMonthlyCents, 200);
  const [event] = upcomingBillingEvents(input, NOW);
  assert.equal(event.at, '2026-10-08T15:00:00.000Z');
  assert.equal(event.beforeCents, 0);
  assert.equal(event.afterCents, 200);
});

test('two promotions that expire together change the price once', () => {
  const expires = '2026-11-01T00:00:00.000Z';
  const input = account({
    tools: [tool({ toolId: 'meal', name: 'Meal Planner', shelfPriceCents: 1000 })],
    assignments: [
      assignment({ id: 'a', benefitType: 'percentage', percentOff: 10, publicCode: 'TEN', expiresAt: expires }),
      assignment({ id: 'b', benefitType: 'percentage', percentOff: 10, publicCode: 'ALSO', expiresAt: expires }),
    ],
  });
  const events = upcomingBillingEvents(input, NOW);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].labels.sort(), ['ALSO expires', 'TEN expires']);
  assert.equal(events[0].beforeCents, 810);
  assert.equal(events[0].afterCents, 1000);
  const expiresAt = input.assignments[0].expiresAt;
  upcomingBillingEvents(input, NOW);
  assert.equal(input.assignments[0].expiresAt, expiresAt);
});

test('preview access is limited to a superadmin and drafts are not written', () => {
  assert.equal(previewAccess(null), 'unauthorized');
  assert.equal(previewAccess('admin'), 'forbidden');
  assert.equal(previewAccess('superadmin'), null);
  const input = account({
    tools: [tool({ toolId: 'travel', name: 'Travel Log', shelfPriceCents: 200, trialUsed: true, trialStartedAt: '2026-10-01T15:00:00.000Z' })],
  });
  const preview = assembleBillingPreview({
    input,
    opened: { id: 'user-1', email: 'a@example.com', firstName: 'Ada', lastName: null },
    billing: { id: 'user-1', email: 'a@example.com', firstName: 'Ada', lastName: null },
    notices: [],
    toolNames: new Map(),
    actualAt: new Date('2026-10-06T15:00:00.000Z'),
    simulatedAt: new Date('2026-10-06T15:00:00.000Z'),
  });
  assert.equal(preview.simulatedNotices.some((notice) => notice.kind === 'trial_ending'), true);
  assert.equal(preview.actualNotices.length, 0);
  assert.equal(input.assignments.length, 0);
});
