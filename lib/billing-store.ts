import type { Json } from '@/src/types/supabase';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  stripeIdempotencyKey,
  stripeLivemode,
  stripeMode,
} from '@/lib/stripe-mode';
import {
  mergeInvoiceStatus,
  type InvoiceRole,
  type InvoiceStatus,
  type LedgerInvoice,
} from '@/lib/billing-ledger';

export type BillingAccountRow = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_item_id: string | null;
  subscription_status: string | null;
  cancel_at_period_end: boolean;
  billing_cycle_anchor: string | null;
  current_period_end: string | null;
  synced_amount_cents: number | null;
  card_brand: string | null;
  card_last4: string | null;
  subscription_event_created: number | null;
  livemode?: boolean | null;
  last_reconciled_at: string | null;
  tool_access_locked?: boolean | null;
  tool_access_reason?: string | null;
  tool_access_synced_at?: string | null;
};

export type StoredInvoice = LedgerInvoice & {
  stripeInvoiceId: string;
  amountPaidCents: number;
  replacesStripeInvoiceId: string | null;
  overcharge: boolean;
  updatedAt: string | null;
  collectionState: 'processing' | 'authentication_required' | 'failed' | 'overdue' | null;
  collectionCheckedAt: string | null;
  dueAt: string | null;
};

type InvoiceRow = {
  period_start: string | null;
  stripe_invoice_id: string;
  role: InvoiceRole;
  status: InvoiceStatus;
  amount_cents: number;
  amount_paid_cents: number;
  replaces_stripe_invoice_id: string | null;
  overcharge: boolean;
  updated_at?: string | null;
  collection_state?: 'processing' | 'authentication_required' | 'failed' | 'overdue' | null;
  collection_checked_at?: string | null;
  due_at?: string | null;
};

function missingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return error.code === '42P01' || error.code === 'PGRST205' || message.includes('does not exist') || message.includes('schema cache');
}

export async function loadStripeObservedAt(userId: string): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from('billing_accounts')
    .select('stripe_observed_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    if (missingRelation(error) || /stripe_observed_at|schema cache/i.test(error.message || '')) return null;
    throw error;
  }
  const value = data && typeof data === 'object' && 'stripe_observed_at' in data ? data.stripe_observed_at : null;
  return typeof value === 'string' ? value : null;
}

export async function markStripeObserved(userId: string, at: string): Promise<void> {
  const { error } = await supabaseServer.from('billing_accounts').update({ stripe_observed_at: at }).eq('user_id', userId);
  if (error && !missingRelation(error) && !/stripe_observed_at|schema cache/i.test(error.message || '')) throw error;
}

export async function loadBillingAccount(userId: string): Promise<BillingAccountRow | null> {
  const { data, error } = await supabaseServer
    .from('billing_accounts')
    .select('user_id, stripe_customer_id, stripe_subscription_id, stripe_subscription_item_id, subscription_status, cancel_at_period_end, billing_cycle_anchor, current_period_end, synced_amount_cents, card_brand, card_last4, subscription_event_created, livemode, last_reconciled_at, tool_access_locked, tool_access_reason, tool_access_synced_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    if (missingRelation(error)) return null;
    throw error;
  }
  return data;
}

export async function ensureBillingAccount(userId: string): Promise<void> {
  const inserted = await supabaseServer.from('billing_accounts').insert(stripeMode() === 'live'
    ? {
      user_id: userId,
      livemode: true,
      live_billing_commenced_at: new Date().toISOString(),
      live_billing_excluded_tool_ids: [],
      live_billing_excluded_storage_gb: 0,
    }
    : { user_id: userId });
  if (inserted.error && inserted.error.code !== '23505' && !missingRelation(inserted.error)) throw inserted.error;
}

export async function syncHouseholdToolAccess(userId: string, locked: boolean, reason: string, known?: BillingAccountRow | null): Promise<void> {
  const account = known === undefined ? await loadBillingAccount(userId) : known;
  if (account && Boolean(account.tool_access_locked) === locked && (account.tool_access_reason ?? 'open') === reason) return;
  if (!account) {
    const { error } = await supabaseServer.from('billing_accounts').insert(stripeMode() === 'live'
      ? {
        user_id: userId,
        tool_access_locked: locked,
        tool_access_reason: reason,
        tool_access_synced_at: new Date().toISOString(),
        livemode: true,
        live_billing_commenced_at: new Date().toISOString(),
        live_billing_excluded_tool_ids: [],
        live_billing_excluded_storage_gb: 0,
      }
      : {
        user_id: userId,
        tool_access_locked: locked,
        tool_access_reason: reason,
        tool_access_synced_at: new Date().toISOString(),
        livemode: false,
      });
    if (error && !/tool_access_locked|schema cache/i.test(error.message || '')) throw error;
    return;
  }
  const { error } = await supabaseServer.from('billing_accounts').update({
    tool_access_locked: locked,
    tool_access_reason: reason,
    tool_access_synced_at: new Date().toISOString(),
  }).eq('user_id', userId);
  if (error && !/tool_access_locked|schema cache/i.test(error.message || '')) throw error;
}

export async function saveBillingAccount(userId: string, patch: Partial<Omit<BillingAccountRow, 'user_id'>>): Promise<void> {
  await ensureBillingAccount(userId);
  const { error } = await supabaseServer.from('billing_accounts').update(patch).eq('user_id', userId);
  if (error) throw error;
}

export async function listStoredInvoices(userId: string): Promise<StoredInvoice[]> {
  const { data, error } = await supabaseServer
    .from('billing_invoices')
    .select('period_start, stripe_invoice_id, role, status, amount_cents, amount_paid_cents, replaces_stripe_invoice_id, overcharge, updated_at, collection_state, collection_checked_at, due_at')
    .eq('user_id', userId)
    .eq('livemode', stripeLivemode());
  if (error) {
    if (missingRelation(error)) return [];
    throw error;
  }
  return ((data ?? []) as InvoiceRow[]).map((row) => ({
    periodStart: row.period_start,
    role: row.role,
    status: row.status,
    amountCents: row.amount_cents,
    stripeInvoiceId: row.stripe_invoice_id,
    amountPaidCents: row.amount_paid_cents,
    replacesStripeInvoiceId: row.replaces_stripe_invoice_id,
    overcharge: row.overcharge,
    updatedAt: row.updated_at ?? null,
    collectionState: row.collection_state ?? null,
    collectionCheckedAt: row.collection_checked_at ?? null,
    dueAt: row.due_at ?? null,
  }));
}

export async function upsertStoredInvoice(input: {
  userId: string;
  stripeInvoiceId: string;
  periodStart: string | null;
  role: InvoiceRole;
  status: InvoiceStatus;
  amountCents: number;
  amountPaidCents: number;
  replacesStripeInvoiceId?: string | null;
  overcharge?: boolean;
}): Promise<void> {
  const existing = await supabaseServer
    .from('billing_invoices')
    .select('status, role, overcharge')
    .eq('stripe_invoice_id', input.stripeInvoiceId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  const status = mergeInvoiceStatus((existing.data?.status as InvoiceStatus | undefined) ?? null, input.status);
  const role = (existing.data?.role as InvoiceRole | undefined) ?? input.role;
  const row = {
    user_id: input.userId,
    period_start: input.periodStart,
    stripe_invoice_id: input.stripeInvoiceId,
    role,
    status,
    amount_cents: input.amountCents,
    amount_paid_cents: input.amountPaidCents,
    replaces_stripe_invoice_id: input.replacesStripeInvoiceId ?? null,
    overcharge: Boolean(existing.data?.overcharge) || Boolean(input.overcharge),
    livemode: stripeLivemode(),
    updated_at: new Date().toISOString(),
  };
  const saved = await supabaseServer.from('billing_invoices').upsert(row, { onConflict: 'stripe_invoice_id' });
  if (saved.error) throw saved.error;
}

export type BillingOperation = {
  id: string;
  user_id: string;
  idempotency_key: string;
  kind: string;
  status: 'started' | 'stripe_succeeded' | 'completed' | 'failed';
  stripe_id: string | null;
  payload: Json;
  created_at: string;
};

export async function startBillingOperation(input: {
  userId: string;
  idempotencyKey: string;
  kind: string;
  payload: Json;
}): Promise<BillingOperation> {
  const idempotencyKey = stripeIdempotencyKey(input.idempotencyKey);
  const existing = await supabaseServer
    .from('billing_operations')
    .select('id, user_id, idempotency_key, kind, status, stripe_id, payload, created_at')
    .eq('idempotency_key', idempotencyKey)
    .eq('livemode', stripeLivemode())
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as BillingOperation;
  const inserted = await supabaseServer
    .from('billing_operations')
    .insert({
      user_id: input.userId,
      idempotency_key: idempotencyKey,
      kind: input.kind,
      status: 'started',
      payload: input.payload,
      livemode: stripeLivemode(),
    })
    .select('id, user_id, idempotency_key, kind, status, stripe_id, payload, created_at')
    .single();
  if (inserted.error) {
    if (inserted.error.code === '23505') {
      const raced = await supabaseServer
        .from('billing_operations')
        .select('id, user_id, idempotency_key, kind, status, stripe_id, payload, created_at')
        .eq('idempotency_key', idempotencyKey)
        .eq('livemode', stripeLivemode())
        .single();
      if (raced.error) throw raced.error;
      return raced.data as BillingOperation;
    }
    throw inserted.error;
  }
  return inserted.data as BillingOperation;
}

export async function markOperationStripeSucceeded(id: string, stripeId: string, payload: Json): Promise<void> {
  const { error } = await supabaseServer.from('billing_operations').update({
    status: 'stripe_succeeded',
    stripe_id: stripeId,
    payload,
    last_error: null,
  }).eq('id', id).in('status', ['started', 'stripe_succeeded', 'failed']);
  if (error) throw error;
}

export async function markOperationCompleted(id: string): Promise<void> {
  const { error } = await supabaseServer.from('billing_operations').update({
    status: 'completed',
    last_error: null,
  }).eq('id', id);
  if (error) throw error;
}

export async function markOperationFailed(id: string, message: string): Promise<void> {
  const { error } = await supabaseServer.from('billing_operations').update({
    status: 'failed',
    last_error: message.slice(0, 500),
  }).eq('id', id).eq('status', 'started');
  if (error) throw error;
}

export type PaymentAttention = {
  invoiceId: string;
  collection: 'failed' | 'authentication_required';
  createdAt: string;
};

export async function notePaymentAttention(
  userId: string,
  stripeInvoiceId: string,
  collection: 'failed' | 'authentication_required',
): Promise<void> {
  const operation = await startBillingOperation({
    userId,
    idempotencyKey: `attention:${stripeInvoiceId}`,
    kind: 'payment_attention',
    payload: { invoiceId: stripeInvoiceId, collection },
  });
  const { error } = await supabaseServer.from('billing_operations').update({
    status: 'failed',
    last_error: collection,
    payload: { invoiceId: stripeInvoiceId, collection },
  }).eq('id', operation.id);
  if (error) throw error;
}

export async function clearPaymentAttention(stripeInvoiceId: string): Promise<void> {
  const { error } = await supabaseServer.from('billing_operations').update({
    status: 'completed',
    last_error: null,
  }).eq('idempotency_key', stripeIdempotencyKey(`attention:${stripeInvoiceId}`)).eq('kind', 'payment_attention');
  if (error && !missingRelation(error)) throw error;
}

export async function listPaymentAttention(userId: string): Promise<PaymentAttention[]> {
  const { data, error } = await supabaseServer
    .from('billing_operations')
    .select('payload, created_at')
    .eq('user_id', userId)
    .eq('kind', 'payment_attention')
    .eq('status', 'failed')
    .eq('livemode', stripeLivemode());
  if (error) {
    if (missingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).flatMap((row) => {
    const payload = row.payload as { invoiceId?: string; collection?: string } | null;
    if (!payload?.invoiceId) return [];
    const collection = payload.collection === 'authentication_required' ? 'authentication_required' : 'failed';
    return [{ invoiceId: payload.invoiceId, collection, createdAt: row.created_at as string }];
  });
}

/** Open Checkout rows. An open session is not a processing payment and must not unlock tools. */
export async function listOpenCheckoutSessions(userId: string): Promise<Array<{ stripeSessionId: string; createdAt: string }>> {
  const { data, error } = await supabaseServer
    .from('billing_checkout_sessions')
    .select('stripe_session_id, created_at')
    .eq('user_id', userId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) {
    if (missingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).flatMap((row) => {
    const stripeSessionId = row.stripe_session_id;
    const createdAt = row.created_at;
    if (typeof stripeSessionId !== 'string' || typeof createdAt !== 'string') return [];
    return [{ stripeSessionId, createdAt }];
  });
}

/** Timestamp of the newest open Checkout. This is not a processing payment and does not grant access. */
export async function newestOpenCheckoutAt(userId: string): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from('billing_checkout_sessions')
    .select('created_at')
    .eq('user_id', userId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (missingRelation(error)) return null;
    throw error;
  }
  return data?.created_at ?? null;
}

export async function listOpenOperations(userId?: string): Promise<BillingOperation[]> {
  let query = supabaseServer
    .from('billing_operations')
    .select('id, user_id, idempotency_key, kind, status, stripe_id, payload, created_at')
    .in('status', ['started', 'stripe_succeeded'])
    .eq('livemode', stripeLivemode());
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) {
    if (missingRelation(error)) return [];
    throw error;
  }
  return (data ?? []) as BillingOperation[];
}

export async function listHouseholdAdminIds(): Promise<string[]> {
  const { data, error } = await supabaseServer.from('households').select('admin_user_id');
  if (error) throw error;
  return [...new Set((data ?? []).map((row) => row.admin_user_id).filter(Boolean))];
}

export async function listReconcileCandidates(staleBefore: Date): Promise<string[]> {
  const [admins, accounts, operations] = await Promise.all([
    listHouseholdAdminIds(),
    supabaseServer.from('billing_accounts').select('user_id, last_reconciled_at'),
    listOpenOperations(),
  ]);
  const reconciled = new Map<string, string | null>();
  if (accounts.error) {
    if (!missingRelation(accounts.error)) throw accounts.error;
  } else {
    for (const row of accounts.data ?? []) reconciled.set(row.user_id, row.last_reconciled_at);
  }
  const due = new Set<string>();
  for (const adminId of admins) {
    const at = reconciled.get(adminId);
    if (!at || Date.parse(at) < staleBefore.getTime()) due.add(adminId);
  }
  for (const operation of operations) due.add(operation.user_id);
  return [...due];
}
