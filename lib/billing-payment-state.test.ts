import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyStripePayment, describeCheckoutAttempt } from './billing-payment-state';

const NOW = new Date('2026-10-24T15:00:00.000Z');

test('a bank payment that is still processing is not failed after days', () => {
  const state = classifyStripePayment({
    invoiceStatus: 'open',
    amountRemainingCents: 400,
    dueAt: '2026-10-20T15:00:00.000Z',
    paymentIntentStatus: 'processing',
    now: NOW,
  });
  assert.equal(state, 'processing');
});

test('authentication required, failed, and overdue stay distinct', () => {
  assert.equal(classifyStripePayment({
    invoiceStatus: 'open',
    amountRemainingCents: 400,
    dueAt: null,
    paymentIntentStatus: 'requires_action',
    now: NOW,
  }), 'authentication_required');
  assert.equal(classifyStripePayment({
    invoiceStatus: 'open',
    amountRemainingCents: 400,
    dueAt: null,
    paymentIntentStatus: 'requires_payment_method',
    now: NOW,
  }), 'failed');
  assert.equal(classifyStripePayment({
    invoiceStatus: 'open',
    amountRemainingCents: 400,
    dueAt: '2026-10-20T15:00:00.000Z',
    paymentIntentStatus: null,
    now: NOW,
  }), 'overdue');
  assert.equal(classifyStripePayment({
    invoiceStatus: 'open',
    amountRemainingCents: 400,
    dueAt: '2026-10-31T15:00:00.000Z',
    paymentIntentStatus: null,
    now: NOW,
  }), null);
  assert.equal(classifyStripePayment({
    invoiceStatus: 'open',
    amountRemainingCents: 400,
    dueAt: null,
    paymentIntentStatus: null,
    now: NOW,
  }), null);
  assert.equal(classifyStripePayment({
    invoiceStatus: 'paid',
    amountRemainingCents: 0,
    dueAt: '2026-10-20T15:00:00.000Z',
    paymentIntentStatus: 'succeeded',
    now: NOW,
  }), null);
});

test('Checkout status is not inferred as processing', () => {
  assert.equal(describeCheckoutAttempt({
    paymentStatus: 'unpaid',
    intentStatus: 'requires_payment_method',
    paymentError: false,
  }), 'incomplete');
  assert.equal(describeCheckoutAttempt({
    paymentStatus: 'unpaid',
    intentStatus: 'requires_payment_method',
    paymentError: true,
  }), 'failed');
  assert.equal(describeCheckoutAttempt({
    paymentStatus: 'unpaid',
    intentStatus: 'canceled',
    paymentError: false,
  }), 'failed');
  assert.equal(describeCheckoutAttempt({
    paymentStatus: 'unpaid',
    intentStatus: 'requires_action',
    paymentError: false,
  }), 'authentication_required');
  assert.equal(describeCheckoutAttempt({
    paymentStatus: 'unpaid',
    intentStatus: 'processing',
    paymentError: false,
  }), 'processing');
  assert.equal(describeCheckoutAttempt({
    paymentStatus: 'paid',
    intentStatus: 'succeeded',
    paymentError: false,
  }), 'succeeded');
  assert.equal(describeCheckoutAttempt({
    paymentStatus: 'unpaid',
    intentStatus: null,
    paymentError: false,
  }), 'incomplete');
});
