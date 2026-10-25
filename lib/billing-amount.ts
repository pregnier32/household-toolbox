import { describeBillingCycle, billingSchedule, paymentWaitsForTrial } from '@/lib/billing-cycle';
import { STORAGE_ADDON_MONTHLY_CENTS } from '@/lib/billing-preview';
import { describeBillingSummary } from '@/lib/billing-summary';
import { loadFrozenPeriod, loadSignupAt, materializeBillingPeriod } from '@/lib/billing-period-store';
import { loadAccountPricingInputs } from '@/lib/load-account-pricing';
import { historicalSummaryForCommencement, projectLiveCharges, sameExcludedPeriod } from '@/lib/billing-commencement';
import { loadLiveCommencement } from '@/lib/billing-environment';
import { loadBillingAccount } from '@/lib/billing-store';
import { stripeMode } from '@/lib/stripe-mode';
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
  historicalOwedCents: number;
  historicalScheduledCents: number;
  excludedToolIds: string[];
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
    historicalOwedCents: 0,
    historicalScheduledCents: 0,
    excludedToolIds: [],
  };
}

/** Test mode returns the priced snapshot. Live mode removes sandbox-era cents from what Checkout can collect. */
export async function loadCollectibleSnapshot(userId: string, now = new Date()): Promise<ChargeSnapshot | null> {
  const snapshot = await loadChargeSnapshot(userId, now);
  if (!snapshot || stripeMode() !== 'live') return snapshot;
  const account = await loadBillingAccount(userId);
  const commencement = await loadLiveCommencement(userId);
  const sandboxHistory = Boolean(account) && account?.livemode !== true && !commencement;
  const commenced = Boolean(commencement);
  const samePeriod = sameExcludedPeriod(snapshot.periodStart, commencement?.excludedPeriodStart ?? null);
  let historicalOwed = sandboxHistory ? snapshot.owedNowCents : 0;
  let historicalScheduled = sandboxHistory ? snapshot.scheduledChargeCents : 0;
  let excludedToolIds: string[] = [];
  if (sandboxHistory) {
    const inputs = await loadAccountPricingInputs([userId]);
    excludedToolIds = inputs.get(userId)?.tools.map((tool) => tool.toolId) ?? [];
  }
  if (commencement && samePeriod) {
    const inputs = await loadAccountPricingInputs([userId]);
    const pricing = inputs.get(userId);
    if (pricing) {
      const historical = historicalSummaryForCommencement(pricing, snapshot.signupAt, now, commencement);
      historicalOwed = historical.owedNowCents;
      historicalScheduled = historical.scheduledChargeCents;
      excludedToolIds = commencement.excludedToolIds;
    }
  }
  const projected = projectLiveCharges({
    mode: 'live',
    sandboxHistory,
    commenced,
    sameExcludedPeriod: samePeriod,
    fullOwedNowCents: snapshot.owedNowCents,
    fullScheduledCents: snapshot.scheduledChargeCents,
    historicalOwedNowCents: historicalOwed,
    historicalScheduledCents: historicalScheduled,
    renewalCents: snapshot.nextAmountCents,
  });
  return {
    ...snapshot,
    owedNowCents: projected.owedNowCents,
    owedAtPeriodStartCents: projected.owedNowCents,
    scheduledChargeCents: projected.scheduledChargeCents,
    scheduledChargeAt: projected.scheduledChargeCents > 0 ? snapshot.scheduledChargeAt : null,
    trialPaymentDeferred: projected.owedNowCents === 0 && snapshot.trialPaymentDeferred,
    historicalOwedCents: commenced || sandboxHistory ? historicalOwed : 0,
    historicalScheduledCents: commenced || sandboxHistory ? historicalScheduled : 0,
    excludedToolIds,
    nextAmountCents: projected.renewalCents,
  };
}
