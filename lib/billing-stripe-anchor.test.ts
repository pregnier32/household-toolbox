import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import Stripe from 'stripe';
import { replaceSubscriptionPrice } from './billing-subscription';

function loadLocalEnv(): void {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadLocalEnv();

const key = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
const sandbox = key.startsWith('sk_test_');

function periodEnd(subscription: Stripe.Subscription): number | null {
  return subscription.items.data[0]?.current_period_end ?? null;
}

async function waitReady(stripe: Stripe, clockId: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (clock.status === 'ready') return;
    if (clock.status === 'internal_failure') throw new Error('Test clock failed while advancing.');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Test clock did not become ready.');
}

test('a $0 to paid price change keeps the anniversary only when the anchor is sent as unchanged', { skip: sandbox ? false : 'Stripe sandbox key is not configured', timeout: 180_000 }, async () => {
  const stripe = new Stripe(key);
  const started = Math.floor(Date.now() / 1000) - 15 * 24 * 60 * 60;
  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: started });
  const product = await stripe.products.create({ name: 'Household Toolbox anchor test' });
  const zero = await stripe.prices.create({ product: product.id, unit_amount: 0, currency: 'usd', recurring: { interval: 'month' } });
  const paid = await stripe.prices.create({ product: product.id, unit_amount: 200, currency: 'usd', recurring: { interval: 'month' } });
  const customer = await stripe.customers.create({ test_clock: clock.id });
  const paymentMethod = await stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } });
  await stripe.paymentMethods.attach(paymentMethod.id, { customer: customer.id });
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: paymentMethod.id } });
  const resetCustomer = await stripe.customers.create({ test_clock: clock.id });
  const resetPaymentMethod = await stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } });
  await stripe.paymentMethods.attach(resetPaymentMethod.id, { customer: resetCustomer.id });
  await stripe.customers.update(resetCustomer.id, { invoice_settings: { default_payment_method: resetPaymentMethod.id } });
  try {
    const kept = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: zero.id }],
      proration_behavior: 'none',
      billing_mode: { type: 'classic' },
    });
    const flexible = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: zero.id }],
      proration_behavior: 'none',
      billing_mode: { type: 'flexible' },
    });
    const reset = await stripe.subscriptions.create({
      customer: resetCustomer.id,
      items: [{ price: zero.id }],
      proration_behavior: 'none',
      billing_mode: { type: 'classic' },
    });
    await stripe.testHelpers.testClocks.advance(clock.id, { frozen_time: started + 10 * 24 * 60 * 60 });
    await waitReady(stripe, clock.id);
    const keptBefore = await stripe.subscriptions.retrieve(kept.id);
    const anchorBefore = keptBefore.billing_cycle_anchor;
    const endBefore = periodEnd(keptBefore);
    await assert.rejects(
      () => stripe.subscriptions.update(kept.id, {
        items: [{ id: keptBefore.items.data[0].id, price: paid.id }],
        proration_behavior: 'none',
        billing_cycle_anchor: 'unchanged' as unknown as Stripe.SubscriptionUpdateParams.BillingCycleAnchor,
      }),
      (error: unknown) => {
        const stripeError = error as { param?: string };
        return stripeError.param === 'billing_cycle_anchor';
      },
    );
    const keptItem = (await stripe.subscriptions.retrieve(kept.id)).items.data[0].id;
    const keptAfter = await replaceSubscriptionPrice(stripe, kept.id, keptItem, paid.id, anchorBefore);
    const flexibleBefore = await stripe.subscriptions.retrieve(flexible.id);
    const flexibleAfter = await replaceSubscriptionPrice(
      stripe,
      flexible.id,
      flexibleBefore.items.data[0].id,
      paid.id,
      flexibleBefore.billing_cycle_anchor,
    );
    const keptInvoices = await stripe.invoices.list({ customer: customer.id, limit: 10 });
    assert.equal(keptAfter.billing_cycle_anchor, anchorBefore);
    assert.equal(periodEnd(keptAfter), endBefore);
    assert.equal(keptAfter.items.data[0]?.price.unit_amount, 200);
    assert.equal(flexibleAfter.billing_cycle_anchor, flexibleBefore.billing_cycle_anchor);
    assert.equal(periodEnd(flexibleAfter), periodEnd(flexibleBefore));
    assert.equal(flexibleAfter.billing_mode?.type, 'flexible');
    assert.equal(keptInvoices.data.some((invoice) => invoice.billing_reason === 'subscription_update' && invoice.total > 0), false);
    assert.equal((await stripe.invoiceItems.list({ customer: customer.id, pending: true, limit: 10 })).data.length, 0);

    const resetBefore = await stripe.subscriptions.retrieve(reset.id);
    const resetAfter = await stripe.subscriptions.update(reset.id, {
      items: [{ id: resetBefore.items.data[0].id, price: paid.id }],
      proration_behavior: 'none',
    });
    const resetInvoices = await stripe.invoices.list({ customer: resetCustomer.id, limit: 10 });
    const charged = resetInvoices.data.find((invoice) => invoice.billing_reason === 'subscription_update');
    assert.notEqual(resetAfter.billing_cycle_anchor, resetBefore.billing_cycle_anchor);
    assert.equal(resetAfter.billing_cycle_anchor - resetBefore.billing_cycle_anchor, 10 * 24 * 60 * 60);
    assert.ok(charged);
    assert.equal(charged.total, 200);
    assert.equal(charged.status, 'paid');
  } finally {
    await stripe.customers.del(customer.id).catch(() => undefined);
    await stripe.customers.del(resetCustomer.id).catch(() => undefined);
    await stripe.testHelpers.testClocks.del(clock.id).catch(() => undefined);
    await stripe.products.update(product.id, { active: false }).catch(() => undefined);
  }
});

test('checkout charges only the current gap, and the subscription waits for the anniversary', { skip: sandbox ? false : 'Stripe sandbox key is not configured', timeout: 60_000 }, async () => {
  const stripe = new Stripe(key);
  const product = await stripe.products.create({ name: 'Household Toolbox checkout test' });
  const recurring = await stripe.prices.create({ product: product.id, unit_amount: 200, currency: 'usd', recurring: { interval: 'month' } });
  const once = await stripe.prices.create({ product: product.id, unit_amount: 200, currency: 'usd' });
  const customer = await stripe.customers.create({});
  const anchor = Math.floor(Date.now() / 1000) + 20 * 24 * 60 * 60;
  try {
    const renewal = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      line_items: [{ price: recurring.id, quantity: 1 }],
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      subscription_data: {
        billing_mode: { type: 'flexible' },
        billing_cycle_anchor: anchor,
        proration_behavior: 'none',
      },
    });
    const gap = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customer.id,
      line_items: [{ price: once.id, quantity: 1 }],
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      invoice_creation: { enabled: true },
      payment_intent_data: { setup_future_usage: 'off_session' },
    });
    const paymentMethod = await stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } });
    await stripe.paymentMethods.attach(paymentMethod.id, { customer: customer.id });
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: recurring.id }],
      default_payment_method: paymentMethod.id,
      billing_mode: { type: 'flexible' },
      billing_cycle_anchor: anchor,
      proration_behavior: 'none',
    });
    const invoices = await stripe.invoices.list({ customer: customer.id, limit: 10 });
    assert.equal(renewal.amount_total, 0);
    assert.equal(gap.amount_total, 200);
    assert.equal(subscription.billing_cycle_anchor, anchor);
    assert.equal(invoices.data.some((invoice) => invoice.total > 0), false);
  } finally {
    await stripe.customers.del(customer.id).catch(() => undefined);
    await stripe.products.update(product.id, { active: false }).catch(() => undefined);
  }
});
