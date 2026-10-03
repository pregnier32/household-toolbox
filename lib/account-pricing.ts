/**
 * Household Toolbox expected account state.
 *
 * Pure function. Callers pass the clock. Nothing here reads Stripe or the database.
 * Trial length matches the existing one-time trial: 7 days from trial_started_at.
 */

export const TRIAL_LENGTH_MS = 7 * 24 * 60 * 60 * 1000;
export const STORAGE_FREE_BYTES = 200 * 1024 * 1024;
export const STORAGE_PAID_BYTES = 1024 * 1024 * 1024;
export const STORAGE_ADDON_BYTES = 1024 * 1024 * 1024;

export type BenefitType =
  | 'free_tool_slots'
  | 'specific_tools'
  | 'percent_100'
  | 'percentage'
  | 'fixed_amount'
  | 'bonus_storage';

export type SlotMode = 'additional' | 'total';

export type PricingToolInput = {
  toolId: string;
  name: string;
  shelfPriceCents: number;
  ownedAt: string;
  trialStartedAt: string | null;
  trialUsed: boolean;
};

export type PricingAssignmentInput = {
  id: string;
  benefitType: BenefitType;
  slotMode: SlotMode | null;
  slotCount: number | null;
  percentOff: number | null;
  amountCents: number | null;
  bonusStorageBytes: number | null;
  effectiveAt: string;
  expiresAt: string | null;
  removedAt: string | null;
  displayName: string;
  publicCode: string | null;
  customerDescription: string;
  source: string;
  toolIds: string[];
};

export type AccountPricingInput = {
  userId: string;
  accountType: 'personal' | 'business';
  isTestAccount: boolean;
  storageUsedBytes: number;
  storageAddonGb: number;
  tools: PricingToolInput[];
  assignments: PricingAssignmentInput[];
};

export type ToolAccessLabel =
  | 'Included'
  | 'Free Trial'
  | 'Free Through Promotion'
  | 'Payment Setup Needed';

export type ToolCoverage =
  | 'Trial'
  | 'Free Slot'
  | 'Specific Promotion'
  | 'Account Promotion'
  | 'Paid / Billable'
  | 'Included';

export type ToolPricingResult = {
  toolId: string;
  name: string;
  shelfPriceCents: number;
  ownedAt: string;
  inTrial: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  daysRemaining: number | null;
  trialPreviouslyUsed: boolean;
  freeSlotCovered: boolean;
  specificPromotionCovered: boolean;
  accountPromotionCovered: boolean;
  billable: boolean;
  expectedMonthlyCents: number;
  accessLabel: ToolAccessLabel;
  coverage: ToolCoverage;
  reason: string;
};

export type ActivePromotionResult = {
  id: string;
  displayName: string;
  publicCode: string | null;
  customerDescription: string;
  benefitType: BenefitType;
  source: string;
  effectiveAt: string;
  expiresAt: string | null;
  toolIds: string[];
};

export type AccountPricingState = {
  userId: string;
  accountType: 'personal' | 'business';
  isTestAccount: boolean;
  effectiveAt: string;
  activeToolCount: number;
  trialToolCount: number;
  includedToolCount: number;
  billableToolCount: number;
  paymentSetupCount: number;
  freeSlots: number;
  freeSlotsUsed: number;
  freeSlotsRemaining: number;
  tools: ToolPricingResult[];
  activePromotions: ActivePromotionResult[];
  normalMonthlyCents: number;
  billableSubtotalCents: number;
  fixedDiscountCents: number;
  percentageDiscountCents: number;
  fullDiscountCents: number;
  discountValueCents: number;
  effectiveMonthlyCents: number;
  hasBillableAmount: boolean;
  paymentSetupWouldBeNeeded: boolean;
  storageUsedBytes: number;
  baseStorageBytes: number;
  purchasedAddonBytes: number;
  promotionalStorageBytes: number;
  effectiveStorageBytes: number;
  diagnostics: PricingDiagnostics;
};

export type SlotSource = {
  id: string;
  displayName: string;
  publicCode: string | null;
  slotCount: number;
};

export type DiscountStep = {
  id: string;
  displayName: string;
  publicCode: string | null;
  kind: 'fixed_amount' | 'percentage' | 'percent_100';
  label: string;
  discountCents: number;
};

export type PricingDiagnostics = {
  shelfSubtotalCents: number;
  trialCoverageCents: number;
  specificCoverageCents: number;
  freeSlotCoverageCents: number;
  billableSubtotalCents: number;
  eligibleForFreeSlots: number;
  slotBaseline: SlotSource | null;
  additionalSlots: SlotSource[];
  discountSteps: DiscountStep[];
  trace: string[];
};

export type UpcomingBillingEvent = {
  at: string;
  labels: string[];
  beforeCents: number;
  afterCents: number;
};

export function dollarsToCents(price: number): number {
  return Math.max(0, Math.round(Number(price) * 100));
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function trialEndsAt(trialStartedAt: string): string {
  return new Date(Date.parse(trialStartedAt) + TRIAL_LENGTH_MS).toISOString();
}

export function isAssignmentActive(assignment: PricingAssignmentInput, effectiveAt: Date): boolean {
  if (assignment.removedAt) return false;
  const start = Date.parse(assignment.effectiveAt);
  if (Number.isNaN(start) || start > effectiveAt.getTime()) return false;
  if (!assignment.expiresAt) return true;
  const end = Date.parse(assignment.expiresAt);
  return !Number.isNaN(end) && end > effectiveAt.getTime();
}

function daysRemaining(endIso: string, effectiveAt: Date): number {
  const ms = Date.parse(endIso) - effectiveAt.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function activeAssignments(input: AccountPricingInput, effectiveAt: Date): PricingAssignmentInput[] {
  return input.assignments.filter((assignment) => isAssignmentActive(assignment, effectiveAt));
}

export function effectiveFreeSlots(assignments: PricingAssignmentInput[]): number {
  const totals = assignments
    .filter((assignment) => assignment.benefitType === 'free_tool_slots' && assignment.slotMode === 'total')
    .map((assignment) => assignment.slotCount ?? 0);
  const baseline = totals.length > 0 ? Math.max(...totals) : 0;
  const additional = assignments
    .filter((assignment) => assignment.benefitType === 'free_tool_slots' && assignment.slotMode === 'additional')
    .reduce((sum, assignment) => sum + (assignment.slotCount ?? 0), 0);
  return baseline + additional;
}

/**
 * Billable subtotal, then the sum of fixed discounts (not below $0),
 * then each percentage off the remaining amount in assignment order,
 * then any 100% off promotion sets the remainder to $0.
 */
export function applyPricingDiscounts(subtotalCents: number, assignments: PricingAssignmentInput[]): {
  fixedDiscountCents: number;
  percentageDiscountCents: number;
  fullDiscountCents: number;
  effectiveMonthlyCents: number;
  discountSteps: DiscountStep[];
} {
  const discountSteps: DiscountStep[] = [];
  let afterFixed = subtotalCents;
  for (const assignment of assignments.filter((item) => item.benefitType === 'fixed_amount')) {
    const requested = assignment.amountCents ?? 0;
    const applied = Math.min(afterFixed, requested);
    afterFixed -= applied;
    discountSteps.push({
      id: assignment.id,
      displayName: assignment.displayName,
      publicCode: assignment.publicCode,
      kind: 'fixed_amount',
      label: 'Fixed discount',
      discountCents: applied,
    });
  }
  const fixedDiscountCents = subtotalCents - afterFixed;

  let remaining = afterFixed;
  for (const assignment of assignments.filter((item) => item.benefitType === 'percentage' && (item.percentOff ?? 0) > 0)) {
    const percent = assignment.percentOff ?? 0;
    const discount = Math.round((remaining * percent) / 100);
    remaining = Math.max(0, remaining - discount);
    discountSteps.push({
      id: assignment.id,
      displayName: assignment.displayName,
      publicCode: assignment.publicCode,
      kind: 'percentage',
      label: `${percent}% promotion`,
      discountCents: discount,
    });
  }
  const percentageDiscountCents = afterFixed - remaining;

  const fullAssignments = assignments.filter((item) => item.benefitType === 'percent_100');
  let fullDiscountCents = 0;
  for (const assignment of fullAssignments) {
    const applied = remaining;
    remaining = 0;
    fullDiscountCents += applied;
    discountSteps.push({
      id: assignment.id,
      displayName: assignment.displayName,
      publicCode: assignment.publicCode,
      kind: 'percent_100',
      label: '100% promotion',
      discountCents: applied,
    });
  }

  return {
    fixedDiscountCents,
    percentageDiscountCents,
    fullDiscountCents,
    effectiveMonthlyCents: remaining,
    discountSteps,
  };
}

export function calculateAccountPricing(input: AccountPricingInput, effectiveAt: Date): AccountPricingState {
  const clock = new Date(effectiveAt.getTime());
  const active = activeAssignments(input, clock);
  const specificIds = new Set(
    active
      .filter((assignment) => assignment.benefitType === 'specific_tools')
      .flatMap((assignment) => assignment.toolIds),
  );
  const slots = effectiveFreeSlots(active);
  const accountDiscount = active.some((assignment) =>
    assignment.benefitType === 'percent_100'
    || assignment.benefitType === 'percentage'
    || assignment.benefitType === 'fixed_amount',
  );

  const eligibleForSlots = input.tools
    .filter((tool) => tool.shelfPriceCents > 0)
    .filter((tool) => !specificIds.has(tool.toolId))
    .filter((tool) => {
      if (!tool.trialUsed || !tool.trialStartedAt) return true;
      return Date.parse(trialEndsAt(tool.trialStartedAt)) <= clock.getTime();
    })
    .slice()
    .sort((left, right) => left.ownedAt.localeCompare(right.ownedAt) || left.toolId.localeCompare(right.toolId));

  const slottedTools = eligibleForSlots.slice(0, slots);
  const slotted = new Set(slottedTools.map((tool) => tool.toolId));
  const slotNumber = new Map(slottedTools.map((tool, index) => [tool.toolId, index + 1]));
  const totalSlotSources = active
    .filter((assignment) => assignment.benefitType === 'free_tool_slots' && assignment.slotMode === 'total')
    .map((assignment) => ({
      id: assignment.id,
      displayName: assignment.displayName,
      publicCode: assignment.publicCode,
      slotCount: assignment.slotCount ?? 0,
    }));
  const slotBaseline = totalSlotSources.reduce<SlotSource | null>((best, item) => {
    if (!best || item.slotCount > best.slotCount) return item;
    return best;
  }, null);
  const additionalSlots = active
    .filter((assignment) => assignment.benefitType === 'free_tool_slots' && assignment.slotMode === 'additional')
    .map((assignment) => ({
      id: assignment.id,
      displayName: assignment.displayName,
      publicCode: assignment.publicCode,
      slotCount: assignment.slotCount ?? 0,
    }));
  const specificByTool = new Map<string, PricingAssignmentInput>();
  for (const assignment of active) {
    if (assignment.benefitType !== 'specific_tools') continue;
    for (const toolId of assignment.toolIds) {
      if (!specificByTool.has(toolId)) specificByTool.set(toolId, assignment);
    }
  }
  const accountDiscountNames = active
    .filter((assignment) => assignment.benefitType === 'percent_100' || assignment.benefitType === 'percentage' || assignment.benefitType === 'fixed_amount')
    .map((assignment) => assignment.publicCode || assignment.displayName);

  const priced = input.tools
    .slice()
    .sort((left, right) => left.ownedAt.localeCompare(right.ownedAt) || left.name.localeCompare(right.name))
    .map((tool) => {
      const trialEnd = tool.trialStartedAt ? trialEndsAt(tool.trialStartedAt) : null;
      const inTrial = Boolean(tool.trialUsed && trialEnd && Date.parse(trialEnd) > clock.getTime() && Date.parse(tool.trialStartedAt!) <= clock.getTime());
      const specific = specificIds.has(tool.toolId);
      const freeSlot = slotted.has(tool.toolId);
      const billable = tool.shelfPriceCents > 0 && !inTrial && !specific && !freeSlot;
      return { tool, trialEnd, inTrial, specific, freeSlot, billable };
    });

  const billableSubtotalCents = priced.reduce((sum, item) => sum + (item.billable ? item.tool.shelfPriceCents : 0), 0);
  const discounts = applyPricingDiscounts(billableSubtotalCents, active);
  const accountClearsBill = discounts.effectiveMonthlyCents === 0 && billableSubtotalCents > 0;

  const tools: ToolPricingResult[] = priced.map(({ tool, trialEnd, inTrial, specific, freeSlot, billable }) => {
    const accountCovered = billable && accountDiscount;
    const specificAssignment = specificByTool.get(tool.toolId);
    let accessLabel: ToolAccessLabel = 'Included';
    let coverage: ToolCoverage = 'Included';
    let reason = 'Included at $0.';
    if (inTrial) {
      accessLabel = 'Free Trial';
      coverage = 'Trial';
      reason = trialEnd ? `Free trial until ${trialEnd.slice(0, 10)}.` : 'Free trial.';
    } else if (specific) {
      accessLabel = 'Free Through Promotion';
      coverage = 'Specific Promotion';
      const until = specificAssignment?.expiresAt ? ` until ${specificAssignment.expiresAt.slice(0, 10)}` : '';
      reason = `Covered by ${specificAssignment?.publicCode || specificAssignment?.displayName || 'a specific-tool promotion'}${until}.`;
    } else if (freeSlot) {
      accessLabel = 'Included';
      coverage = 'Free Slot';
      const source = slotBaseline?.publicCode || slotBaseline?.displayName || 'the free-slot benefit';
      reason = `Covered by ${source} free slot ${slotNumber.get(tool.toolId) ?? 1} of ${slots}.`;
    } else if (tool.shelfPriceCents <= 0) {
      accessLabel = 'Included';
      coverage = 'Included';
      reason = 'Included at $0.';
    } else if (billable && accountClearsBill) {
      accessLabel = 'Free Through Promotion';
      coverage = 'Account Promotion';
      reason = `Brought to $0 by ${accountDiscountNames.join(', ') || 'an account promotion'}.`;
    } else if (billable) {
      accessLabel = 'Payment Setup Needed';
      coverage = 'Paid / Billable';
      reason = 'Billable at the shelf price. Payment setup would be needed once billing exists.';
    }
    return {
      toolId: tool.toolId,
      name: tool.name,
      shelfPriceCents: tool.shelfPriceCents,
      ownedAt: tool.ownedAt,
      inTrial,
      trialStartedAt: tool.trialStartedAt,
      trialEndsAt: inTrial ? trialEnd : null,
      daysRemaining: inTrial && trialEnd ? daysRemaining(trialEnd, clock) : null,
      trialPreviouslyUsed: tool.trialUsed && !inTrial,
      freeSlotCovered: freeSlot,
      specificPromotionCovered: specific,
      accountPromotionCovered: accountCovered,
      billable,
      expectedMonthlyCents: billable ? tool.shelfPriceCents : 0,
      accessLabel,
      coverage,
      reason,
    };
  });
  const normalMonthlyCents = tools.reduce((sum, tool) => sum + tool.shelfPriceCents, 0);
  const baseStorageBytes = discounts.effectiveMonthlyCents > 0 ? STORAGE_PAID_BYTES : STORAGE_FREE_BYTES;
  const purchasedAddonBytes = Math.max(0, input.storageAddonGb) * STORAGE_ADDON_BYTES;
  const promotionalStorageBytes = active
    .filter((assignment) => assignment.benefitType === 'bonus_storage')
    .reduce((sum, assignment) => sum + (assignment.bonusStorageBytes ?? 0), 0);
  const trialCoverageCents = priced.reduce((sum, item) => sum + (item.inTrial ? item.tool.shelfPriceCents : 0), 0);
  const specificCoverageCents = priced.reduce((sum, item) => sum + (!item.inTrial && item.specific ? item.tool.shelfPriceCents : 0), 0);
  const freeSlotCoverageCents = priced.reduce((sum, item) => sum + (!item.inTrial && !item.specific && item.freeSlot ? item.tool.shelfPriceCents : 0), 0);
  const diagnostics: PricingDiagnostics = {
    shelfSubtotalCents: normalMonthlyCents,
    trialCoverageCents,
    specificCoverageCents,
    freeSlotCoverageCents,
    billableSubtotalCents,
    eligibleForFreeSlots: eligibleForSlots.length,
    slotBaseline,
    additionalSlots,
    discountSteps: discounts.discountSteps,
    trace: [
      `${tools.length} active tools`,
      `- ${tools.filter((tool) => tool.inTrial).length} in trial`,
      `- ${tools.filter((tool) => tool.specificPromotionCovered && !tool.inTrial).length} covered by a specific-tool promotion`,
      `= ${eligibleForSlots.length} eligible for free slots`,
      `${slotted.size} free slots applied`,
      `${tools.filter((tool) => tool.billable).length} billable tools`,
      `Billable subtotal ${formatCents(billableSubtotalCents)}`,
      `Expected monthly cost ${formatCents(discounts.effectiveMonthlyCents)}`,
    ],
  };

  return {
    userId: input.userId,
    accountType: input.accountType,
    isTestAccount: input.isTestAccount,
    effectiveAt: clock.toISOString(),
    activeToolCount: tools.length,
    trialToolCount: tools.filter((tool) => tool.inTrial).length,
    includedToolCount: tools.filter((tool) => tool.accessLabel === 'Included' || tool.freeSlotCovered).length,
    billableToolCount: tools.filter((tool) => tool.billable).length,
    paymentSetupCount: discounts.effectiveMonthlyCents > 0 ? tools.filter((tool) => tool.billable).length : 0,
    freeSlots: slots,
    freeSlotsUsed: slotted.size,
    freeSlotsRemaining: Math.max(0, slots - slotted.size),
    tools,
    activePromotions: active.map((assignment) => ({
      id: assignment.id,
      displayName: assignment.displayName,
      publicCode: assignment.publicCode,
      customerDescription: assignment.customerDescription,
      benefitType: assignment.benefitType,
      source: assignment.source,
      effectiveAt: assignment.effectiveAt,
      expiresAt: assignment.expiresAt,
      toolIds: assignment.toolIds,
    })),
    normalMonthlyCents,
    billableSubtotalCents,
    fixedDiscountCents: discounts.fixedDiscountCents,
    percentageDiscountCents: discounts.percentageDiscountCents,
    fullDiscountCents: discounts.fullDiscountCents,
    discountValueCents: discounts.fixedDiscountCents + discounts.percentageDiscountCents + discounts.fullDiscountCents,
    effectiveMonthlyCents: discounts.effectiveMonthlyCents,
    hasBillableAmount: discounts.effectiveMonthlyCents > 0,
    paymentSetupWouldBeNeeded: discounts.effectiveMonthlyCents > 0,
    storageUsedBytes: Math.max(0, input.storageUsedBytes),
    baseStorageBytes,
    purchasedAddonBytes,
    promotionalStorageBytes,
    effectiveStorageBytes: baseStorageBytes + purchasedAddonBytes + promotionalStorageBytes,
    diagnostics,
  };
}

export function nextPricingInstant(input: AccountPricingInput, effectiveAt: Date): Date | null {
  const times: number[] = [];
  const now = effectiveAt.getTime();
  for (const tool of input.tools) {
    if (!tool.trialStartedAt || !tool.trialUsed) continue;
    const end = Date.parse(trialEndsAt(tool.trialStartedAt));
    if (end > now) times.push(end);
  }
  for (const assignment of input.assignments) {
    if (assignment.removedAt) continue;
    const start = Date.parse(assignment.effectiveAt);
    const end = assignment.expiresAt ? Date.parse(assignment.expiresAt) : NaN;
    if (start > now) times.push(start);
    if (!Number.isNaN(end) && end > now) times.push(end);
  }
  if (times.length === 0) return null;
  return new Date(Math.min(...times));
}

const BILLING_EVENT_HORIZON_MS = 366 * 24 * 60 * 60 * 1000;
const BILLING_EVENT_LIMIT = 20;

/**
 * Next billing instants within 12 months, at most 20.
 * Events that share a timestamp are one group. Price before is one millisecond earlier.
 * Price after uses the Phase 8 rule that expires_at equal to the clock is already expired.
 */
export function upcomingBillingEvents(input: AccountPricingInput, effectiveAt: Date): UpcomingBillingEvent[] {
  const now = effectiveAt.getTime();
  const horizon = now + BILLING_EVENT_HORIZON_MS;
  const groups = new Map<number, string[]>();
  const add = (time: number, label: string) => {
    if (!Number.isFinite(time) || time <= now || time > horizon) return;
    const labels = groups.get(time) ?? [];
    labels.push(label);
    groups.set(time, labels);
  };

  for (const tool of input.tools) {
    if (!tool.trialStartedAt || !tool.trialUsed) continue;
    add(Date.parse(trialEndsAt(tool.trialStartedAt)), `${tool.name} trial ends`);
  }
  for (const assignment of input.assignments) {
    if (assignment.removedAt) continue;
    const name = assignment.publicCode || assignment.displayName;
    add(Date.parse(assignment.effectiveAt), `${name} starts`);
    if (assignment.expiresAt) {
      const label = assignment.benefitType === 'bonus_storage' ? `${name} storage bonus expires` : `${name} expires`;
      add(Date.parse(assignment.expiresAt), label);
    }
  }

  return [...groups.keys()].sort((left, right) => left - right).slice(0, BILLING_EVENT_LIMIT).map((time) => {
    const before = calculateAccountPricing(input, new Date(time - 1));
    const after = calculateAccountPricing(input, new Date(time));
    return {
      at: new Date(time).toISOString(),
      labels: groups.get(time) ?? [],
      beforeCents: before.effectiveMonthlyCents,
      afterCents: after.effectiveMonthlyCents,
    };
  });
}

export function shiftPreviewDate(actual: Date, days: number): Date {
  return new Date(actual.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Empty or "today" uses the actual clock.
 * YYYY-MM-DD keeps that UTC calendar day and the actual UTC time of day.
 * A full ISO timestamp is accepted as-is. Past dates are allowed.
 */
export function parsePreviewEffectiveAt(raw: string | null | undefined, now = new Date()): Date | null {
  const value = raw?.trim() ?? '';
  if (value === '' || value.toLowerCase() === 'today') return new Date(now.getTime());
  const calendar = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (calendar) {
    const year = Number(calendar[1]);
    const month = Number(calendar[2]);
    const day = Number(calendar[3]);
    const date = new Date(Date.UTC(year, month - 1, day, now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds()));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatPreviewInstant(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}, ${hours}:${minutes} UTC`;
}
