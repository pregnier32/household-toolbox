import {
  STORAGE_FREE_BYTES,
  applyPricingDiscounts,
  calculateAccountPricing,
  formatCents,
  isAssignmentActive,
  nextPricingInstant,
  parsePreviewEffectiveAt,
  upcomingBillingEvents,
  type AccountPricingInput,
  type AccountPricingState,
  type PricingAssignmentInput,
  type ToolPricingResult,
} from './account-pricing';
import { draftAccountNotices, type NoticeDraft } from './account-notice-drafts';
import type { CustomerPlanBenefit, CustomerPlanSource } from './customer-plan-preview';
import {
  assignmentsAsOf,
  billingDateLabel,
  billingHeading,
  billingSchedule,
  describeBillingCycle,
  periodRecordsToTools,
  scheduledRemovalNote,
  trialStatusNote,
  type BillingCycleSnapshot,
  type PeriodToolRecord,
} from './billing-cycle';
import { formatDisplayDate } from './format-display-date';

export type PreviewAccess = 'unauthorized' | 'forbidden' | null;

export function previewAccess(userStatus: string | null | undefined): PreviewAccess {
  if (!userStatus) return 'unauthorized';
  if (userStatus !== 'superadmin') return 'forbidden';
  return null;
}

export type PromotionTiming = 'active' | 'scheduled' | 'expired' | 'removed';

export function promotionTiming(assignment: Pick<PricingAssignmentInput, 'removedAt' | 'effectiveAt' | 'expiresAt'>, effectiveAt: Date): PromotionTiming {
  if (assignment.removedAt) return 'removed';
  const start = Date.parse(assignment.effectiveAt);
  if (!Number.isNaN(start) && start > effectiveAt.getTime()) return 'scheduled';
  if (assignment.expiresAt) {
    const end = Date.parse(assignment.expiresAt);
    if (!Number.isNaN(end) && end <= effectiveAt.getTime()) return 'expired';
  }
  return 'active';
}

export type PreviewPerson = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
};

export type PreviewNotice = {
  id: string;
  severity: 'info' | 'attention' | 'action';
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type CustomerPlanPayload = {
  accountType: 'personal' | 'business';
  freeSlots: number;
  freeSlotsUsed: number;
  freeSlotsRemaining: number;
  tools: { id: string; name: string; label: string; amount: string | null; addedAt: string | null; price: string }[];
  statement: PlanStatementRow[];
  benefits: CustomerPlanBenefit[];
  currentMonthly: string;
  upcoming: { at: string; amount: string } | null;
  storageUsed: string;
  storageAllowance: string;
  paymentMethod: string;
  paymentSetupWouldBeNeeded: boolean;
  notice: { title: string; body: string } | null;
  billingCycle?: CustomerBillingCycle | null;
};

export type CustomerBillingCycle = {
  nextBillingDate: string;
  estimatedNextBill: string;
  nextBillingAt: string;
};

export type BillingCyclePreview = {
  anniversaryDay: number;
  firstBillingAt: string;
  previousBillingAt: string | null;
  nextBillingAt: string;
  actualNextBillingAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  currentExpectedMonthly: string;
  currentPeriodAmount: string;
  estimatedNextAmount: string;
  trialTools: { name: string; note: string }[];
  scheduledRemovals: { name: string; note: string }[];
  nextPromotionCodes: string[];
  nextFreeSlots: number;
  nextBill: {
    heading: string;
    lines: { name: string; status: string; amount: string }[];
    regularMonthly: string;
    promotions: string;
    estimated: string;
  };
};

export type BillingPreviewPayload = {
  actualAt: string;
  simulatedAt: string;
  simulationIsToday: boolean;
  openedUserId: string;
  billingUserId: string;
  viewingName: string;
  viewingEmail: string;
  accountType: 'personal' | 'business';
  isTestAccount: boolean;
  summary: {
    activeTools: number;
    toolsInTrial: number;
    includedTools: number;
    billableTools: number;
    expectedMonthly: string;
    storageAllowance: string;
    storageUsed: string;
    paymentSetup: 'Would Be Required' | 'Not Required';
  };
  tools: {
    id: string;
    name: string;
    added: string;
    trialStatus: string;
    trialEnd: string | null;
    coverage: string;
    shelfPrice: string;
    expectedCharge: string;
    status: string;
    reason: string;
  }[];
  slots: {
    baseline: string;
    additional: string[];
    effective: number;
    used: number;
    available: number;
  };
  promotions: {
    id: string;
    name: string;
    code: string;
    benefit: string;
    source: string;
    effective: string;
    expiration: string | null;
    daysRemaining: string;
    tools: string[];
    timing: PromotionTiming;
  }[];
  pricingLines: { label: string; amount: string }[];
  trace: string[];
  expectedMonthly: string;
  storage: {
    base: string;
    addon: string;
    bonus: string;
    allowance: string;
    used: string;
    percent: number;
  };
  simulatedNotices: NoticeDraft[];
  actualNotices: PreviewNotice[];
  events: { at: string; labels: string[]; before: string; after: string }[];
  customerPlan: CustomerPlanPayload;
  cycle: BillingCyclePreview | null;
};

function personName(person: PreviewPerson): string {
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || person.email;
}

function storageLabel(bytes: number): string {
  const safe = Math.max(0, bytes);
  if (safe < 1024) return `${safe} B`;
  if (safe < 1024 * 1024) return `${(safe / 1024).toFixed(safe < 10 * 1024 ? 1 : 0)} KB`;
  if (safe < 1024 * 1024 * 1024) return `${(safe / (1024 * 1024)).toFixed(safe < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(safe / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function sourceFor(source: string): CustomerPlanSource {
  if (source === 'user_entered') return 'code';
  if (source === 'automatic') return 'included';
  return 'added';
}

function benefitText(assignment: PricingAssignmentInput, toolNames: Map<string, string>): string {
  if (assignment.benefitType === 'free_tool_slots') {
    const count = assignment.slotCount ?? 0;
    return assignment.slotMode === 'additional' ? `+${count} free tool slots` : `${count} free tool slots total`;
  }
  if (assignment.benefitType === 'specific_tools') {
    const names = assignment.toolIds.map((id) => toolNames.get(id) || 'Tool');
    return names.length > 0 ? names.join(', ') : 'Specific tools';
  }
  if (assignment.benefitType === 'percent_100') return '100% off';
  if (assignment.benefitType === 'percentage') return `${assignment.percentOff ?? 0}% off`;
  if (assignment.benefitType === 'fixed_amount') return `${formatCents(assignment.amountCents ?? 0)} off / month`;
  const gigabytes = (assignment.bonusStorageBytes ?? 0) / (1024 * 1024 * 1024);
  return `${gigabytes} GB bonus storage`;
}

function daysLabel(assignment: PricingAssignmentInput, effectiveAt: Date, timing: PromotionTiming): string {
  if (timing === 'removed') return 'Removed';
  if (timing === 'expired') return 'Expired';
  if (!assignment.expiresAt) return timing === 'scheduled' ? 'Lifetime after start' : 'Lifetime';
  const target = timing === 'scheduled' ? assignment.effectiveAt : assignment.expiresAt;
  const ms = Date.parse(target) - effectiveAt.getTime();
  const days = Math.max(0, Math.ceil(ms / 86_400_000));
  if (timing === 'scheduled') return days === 1 ? 'Starts in 1 day' : `Starts in ${days} days`;
  if (days === 0) return 'Ends today';
  return days === 1 ? '1 day remaining' : `${days} days remaining`;
}

function moneyLine(label: string, cents: number, signed = false): { label: string; amount: string } {
  if (!signed || cents === 0) return { label, amount: formatCents(Math.abs(cents)) };
  return { label, amount: `-${formatCents(cents)}` };
}

export function assembleBillingPreview(args: {
  input: AccountPricingInput;
  opened: PreviewPerson;
  billing: PreviewPerson;
  notices: PreviewNotice[];
  toolNames: Map<string, string>;
  actualAt: Date;
  simulatedAt: Date;
  signupAt?: string | null;
  frozenPeriodTools?: PeriodToolRecord[] | null;
}): BillingPreviewPayload {
  const state = calculateAccountPricing(args.input, args.simulatedAt);
  const drafts = draftAccountNotices(args.input, args.simulatedAt);
  const events = upcomingBillingEvents(args.input, args.simulatedAt);
  const next = nextPricingInstant(args.input, args.simulatedAt);
  const upcomingState = next ? calculateAccountPricing(args.input, next) : null;
  const diagnostics = state.diagnostics;
  const zeroIncluded = Math.max(0, diagnostics.shelfSubtotalCents - diagnostics.trialCoverageCents - diagnostics.specificCoverageCents - diagnostics.freeSlotCoverageCents - diagnostics.billableSubtotalCents);
  const pricingLines = [
    moneyLine('Tool subtotal', diagnostics.shelfSubtotalCents),
    moneyLine('Trial coverage', diagnostics.trialCoverageCents, true),
    moneyLine('Specific-tool promotion', diagnostics.specificCoverageCents, true),
    moneyLine('Free slot coverage', diagnostics.freeSlotCoverageCents, true),
    ...(zeroIncluded > 0 ? [moneyLine('Included at $0', zeroIncluded, true)] : []),
    moneyLine('Remaining billable subtotal', diagnostics.billableSubtotalCents),
    ...diagnostics.discountSteps.map((step) => moneyLine(step.publicCode ? `${step.label} (${step.publicCode})` : step.label, step.discountCents, true)),
    { label: 'Expected monthly cost', amount: formatCents(state.effectiveMonthlyCents) },
  ];
  const percent = state.effectiveStorageBytes > 0
    ? Math.min(100, Math.round((state.storageUsedBytes / state.effectiveStorageBytes) * 100))
    : 0;
  const benefits: CustomerPlanBenefit[] = args.input.assignments.map((assignment) => ({
    id: assignment.id,
    name: assignment.displayName,
    publicCode: assignment.publicCode || '',
    benefit: benefitText(assignment, args.toolNames),
    description: assignment.customerDescription,
    effectiveDate: assignment.effectiveAt.slice(0, 10),
    expirationDate: assignment.expiresAt ? assignment.expiresAt.slice(0, 10) : null,
    status: assignment.removedAt ? 'removed' : 'active',
    source: sourceFor(assignment.source),
  }));
  const firstDraft = drafts[0];
  const cyclePlan = args.signupAt
    ? buildCycleCustomerStatement(args.input, args.signupAt, args.simulatedAt, args.frozenPeriodTools ?? null)
    : null;
  const cycle = args.signupAt
    ? buildBillingCyclePreview(args.input, args.signupAt, args.simulatedAt, args.actualAt, args.frozenPeriodTools ?? null)
    : null;

  return {
    actualAt: args.actualAt.toISOString(),
    simulatedAt: state.effectiveAt,
    simulationIsToday: args.actualAt.toISOString() === state.effectiveAt,
    openedUserId: args.opened.id,
    billingUserId: args.billing.id,
    viewingName: personName(args.billing),
    viewingEmail: args.billing.email,
    accountType: state.accountType,
    isTestAccount: state.isTestAccount,
    summary: {
      activeTools: state.activeToolCount,
      toolsInTrial: state.trialToolCount,
      includedTools: state.includedToolCount,
      billableTools: state.billableToolCount,
      expectedMonthly: `${formatCents(state.effectiveMonthlyCents)}/month`,
      storageAllowance: storageLabel(state.effectiveStorageBytes),
      storageUsed: storageLabel(state.storageUsedBytes),
      paymentSetup: state.paymentSetupWouldBeNeeded ? 'Would Be Required' : 'Not Required',
    },
    tools: state.tools.map((tool) => ({
      id: tool.toolId,
      name: tool.name,
      added: tool.ownedAt,
      trialStatus: tool.inTrial ? 'In trial' : tool.trialPreviouslyUsed ? 'Trial used' : 'No trial',
      trialEnd: tool.trialEndsAt,
      coverage: tool.coverage,
      shelfPrice: formatCents(tool.shelfPriceCents),
      expectedCharge: formatCents(tool.expectedMonthlyCents),
      status: tool.accessLabel,
      reason: tool.reason,
    })),
    slots: {
      baseline: diagnostics.slotBaseline
        ? `${diagnostics.slotBaseline.slotCount} — ${diagnostics.slotBaseline.publicCode || diagnostics.slotBaseline.displayName}`
        : 'None',
      additional: diagnostics.additionalSlots.map((slot) => `+${slot.slotCount} — ${slot.publicCode || slot.displayName}`),
      effective: state.freeSlots,
      used: state.freeSlotsUsed,
      available: state.freeSlotsRemaining,
    },
    promotions: args.input.assignments.map((assignment) => {
      const timing = promotionTiming(assignment, args.simulatedAt);
      return {
        id: assignment.id,
        name: assignment.displayName,
        code: assignment.publicCode || '',
        benefit: benefitText(assignment, args.toolNames),
        source: assignment.source,
        effective: assignment.effectiveAt,
        expiration: assignment.expiresAt,
        daysRemaining: daysLabel(assignment, args.simulatedAt, timing),
        tools: assignment.toolIds.map((id) => args.toolNames.get(id) || 'Tool'),
        timing,
      };
    }),
    pricingLines,
    trace: diagnostics.trace,
    expectedMonthly: formatCents(state.effectiveMonthlyCents),
    storage: {
      base: storageLabel(state.baseStorageBytes),
      addon: storageLabel(state.purchasedAddonBytes),
      bonus: storageLabel(state.promotionalStorageBytes),
      allowance: storageLabel(state.effectiveStorageBytes),
      used: storageLabel(state.storageUsedBytes),
      percent,
    },
    simulatedNotices: drafts,
    actualNotices: args.notices,
    events: events.map((event) => ({
      at: event.at,
      labels: event.labels,
      before: `${formatCents(event.beforeCents)}/month`,
      after: `${formatCents(event.afterCents)}/month`,
    })),
    customerPlan: {
      accountType: state.accountType,
      freeSlots: state.freeSlots,
      freeSlotsUsed: state.freeSlotsUsed,
      freeSlotsRemaining: state.freeSlotsRemaining,
      tools: state.tools.map((tool) => ({
        id: tool.toolId,
        name: tool.name,
        label: tool.inTrial && tool.daysRemaining != null
          ? `Free Trial — ${tool.daysRemaining} day${tool.daysRemaining === 1 ? '' : 's'} remaining`
          : tool.accessLabel,
        amount: tool.billable ? formatCents(tool.expectedMonthlyCents) : null,
        addedAt: tool.ownedAt,
        price: formatCents(toolListCents(tool)),
      })),
      statement: cyclePlan?.statement ?? buildCustomerStatement(args.input, state),
      benefits,
      currentMonthly: formatCents(state.effectiveMonthlyCents),
      billingCycle: cyclePlan?.billingCycle ?? null,
      upcoming: next && upcomingState ? { at: next.toISOString().slice(0, 10), amount: formatCents(upcomingState.effectiveMonthlyCents) } : null,
      storageUsed: storageLabel(state.storageUsedBytes),
      storageAllowance: storageLabel(state.effectiveStorageBytes),
      paymentMethod: 'Not configured yet',
      paymentSetupWouldBeNeeded: state.paymentSetupWouldBeNeeded,
      notice: firstDraft ? { title: firstDraft.title, body: firstDraft.body } : null,
    },
    cycle,
  };
}

export function simulatedInstant(raw: string | null | undefined, now = new Date()): Date | null {
  return parsePreviewEffectiveAt(raw, now);
}

const STORAGE_ADDON_MONTHLY_CENTS = 100;

export type PlanStatementRow = {
  id: string;
  kind: 'section' | 'tool' | 'storage' | 'subtotal' | 'adjustment' | 'total';
  label: string;
  detail: string | null;
  amount: string | null;
  benefitId: string | null;
  note?: string | null;
};

export function toolListCents(tool: Pick<ToolPricingResult, 'shelfPriceCents' | 'catalogPriceCents'>): number {
  if (tool.shelfPriceCents > 0) return tool.shelfPriceCents;
  return Math.max(0, tool.catalogPriceCents);
}

export function formatMonthlyCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const dollars = abs / 100;
  const body = Number.isInteger(dollars) ? `$${dollars}` : formatCents(abs);
  return `${negative ? '-' : ''}${body}/month`;
}

function statementAmount(cents: number): string {
  if (cents === 0) return 'Included';
  return formatMonthlyCents(cents);
}

export function buildCustomerStatement(
  input: AccountPricingInput,
  state: AccountPricingState,
  options?: { trialDisplay?: 'credit' | 'zero'; notes?: Map<string, string> },
): PlanStatementRow[] {
  const rows: PlanStatementRow[] = [];
  const adjustments: PlanStatementRow[] = [];
  const zeroTrials = options?.trialDisplay === 'zero';
  const tools = state.tools
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) || left.toolId.localeCompare(right.toolId));
  rows.push({ id: 'section-tools', kind: 'section', label: 'Tools', detail: null, amount: null, benefitId: null });
  let toolSum = 0;
  for (const tool of tools) {
    const cents = toolListCents(tool);
    const hideCharge = zeroTrials && tool.inTrial;
    if (!hideCharge) toolSum += cents;
    const added = formatDisplayDate(tool.ownedAt);
    rows.push({
      id: `tool-${tool.toolId}`,
      kind: 'tool',
      label: tool.name,
      detail: added ? `Added ${added}` : null,
      amount: hideCharge ? '$0' : statementAmount(cents),
      benefitId: null,
      note: options?.notes?.get(tool.toolId) ?? null,
    });
  }

  const storageCents = Math.round(Math.max(0, input.storageAddonGb) * STORAGE_ADDON_MONTHLY_CENTS);
  rows.push({ id: 'section-storage', kind: 'section', label: 'Storage', detail: null, amount: null, benefitId: null });
  rows.push({
    id: 'storage',
    kind: 'storage',
    label: state.baseStorageBytes > STORAGE_FREE_BYTES ? 'Paid Acct' : 'Free Acct',
    detail: `${storageLabel(state.storageUsedBytes)} of ${storageLabel(state.effectiveStorageBytes)}`,
    amount: statementAmount(storageCents),
    benefitId: null,
  });

  const before = toolSum + storageCents;
  rows.push({
    id: 'before',
    kind: 'subtotal',
    label: 'Regular monthly cost',
    detail: null,
    amount: formatMonthlyCents(before),
    benefitId: null,
  });

  let reductions = 0;
  const listed = new Set<string>();
  const assignmentById = new Map(input.assignments.map((assignment) => [assignment.id, assignment]));
  const pushPromotion = (id: string, centsOff: number) => {
    const assignment = assignmentById.get(id);
    const promo = state.activePromotions.find((item) => item.id === id);
    if (!assignment || !promo || listed.has(id)) return;
    listed.add(id);
    reductions += centsOff;
    const benefit = benefitText(assignment, new Map(state.tools.map((tool) => [tool.toolId, tool.name])));
    adjustments.push({
      id: `promo-${id}`,
      kind: 'adjustment',
      label: assignment.publicCode || assignment.displayName,
      detail: assignment.customerDescription.trim() || benefit,
      amount: statementAmount(-centsOff),
      benefitId: id,
    });
  };

  for (const tool of tools) {
    const cents = toolListCents(tool);
    if (zeroTrials || !tool.inTrial || cents <= 0) continue;
    reductions += cents;
    const days = tool.daysRemaining;
    adjustments.push({
      id: `trial-${tool.toolId}`,
      kind: 'adjustment',
      label: `${tool.name} free trial`,
      detail: days == null ? 'Free trial' : days === 1 ? '1 day remaining' : `${days} days remaining`,
      amount: formatMonthlyCents(-cents),
      benefitId: null,
    });
  }

  const slotEligible = state.tools
    .filter((tool) => toolListCents(tool) > 0 && !tool.inTrial && !tool.specificPromotionCovered)
    .sort((left, right) => left.ownedAt.localeCompare(right.ownedAt) || left.toolId.localeCompare(right.toolId));
  let cursor = 0;
  const slottedIds = new Set<string>();
  const takeSlotCents = (count: number) => {
    const slice = slotEligible.slice(cursor, cursor + Math.max(0, count));
    cursor += slice.length;
    for (const tool of slice) slottedIds.add(tool.toolId);
    return slice.reduce((sum, tool) => sum + toolListCents(tool), 0);
  };
  const baseline = state.diagnostics.slotBaseline;
  if (baseline) pushPromotion(baseline.id, takeSlotCents(baseline.slotCount));
  for (const slot of state.diagnostics.additionalSlots) pushPromotion(slot.id, takeSlotCents(slot.slotCount));
  for (const promo of state.activePromotions) {
    if (promo.benefitType !== 'free_tool_slots' || listed.has(promo.id)) continue;
    pushPromotion(promo.id, 0);
  }

  const claimed = new Set<string>();
  for (const promo of state.activePromotions) {
    if (promo.benefitType !== 'specific_tools') continue;
    let cents = 0;
    for (const tool of state.tools) {
      if (!promo.toolIds.includes(tool.toolId) || claimed.has(tool.toolId)) continue;
      if (!tool.specificPromotionCovered || tool.inTrial) continue;
      claimed.add(tool.toolId);
      cents += toolListCents(tool);
    }
    pushPromotion(promo.id, cents);
  }

  const billableListCents = state.tools.reduce((sum, tool) => {
    if (tool.inTrial || tool.specificPromotionCovered || slottedIds.has(tool.toolId)) return sum;
    return sum + toolListCents(tool);
  }, 0);
  const active = input.assignments.filter((assignment) => isAssignmentActive(assignment, new Date(state.effectiveAt)));
  for (const step of applyPricingDiscounts(billableListCents, active).discountSteps) {
    pushPromotion(step.id, step.discountCents);
  }
  for (const promo of state.activePromotions) {
    if (!listed.has(promo.id)) pushPromotion(promo.id, 0);
  }

  if (adjustments.length > 0) {
    rows.push({ id: 'section-promotions', kind: 'section', label: 'Promotions', detail: null, amount: null, benefitId: null });
    rows.push(...adjustments);
  }

  rows.push({
    id: 'total',
    kind: 'total',
    label: 'Monthly cost',
    detail: null,
    amount: formatMonthlyCents(before - reductions),
    benefitId: null,
  });
  return rows;
}

function nextBillStatus(tool: BillingCycleSnapshot['next']['tools'][number]): { status: string; amount: string } {
  if (tool.inTrial) {
    const days = tool.daysRemaining;
    const left = days == null ? 'in trial' : days === 1 ? '1 day remaining on billing date' : `${days} days remaining on billing date`;
    return { status: `Free Trial — ${left}`, amount: '$0' };
  }
  if (tool.freeSlotCovered) return { status: 'Free Slot', amount: '$0' };
  if (tool.specificPromotionCovered || tool.accountPromotionCovered) return { status: 'Free through promotion', amount: '$0' };
  if (tool.expectedMonthlyCents > 0) return { status: 'Billable', amount: formatCents(tool.expectedMonthlyCents) };
  return { status: 'Included', amount: '$0' };
}

export function buildCycleCustomerStatement(
  input: AccountPricingInput,
  signupAt: string,
  effectiveAt: Date,
  frozen: PeriodToolRecord[] | null,
): { statement: PlanStatementRow[]; snapshot: BillingCycleSnapshot; billingCycle: CustomerBillingCycle } {
  const snapshot = describeBillingCycle(input, signupAt, effectiveAt, frozen);
  const notes = new Map<string, string>();
  for (const tool of snapshot.current.tools) {
    if (tool.inTrial) notes.set(tool.toolId, trialStatusNote(tool.daysRemaining, tool.trialEndsAt));
  }
  for (const record of snapshot.periodRecords) {
    if (record.scheduledRemoval) notes.set(record.toolId, scheduledRemovalNote(snapshot.schedule.nextBillingAt));
  }
  for (const tool of snapshot.period?.tools ?? []) {
    if (!tool.inTrial || notes.has(tool.toolId)) continue;
    const live = snapshot.current.tools.find((item) => item.toolId === tool.toolId);
    notes.set(tool.toolId, live?.inTrial
      ? trialStatusNote(live.daysRemaining, live.trialEndsAt)
      : `Free trial ended — first bill ${billingDateLabel(snapshot.schedule.nextBillingAt)}`);
  }

  const periodInput: AccountPricingInput = snapshot.period && snapshot.schedule.periodStart
    ? {
      ...input,
      tools: periodRecordsToTools(snapshot.periodRecords),
      assignments: assignmentsAsOf(input.assignments, new Date(snapshot.schedule.periodStart)),
    }
    : { ...input, tools: [] };
  const statement = buildCustomerStatement(periodInput, snapshot.period ?? calculateAccountPricing(periodInput, effectiveAt), {
    trialDisplay: 'zero',
    notes,
  });

  const storageRow = statement.find((row) => row.kind === 'storage');
  if (storageRow) {
    storageRow.label = snapshot.current.baseStorageBytes > STORAGE_FREE_BYTES ? 'Paid Acct' : 'Free Acct';
    storageRow.detail = `${storageLabel(snapshot.current.storageUsedBytes)} of ${storageLabel(snapshot.current.effectiveStorageBytes)}`;
  }

  const seen = new Set(snapshot.periodRecords.map((record) => record.toolId));
  const extras: PlanStatementRow[] = input.tools
    .filter((tool) => !seen.has(tool.toolId))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
    .map((tool) => {
      const live = snapshot.current.tools.find((item) => item.toolId === tool.toolId);
      const added = formatDisplayDate(tool.ownedAt);
      return {
        id: `upcoming-${tool.toolId}`,
        kind: 'tool' as const,
        label: tool.name,
        detail: added ? `Added ${added}` : null,
        amount: '$0',
        benefitId: null,
        note: live?.inTrial
          ? trialStatusNote(live.daysRemaining, live.trialEndsAt)
          : `First bill ${billingDateLabel(snapshot.schedule.nextBillingAt)}`,
      };
    });
  const storageAt = statement.findIndex((row) => row.id === 'section-storage');
  if (extras.length > 0 && storageAt >= 0) statement.splice(storageAt, 0, ...extras);

  const storageCents = Math.round(Math.max(0, input.storageAddonGb) * STORAGE_ADDON_MONTHLY_CENTS);
  return {
    statement,
    snapshot,
    billingCycle: {
      nextBillingDate: billingDateLabel(snapshot.schedule.nextBillingAt),
      estimatedNextBill: formatCents(snapshot.next.effectiveMonthlyCents + storageCents),
      nextBillingAt: snapshot.schedule.nextBillingAt,
    },
  };
}

export function buildBillingCyclePreview(
  input: AccountPricingInput,
  signupAt: string,
  simulatedAt: Date,
  actualAt: Date,
  frozen: PeriodToolRecord[] | null,
): BillingCyclePreview {
  const built = buildCycleCustomerStatement(input, signupAt, simulatedAt, frozen);
  const snapshot = built.snapshot;
  const actualNext = billingSchedule(signupAt, actualAt).nextBillingAt;
  const storageCents = Math.round(Math.max(0, input.storageAddonGb) * STORAGE_ADDON_MONTHLY_CENTS);
  const scheduled = snapshot.periodRecords.filter((record) => record.scheduledRemoval);
  const lines = snapshot.next.tools
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
    .map((tool) => ({ name: tool.name, ...nextBillStatus(tool) }));
  for (const record of scheduled) {
    if (lines.some((line) => line.name === record.name)) continue;
    lines.push({ name: record.name, status: 'Scheduled for removal before next cycle', amount: '$0' });
  }
  return {
    anniversaryDay: snapshot.schedule.anchor.anniversaryDay,
    firstBillingAt: snapshot.schedule.anchor.firstBillingAt,
    previousBillingAt: snapshot.schedule.previousBillingAt,
    nextBillingAt: snapshot.schedule.nextBillingAt,
    actualNextBillingAt: actualNext,
    periodStart: snapshot.schedule.periodStart,
    periodEnd: snapshot.schedule.periodEnd,
    currentExpectedMonthly: formatCents(snapshot.current.effectiveMonthlyCents),
    currentPeriodAmount: formatCents((snapshot.period?.effectiveMonthlyCents ?? 0) + storageCents),
    estimatedNextAmount: formatCents(snapshot.next.effectiveMonthlyCents + storageCents),
    trialTools: snapshot.current.tools.filter((tool) => tool.inTrial).map((tool) => ({
      name: tool.name,
      note: trialStatusNote(tool.daysRemaining, tool.trialEndsAt),
    })),
    scheduledRemovals: scheduled.map((record) => ({
      name: record.name,
      note: scheduledRemovalNote(snapshot.schedule.nextBillingAt),
    })),
    nextPromotionCodes: snapshot.next.activePromotions.map((promo) => promo.publicCode || promo.displayName),
    nextFreeSlots: snapshot.next.freeSlots,
    nextBill: {
      heading: billingHeading(snapshot.schedule.nextBillingAt),
      lines,
      regularMonthly: formatCents(snapshot.next.billableSubtotalCents),
      promotions: formatCents(snapshot.next.discountValueCents),
      estimated: formatCents(snapshot.next.effectiveMonthlyCents),
    },
  };
}
