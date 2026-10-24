import type { Json } from '@/src/types/supabase';
import { supabaseServer } from '@/lib/supabaseServer';
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
  last_reconciled_at: string | null;
};

export type StoredInvoice = LedgerInvoice & {
  stripeInvoiceId: string;
  amountPaidCents: number;
  replacesStripeInvoiceId: string | null;
  overcharge: boolean;
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
};

function missingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return error.code === '42P01' || error.code === 'PGRST205' || message.includes('does not exist') || message.includes('schema cache');
}

export async function loadBillingAccount(userId: string): Promise<BillingAccountRow | null> {
  const { data, error } = await supabaseServer
    .from('billing_accounts')
    .select('user_id, stripe_customer_id, stripe_subscription_id, stripe_subscription_item_id, subscription_status, cancel_at_period_end, billing_cycle_anchor, current_period_end, synced_amount_cents, card_brand, card_last4, subscription_event_created, last_reconciled_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    if (missingRelation(error)) return null;
    throw error;
  }
  return data;
}

export async function ensureBillingAccount(userId: string): Promise<void> {
  const inserted = await supabaseServer.from('billing_accounts').insert({ user_id: userId });
  if (inserted.error && inserted.error.code !== '23505' && !missingRelation(inserted.error)) throw inserted.error;
}

export async function saveBillingAccount(userId: string, patch: Partial<Omit<BillingAccountRow, 'user_id'>>): Promise<void> {
  await ensureBillingAccount(userId);
  const { error } = await supabaseServer.from('billing_accounts').update(patch).eq('user_id', userId);
  if (error) throw error;
}

export async function listStoredInvoices(userId: string): Promise<StoredInvoice[]> {
  const { data, error } = await supabaseServer
    .from('billing_invoices')
    .select('period_start, stripe_invoice_id, role, status, amount_cents, amount_paid_cents, replaces_stripe_invoice_id, overcharge')
    .eq('user_id', userId);
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
    livemode: false,
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
  const existing = await supabaseServer
    .from('billing_operations')
    .select('id, user_id, idempotency_key, kind, status, stripe_id, payload, created_at')
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as BillingOperation;
  const inserted = await supabaseServer
    .from('billing_operations')
    .insert({
      user_id: input.userId,
      idempotency_key: input.idempotencyKey,
      kind: input.kind,
      status: 'started',
      payload: input.payload,
      livemode: false,
    })
    .select('id, user_id, idempotency_key, kind, status, stripe_id, payload, created_at')
    .single();
  if (inserted.error) {
    if (inserted.error.code === '23505') {
      const raced = await supabaseServer
        .from('billing_operations')
        .select('id, user_id, idempotency_key, kind, status, stripe_id, payload, created_at')
        .eq('idempotency_key', input.idempotencyKey)
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

export async function listOpenOperations(userId?: string): Promise<BillingOperation[]> {
  let query = supabaseServer
    .from('billing_operations')
    .select('id, user_id, idempotency_key, kind, status, stripe_id, payload, created_at')
    .in('status', ['started', 'stripe_succeeded']);
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
