import type { LiveCommencement } from '@/lib/billing-commencement';
import { stripeLivemode, stripeMode } from '@/lib/stripe-mode';
import type { BillingAccountRow } from '@/lib/billing-store';

let liveStorageReady: boolean | null = null;

export async function liveBillingStorageReady(): Promise<boolean> {
  if (stripeMode() !== 'live') return true;
  if (liveStorageReady != null) return liveStorageReady;
  const { supabaseServer } = await import('@/lib/supabaseServer');
  const probe = await supabaseServer.from('billing_accounts').select('preserved_test_stripe_customer_id').limit(1);
  liveStorageReady = !probe.error;
  return liveStorageReady;
}

export async function loadLiveCommencement(userId: string): Promise<LiveCommencement | null> {
  if (stripeMode() !== 'live') return null;
  const { supabaseServer } = await import('@/lib/supabaseServer');
  const result = await supabaseServer
    .from('billing_accounts')
    .select('live_billing_commenced_at, live_billing_excluded_period_start, live_billing_excluded_tool_ids, live_billing_excluded_storage_gb')
    .eq('user_id', userId)
    .maybeSingle();
  if (result.error) {
    if (/live_billing_commenced_at|schema cache/i.test(result.error.message || '')) return null;
    throw result.error;
  }
  const commencedAt = typeof result.data?.live_billing_commenced_at === 'string' ? result.data.live_billing_commenced_at : null;
  if (!commencedAt) return null;
  const toolIds = Array.isArray(result.data?.live_billing_excluded_tool_ids)
    ? result.data.live_billing_excluded_tool_ids.filter((id: unknown): id is string => typeof id === 'string')
    : [];
  return {
    commencedAt,
    excludedPeriodStart: typeof result.data?.live_billing_excluded_period_start === 'string' ? result.data.live_billing_excluded_period_start : null,
    excludedToolIds: toolIds,
    excludedStorageGb: typeof result.data?.live_billing_excluded_storage_gb === 'number' ? result.data.live_billing_excluded_storage_gb : 0,
  };
}

/** Records the tools and storage already committed before the customer authorizes live billing. Does not call Stripe. */
export async function recordLiveCommencement(userId: string, input: LiveCommencement): Promise<void> {
  if (stripeMode() !== 'live') return;
  if (!(await liveBillingStorageReady())) throw new Error('Live billing storage is not ready.');
  const { supabaseServer } = await import('@/lib/supabaseServer');
  const saved = await supabaseServer.from('billing_accounts').update({
    live_billing_commenced_at: input.commencedAt,
    live_billing_excluded_period_start: input.excludedPeriodStart,
    live_billing_excluded_tool_ids: input.excludedToolIds,
    live_billing_excluded_storage_gb: input.excludedStorageGb,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId).is('live_billing_commenced_at', null);
  if (saved.error) throw new Error('Live billing storage is not ready.');
}

export function billingAccountForMode<T extends Pick<BillingAccountRow, 'stripe_customer_id' | 'stripe_subscription_id' | 'stripe_subscription_item_id' | 'subscription_status' | 'cancel_at_period_end' | 'current_period_end' | 'card_brand' | 'card_last4' | 'synced_amount_cents' | 'subscription_event_created'> & { livemode?: boolean | null }>(account: T | null): T | null {
  if (!account || (account.livemode === true) === stripeLivemode()) return account;
  return {
    ...account,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_subscription_item_id: null,
    subscription_status: null,
    cancel_at_period_end: false,
    current_period_end: null,
    card_brand: null,
    card_last4: null,
    synced_amount_cents: null,
    subscription_event_created: null,
  };
}

/**
 * Copies sandbox Stripe ids off the active account before a customer starts live Checkout.
 * The billing anchor stays. No live customer is created here.
 */
export async function separateTestStripeIdentity(userId: string, account: BillingAccountRow): Promise<void> {
  if (stripeMode() !== 'live' || account.livemode === true) return;
  if (!(await liveBillingStorageReady())) throw new Error('Live billing storage is not ready.');
  const { supabaseServer } = await import('@/lib/supabaseServer');
  const saved = await supabaseServer.from('billing_accounts').update({
    livemode: true,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_subscription_item_id: null,
    subscription_status: null,
    cancel_at_period_end: false,
    current_period_end: null,
    synced_amount_cents: null,
    card_brand: null,
    card_last4: null,
    subscription_event_created: null,
    preserved_test_stripe_customer_id: account.stripe_customer_id,
    preserved_test_stripe_subscription_id: account.stripe_subscription_id,
    preserved_test_stripe_subscription_item_id: account.stripe_subscription_item_id,
    preserved_test_card_brand: account.card_brand,
    preserved_test_card_last4: account.card_last4,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('livemode', false);
  if (saved.error) throw new Error('Live billing storage is not ready.');
}
