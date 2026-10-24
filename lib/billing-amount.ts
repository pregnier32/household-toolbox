import { describeBillingCycle, billingSchedule, paymentWaitsForTrial } from '@/lib/billing-cycle';
import { STORAGE_ADDON_MONTHLY_CENTS } from '@/lib/billing-preview';
import { describeBillingSummary } from '@/lib/billing-summary';
import { loadFrozenPeriod, loadSignupAt, materializeBillingPeriod } from '@/lib/billing-period-store';
import { loadAccountPricingInputs } from '@/lib/load-account-pricing';
import type { BillingSchedule } from '@/lib/billing-cycle';

export type ChargeSnapshot = {
  signupAt: string;
  schedule: BillingSchedule;
  owedNowCents: number;
  owedAtPeriodStartCents: number;
  nextAmountCents: number;
  periodStart: string | null;
  nextBillingAt: string;
  trialPaymentDeferred: boolean;
  scheduledChargeAt: string | null;
  scheduledChargeCents: number;
};

function storageCents(gigabytes: number): number {
  return Math.round(Math.max(0, gigabytes) * STORAGE_ADDON_MONTHLY_CENTS);
}

export async function loadChargeSnapshot(userId: string, now = new Date()): Promise<ChargeSnapshot | null> {
  const inputs = await loadAccountPricingInputs([userId]);
  const input = inputs.get(userId);
  const signupAt = await loadSignupAt(userId);
  if (!input || !signupAt) return null;
  const schedule = billingSchedule(signupAt, now);
  let frozen = null;
  if (schedule.periodStart) {
    const loaded = await loadFrozenPeriod(userId, schedule.periodStart);
    frozen = loaded.available && !loaded.frozen
      ? await materializeBillingPeriod(input, signupAt, now)
      : loaded.frozen;
  }
  const current = describeBillingCycle(input, signupAt, now, frozen);
  const summary = describeBillingSummary(input, signupAt, now, frozen);
  const atStart = schedule.periodStart
    ? describeBillingCycle(input, signupAt, new Date(schedule.periodStart), frozen)
    : null;
  const storage = storageCents(input.storageAddonGb);
  return {
    signupAt,
    schedule,
    owedNowCents: summary.owedNowCents,
    owedAtPeriodStartCents: atStart?.period ? atStart.period.effectiveMonthlyCents + storage : 0,
    nextAmountCents: summary.renewalCents,
    periodStart: schedule.periodStart,
    nextBillingAt: schedule.nextBillingAt,
    trialPaymentDeferred: paymentWaitsForTrial(current) && summary.owedNowCents === 0,
    scheduledChargeAt: summary.scheduledChargeAt,
    scheduledChargeCents: summary.scheduledChargeCents,
  };
}
