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
import { assembleBillingPreview, buildCustomerStatement, previewAccess } from './billing-preview';

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

test('the customer statement lists tools alphabetically, then storage, promotions, and the new total', () => {
  const input = account({
    storageUsedBytes: 50 * 1024 * 1024,
    storageAddonGb: 1,
    tools: [
      tool({ toolId: 'c', name: 'Charlie', shelfPriceCents: 200, ownedAt: '2026-09-03T00:00:00.000Z' }),
      tool({ toolId: 'a', name: 'Alpha', shelfPriceCents: 200, ownedAt: '2026-09-01T00:00:00.000Z' }),
      tool({ toolId: 'b', name: 'Bravo', shelfPriceCents: 200, ownedAt: '2026-09-02T00:00:00.000Z' }),
    ],
    assignments: [
      assignment({ id: 'slots', benefitType: 'free_tool_slots', slotMode: 'total', slotCount: 2, displayName: 'New member', publicCode: 'NEWUSER2' }),
    ],
  });
  const state = calculateAccountPricing(input, NOW);
  const rows = buildCustomerStatement(input, state);
  assert.deepEqual(rows.map((row) => row.label), [
    'Tools',
    'Alpha',
    'Bravo',
    'Charlie',
    'Storage',
    'Paid Acct',
    'Regular monthly cost',
    'Promotions',
    'NEWUSER2',
    'Monthly cost',
  ]);
  assert.equal(rows[1].amount, '$2/month');
  assert.equal(rows[2].amount, '$2/month');
  assert.equal(rows[2].detail, 'Added 09/02/2026');
  assert.equal(rows[5].detail, '50 MB of 2.00 GB');
  assert.equal(rows[5].amount, '$1/month');
  assert.equal(rows[6].amount, '$7/month');
  assert.equal(rows[8].detail, 'Benefit');
  assert.equal(rows[8].amount, '-$4/month');
  assert.equal(rows[9].amount, '$3/month');
  assert.equal(assembleBillingPreview({
    input,
    opened: { id: 'user-1', email: 'a@example.com', firstName: 'Ada', lastName: null },
    billing: { id: 'user-1', email: 'a@example.com', firstName: 'Ada', lastName: null },
    notices: [],
    toolNames: new Map(),
    actualAt: NOW,
    simulatedAt: NOW,
  }).customerPlan.statement.find((row) => row.kind === 'total')?.amount, '$3/month');

  const catalogOnly = account({
    tools: [tool({ toolId: 'meal', name: 'Meal Planner', shelfPriceCents: 0, catalogPriceCents: 200 })],
  });
  const catalogRows = buildCustomerStatement(catalogOnly, calculateAccountPricing(catalogOnly, NOW));
  assert.equal(catalogRows.find((row) => row.kind === 'tool')?.amount, '$2/month');
  assert.equal(catalogRows.find((row) => row.kind === 'storage')?.label, 'Free Acct');
  assert.equal(catalogRows[catalogRows.length - 1].amount, '$2/month');
});

test('promotion discounts use the displayed tool price when the ownership price is zero', () => {
  const input = account({
    tools: [
      tool({ toolId: 'c', name: 'Charlie', shelfPriceCents: 0, catalogPriceCents: 200, ownedAt: '2026-09-03T00:00:00.000Z' }),
      tool({ toolId: 'a', name: 'Alpha', shelfPriceCents: 0, catalogPriceCents: 200, ownedAt: '2026-09-01T00:00:00.000Z' }),
      tool({ toolId: 'b', name: 'Bravo', shelfPriceCents: 0, catalogPriceCents: 200, ownedAt: '2026-09-02T00:00:00.000Z' }),
    ],
    assignments: [
      assignment({ id: 'slots', benefitType: 'free_tool_slots', slotMode: 'total', slotCount: 2, publicCode: 'HHTB-USER-2FREE', customerDescription: 'Account includes 2 free tools.' }),
      assignment({ id: 'admin', benefitType: 'percent_100', publicCode: 'HHTB-SITE-ADMIN', customerDescription: 'Website owner and testing accounts.' }),
    ],
  });
  const rows = buildCustomerStatement(input, calculateAccountPricing(input, NOW));
  assert.equal(rows.find((row) => row.label === 'HHTB-USER-2FREE')?.detail, 'Account includes 2 free tools.');
  assert.equal(rows.find((row) => row.label === 'HHTB-SITE-ADMIN')?.detail, 'Website owner and testing accounts.');
  assert.equal(rows.find((row) => row.label === 'HHTB-USER-2FREE')?.amount, '-$4/month');
  assert.equal(rows.find((row) => row.label === 'HHTB-SITE-ADMIN')?.amount, '-$2/month');
  assert.equal(rows.find((row) => row.kind === 'total')?.amount, '$0/month');
  assert.equal(rows.find((row) => row.kind === 'subtotal')?.amount, '$6/month');
});
