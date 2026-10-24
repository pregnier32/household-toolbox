/**
 * A one-time Checkout payment collects the current-period gap before the
 * subscription exists. The invoice is the ledger row when Stripe created one.
 * A succeeded PaymentIntent is recorded only when that invoice is absent, and
 * a later invoice for the same intent replaces it.
 */

export type CheckoutSettlementInput = {
  livemode: boolean;
  mode: string | null;
  paymentStatus: string | null;
  amountCents: number;
  invoiceId: string | null;
  paymentIntentId: string | null;
  periodStart: string | null;
  recordedIds: string[];
};

export type CheckoutSettlement =
  | { action: 'ignore' }
  | { action: 'record-invoice'; invoiceId: string }
  | { action: 'record-payment'; paymentIntentId: string; amountCents: number; periodStart: string | null };

export function describeCheckoutSettlement(input: CheckoutSettlementInput): CheckoutSettlement {
  if (input.livemode || input.mode !== 'payment') return { action: 'ignore' };
  if (input.paymentStatus !== 'paid' || input.amountCents <= 0) return { action: 'ignore' };
  if (input.invoiceId) return { action: 'record-invoice', invoiceId: input.invoiceId };
  if (!input.paymentIntentId || input.recordedIds.includes(input.paymentIntentId)) return { action: 'ignore' };
  return {
    action: 'record-payment',
    paymentIntentId: input.paymentIntentId,
    amountCents: input.amountCents,
    periodStart: input.periodStart,
  };
}

/** PaymentIntent ids already stored as stand-ins are removed once their invoice arrives. */
export function supersededCheckoutPaymentIds(invoiceId: string, paymentIntentIds: string[]): string[] {
  return [...new Set(paymentIntentIds.filter((id) => id && id !== invoiceId))];
}
