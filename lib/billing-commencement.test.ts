import assert from 'node:assert/strict';
import test from 'node:test';
import type { AccountPricingInput, PricingToolInput } from './account-pricing';
import { projectLiveCharges } from './billing-commencement';
import { buildCycleCustomerStatement } from './billing-preview';
import { describeBillingSummary } from './billing-summary';
import { uninvoicedCents, type LedgerInvoice } from './billing-ledger';
import { describePaymentWorkflow } from './billing-payment-workflow';
import { describeToolAccessPolicy } from './tool-access-policy';
import { billingAccountForMode } from './billing-environment';

const ANCHOR = '2026-10-24T16:00:00.000Z';
const LATER = '2026-10-24T18:00:00.000Z';
const NOW = new Date(LATER);

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
    userId: 'household',
    accountType: 'personal',
    isTestAccount: false,
    storageUsedBytes: 0,
    storageAddonGb: 0,
    tools,
    assignments: [],
  };
}

function addressBook(ownedAt = LATER): PricingToolInput {
  return tool({ toolId: 'address', name: 'Address Book', ownedAt });
}

function hsa(ownedAt = ANCHOR): PricingToolInput {
  return tool({ toolId: 'hsa', name: 'HSA Tracker', ownedAt, trialUsed: true, trialStartedAt: ownedAt });
}

function paidSandboxInvoice(periodStart: string): LedgerInvoice & { amountPaidCents: number } {
  return {
    periodStart,
    role: 'supplemental',
    status: 'paid',
    amountCents: 200,
    amountPaidCents: 200,
  };
}

test('an existing household with unpaid sandbox commitments is not charged that history at live Checkout', () => {
  const pricing = account([addressBook(), hsa()]);
  const summary = describeBillingSummary(pricing, ANCHOR, NOW, null);
  assert.equal(summary.anchorAt, ANCHOR);
  assert.equal(summary.owedNowCents, 200);
  assert.equal(summary.scheduledChargeCents, 200);
  assert.equal(summary.renewalCents, 400);
  const raw = describePaymentWorkflow({
    owedNowCents: summary.owedNowCents,
    nextAmountCents: summary.renewalCents,
    nextBillingAt: summary.renewalAt,
    periodStart: summary.periodStart,
    scheduledChargeCents: summary.scheduledChargeCents,
    scheduledChargeAt: summary.scheduledChargeAt,
    invoices: [],
    account: null,
    paymentMethodLabel: null,
  });
  assert.equal(raw.collectedTodayCents, 200);

  const live = projectLiveCharges({
    mode: 'live',
    sandboxHistory: true,
    commenced: false,
    sameExcludedPeriod: false,
    fullOwedNowCents: summary.owedNowCents,
    fullScheduledCents: summary.scheduledChargeCents,
    historicalOwedNowCents: summary.owedNowCents,
    historicalScheduledCents: summary.scheduledChargeCents,
    renewalCents: summary.renewalCents,
  });
  assert.equal(live.owedNowCents, 0);
  assert.equal(live.scheduledChargeCents, 0);
  assert.equal(live.historicalCents, 400);
  assert.equal(live.renewalCents, 400);
  const workflow = describePaymentWorkflow({
    owedNowCents: live.owedNowCents,
    nextAmountCents: live.renewalCents,
    nextBillingAt: summary.renewalAt,
    periodStart: summary.periodStart,
    scheduledChargeCents: live.scheduledChargeCents,
    invoices: [],
    account: null,
    paymentMethodLabel: null,
    historicalCents: live.historicalCents,
  });
  assert.equal(workflow.collectedTodayCents, 0);
  assert.equal(workflow.route, 'checkout');
  assert.match(workflow.explanation, /No payment is collected today/);
  assert.match(workflow.explanation, /\$4\.00 on November 24, 2026/);
  assert.match(workflow.explanation, /Previous test balances are not charged/);
  assert.doesNotMatch(workflow.explanation, /collects \$2\.00 today/);
  const statement = buildCycleCustomerStatement(pricing, ANCHOR, NOW, null, {
    excludedOwedCents: summary.owedNowCents,
    excludedScheduledCents: summary.scheduledChargeCents,
    excludedToolIds: ['address', 'hsa'],
  });
  assert.equal(statement.billingCycle.amountDueNow, '$0.00');
  assert.equal(statement.billingCycle.scheduledChargeAmount, null);
  assert.equal(statement.billingCycle.renewalAmount, '$4.00');
  assert.equal(statement.billingCycle.anchorDate, 'October 24, 2026');
  assert.equal(statement.statement.find((row) => row.label === 'Address Book')?.note ?? null, null);
  const access = describeToolAccessPolicy({
    now: NOW,
    tools: summary.tools.map((item) => ({ toolId: item.toolId, name: item.name, requiresPaymentNow: false })),
    invoices: [],
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    hasSavedPaymentMethod: false,
    owedNowCents: live.owedNowCents,
    nextAmountCents: live.renewalCents,
    nextBillingAt: summary.renewalAt,
    scheduledChargeCents: live.scheduledChargeCents,
    paymentAttemptAt: null,
    trialActive: true,
    alreadyLocked: true,
  });
  assert.equal(access.locked, false);
});

test('a paid sandbox invoice is not a live credit and is not collected again', () => {
  const summary = describeBillingSummary(account([addressBook(), hsa()]), ANCHOR, NOW, null);
  const visibleToLiveLedger = uninvoicedCents(summary.owedNowCents, [], summary.periodStart);
  assert.equal(visibleToLiveLedger, 200);
  const ifSandboxPaymentWereTreatedAsLive = uninvoicedCents(summary.owedNowCents, [paidSandboxInvoice(summary.periodStart ?? '')], summary.periodStart);
  assert.equal(ifSandboxPaymentWereTreatedAsLive, 0);
  const live = projectLiveCharges({
    mode: 'live',
    sandboxHistory: true,
    commenced: false,
    sameExcludedPeriod: false,
    fullOwedNowCents: summary.owedNowCents,
    fullScheduledCents: summary.scheduledChargeCents,
    historicalOwedNowCents: summary.owedNowCents,
    historicalScheduledCents: summary.scheduledChargeCents,
    renewalCents: summary.renewalCents,
  });
  const workflow = describePaymentWorkflow({
    owedNowCents: live.owedNowCents,
    nextAmountCents: live.renewalCents,
    nextBillingAt: summary.renewalAt,
    periodStart: summary.periodStart,
    scheduledChargeCents: live.scheduledChargeCents,
    invoices: [],
    account: null,
    paymentMethodLabel: null,
    historicalCents: live.historicalCents,
  });
  assert.equal(workflow.collectedTodayCents, 0);
  assert.equal(workflow.nextAmountCents, 400);
  assert.match(workflow.explanation, /Previous test balances are not charged/);
  assert.match(workflow.explanation, /\$4\.00 on November 24, 2026/);
});

test('a new household after cutover is charged for a new tool and sees that charge before Checkout', () => {
  const summary = describeBillingSummary(account([addressBook(ANCHOR)]), ANCHOR, new Date(ANCHOR), null);
  const live = projectLiveCharges({
    mode: 'live',
    sandboxHistory: false,
    commenced: true,
    sameExcludedPeriod: false,
    fullOwedNowCents: summary.owedNowCents,
    fullScheduledCents: summary.scheduledChargeCents,
    historicalOwedNowCents: 0,
    historicalScheduledCents: 0,
    renewalCents: summary.renewalCents,
  });
  assert.equal(live.owedNowCents, 200);
  assert.equal(live.historicalCents, 0);
  assert.equal(live.renewalCents, 200);
  const workflow = describePaymentWorkflow({
    owedNowCents: live.owedNowCents,
    nextAmountCents: live.renewalCents,
    nextBillingAt: summary.renewalAt,
    periodStart: summary.periodStart,
    scheduledChargeCents: live.scheduledChargeCents,
    scheduledChargeAt: summary.scheduledChargeAt,
    invoices: [],
    account: null,
    paymentMethodLabel: null,
    historicalCents: live.historicalCents,
  });
  assert.equal(workflow.collectedTodayCents, 200);
  assert.match(workflow.explanation, /collects \$2\.00 today/);
  assert.match(workflow.explanation, /\$2\.00 on November 24, 2026/);
  assert.doesNotMatch(workflow.explanation, /Previous test balances are not charged/);
});

test('a tool added after live commencement is the only new charge in the sandbox period', () => {
  const commenced = projectLiveCharges({
    mode: 'live',
    sandboxHistory: true,
    commenced: true,
    sameExcludedPeriod: true,
    fullOwedNowCents: 400,
    fullScheduledCents: 200,
    historicalOwedNowCents: 200,
    historicalScheduledCents: 200,
    renewalCents: 600,
  });
  assert.equal(commenced.owedNowCents, 200);
  assert.equal(commenced.scheduledChargeCents, 0);
  assert.equal(commenced.historicalCents, 400);
  assert.equal(commenced.renewalCents, 600);
  const workflow = describePaymentWorkflow({
    owedNowCents: commenced.owedNowCents,
    nextAmountCents: commenced.renewalCents,
    nextBillingAt: '2026-11-24T16:00:00.000Z',
    periodStart: ANCHOR,
    scheduledChargeCents: commenced.scheduledChargeCents,
    invoices: [],
    account: null,
    paymentMethodLabel: null,
    historicalCents: commenced.historicalCents,
  });
  assert.equal(workflow.collectedTodayCents, 200);
  assert.match(workflow.explanation, /collects \$2\.00 today/);
  assert.match(workflow.explanation, /Previous test balances are not charged/);
});

test('the next anniversary after commencement uses normal live charges', () => {
  const nextPeriod = projectLiveCharges({
    mode: 'live',
    sandboxHistory: true,
    commenced: true,
    sameExcludedPeriod: false,
    fullOwedNowCents: 400,
    fullScheduledCents: 0,
    historicalOwedNowCents: 200,
    historicalScheduledCents: 200,
    renewalCents: 400,
  });
  assert.equal(nextPeriod.owedNowCents, 400);
  assert.equal(nextPeriod.historicalCents, 0);
});

test('a preserved test customer is not restored when the active identity is live', () => {
  const previous = process.env.STRIPE_MODE;
  process.env.STRIPE_MODE = 'test';
  try {
    const visible = billingAccountForMode({
      stripe_customer_id: 'cus_live',
      stripe_subscription_id: 'sub_live',
      stripe_subscription_item_id: 'si_live',
      subscription_status: 'active',
      cancel_at_period_end: false,
      current_period_end: '2026-11-24T16:00:00.000Z',
      card_brand: 'visa',
      card_last4: '4242',
      synced_amount_cents: 400,
      subscription_event_created: 20,
      livemode: true,
      billing_cycle_anchor: ANCHOR,
      preserved_test_stripe_customer_id: 'cus_test',
      preserved_test_stripe_subscription_id: 'sub_test',
    });
    assert.equal(visible?.stripe_customer_id, null);
    assert.equal(visible?.stripe_subscription_id, null);
    assert.equal(visible?.preserved_test_stripe_customer_id, 'cus_test');
    assert.equal(visible?.billing_cycle_anchor, ANCHOR);
    assert.notEqual(visible?.stripe_customer_id, visible?.preserved_test_stripe_customer_id);
  } finally {
    if (previous == null) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = previous;
  }
});
