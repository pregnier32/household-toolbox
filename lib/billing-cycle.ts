/**
 * Anniversary billing periods around the Phase 8 pricing engine.
 * The anchor is the moment the first tool was added. Nothing here
 * charges a card, prorates, or writes a simulated clock.
 */

import {
  calculateAccountPricing,
  trialEndsAt,
  type AccountPricingInput,
  type AccountPricingState,
  type PricingAssignmentInput,
  type PricingToolInput,
  type ToolPricingResult,
} from './account-pricing';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type BillingAnchor = {
  signupAt: string;
  firstBillingAt: string;
  anniversaryDay: number;
};

export type BillingSchedule = {
  anchor: BillingAnchor;
  hasStarted: boolean;
  previousBillingAt: string | null;
  nextBillingAt: string;
  periodStart: string | null;
  periodEnd: string | null;
};

export type PeriodToolRecord = {
  toolId: string;
  name: string;
  shelfPriceCents: number;
  catalogPriceCents: number;
  ownedAt: string;
  trialStartedAt: string | null;
  trialUsed: boolean;
  scheduledRemoval: boolean;
};

export type BillingCycleSnapshot = {
  schedule: BillingSchedule;
  current: AccountPricingState;
  period: AccountPricingState | null;
  next: AccountPricingState;
  periodRecords: PeriodToolRecord[];
};

/** The first tool-add instant is the first billing date. No extra days are added. */
export function deriveBillingAnchor(firstToolAt: string): BillingAnchor {
  const first = new Date(firstToolAt);
  if (Number.isNaN(first.getTime())) throw new Error('The first tool date is not a valid timestamp.');
  return {
    signupAt: first.toISOString(),
    firstBillingAt: first.toISOString(),
    anniversaryDay: first.getUTCDate(),
  };
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Anniversary instant for a UTC calendar month. Day 29–31 falls back to the month's last day. */
export function anniversaryInstant(anchor: BillingAnchor, year: number, monthIndex: number): Date {
  const first = new Date(anchor.firstBillingAt);
  const day = Math.min(anchor.anniversaryDay, daysInMonth(year, monthIndex));
  return new Date(Date.UTC(
    year,
    monthIndex,
    day,
    first.getUTCHours(),
    first.getUTCMinutes(),
    first.getUTCSeconds(),
    first.getUTCMilliseconds(),
  ));
}

export function billingSchedule(signupAt: string, effectiveAt: Date): BillingSchedule {
  const anchor = deriveBillingAnchor(signupAt);
  const first = new Date(anchor.firstBillingAt);
  if (effectiveAt.getTime() < first.getTime()) {
    return {
      anchor,
      hasStarted: false,
      previousBillingAt: null,
      nextBillingAt: anchor.firstBillingAt,
      periodStart: null,
      periodEnd: null,
    };
  }

  let year = first.getUTCFullYear();
  let month = first.getUTCMonth();
  let previous = first;
  for (let guard = 0; guard < 2400; guard += 1) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const next = anniversaryInstant(anchor, nextYear, nextMonth);
    if (next.getTime() > effectiveAt.getTime()) {
      return {
        anchor,
        hasStarted: true,
        previousBillingAt: previous.toISOString(),
        nextBillingAt: next.toISOString(),
        periodStart: previous.toISOString(),
        periodEnd: next.toISOString(),
      };
    }
    previous = next;
    year = nextYear;
    month = nextMonth;
  }
  throw new Error('Billing anniversary could not be resolved.');
}

export function billingDateLabel(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return iso;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export function shortBillingDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return iso;
  return `${MONTHS[month - 1].slice(0, 3)} ${day}`;
}

export function dayBeforeLabel(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return billingDateLabel(date.toISOString());
}

export function billingHeading(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return 'ESTIMATED BILL';
  return `${MONTHS[month - 1].toUpperCase()} ${day} ESTIMATED BILL`;
}

export function assignmentsAsOf(assignments: PricingAssignmentInput[], at: Date): PricingAssignmentInput[] {
  const time = at.getTime();
  return assignments.map((assignment) => {
    if (!assignment.removedAt) return assignment;
    const removed = Date.parse(assignment.removedAt);
    if (!Number.isNaN(removed) && removed > time) return { ...assignment, removedAt: null };
    return assignment;
  });
}

export function toolsOwnedBy(tools: PricingToolInput[], at: Date): PricingToolInput[] {
  const time = at.getTime();
  return tools.filter((tool) => {
    const owned = Date.parse(tool.ownedAt);
    return !Number.isNaN(owned) && owned <= time;
  });
}

export function toPeriodRecord(tool: PricingToolInput, scheduledRemoval = false): PeriodToolRecord {
  return {
    toolId: tool.toolId,
    name: tool.name,
    shelfPriceCents: tool.shelfPriceCents,
    catalogPriceCents: tool.catalogPriceCents ?? tool.shelfPriceCents,
    ownedAt: tool.ownedAt,
    trialStartedAt: tool.trialStartedAt,
    trialUsed: tool.trialUsed,
    scheduledRemoval,
  };
}

export function periodRecordsToTools(records: PeriodToolRecord[]): PricingToolInput[] {
  return records.map((record) => ({
    toolId: record.toolId,
    name: record.name,
    shelfPriceCents: record.shelfPriceCents,
    catalogPriceCents: record.catalogPriceCents,
    ownedAt: record.ownedAt,
    trialStartedAt: record.trialStartedAt,
    trialUsed: record.trialUsed,
  }));
}

export function priceToolsAt(input: AccountPricingInput, tools: PricingToolInput[], at: Date): AccountPricingState {
  return calculateAccountPricing({
    ...input,
    tools,
    assignments: assignmentsAsOf(input.assignments, at),
  }, at);
}

/**
 * A tool that is still in its 7-day trial on the billing date is free only
 * until that trial ends. After the trial, it is priced with the period that
 * already started. Promotions stay as of the billing date.
 */
export function withTrialsEndedBy(tools: PricingToolInput[], at: Date): PricingToolInput[] {
  const time = at.getTime();
  return tools.map((tool) => {
    if (!tool.trialUsed || !tool.trialStartedAt) return tool;
    const end = Date.parse(trialEndsAt(tool.trialStartedAt));
    if (Number.isNaN(end) || end > time) return tool;
    return { ...tool, trialUsed: false };
  });
}

export function isPaidCommitment(tool: ToolPricingResult): boolean {
  return tool.expectedMonthlyCents > 0;
}

export function describeBillingCycle(
  input: AccountPricingInput,
  signupAt: string,
  effectiveAt: Date,
  frozen: PeriodToolRecord[] | null,
): BillingCycleSnapshot {
  const schedule = billingSchedule(signupAt, effectiveAt);
  const current = calculateAccountPricing(input, effectiveAt);
  const periodRecords = !schedule.periodStart
    ? []
    : frozen ?? toolsOwnedBy(input.tools, new Date(schedule.periodStart)).map((tool) => toPeriodRecord(tool));
  const period = schedule.periodStart
    ? priceToolsAt(
      input,
      withTrialsEndedBy(periodRecordsToTools(periodRecords), effectiveAt),
      new Date(schedule.periodStart),
    )
    : null;
  const removed = new Set(periodRecords.filter((record) => record.scheduledRemoval).map((record) => record.toolId));
  const nextAt = new Date(schedule.nextBillingAt);
  const nextTools = toolsOwnedBy(input.tools, nextAt).filter((tool) => !removed.has(tool.toolId));
  const next = priceToolsAt(input, nextTools, nextAt);
  return { schedule, current, period, next, periodRecords };
}

export function trialStatusNote(daysRemaining: number | null, trialEndsAt: string | null): string {
  const left = daysRemaining == null
    ? 'Free Trial'
    : daysRemaining === 1
      ? 'Free Trial — 1 day left'
      : `Free Trial — ${daysRemaining} days left`;
  return trialEndsAt ? `${left} · Ends ${shortBillingDate(trialEndsAt)}` : left;
}

export function scheduledRemovalNote(nextBillingAt: string): string {
  return `Scheduled for removal · Billing ends ${billingDateLabel(nextBillingAt)}`;
}

export function paidRemovalMessage(toolName: string, nextBillingAt: string): string {
  return `${toolName} is included in your billing period through ${dayBeforeLabel(nextBillingAt)}. Removing it now stops it from being included in your ${billingDateLabel(nextBillingAt)} billing cycle. Your current billing-period charge will not be prorated or refunded.`;
}

export type ToolRemovalPlan =
  | { kind: 'uncommitted'; dropToolId: string | null; tools: PeriodToolRecord[] }
  | { kind: 'schedule'; tools: PeriodToolRecord[] };

/**
 * A paid commitment is judged from ownership at the period start, not from a
 * snapshot that might be missing. Snapshot rows are then updated by tool id.
 */
export function planToolRemoval(
  input: AccountPricingInput,
  signupAt: string,
  effectiveAt: Date,
  toolId: string,
  frozen: PeriodToolRecord[] | null,
  options?: { dropUninvoicedCharge?: boolean },
): ToolRemovalPlan {
  const judged = describeBillingCycle(input, signupAt, effectiveAt, null);
  const priced = judged.period?.tools.find((tool) => tool.toolId === toolId);
  if (!priced || !isPaidCommitment(priced) || options?.dropUninvoicedCharge) {
    const base = frozen ?? [];
    return {
      kind: 'uncommitted',
      dropToolId: base.some((record) => record.toolId === toolId) ? toolId : null,
      tools: base.filter((record) => record.toolId !== toolId),
    };
  }
  const base = frozen ?? judged.periodRecords;
  const current = base.find((record) => record.toolId === toolId)
    ?? judged.periodRecords.find((record) => record.toolId === toolId);
  const rest = base.filter((record) => record.toolId !== toolId);
  if (!current) return { kind: 'schedule', tools: rest };
  return { kind: 'schedule', tools: [...rest, { ...current, scheduledRemoval: true }] };
}

/**
 * A positive next bill does not need a payment method yet when every tool
 * on that bill is still inside its free trial and the open period is $0.
 */
export function paymentWaitsForTrial(cycle: BillingCycleSnapshot): boolean {
  const dueNow = cycle.schedule.hasStarted ? (cycle.period?.effectiveMonthlyCents ?? 0) : 0;
  if (dueNow > 0) return false;
  const current = new Map(cycle.current.tools.map((tool) => [tool.toolId, tool]));
  const upcoming = cycle.next.tools.filter((tool) => tool.expectedMonthlyCents > 0);
  if (upcoming.length === 0) return false;
  return upcoming.every((tool) => current.get(tool.toolId)?.inTrial === true);
}

const LIVE_SUBSCRIPTION = new Set(['active', 'past_due', 'unpaid', 'trialing', 'paused']);

/**
 * A subscription whose first charge is still in the future already covers that
 * upcoming date. Do not create another invoice for a period that starts earlier.
 */
export function skipSupplementalBeforeSubscriptionAnchor(input: {
  subscriptionStatus: string | null;
  billingCycleAnchor: string | null;
  periodStart: string;
  now: Date;
}): boolean {
  if (!input.subscriptionStatus || !LIVE_SUBSCRIPTION.has(input.subscriptionStatus)) return false;
  if (!input.billingCycleAnchor) return false;
  const anchor = Date.parse(input.billingCycleAnchor);
  const start = Date.parse(input.periodStart);
  if (Number.isNaN(anchor) || Number.isNaN(start)) return false;
  return anchor > input.now.getTime() && start < anchor;
}

/**
 * A future anchor blocks a supplemental only when it falls before the next
 * monthly anniversary. An anchor on that anniversary is the renewal, so a
 * charge that is already due (a tool with no trial, or a trial that ended)
 * is still invoiced once. A $0-to-paid subscription whose first charge is
 * earlier than the anniversary is left alone.
 */
export function supplementalInvoiceBlocked(input: {
  subscriptionStatus: string | null;
  billingCycleAnchor: string | null;
  periodStart: string;
  nextBillingAt: string | null;
  now: Date;
}): boolean {
  if (!skipSupplementalBeforeSubscriptionAnchor(input)) return false;
  if (!input.nextBillingAt || !input.billingCycleAnchor) return true;
  const anchor = Date.parse(input.billingCycleAnchor);
  const renewal = Date.parse(input.nextBillingAt);
  if (Number.isNaN(anchor) || Number.isNaN(renewal)) return true;
  return anchor + 1000 < renewal;
}

export function removalNoticeForTool(
  input: AccountPricingInput,
  signupAt: string,
  effectiveAt: Date,
  toolId: string,
  frozen: PeriodToolRecord[] | null,
  options?: { dropUninvoicedCharge?: boolean },
): string | null {
  if (options?.dropUninvoicedCharge) return null;
  const cycle = describeBillingCycle(input, signupAt, effectiveAt, frozen);
  if (!cycle.period || !cycle.schedule.nextBillingAt) return null;
  const priced = cycle.period.tools.find((tool) => tool.toolId === toolId);
  if (!priced || !isPaidCommitment(priced)) return null;
  return paidRemovalMessage(priced.name, cycle.schedule.nextBillingAt);
}
