/**
 * What Plan & Billing can offer before anyone clicks.
 *
 * Uses the priced current period, the next anniversary amount, the invoice
 * ledger, and the saved billing account. It does not call Stripe.
 */

import { formatCents } from './account-pricing';
import { billingDateLabel } from './billing-cycle';
import { outstandingCents, uninvoicedCents, type LedgerInvoice } from './billing-ledger';

const LIVE_SUBSCRIPTION = new Set(['active', 'past_due', 'unpaid', 'trialing', 'paused']);

export const PAYMENT_STATE_CHANGED = 'These amounts changed after the page loaded. Review the updated billing state before continuing.';

export type PaymentAction = 'none' | 'setup' | 'pay' | 'manage';
export type PaymentRoute = 'none' | 'checkout' | 'portal';

export type PaymentAccount = {
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  hasSavedPaymentMethod: boolean;
};

export type PaymentWorkflowInput = {
  owedNowCents: number;
  nextAmountCents: number;
  nextBillingAt: string | null;
  periodStart: string | null;
  invoices: Array<LedgerInvoice & { amountPaidCents?: number }>;
  account: PaymentAccount | null;
  paymentMethodLabel: string | null;
  paymentMethodStatus?: 'saved' | 'absent' | 'pending';
  /** The priced tools are still in a free trial. A positive next bill can still save a card today. */
  trialPaymentDeferred?: boolean;
  /** Full monthly price added when the next trial ends inside this period. Not the renewal. */
  scheduledChargeCents?: number;
  scheduledChargeAt?: string | null;
  /** Sandbox-era cents excluded from the live charge. Not a live credit. */
  historicalCents?: number;
};

export type PaymentSecondary = {
  action: 'pay' | 'manage';
  route: 'portal';
  collectedTodayCents: number;
  buttonLabel: string;
};

export type PaymentWorkflow = {
  action: PaymentAction;
  route: PaymentRoute;
  collectedTodayCents: number;
  uninvoicedCents: number;
  outstandingInvoiceCents: number;
  nextAmountCents: number;
  nextBillingAt: string | null;
  explanation: string;
  buttonLabel: string | null;
  secondary: PaymentSecondary | null;
};

export type PaymentExpectation = {
  action: PaymentAction;
  collectedTodayCents: number;
  nextAmountCents: number;
  outstandingInvoiceCents: number;
};

function liveSubscription(account: PaymentAccount | null): boolean {
  return Boolean(account?.subscriptionStatus && LIVE_SUBSCRIPTION.has(account.subscriptionStatus));
}

function nextBillText(cents: number, nextBillingAt: string | null): string {
  const amount = formatCents(cents);
  if (!nextBillingAt) return amount;
  return `${amount} on ${billingDateLabel(nextBillingAt)}`;
}

function historicalSentence(input: PaymentWorkflowInput): string {
  return Math.max(0, input.historicalCents ?? 0) > 0 ? ' Previous test balances are not charged.' : '';
}

function futureChargeSentences(input: PaymentWorkflowInput): string {
  const scheduled = Math.max(0, input.scheduledChargeCents ?? 0);
  if (scheduled <= 0) return '';
  const when = input.scheduledChargeAt ? billingDateLabel(input.scheduledChargeAt) : null;
  const trial = when
    ? ` A trial ends ${when} and adds ${formatCents(scheduled)} for this billing period. That charge is not the monthly renewal.`
    : ` A trial-end charge of ${formatCents(scheduled)} is scheduled for this billing period. That charge is not the monthly renewal.`;
  const renewal = input.nextAmountCents > 0 && input.nextBillingAt
    ? ` The monthly renewal on ${billingDateLabel(input.nextBillingAt)} is ${formatCents(input.nextAmountCents)}.`
    : '';
  return `${trial}${renewal}`;
}

function emptyWorkflow(input: PaymentWorkflowInput, uninvoiced: number, outstanding: number, next: number): PaymentWorkflow {
  return {
    action: 'none',
    route: 'none',
    collectedTodayCents: 0,
    uninvoicedCents: uninvoiced,
    outstandingInvoiceCents: outstanding,
    nextAmountCents: next,
    nextBillingAt: input.nextBillingAt,
    explanation: '',
    buttonLabel: null,
    secondary: null,
  };
}

export function describePaymentWorkflow(input: PaymentWorkflowInput): PaymentWorkflow {
  const owed = Math.max(0, input.owedNowCents);
  const next = Math.max(0, input.nextAmountCents);
  const uninvoiced = uninvoicedCents(owed, input.invoices, input.periodStart);
  const outstanding = outstandingCents(input.invoices, input.periodStart);
  const account = input.account;
  const live = liveSubscription(account);
  const customer = Boolean(account?.stripeCustomerId);
  const saved = Boolean(account?.hasSavedPaymentMethod && customer);
  const base = emptyWorkflow(input, uninvoiced, outstanding, next);
  const nextText = nextBillText(next, input.nextBillingAt);

  if (live) {
    const methodLine = input.paymentMethodStatus === 'pending'
      ? 'Payment method sync is pending.'
      : input.paymentMethodLabel
        ? `Payment method: ${input.paymentMethodLabel}.`
        : 'No payment method is saved.';
    let explanation = `${methodLine} Subscription status: ${account?.subscriptionStatus || 'active'}.`;
    if (outstanding > 0) {
      explanation = `An open invoice of ${formatCents(outstanding)} is ready. Manage billing to pay ${formatCents(outstanding)} today. This does not start another subscription.`;
      if (uninvoiced > 0) {
        explanation += ` ${formatCents(uninvoiced)} is not on an invoice yet. It is billed on the existing subscription and is not charged again here.`;
      }
    } else if (uninvoiced > 0) {
      explanation += ` ${formatCents(uninvoiced)} is not on an invoice yet. It is billed on the existing subscription and is not charged again here.`;
    } else if (owed === 0 && next === 0) {
      explanation += ' No payment is due on the current plan.';
    }
    return {
      ...base,
      action: 'manage',
      route: 'portal',
      collectedTodayCents: outstanding,
      explanation,
      buttonLabel: 'Manage billing',
    };
  }

  if (uninvoiced > 0) {
    let explanation = `Setting up payment collects ${formatCents(uninvoiced)} today.${historicalSentence(input)}`;
    if (outstanding > 0) {
      explanation += ` An open invoice of ${formatCents(outstanding)} is not included and will not be charged again.`;
    }
    const scheduledText = futureChargeSentences(input);
    if (scheduledText) explanation += scheduledText;
    else if (next > 0) {
      explanation += ` No other charge is added for the estimated next bill of ${nextText}.`;
    }
    const secondary: PaymentSecondary | null = outstanding > 0 && customer
      ? {
        action: 'pay',
        route: 'portal',
        collectedTodayCents: outstanding,
        buttonLabel: `Pay ${formatCents(outstanding)} invoice`,
      }
      : saved
        ? { action: 'manage', route: 'portal', collectedTodayCents: 0, buttonLabel: 'Manage billing' }
        : null;
    return {
      ...base,
      action: 'pay',
      route: 'checkout',
      collectedTodayCents: uninvoiced,
      explanation,
      buttonLabel: `Pay ${formatCents(uninvoiced)}`,
      secondary,
    };
  }

  if (outstanding > 0 && customer) {
    return {
      ...base,
      action: saved ? 'manage' : 'pay',
      route: 'portal',
      collectedTodayCents: outstanding,
      explanation: `An open invoice of ${formatCents(outstanding)} is ready. Paying it collects ${formatCents(outstanding)} today and does not create another charge.`,
      buttonLabel: saved ? 'Manage billing' : `Pay ${formatCents(outstanding)}`,
    };
  }

  if (next > 0) {
    const invoiceNote = outstanding > 0
      ? ` An open invoice of ${formatCents(outstanding)} is not charged again.`
      : '';
    const trialNote = input.trialPaymentDeferred && owed === 0 && outstanding === 0
      ? ' The free trial is still running, so nothing is due today.'
      : '';
    const scheduledText = futureChargeSentences(input);
    const explanation = scheduledText
      ? `No payment is collected today.${scheduledText}${trialNote}${invoiceNote}${historicalSentence(input)}`
      : `No payment is collected today. The estimated next bill is ${nextText}.${trialNote}${invoiceNote}${historicalSentence(input)}`;
    return {
      ...base,
      action: 'setup',
      route: 'checkout',
      collectedTodayCents: 0,
      explanation,
      buttonLabel: 'Add Payment Method',
      secondary: saved
        ? { action: 'manage', route: 'portal', collectedTodayCents: 0, buttonLabel: 'Manage billing' }
        : null,
    };
  }

  if (outstanding > 0) {
    return {
      ...base,
      explanation: `An open invoice of ${formatCents(outstanding)} is already recorded and will not be charged again.`,
    };
  }

  if (saved) {
    const method = input.paymentMethodLabel || 'saved';
    return {
      ...base,
      action: 'manage',
      route: 'portal',
      explanation: `Payment method: ${method}. No payment is due on the current plan.`,
      buttonLabel: 'Manage billing',
    };
  }

  if (owed === 0 && outstanding === 0) {
    return {
      ...base,
      explanation: 'No payment method needed on your current plan.',
    };
  }

  return {
    ...base,
    explanation: 'No payment is due right now.',
  };
}

export function matchedPaymentRoute(workflow: PaymentWorkflow, expected: PaymentExpectation): PaymentRoute | null {
  const amountsMatch = workflow.nextAmountCents === expected.nextAmountCents
    && workflow.outstandingInvoiceCents === expected.outstandingInvoiceCents;
  if (!amountsMatch) return null;
  if (workflow.action === expected.action && workflow.collectedTodayCents === expected.collectedTodayCents) {
    return workflow.route === 'none' ? null : workflow.route;
  }
  if (
    workflow.secondary
    && workflow.secondary.action === expected.action
    && workflow.secondary.collectedTodayCents === expected.collectedTodayCents
  ) {
    return 'portal';
  }
  return null;
}

function isCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100_000_000;
}

export function parsePaymentExpectation(value: unknown): PaymentExpectation | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const action = record.action;
  if (action !== 'setup' && action !== 'pay' && action !== 'manage') return null;
  if (!isCents(record.collectedTodayCents) || !isCents(record.nextAmountCents) || !isCents(record.outstandingInvoiceCents)) return null;
  return {
    action,
    collectedTodayCents: record.collectedTodayCents,
    nextAmountCents: record.nextAmountCents,
    outstandingInvoiceCents: record.outstandingInvoiceCents,
  };
}
