/**
 * Live charges start at a household's commencement boundary.
 * Tool history and the billing anchor stay. Sandbox-era amounts in the
 * current anniversary period are not live debt and are not live credit.
 */

import type { AccountPricingInput } from './account-pricing';
import { describeBillingSummary } from './billing-summary';

export type LiveCommencement = {
  commencedAt: string;
  excludedPeriodStart: string | null;
  excludedToolIds: string[];
  excludedStorageGb: number;
};

export type LiveChargeProjection = {
  owedNowCents: number;
  scheduledChargeCents: number;
  renewalCents: number;
  historicalCents: number;
};

export function projectLiveCharges(input: {
  mode: 'test' | 'live';
  sandboxHistory: boolean;
  commenced: boolean;
  sameExcludedPeriod: boolean;
  fullOwedNowCents: number;
  fullScheduledCents: number;
  historicalOwedNowCents: number;
  historicalScheduledCents: number;
  renewalCents: number;
}): LiveChargeProjection {
  const renewalCents = Math.max(0, input.renewalCents);
  if (input.mode !== 'live' || (!input.sandboxHistory && !input.commenced)) {
    return {
      owedNowCents: Math.max(0, input.fullOwedNowCents),
      scheduledChargeCents: Math.max(0, input.fullScheduledCents),
      renewalCents,
      historicalCents: 0,
    };
  }
  if (!input.commenced || input.sameExcludedPeriod) {
    const owedNowCents = input.commenced
      ? Math.max(0, input.fullOwedNowCents - input.historicalOwedNowCents)
      : 0;
    const scheduledChargeCents = input.commenced
      ? Math.max(0, input.fullScheduledCents - input.historicalScheduledCents)
      : 0;
    const historicalCents = input.commenced
      ? Math.max(0, input.historicalOwedNowCents) + Math.max(0, input.historicalScheduledCents)
      : Math.max(0, input.fullOwedNowCents) + Math.max(0, input.fullScheduledCents);
    return { owedNowCents, scheduledChargeCents, renewalCents, historicalCents };
  }
  return {
    owedNowCents: Math.max(0, input.fullOwedNowCents),
    scheduledChargeCents: Math.max(0, input.fullScheduledCents),
    renewalCents,
    historicalCents: 0,
  };
}

export function historicalSummaryForCommencement(
  pricing: AccountPricingInput,
  signupAt: string,
  now: Date,
  commencement: LiveCommencement,
): { owedNowCents: number; scheduledChargeCents: number } {
  const excluded = new Set(commencement.excludedToolIds);
  const historical = describeBillingSummary({
    ...pricing,
    tools: pricing.tools.filter((tool) => excluded.has(tool.toolId)),
    storageAddonGb: commencement.excludedStorageGb,
  }, signupAt, now, null);
  return {
    owedNowCents: historical.owedNowCents,
    scheduledChargeCents: historical.scheduledChargeCents,
  };
}

export function sameExcludedPeriod(periodStart: string | null, excludedPeriodStart: string | null): boolean {
  return Boolean(periodStart && excludedPeriodStart && periodStart === excludedPeriodStart);
}
