import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describePaymentMethod,
  resolveEffectiveCard,
} from './billing-card';

const visa = { id: 'pm_visa', card: { brand: 'visa', last4: '4242' } };
const mastercard = { id: 'pm_mc', card: { brand: 'mastercard', last4: '4444' } };

test('a subscription default card is shown when the customer invoice default is empty', () => {
  const card = resolveEffectiveCard({
    subscriptionDefault: visa,
    customerDefault: null,
  });
  assert.deepEqual(card, { brand: 'visa', last4: '4242' });
  assert.equal(describePaymentMethod('saved', card), 'Visa ending in 4242');
  assert.doesNotMatch(describePaymentMethod('saved', card), /Not configured yet/);
});

test('the customer invoice default is used when the subscription has no default card', () => {
  const card = resolveEffectiveCard({
    subscriptionDefault: null,
    customerDefault: mastercard,
  });
  assert.equal(describePaymentMethod('saved', card), 'Mastercard ending in 4444');
});

test('the subscription default wins when both defaults are cards', () => {
  const card = resolveEffectiveCard({
    subscriptionDefault: visa,
    customerDefault: mastercard,
  });
  assert.equal(card?.last4, '4242');
});

test('an unexpanded payment method id is not treated as a saved card', () => {
  assert.equal(resolveEffectiveCard({
    subscriptionDefault: 'pm_visa',
    customerDefault: 'pm_customer',
  }), null);
  assert.equal(describePaymentMethod('absent', null), 'No payment method is saved.');
  assert.equal(describePaymentMethod('pending', null), 'Payment method sync is pending.');
  assert.notEqual(describePaymentMethod('pending', null), describePaymentMethod('absent', null));
});
