import assert from 'node:assert/strict';
import test from 'node:test';
import { planBillingReturnUrl } from './auth-app-origin';
import { billingAccountForMode } from './billing-environment';
import {
  STRIPE_WEBHOOK_EVENTS,
  expectedStripeAccountId,
  stripeChargeCreationEnabled,
  stripeIdForMode,
  stripeIdempotencyKey,
  stripeMode,
  stripeSecretKey,
  webhookDisposition,
  webhookEventsMatch,
} from './stripe-mode';

function setEnv(name: string, value: string | undefined) {
  if (value == null) delete process.env[name];
  else process.env[name] = value;
}

test('Stripe mode defaults to the sandbox account', () => {
  const previous = process.env.STRIPE_MODE;
  setEnv('STRIPE_MODE', undefined);
  try {
    assert.equal(stripeMode(), 'test');
    assert.equal(expectedStripeAccountId(), 'acct_1UTlXZHzRlnuMAFU');
    assert.equal(STRIPE_WEBHOOK_EVENTS.length, 21);
    assert.equal(webhookEventsMatch([...STRIPE_WEBHOOK_EVENTS]), true);
  } finally {
    setEnv('STRIPE_MODE', previous);
  }
});

test('a live secret is refused while mode is test, and a test secret is refused in live mode', () => {
  const previousMode = process.env.STRIPE_MODE;
  const previousKey = process.env.STRIPE_SECRET_KEY;
  try {
    setEnv('STRIPE_MODE', 'test');
    setEnv('STRIPE_SECRET_KEY', 'sk_live_example');
    assert.throws(() => stripeSecretKey(), /sandbox test secret key/);
    setEnv('STRIPE_MODE', 'live');
    setEnv('STRIPE_SECRET_KEY', 'sk_test_example');
    assert.throws(() => stripeSecretKey(), /live secret key/);
    assert.equal(expectedStripeAccountId(), 'acct_1UTwmQHxTNfzNZ6f');
  } finally {
    setEnv('STRIPE_MODE', previousMode);
    setEnv('STRIPE_SECRET_KEY', previousKey);
  }
});

test('sandbox Stripe ids are not usable for live billing, and the billing anchor stays', () => {
  const previous = process.env.STRIPE_MODE;
  setEnv('STRIPE_MODE', 'live');
  try {
    assert.equal(stripeIdForMode('cus_test', false), null);
    assert.equal(stripeIdForMode('cus_live', true), 'cus_live');
    assert.equal(stripeIdempotencyKey('customer:user'), 'live:customer:user');
    const visible = billingAccountForMode({
      stripe_customer_id: 'cus_test',
      stripe_subscription_id: 'sub_test',
      stripe_subscription_item_id: 'si_test',
      subscription_status: 'active',
      cancel_at_period_end: true,
      current_period_end: '2026-11-24T00:00:00.000Z',
      card_brand: 'visa',
      card_last4: '4242',
      synced_amount_cents: 200,
      subscription_event_created: 10,
      livemode: false,
      billing_cycle_anchor: '2026-10-24T00:00:00.000Z',
    });
    assert.equal(visible?.stripe_customer_id, null);
    assert.equal(visible?.card_last4, null);
    assert.equal(visible?.billing_cycle_anchor, '2026-10-24T00:00:00.000Z');
    assert.equal(webhookDisposition({ verifiedWithIgnoredSecret: false, eventLivemode: false }), 'ignore');
    assert.equal(webhookDisposition({ verifiedWithIgnoredSecret: true, eventLivemode: true }), 'ignore');
    assert.equal(webhookDisposition({ verifiedWithIgnoredSecret: false, eventLivemode: true, eventAccount: 'acct_other' }), 'ignore');
    assert.equal(webhookDisposition({ verifiedWithIgnoredSecret: false, eventLivemode: true, eventAccount: 'acct_1UTwmQHxTNfzNZ6f' }), 'process');
  } finally {
    setEnv('STRIPE_MODE', previous);
  }
});

test('new charges can be disabled without leaving live mode', () => {
  const previousMode = process.env.STRIPE_MODE;
  const previousCharges = process.env.STRIPE_CHARGE_CREATION;
  try {
    process.env.STRIPE_MODE = 'live';
    delete process.env.STRIPE_CHARGE_CREATION;
    assert.equal(stripeChargeCreationEnabled(), true);
    process.env.STRIPE_CHARGE_CREATION = 'disabled';
    assert.equal(stripeChargeCreationEnabled(), false);
    assert.equal(stripeMode(), 'live');
    assert.equal(stripeIdempotencyKey('customer:household'), 'live:customer:household');
    process.env.STRIPE_MODE = 'test';
    assert.equal(stripeIdempotencyKey('customer:household'), 'customer:household');
  } finally {
    if (previousMode == null) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = previousMode;
    if (previousCharges == null) delete process.env.STRIPE_CHARGE_CREATION;
    else process.env.STRIPE_CHARGE_CREATION = previousCharges;
  }
});

test('the customer portal returns to Plan and Billing on the production host', () => {
  const previous = process.env.NODE_ENV;
  (process.env as { NODE_ENV?: string }).NODE_ENV = 'production';
  try {
    assert.equal(planBillingReturnUrl(), 'https://www.householdtoolbox.com/dashboard/plan');
  } finally {
    (process.env as { NODE_ENV?: string }).NODE_ENV = previous;
  }
});
