import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCents } from './account-pricing';
import type { LedgerInvoice } from './billing-ledger';
import {
  describePaymentWorkflow,
  matchedPaymentRoute,
  parsePaymentExpectation,
  type PaymentAccount,
  type PaymentWorkflowInput,
} from './billing-payment-workflow';

const PERIOD = '2026-10-15T15:00:00.000Z';
const NEXT_AT = '2026-11-15T15:00:00.000Z';

function invoice(partial: Partial<LedgerInvoice> & Pick<LedgerInvoice, 'role' | 'status' | 'amountCents'> & { amountPaidCents?: number }) {
  return { periodStart: PERIOD, amountPaidCents: 0, ...partial };
}

function account(partial: Partial<PaymentAccount> = {}): PaymentAccount {
  return {
    subscriptionStatus: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    hasSavedPaymentMethod: false,
    ...partial,
  };
}

function quote(partial: Partial<PaymentWorkflowInput> = {}): PaymentWorkflowInput {
  return {
    owedNowCents: 0,
    nextAmountCents: 0,
    nextBillingAt: NEXT_AT,
    periodStart: PERIOD,
    invoices: [],
    account: null,
    paymentMethodLabel: null,
    ...partial,
  };
}

test('a $0 current balance and $0 next bill does not ask for a payment method', () => {
  const workflow = describePaymentWorkflow(quote());
  assert.equal(workflow.action, 'none');
  assert.equal(workflow.route, 'none');
  assert.equal(workflow.buttonLabel, null);
  assert.equal(workflow.collectedTodayCents, 0);
  assert.equal(workflow.explanation, 'No payment method needed on your current plan.');
  assert.equal(matchedPaymentRoute(workflow, {
    action: 'setup',
    collectedTodayCents: 0,
    nextAmountCents: 0,
    outstandingInvoiceCents: 0,
  }), null);
});

test('an active free trial with a future bill can save a card without collecting today', () => {
  const workflow = describePaymentWorkflow(quote({
    nextAmountCents: 400,
    trialPaymentDeferred: true,
  }));
  assert.equal(workflow.action, 'setup');
  assert.equal(workflow.route, 'checkout');
  assert.equal(workflow.buttonLabel, 'Add Payment Method');
  assert.equal(workflow.collectedTodayCents, 0);
  assert.match(workflow.explanation, /No payment is collected today/);
  assert.match(workflow.explanation, /\$4\.00/);
  assert.match(workflow.explanation, /free trial is still running/);
});

test('a $0 balance with a future bill can save a card without collecting today', () => {
  const nextAmountCents = 500;
  const workflow = describePaymentWorkflow(quote({ nextAmountCents }));
  assert.equal(workflow.action, 'setup');
  assert.equal(workflow.route, 'checkout');
  assert.equal(workflow.buttonLabel, 'Add Payment Method');
  assert.equal(workflow.collectedTodayCents, 0);
  assert.match(workflow.explanation, /No payment is collected today/);
  assert.match(workflow.explanation, new RegExp(formatCents(nextAmountCents).replace(/[$.]/g, '\\$&')));
  assert.match(workflow.explanation, /November 15, 2026/);
  assert.equal(matchedPaymentRoute(workflow, {
    action: 'setup',
    collectedTodayCents: 0,
    nextAmountCents,
    outstandingInvoiceCents: 0,
  }), 'checkout');
});

test('an existing subscription keeps billing management when nothing is due', () => {
  const workflow = describePaymentWorkflow(quote({
    account: account({
      subscriptionStatus: 'active',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      hasSavedPaymentMethod: true,
    }),
    paymentMethodLabel: 'Visa ending in 4242',
  }));
  assert.equal(workflow.action, 'manage');
  assert.equal(workflow.route, 'portal');
  assert.equal(workflow.buttonLabel, 'Manage billing');
  assert.equal(workflow.collectedTodayCents, 0);
  assert.equal(workflow.secondary, null);
  assert.match(workflow.explanation, /Visa ending in 4242/);
  assert.match(workflow.explanation, /No payment is due on the current plan/);
  assert.equal(matchedPaymentRoute(workflow, {
    action: 'manage',
    collectedTodayCents: 0,
    nextAmountCents: 0,
    outstandingInvoiceCents: 0,
  }), 'portal');
  assert.equal(matchedPaymentRoute(workflow, {
    action: 'setup',
    collectedTodayCents: 0,
    nextAmountCents: 0,
    outstandingInvoiceCents: 0,
  }), null);
});

test('an active subscription names a confirmed card and does not call it missing', () => {
  const saved = describePaymentWorkflow(quote({
    account: account({
      subscriptionStatus: 'active',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      hasSavedPaymentMethod: true,
    }),
    paymentMethodLabel: 'Visa ending in 4242',
    paymentMethodStatus: 'saved',
  }));
  assert.match(saved.explanation, /Payment method: Visa ending in 4242/);
  assert.match(saved.explanation, /Subscription status: active/);
  assert.doesNotMatch(saved.explanation, /Not configured yet/);

  const pending = describePaymentWorkflow(quote({
    account: account({
      subscriptionStatus: 'active',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
    }),
    paymentMethodStatus: 'pending',
  }));
  assert.match(pending.explanation, /Payment method sync is pending/);
  assert.doesNotMatch(pending.explanation, /Not configured yet/);

  const absent = describePaymentWorkflow(quote({
    account: account({
      subscriptionStatus: 'active',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
    }),
    paymentMethodStatus: 'absent',
  }));
  assert.match(absent.explanation, /No payment method is saved/);
  assert.notEqual(pending.explanation, absent.explanation);
});

test('a saved card can be managed when the current and next amounts are $0', () => {
  const workflow = describePaymentWorkflow(quote({
    account: account({
      stripeCustomerId: 'cus_123',
      hasSavedPaymentMethod: true,
    }),
    paymentMethodLabel: 'Visa ending in 4242',
  }));
  assert.equal(workflow.action, 'manage');
  assert.equal(workflow.route, 'portal');
  assert.equal(workflow.buttonLabel, 'Manage billing');
  assert.equal(workflow.collectedTodayCents, 0);
  assert.match(workflow.explanation, /No payment is due on the current plan/);
});

test('an open invoice is paid through billing management and is not charged again', () => {
  const workflow = describePaymentWorkflow(quote({
    owedNowCents: 400,
    account: account({ stripeCustomerId: 'cus_123' }),
    invoices: [invoice({ role: 'renewal', status: 'open', amountCents: 400 })],
  }));
  assert.equal(workflow.uninvoicedCents, 0);
  assert.equal(workflow.outstandingInvoiceCents, 400);
  assert.equal(workflow.route, 'portal');
  assert.equal(workflow.action, 'pay');
  assert.equal(workflow.collectedTodayCents, 400);
  assert.equal(workflow.buttonLabel, `Pay ${formatCents(400)}`);
  assert.match(workflow.explanation, /does not create another charge/);
  assert.equal(workflow.secondary, null);
});

test('a partly paid open invoice collects only the unpaid balance', () => {
  const workflow = describePaymentWorkflow(quote({
    owedNowCents: 400,
    account: account({ stripeCustomerId: 'cus_123', hasSavedPaymentMethod: true }),
    paymentMethodLabel: 'Visa ending in 4242',
    invoices: [invoice({ role: 'renewal', status: 'open', amountCents: 400, amountPaidCents: 100 })],
  }));
  assert.equal(workflow.uninvoicedCents, 0);
  assert.equal(workflow.outstandingInvoiceCents, 300);
  assert.equal(workflow.collectedTodayCents, 300);
  assert.equal(workflow.route, 'portal');
  assert.equal(workflow.buttonLabel, 'Manage billing');
});

test('an uninvoiced balance is collected today and an open invoice stays separate', () => {
  const workflow = describePaymentWorkflow(quote({
    owedNowCents: 600,
    nextAmountCents: 400,
    account: account({ stripeCustomerId: 'cus_123' }),
    invoices: [invoice({ role: 'supplemental', status: 'open', amountCents: 200 })],
  }));
  assert.equal(workflow.uninvoicedCents, 400);
  assert.equal(workflow.outstandingInvoiceCents, 200);
  assert.equal(workflow.action, 'pay');
  assert.equal(workflow.route, 'checkout');
  assert.equal(workflow.collectedTodayCents, 400);
  assert.equal(workflow.buttonLabel, `Pay ${formatCents(400)}`);
  assert.match(workflow.explanation, /collects \$4\.00 today/);
  assert.match(workflow.explanation, /not included and will not be charged again/);
  assert.equal(workflow.secondary?.route, 'portal');
  assert.equal(workflow.secondary?.collectedTodayCents, 200);
  assert.equal(workflow.secondary?.buttonLabel, `Pay ${formatCents(200)} invoice`);
  assert.equal(matchedPaymentRoute(workflow, {
    action: 'pay',
    collectedTodayCents: 400,
    nextAmountCents: 400,
    outstandingInvoiceCents: 200,
  }), 'checkout');
  assert.equal(matchedPaymentRoute(workflow, {
    action: 'pay',
    collectedTodayCents: 200,
    nextAmountCents: 400,
    outstandingInvoiceCents: 200,
  }), 'portal');
});

test('an existing subscription with an open invoice does not start another subscription', () => {
  const workflow = describePaymentWorkflow(quote({
    owedNowCents: 400,
    nextAmountCents: 400,
    account: account({
      subscriptionStatus: 'past_due',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      hasSavedPaymentMethod: true,
    }),
    paymentMethodLabel: 'Visa ending in 4242',
    invoices: [invoice({ role: 'renewal', status: 'open', amountCents: 400 })],
  }));
  assert.equal(workflow.action, 'manage');
  assert.equal(workflow.route, 'portal');
  assert.equal(workflow.buttonLabel, 'Manage billing');
  assert.equal(workflow.collectedTodayCents, 400);
  assert.equal(workflow.secondary, null);
  assert.match(workflow.explanation, /does not start another subscription/);
  assert.equal(matchedPaymentRoute(workflow, {
    action: 'setup',
    collectedTodayCents: 0,
    nextAmountCents: 400,
    outstandingInvoiceCents: 400,
  }), null);
});

test('a void or uncollectible invoice is not offered as a new charge', () => {
  const workflow = describePaymentWorkflow(quote({
    owedNowCents: 400,
    invoices: [
      invoice({ role: 'renewal', status: 'void', amountCents: 400 }),
      invoice({ role: 'replacement', status: 'uncollectible', amountCents: 400 }),
    ],
  }));
  assert.equal(workflow.uninvoicedCents, 0);
  assert.equal(workflow.outstandingInvoiceCents, 0);
  assert.equal(workflow.route, 'none');
  assert.equal(workflow.buttonLabel, null);
  assert.equal(workflow.explanation, 'No payment is due right now.');
});

test('a changed next amount does not match the quote shown on the page', () => {
  const workflow = describePaymentWorkflow(quote({ nextAmountCents: 500 }));
  assert.equal(matchedPaymentRoute(workflow, {
    action: 'setup',
    collectedTodayCents: 0,
    nextAmountCents: 0,
    outstandingInvoiceCents: 0,
  }), null);
});

test('a payment request must name an action and whole-cent amounts', () => {
  assert.deepEqual(parsePaymentExpectation({
    action: 'setup',
    collectedTodayCents: 0,
    nextAmountCents: 500,
    outstandingInvoiceCents: 0,
  }), {
    action: 'setup',
    collectedTodayCents: 0,
    nextAmountCents: 500,
    outstandingInvoiceCents: 0,
  });
  assert.equal(parsePaymentExpectation({ action: 'setup', collectedTodayCents: 1.5, nextAmountCents: 0, outstandingInvoiceCents: 0 }), null);
  assert.equal(parsePaymentExpectation({ action: 'none', collectedTodayCents: 0, nextAmountCents: 0, outstandingInvoiceCents: 0 }), null);
  assert.equal(parsePaymentExpectation(null), null);
});

test('a mixed trial and paid tool collects the paid tool now and keeps the trial charge off the renewal', () => {
  const workflow = describePaymentWorkflow(quote({
    owedNowCents: 200,
    nextAmountCents: 400,
    nextBillingAt: '2026-11-24T16:00:00.000Z',
    periodStart: '2026-10-24T16:00:00.000Z',
    scheduledChargeCents: 200,
    scheduledChargeAt: '2026-10-31T16:00:00.000Z',
  }));
  assert.equal(workflow.action, 'pay');
  assert.equal(workflow.collectedTodayCents, 200);
  assert.equal(workflow.buttonLabel, 'Pay $2.00');
  assert.match(workflow.explanation, /collects \$2\.00 today/);
  assert.match(workflow.explanation, /trial ends October 31, 2026 and adds \$2\.00/);
  assert.match(workflow.explanation, /not the monthly renewal/);
  assert.match(workflow.explanation, /monthly renewal on November 24, 2026 is \$4\.00/);
  assert.doesNotMatch(workflow.explanation, /No payment is collected today/);
});
