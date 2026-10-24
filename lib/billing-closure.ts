import type Stripe from 'stripe';
import {
  applyBillingClosure,
  BillingDeletionPendingError,
  closeOneSubscription,
  closureSubscriptionResult,
  customerToClose,
  DELETION_FINISHING_MESSAGE,
  DELETION_PENDING_MESSAGE,
  emptyLedger,
  mergeArchivedInvoice,
  mergeLedgers,
  stampBeforeDeletionAccount,
  subscriptionIsTerminal,
  syncBlockedByDeletion,
  type ArchivedInvoice,
  type ClosurePhase,
  type ClosureSnapshot,
  type ClosureStripe,
  type DeletionRole,
  type LedgerSnapshot,
  type SubscriptionSnapshot,
} from '@/lib/billing-account-deletion';
import { withBillingLock } from '@/lib/billing-lock';
import { loadBillingAccount, upsertStoredInvoice } from '@/lib/billing-store';
import { stripeConfigured, stripeServer } from '@/lib/stripe-server';
import { supabaseServer } from '@/lib/supabaseServer';

type ClosureRow = {
  id: string;
  former_user_id: string;
  status: ClosurePhase;
  stripe_customer_id: string | null;
  last_error: string | null;
};

function missingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return error.code === '42P01' || error.code === 'PGRST205' || message.includes('does not exist') || message.includes('schema cache');
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function invoiceStatus(status: unknown): ArchivedInvoice['status'] {
  if (status === 'draft' || status === 'open' || status === 'paid' || status === 'void' || status === 'uncollectible') return status;
  return 'open';
}

async function closureByUser(userId: string): Promise<ClosureRow | null> {
  const { data, error } = await supabaseServer
    .from('billing_account_closures')
    .select('id, former_user_id, status, stripe_customer_id, last_error')
    .eq('former_user_id', userId)
    .maybeSingle();
  if (error) {
    if (missingRelation(error)) return null;
    throw error;
  }
  return data as ClosureRow | null;
}

async function closureByCustomer(customerId: string): Promise<ClosureRow | null> {
  const { data, error } = await supabaseServer
    .from('billing_account_closures')
    .select('id, former_user_id, status, stripe_customer_id, last_error')
    .eq('stripe_customer_id', customerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (missingRelation(error)) return null;
    throw error;
  }
  return data as ClosureRow | null;
}

export async function deletionBlocksBilling(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const closure = await closureByUser(userId);
  return syncBlockedByDeletion(closure?.status ?? null);
}

export async function deletionUserForCustomer(customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null;
  const closure = await closureByCustomer(customerId);
  return closure?.former_user_id ?? null;
}

export async function deletionBlocksCustomer(customerId: string | null | undefined): Promise<boolean> {
  if (!customerId) return false;
  const closure = await closureByCustomer(customerId);
  return syncBlockedByDeletion(closure?.status ?? null);
}

async function resolveRole(userId: string): Promise<{ role: DeletionRole; householdCustomerId: string | null }> {
  const ownedHousehold = await supabaseServer.from('households').select('id').eq('admin_user_id', userId).maybeSingle();
  if (ownedHousehold.error) throw ownedHousehold.error;
  if (ownedHousehold.data) return { role: 'admin', householdCustomerId: null };

  const membership = await supabaseServer
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (membership.error) {
    if (missingRelation(membership.error)) return { role: 'admin', householdCustomerId: null };
    throw membership.error;
  }
  if (!membership.data) return { role: 'admin', householdCustomerId: null };

  const household = await supabaseServer
    .from('households')
    .select('admin_user_id')
    .eq('id', membership.data.household_id)
    .maybeSingle();
  if (household.error) throw household.error;
  const adminId = household.data?.admin_user_id;
  if (!adminId || adminId === userId) return { role: 'admin', householdCustomerId: null };
  const adminAccount = await loadBillingAccount(adminId);
  return { role: 'member', householdCustomerId: adminAccount?.stripe_customer_id ?? null };
}

async function readLedger(userId: string): Promise<LedgerSnapshot> {
  const [account, invoices, operations, periods, sessions] = await Promise.all([
    supabaseServer.from('billing_accounts').select('*').eq('user_id', userId).maybeSingle(),
    supabaseServer.from('billing_invoices').select('*').eq('user_id', userId),
    supabaseServer.from('billing_operations').select('*').eq('user_id', userId),
    supabaseServer.from('billing_periods').select('*').eq('user_id', userId),
    supabaseServer.from('billing_checkout_sessions').select('*').eq('user_id', userId),
  ]);
  for (const result of [account, invoices, operations, periods, sessions]) {
    if (result.error && !missingRelation(result.error)) throw result.error;
  }
  return {
    account: account.data ? asRecord(account.data) : null,
    invoices: ((invoices.data ?? []) as unknown[]).map(asRecord),
    operations: ((operations.data ?? []) as unknown[]).map(asRecord),
    periods: ((periods.data ?? []) as unknown[]).map(asRecord),
    checkoutSessions: ((sessions.data ?? []) as unknown[]).map(asRecord),
  };
}

async function archiveFromRows(closureId: string, userId: string): Promise<LedgerSnapshot> {
  const { data, error } = await supabaseServer
    .from('billing_ledger_archive')
    .select('kind, payload')
    .eq('closure_id', closureId);
  if (error) {
    if (missingRelation(error)) return emptyLedger();
    throw error;
  }
  const ledger = emptyLedger();
  for (const row of data ?? []) {
    const payload = asRecord(row.payload);
    if (row.kind === 'account') ledger.account = payload;
    if (row.kind === 'invoice') ledger.invoices.push(payload);
    if (row.kind === 'operation') ledger.operations.push(payload);
    if (row.kind === 'period') ledger.periods.push(payload);
    if (row.kind === 'checkout_session') ledger.checkoutSessions.push(payload);
  }
  if (ledger.account && ledger.account.user_id == null) ledger.account.user_id = userId;
  return ledger;
}

async function readSnapshot(userId: string): Promise<ClosureSnapshot> {
  const closure = await closureByUser(userId);
  if (!closure) return { phase: null, customerId: null, lastError: null, archive: null };
  return {
    phase: closure.status,
    customerId: closure.stripe_customer_id,
    lastError: closure.last_error,
    archive: await archiveFromRows(closure.id, userId),
  };
}

async function persistSnapshot(userId: string, next: ClosureSnapshot): Promise<void> {
  const now = new Date().toISOString();
  const saved = await supabaseServer.from('billing_account_closures').upsert({
    former_user_id: userId,
    status: next.phase ?? 'pending',
    stripe_customer_id: next.customerId,
    last_error: next.lastError,
    livemode: false,
    updated_at: now,
    ...(next.phase === 'billing_closed' ? { billing_closed_at: now } : {}),
    ...(next.phase === 'user_deleted' ? { user_deleted_at: now } : {}),
    ...(next.phase === 'completed' ? { completed_at: now } : {}),
  }, { onConflict: 'former_user_id' }).select('id').single();
  if (saved.error) throw saved.error;
  if (next.phase === 'pending') {
    const marked = await supabaseServer.from('billing_accounts').update({ deletion_status: 'deleting' }).eq('user_id', userId);
    if (marked.error && !missingRelation(marked.error) && !/deletion_status/i.test(marked.error.message || '')) throw marked.error;
  }
  const archive = next.archive ? mergeLedgers(await archiveFromRows(saved.data.id, userId), next.archive) : null;
  if (!archive) return;
  const rows = [
    ...(archive.account ? [{ kind: 'account', source_id: userId, payload: archive.account }] : []),
    ...archive.invoices.map((row) => ({ kind: 'invoice', source_id: String(row.stripe_invoice_id ?? ''), payload: row })),
    ...archive.operations.map((row) => ({ kind: 'operation', source_id: String(row.idempotency_key ?? ''), payload: row })),
    ...archive.periods.map((row) => ({ kind: 'period', source_id: `${userId}:${String(row.period_start ?? '')}`, payload: row })),
    ...archive.checkoutSessions.map((row) => ({ kind: 'checkout_session', source_id: String(row.stripe_session_id ?? ''), payload: row })),
  ].filter((row) => row.source_id);
  if (rows.length === 0) return;
  const upserted = await supabaseServer.from('billing_ledger_archive').upsert(rows.map((row) => ({
    closure_id: saved.data.id,
    former_user_id: userId,
    kind: row.kind,
    source_id: row.source_id,
    payload: row.payload,
    livemode: false,
    updated_at: now,
  })), { onConflict: 'kind,source_id' });
  if (upserted.error) throw upserted.error;
}

async function removeLiveLedger(userId: string): Promise<void> {
  for (const table of ['billing_checkout_sessions', 'billing_operations', 'billing_invoices', 'billing_periods', 'billing_accounts'] as const) {
    const deleted = await supabaseServer.from(table).delete().eq('user_id', userId);
    if (deleted.error && !missingRelation(deleted.error)) throw deleted.error;
  }
}

function scheduleIdOf(subscription: Stripe.Subscription): string | null {
  if (!subscription.schedule) return null;
  return typeof subscription.schedule === 'string' ? subscription.schedule : subscription.schedule.id;
}

function snapshotOf(subscription: Stripe.Subscription): SubscriptionSnapshot {
  return {
    id: subscription.id,
    status: subscription.status,
    scheduleId: scheduleIdOf(subscription),
    canceledAt: typeof subscription.canceled_at === 'number' ? new Date(subscription.canceled_at * 1000).toISOString() : null,
  };
}

function unusedStripe(): ClosureStripe {
  return {
    async listOpenSessions() { return []; },
    async expireSession() { throw new Error('No Checkout session belonged to this account.'); },
    async listSubscriptions() { return []; },
    async retrieveSubscription() { throw new Error('No subscription belonged to this account.'); },
    async cancelSubscription() { throw new Error('No subscription belonged to this account.'); },
    async cancelSchedule() { throw new Error('No subscription schedule belonged to this account.'); },
  };
}

function stripeAdapter(stripe: Stripe = stripeServer()): ClosureStripe {
  return {
    async listOpenSessions(customerId) {
      const ids: string[] = [];
      let startingAfter: string | undefined;
      for (;;) {
        const page = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100, starting_after: startingAfter });
        ids.push(...page.data.map((session) => session.id));
        if (!page.has_more || page.data.length === 0) break;
        startingAfter = page.data[page.data.length - 1]?.id;
      }
      return ids;
    },
    async expireSession(sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status === 'open') await stripe.checkout.sessions.expire(sessionId);
    },
    async listSubscriptions(customerId) {
      const rows: SubscriptionSnapshot[] = [];
      let startingAfter: string | undefined;
      for (;;) {
        const page = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100, starting_after: startingAfter });
        rows.push(...page.data.map(snapshotOf));
        if (!page.has_more || page.data.length === 0) break;
        startingAfter = page.data[page.data.length - 1]?.id;
      }
      return rows;
    },
    async retrieveSubscription(subscriptionId) {
      return snapshotOf(await stripe.subscriptions.retrieve(subscriptionId));
    },
    async cancelSubscription(subscriptionId, params) {
      const current = await stripe.subscriptions.retrieve(subscriptionId);
      if (subscriptionIsTerminal(current.status)) return;
      await stripe.subscriptions.cancel(subscriptionId, params);
    },
    async cancelSchedule(scheduleId, params) {
      await stripe.subscriptionSchedules.cancel(scheduleId, params);
    },
  };
}

export async function prepareBillingClosure(userId: string): Promise<void> {
  const existing = await closureByUser(userId);
  if (existing?.status === 'billing_closed' || existing?.status === 'user_deleted' || existing?.status === 'completed') return;
  try {
    await withBillingLock(userId, async () => {
      const account = await loadBillingAccount(userId);
      const role = await resolveRole(userId);
      const ownedCustomerId = account?.stripe_customer_id ?? null;
      const closingCustomerId = customerToClose({
        role: role.role,
        ownedCustomerId,
        householdCustomerId: role.householdCustomerId,
      });
      if (closingCustomerId && !stripeConfigured()) throw new BillingDeletionPendingError();
      await applyBillingClosure({
        read: () => readSnapshot(userId),
        write: (next) => persistSnapshot(userId, next),
        readLedger: () => readLedger(userId),
        removeLiveLedger: () => removeLiveLedger(userId),
        stripe: closingCustomerId ? stripeAdapter() : unusedStripe(),
        role: role.role,
        ownedCustomerId,
        householdCustomerId: role.householdCustomerId,
      });
    });
  } catch (error) {
    if (error instanceof BillingDeletionPendingError) throw error;
    console.error('Account billing cleanup could not be confirmed');
    throw new BillingDeletionPendingError();
  }
}

export async function markClosureUserDeleted(userId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseServer.from('billing_account_closures').update({
    status: 'user_deleted',
    user_deleted_at: now,
    updated_at: now,
    last_error: null,
  }).eq('former_user_id', userId);
  if (error && !missingRelation(error)) throw error;
}

export async function markClosureCompleted(userId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseServer.from('billing_account_closures').update({
    status: 'completed',
    completed_at: now,
    updated_at: now,
    last_error: null,
  }).eq('former_user_id', userId);
  if (error && !missingRelation(error)) throw error;
}

export async function listUnfinishedClosures(): Promise<Array<{ userId: string; status: ClosurePhase }>> {
  const { data, error } = await supabaseServer
    .from('billing_account_closures')
    .select('former_user_id, status')
    .in('status', ['billing_closed', 'user_deleted'])
    .limit(20);
  if (error) {
    if (missingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({ userId: row.former_user_id, status: row.status as ClosurePhase })).filter((row) => row.userId);
}

export async function deletionStatusForUser(userId: string): Promise<{ pending: boolean; message: string | null }> {
  const closure = await closureByUser(userId);
  if (!closure || closure.status === 'completed') return { pending: false, message: null };
  if (closure.status === 'pending') return { pending: true, message: DELETION_PENDING_MESSAGE };
  return { pending: true, message: DELETION_FINISHING_MESSAGE };
}

function archivedInvoiceFromRow(row: Record<string, unknown>): ArchivedInvoice | null {
  const stripeInvoiceId = typeof row.stripe_invoice_id === 'string' ? row.stripe_invoice_id : '';
  if (!stripeInvoiceId) return null;
  const collection = row.collection_state;
  return {
    stripeInvoiceId,
    status: invoiceStatus(row.status),
    amountCents: typeof row.amount_cents === 'number' ? row.amount_cents : 0,
    amountPaidCents: typeof row.amount_paid_cents === 'number' ? row.amount_paid_cents : 0,
    collectionState: collection === 'processing' || collection === 'authentication_required' || collection === 'failed' || collection === 'overdue' ? collection : null,
  };
}

export async function recordDeletionInvoice(userId: string, invoice: ArchivedInvoice & { periodStart?: string | null; role?: 'setup' | 'renewal' | 'supplemental' | 'replacement' }): Promise<void> {
  const closure = await closureByUser(userId);
  if (!closure) throw new Error('Deletion record is missing.');
  const ledger = await archiveFromRows(closure.id, userId);
  const existing = ledger.invoices.map(archivedInvoiceFromRow).find((row) => row?.stripeInvoiceId === invoice.stripeInvoiceId) ?? null;
  const merged = mergeArchivedInvoice(existing, invoice);
  const payload = {
    stripe_invoice_id: merged.stripeInvoiceId,
    status: merged.status,
    amount_cents: merged.amountCents,
    amount_paid_cents: merged.amountPaidCents,
    collection_state: merged.collectionState,
    period_start: invoice.periodStart ?? null,
    role: invoice.role ?? 'supplemental',
    former_user_id: userId,
  };
  const saved = await supabaseServer.from('billing_ledger_archive').upsert({
    closure_id: closure.id,
    former_user_id: userId,
    kind: 'invoice',
    source_id: merged.stripeInvoiceId,
    payload,
    livemode: false,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'kind,source_id' });
  if (saved.error) throw saved.error;
  if (closure.status === 'user_deleted' || closure.status === 'completed') return;
  const user = await supabaseServer.from('users').select('id').eq('id', userId).maybeSingle();
  if (user.error) throw user.error;
  if (!user.data) return;
  await upsertStoredInvoice({
    userId,
    stripeInvoiceId: merged.stripeInvoiceId,
    periodStart: invoice.periodStart ?? null,
    role: invoice.role ?? 'supplemental',
    status: merged.status,
    amountCents: merged.amountCents,
    amountPaidCents: merged.amountPaidCents,
  });
}

export async function recordVerifiedClosureSubscription(userId: string, subscription: Stripe.Subscription, eventCreated: number | null): Promise<void> {
  if (subscription.livemode) return;
  const closure = await closureByUser(userId);
  if (!closure) return;
  const existing = await supabaseServer
    .from('billing_ledger_archive')
    .select('payload')
    .eq('closure_id', closure.id)
    .eq('kind', 'account')
    .maybeSingle();
  if (existing.error) throw existing.error;
  const account = stampBeforeDeletionAccount(existing.data?.payload ? asRecord(existing.data.payload) : null, [closureSubscriptionResult({
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    canceledAt: typeof subscription.canceled_at === 'number' ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    verifiedAt: new Date().toISOString(),
    eventCreated,
  })]);
  if (!account) return;
  const saved = await supabaseServer.from('billing_ledger_archive').upsert({
    closure_id: closure.id,
    former_user_id: userId,
    kind: 'account',
    source_id: userId,
    payload: account,
    livemode: false,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'kind,source_id' });
  if (saved.error) throw saved.error;
}

export async function suppressRevivedSubscription(subscription: Stripe.Subscription, stripe: Stripe = stripeServer()): Promise<void> {
  if (subscription.livemode || subscriptionIsTerminal(subscription.status)) return;
  await closeOneSubscription(stripeAdapter(stripe), snapshotOf(subscription));
}

export type DeletionCheckoutDeps = {
  stripe?: Stripe;
  recordInvoice?: typeof recordDeletionInvoice;
  eventCreated?: number | null;
};

export async function settleDeletionCheckout(userId: string, session: Stripe.Checkout.Session, deps?: DeletionCheckoutDeps): Promise<void> {
  if (session.livemode) return;
  const stripe = deps?.stripe ?? stripeServer();
  const recordInvoice = deps?.recordInvoice ?? recordDeletionInvoice;
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;
  if (subscriptionId) {
    let subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await suppressRevivedSubscription(subscription, stripe);
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await recordVerifiedClosureSubscription(userId, subscription, deps?.eventCreated ?? null);
  }
  if (session.status === 'open') await stripe.checkout.sessions.expire(session.id);
  const amount = session.amount_total ?? 0;
  const paid = session.payment_status === 'paid';
  const invoiceId = typeof session.invoice === 'string' ? session.invoice : session.invoice?.id
    ?? (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id);
  if (!invoiceId) return;
  await recordInvoice(userId, {
    stripeInvoiceId: invoiceId,
    status: paid ? 'paid' : 'open',
    amountCents: amount,
    amountPaidCents: paid ? amount : 0,
    collectionState: paid ? null : session.payment_status === 'unpaid' ? null : 'processing',
    role: 'supplemental',
  });
}
