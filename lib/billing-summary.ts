/**
 * One billing summary for the plan page, access policy, Checkout, and
 * reconciliation. The household anchor is the first tool-add timestamp.
 * A tool with no trial or free entitlement is due when it is activated.
 * A trial stays $0 until it ends, then adds its full monthly price inside
 * the current period. That trial-end charge is not the monthly renewal.
 */

import type { AccountPricingInput } from './account-pricing';
import {
  describeBillingCycle,
  periodRecordsToTools,
  priceToolsAt,
  withTrialsEndedBy,
  type BillingCycleSnapshot,
  type PeriodToolRecord,
} from './billing-cycle';

const STORAGE_CENTS_PER_GB = 100;

export type BillingToolTiming = {
  toolId: string;
  name: string;
  trialEndsAt: string | null;
  firstChargeAt: string | null;
  owedNowCents: number;
  inCurrentPeriod: boolean;
};

export type BillingSummary = {
  anchorAt: string;
  periodStart: string | null;
  renewalAt: string;
  renewalCents: number;
  owedNowCents: number;
  scheduledChargeAt: string | null;
  scheduledChargeCents: number;
  tools: BillingToolTiming[];
};

function storageCents(gigabytes: number): number {
  return Math.round(Math.max(0, gigabytes) * STORAGE_CENTS_PER_GB);
}

function extraChargeCents(input: AccountPricingInput, cycle: BillingCycleSnapshot, at: Date): number {
  if (!cycle.schedule.hasStarted) return 0;
  const periodTools = periodRecordsToTools(cycle.periodRecords);
  const periodIds = new Set(periodTools.map((tool) => tool.toolId));
  const extras = input.tools.filter((tool) => !periodIds.has(tool.toolId));
  if (extras.length === 0) return 0;
  const withExtras = priceToolsAt(
    input,
    withTrialsEndedBy([...periodTools, ...extras], at),
    at,
  ).effectiveMonthlyCents;
  const withoutExtras = priceToolsAt(
    input,
    withTrialsEndedBy(periodTools, at),
    at,
  ).effectiveMonthlyCents;
  return Math.max(0, withExtras - withoutExtras);
}

function toolPortion(
  input: AccountPricingInput,
  signupAt: string,
  at: Date,
  frozen: PeriodToolRecord[] | null,
): number {
  const cycle = describeBillingCycle(input, signupAt, at, frozen);
  const period = cycle.schedule.hasStarted ? (cycle.period?.effectiveMonthlyCents ?? 0) : 0;
  return period + extraChargeCents(input, cycle, at);
}

export function describeBillingSummary(
  input: AccountPricingInput,
  signupAt: string,
  now: Date,
  frozen: PeriodToolRecord[] | null,
): BillingSummary {
  const cycle = describeBillingCycle(input, signupAt, now, frozen);
  const storage = storageCents(input.storageAddonGb);
  const owedTools = cycle.schedule.hasStarted
    ? (cycle.period?.effectiveMonthlyCents ?? 0) + extraChargeCents(input, cycle, now)
    : 0;
  const periodIds = new Set(cycle.periodRecords.map((record) => record.toolId));
  const renewalAt = Date.parse(cycle.schedule.nextBillingAt);
  const trialEnds = cycle.current.tools
    .flatMap((tool) => (tool.inTrial && tool.trialEndsAt ? [tool.trialEndsAt] : []))
    .filter((end) => {
      const time = Date.parse(end);
      return time > now.getTime() && time < renewalAt;
    })
    .sort();
  const scheduledAt = trialEnds[0] ?? null;
  const scheduledCents = scheduledAt
    ? Math.max(0, toolPortion(input, signupAt, new Date(scheduledAt), frozen) - owedTools)
    : 0;
  return {
    anchorAt: cycle.schedule.anchor.firstBillingAt,
    periodStart: cycle.schedule.periodStart,
    renewalAt: cycle.schedule.nextBillingAt,
    renewalCents: cycle.next.effectiveMonthlyCents + storage,
    owedNowCents: owedTools + storage,
    scheduledChargeAt: scheduledCents > 0 ? scheduledAt : null,
    scheduledChargeCents: scheduledCents,
    tools: cycle.current.tools.map((tool) => ({
      toolId: tool.toolId,
      name: tool.name,
      trialEndsAt: tool.inTrial ? tool.trialEndsAt : null,
      firstChargeAt: tool.inTrial ? tool.trialEndsAt : tool.expectedMonthlyCents > 0 ? tool.ownedAt : null,
      owedNowCents: tool.inTrial || owedTools === 0 ? 0 : tool.expectedMonthlyCents,
      inCurrentPeriod: periodIds.has(tool.toolId),
    })),
  };
}
