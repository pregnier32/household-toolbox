/**
 * Display details for the card Stripe will use.
 * The subscription default is the method billed for that subscription.
 * The customer invoice-settings default is the fallback when the subscription has none.
 * An unexpanded id is not a card.
 */

export type SavedCard = {
  brand: string;
  last4: string;
};

export type PaymentMethodSource = {
  id?: string | null;
  card?: { brand?: string | null; last4?: string | null } | null;
} | string | null | undefined;

export type PaymentMethodSyncState = 'saved' | 'absent' | 'pending';

export function cardFromPaymentMethod(source: PaymentMethodSource): SavedCard | null {
  if (!source || typeof source === 'string') return null;
  const brand = source.card?.brand?.trim().toLowerCase() ?? '';
  const last4 = source.card?.last4?.trim() ?? '';
  if (!brand || !/^\d{4}$/.test(last4)) return null;
  return { brand, last4 };
}

export function resolveEffectiveCard(input: {
  subscriptionDefault: PaymentMethodSource;
  customerDefault: PaymentMethodSource;
}): SavedCard | null {
  return cardFromPaymentMethod(input.subscriptionDefault) ?? cardFromPaymentMethod(input.customerDefault);
}

export function formatSavedCard(card: SavedCard): string {
  const brand = `${card.brand.charAt(0).toUpperCase()}${card.brand.slice(1)}`;
  return `${brand} ending in ${card.last4}`;
}

export function describePaymentMethod(state: PaymentMethodSyncState, card: SavedCard | null): string {
  if (state === 'saved' && card) return formatSavedCard(card);
  if (state === 'pending') return 'Payment method sync is pending.';
  return 'No payment method is saved.';
}
