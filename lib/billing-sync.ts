import type Stripe from 'stripe';
import type { Json } from '@/src/types/supabase';
import { loadChargeSnapshot, type ChargeSnapshot } from '@/lib/billing-amount';
import { describeCheckoutSettlement, supersededCheckoutPaymentIds } from '@/lib/billing-checkout-payment';
import { supplementalInvoiceBlocked } from '@/lib/billing-cycle';
import { invoicedCents, uninvoicedCents, type InvoiceRole, type InvoiceStatus, type LedgerInvoice } from '@/lib/billing-ledger';
import {
  describePaymentWorkflow,
  matchedPaymentRoute,
  PAYMENT_STATE_CHANGED,
  type PaymentAccount,
  type PaymentExpectation,
  type PaymentWorkflow,
} from '@/lib/billing-payment-workflow';
import { deletionBlocksBilling } from '@/lib/billing-closure';
import { claimBillingLock, releaseBillingLock, withBillingLock } from '@/lib/billing-lock';
import { replaceSubscriptionPrice, subscriptionBillingPatch, subscriptionItemId, subscriptionPeriodEnd, supplementalBlockedByCancellation } from '@/lib/billing-subscription';
import {
  listOpenOperations,
  listStoredInvoices,
  loadBillingAccount,
  markOperationCompleted,
  markOperationFailed,
  markOperationStripeSucceeded,
  saveBillingAccount,
  startBillingOperation,
  upsertStoredInvoice,
  type BillingAccountRow,
  type BillingOperation,
} from '@/lib/billing-store';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  cardFromPaymentMethod,
  formatSavedCard,
  resolveEffectiveCard,
  type PaymentMethodSource,
  type PaymentMethodSyncState,
  type SavedCard,
} from '@/lib/billing-card';
import { stripeConfigured, stripeServer } from '@/lib/stripe-server';

const LIVE_SUBSCRIPTION = new Set(['active', 'past_due', 'unpaid', 'trialing', 'paused', 'incomplete']);

function asRecord(value: Json): Record<string, Json | undefined> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, Json | undefined>;
}

function invoiceStatus(status: string | null | undefined): InvoiceStatus {
  if (status === 'draft' || status === 'open' || status === 'paid' || status === 'void' || status === 'uncollectible') return status;
  return 'open';
}

function roleForStripeInvoice(invoice: Stripe.Invoice): InvoiceRole {
  const role = invoice.metadata?.hhtb_role;
  if (role === 'setup' || role === 'renewal' || role === 'supplemental' || role === 'replacement') return role;
  if (invoice.billing_reason === 'subscription_cycle') return 'renewal';
  if (invoice.billing_reason === 'subscription_create' && invoice.total === 0) return 'setup';
  return 'supplemental';
}

async function sandboxProduct(stripe: Stripe): Promise<string> {
  const listed = await stripe.products.list({ active: true, limit: 100 });
  const found = listed.data.find((product) => product.metadata?.hhtb_role === 'monthly');
  if (found) return found.id;
  const created = await stripe.products.create({
    name: 'Household Toolbox',
    metadata: { hhtb_role: 'monthly' },
  }, { idempotencyKey: 'product:hhtb_monthly' });
  return created.id;
}

async function monthlyPrice(stripe: Stripe, cents: number, recurring: boolean): Promise<string> {
  const lookupKey = recurring ? `hhtb_monthly_${cents}` : `hhtb_once_${cents}`;
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const price = await stripe.prices.create({
    product: await sandboxProduct(stripe),
    currency: 'usd',
    unit_amount: cents,
    recurring: recurring ? { interval: 'month' } : undefined,
    lookup_key: lookupKey,
    transfer_lookup_key: true,
  }, { idempotencyKey: `price:${lookupKey}` });
  return price.id;
}

async function customerEmail(userId: string): Promise<string> {
  const { data, error } = await supabaseServer.from('users').select('email').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!data?.email) throw new Error('Billing account email is missing.');
  return data.email;
}

async function ensureCustomer(stripe: Stripe, userId: string, account: BillingAccountRow | null): Promise<string> {
  if (account?.stripe_customer_id) return account.stripe_customer_id;
  const operation = await startBillingOperation({
    userId,
    idempotencyKey: `customer:${userId}`,
    kind: 'customer',
    payload: {},
  });
  if (operation.status === 'completed' && operation.stripe_id) return operation.stripe_id;
  const customer = operation.stripe_id
    ? await stripe.customers.retrieve(operation.stripe_id)
    : await stripe.customers.create({
      email: await customerEmail(userId),
      metadata: { hhtb_user_id: userId },
    }, { idempotencyKey: operation.idempotency_key });
  if (customer.deleted) throw new Error('Stripe customer was deleted.');
  await markOperationStripeSucceeded(operation.id, customer.id, { customerId: customer.id });
  await saveBillingAccount(userId, { stripe_customer_id: customer.id });
  await markOperationCompleted(operation.id);
  return customer.id;
}

export async function syncRecurringPrice(userId: string, account: BillingAccountRow, nextAmountCents: number): Promise<void> {
  if (await deletionBlocksBilling(userId)) return;
  if (!account.stripe_subscription_id || account.synced_amount_cents === nextAmountCents) return;
  if (account.subscription_status === 'canceled' || account.subscription_status === 'incomplete_expired') return;
  const stripe = stripeServer();
  const current = await stripe.subscriptions.retrieve(account.stripe_subscription_id);
  if (!LIVE_SUBSCRIPTION.has(current.status) || current.status === 'incomplete') return;
  const itemId = subscriptionItemId(current);
  if (!itemId) throw new Error('Stripe subscription has no item.');
  const anchor = current.billing_cycle_anchor;
  const priceId = await monthlyPrice(stripe, nextAmountCents, true);
  const key = `subprice:${current.id}:${nextAmountCents}:${anchor}`;
  const operation = await startBillingOperation({
    userId,
    idempotencyKey: key,
    kind: 'subscription_price',
    payload: { priceId, previousAnchor: anchor, nextAmountCents },
  });
  if (operation.status === 'completed') return;
  let stripeDone = operation.status === 'stripe_succeeded';
  try {
    if (!stripeDone) {
      const updated = await replaceSubscriptionPrice(stripe, current.id, itemId, priceId, anchor, key, current.cancel_at);
      const cancellation = subscriptionBillingPatch(updated);
      await markOperationStripeSucceeded(operation.id, updated.id, {
        priceId,
        previousAnchor: anchor,
        nextAmountCents,
        periodEnd: subscriptionPeriodEnd(updated),
        itemId: subscriptionItemId(updated),
        cancelAtPeriodEnd: cancellation.cancel_at_period_end,
        effectiveAt: cancellation.current_period_end,
      });
      stripeDone = true;
    }
    const succeeded = await reloadOperation(operation.id);
    const payload = asRecord(succeeded.payload);
    const periodEnd = typeof payload.periodEnd === 'number' ? payload.periodEnd : null;
    await saveBillingAccount(userId, {
      synced_amount_cents: nextAmountCents,
      stripe_subscription_item_id: typeof payload.itemId === 'string' ? payload.itemId : itemId,
      billing_cycle_anchor: new Date(anchor * 1000).toISOString(),
      current_period_end: typeof payload.effectiveAt === 'string'
        ? payload.effectiveAt
        : periodEnd ? new Date(periodEnd * 1000).toISOString() : account.current_period_end,
      ...(typeof payload.cancelAtPeriodEnd === 'boolean' ? { cancel_at_period_end: payload.cancelAtPeriodEnd } : {}),
    });
    await markOperationCompleted(operation.id);
  } catch (error) {
    if (!stripeDone) await markOperationFailed(operation.id, error instanceof Error ? error.message : 'Price sync failed.');
    throw error;
  }
}

async function reloadOperation(id: string): Promise<BillingOperation> {
  const { data, error } = await supabaseServer
    .from('billing_operations')
    .select('id, user_id, idempotency_key, kind, status, stripe_id, payload, created_at')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as BillingOperation;
}

export async function createSupplementalInvoice(input: {
  userId: string;
  customerId: string;
  periodStart: string;
  amountCents: number;
  invoicedCents: number;
  role?: 'supplemental' | 'replacement';
  replacesInvoiceId?: string | null;
}): Promise<void> {
  if (await deletionBlocksBilling(input.userId)) return;
  const role = input.role ?? 'supplemental';
  const key = input.replacesInvoiceId
    ? `replace:${input.replacesInvoiceId}:${input.amountCents}`
    : `supplemental:${input.userId}:${input.periodStart}:${input.invoicedCents}:${input.amountCents}`;
  const operation = await startBillingOperation({
    userId: input.userId,
    idempotencyKey: key,
    kind: role,
    payload: {
      amountCents: input.amountCents,
      periodStart: input.periodStart,
      role,
      replacesInvoiceId: input.replacesInvoiceId ?? null,
    },
  });
  if (operation.status === 'completed') return;
  const stripe = stripeServer();
  let stripeDone = operation.status === 'stripe_succeeded';
  try {
    if (!stripeDone) {
      const draft = await stripe.invoices.create({
        customer: input.customerId,
        auto_advance: false,
        collection_method: 'charge_automatically',
        pending_invoice_items_behavior: 'exclude',
        metadata: {
          hhtb_role: role,
          hhtb_user_id: input.userId,
          hhtb_period_start: input.periodStart,
          hhtb_operation_id: operation.id,
        },
      }, { idempotencyKey: key });
      await stripe.invoiceItems.create({
        customer: input.customerId,
        invoice: draft.id,
        amount: input.amountCents,
        currency: 'usd',
        description: role === 'replacement' ? 'Household Toolbox billing period' : 'Household Toolbox billing period adjustment',
        metadata: { hhtb_role: role, hhtb_operation_id: operation.id },
      }, { idempotencyKey: `${key}:item` });
      const finalized = await stripe.invoices.finalizeInvoice(draft.id, {}, { idempotencyKey: `${key}:finalize` });
      let settled = finalized;
      if (finalized.status === 'open' && finalized.amount_due > 0) {
        try {
          settled = await stripe.invoices.pay(finalized.id, {}, { idempotencyKey: `${key}:pay` });
        } catch {
          settled = await stripe.invoices.retrieve(finalized.id);
        }
      }
      await markOperationStripeSucceeded(operation.id, settled.id, {
        amountCents: input.amountCents,
        periodStart: input.periodStart,
        role,
        replacesInvoiceId: input.replacesInvoiceId ?? null,
        status: settled.status,
        amountPaidCents: settled.amount_paid,
      });
      stripeDone = true;
    }
    const succeeded = await reloadOperation(operation.id);
    const payload = asRecord(succeeded.payload);
    await upsertStoredInvoice({
      userId: input.userId,
      stripeInvoiceId: succeeded.stripe_id || '',
      periodStart: input.periodStart,
      role,
      status: invoiceStatus(typeof payload.status === 'string' ? payload.status as Stripe.Invoice.Status : 'open'),
      amountCents: input.amountCents,
      amountPaidCents: typeof payload.amountPaidCents === 'number' ? payload.amountPaidCents : 0,
      replacesStripeInvoiceId: input.replacesInvoiceId ?? null,
    });
    await markOperationCompleted(operation.id);
  } catch (error) {
    if (!stripeDone) await markOperationFailed(operation.id, error instanceof Error ? error.message : 'Invoice failed.');
    throw error;
  }
}

/**
 * A subscription_update invoice is not a renewal and is not a supplemental we
 * created. An unpaid one is voided so it cannot be collected later. A paid one
 * stays in the ledger, marked for review, so reconciliation does not charge
 * that amount again.
 */
export async function settleUnintendedSubscriptionUpdate(userId: string, invoice: Stripe.Invoice, periodStart: string | null): Promise<boolean> {
  if (invoice.billing_reason !== 'subscription_update' || invoice.total <= 0 || invoice.livemode) return false;
  const stripe = stripeServer();
  if (invoice.status === 'draft') {
    await stripe.invoices.del(invoice.id);
    await upsertStoredInvoice({
      userId,
      stripeInvoiceId: invoice.id,
      periodStart: invoice.metadata?.hhtb_period_start || periodStart,
      role: 'supplemental',
      status: 'void',
      amountCents: invoice.total,
      amountPaidCents: 0,
    });
    return true;
  }
  if (invoice.status === 'open' && invoice.amount_paid === 0) {
    const voided = await stripe.invoices.voidInvoice(invoice.id);
    await recordStripeInvoice(userId, voided, periodStart);
    return true;
  }
  if ((invoice.status === 'paid' || invoice.status === 'uncollectible') && invoice.amount_paid >= 0) {
    await recordStripeInvoice(userId, invoice, periodStart, invoice.status === 'paid' && invoice.amount_paid > 0 && invoice.total > 0);
    return true;
  }
  return false;
}

async function backfillCustomerInvoices(userId: string, customerId: string, periodStart: string | null): Promise<void> {
  const listed = await stripeServer().invoices.list({ customer: customerId, limit: 100 });
  for (const invoice of listed.data) {
    if (invoice.livemode) continue;
    const settled = await settleUnintendedSubscriptionUpdate(userId, invoice, periodStart);
    if (!settled) await recordStripeInvoice(userId, invoice, invoice.metadata?.hhtb_period_start || periodStart);
  }
}

function paymentIntentIdsOnInvoice(invoice: Stripe.Invoice): string[] {
  const ids: string[] = [];
  for (const item of invoice.payments?.data ?? []) {
    const paymentIntent = item.payment?.payment_intent;
    if (typeof paymentIntent === 'string') ids.push(paymentIntent);
    else if (paymentIntent && typeof paymentIntent === 'object' && 'id' in paymentIntent && typeof paymentIntent.id === 'string') ids.push(paymentIntent.id);
  }
  return ids;
}

export async function recordStripeInvoice(userId: string, invoice: Stripe.Invoice, periodStart: string | null, overcharge = false): Promise<void> {
  const detailed = invoice.status === 'paid' && !invoice.payments?.data?.length
    ? await stripeServer().invoices.retrieve(invoice.id, { expand: ['payments.data.payment.payment_intent'] })
    : invoice;
  if (detailed.livemode) return;
  const metadataPeriod = detailed.metadata?.hhtb_period_start;
  await upsertStoredInvoice({
    userId,
    stripeInvoiceId: detailed.id,
    periodStart: metadataPeriod || periodStart,
    role: roleForStripeInvoice(detailed),
    status: invoiceStatus(detailed.status),
    amountCents: detailed.total,
    amountPaidCents: detailed.amount_paid,
    overcharge,
  });
  const aliases = supersededCheckoutPaymentIds(detailed.id, paymentIntentIdsOnInvoice(detailed));
  if (aliases.length === 0) return;
  const removed = await supabaseServer.from('billing_invoices').delete().eq('user_id', userId).in('stripe_invoice_id', aliases);
  if (removed.error) throw removed.error;
}

export async function recordCheckoutSessionPayment(userId: string, session: Stripe.Checkout.Session): Promise<void> {
  if (session.livemode || session.mode !== 'payment') return;
  const stripe = stripeServer();
  const detailed = session.invoice || session.payment_status !== 'paid'
    ? session
    : await stripe.checkout.sessions.retrieve(session.id, { expand: ['invoice', 'payment_intent'] });
  const invoiceRef = detailed.invoice;
  const intentRef = detailed.payment_intent;
  const invoiceId = typeof invoiceRef === 'string' ? invoiceRef : invoiceRef?.id ?? null;
  const paymentIntentId = typeof intentRef === 'string' ? intentRef : intentRef?.id ?? null;
  const existing = await listStoredInvoices(userId);
  const decision = describeCheckoutSettlement({
    livemode: Boolean(detailed.livemode),
    mode: detailed.mode,
    paymentStatus: detailed.payment_status,
    amountCents: detailed.amount_total ?? 0,
    invoiceId,
    paymentIntentId,
    periodStart: detailed.metadata?.hhtb_period_start || null,
    recordedIds: existing.map((row) => row.stripeInvoiceId),
  });
  if (decision.action === 'ignore') return;
  if (decision.action === 'record-invoice') {
    const invoice = await stripe.invoices.retrieve(decision.invoiceId, { expand: ['payments.data.payment.payment_intent'] });
    if (invoice.livemode) return;
    await recordStripeInvoice(userId, invoice, detailed.metadata?.hhtb_period_start || null);
    return;
  }
  await upsertStoredInvoice({
    userId,
    stripeInvoiceId: decision.paymentIntentId,
    periodStart: decision.periodStart,
    role: 'supplemental',
    status: 'paid',
    amountCents: decision.amountCents,
    amountPaidCents: decision.amountCents,
  });
}

export async function reconcileCheckoutPayments(userId: string, customerId: string): Promise<void> {
  const sessions = await stripeServer().checkout.sessions.list({ customer: customerId, limit: 100 });
  for (const session of sessions.data) {
    if (session.livemode || session.mode !== 'payment' || session.payment_status !== 'paid') continue;
    await recordCheckoutSessionPayment(userId, session);
  }
}

export async function recoverBillingOperations(userId: string): Promise<void> {
  const operations = await listOpenOperations(userId);
  for (const operation of operations) {
    if (operation.status === 'stripe_succeeded') {
      await finishSucceededOperation(operation);
      continue;
    }
    const ageMs = Date.now() - Date.parse(operation.created_at);
    if (ageMs <= 23 * 60 * 60 * 1000) {
      if (operation.kind === 'customer') {
        const account = await loadBillingAccount(userId);
        await ensureCustomer(stripeServer(), userId, account);
      }
      continue;
    }
    const found = await findStripeObjectForOperation(operation);
    if (!found) {
      await markOperationFailed(operation.id, 'Stripe result could not be recovered after the idempotency window.');
      continue;
    }
    const payload = asRecord(operation.payload);
    await markOperationStripeSucceeded(operation.id, found.id, {
      ...payload,
      status: found.status ?? null,
      amountPaidCents: found.amountPaidCents ?? null,
      periodEnd: found.periodEnd ?? null,
      itemId: found.itemId ?? null,
    });
    await finishSucceededOperation(await reloadOperation(operation.id));
  }
}

async function findStripeObjectForOperation(operation: BillingOperation): Promise<{ id: string; status?: string; amountPaidCents?: number; periodEnd?: number; itemId?: string } | null> {
  const account = await loadBillingAccount(operation.user_id);
  const stripe = stripeServer();
  if (operation.kind === 'customer') {
    const customers = await stripe.customers.search({ query: `metadata['hhtb_user_id']:'${operation.user_id}'` });
    const customer = customers.data.find((item) => !('deleted' in item && item.deleted));
    return customer ? { id: customer.id } : null;
  }
  if (!account?.stripe_customer_id) return null;
  if (operation.kind === 'subscription_price' && account.stripe_subscription_id) {
    const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);
    const payload = asRecord(operation.payload);
    const item = subscription.items.data[0];
    const expectedAmount = payload.nextAmountCents;
    const previousAnchor = payload.previousAnchor;
    if (
      item
      && typeof expectedAmount === 'number'
      && item.price.unit_amount === expectedAmount
      && typeof previousAnchor === 'number'
      && subscription.billing_cycle_anchor === previousAnchor
    ) {
      return {
        id: subscription.id,
        periodEnd: subscriptionPeriodEnd(subscription) ?? undefined,
        itemId: item.id,
      };
    }
    return null;
  }
  if (operation.kind === 'subscription_create') {
    const subscriptions = await stripe.subscriptions.list({ customer: account.stripe_customer_id, status: 'all', limit: 20 });
    const match = subscriptions.data.find((subscription) => subscription.metadata?.hhtb_operation_id === operation.id);
    const item = match?.items.data[0];
    return match ? { id: match.id, periodEnd: subscriptionPeriodEnd(match) ?? undefined, itemId: item?.id } : null;
  }
  const invoices = await stripe.invoices.list({ customer: account.stripe_customer_id, limit: 100 });
  const match = invoices.data.find((invoice) => invoice.metadata?.hhtb_operation_id === operation.id);
  return match ? { id: match.id, status: match.status ?? undefined, amountPaidCents: match.amount_paid } : null;
}

async function finishSucceededOperation(operation: BillingOperation): Promise<void> {
  if (operation.status !== 'stripe_succeeded' || !operation.stripe_id) return;
  const payload = asRecord(operation.payload);
  if (operation.kind === 'customer') {
    await saveBillingAccount(operation.user_id, { stripe_customer_id: operation.stripe_id });
  }
  if (operation.kind === 'supplemental' || operation.kind === 'replacement') {
    const periodStart = typeof payload.periodStart === 'string' ? payload.periodStart : null;
    const amount = typeof payload.amountCents === 'number' ? payload.amountCents : 0;
    const role = operation.kind === 'replacement' ? 'replacement' : 'supplemental';
    await upsertStoredInvoice({
      userId: operation.user_id,
      stripeInvoiceId: operation.stripe_id,
      periodStart,
      role,
      status: invoiceStatus(typeof payload.status === 'string' ? payload.status as Stripe.Invoice.Status : 'open'),
      amountCents: amount,
      amountPaidCents: typeof payload.amountPaidCents === 'number' ? payload.amountPaidCents : 0,
      replacesStripeInvoiceId: typeof payload.replacesInvoiceId === 'string' ? payload.replacesInvoiceId : null,
    });
  }
  if (operation.kind === 'subscription_price' || operation.kind === 'subscription_create') {
    const amount = typeof payload.nextAmountCents === 'number' ? payload.nextAmountCents : null;
    const anchor = typeof payload.previousAnchor === 'number' ? payload.previousAnchor : null;
    const periodEnd = typeof payload.periodEnd === 'number' ? payload.periodEnd : null;
    await saveBillingAccount(operation.user_id, {
      ...(operation.kind === 'subscription_create' ? {
        stripe_subscription_id: operation.stripe_id,
        subscription_status: typeof payload.status === 'string' ? payload.status : 'active',
      } : {}),
      synced_amount_cents: amount,
      billing_cycle_anchor: anchor ? new Date(anchor * 1000).toISOString() : null,
      current_period_end: typeof payload.effectiveAt === 'string'
        ? payload.effectiveAt
        : periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      stripe_subscription_item_id: typeof payload.itemId === 'string' ? payload.itemId : undefined,
      ...(typeof payload.cancelAtPeriodEnd === 'boolean' ? { cancel_at_period_end: payload.cancelAtPeriodEnd } : {}),
    });
  }
  await markOperationCompleted(operation.id);
}

/** Reads the live subscription and stores a scheduled cancel_at. Does not change Stripe. */
export async function refreshSubscriptionCancellation(userId: string): Promise<void> {
  const account = await loadBillingAccount(userId);
  if (!account?.stripe_subscription_id) return;
  const stripe = stripeServer();
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);
  } catch (error) {
    console.error('Subscription cancellation could not be read', error instanceof Error ? error.message : 'unknown');
    return;
  }
  if (subscription.livemode) return;
  const observedAt = Math.floor(Date.now() / 1000);
  await saveBillingAccount(userId, {
    ...subscriptionBillingPatch(subscription),
    subscription_event_created: Math.max(account.subscription_event_created ?? 0, observedAt),
  });
}

export async function syncSubscriptionFromStripe(userId: string): Promise<void> {
  await withBillingLock(userId, () => refreshSubscriptionCancellation(userId));
}

export async function syncAccountBilling(userId: string, now = new Date()): Promise<void> {
  await withBillingLock(userId, async () => {
    if (await deletionBlocksBilling(userId)) return;
    await recoverBillingOperations(userId);
    const snapshot = await loadChargeSnapshot(userId, now);
    if (!snapshot) return;
    const account = await loadBillingAccount(userId);
    if (account?.stripe_customer_id) {
      await backfillCustomerInvoices(userId, account.stripe_customer_id, snapshot.periodStart);
      await reconcileCheckoutPayments(userId, account.stripe_customer_id);
    }
    const refreshed = await loadBillingAccount(userId);
    await refreshSavedPaymentMethod(userId);
    await refreshSubscriptionCancellation(userId);
    const priced = await loadBillingAccount(userId);
    if (priced?.stripe_subscription_id) await syncRecurringPrice(userId, priced, snapshot.nextAmountCents);
    const invoices = await listStoredInvoices(userId);
    await collectGap(userId, priced ?? refreshed ?? account, snapshot, invoices);
    await saveBillingAccount(userId, { last_reconciled_at: now.toISOString() });
  });
}

async function collectGap(userId: string, account: BillingAccountRow | null, snapshot: ChargeSnapshot, invoices: LedgerInvoice[]): Promise<void> {
  if (!account?.stripe_customer_id || !snapshot.periodStart) return;
  if (supplementalBlockedByCancellation(snapshot.periodStart, account.current_period_end, account.cancel_at_period_end)) return;
  if (supplementalInvoiceBlocked({
    subscriptionStatus: account.subscription_status,
    billingCycleAnchor: account.billing_cycle_anchor,
    periodStart: snapshot.periodStart,
    nextBillingAt: snapshot.nextBillingAt,
    now: new Date(),
  })) return;
  const gap = uninvoicedCents(snapshot.owedNowCents, invoices, snapshot.periodStart);
  if (gap <= 0) return;
  await createSupplementalInvoice({
    userId,
    customerId: account.stripe_customer_id,
    periodStart: snapshot.periodStart,
    amountCents: gap,
    invoicedCents: invoicedCents(invoices, snapshot.periodStart),
  });
}

export async function createAnchoredSubscription(input: {
  userId: string;
  customerId: string;
  paymentMethodId: string | null;
  anchor: number;
  nextAmountCents: number;
}): Promise<void> {
  if (await deletionBlocksBilling(input.userId)) throw new Error('Account deletion is in progress.');
  if (input.anchor <= Math.floor(Date.now() / 1000)) throw new Error('The next billing date is not in the future.');
  const stripe = stripeServer();
  const existing = await stripe.subscriptions.list({ customer: input.customerId, status: 'all', limit: 20 });
  const live = existing.data.find((subscription) => LIVE_SUBSCRIPTION.has(subscription.status) && subscription.status !== 'incomplete');
  if (live) {
    const account = await loadBillingAccount(input.userId);
    if (account?.stripe_subscription_id !== live.id) {
      await saveBillingAccount(input.userId, {
        stripe_customer_id: input.customerId,
        ...subscriptionBillingPatch(live),
      });
    }
    return;
  }
  const key = `subcreate:${input.userId}:${input.anchor}:${input.nextAmountCents}`;
  const operation = await startBillingOperation({
    userId: input.userId,
    idempotencyKey: key,
    kind: 'subscription_create',
    payload: { nextAmountCents: input.nextAmountCents, previousAnchor: input.anchor },
  });
  if (operation.status === 'completed') return;
  let stripeDone = operation.status === 'stripe_succeeded';
  try {
    if (!stripeDone) {
      if (input.paymentMethodId) {
        await stripe.customers.update(input.customerId, { invoice_settings: { default_payment_method: input.paymentMethodId } });
      }
      const created = await stripe.subscriptions.create({
        customer: input.customerId,
        items: [{ price: await monthlyPrice(stripe, input.nextAmountCents, true) }],
        default_payment_method: input.paymentMethodId ?? undefined,
        billing_mode: { type: 'flexible' },
        billing_cycle_anchor: input.anchor,
        proration_behavior: 'none',
        metadata: { hhtb_user_id: input.userId, hhtb_operation_id: operation.id },
      }, { idempotencyKey: key });
      if (created.billing_cycle_anchor !== input.anchor) throw new Error('Stripe moved the billing cycle anchor.');
      await markOperationStripeSucceeded(operation.id, created.id, {
        nextAmountCents: input.nextAmountCents,
        previousAnchor: input.anchor,
        periodEnd: subscriptionPeriodEnd(created),
        itemId: subscriptionItemId(created),
        status: created.status,
      });
      stripeDone = true;
    }
    await finishSucceededOperation(await reloadOperation(operation.id));
  } catch (error) {
    if (!stripeDone) await markOperationFailed(operation.id, error instanceof Error ? error.message : 'Subscription create failed.');
    throw error;
  }
}

export type PaymentResult = {
  url: string | null;
  kind: 'checkout' | 'portal' | 'none' | 'stale';
  explanation: string;
};

function paymentAccount(account: BillingAccountRow | null): PaymentAccount | null {
  if (!account) return null;
  return {
    subscriptionStatus: account.subscription_status,
    stripeCustomerId: account.stripe_customer_id,
    stripeSubscriptionId: account.stripe_subscription_id,
    hasSavedPaymentMethod: Boolean(account.card_brand && account.card_last4),
  };
}

function paymentMethodLabel(account: BillingAccountRow | null): string | null {
  if (!account?.card_brand || !account.card_last4) return null;
  return formatSavedCard({ brand: account.card_brand, last4: account.card_last4 });
}

export type SavedCardSync = {
  state: PaymentMethodSyncState;
  card: SavedCard | null;
  label: string | null;
};

function storedCardSync(account: BillingAccountRow | null): SavedCardSync {
  if (account?.card_brand && account.card_last4) {
    const card = { brand: account.card_brand, last4: account.card_last4 };
    return { state: 'saved', card, label: formatSavedCard(card) };
  }
  if (account?.stripe_customer_id || account?.stripe_subscription_id) return { state: 'pending', card: null, label: null };
  return { state: 'absent', card: null, label: null };
}

async function expandedPaymentMethod(stripe: Stripe, source: PaymentMethodSource): Promise<PaymentMethodSource> {
  if (cardFromPaymentMethod(source)) return source;
  const id = typeof source === 'string' ? source : source?.id;
  if (!id) return source ?? null;
  try {
    const method = await stripe.paymentMethods.retrieve(id);
    if (method.livemode) return null;
    return method;
  } catch {
    return null;
  }
}

/**
 * Reads the subscription default, then the customer invoice-settings default.
 * Writes only the brand and last four. Does not change the subscription or charge the card.
 */
export async function refreshSavedPaymentMethod(userId: string): Promise<SavedCardSync> {
  const account = await loadBillingAccount(userId);
  if (!account?.stripe_customer_id) return { state: 'absent', card: null, label: null };
  if (!stripeConfigured()) return storedCardSync(account);
  try {
    const stripe = stripeServer();
    const customer = await stripe.customers.retrieve(account.stripe_customer_id, {
      expand: ['invoice_settings.default_payment_method'],
    });
    if (customer.deleted || customer.livemode) return storedCardSync(account);
    let subscriptionDefault: PaymentMethodSource = null;
    if (account.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id, {
        expand: ['default_payment_method'],
      });
      if (!subscription.livemode) subscriptionDefault = subscription.default_payment_method;
    }
    const customerDefault = customer.invoice_settings?.default_payment_method ?? null;
    const card = resolveEffectiveCard({
      subscriptionDefault: await expandedPaymentMethod(stripe, subscriptionDefault),
      customerDefault: await expandedPaymentMethod(stripe, customerDefault),
    });
    await saveBillingAccount(userId, {
      card_brand: card?.brand ?? null,
      card_last4: card?.last4 ?? null,
    });
    if (!card) return { state: 'absent', card: null, label: null };
    return { state: 'saved', card, label: formatSavedCard(card) };
  } catch (error) {
    console.error('Saved payment method sync failed', error instanceof Error ? error.message : 'unknown');
    return storedCardSync(account);
  }
}

export async function syncSavedPaymentMethod(userId: string): Promise<SavedCardSync> {
  const owner = await claimBillingLock(userId);
  if (!owner) return storedCardSync(await loadBillingAccount(userId));
  try {
    return await refreshSavedPaymentMethod(userId);
  } finally {
    await releaseBillingLock(userId, owner);
  }
}

async function workflowFor(userId: string, account: BillingAccountRow | null, snapshot: ChargeSnapshot | null): Promise<PaymentWorkflow> {
  const invoices = await listStoredInvoices(userId);
  return describePaymentWorkflow({
    owedNowCents: snapshot?.owedNowCents ?? 0,
    nextAmountCents: snapshot?.nextAmountCents ?? 0,
    nextBillingAt: snapshot?.nextBillingAt ?? null,
    periodStart: snapshot?.periodStart ?? null,
    scheduledChargeCents: snapshot?.scheduledChargeCents ?? 0,
    scheduledChargeAt: snapshot?.scheduledChargeAt ?? null,
    invoices,
    account: paymentAccount(account),
    paymentMethodLabel: paymentMethodLabel(account),
    trialPaymentDeferred: snapshot?.trialPaymentDeferred ?? false,
  });
}

function requireSandbox(): void {
  if (!stripeConfigured()) throw new Error('Sandbox payments are not configured.');
}

async function openPortal(customerId: string, origin: string): Promise<string> {
  requireSandbox();
  const portal = await stripeServer().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/dashboard/plan`,
  });
  return portal.url;
}

export async function beginPayment(
  userId: string,
  origin: string,
  requested: 'checkout' | 'portal',
  expected: PaymentExpectation | null,
): Promise<PaymentResult> {
  return withBillingLock(userId, async () => {
    if (await deletionBlocksBilling(userId)) {
      return { url: null, kind: 'stale', explanation: 'Account deletion is in progress.' };
    }
    const snapshot = await loadChargeSnapshot(userId);
    const account = await loadBillingAccount(userId);
    let workflow = await workflowFor(userId, account, snapshot);
    const route = expected ? matchedPaymentRoute(workflow, expected) : workflow.route;
    if (expected && !route) return { url: null, kind: 'stale', explanation: PAYMENT_STATE_CHANGED };
    if (!route || route === 'none') return { url: null, kind: 'none', explanation: workflow.explanation };
    if (route !== requested) return { url: null, kind: 'stale', explanation: PAYMENT_STATE_CHANGED };
    if (route === 'portal') {
      if (!account?.stripe_customer_id) throw new Error('Payment setup has not been started.');
      return { url: await openPortal(account.stripe_customer_id, origin), kind: 'portal', explanation: workflow.explanation };
    }
    if (!snapshot) return { url: null, kind: 'none', explanation: workflow.explanation };

    requireSandbox();
    const stripe = stripeServer();
    if (account?.stripe_customer_id) {
      await backfillCustomerInvoices(userId, account.stripe_customer_id, snapshot.periodStart);
      workflow = await workflowFor(userId, account, snapshot);
      const refreshed = expected ? matchedPaymentRoute(workflow, expected) : workflow.route;
      if (refreshed === 'portal' && !expected) {
        return { url: await openPortal(account.stripe_customer_id, origin), kind: 'portal', explanation: workflow.explanation };
      }
      if (refreshed !== 'checkout') {
        const nothingDue = !expected && workflow.route === 'none';
        return {
          url: null,
          kind: nothingDue ? 'none' : 'stale',
          explanation: nothingDue ? workflow.explanation : PAYMENT_STATE_CHANGED,
        };
      }
      const existing = await stripe.subscriptions.list({ customer: account.stripe_customer_id, status: 'all', limit: 20 });
      const openSubscription = existing.data.find((subscription) => LIVE_SUBSCRIPTION.has(subscription.status));
      if (openSubscription && openSubscription.status !== 'incomplete') {
        await saveBillingAccount(userId, {
          stripe_customer_id: account.stripe_customer_id,
          ...subscriptionBillingPatch(openSubscription),
        });
        if (!expected) {
          return { url: await openPortal(account.stripe_customer_id, origin), kind: 'portal', explanation: workflow.explanation };
        }
        return { url: null, kind: 'stale', explanation: PAYMENT_STATE_CHANGED };
      }
      if (openSubscription?.status === 'incomplete') await stripe.subscriptions.cancel(openSubscription.id);
    }

    const customerId = await ensureCustomer(stripe, userId, account);
    const gap = workflow.uninvoicedCents;
    const anchor = Math.floor(Date.parse(snapshot.nextBillingAt) / 1000);
    if (anchor <= Math.floor(Date.now() / 1000)) throw new Error('The next billing date is not in the future.');
    const openSession = await supabaseServer
      .from('billing_checkout_sessions')
      .select('stripe_session_id')
      .eq('user_id', userId)
      .eq('status', 'open')
      .maybeSingle();
    if (openSession.error) throw openSession.error;
    if (openSession.data?.stripe_session_id) {
      const session = await stripe.checkout.sessions.retrieve(openSession.data.stripe_session_id);
      const sameQuote = session.metadata?.hhtb_gap === String(gap) && session.metadata?.hhtb_next_amount === String(snapshot.nextAmountCents);
      if (session.status === 'open' && session.url && sameQuote) return { url: session.url, kind: 'checkout', explanation: workflow.explanation };
      if (session.status === 'open') await stripe.checkout.sessions.expire(session.id);
      await supabaseServer.from('billing_checkout_sessions').update({ status: 'expired' }).eq('stripe_session_id', openSession.data.stripe_session_id);
    }
    const key = `checkout:${userId}:${snapshot.periodStart ?? 'pre'}:${gap}:${snapshot.nextAmountCents}`;
    const metadata = {
      hhtb_user_id: userId,
      hhtb_period_start: snapshot.periodStart ?? '',
      hhtb_gap: String(gap),
      hhtb_next_amount: String(snapshot.nextAmountCents),
      hhtb_anchor: String(anchor),
      hhtb_checkout: gap > 0 ? 'payment' : 'subscription',
    };
    const session = gap > 0
      ? await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        client_reference_id: userId,
        line_items: [{ price: await monthlyPrice(stripe, gap, false), quantity: 1 }],
        success_url: `${origin}/dashboard/plan?checkout=success`,
        cancel_url: `${origin}/dashboard/plan?checkout=cancel`,
        metadata,
        invoice_creation: {
          enabled: true,
          invoice_data: {
            metadata: {
              hhtb_role: 'supplemental',
              hhtb_user_id: userId,
              hhtb_period_start: snapshot.periodStart ?? '',
            },
          },
        },
        payment_intent_data: {
          setup_future_usage: 'off_session',
          metadata: { hhtb_user_id: userId },
        },
      }, { idempotencyKey: key })
      : await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        client_reference_id: userId,
        line_items: [{ price: await monthlyPrice(stripe, snapshot.nextAmountCents, true), quantity: 1 }],
        success_url: `${origin}/dashboard/plan?checkout=success`,
        cancel_url: `${origin}/dashboard/plan?checkout=cancel`,
        metadata,
        subscription_data: {
          billing_mode: { type: 'flexible' },
          billing_cycle_anchor: anchor,
          proration_behavior: 'none',
          metadata: { hhtb_user_id: userId },
        },
      }, { idempotencyKey: key });
    if (!session.url) throw new Error('Stripe Checkout did not return a URL.');
    const saved = await supabaseServer.from('billing_checkout_sessions').insert({
      user_id: userId,
      stripe_session_id: session.id,
      status: 'open',
      livemode: false,
    });
    if (saved.error && saved.error.code !== '23505') throw saved.error;
    return { url: session.url, kind: 'checkout', explanation: workflow.explanation };
  });
}
