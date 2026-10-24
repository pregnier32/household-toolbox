import type Stripe from 'stripe';
import { loadChargeSnapshot } from '@/lib/billing-amount';
import { finalizedRenewalAction, renewalDraftMayBeCorrected } from '@/lib/billing-ledger';
import { withBillingLock } from '@/lib/billing-lock';
import { subscriptionItemId, subscriptionPeriodEnd } from '@/lib/billing-subscription';
import { loadBillingAccount, saveBillingAccount } from '@/lib/billing-store';
import { createAnchoredSubscription, createSupplementalInvoice, recordStripeInvoice, settleUnintendedSubscriptionUpdate } from '@/lib/billing-sync';
import { supabaseServer } from '@/lib/supabaseServer';
import { stripeServer } from '@/lib/stripe-server';

function knownInvoiceStatus(status: string | null | undefined): 'draft' | 'open' | 'paid' | 'void' | 'uncollectible' {
  if (status === 'draft' || status === 'open' || status === 'paid' || status === 'void' || status === 'uncollectible') return status;
  return 'open';
}

function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === 'string' ? customer : customer.id;
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (!subscription) return null;
  return typeof subscription === 'string' ? subscription : subscription.id;
}

async function userIdForCustomer(customer: string | null): Promise<string | null> {
  if (!customer) return null;
  const { data, error } = await supabaseServer.from('billing_accounts').select('user_id').eq('stripe_customer_id', customer).maybeSingle();
  if (error) throw error;
  return data?.user_id ?? null;
}

async function userIdForSubscription(subscriptionId: string | null): Promise<string | null> {
  if (!subscriptionId) return null;
  const { data, error } = await supabaseServer.from('billing_accounts').select('user_id').eq('stripe_subscription_id', subscriptionId).maybeSingle();
  if (error) throw error;
  return data?.user_id ?? null;
}

async function rememberCard(userId: string, customer: string): Promise<void> {
  const stripe = stripeServer();
  const loaded = await stripe.customers.retrieve(customer, { expand: ['invoice_settings.default_payment_method'] });
  if (loaded.deleted) return;
  const method = loaded.invoice_settings?.default_payment_method;
  if (!method || typeof method === 'string' || !method.card) return;
  await saveBillingAccount(userId, { card_brand: method.card.brand, card_last4: method.card.last4 });
}

async function saveSubscription(userId: string, subscription: Stripe.Subscription, eventCreated: number): Promise<void> {
  const account = await loadBillingAccount(userId);
  if (account?.subscription_event_created != null && eventCreated < account.subscription_event_created) return;
  const ended = subscription.status === 'canceled' || subscription.status === 'incomplete_expired';
  const periodEnd = subscriptionPeriodEnd(subscription);
  await saveBillingAccount(userId, {
    stripe_customer_id: customerId(subscription.customer),
    stripe_subscription_id: ended ? null : subscription.id,
    stripe_subscription_item_id: ended ? null : subscriptionItemId(subscription),
    subscription_status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    billing_cycle_anchor: new Date(subscription.billing_cycle_anchor * 1000).toISOString(),
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    subscription_event_created: eventCreated,
    synced_amount_cents: ended ? account?.synced_amount_cents ?? null : subscription.items.data[0]?.price?.unit_amount ?? null,
  });
}

async function correctDraftRenewal(invoice: Stripe.Invoice, owedAtPeriodStartCents: number): Promise<Stripe.Invoice> {
  if (invoice.total === owedAtPeriodStartCents) {
    await stripeServer().invoices.update(invoice.id, { metadata: { hhtb_role: 'renewal' } });
    return invoice;
  }
  const stripe = stripeServer();
  const lines = invoice.lines?.data?.length
    ? invoice.lines.data
    : (await stripe.invoices.listLineItems(invoice.id, { limit: 20 })).data;
  if (lines.length === 0) return invoice;
  const [first, ...rest] = lines;
  try {
    return await stripe.invoices.updateLines(invoice.id, {
      lines: [
        { id: first.id, amount: owedAtPeriodStartCents, description: 'Household Toolbox' },
        ...rest.map((line) => ({ id: line.id, amount: 0 })),
      ],
      invoice_metadata: { hhtb_role: 'renewal' },
    });
  } catch (error) {
    const current = await stripe.invoices.retrieve(invoice.id);
    if (current.status !== 'draft') return current;
    throw error;
  }
}

async function processInvoice(invoice: Stripe.Invoice): Promise<void> {
  if (invoice.livemode) return;
  const userId = invoice.metadata?.hhtb_user_id
    || invoice.parent?.subscription_details?.metadata?.hhtb_user_id
    || await userIdForSubscription(subscriptionIdFromInvoice(invoice))
    || await userIdForCustomer(customerId(invoice.customer));
  if (!userId) return;
  await withBillingLock(userId, async () => {
    const snapshot = await loadChargeSnapshot(userId);
    let current = invoice;
    if (!snapshot) {
      await recordStripeInvoice(userId, current, null);
      return;
    }
    if (await settleUnintendedSubscriptionUpdate(userId, current, snapshot.periodStart)) return;
    const correctable = renewalDraftMayBeCorrected({
      livemode: false,
      status: current.status,
      billingReason: current.billing_reason,
      role: current.metadata?.hhtb_role ?? null,
    });
    if (correctable && snapshot) current = await correctDraftRenewal(current, snapshot.owedAtPeriodStartCents);
    const role = current.metadata?.hhtb_role || (current.billing_reason === 'subscription_cycle' ? 'renewal' : null);
    if (role === 'renewal' && current.status && current.status !== 'draft' && snapshot) {
      const action = finalizedRenewalAction({
        status: knownInvoiceStatus(current.status),
        amountCents: current.total,
        amountPaidCents: current.amount_paid,
        owedAtPeriodStartCents: snapshot.owedAtPeriodStartCents,
      });
      if (action === 'void-and-replace' && snapshot.periodStart) {
        const stripe = stripeServer();
        const voided = await stripe.invoices.voidInvoice(current.id);
        await recordStripeInvoice(userId, voided, snapshot.periodStart);
        const customer = customerId(current.customer);
        if (snapshot.owedAtPeriodStartCents > 0 && customer) {
          await createSupplementalInvoice({
            userId,
            customerId: customer,
            periodStart: snapshot.periodStart,
            amountCents: snapshot.owedAtPeriodStartCents,
            invoicedCents: 0,
            role: 'replacement',
            replacesInvoiceId: current.id,
          });
        }
        return;
      }
      await recordStripeInvoice(userId, current, snapshot.periodStart, action === 'review-overcharge');
      return;
    }
    await recordStripeInvoice(userId, current, snapshot?.periodStart ?? null);
  });
}

async function processSubscription(subscription: Stripe.Subscription, eventCreated: number): Promise<void> {
  const userId = subscription.metadata?.hhtb_user_id
    || await userIdForSubscription(subscription.id)
    || await userIdForCustomer(customerId(subscription.customer));
  if (!userId) return;
  await withBillingLock(userId, async () => {
    await saveSubscription(userId, subscription, eventCreated);
  });
}

async function processCheckoutCompleted(session: Stripe.Checkout.Session, eventCreated: number): Promise<void> {
  const userId = session.metadata?.hhtb_user_id || session.client_reference_id;
  if (!userId || session.livemode) return;
  const stripe = stripeServer();
  await withBillingLock(userId, async () => {
    const customer = customerId(session.customer);
    if (customer) await saveBillingAccount(userId, { stripe_customer_id: customer });
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await saveSubscription(userId, subscription, eventCreated);
    }
    if (session.mode === 'payment' && customer) {
      const snapshot = await loadChargeSnapshot(userId);
      if (!snapshot) throw new Error('Account could not be priced.');
      const anchor = Math.floor(Date.parse(snapshot.nextBillingAt) / 1000);
      const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
      let paymentMethodId: string | null = null;
      if (intentId) {
        const intent = await stripe.paymentIntents.retrieve(intentId);
        paymentMethodId = typeof intent.payment_method === 'string' ? intent.payment_method : intent.payment_method?.id ?? null;
      }
      if (!paymentMethodId) throw new Error('Checkout did not save a payment method.');
      await createAnchoredSubscription({
        userId,
        customerId: customer,
        paymentMethodId,
        anchor,
        nextAmountCents: snapshot.nextAmountCents,
      });
    }
    if (customer) await rememberCard(userId, customer);
    await supabaseServer.from('billing_checkout_sessions').update({ status: 'complete' }).eq('stripe_session_id', session.id);
    const invoiceId = typeof session.invoice === 'string' ? session.invoice : session.invoice?.id;
    if (invoiceId) {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      await recordStripeInvoice(userId, invoice, session.metadata?.hhtb_period_start || null);
    }
  });
}

export async function processStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.livemode) return;
  switch (event.type) {
    case 'checkout.session.completed':
      await processCheckoutCompleted(event.data.object as Stripe.Checkout.Session, event.created);
      return;
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      await supabaseServer.from('billing_checkout_sessions').update({ status: 'expired' }).eq('stripe_session_id', session.id);
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await processSubscription(event.data.object as Stripe.Subscription, event.created);
      return;
    case 'invoice.created':
    case 'invoice.finalized':
    case 'invoice.paid':
    case 'invoice.payment_failed':
    case 'invoice.marked_uncollectible':
    case 'invoice.voided': {
      const invoice = event.data.object as Stripe.Invoice;
      await processInvoice(invoice);
      if (event.type === 'invoice.paid') {
        const userId = invoice.metadata?.hhtb_user_id || await userIdForCustomer(customerId(invoice.customer));
        const customer = customerId(invoice.customer);
        if (userId && customer) await rememberCard(userId, customer);
      }
      return;
    }
    default:
      return;
  }
}
