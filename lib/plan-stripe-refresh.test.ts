import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_STRIPE_FRESH_MS, planStripeRefreshDue } from './plan-stripe-refresh';

const now = Date.parse('2026-10-24T22:00:00.000Z');

test('a stored Stripe read stays fresh for five minutes', () => {
  assert.equal(planStripeRefreshDue({
    checkoutSuccess: false,
    hasSameModeCustomer: true,
    observedAt: new Date(now - PLAN_STRIPE_FRESH_MS + 1000).toISOString(),
    now,
  }), false);
});

test('a stored Stripe read is refreshed after five minutes', () => {
  assert.equal(planStripeRefreshDue({
    checkoutSuccess: false,
    hasSameModeCustomer: true,
    observedAt: new Date(now - PLAN_STRIPE_FRESH_MS).toISOString(),
    now,
  }), true);
});

test('returning from Checkout refreshes a household that already has a Stripe customer', () => {
  assert.equal(planStripeRefreshDue({
    checkoutSuccess: true,
    hasSameModeCustomer: true,
    observedAt: new Date(now).toISOString(),
    now,
  }), true);
});

test('a household without a Stripe customer does not refresh Stripe', () => {
  assert.equal(planStripeRefreshDue({
    checkoutSuccess: true,
    hasSameModeCustomer: false,
    observedAt: null,
    now,
  }), false);
  assert.equal(planStripeRefreshDue({
    checkoutSuccess: false,
    hasSameModeCustomer: false,
    observedAt: null,
    now,
  }), false);
});

test('a household without a recorded Stripe read refreshes Stripe', () => {
  assert.equal(planStripeRefreshDue({
    checkoutSuccess: false,
    hasSameModeCustomer: true,
    observedAt: null,
    now,
  }), true);
});
