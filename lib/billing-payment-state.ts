/**
 * Stripe payment state for an open tool invoice.
 *
 * A bank debit can stay in `processing` for days. That is not a failure and it
 * does not expire on a timer. The state changes only when Stripe reports a new
 * one, through a webhook or a reconciliation read.
 *
 * Recovery:
 * - processing: wait. Tool access stays available. Plan & Billing, the reconcile
 *   job, and the payment webhooks re-read Stripe. A cached read is refreshed
 *   about every five minutes; the refresh keeps processing when Stripe still
 *   says processing.
 * - authentication_required: the customer confirms the payment in the billing
 *   portal. Access stays paused until Stripe reports success or failure.
 * - failed: the customer updates the payment method or pays the open invoice.
 *   Removing the tools that require payment also restores the remaining tools.
 * - overdue: the invoice due date has passed and Stripe is not processing a
 *   payment. The same recovery as a failed payment applies.
 * If Stripe cannot be reached, the last stored state is kept. A missing state
 * stays pending rather than being marked failed.
 */

import type Stripe from 'stripe';

export const PAYMENT_STATE_CACHE_MS = 5 * 60 * 1000;

export type PaymentCollection = 'processing' | 'authentication_required' | 'failed' | 'overdue';

export function classifyStripePayment(input: {
  invoiceStatus: string | null;
  amountRemainingCents: number;
  dueAt: string | null;
  paymentIntentStatus: string | null;
  now: Date;
}): PaymentCollection | null {
  const status = input.invoiceStatus;
  if (status === 'draft' || status === 'void' || status === 'paid') return null;
  if (status === 'uncollectible') return input.amountRemainingCents > 0 ? 'failed' : null;
  if (input.amountRemainingCents <= 0) return null;
  const intent = input.paymentIntentStatus;
  if (intent === 'processing' || intent === 'requires_capture') return 'processing';
  if (intent === 'requires_action' || intent === 'requires_confirmation') return 'authentication_required';
  if (intent === 'requires_payment_method' || intent === 'canceled' || intent === 'cancelled') return 'failed';
  if (intent === 'succeeded') return null;
  if (input.dueAt) {
    const due = Date.parse(input.dueAt);
    if (!Number.isNaN(due) && due <= input.now.getTime()) return 'overdue';
  }
  if (status === 'open') return 'processing';
  return null;
}

type InvoicePaymentCarrier = {
  payments?: { data?: Array<{ payment?: { payment_intent?: string | { status?: string | null } | null } | null }> } | null;
};

export function paymentIntentStatusFromInvoice(invoice: InvoicePaymentCarrier): string | null {
  const payments = invoice.payments?.data ?? [];
  for (const payment of payments) {
    const intent = payment.payment?.payment_intent;
    if (intent && typeof intent !== 'string' && intent.status) return intent.status;
  }
  return null;
}

export async function saveInvoiceCollection(input: {
  stripeInvoiceId: string;
  collection: PaymentCollection | null;
  dueAt: string | null;
}): Promise<void> {
  const { supabaseServer } = await import('./supabaseServer');
  const { error } = await supabaseServer.from('billing_invoices').update({
    collection_state: input.collection,
    due_at: input.dueAt,
    collection_checked_at: new Date().toISOString(),
  }).eq('stripe_invoice_id', input.stripeInvoiceId);
  if (error && !/collection_state|due_at|schema cache/i.test(error.message || '')) throw error;
}

function amountRemaining(invoice: Stripe.Invoice): number {
  const remaining = (invoice as Stripe.Invoice & { amount_remaining?: number }).amount_remaining;
  if (typeof remaining === 'number') return Math.max(0, remaining);
  return Math.max(0, invoice.total - invoice.amount_paid);
}

export async function rememberInvoicePaymentState(userId: string, invoice: Stripe.Invoice, now = new Date()): Promise<void> {
  if (invoice.livemode) return;
  let detailed = invoice;
  if (invoice.status === 'open' && !paymentIntentStatusFromInvoice(invoice)) {
    const { stripeServer } = await import('./stripe-server');
    detailed = await stripeServer().invoices.retrieve(invoice.id, {
      expand: ['payments.data.payment.payment_intent'],
    });
  }
  const dueAt = detailed.due_date ? new Date(detailed.due_date * 1000).toISOString() : null;
  const { recordStripeInvoice } = await import('./billing-sync');
  await recordStripeInvoice(userId, detailed, detailed.metadata?.hhtb_period_start || null);
  await saveInvoiceCollection({
    stripeInvoiceId: detailed.id,
    dueAt,
    collection: classifyStripePayment({
      invoiceStatus: detailed.status,
      amountRemainingCents: amountRemaining(detailed),
      dueAt,
      paymentIntentStatus: paymentIntentStatusFromInvoice(detailed as InvoicePaymentCarrier),
      now,
    }),
  });
}

export async function reconcileCustomerPayments(userId: string, now = new Date()): Promise<void> {
  const { loadBillingAccount } = await import('./billing-store');
  const account = await loadBillingAccount(userId);
  if (!account?.stripe_customer_id) return;
  const { stripeServer } = await import('./stripe-server');
  const stripe = stripeServer();
  const listed = await stripe.invoices.list({
    customer: account.stripe_customer_id,
    limit: 20,
  });
  for (const summary of listed.data) {
    if (summary.livemode) continue;
    if (summary.status !== 'open' && summary.status !== 'uncollectible') continue;
    const invoice = await stripe.invoices.retrieve(summary.id, {
      expand: ['payments.data.payment.payment_intent'],
    });
    const { recordStripeInvoice } = await import('./billing-sync');
    await recordStripeInvoice(userId, invoice, invoice.metadata?.hhtb_period_start || null);
    const dueAt = invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null;
    const collection = classifyStripePayment({
      invoiceStatus: invoice.status,
      amountRemainingCents: amountRemaining(invoice),
      dueAt,
      paymentIntentStatus: paymentIntentStatusFromInvoice(invoice as InvoicePaymentCarrier),
      now,
    });
    await saveInvoiceCollection({ stripeInvoiceId: invoice.id, collection, dueAt });
  }
}

export function collectionNeedsRefresh(checkedAt: string | null, now: Date): boolean {
  if (!checkedAt) return true;
  const checked = Date.parse(checkedAt);
  if (Number.isNaN(checked)) return true;
  return now.getTime() - checked >= PAYMENT_STATE_CACHE_MS;
}
