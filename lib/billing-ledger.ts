/**
 * Invoice totals for one anniversary period.
 *
 * Uncollectible invoices stay in the invoiced total so a later reconciliation
 * does not create another charge for the same debt.
 * Void invoices leave the total. A replacement invoice is a separate row and
 * counts on its own. Setup invoices, created when a subscription starts before
 * the anniversary, are not part of the period total.
 */

export const INVOICE_ROLES = ['setup', 'renewal', 'supplemental', 'replacement'] as const;
export const INVOICE_STATUSES = ['draft', 'open', 'paid', 'void', 'uncollectible'] as const;

export type InvoiceRole = (typeof INVOICE_ROLES)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type LedgerInvoice = {
  periodStart: string | null;
  role: InvoiceRole;
  status: InvoiceStatus;
  amountCents: number;
};

const INVOICED_STATUSES = new Set<InvoiceStatus>(['draft', 'open', 'paid', 'uncollectible']);
const PERIOD_ROLES = new Set<InvoiceRole>(['renewal', 'supplemental', 'replacement']);

export function samePeriod(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  return Date.parse(left) === Date.parse(right);
}

export function countsTowardInvoiced(invoice: LedgerInvoice, periodStart: string): boolean {
  if (!PERIOD_ROLES.has(invoice.role)) return false;
  if (!INVOICED_STATUSES.has(invoice.status)) return false;
  return samePeriod(invoice.periodStart, periodStart);
}

export function invoicedCents(invoices: LedgerInvoice[], periodStart: string | null): number {
  if (!periodStart) return 0;
  return invoices.reduce((sum, invoice) => {
    if (!countsTowardInvoiced(invoice, periodStart)) return sum;
    return sum + invoice.amountCents;
  }, 0);
}

/** Amount still unpaid for this period. A paid Checkout or invoice reduces it. It does not go below zero. */
export function remainingDueCents(owedCents: number, invoices: LedgerInvoice[], periodStart: string | null): number {
  return Math.max(0, owedCents - paidCents(invoices, periodStart));
}

export function paidCents(invoices: LedgerInvoice[], periodStart: string | null): number {
  if (!periodStart) return 0;
  return invoices.reduce((sum, invoice) => {
    if (invoice.status !== 'paid') return sum;
    if (!PERIOD_ROLES.has(invoice.role)) return sum;
    if (!samePeriod(invoice.periodStart, periodStart)) return sum;
    return sum + invoice.amountCents;
  }, 0);
}

/** Additional amount that has not been put on an invoice yet. Open and uncollectible invoices are already invoiced. */
export function uninvoicedCents(owedCents: number, invoices: LedgerInvoice[], periodStart: string | null): number {
  return Math.max(0, owedCents - invoicedCents(invoices, periodStart));
}

/**
 * Unpaid balance already on an open invoice for this period.
 * A draft is not collectible yet. Paid, void, and uncollectible invoices
 * are not collected again.
 */
export function outstandingCents(
  invoices: Array<LedgerInvoice & { amountPaidCents?: number }>,
  periodStart: string | null,
): number {
  if (!periodStart) return 0;
  return invoices.reduce((sum, invoice) => {
    if (invoice.status !== 'open') return sum;
    if (!PERIOD_ROLES.has(invoice.role)) return sum;
    if (!samePeriod(invoice.periodStart, periodStart)) return sum;
    const paid = Math.max(0, invoice.amountPaidCents ?? 0);
    return sum + Math.max(0, invoice.amountCents - paid);
  }, 0);
}

const STATUS_RANK: Record<InvoiceStatus, number> = {
  draft: 1,
  open: 2,
  paid: 3,
  void: 4,
  uncollectible: 4,
};

/** A replayed webhook must not move a paid, void, or uncollectible invoice backward. */
export function mergeInvoiceStatus(current: InvoiceStatus | null, incoming: InvoiceStatus): InvoiceStatus {
  if (!current) return incoming;
  if (current === 'void' || current === 'uncollectible') return current;
  if (incoming === 'void' || incoming === 'uncollectible') return incoming;
  return STATUS_RANK[incoming] >= STATUS_RANK[current] ? incoming : current;
}

export type FinalizedRenewalAction = 'record' | 'void-and-replace' | 'review-overcharge';

/**
 * A finalized anniversary invoice is not edited in place.
 * An unpaid invoice that is higher than the period-start amount can be voided
 * and replaced once. An uncollectible invoice is only recorded.
 * A short invoice is left in place; the uninvoiced gap becomes a supplemental.
 */
export function finalizedRenewalAction(input: {
  status: InvoiceStatus;
  amountCents: number;
  amountPaidCents: number;
  owedAtPeriodStartCents: number;
}): FinalizedRenewalAction {
  if (input.status === 'uncollectible' || input.status === 'void' || input.status === 'draft') return 'record';
  if (input.amountCents <= input.owedAtPeriodStartCents) return 'record';
  if (input.amountPaidCents === 0 && input.status === 'open') return 'void-and-replace';
  if (input.amountPaidCents > 0) return 'review-overcharge';
  return 'record';
}

export function renewalDraftMayBeCorrected(input: {
  livemode: boolean;
  status: string | null;
  billingReason: string | null;
  role: string | null;
}): boolean {
  if (input.livemode) return false;
  if (input.status !== 'draft') return false;
  if (input.billingReason !== 'subscription_cycle') return false;
  if (input.role === 'supplemental' || input.role === 'replacement' || input.role === 'setup') return false;
  return true;
}
