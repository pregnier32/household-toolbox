import Stripe from 'stripe';
import {
  expectedStripeAccountId,
  expectedStripeWebhookId,
  paymentsNotConfiguredMessage,
  STRIPE_WEBHOOK_URL,
  stripeLivemode,
  stripeMode,
  stripeSecretKey,
  webhookEventsMatch,
} from '@/lib/stripe-mode';

export function stripeConfigured(): boolean {
  try {
    stripeSecretKey();
    return true;
  } catch {
    return false;
  }
}

export function stripeServer(): Stripe {
  return new Stripe(stripeSecretKey());
}

export function paymentsConfigurationError(): string {
  return paymentsNotConfiguredMessage();
}

const verifiedKeys = new Set<string>();

function publishableKeyMatches(): void {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';
  if (!key) return;
  const prefix = stripeMode() === 'live' ? 'pk_live_' : 'pk_test_';
  if (!key.startsWith(prefix)) throw new Error('Stripe publishable key does not match the selected mode.');
}

/** Confirms the key, account, and webhook endpoint belong to the selected mode. Does not change Stripe. */
export async function assertConfiguredStripe(): Promise<void> {
  const key = stripeSecretKey();
  publishableKeyMatches();
  if (verifiedKeys.has(key)) return;
  const stripe = stripeServer();
  const account = await stripe.accounts.retrieve(null);
  if (account.id !== expectedStripeAccountId()) throw new Error('Stripe secret key does not belong to the selected account.');
  const endpoint = await stripe.webhookEndpoints.retrieve(expectedStripeWebhookId());
  if (endpoint.url !== STRIPE_WEBHOOK_URL || endpoint.status !== 'enabled' || endpoint.livemode !== stripeLivemode()) {
    throw new Error('Stripe webhook endpoint does not match the selected mode.');
  }
  if (!webhookEventsMatch(endpoint.enabled_events)) throw new Error('Stripe webhook events do not match the selected mode.');
  verifiedKeys.add(key);
}
