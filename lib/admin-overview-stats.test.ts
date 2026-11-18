import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calendarDateInZone,
  monthSeriesFrom,
  paymentsFromLedger,
  resolveAsOf,
  liveSubscriptionCharges,
  revenueByDayOfMonth,
  revenueSummary,
} from './admin-overview-stats';

test('the stats date starts at Chicago midnight on October 1, 2026', () => {
  const resolved = resolveAsOf(null, new Date('2026-11-17T18:00:00.000Z'));
  assert.equal(resolved.date, '2026-10-01');
  assert.equal(resolved.start, '2026-10-01T05:00:00.000Z');
  assert.deepEqual(resolved.series.map((item) => item.month), ['Oct 2026', 'Nov 2026']);
  assert.equal(resolveAsOf('not-a-date').date, '2026-10-01');
});

test('Chicago calendar dates stay on the local day across the UTC boundary', () => {
  assert.equal(calendarDateInZone(new Date('2026-10-02T04:30:00.000Z')), '2026-10-01');
  assert.equal(calendarDateInZone(new Date('2026-10-02T05:00:00.000Z')), '2026-10-02');
});

test('revenue keeps paid invoices on the start date and later, and ignores the other Stripe mode', () => {
  const payments = paymentsFromLedger({
    livemode: true,
    excludeUserIds: ['superadmin'],
    invoices: [
      {
        stripeInvoiceId: 'in_live',
        userId: 'customer',
        status: 'paid',
        amountPaidCents: 1200,
        createdAt: '2026-09-02T15:00:00.000Z',
        livemode: true,
      },
      {
        stripeInvoiceId: 'in_october',
        userId: 'customer',
        status: 'paid',
        amountPaidCents: 900,
        createdAt: '2026-10-01T12:00:00.000Z',
        livemode: true,
      },
      {
        stripeInvoiceId: 'in_late',
        userId: 'customer',
        status: 'paid',
        amountPaidCents: 500,
        createdAt: '2026-10-02T12:00:00.000Z',
        livemode: true,
      },
      {
        stripeInvoiceId: 'in_test',
        userId: 'customer',
        status: 'paid',
        amountPaidCents: 4000,
        createdAt: '2026-10-01T12:00:00.000Z',
        livemode: false,
      },
      {
        stripeInvoiceId: 'in_void',
        userId: 'customer',
        status: 'void',
        amountPaidCents: 700,
        createdAt: '2026-10-01T12:00:00.000Z',
        livemode: true,
      },
      {
        stripeInvoiceId: 'in_staff',
        userId: 'superadmin',
        status: 'paid',
        amountPaidCents: 800,
        createdAt: '2026-10-01T12:00:00.000Z',
        livemode: true,
      },
    ],
    events: [
      {
        type: 'invoice.paid',
        createdAt: '2026-11-01T00:00:00.000Z',
        payload: {
          created: 1790000000,
          data: {
            object: {
              id: 'in_october',
              status_transitions: { paid_at: Date.parse('2026-10-02T04:30:00.000Z') / 1000 },
            },
          },
        },
      },
    ],
  });

  const summary = revenueSummary(payments, '2026-10-01');
  assert.equal(summary.lifetimeRevenue, 14);
  assert.equal(summary.monthlyRevenue, 14);
});

test('a start date keeps that day and later payments, including later months', () => {
  const summary = revenueSummary(
    [
      { paidAt: '2026-09-15T17:00:00.000Z', amountCents: 100 },
      { paidAt: '2026-10-15T17:00:00.000Z', amountCents: 200 },
      { paidAt: '2026-11-01T17:00:00.000Z', amountCents: 400 },
    ],
    '2026-10-01',
  );
  assert.equal(summary.monthlyRevenue, 2);
  assert.equal(summary.lifetimeRevenue, 6);
});

test('live subscriptions land on their Chicago billing day and add together', () => {
  const rows = revenueByDayOfMonth(liveSubscriptionCharges([
    {
      userId: 'payer',
      status: 'active',
      cancelAtPeriodEnd: false,
      livemode: true,
      billingCycleAnchor: '2026-11-25T03:36:00.000Z',
      currentPeriodEnd: '2026-11-25T03:36:00.000Z',
      syncedAmountCents: 400,
    },
    {
      userId: 'same-day',
      status: 'past_due',
      cancelAtPeriodEnd: false,
      livemode: true,
      billingCycleAnchor: null,
      currentPeriodEnd: '2026-12-24T18:00:00.000Z',
      syncedAmountCents: 200,
    },
    {
      userId: 'sandbox',
      status: 'active',
      cancelAtPeriodEnd: false,
      livemode: false,
      billingCycleAnchor: '2026-11-01T16:00:00.000Z',
      currentPeriodEnd: '2026-11-01T16:00:00.000Z',
      syncedAmountCents: 100,
    },
    {
      userId: 'canceling',
      status: 'active',
      cancelAtPeriodEnd: true,
      livemode: true,
      billingCycleAnchor: '2026-11-24T16:00:00.000Z',
      currentPeriodEnd: '2026-11-24T16:00:00.000Z',
      syncedAmountCents: 900,
    },
    {
      userId: 'ended',
      status: 'canceled',
      cancelAtPeriodEnd: false,
      livemode: true,
      billingCycleAnchor: '2026-11-10T16:00:00.000Z',
      currentPeriodEnd: '2026-11-10T16:00:00.000Z',
      syncedAmountCents: 500,
    },
    {
      userId: 'staff',
      status: 'active',
      cancelAtPeriodEnd: false,
      livemode: true,
      billingCycleAnchor: '2026-11-24T16:00:00.000Z',
      currentPeriodEnd: '2026-11-24T16:00:00.000Z',
      syncedAmountCents: 700,
    },
  ], ['staff']));
  assert.equal(rows.length, 31);
  assert.equal(rows[0]?.revenue, 0);
  assert.equal(rows[23]?.day, '24');
  assert.equal(rows[23]?.revenue, 6);
});

test('revenue by day totals bills on each day of the month', () => {
  const rows = revenueByDayOfMonth([
    { at: '2026-11-24T16:00:00.000Z', amountCents: 400 },
    { at: '2026-12-24T16:00:00.000Z', amountCents: 200 },
    { at: '2026-11-01T15:00:00.000Z', amountCents: 100 },
  ]);
  assert.equal(rows.length, 31);
  assert.equal(rows[0]?.day, '1');
  assert.equal(rows[30]?.day, '31');
  assert.equal(rows[0]?.revenue, 1);
  assert.equal(rows[23]?.revenue, 6);
  assert.equal(rows[1]?.revenue, 0);
});

test('the user chart starts at the selected month and runs through the current month', () => {
  assert.deepEqual(
    monthSeriesFrom('2026-10-01', new Date('2026-11-17T18:00:00.000Z')).map((item) => item.monthKey),
    ['2026-10', '2026-11'],
  );
  assert.deepEqual(
    monthSeriesFrom('2025-01-01', new Date('2026-11-17T18:00:00.000Z')).map((item) => item.monthKey),
    ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'],
  );
});
