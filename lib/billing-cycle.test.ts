import assert from 'node:assert/strict';
import test from 'node:test';
import type { AccountPricingInput, PricingAssignmentInput, PricingToolInput } from './account-pricing';
import { buildCycleCustomerStatement } from './billing-preview';
import {
  anniversaryInstant,
  billingDateLabel,
  billingSchedule,
  deriveBillingAnchor,
  describeBillingCycle,
  isPaidCommitment,
  paidRemovalMessage,
  removalNoticeForTool,
  toPeriodRecord,
  trialStatusNote,
} from './billing-cycle';

const SIGNUP = '2026-10-08T15:00:00.000Z';
const FIRST_BILL = '2026-10-15T15:00:00.000Z';

function tool(partial: Partial<PricingToolInput> & Pick<PricingToolInput, 'toolId'>): PricingToolInput {
  return {
    name: partial.name || partial.toolId,
    shelfPriceCents: 200,
    ownedAt: '2026-10-01T15:00:00.000Z',
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
    effectiveAt: '2026-10-01T15:00:00.000Z',
    expiresAt: null,
    removedAt: null,
    displayName: partial.id,
    publicCode: partial.publicCode ?? null,
    customerDescription: 'Benefit',
    source: 'admin_assigned',
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

test('signup plus 7 days establishes the billing anniversary', () => {
  const anchor = deriveBillingAnchor(SIGNUP);
  assert.equal(anchor.firstBillingAt, FIRST_BILL);
  assert.equal(anchor.anniversaryDay, 15);
  const schedule = billingSchedule(SIGNUP, new Date('2026-10-20T15:00:00.000Z'));
  assert.equal(schedule.previousBillingAt, FIRST_BILL);
  assert.equal(schedule.nextBillingAt, '2026-11-15T15:00:00.000Z');
  assert.equal(deriveBillingAnchor(SIGNUP).firstBillingAt, anchor.firstBillingAt);
});

test('a tool added 10 days before billing is included once its trial has ended', () => {
  const input = account({
    tools: [tool({
      toolId: 'clean',
      name: 'Cleaning Schedule',
      ownedAt: '2026-10-05T15:00:00.000Z',
      trialUsed: true,
      trialStartedAt: '2026-10-05T15:00:00.000Z',
    })],
  });
  const cycle = describeBillingCycle(input, SIGNUP, new Date(FIRST_BILL), null);
  const priced = cycle.period?.tools.find((item) => item.toolId === 'clean');
  assert.equal(priced?.inTrial, false);
  assert.equal(isPaidCommitment(priced!), true);
  assert.equal(cycle.period?.effectiveMonthlyCents, 200);
});

test('a tool still in trial on the billing date is not charged', () => {
  const input = account({
    tools: [tool({
      toolId: 'clean',
      name: 'Cleaning Schedule',
      ownedAt: '2026-10-10T15:00:00.000Z',
      trialUsed: true,
      trialStartedAt: '2026-10-10T15:00:00.000Z',
    })],
  });
  const atBill = describeBillingCycle(input, SIGNUP, new Date(FIRST_BILL), null);
  assert.equal(atBill.period?.tools[0].inTrial, true);
  assert.equal(atBill.period?.effectiveMonthlyCents, 0);
  const afterTrial = describeBillingCycle(input, SIGNUP, new Date('2026-10-17T15:00:00.000Z'), null);
  assert.equal(afterTrial.period?.effectiveMonthlyCents, 0);
  assert.equal(afterTrial.next.effectiveMonthlyCents, 200);
});

test('a tool added the day after billing has no mid-cycle charge', () => {
  const input = account({
    tools: [tool({
      toolId: 'chores',
      name: 'Family Chores',
      ownedAt: '2026-10-16T15:00:00.000Z',
      trialUsed: true,
      trialStartedAt: '2026-10-16T15:00:00.000Z',
    })],
  });
  const cycle = describeBillingCycle(input, SIGNUP, new Date('2026-10-20T15:00:00.000Z'), null);
  assert.equal(cycle.period?.tools.length, 0);
  assert.equal(cycle.period?.effectiveMonthlyCents, 0);
  assert.equal(cycle.current.effectiveMonthlyCents, 0);
  assert.equal(cycle.next.tools.some((item) => item.toolId === 'chores'), true);
});

test('a trial that ends exactly at the billing timestamp is expired', () => {
  const input = account({
    tools: [tool({
      toolId: 'clean',
      name: 'Cleaning Schedule',
      ownedAt: '2026-10-08T15:00:00.000Z',
      trialUsed: true,
      trialStartedAt: '2026-10-08T15:00:00.000Z',
    })],
  });
  const cycle = describeBillingCycle(input, SIGNUP, new Date(FIRST_BILL), null);
  assert.equal(cycle.period?.tools[0].inTrial, false);
  assert.equal(isPaidCommitment(cycle.period!.tools[0]), true);
});

test('a tool deleted before the first billing date is not charged', () => {
  const input = account({ tools: [] });
  const cycle = describeBillingCycle(input, SIGNUP, new Date('2026-10-12T15:00:00.000Z'), null);
  assert.equal(cycle.schedule.hasStarted, false);
  assert.equal(cycle.period, null);
  assert.equal(cycle.next.effectiveMonthlyCents, 0);
  assert.equal(removalNoticeForTool(input, SIGNUP, new Date('2026-10-12T15:00:00.000Z'), 'clean', null), null);
});

test('a paid tool deleted after billing stays in the current period and leaves the next one', () => {
  const kept = toPeriodRecord(tool({
    toolId: 'chores',
    name: 'Family Chores',
    ownedAt: '2026-09-01T15:00:00.000Z',
    trialUsed: true,
    trialStartedAt: '2026-09-01T15:00:00.000Z',
  }), true);
  const input = account({ tools: [] });
  const during = describeBillingCycle(input, SIGNUP, new Date('2026-10-20T15:00:00.000Z'), [kept]);
  assert.equal(during.period?.effectiveMonthlyCents, 200);
  assert.equal(during.current.effectiveMonthlyCents, 0);
  assert.equal(during.next.tools.some((item) => item.toolId === 'chores'), false);
  assert.equal(during.next.effectiveMonthlyCents, 0);
  const nextCycle = describeBillingCycle(input, SIGNUP, new Date('2026-11-15T15:00:00.000Z'), null);
  assert.equal(nextCycle.period?.tools.some((item) => item.toolId === 'chores'), false);
});

test('deleting a free-trial tool creates no billing commitment', () => {
  const input = account({ tools: [] });
  const notice = removalNoticeForTool(input, SIGNUP, new Date('2026-10-12T15:00:00.000Z'), 'clean', null);
  assert.equal(notice, null);
});

test('a promotion that expires before billing does not apply, and one that expires after does', () => {
  const priced = tool({
    toolId: 'chores',
    name: 'Family Chores',
    shelfPriceCents: 1000,
    ownedAt: '2026-09-01T15:00:00.000Z',
    trialUsed: true,
    trialStartedAt: '2026-09-01T15:00:00.000Z',
  });
  const before = describeBillingCycle(account({
    tools: [priced],
    assignments: [assignment({ id: 'half', benefitType: 'percentage', percentOff: 50, expiresAt: '2026-10-12T15:00:00.000Z' })],
  }), SIGNUP, new Date(FIRST_BILL), null);
  assert.equal(before.period?.effectiveMonthlyCents, 1000);
  const after = describeBillingCycle(account({
    tools: [priced],
    assignments: [assignment({ id: 'half', benefitType: 'percentage', percentOff: 50, expiresAt: '2026-10-20T15:00:00.000Z' })],
  }), SIGNUP, new Date(FIRST_BILL), null);
  assert.equal(after.period?.effectiveMonthlyCents, 500);
  const later = describeBillingCycle(account({
    tools: [priced],
    assignments: [assignment({ id: 'half', benefitType: 'percentage', percentOff: 50, expiresAt: '2026-10-20T15:00:00.000Z' })],
  }), SIGNUP, new Date('2026-10-21T15:00:00.000Z'), after.periodRecords);
  assert.equal(later.period?.effectiveMonthlyCents, 500);
  assert.equal(later.next.effectiveMonthlyCents, 1000);
});

test('free-slot promotions are counted at the billing timestamp and do not rewrite the period later', () => {
  const tools = ['a', 'b', 'c'].map((id, index) => tool({
    toolId: id,
    name: id,
    ownedAt: `2026-09-0${index + 1}T15:00:00.000Z`,
    trialUsed: true,
    trialStartedAt: `2026-09-0${index + 1}T15:00:00.000Z`,
  }));
  const early = describeBillingCycle(account({
    tools,
    assignments: [
      assignment({ id: 'base', benefitType: 'free_tool_slots', slotMode: 'total', slotCount: 2 }),
      assignment({ id: 'bonus', benefitType: 'free_tool_slots', slotMode: 'additional', slotCount: 1, expiresAt: '2026-10-12T15:00:00.000Z' }),
    ],
  }), SIGNUP, new Date(FIRST_BILL), null);
  assert.equal(early.period?.freeSlots, 2);
  assert.equal(early.period?.effectiveMonthlyCents, 200);
  const late = describeBillingCycle(account({
    tools,
    assignments: [
      assignment({ id: 'base', benefitType: 'free_tool_slots', slotMode: 'total', slotCount: 2 }),
      assignment({ id: 'bonus', benefitType: 'free_tool_slots', slotMode: 'additional', slotCount: 1, expiresAt: '2026-10-20T15:00:00.000Z' }),
    ],
  }), SIGNUP, new Date(FIRST_BILL), null);
  assert.equal(late.period?.freeSlots, 3);
  assert.equal(late.period?.effectiveMonthlyCents, 0);
  const unchanged = describeBillingCycle(account({
    tools,
    assignments: [
      assignment({ id: 'base', benefitType: 'free_tool_slots', slotMode: 'total', slotCount: 2 }),
      assignment({ id: 'bonus', benefitType: 'free_tool_slots', slotMode: 'additional', slotCount: 1, expiresAt: '2026-10-20T15:00:00.000Z' }),
    ],
  }), SIGNUP, new Date('2026-10-21T15:00:00.000Z'), late.periodRecords);
  assert.equal(unchanged.period?.effectiveMonthlyCents, 0);
  assert.equal(unchanged.next.freeSlots, 2);
});

test('months without the anniversary day use the last day and the next month restores it', () => {
  const anchor = deriveBillingAnchor('2026-01-24T15:00:00.000Z');
  assert.equal(anchor.anniversaryDay, 31);
  assert.equal(anniversaryInstant(anchor, 2026, 0).toISOString(), '2026-01-31T15:00:00.000Z');
  assert.equal(anniversaryInstant(anchor, 2026, 1).toISOString(), '2026-02-28T15:00:00.000Z');
  assert.equal(anniversaryInstant(anchor, 2024, 1).toISOString(), '2024-02-29T15:00:00.000Z');
  assert.equal(anniversaryInstant(anchor, 2026, 2).toISOString(), '2026-03-31T15:00:00.000Z');
  const schedule = billingSchedule('2026-01-24T15:00:00.000Z', new Date('2026-02-28T15:00:00.000Z'));
  assert.equal(schedule.previousBillingAt, '2026-02-28T15:00:00.000Z');
  assert.equal(schedule.nextBillingAt, '2026-03-31T15:00:00.000Z');
});

test('a lifetime-free account still has billing dates and a zero estimated bill', () => {
  const input = account({
    tools: [tool({ toolId: 'chores', name: 'Family Chores', ownedAt: '2026-09-01T15:00:00.000Z', trialUsed: true, trialStartedAt: '2026-09-01T15:00:00.000Z' })],
    assignments: [assignment({ id: 'life', benefitType: 'percent_100', publicCode: 'HHTB-SITE-ADMIN' })],
  });
  const cycle = describeBillingCycle(input, SIGNUP, new Date('2026-10-20T15:00:00.000Z'), null);
  assert.equal(cycle.schedule.nextBillingAt, '2026-11-15T15:00:00.000Z');
  assert.equal(cycle.period?.effectiveMonthlyCents, 0);
  assert.equal(cycle.next.effectiveMonthlyCents, 0);
});

test('a simulated clock moves the next billing date without changing the anchor', () => {
  const anchor = deriveBillingAnchor(SIGNUP).firstBillingAt;
  const today = billingSchedule(SIGNUP, new Date('2026-10-20T15:00:00.000Z'));
  const later = billingSchedule(SIGNUP, new Date('2026-11-16T15:00:00.000Z'));
  assert.equal(today.nextBillingAt, '2026-11-15T15:00:00.000Z');
  assert.equal(later.previousBillingAt, '2026-11-15T15:00:00.000Z');
  assert.equal(later.nextBillingAt, '2026-12-15T15:00:00.000Z');
  assert.equal(deriveBillingAnchor(SIGNUP).firstBillingAt, anchor);
});

test('current expected cost and the next bill can differ', () => {
  const live = tool({
    toolId: 'new',
    name: 'New Tool',
    ownedAt: '2026-10-16T15:00:00.000Z',
    trialUsed: true,
    trialStartedAt: '2026-10-01T15:00:00.000Z',
  });
  const input = account({ tools: [live] });
  const cycle = describeBillingCycle(input, SIGNUP, new Date('2026-10-20T15:00:00.000Z'), null);
  assert.equal(cycle.current.effectiveMonthlyCents, 200);
  assert.equal(cycle.period?.effectiveMonthlyCents, 0);
  assert.equal(cycle.next.effectiveMonthlyCents, 200);
});

test('removing a paid tool after billing does not reduce the current period', () => {
  const record = toPeriodRecord(tool({
    toolId: 'chores',
    name: 'Family Chores',
    ownedAt: '2026-09-01T15:00:00.000Z',
    trialUsed: true,
    trialStartedAt: '2026-09-01T15:00:00.000Z',
  }), true);
  const cycle = describeBillingCycle(account({ tools: [] }), SIGNUP, new Date('2026-10-20T15:00:00.000Z'), [record]);
  assert.equal(cycle.period?.effectiveMonthlyCents, 200);
  assert.match(paidRemovalMessage('Family Chores', cycle.schedule.nextBillingAt), /will not be prorated or refunded/);
  assert.match(paidRemovalMessage('Family Chores', cycle.schedule.nextBillingAt), /November 14/);
  assert.equal(trialStatusNote(5, '2026-10-17T15:00:00.000Z'), 'Free Trial — 5 days left · Ends Oct 17');
  assert.equal(billingDateLabel(FIRST_BILL), 'October 15, 2026');
  const statement = buildCycleCustomerStatement(account({ tools: [] }), SIGNUP, new Date('2026-10-20T15:00:00.000Z'), [record]);
  const line = statement.statement.find((row) => row.label === 'Family Chores');
  assert.equal(line?.amount, '$2/month');
  assert.match(line?.note || '', /Scheduled for removal/);
  assert.match(line?.note || '', /November 15, 2026/);
});
