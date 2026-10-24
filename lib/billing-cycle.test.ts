import assert from 'node:assert/strict';
import test from 'node:test';
import type { AccountPricingInput, PricingAssignmentInput, PricingToolInput } from './account-pricing';
import { buildBillingCyclePreview, buildCycleCustomerStatement } from './billing-preview';
import {
  anniversaryInstant,
  billingDateLabel,
  billingSchedule,
  deriveBillingAnchor,
  describeBillingCycle,
  isPaidCommitment,
  paidRemovalMessage,
  paymentWaitsForTrial,
  planToolRemoval,
  removalNoticeForTool,
  skipSupplementalBeforeSubscriptionAnchor,
  toPeriodRecord,
  trialStatusNote,
} from './billing-cycle';
import { describeToolAccessPolicy } from './tool-access-policy';

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

test('the first tool date is the billing date with no extra delay', () => {
  const anchor = deriveBillingAnchor(SIGNUP);
  assert.equal(anchor.firstBillingAt, SIGNUP);
  assert.equal(anchor.anniversaryDay, 8);
  const schedule = billingSchedule(SIGNUP, new Date('2026-10-20T15:00:00.000Z'));
  assert.equal(schedule.previousBillingAt, SIGNUP);
  assert.equal(schedule.nextBillingAt, '2026-11-08T15:00:00.000Z');
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
  const cycle = describeBillingCycle(input, FIRST_BILL, new Date(FIRST_BILL), null);
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
  const atBill = describeBillingCycle(input, FIRST_BILL, new Date(FIRST_BILL), null);
  assert.equal(atBill.period?.tools[0].inTrial, true);
  assert.equal(atBill.period?.effectiveMonthlyCents, 0);
  const stillInTrial = describeBillingCycle(input, FIRST_BILL, new Date('2026-10-16T15:00:00.000Z'), null);
  assert.equal(stillInTrial.period?.effectiveMonthlyCents, 0);
  const afterTrial = describeBillingCycle(input, FIRST_BILL, new Date('2026-10-17T15:00:00.000Z'), null);
  assert.equal(afterTrial.period?.tools[0].inTrial, false);
  assert.equal(afterTrial.period?.effectiveMonthlyCents, 200);
  assert.equal(afterTrial.next.effectiveMonthlyCents, 200);
  const statement = buildCycleCustomerStatement(input, FIRST_BILL, new Date('2026-10-17T15:00:00.000Z'), null);
  const line = statement.statement.find((row) => row.label === 'Cleaning Schedule');
  assert.equal(line?.amount, '$2/month');
  assert.equal(line?.note ?? null, null);
});

test('a tool added with the account shows its price once the trial ends, before the next anniversary', () => {
  const signup = '2026-10-24T03:02:00.000Z';
  const owned = '2026-10-24T03:32:00.000Z';
  const plus30 = new Date('2026-11-23T03:32:00.000Z');
  const input = account({
    tools: [
      tool({ toolId: 'calendar', name: 'Calendar Events', ownedAt: owned, trialUsed: true, trialStartedAt: owned }),
      tool({ toolId: 'todos', name: 'To Do List', ownedAt: owned, trialUsed: true, trialStartedAt: owned }),
    ],
    assignments: [assignment({
      id: 'two-free',
      benefitType: 'free_tool_slots',
      slotMode: 'total',
      slotCount: 2,
      publicCode: '2-FREE',
      customerDescription: 'Account includes 2 free tools.',
      effectiveAt: signup,
    })],
  });
  const onFirstBill = describeBillingCycle(input, owned, new Date('2026-10-31T03:02:00.000Z'), null);
  assert.equal(onFirstBill.period?.tools.every((item) => item.inTrial), true);
  assert.equal(onFirstBill.period?.effectiveMonthlyCents, 0);
  const cycle = describeBillingCycle(input, owned, plus30, null);
  assert.equal(cycle.schedule.nextBillingAt.slice(0, 10), '2026-11-24');
  assert.equal(cycle.period?.tools.every((item) => item.inTrial), false);
  assert.equal(cycle.period?.effectiveMonthlyCents, 0);
  const statement = buildCycleCustomerStatement(input, owned, plus30, null);
  assert.equal(statement.statement.find((row) => row.label === 'Calendar Events')?.amount, '$2/month');
  assert.equal(statement.statement.find((row) => row.label === 'To Do List')?.amount, '$2/month');
  assert.equal(statement.statement.find((row) => row.label === 'Calendar Events')?.note ?? null, null);
  assert.equal(statement.statement.find((row) => row.id === 'before')?.amount, '$4/month');
  assert.equal(statement.statement.find((row) => row.label === '2-FREE')?.amount, '-$4/month');
  assert.equal(statement.statement.find((row) => row.kind === 'total')?.amount, '$0/month');
});

test('a tool added after the billing date stays off this period after its trial ends', () => {
  const input = account({
    tools: [tool({
      toolId: 'chores',
      name: 'Family Chores',
      ownedAt: '2026-10-16T15:00:00.000Z',
      trialUsed: true,
      trialStartedAt: '2026-10-16T15:00:00.000Z',
    })],
  });
  const cycle = describeBillingCycle(input, FIRST_BILL, new Date('2026-10-24T15:00:00.000Z'), null);
  assert.equal(cycle.period?.tools.length, 0);
  assert.equal(cycle.period?.effectiveMonthlyCents, 0);
  const statement = buildCycleCustomerStatement(input, FIRST_BILL, new Date('2026-10-24T15:00:00.000Z'), null);
  const line = statement.statement.find((row) => row.label === 'Family Chores');
  assert.equal(line?.amount, '$2/month');
  assert.match(line?.note || '', /First bill/);
  assert.equal(statement.statement.find((row) => row.id === 'before')?.amount, '$2/month');
  assert.equal(statement.statement.find((row) => row.kind === 'total')?.amount, '$2/month');
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
  const cycle = describeBillingCycle(input, FIRST_BILL, new Date('2026-10-20T15:00:00.000Z'), null);
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
  const cycle = describeBillingCycle(input, FIRST_BILL, new Date(FIRST_BILL), null);
  assert.equal(cycle.period?.tools[0].inTrial, false);
  assert.equal(isPaidCommitment(cycle.period!.tools[0]), true);
});

test('a tool deleted before the first billing date is not charged', () => {
  const input = account({ tools: [] });
  const cycle = describeBillingCycle(input, FIRST_BILL, new Date('2026-10-12T15:00:00.000Z'), null);
  assert.equal(cycle.schedule.hasStarted, false);
  assert.equal(cycle.period, null);
  assert.equal(cycle.next.effectiveMonthlyCents, 0);
  assert.equal(removalNoticeForTool(input, FIRST_BILL, new Date('2026-10-12T15:00:00.000Z'), 'clean', null), null);
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
  const during = describeBillingCycle(input, FIRST_BILL, new Date('2026-10-20T15:00:00.000Z'), [kept]);
  assert.equal(during.period?.effectiveMonthlyCents, 200);
  assert.equal(during.current.effectiveMonthlyCents, 0);
  assert.equal(during.next.tools.some((item) => item.toolId === 'chores'), false);
  assert.equal(during.next.effectiveMonthlyCents, 0);
  const nextCycle = describeBillingCycle(input, FIRST_BILL, new Date('2026-11-15T15:00:00.000Z'), null);
  assert.equal(nextCycle.period?.tools.some((item) => item.toolId === 'chores'), false);
});

test('deleting a free-trial tool creates no billing commitment', () => {
  const input = account({ tools: [] });
  const notice = removalNoticeForTool(input, FIRST_BILL, new Date('2026-10-12T15:00:00.000Z'), 'clean', null);
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
  }), FIRST_BILL, new Date(FIRST_BILL), null);
  assert.equal(before.period?.effectiveMonthlyCents, 1000);
  const after = describeBillingCycle(account({
    tools: [priced],
    assignments: [assignment({ id: 'half', benefitType: 'percentage', percentOff: 50, expiresAt: '2026-10-20T15:00:00.000Z' })],
  }), FIRST_BILL, new Date(FIRST_BILL), null);
  assert.equal(after.period?.effectiveMonthlyCents, 500);
  const later = describeBillingCycle(account({
    tools: [priced],
    assignments: [assignment({ id: 'half', benefitType: 'percentage', percentOff: 50, expiresAt: '2026-10-20T15:00:00.000Z' })],
  }), FIRST_BILL, new Date('2026-10-21T15:00:00.000Z'), after.periodRecords);
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
  }), FIRST_BILL, new Date(FIRST_BILL), null);
  assert.equal(early.period?.freeSlots, 2);
  assert.equal(early.period?.effectiveMonthlyCents, 200);
  const late = describeBillingCycle(account({
    tools,
    assignments: [
      assignment({ id: 'base', benefitType: 'free_tool_slots', slotMode: 'total', slotCount: 2 }),
      assignment({ id: 'bonus', benefitType: 'free_tool_slots', slotMode: 'additional', slotCount: 1, expiresAt: '2026-10-20T15:00:00.000Z' }),
    ],
  }), FIRST_BILL, new Date(FIRST_BILL), null);
  assert.equal(late.period?.freeSlots, 3);
  assert.equal(late.period?.effectiveMonthlyCents, 0);
  const unchanged = describeBillingCycle(account({
    tools,
    assignments: [
      assignment({ id: 'base', benefitType: 'free_tool_slots', slotMode: 'total', slotCount: 2 }),
      assignment({ id: 'bonus', benefitType: 'free_tool_slots', slotMode: 'additional', slotCount: 1, expiresAt: '2026-10-20T15:00:00.000Z' }),
    ],
  }), FIRST_BILL, new Date('2026-10-21T15:00:00.000Z'), late.periodRecords);
  assert.equal(unchanged.period?.effectiveMonthlyCents, 0);
  assert.equal(unchanged.next.freeSlots, 2);
});

test('months without the anniversary day use the last day and the next month restores it', () => {
  const anchor = deriveBillingAnchor('2026-01-31T15:00:00.000Z');
  assert.equal(anchor.anniversaryDay, 31);
  assert.equal(anchor.firstBillingAt, '2026-01-31T15:00:00.000Z');
  assert.equal(anniversaryInstant(anchor, 2026, 0).toISOString(), '2026-01-31T15:00:00.000Z');
  assert.equal(anniversaryInstant(anchor, 2026, 1).toISOString(), '2026-02-28T15:00:00.000Z');
  assert.equal(anniversaryInstant(anchor, 2024, 1).toISOString(), '2024-02-29T15:00:00.000Z');
  assert.equal(anniversaryInstant(anchor, 2026, 2).toISOString(), '2026-03-31T15:00:00.000Z');
  const schedule = billingSchedule('2026-01-31T15:00:00.000Z', new Date('2026-02-28T15:00:00.000Z'));
  assert.equal(schedule.previousBillingAt, '2026-02-28T15:00:00.000Z');
  assert.equal(schedule.nextBillingAt, '2026-03-31T15:00:00.000Z');
});

test('a lifetime-free account still has billing dates and a zero estimated bill', () => {
  const input = account({
    tools: [tool({ toolId: 'chores', name: 'Family Chores', ownedAt: '2026-09-01T15:00:00.000Z', trialUsed: true, trialStartedAt: '2026-09-01T15:00:00.000Z' })],
    assignments: [assignment({ id: 'life', benefitType: 'percent_100', publicCode: 'HHTB-SITE-ADMIN' })],
  });
  const cycle = describeBillingCycle(input, FIRST_BILL, new Date('2026-10-20T15:00:00.000Z'), null);
  assert.equal(cycle.schedule.nextBillingAt, '2026-11-15T15:00:00.000Z');
  assert.equal(cycle.period?.effectiveMonthlyCents, 0);
  assert.equal(cycle.next.effectiveMonthlyCents, 0);
});

test('a simulated clock moves the next billing date without changing the anchor', () => {
  const anchor = deriveBillingAnchor(SIGNUP).firstBillingAt;
  const today = billingSchedule(SIGNUP, new Date('2026-10-20T15:00:00.000Z'));
  const later = billingSchedule(SIGNUP, new Date('2026-11-16T15:00:00.000Z'));
  assert.equal(today.nextBillingAt, '2026-11-08T15:00:00.000Z');
  assert.equal(later.previousBillingAt, '2026-11-08T15:00:00.000Z');
  assert.equal(later.nextBillingAt, '2026-12-08T15:00:00.000Z');
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
  const cycle = describeBillingCycle(input, FIRST_BILL, new Date('2026-10-20T15:00:00.000Z'), null);
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
  const cycle = describeBillingCycle(account({ tools: [] }), FIRST_BILL, new Date('2026-10-20T15:00:00.000Z'), [record]);
  assert.equal(cycle.period?.effectiveMonthlyCents, 200);
  assert.match(paidRemovalMessage('Family Chores', cycle.schedule.nextBillingAt), /will not be prorated or refunded/);
  assert.match(paidRemovalMessage('Family Chores', cycle.schedule.nextBillingAt), /November 14/);
  assert.equal(trialStatusNote(5, '2026-10-17T15:00:00.000Z'), 'Free Trial — 5 days left · Ends Oct 17');
  assert.equal(billingDateLabel(FIRST_BILL), 'October 15, 2026');
  const statement = buildCycleCustomerStatement(account({ tools: [] }), FIRST_BILL, new Date('2026-10-20T15:00:00.000Z'), [record]);
  const line = statement.statement.find((row) => row.label === 'Family Chores');
  assert.equal(line?.amount, '$2/month');
  assert.match(line?.note || '', /Scheduled for removal/);
  assert.match(line?.note || '', /November 15, 2026/);
});

test('tools that share a display name stay separate by tool id', () => {
  const shared = {
    name: 'Family Chores',
    ownedAt: '2026-09-01T15:00:00.000Z',
    trialUsed: true,
    trialStartedAt: '2026-09-01T15:00:00.000Z',
  };
  const first = tool({ toolId: 'chores-a', ...shared });
  const second = tool({ toolId: 'chores-b', ...shared });
  const input = account({ tools: [first, second] });
  const when = new Date('2026-10-20T15:00:00.000Z');
  const plan = planToolRemoval(input, FIRST_BILL, when, 'chores-a', null);
  assert.equal(plan.kind, 'schedule');
  if (plan.kind !== 'schedule') return;
  assert.equal(plan.tools.find((record) => record.toolId === 'chores-a')?.scheduledRemoval, true);
  assert.equal(plan.tools.find((record) => record.toolId === 'chores-b')?.scheduledRemoval, false);
  const preview = buildBillingCyclePreview(input, FIRST_BILL, when, when, plan.tools);
  const lines = preview.nextBill.lines.filter((line) => line.name === 'Family Chores');
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map((line) => line.toolId).sort(), ['chores-a', 'chores-b']);
  assert.equal(lines.find((line) => line.toolId === 'chores-a')?.status, 'Scheduled for removal before next cycle');
  assert.equal(lines.find((line) => line.toolId === 'chores-a')?.amount, '$0');
  assert.equal(lines.find((line) => line.toolId === 'chores-b')?.status, 'Billable');
  assert.equal(lines.find((line) => line.toolId === 'chores-b')?.amount, '$2.00');
  assert.equal(preview.nextBill.lines.filter((line) => line.toolId === 'chores-b').length, 1);
});

test('a tool without a trial is due on the day it is added', () => {
  const added = '2026-10-24T14:00:00.000Z';
  const input = account({
    tools: [tool({ toolId: 'address', name: 'Address Book', ownedAt: added, trialUsed: false, trialStartedAt: null })],
  });
  const cycle = describeBillingCycle(input, added, new Date(added), null);
  assert.equal(cycle.schedule.hasStarted, true);
  assert.equal(cycle.schedule.previousBillingAt, added);
  assert.equal(cycle.period?.effectiveMonthlyCents, 200);
  assert.equal(paymentWaitsForTrial(cycle), false);
  assert.equal(describeToolAccessPolicy({
    now: new Date(added),
    tools: [{ toolId: 'address', name: 'Address Book', requiresPaymentNow: true }],
    invoices: [],
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    hasSavedPaymentMethod: false,
    owedNowCents: 200,
    nextAmountCents: 200,
    nextBillingAt: added,
    paymentAttemptAt: null,
    trialActive: false,
  }).locked, true);
  const statement = buildCycleCustomerStatement(input, added, new Date(added), null);
  assert.equal(statement.statement.find((row) => row.label === 'Address Book')?.amount, '$2/month');
  assert.equal(statement.billingCycle.nextBillingDate, 'October 24, 2026');
});

test('a trial tool does not require payment until the trial ends, and deletion during the trial leaves nothing due', () => {
  const added = '2026-10-24T14:00:00.000Z';
  const during = account({
    tools: [tool({ toolId: 'calendar', name: 'Calendar Events', ownedAt: added, trialUsed: true, trialStartedAt: added })],
  });
  const open = describeBillingCycle(during, added, new Date('2026-10-26T14:00:00.000Z'), null);
  assert.equal(open.period?.effectiveMonthlyCents, 0);
  assert.equal(open.period?.tools[0].inTrial, true);
  assert.equal(paymentWaitsForTrial(open), true);
  assert.equal(isPaidCommitment(open.period!.tools[0]), false);
  assert.equal(describeToolAccessPolicy({
    now: new Date('2026-10-26T14:00:00.000Z'),
    tools: [{ toolId: 'calendar', name: 'Calendar Events', requiresPaymentNow: false }],
    invoices: [],
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    hasSavedPaymentMethod: false,
    owedNowCents: 0,
    nextAmountCents: 200,
    nextBillingAt: '2026-10-31T14:00:00.000Z',
    paymentAttemptAt: null,
    trialActive: true,
  }).locked, false);
  const removed = describeBillingCycle(account({ tools: [] }), added, new Date('2026-10-26T14:00:00.000Z'), null);
  assert.equal(removed.period?.effectiveMonthlyCents, 0);
  assert.equal(removed.next.effectiveMonthlyCents, 0);
  assert.equal(removalNoticeForTool(account({ tools: [] }), added, new Date('2026-10-26T14:00:00.000Z'), 'calendar', null), null);
  const after = describeBillingCycle(during, added, new Date('2026-10-31T14:00:00.000Z'), null);
  assert.equal(after.period?.tools[0].inTrial, false);
  assert.equal(after.period?.effectiveMonthlyCents, 200);
  assert.equal(paymentWaitsForTrial(after), false);
  const unpaid = {
    now: new Date('2026-10-31T14:00:00.000Z'),
    tools: [{ toolId: 'calendar', name: 'Calendar Events', requiresPaymentNow: true }],
    invoices: [] as [],
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    owedNowCents: 200,
    nextAmountCents: 200,
    nextBillingAt: '2026-10-31T14:00:00.000Z',
    paymentAttemptAt: null,
    trialActive: false,
  };
  assert.equal(describeToolAccessPolicy({ ...unpaid, hasSavedPaymentMethod: false }).locked, true);
  assert.equal(describeToolAccessPolicy({ ...unpaid, hasSavedPaymentMethod: true }).locked, true);
});

test('an existing subscription with a future anchor is not invoiced again for an earlier period', () => {
  assert.equal(skipSupplementalBeforeSubscriptionAnchor({
    subscriptionStatus: 'active',
    billingCycleAnchor: '2026-10-31T15:00:00.000Z',
    periodStart: '2026-10-24T15:00:00.000Z',
    now: new Date('2026-10-24T16:00:00.000Z'),
  }), true);
  assert.equal(skipSupplementalBeforeSubscriptionAnchor({
    subscriptionStatus: null,
    billingCycleAnchor: null,
    periodStart: '2026-10-24T15:00:00.000Z',
    now: new Date('2026-10-24T16:00:00.000Z'),
  }), false);
});
