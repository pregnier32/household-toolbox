import Stripe from 'stripe';

const SANDBOX_PREFIX = 'sk_test_';

export function sandboxStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  if (!key.startsWith(SANDBOX_PREFIX)) {
    throw new Error('Stripe billing requires a sandbox test secret key.');
  }
  return key;
}

export function stripeServer(): Stripe {
  return new Stripe(sandboxStripeKey());
}

export function stripeConfigured(): boolean {
  return (process.env.STRIPE_SECRET_KEY?.trim() ?? '').startsWith(SANDBOX_PREFIX);
}
