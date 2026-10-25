/**
 * Server-side Stripe environment. Unset STRIPE_MODE stays on the sandbox.
 * Live billing is selected only by STRIPE_MODE=live plus a matching live key.
 */

export const STRIPE_ACCOUNTS = {
  test: 'acct_1UTlXZHzRlnuMAFU',
  live: 'acct_1UTwmQHxTNfzNZ6f',
} as const;

export const STRIPE_WEBHOOKS = {
  test: 'we_1UU4orHzRlnuMAFUDpZjMMOO',
  live: 'we_1UUEXLHxTNfzNZ6fm4EvWNpp',
} as const;

export const STRIPE_WEBHOOK_URL = 'https://www.householdtoolbox.com/api/stripe/webhook';

export const STRIPE_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  'customer.updated',
  'customer.subscription.created',
  'customer.subscription.deleted',
  'customer.subscription.updated',
  'invoice.created',
  'invoice.finalized',
  'invoice.marked_uncollectible',
  'invoice.paid',
  'invoice.payment_action_required',
  'invoice.payment_failed',
  'invoice.updated',
  'invoice.voided',
  'payment_intent.canceled',
  'payment_intent.payment_failed',
  'payment_intent.processing',
  'payment_intent.requires_action',
  'payment_intent.succeeded',
  'payment_method.attached',
  'payment_method.detached',
  'payment_method.updated',
] as const;

export type StripeMode = 'test' | 'live';

export function stripeMode(): StripeMode {
  const raw = (process.env.STRIPE_MODE ?? '').trim().toLowerCase();
  if (raw === '' || raw === 'test') return 'test';
  if (raw === 'live') return 'live';
  throw new Error('STRIPE_MODE must be test or live.');
}

export function stripeLivemode(): boolean {
  return stripeMode() === 'live';
}

/** Application-initiated Checkout and invoices. Webhooks, cancellation, and deletion stay available when this is disabled. */
export function stripeChargeCreationEnabled(): boolean {
  const raw = (process.env.STRIPE_CHARGE_CREATION ?? '').trim().toLowerCase();
  if (raw === '' || raw === 'enabled') return true;
  if (raw === 'disabled') return false;
  throw new Error('STRIPE_CHARGE_CREATION must be enabled or disabled.');
}

export const NEW_CHARGES_DISABLED_MESSAGE = 'New charges are disabled. Existing billing remains active.';
export const LIVE_IDENTITY_IN_TEST_MESSAGE = 'This household has live billing records. Test mode will not create a customer or charge.';

export function expectedStripeAccountId(): string {
  return STRIPE_ACCOUNTS[stripeMode()];
}

export function expectedStripeWebhookId(): string {
  return STRIPE_WEBHOOKS[stripeMode()];
}

export function stripeSecretKey(): string {
  if ((process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development') && stripeMode() === 'live') {
    throw new Error('Preview and Vercel development cannot use live Stripe.');
  }
  const mode = stripeMode();
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  const prefix = mode === 'live' ? 'sk_live_' : 'sk_test_';
  if (!key.startsWith(prefix)) {
    throw new Error(mode === 'live'
      ? 'Live Stripe billing requires a live secret key.'
      : 'Stripe billing requires a sandbox test secret key.');
  }
  return key;
}

export function paymentsNotConfiguredMessage(): string {
  return stripeMode() === 'live' ? 'Live payments are not configured.' : 'Sandbox payments are not configured.';
}

/** A Stripe object from the other environment must not be read or written here. */
export function foreignStripeObject(livemode: boolean | null | undefined): boolean {
  return (livemode === true) !== stripeLivemode();
}

export function stripeIdForMode(id: string | null | undefined, recordLivemode: boolean | null | undefined): string | null {
  if (!id || foreignStripeObject(recordLivemode)) return null;
  return id;
}

/** Live operations use a prefixed key so a completed sandbox operation cannot be replayed. */
export function stripeIdempotencyKey(key: string): string {
  if (stripeMode() !== 'live' || key.startsWith('live:')) return key;
  return `live:${key}`;
}

export function webhookDisposition(input: {
  verifiedWithIgnoredSecret: boolean;
  eventLivemode: boolean;
  eventAccount?: string | null;
}): 'process' | 'ignore' {
  if (input.verifiedWithIgnoredSecret) return 'ignore';
  if (foreignStripeObject(input.eventLivemode)) return 'ignore';
  if (input.eventAccount && input.eventAccount !== expectedStripeAccountId()) return 'ignore';
  return 'process';
}

function sameEvents(actual: readonly string[], expected: readonly string[]): boolean {
  const left = [...actual].sort();
  const right = [...expected].sort();
  return left.length === right.length && left.every((event, index) => event === right[index]);
}

export function webhookEventsMatch(events: readonly string[]): boolean {
  const previous = STRIPE_WEBHOOK_EVENTS.filter((event) => event !== 'customer.updated');
  return sameEvents(events, STRIPE_WEBHOOK_EVENTS) || sameEvents(events, previous);
}
