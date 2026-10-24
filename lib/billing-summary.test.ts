import assert from 'node:assert/strict';
import test from 'node:test';
import type { AccountPricingInput, PricingToolInput } from './account-pricing';
import { trialEndsAt } from './account-pricing';
import { buildCycleCustomerStatement } from './billing-preview';
import { planToolRemoval } from './billing-cycle';
import { uninvoicedCents, type LedgerInvoice } from './billing-ledger';
import { describeBillingSummary } from './billing-summary';
import { describePaymentWorkflow } from './billing-payment-workflow';
import { describeToolAccessPolicy } from './tool-access-policy';

const ANCHOR = '2026-10-24T16:00:00.000Z';
const LATER = '2026-10-24T16:00:01.000Z';
const NOW = new Date(ANCHOR);
const OPEN = new Date(LATER);

function tool(partial: Partial<PricingToolInput> & Pick<PricingToolInput, 'toolId'>): PricingToolInput {
  return {
    name: partial.name || partial.toolId,
    shelfPriceCents: 200,
    ownedAt: ANCHOR,
    trialStartedAt: null,
    trialUsed: false,
    ...partial,
  };
}

function account(tools: PricingToolInput[]): AccountPricingInput {
  return {
    userId: 'user-1',
    accountType: 'personal',
    isTestAccount: false,
    storageUsedBytes: 0,
    storageAddonGb: 0,
    tools,
    assignments: [],
  };
}

function addressBook(ownedAt = LATER): PricingToolInput {
  return tool({ toolId: 'address', name: 'Address Book', ownedAt, trialUsed: false, trialStartedAt: null });
}

function hsa(ownedAt = ANCHOR): PricingToolInput {
  return tool({
    toolId: 'hsa',
    name: 'HSA Tracker',
    ownedAt,
    trialUsed: true,
    trialStartedAt: ownedAt,
  });
}

function policyFor(summary: ReturnType<typeof describeBillingSummary>, now: Date) {
  return describeToolAccessPolicy({
    now,
    tools: summary.tools.map((item) => ({
      toolId: item.toolId,
      name: item.name,
      requiresPaymentNow: item.owedNowCents > 0,
    })),
    invoices: [],
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    hasSavedPaymentMethod: false,
    owedNowCents: summary.owedNowCents,
    nextAmountCents: summary.renewalCents,
    nextBillingAt: summary.renewalAt,
    paymentAttemptAt: null,
    trialActive: summary.tools.some((item) => item.trialEndsAt != null && item.owedNowCents === 0),
  });
}

test('the first tool without a trial is due immediately and locks every tool', () => {
  const summary = describeBillingSummary(account([addressBook(ANCHOR)]), ANCHOR, NOW, null);
  assert.equal(summary.anchorAt, ANCHOR);
  assert.equal(summary.owedNowCents, 200);
  assert.equal(summary.scheduledChargeCents, 0);
  assert.equal(summary.renewalAt, '2026-11-24T16:00:00.000Z');
  assert.equal(summary.renewalCents, 200);
  assert.equal(summary.tools[0].firstChargeAt, ANCHOR);
  assert.equal(policyFor(summary, NOW).locked, true);
});

test('the first tool with a trial sets the anchor and collects nothing during the trial', () => {
  const summary = describeBillingSummary(account([hsa()]), ANCHOR, NOW, null);
  assert.equal(summary.anchorAt, ANCHOR);
  assert.equal(summary.owedNowCents, 0);
  assert.equal(summary.scheduledChargeAt, trialEndsAt(ANCHOR));
  assert.equal(summary.scheduledChargeCents, 200);
  assert.equal(summary.renewalCents, 200);
  assert.equal(summary.tools[0].firstChargeAt, trialEndsAt(ANCHOR));
  assert.equal(policyFor(summary, NOW).locked, false);
});

test('address book is due now, hsa is due when its trial ends, and the renewal stays one month later', () => {
  const input = account([hsa(ANCHOR), addressBook(LATER)]);
  const summary = describeBillingSummary(input, ANCHOR, OPEN, null);
  const statement = buildCycleCustomerStatement(input, ANCHOR, OPEN, null);
  assert.equal(summary.anchorAt, ANCHOR);
  assert.equal(summary.owedNowCents, 200);
  assert.equal(summary.scheduledChargeAt, '2026-10-31T16:00:00.000Z');
  assert.equal(summary.scheduledChargeCents, 200);
  assert.equal(summary.renewalAt, '2026-11-24T16:00:00.000Z');
  assert.equal(summary.renewalCents, 400);
  const address = summary.tools.find((item) => item.toolId === 'address');
  const tracker = summary.tools.find((item) => item.toolId === 'hsa');
  assert.equal(address?.owedNowCents, 200);
  assert.equal(address?.firstChargeAt, LATER);
  assert.equal(address?.inCurrentPeriod, false);
  assert.equal(tracker?.owedNowCents, 0);
  assert.equal(tracker?.trialEndsAt, '2026-10-31T16:00:00.000Z');
  assert.equal(tracker?.firstChargeAt, '2026-10-31T16:00:00.000Z');
  assert.equal(statement.billingCycle.amountDueNow, '$2.00');
  assert.equal(statement.billingCycle.scheduledChargeDate, 'October 31, 2026');
  assert.equal(statement.billingCycle.scheduledChargeAmount, '$2.00');
  assert.equal(statement.billingCycle.renewalDate, 'November 24, 2026');
  assert.equal(statement.billingCycle.renewalAmount, '$4.00');
  assert.equal(statement.statement.find((row) => row.label === 'Address Book')?.note, 'Due now');
  const settled = buildCycleCustomerStatement(input, ANCHOR, OPEN, null, { paidTowardPeriodCents: 200 });
  assert.equal(settled.billingCycle.amountDueNow, '$0.00');
  assert.equal(settled.statement.find((row) => row.label === 'Address Book')?.amount, '$2/month');
  assert.equal(settled.statement.find((row) => row.label === 'Address Book')?.note ?? null, null);
  assert.match(settled.statement.find((row) => row.label === 'HSA Tracker')?.note || '', /Ends Oct 31/);
  assert.equal(settled.billingCycle.scheduledChargeAmount, '$2.00');
  assert.equal(settled.billingCycle.renewalAmount, '$4.00');
  assert.match(statement.statement.find((row) => row.label === 'HSA Tracker')?.note || '', /Ends Oct 31/);
  const workflow = describePaymentWorkflow({
    owedNowCents: summary.owedNowCents,
    nextAmountCents: summary.renewalCents,
    nextBillingAt: summary.renewalAt,
    periodStart: summary.periodStart,
    invoices: [],
    account: null,
    paymentMethodLabel: null,
    scheduledChargeCents: summary.scheduledChargeCents,
    scheduledChargeAt: summary.scheduledChargeAt,
  });
  assert.equal(workflow.collectedTodayCents, 200);
  assert.doesNotMatch(workflow.explanation, /No payment is collected today/);
  assert.match(workflow.explanation, /not the monthly renewal/);
  assert.equal(policyFor(summary, OPEN).locked, true);

  const reversed = describeBillingSummary(account([addressBook(ANCHOR), hsa(LATER)]), ANCHOR, OPEN, null);
  assert.equal(reversed.anchorAt, ANCHOR);
  assert.equal(reversed.owedNowCents, 200);
  assert.equal(reversed.scheduledChargeCents, 200);
  assert.equal(reversed.renewalCents, 400);
});

test('a tool added later without a trial is charged immediately and does not move the anchor', () => {
  const added = '2026-11-02T16:00:00.000Z';
  const summary = describeBillingSummary(account([
    hsa(ANCHOR),
    tool({ toolId: 'notes', name: 'Notes', ownedAt: added, trialUsed: false, trialStartedAt: null }),
  ]), ANCHOR, new Date(added), null);
  assert.equal(summary.anchorAt, ANCHOR);
  assert.equal(summary.renewalAt, '2026-11-24T16:00:00.000Z');
  assert.equal(summary.tools.find((item) => item.toolId === 'notes')?.owedNowCents, 200);
  assert.equal(summary.owedNowCents, 400);
  assert.equal(summary.renewalCents, 400);
});

test('a trial expiration adds one full-price supplemental and leaves the anchor in place', () => {
  const trialEnd = new Date('2026-10-31T16:00:00.000Z');
  const during = describeBillingSummary(account([hsa(ANCHOR), addressBook(LATER)]), ANCHOR, OPEN, null);
  const expired = describeBillingSummary(account([hsa(ANCHOR), addressBook(LATER)]), ANCHOR, trialEnd, null);
  assert.equal(expired.anchorAt, during.anchorAt);
  assert.equal(expired.renewalAt, during.renewalAt);
  assert.equal(expired.scheduledChargeCents, 0);
  assert.equal(expired.owedNowCents - during.owedNowCents, 200);
  assert.equal(expired.owedNowCents, 400);
  assert.equal(expired.renewalCents, 400);
  assert.equal(expired.tools.find((item) => item.toolId === 'hsa')?.trialEndsAt, null);
});

test('an invoice already recorded for this period is not collected again', () => {
  const summary = describeBillingSummary(account([hsa(ANCHOR), addressBook(LATER)]), ANCHOR, OPEN, null);
  const invoices: LedgerInvoice[] = [{
    periodStart: summary.periodStart,
    role: 'supplemental',
    status: 'paid',
    amountCents: 200,
  }];
  assert.equal(uninvoicedCents(summary.owedNowCents, invoices, summary.periodStart), 0);
  const expired = describeBillingSummary(
    account([hsa(ANCHOR), addressBook(LATER)]),
    ANCHOR,
    new Date('2026-10-31T16:00:00.000Z'),
    null,
  );
  assert.equal(uninvoicedCents(expired.owedNowCents, invoices, expired.periodStart), 200);
  const covered: LedgerInvoice[] = [
    ...invoices,
    { periodStart: expired.periodStart, role: 'supplemental', status: 'open', amountCents: 200 },
    { periodStart: expired.periodStart, role: 'supplemental', status: 'void', amountCents: 200 },
    { periodStart: expired.periodStart, role: 'renewal', status: 'uncollectible', amountCents: 200 },
  ];
  assert.equal(uninvoicedCents(expired.owedNowCents, covered, expired.periodStart), 0);
});

test('removing the unpaid tool before an invoice restores the trial tool, and payment does too', () => {
  const input = account([addressBook(ANCHOR), hsa(LATER)]);
  const before = describeBillingSummary(input, ANCHOR, OPEN, null);
  assert.equal(policyFor(before, OPEN).locked, true);
  const plan = planToolRemoval(input, ANCHOR, OPEN, 'address', null, { dropUninvoicedCharge: true });
  assert.equal(plan.kind, 'uncommitted');
  const kept = planToolRemoval(input, ANCHOR, OPEN, 'address', null);
  assert.equal(kept.kind, 'schedule');
  const after = describeBillingSummary(account([hsa(LATER)]), ANCHOR, OPEN, null);
  assert.equal(after.anchorAt, ANCHOR);
  assert.equal(after.owedNowCents, 0);
  assert.equal(after.tools.find((item) => item.toolId === 'hsa')?.trialEndsAt, trialEndsAt(LATER));
  assert.equal(policyFor(after, OPEN).locked, false);
  const paid = describeToolAccessPolicy({
    now: OPEN,
    tools: before.tools.map((item) => ({
      toolId: item.toolId,
      name: item.name,
      requiresPaymentNow: item.owedNowCents > 0,
    })),
    invoices: [],
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: false,
    currentPeriodEnd: '2026-11-24T16:00:00.000Z',
    hasSavedPaymentMethod: true,
    owedNowCents: before.owedNowCents,
    nextAmountCents: before.renewalCents,
    nextBillingAt: before.renewalAt,
    paymentAttemptAt: null,
    trialActive: true,
  });
  assert.equal(paid.locked, false);
});

test('removing and re-adding a tool keeps the original anchor and trial end', () => {
  const readdedAt = '2026-10-26T16:00:00.000Z';
  const summary = describeBillingSummary(account([
    hsa(ANCHOR),
    tool({
      toolId: 'address',
      name: 'Address Book',
      ownedAt: readdedAt,
      trialUsed: true,
      trialStartedAt: ANCHOR,
    }),
  ]), ANCHOR, new Date(readdedAt), null);
  assert.equal(summary.anchorAt, ANCHOR);
  const address = summary.tools.find((item) => item.toolId === 'address');
  assert.equal(address?.trialEndsAt, trialEndsAt(ANCHOR));
  assert.equal(address?.firstChargeAt, trialEndsAt(ANCHOR));
  assert.equal(address?.owedNowCents, 0);
  const expiredTrial = describeBillingSummary(account([
    tool({
      toolId: 'address',
      name: 'Address Book',
      ownedAt: readdedAt,
      trialUsed: true,
      trialStartedAt: '2026-10-01T16:00:00.000Z',
    }),
  ]), ANCHOR, new Date(readdedAt), null);
  assert.equal(expiredTrial.anchorAt, ANCHOR);
  assert.equal(expiredTrial.tools[0].trialEndsAt, null);
  assert.equal(expiredTrial.owedNowCents, 200);
});

test('month-end and timestamp boundaries keep the anchor and charge a non-trial tool immediately', () => {
  const january = '2026-01-31T15:00:00.000Z';
  const monthEnd = describeBillingSummary(
    account([tool({ toolId: 'address', name: 'Address Book', ownedAt: january })]),
    january,
    new Date(january),
    null,
  );
  assert.equal(monthEnd.anchorAt, january);
  assert.equal(monthEnd.owedNowCents, 200);
  assert.equal(monthEnd.renewalAt, '2026-02-28T15:00:00.000Z');
  const onAnniversary = describeBillingSummary(
    account([tool({ toolId: 'address', name: 'Address Book', ownedAt: january })]),
    january,
    new Date('2026-02-28T15:00:00.000Z'),
    null,
  );
  assert.equal(onAnniversary.anchorAt, january);
  assert.equal(onAnniversary.renewalAt, '2026-03-31T15:00:00.000Z');
  assert.equal(onAnniversary.owedNowCents, 200);

  const first = '2026-10-24T14:00:00.000Z';
  const nextMs = '2026-10-24T14:00:00.001Z';
  const boundary = describeBillingSummary(account([
    tool({ toolId: 'address', name: 'Address Book', ownedAt: first }),
    tool({ toolId: 'notes', name: 'Notes', ownedAt: nextMs }),
  ]), first, new Date(nextMs), null);
  assert.equal(boundary.anchorAt, first);
  assert.equal(boundary.tools.find((item) => item.toolId === 'address')?.inCurrentPeriod, true);
  assert.equal(boundary.tools.find((item) => item.toolId === 'notes')?.inCurrentPeriod, false);
  assert.equal(boundary.owedNowCents, 400);
  assert.equal(boundary.renewalAt, '2026-11-24T14:00:00.000Z');

  const nearRenewal = '2026-11-20T16:00:00.000Z';
  const afterRenewal = describeBillingSummary(account([
    tool({
      toolId: 'hsa',
      name: 'HSA Tracker',
      ownedAt: nearRenewal,
      trialUsed: true,
      trialStartedAt: nearRenewal,
    }),
  ]), ANCHOR, new Date(nearRenewal), null);
  assert.equal(afterRenewal.scheduledChargeCents, 0);
  assert.equal(afterRenewal.owedNowCents, 0);
  assert.equal(afterRenewal.anchorAt, ANCHOR);
  assert.equal(afterRenewal.renewalAt, '2026-11-24T16:00:00.000Z');
});
