/**
 * Account-wide tool access. One unpaid active tool pauses every household tool.
 * Amounts, trials, and anniversaries come from the caller. This module does not
 * price, invoice, or forgive a balance.
 */

import { formatCents } from './account-pricing';
import { billingDateLabel } from './billing-cycle';
import type { InvoiceRole, InvoiceStatus } from './billing-ledger';

export const PAYMENT_PENDING_MS = 15 * 60 * 1000;

export const LOCKED_ADMIN_MESSAGE = 'Tool access is paused because your account needs payment attention. All household tools, including free tools, are temporarily unavailable. Update your payment or remove the tools requiring payment to restore access. Your saved data is safe.';

export const LOCKED_MEMBER_MESSAGE = 'Your household\'s tool access is paused. Ask your household admin to review Plan & Billing.';

export const MEMBER_ATTENTION_MESSAGE = 'Your household may need payment attention soon. Ask your household admin to review Plan & Billing.';

export const LOCK_WARNING_SENTENCE = 'All household tools, including free tools, will lock if payment becomes required and the account is not current.';

export function removalConfirmationMessage(toolName: string): string {
  const name = toolName.trim() || 'this tool';
  return `Remove ${name} and permanently delete its data? This will delete this household's records, documents, and files for this tool. This cannot be undone. Previously issued charges remain owed.`;
}

/** Same typed confirmation the other delete dialogs use. Any capitalization of "delete" is accepted. */
export function isTypedRemovalConfirmation(value: unknown): boolean {
  return typeof value === 'string' && value.toLowerCase() === 'delete';
}

export const TOOL_ACCESS_UNVERIFIED_MESSAGE = 'Unable to verify tool access';

export type ToolAccessReason =
  | 'open'
  | 'trial_warning'
  | 'upcoming_bill'
  | 'setup_required'
  | 'payment_processing'
  | 'payment_failed'
  | 'authentication_required'
  | 'payment_overdue'
  | 'subscription_ended';

export type ToolAccessRecovery = 'setup_payment' | 'review_tools' | 'manage_billing';

export type AccessTool = {
  toolId: string;
  name: string;
  requiresPaymentNow: boolean;
};

export type AccessInvoice = {
  id: string;
  role: InvoiceRole;
  status: InvoiceStatus;
  amountCents: number;
  amountPaidCents: number;
  updatedAt: string | null;
  /**
   * Stored Stripe result. `processing` stays processing with no time limit.
   * Age alone never turns an open invoice into a failure.
   */
  collection?: 'processing' | 'failed' | 'authentication_required' | 'overdue' | null;
};

export type ToolAccessPolicyInput = {
  now: Date;
  tools: AccessTool[];
  invoices: AccessInvoice[];
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  hasSavedPaymentMethod: boolean;
  owedNowCents: number;
  nextAmountCents: number;
  nextBillingAt: string | null;
  /** When the latest checkout was opened. This only covers a checkout that has not produced an invoice. A stored processing payment has no time limit. */
  paymentAttemptAt: string | null;
  trialActive: boolean;
  pendingWindowMs?: number;
  /** Full monthly price added when the next trial ends inside this period. Not the renewal. */
  scheduledChargeCents?: number;
  scheduledChargeAt?: string | null;
};

export type ToolAccessPolicy = {
  locked: boolean;
  pending: boolean;
  reason: ToolAccessReason;
  causingTools: { toolId: string; name: string }[];
  recovery: ToolAccessRecovery[];
  balanceCents: number | null;
  billingDate: string | null;
  adminMessage: string | null;
  memberMessage: string | null;
  warning: string | null;
  debtNotice: string | null;
};

const CURRENT_SUBSCRIPTION = new Set(['active', 'trialing', 'paused']);

function unpaid(invoice: AccessInvoice): number {
  return Math.max(0, invoice.amountCents - Math.max(0, invoice.amountPaidCents));
}

function countsAsToolInvoice(invoice: AccessInvoice): boolean {
  return invoice.role !== 'setup' || invoice.amountCents > 0;
}

function attemptIsFresh(attemptAt: string | null, now: Date, windowMs: number): boolean {
  if (!attemptAt) return false;
  const started = Date.parse(attemptAt);
  if (Number.isNaN(started)) return false;
  const age = now.getTime() - started;
  return age >= 0 && age <= windowMs;
}

type Attention = 'processing' | 'failed' | 'authentication_required' | 'overdue';

function classifyInvoice(invoice: AccessInvoice): Attention | null {
  if (!countsAsToolInvoice(invoice)) return null;
  if (invoice.status === 'draft' || invoice.status === 'void' || invoice.status === 'paid') return null;
  if (invoice.collection === 'authentication_required') return 'authentication_required';
  if (invoice.collection === 'failed') return 'failed';
  if (invoice.collection === 'overdue') return 'overdue';
  if (invoice.status === 'uncollectible') return unpaid(invoice) > 0 ? 'failed' : null;
  if (invoice.collection === 'processing') return 'processing';
  if (invoice.status !== 'open' || unpaid(invoice) <= 0) return null;
  // An open invoice without a Stripe result stays pending. Age does not make it failed.
  return 'processing';
}

function subscriptionEnded(input: ToolAccessPolicyInput): boolean {
  const status = input.subscriptionStatus;
  if (status === 'canceled' || status === 'cancelled' || status === 'incomplete_expired' || status === 'unpaid') return true;
  if (input.cancelAtPeriodEnd && input.currentPeriodEnd) {
    const end = Date.parse(input.currentPeriodEnd);
    if (!Number.isNaN(end) && end <= input.now.getTime()) return true;
  }
  return false;
}

function subscriptionCurrent(input: ToolAccessPolicyInput): boolean {
  if (subscriptionEnded(input)) return false;
  if (input.subscriptionStatus === 'past_due') return false;
  return Boolean(input.subscriptionStatus && CURRENT_SUBSCRIPTION.has(input.subscriptionStatus));
}

function debtCents(invoices: AccessInvoice[]): number {
  return invoices.reduce((sum, invoice) => {
    if (!countsAsToolInvoice(invoice)) return sum;
    if (invoice.status !== 'open' && invoice.status !== 'uncollectible') return sum;
    return sum + unpaid(invoice);
  }, 0);
}

function causeSentence(reason: ToolAccessReason, balance: number | null): string {
  const amount = balance != null && balance > 0 ? formatCents(balance) : null;
  if (reason === 'setup_required') {
    if (amount) return `Payment of ${amount} is required now, and payment setup has not been completed.`;
    return 'Payment setup has not been completed.';
  }
  if (reason === 'payment_failed') {
    return amount ? `A payment of ${amount} did not go through.` : 'A payment did not go through.';
  }
  if (reason === 'payment_overdue') {
    return amount ? `A payment of ${amount} is overdue.` : 'A payment is overdue.';
  }
  if (reason === 'authentication_required') {
    return amount ? `Your bank needs you to confirm a payment of ${amount}.` : 'Your bank needs you to confirm this payment.';
  }
  if (reason === 'subscription_ended') {
    return amount
      ? `Your subscription has ended and ${amount} is still required for active tools.`
      : 'Your subscription has ended and active tools still require paid coverage.';
  }
  return '';
}

function recoveryFor(reason: ToolAccessReason, setupComplete: boolean): ToolAccessRecovery[] {
  if (reason === 'payment_failed' || reason === 'authentication_required' || reason === 'payment_overdue') return ['manage_billing', 'review_tools'];
  if (reason === 'setup_required' || reason === 'subscription_ended') return ['setup_payment', 'review_tools'];
  if (reason === 'trial_warning' || reason === 'upcoming_bill') {
    return setupComplete ? ['review_tools'] : ['setup_payment', 'review_tools'];
  }
  if (reason === 'payment_processing') return ['review_tools'];
  return [];
}

function warningFor(input: ToolAccessPolicyInput): string | null {
  const scheduled = Math.max(0, input.scheduledChargeCents ?? 0);
  if (scheduled > 0 && input.scheduledChargeAt) {
    const trial = `A trial ends ${billingDateLabel(input.scheduledChargeAt)} and adds ${formatCents(scheduled)}. That charge is not the monthly renewal.`;
    const renewal = input.nextAmountCents > 0 && input.nextBillingAt
      ? ` The monthly renewal on ${billingDateLabel(input.nextBillingAt)} is ${formatCents(input.nextAmountCents)}.`
      : '';
    return `${trial}${renewal} ${LOCK_WARNING_SENTENCE}`;
  }
  if (input.nextAmountCents <= 0) return null;
  const amount = formatCents(input.nextAmountCents);
  const when = input.nextBillingAt ? billingDateLabel(input.nextBillingAt) : null;
  const bill = when ? `The estimated next bill is ${amount} on ${when}.` : `The estimated next bill is ${amount}.`;
  return `${bill} ${LOCK_WARNING_SENTENCE}`;
}

function upcomingWarning(input: ToolAccessPolicyInput, subscriptionIsCurrent: boolean): string | null {
  if (input.hasSavedPaymentMethod && subscriptionIsCurrent && input.owedNowCents <= 0) return null;
  if (subscriptionIsCurrent && !input.trialActive) return null;
  return warningFor(input);
}

function debtNoticeFor(cents: number): string | null {
  if (cents <= 0) return null;
  return `An outstanding balance of ${formatCents(cents)} remains. It is still owed.`;
}

export function describeToolAccessPolicy(input: ToolAccessPolicyInput): ToolAccessPolicy {
  const windowMs = input.pendingWindowMs ?? PAYMENT_PENDING_MS;
  const causingTools = input.tools
    .filter((tool) => tool.requiresPaymentNow)
    .map((tool) => ({ toolId: tool.toolId, name: tool.name }));
  const owed = Math.max(0, input.owedNowCents);
  const debt = debtCents(input.invoices);
  const attemptFresh = attemptIsFresh(input.paymentAttemptAt, input.now, windowMs);
  let authentication = false;
  let failed = input.subscriptionStatus === 'past_due';
  let overdue = false;
  let processing = false;
  for (const invoice of input.invoices) {
    const attention = classifyInvoice(invoice);
    if (attention === 'authentication_required') authentication = true;
    else if (attention === 'failed') failed = true;
    else if (attention === 'overdue') overdue = true;
    else if (attention === 'processing') processing = true;
  }
  const ended = subscriptionEnded(input);
  const current = subscriptionCurrent(input);
  const setupComplete = input.hasSavedPaymentMethod || current;
  const knownBalance = debt > 0 ? debt : owed > 0 ? owed : null;

  const base = {
    causingTools,
    balanceCents: knownBalance,
    billingDate: input.nextBillingAt,
  };

  if (causingTools.length === 0) {
    const warning = upcomingWarning(input, current);
    const reason: ToolAccessReason = warning ? (input.trialActive ? 'trial_warning' : 'upcoming_bill') : 'open';
    return {
      ...base,
      locked: false,
      pending: false,
      reason,
      recovery: recoveryFor(reason, setupComplete),
      adminMessage: null,
      memberMessage: null,
      warning,
      debtNotice: debtNoticeFor(debt),
    };
  }

  let reason: ToolAccessReason = 'open';
  if (authentication) reason = 'authentication_required';
  else if (failed) reason = 'payment_failed';
  else if (overdue) reason = 'payment_overdue';
  else if (ended) reason = 'subscription_ended';
  else if (processing || attemptFresh) reason = 'payment_processing';
  else if (owed > 0 && !current) reason = 'setup_required';

  if (reason === 'payment_processing') {
    return {
      ...base,
      locked: false,
      pending: true,
      reason,
      recovery: recoveryFor(reason, setupComplete),
      adminMessage: null,
      memberMessage: null,
      warning: 'A payment is still processing with Stripe. Tool access stays available until Stripe reports the result. A bank payment can take longer than a card payment, and it is not treated as failed on a timer.',
      debtNotice: null,
    };
  }

  if (reason === 'open') {
    const warning = upcomingWarning(input, current);
    const openReason: ToolAccessReason = warning ? (input.trialActive ? 'trial_warning' : 'upcoming_bill') : 'open';
    return {
      ...base,
      locked: false,
      pending: false,
      reason: openReason,
      recovery: recoveryFor(openReason, setupComplete),
      adminMessage: null,
      memberMessage: null,
      warning,
      debtNotice: debtNoticeFor(debt),
    };
  }

  const balance = reason === 'setup_required' ? (owed > 0 ? owed : knownBalance) : knownBalance;
  const cause = causeSentence(reason, balance);
  return {
    ...base,
    locked: true,
    pending: false,
    reason,
    recovery: recoveryFor(reason, setupComplete),
    balanceCents: balance,
    adminMessage: `${LOCKED_ADMIN_MESSAGE} ${cause}`.trim(),
    memberMessage: LOCKED_MEMBER_MESSAGE,
    warning: null,
    debtNotice: null,
  };
}

export function toolAccessBlocked(policy: ToolAccessPolicy, owned: boolean): boolean {
  return owned && policy.locked;
}

export function toolAccessDenial(
  policy: ToolAccessPolicy,
  role: 'admin' | 'user',
): { status: 403; error: string } | null {
  if (!policy.locked) return null;
  return {
    status: 403,
    error: role === 'user' ? LOCKED_MEMBER_MESSAGE : (policy.adminMessage || LOCKED_ADMIN_MESSAGE),
  };
}

export type ToolAccessNotice = {
  locked: boolean;
  unverified: boolean;
  message: string | null;
};

export function unverifiedToolAccessNotice(): ToolAccessNotice {
  return { locked: false, unverified: true, message: TOOL_ACCESS_UNVERIFIED_MESSAGE };
}

export function toolAccessNotice(
  policy: ToolAccessPolicy,
  role: 'admin' | 'user',
): ToolAccessNotice {
  if (policy.locked) {
    return {
      locked: true,
      unverified: false,
      message: role === 'user' ? LOCKED_MEMBER_MESSAGE : policy.adminMessage,
    };
  }
  if (role === 'user') {
    return {
      locked: false,
      unverified: false,
      message: policy.warning || policy.pending ? MEMBER_ATTENTION_MESSAGE : null,
    };
  }
  return { locked: false, unverified: false, message: policy.warning };
}
