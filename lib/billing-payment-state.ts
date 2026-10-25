/**
 * Stripe payment state for an open tool invoice.
 *
 * A bank debit can stay in `processing` for days. That is not a failure and it
 * does not expire on a timer. The state changes only when Stripe reports a new
 * one, through a webhook or a reconciliation read.
 *
 * Recovery:
 * - processing: wait, and only when Stripe's PaymentIntent status is processing
 *   or requires_capture for the payment that covers this debt. An open Checkout
 *   Session, a missing PaymentIntent, or an invoice with no payment state is
 *   not processing and does not unlock an unpaid household.
 * - authentication_required: the customer confirms the payment in the billing
 *   portal. Access stays paused until Stripe reports success or failure.
 * - failed: a decline, requires_payment_method after a payment error, or a
 *   canceled PaymentIntent. The customer can retry from Plan & Billing.
 *   Removing the tools that require payment also restores the remaining tools.
 * - overdue: the invoice due date has passed and Stripe is not processing a
 *   payment. The same recovery as a failed payment applies.
 * If Stripe cannot be reached, the last stored state is kept. A missing state
 * is not marked failed and is not treated as processing.
 */

import type Stripe from 'stripe';
import { foreignStripeObject } from '@/lib/stripe-mode';

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
  return null;
}

export type CheckoutAttemptState = 'incomplete' | 'processing' | 'failed' | 'authentication_required' | 'succeeded';

export type CheckoutAttempt = {
  state: CheckoutAttemptState;
  amountCents: number;
};

/**
 * An open Checkout Session is incomplete until Stripe reports a PaymentIntent
 * result. requires_payment_method is the session's starting status; it is a
 * decline only after Stripe records a payment error, or when the failure event
 * itself is the confirmation.
 */
export function describeCheckoutAttempt(input: {
  paymentStatus: string | null;
  intentStatus: string | null;
  paymentError: boolean;
}): CheckoutAttemptState {
  if (input.paymentStatus === 'paid' || input.intentStatus === 'succeeded') return 'succeeded';
  if (input.intentStatus === 'processing' || input.intentStatus === 'requires_capture') return 'processing';
  if (input.intentStatus === 'requires_action' || input.intentStatus === 'requires_confirmation') return 'authentication_required';
  if (input.intentStatus === 'canceled' || input.intentStatus === 'cancelled') return 'failed';
  if (input.paymentError && (input.intentStatus === 'requires_payment_method' || input.intentStatus == null)) return 'failed';
  return 'incomplete';
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
  if (foreignStripeObject(invoice.livemode)) return;
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
  const { stripeIdForMode } = await import('./stripe-mode');
  const account = await loadBillingAccount(userId);
  const customerId = stripeIdForMode(account?.stripe_customer_id, account?.livemode);
  if (!customerId) return;
  const { stripeServer } = await import('./stripe-server');
  const stripe = stripeServer();
  const listed = await stripe.invoices.list({
    customer: customerId,
    limit: 20,
  });
  for (const summary of listed.data) {
    if (foreignStripeObject(summary.livemode)) continue;
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

const ATTEMPT_RANK: Record<CheckoutAttemptState, number> = {
  failed: 4,
  authentication_required: 3,
  processing: 2,
  incomplete: 1,
  succeeded: 0,
};

export async function rememberCheckoutIntent(
  userId: string,
  intent: { id: string; status: string | null; livemode?: boolean | null; customer?: string | { id: string } | null },
  forced?: 'failed' | 'authentication_required',
): Promise<void> {
  if (foreignStripeObject(intent.livemode)) return;
  const state = forced ?? describeCheckoutAttempt({
    paymentStatus: null,
    intentStatus: intent.status,
    paymentError: false,
  });
  const { clearPaymentAttention, notePaymentAttention } = await import('./billing-store');
  if (state === 'failed') {
    await notePaymentAttention(userId, intent.id, 'failed');
    return;
  }
  if (state === 'authentication_required') {
    await notePaymentAttention(userId, intent.id, 'authentication_required');
    return;
  }
  if (state !== 'succeeded') return;
  await clearPaymentAttention(intent.id);
  const customer = typeof intent.customer === 'string' ? intent.customer : intent.customer?.id ?? null;
  if (!customer) return;
  const { reconcileCheckoutPayments } = await import('./billing-sync');
  await reconcileCheckoutPayments(userId, customer);
}

/**
 * Reads open Checkout Sessions from Stripe. A paid session is recorded once.
 * A decline or a canceled PaymentIntent is stored as a failure so a missing
 * webhook cannot leave the household looking like a payment in progress.
 * Returns the strongest non-success result. A failure outranks processing.
 */
export async function reconcileOpenCheckoutAttempts(userId: string): Promise<CheckoutAttempt | null> {
  const { clearPaymentAttention, listOpenCheckoutSessions, notePaymentAttention } = await import('./billing-store');
  const sessions = await listOpenCheckoutSessions(userId);
  if (sessions.length === 0) return null;
  const { stripeServer } = await import('./stripe-server');
  const stripe = stripeServer();
  let chosen: CheckoutAttempt | null = null;
  for (const row of sessions) {
    const session = await stripe.checkout.sessions.retrieve(row.stripeSessionId, { expand: ['payment_intent'] });
    if (foreignStripeObject(session.livemode)) continue;
    const intent = session.payment_intent && typeof session.payment_intent !== 'string' ? session.payment_intent : null;
    const state = describeCheckoutAttempt({
      paymentStatus: session.payment_status,
      intentStatus: intent?.status ?? null,
      paymentError: Boolean(intent?.last_payment_error),
    });
    const amountCents = intent?.amount ?? session.amount_total ?? 0;
    if (state === 'succeeded') {
      const { recordCheckoutSessionPayment } = await import('./billing-sync');
      await recordCheckoutSessionPayment(userId, session);
      if (intent) await clearPaymentAttention(intent.id);
      continue;
    }
    if (intent && state === 'failed') await notePaymentAttention(userId, intent.id, 'failed');
    if (intent && state === 'authentication_required') await notePaymentAttention(userId, intent.id, 'authentication_required');
    const attempt: CheckoutAttempt = { state, amountCents };
    if (!chosen || ATTEMPT_RANK[state] > ATTEMPT_RANK[chosen.state]) chosen = attempt;
  }
  return chosen;
}

export function collectionNeedsRefresh(checkedAt: string | null, now: Date): boolean {
  if (!checkedAt) return true;
  const checked = Date.parse(checkedAt);
  if (Number.isNaN(checked)) return true;
  return now.getTime() - checked >= PAYMENT_STATE_CACHE_MS;
}
