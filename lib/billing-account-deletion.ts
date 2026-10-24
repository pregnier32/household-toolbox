export const DELETION_PENDING_MESSAGE = 'Account deletion is pending because billing could not be confirmed. Your login is still active. Try again in a moment. A balance already issued remains owed.';

export const DELETION_FINISHING_MESSAGE = 'Account deletion is still finishing. Try again in a moment. A balance already issued remains owed.';

export class BillingDeletionPendingError extends Error {
  readonly pending = true;

  constructor(message = DELETION_PENDING_MESSAGE) {
    super(message);
    this.name = 'BillingDeletionPendingError';
  }
}

export type ClosurePhase = 'pending' | 'billing_closed' | 'user_deleted' | 'completed';

export type DeletionRole = 'admin' | 'member';

const TERMINAL_SUBSCRIPTION_STATUSES = new Set(['canceled', 'cancelled', 'incomplete_expired']);

export function subscriptionIsTerminal(status: string | null | undefined): boolean {
  return TERMINAL_SUBSCRIPTION_STATUSES.has(status ?? '');
}

export function syncBlockedByDeletion(phase: ClosurePhase | null | undefined): boolean {
  return phase != null;
}

export function customerToClose(input: {
  role: DeletionRole;
  ownedCustomerId: string | null;
  householdCustomerId: string | null;
}): string | null {
  if (!input.ownedCustomerId) return null;
  if (input.role === 'member' && input.householdCustomerId && input.ownedCustomerId === input.householdCustomerId) {
    return null;
  }
  return input.ownedCustomerId;
}

export type SubscriptionSnapshot = {
  id: string;
  status: string;
  scheduleId: string | null;
};

export type CancelParams = { invoice_now: false; prorate: false };

export type ClosureStripe = {
  listOpenSessions: (customerId: string) => Promise<string[]>;
  expireSession: (sessionId: string) => Promise<void>;
  listSubscriptions: (customerId: string) => Promise<SubscriptionSnapshot[]>;
  retrieveSubscription: (subscriptionId: string) => Promise<SubscriptionSnapshot>;
  cancelSubscription: (subscriptionId: string, params: CancelParams) => Promise<void>;
  cancelSchedule: (scheduleId: string, params: CancelParams) => Promise<void>;
};

const CANCEL_PARAMS: CancelParams = { invoice_now: false, prorate: false };

function scheduleAlreadyEnded(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('canceled') || message.includes('cancelled') || message.includes('released') || message.includes('completed') || message.includes('no such');
}

export async function closeOneSubscription(stripe: ClosureStripe, subscription: SubscriptionSnapshot): Promise<void> {
  if (subscriptionIsTerminal(subscription.status)) return;
  if (subscription.scheduleId) {
    try {
      await stripe.cancelSchedule(subscription.scheduleId, CANCEL_PARAMS);
    } catch (error) {
      if (!scheduleAlreadyEnded(error)) throw error;
    }
  }
  const current = await stripe.retrieveSubscription(subscription.id);
  if (!subscriptionIsTerminal(current.status)) {
    await stripe.cancelSubscription(subscription.id, CANCEL_PARAMS);
  }
}

export async function closeStripeCustomer(stripe: ClosureStripe, customerId: string): Promise<void> {
  const sessions = await stripe.listOpenSessions(customerId);
  for (const sessionId of sessions) await stripe.expireSession(sessionId);
  const subscriptions = await stripe.listSubscriptions(customerId);
  for (const subscription of subscriptions) await closeOneSubscription(stripe, subscription);
  const remaining = await stripe.listSubscriptions(customerId);
  if (remaining.some((subscription) => !subscriptionIsTerminal(subscription.status))) {
    throw new Error('Subscription cancellation was not confirmed.');
  }
}

export type LedgerSnapshot = {
  account: Record<string, unknown> | null;
  invoices: Array<Record<string, unknown>>;
  operations: Array<Record<string, unknown>>;
  periods: Array<Record<string, unknown>>;
  checkoutSessions: Array<Record<string, unknown>>;
};

export function emptyLedger(): LedgerSnapshot {
  return { account: null, invoices: [], operations: [], periods: [], checkoutSessions: [] };
}

function rowId(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function mergeRows(previous: Array<Record<string, unknown>>, live: Array<Record<string, unknown>>, key: string): Array<Record<string, unknown>> {
  const merged = new Map<string, Record<string, unknown>>();
  for (const row of previous) {
    const id = rowId(row, key);
    if (id) merged.set(id, row);
  }
  for (const row of live) {
    const id = rowId(row, key);
    if (!id) continue;
    merged.set(id, { ...merged.get(id), ...row });
  }
  return [...merged.values()];
}

function asArchivedInvoice(row: Record<string, unknown>): ArchivedInvoice | null {
  const stripeInvoiceId = rowId(row, 'stripe_invoice_id');
  if (!stripeInvoiceId) return null;
  const status = row.status;
  const collection = row.collection_state;
  return {
    stripeInvoiceId,
    status: status === 'draft' || status === 'open' || status === 'paid' || status === 'void' || status === 'uncollectible' ? status : 'open',
    amountCents: typeof row.amount_cents === 'number' ? row.amount_cents : 0,
    amountPaidCents: typeof row.amount_paid_cents === 'number' ? row.amount_paid_cents : 0,
    collectionState: collection === 'processing' || collection === 'authentication_required' || collection === 'failed' || collection === 'overdue' ? collection : null,
  };
}

function mergeInvoiceRecords(previous: Array<Record<string, unknown>>, live: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const merged = new Map<string, Record<string, unknown>>();
  const put = (row: Record<string, unknown>) => {
    const id = rowId(row, 'stripe_invoice_id');
    if (!id) return;
    const prior = merged.get(id);
    if (!prior) {
      merged.set(id, row);
      return;
    }
    const priorInvoice = asArchivedInvoice(prior);
    const nextInvoice = asArchivedInvoice(row);
    if (!priorInvoice || !nextInvoice) {
      merged.set(id, { ...prior, ...row });
      return;
    }
    const result = mergeArchivedInvoice(priorInvoice, nextInvoice);
    merged.set(id, {
      ...prior,
      ...row,
      status: result.status,
      amount_cents: result.amountCents,
      amount_paid_cents: result.amountPaidCents,
      collection_state: result.collectionState,
    });
  };
  previous.forEach(put);
  live.forEach(put);
  return [...merged.values()];
}

export function mergeLedgers(previous: LedgerSnapshot | null, live: LedgerSnapshot): LedgerSnapshot {
  const base = previous ?? emptyLedger();
  return {
    account: live.account ? { ...base.account, ...live.account } : base.account,
    invoices: mergeInvoiceRecords(base.invoices, live.invoices),
    operations: mergeRows(base.operations, live.operations, 'idempotency_key'),
    periods: mergeRows(base.periods, live.periods, 'period_start'),
    checkoutSessions: mergeRows(base.checkoutSessions, live.checkoutSessions, 'stripe_session_id'),
  };
}

export type ClosureSnapshot = {
  phase: ClosurePhase | null;
  customerId: string | null;
  lastError: string | null;
  archive: LedgerSnapshot | null;
};

export async function applyBillingClosure(input: {
  read: () => Promise<ClosureSnapshot>;
  write: (next: ClosureSnapshot) => Promise<void>;
  readLedger: () => Promise<LedgerSnapshot>;
  removeLiveLedger: () => Promise<void>;
  stripe: ClosureStripe;
  role: DeletionRole;
  ownedCustomerId: string | null;
  householdCustomerId: string | null;
}): Promise<ClosureSnapshot> {
  const current = await input.read();
  if (current.phase === 'billing_closed' || current.phase === 'user_deleted' || current.phase === 'completed') {
    return current;
  }
  const customerId = customerToClose({
    role: input.role,
    ownedCustomerId: input.ownedCustomerId,
    householdCustomerId: input.householdCustomerId,
  });
  let archive = current.archive;
  const pending: ClosureSnapshot = { phase: 'pending', customerId, lastError: null, archive };
  await input.write(pending);
  try {
    if (customerId) await closeStripeCustomer(input.stripe, customerId);
    archive = mergeLedgers(archive, await input.readLedger());
    await input.write({ phase: 'pending', customerId, lastError: null, archive });
    await input.removeLiveLedger();
    const closed: ClosureSnapshot = { phase: 'billing_closed', customerId, lastError: null, archive };
    await input.write(closed);
    return closed;
  } catch (error) {
    await input.write({
      phase: 'pending',
      customerId,
      lastError: error instanceof Error ? error.message : 'Billing cleanup failed.',
      archive,
    });
    throw error;
  }
}

export type ArchivedInvoice = {
  stripeInvoiceId: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  amountCents: number;
  amountPaidCents: number;
  collectionState: 'processing' | 'authentication_required' | 'failed' | 'overdue' | null;
};

export function mergeArchivedInvoice(existing: ArchivedInvoice | null, incoming: ArchivedInvoice): ArchivedInvoice {
  if (!existing) return { ...incoming };
  if (incoming.status === 'void' && (existing.status === 'open' || existing.status === 'paid' || existing.status === 'uncollectible')) {
    return existing;
  }
  const status = existing.status === 'paid' || incoming.status === 'paid'
    ? 'paid'
    : existing.status === 'uncollectible' || incoming.status === 'uncollectible'
      ? 'uncollectible'
      : existing.status === 'open' || incoming.status === 'open'
        ? 'open'
        : incoming.status;
  return {
    stripeInvoiceId: existing.stripeInvoiceId,
    status,
    amountCents: Math.max(existing.amountCents, incoming.amountCents),
    amountPaidCents: Math.max(existing.amountPaidCents, incoming.amountPaidCents),
    collectionState: status === 'paid' || status === 'uncollectible' ? null : (incoming.collectionState ?? existing.collectionState),
  };
}

export function recordPaymentOnArchive(existing: ArchivedInvoice[], incoming: ArchivedInvoice): ArchivedInvoice[] {
  const current = existing.find((invoice) => invoice.stripeInvoiceId === incoming.stripeInvoiceId) ?? null;
  const merged = mergeArchivedInvoice(current, incoming);
  const others = existing.filter((invoice) => invoice.stripeInvoiceId !== incoming.stripeInvoiceId);
  return [...others, merged];
}

export type DeletionCheckoutPlan = {
  createSubscription: false;
  cancelSubscriptionId: string | null;
  cancelScheduleId: string | null;
};

export function planDeletionCheckout(input: {
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  scheduleId: string | null;
}): DeletionCheckoutPlan {
  const live = Boolean(input.subscriptionId) && !subscriptionIsTerminal(input.subscriptionStatus);
  return {
    createSubscription: false,
    cancelSubscriptionId: live && !input.scheduleId ? input.subscriptionId : null,
    cancelScheduleId: live && input.scheduleId ? input.scheduleId : null,
  };
}
