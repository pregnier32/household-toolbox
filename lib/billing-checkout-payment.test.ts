import assert from 'node:assert/strict';
import test from 'node:test';
import { describeCheckoutSettlement, supersededCheckoutPaymentIds } from './billing-checkout-payment';
import { remainingDueCents, type LedgerInvoice } from './billing-ledger';

const PERIOD = '2026-10-24T16:00:00.000Z';

function checkout(partial: Partial<Parameters<typeof describeCheckoutSettlement>[0]> = {}) {
  return describeCheckoutSettlement({
    livemode: false,
    mode: 'payment',
    paymentStatus: 'paid',
    amountCents: 200,
    invoiceId: null,
    paymentIntentId: 'pi_test',
    periodStart: PERIOD,
    recordedIds: [],
    ...partial,
  });
}

test('a paid Checkout invoice is recorded once and is not also stored as its PaymentIntent', () => {
  const first = checkout({ invoiceId: 'in_test', paymentIntentId: 'pi_test' });
  assert.deepEqual(first, { action: 'record-invoice', invoiceId: 'in_test' });
  const replay = checkout({ invoiceId: 'in_test', paymentIntentId: 'pi_test', recordedIds: ['in_test'] });
  assert.deepEqual(replay, { action: 'record-invoice', invoiceId: 'in_test' });
  assert.deepEqual(supersededCheckoutPaymentIds('in_test', ['pi_test', 'pi_test']), ['pi_test']);
});

test('a paid Checkout without an invoice is recorded from the PaymentIntent and a replay does not add another row', () => {
  const first = checkout();
  assert.deepEqual(first, {
    action: 'record-payment',
    paymentIntentId: 'pi_test',
    amountCents: 200,
    periodStart: PERIOD,
  });
  const replay = checkout({ recordedIds: ['pi_test'] });
  assert.deepEqual(replay, { action: 'ignore' });
});

test('an unpaid or live Checkout payment is not recorded', () => {
  assert.deepEqual(checkout({ paymentStatus: 'unpaid' }), { action: 'ignore' });
  assert.deepEqual(checkout({ livemode: true }), { action: 'ignore' });
  assert.deepEqual(checkout({ amountCents: 0 }), { action: 'ignore' });
  assert.deepEqual(checkout({ mode: 'subscription', invoiceId: 'in_sub' }), { action: 'ignore' });
});

test('one paid Checkout leaves nothing due, and the later trial charge is still unpaid', () => {
  const paid: LedgerInvoice[] = [{
    periodStart: PERIOD,
    role: 'supplemental',
    status: 'paid',
    amountCents: 200,
  }];
  assert.equal(remainingDueCents(200, paid, PERIOD), 0);
  assert.equal(remainingDueCents(400, paid, PERIOD), 200);
  const doubled: LedgerInvoice[] = [...paid, { ...paid[0] }];
  assert.equal(remainingDueCents(200, doubled, PERIOD), 0);
});
