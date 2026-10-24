import assert from 'node:assert/strict';
import test from 'node:test';
import {
  finalizedRenewalAction,
  invoicedCents,
  mergeInvoiceStatus,
  paidCents,
  renewalDraftMayBeCorrected,
  uninvoicedCents,
  type LedgerInvoice,
} from './billing-ledger';

const PERIOD = '2026-10-15T15:00:00.000Z';

function invoice(partial: Partial<LedgerInvoice> & Pick<LedgerInvoice, 'role' | 'status' | 'amountCents'>): LedgerInvoice {
  return { periodStart: PERIOD, ...partial };
}

test('open and uncollectible invoices count as invoiced, so the same debt is not charged again', () => {
  const invoices = [
    invoice({ role: 'renewal', status: 'open', amountCents: 200 }),
    invoice({ role: 'supplemental', status: 'uncollectible', amountCents: 200 }),
    invoice({ role: 'setup', status: 'paid', amountCents: 0, periodStart: null }),
  ];
  assert.equal(invoicedCents(invoices, PERIOD), 400);
  assert.equal(uninvoicedCents(400, invoices, PERIOD), 0);
  assert.equal(paidCents(invoices, PERIOD), 0);
});

test('a void invoice drops out of the total and its replacement counts once', () => {
  const invoices = [
    invoice({ role: 'renewal', status: 'void', amountCents: 600 }),
    invoice({ role: 'replacement', status: 'open', amountCents: 200 }),
  ];
  assert.equal(invoicedCents(invoices, PERIOD), 200);
  assert.equal(uninvoicedCents(200, invoices, PERIOD), 0);
});

test('a paid invoice is not reduced by a replayed draft status', () => {
  assert.equal(mergeInvoiceStatus('paid', 'draft'), 'paid');
  assert.equal(mergeInvoiceStatus('uncollectible', 'open'), 'uncollectible');
  assert.equal(mergeInvoiceStatus('open', 'void'), 'void');
  assert.equal(mergeInvoiceStatus('draft', 'open'), 'open');
});

test('only a draft anniversary invoice may have its lines corrected', () => {
  assert.equal(renewalDraftMayBeCorrected({
    livemode: false,
    status: 'draft',
    billingReason: 'subscription_cycle',
    role: null,
  }), true);
  assert.equal(renewalDraftMayBeCorrected({
    livemode: false,
    status: 'draft',
    billingReason: 'manual',
    role: 'supplemental',
  }), false);
  assert.equal(renewalDraftMayBeCorrected({
    livemode: false,
    status: 'open',
    billingReason: 'subscription_cycle',
    role: 'renewal',
  }), false);
  assert.equal(renewalDraftMayBeCorrected({
    livemode: true,
    status: 'draft',
    billingReason: 'subscription_cycle',
    role: null,
  }), false);
});

test('an uncollectible anniversary invoice is not voided or replaced', () => {
  assert.equal(finalizedRenewalAction({
    status: 'uncollectible',
    amountCents: 200,
    amountPaidCents: 0,
    owedAtPeriodStartCents: 200,
  }), 'record');
  assert.equal(finalizedRenewalAction({
    status: 'open',
    amountCents: 600,
    amountPaidCents: 0,
    owedAtPeriodStartCents: 200,
  }), 'void-and-replace');
  assert.equal(finalizedRenewalAction({
    status: 'paid',
    amountCents: 600,
    amountPaidCents: 600,
    owedAtPeriodStartCents: 200,
  }), 'review-overcharge');
  assert.equal(finalizedRenewalAction({
    status: 'paid',
    amountCents: 0,
    amountPaidCents: 0,
    owedAtPeriodStartCents: 200,
  }), 'record');
});
