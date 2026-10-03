/**
 * Discount code preview model.
 *
 * This module is UI-only. It does not read or write billing, trials, Stripe, or the database.
 * Sample codes live in sessionStorage so a superadmin can click through the screens.
 */
import { formatDisplayDate } from '@/lib/format-display-date';
import { PUBLIC_TOOL_CATEGORIES, PUBLIC_TOOLS } from '@/lib/public-tools';

export const DISCOUNT_CODE_STORAGE_KEY = 'household-toolbox-discount-codes-preview-v1';

export const DISCOUNT_TYPES = [
  'free_tool_slots',
  'specific_tools',
  'percent_100',
  'percentage',
  'fixed_amount',
  'bonus_storage',
] as const;

export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DISCOUNT_TYPE_OPTIONS: { value: DiscountType; title: string; description: string }[] = [
  {
    value: 'free_tool_slots',
    title: 'Free Tool Slots',
    description: 'Open slots the customer can fill with any tool. Not locked to one tool.',
  },
  {
    value: 'specific_tools',
    title: 'Specific Tool(s) Free',
    description: 'One or more named tools at no cost.',
  },
  {
    value: 'percent_100',
    title: '100% Off / No Cost',
    description: 'Everything billable is free for a period, or for life.',
  },
  {
    value: 'percentage',
    title: 'Percentage Off',
    description: 'A percent off for a set time, or for life.',
  },
  {
    value: 'fixed_amount',
    title: 'Fixed Dollar Amount Off',
    description: 'A set dollar amount off the monthly bill.',
  },
  {
    value: 'bonus_storage',
    title: 'Bonus Storage',
    description: 'Extra storage for a set time, or for life.',
  },
];

export const STORED_STATUSES = ['active', 'inactive', 'draft', 'archived'] as const;
export type StoredDiscountStatus = (typeof STORED_STATUSES)[number];

export const DISPLAY_STATUSES = ['active', 'inactive', 'draft', 'scheduled', 'expired', 'archived'] as const;
export type DisplayDiscountStatus = (typeof DISPLAY_STATUSES)[number];

export const DISPLAY_STATUS_LABELS: Record<DisplayDiscountStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  draft: 'Draft',
  scheduled: 'Scheduled',
  expired: 'Expired',
  archived: 'Archived',
};

export const DURATION_UNITS = ['days', 'months', 'years', 'lifetime'] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

export const SLOT_MODES = ['additional', 'total'] as const;
export type SlotMode = (typeof SLOT_MODES)[number];

export const ASSIGNMENT_METHODS = ['public_code', 'automatic', 'admin_only'] as const;
export type AssignmentMethod = (typeof ASSIGNMENT_METHODS)[number];

export const ASSIGNMENT_OPTIONS: { value: AssignmentMethod; title: string; description: string }[] = [
  {
    value: 'public_code',
    title: 'Public code',
    description: 'The customer enters this code.',
  },
  {
    value: 'automatic',
    title: 'Automatically assigned',
    description: 'Applied when the customer qualifies. They do not type a code.',
  },
  {
    value: 'admin_only',
    title: 'Admin-only',
    description: 'A superadmin applies this promotion to an account.',
  },
];

export const ELIGIBLE_USERS = ['everyone', 'new_users', 'existing_users'] as const;
export type EligibleUsers = (typeof ELIGIBLE_USERS)[number];

export const ELIGIBLE_USER_LABELS: Record<EligibleUsers, string> = {
  everyone: 'Everyone',
  new_users: 'New users only',
  existing_users: 'Existing users only',
};

export const ACCOUNT_TYPES = ['all', 'personal', 'business'] as const;
export type EligibleAccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<EligibleAccountType, string> = {
  all: 'All account types',
  personal: 'Personal',
  business: 'Business',
};

export const PER_USER_REDEMPTIONS = ['once', 'repeatable'] as const;
export type PerUserRedemption = (typeof PER_USER_REDEMPTIONS)[number];

export const DISCOUNT_PLATFORMS = [
  { value: '', label: 'Not set' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'email', label: 'Email' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
] as const;

export type DiscountPlatform = (typeof DISCOUNT_PLATFORMS)[number]['value'];

export const REDEMPTION_SOURCES = ['user_entered', 'auto_assigned', 'admin_assigned'] as const;
export type RedemptionSource = (typeof REDEMPTION_SOURCES)[number];

export const REDEMPTION_SOURCE_LABELS: Record<RedemptionSource, string> = {
  user_entered: 'User-entered',
  auto_assigned: 'Auto-assigned',
  admin_assigned: 'Admin-assigned',
};

export type DiscountToolOption = {
  slug: string;
  name: string;
  category: string;
};

export const DISCOUNT_TOOL_OPTIONS: DiscountToolOption[] = PUBLIC_TOOLS.map((tool) => ({
  slug: tool.slug,
  name: tool.name,
  category: tool.category,
}));

export function discountToolsByCategory(): { category: string; tools: DiscountToolOption[] }[] {
  return PUBLIC_TOOL_CATEGORIES.map((category) => ({
    category,
    tools: DISCOUNT_TOOL_OPTIONS.filter((tool) => tool.category === category),
  })).filter((group) => group.tools.length > 0);
}

export type DiscountRedemption = {
  id: string;
  userName: string;
  redeemedAt: string;
  status: 'active' | 'expired';
  expiresAt: string | null;
  source: RedemptionSource;
};

export type DiscountCodeDraft = {
  internalName: string;
  publicCode: string;
  customerDescription: string;
  adminNotes: string;
  status: StoredDiscountStatus;
  redeemStartDate: string;
  redeemEndDate: string;
  discountType: DiscountType;
  quantity: number;
  slotMode: SlotMode;
  toolSlugs: string[];
  durationUnit: DurationUnit;
  durationAmount: number;
  maxRedemptionsMode: 'unlimited' | 'custom';
  maxRedemptions: number | null;
  perUserRedemption: PerUserRedemption;
  eligibleUsers: EligibleUsers;
  eligibleAccountType: EligibleAccountType;
  canStack: boolean;
  assignmentMethod: AssignmentMethod;
  partnerName: string;
  platform: DiscountPlatform;
  campaignName: string;
  revenueSharePercent: string;
  partnerNotes: string;
};

export type DiscountCode = DiscountCodeDraft & {
  id: string;
  createdAt: string;
  updatedAt: string;
  redemptionCount: number;
  activeUsers: number;
  expiredAssignments: number;
  estimatedMonthlyDiscount: number;
  redemptions: DiscountRedemption[];
};

export function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function timestampDaysAgo(days: number): string {
  return `${isoDateOffset(-days)}T16:00:00.000Z`;
}

export function normalizePublicCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
}

export function emptyDiscountDraft(): DiscountCodeDraft {
  return {
    internalName: '',
    publicCode: '',
    customerDescription: '',
    adminNotes: '',
    status: 'inactive',
    redeemStartDate: todayIsoDate(),
    redeemEndDate: '',
    discountType: 'percentage',
    quantity: 25,
    slotMode: 'additional',
    toolSlugs: [],
    durationUnit: 'months',
    durationAmount: 6,
    maxRedemptionsMode: 'unlimited',
    maxRedemptions: null,
    perUserRedemption: 'once',
    eligibleUsers: 'everyone',
    eligibleAccountType: 'all',
    canStack: true,
    assignmentMethod: 'public_code',
    partnerName: '',
    platform: '',
    campaignName: '',
    revenueSharePercent: '',
    partnerNotes: '',
  };
}

export function draftFromCode(code: DiscountCode): DiscountCodeDraft {
  return {
    internalName: code.internalName,
    publicCode: code.publicCode,
    customerDescription: code.customerDescription,
    adminNotes: code.adminNotes,
    status: code.status,
    redeemStartDate: code.redeemStartDate,
    redeemEndDate: code.redeemEndDate,
    discountType: code.discountType,
    quantity: code.quantity,
    slotMode: code.slotMode,
    toolSlugs: [...code.toolSlugs],
    durationUnit: code.durationUnit,
    durationAmount: code.durationAmount,
    maxRedemptionsMode: code.maxRedemptionsMode,
    maxRedemptions: code.maxRedemptions,
    perUserRedemption: code.perUserRedemption,
    eligibleUsers: code.eligibleUsers,
    eligibleAccountType: code.eligibleAccountType,
    canStack: code.canStack,
    assignmentMethod: code.assignmentMethod,
    partnerName: code.partnerName,
    platform: code.platform,
    campaignName: code.campaignName,
    revenueSharePercent: code.revenueSharePercent,
    partnerNotes: code.partnerNotes,
  };
}

export function cloneDraftFromCode(code: DiscountCode): DiscountCodeDraft {
  return {
    ...draftFromCode(code),
    publicCode: '',
    status: 'draft',
  };
}

export function toolNamesForSlugs(slugs: string[]): string[] {
  return slugs.map((slug) => DISCOUNT_TOOL_OPTIONS.find((tool) => tool.slug === slug)?.name ?? slug);
}

export function durationPhrase(unit: DurationUnit, amount: number, style: 'preview' | 'label' = 'label'): string {
  if (unit === 'lifetime') return 'Lifetime';
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  const singular = unit === 'days' ? 'day' : unit === 'months' ? 'month' : 'year';
  const word = safe === 1 ? singular : `${singular}s`;
  if (style === 'preview') {
    return `${safe} ${word.charAt(0).toUpperCase()}${word.slice(1)}`;
  }
  return `${safe} ${word}`;
}

function specificToolsPhrase(names: string[]): string {
  if (names.length === 0) return 'Selected tools';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.length} tools`;
}

function formatDollarAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '$0';
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `$${rounded}` : `$${rounded.toFixed(2)}`;
}

export function previewHeadline(draft: Pick<DiscountCodeDraft, 'discountType' | 'quantity' | 'slotMode' | 'toolSlugs' | 'durationUnit' | 'durationAmount'>): string {
  const duration = durationPhrase(draft.durationUnit, draft.durationAmount, 'preview');
  const forDuration = draft.durationUnit === 'lifetime' ? 'for Lifetime' : `for ${duration}`;

  switch (draft.discountType) {
    case 'free_tool_slots': {
      const count = Number.isFinite(draft.quantity) ? draft.quantity : 0;
      const noun = count === 1 ? 'Free Tool Slot' : 'Free Tool Slots';
      const prefix = draft.slotMode === 'additional' ? '+' : '';
      return `${prefix}${count} ${noun} ${forDuration}`;
    }
    case 'specific_tools':
      return `${specificToolsPhrase(toolNamesForSlugs(draft.toolSlugs))} Free ${forDuration}`;
    case 'percent_100':
      return draft.durationUnit === 'lifetime' ? 'Lifetime Free Account' : `100% Off ${forDuration}`;
    case 'percentage':
      return `${Number.isFinite(draft.quantity) ? draft.quantity : 0}% Off ${forDuration}`;
    case 'fixed_amount':
      return `${formatDollarAmount(draft.quantity)} Off per Month ${forDuration}`;
    case 'bonus_storage': {
      const gigabytes = Number.isFinite(draft.quantity) ? draft.quantity : 0;
      return `+${gigabytes} GB ${forDuration}`;
    }
    default:
      return 'Discount preview';
  }
}

export function benefitLabel(draft: Pick<DiscountCodeDraft, 'discountType' | 'quantity' | 'slotMode' | 'toolSlugs'>): string {
  switch (draft.discountType) {
    case 'free_tool_slots': {
      const count = Number.isFinite(draft.quantity) ? draft.quantity : 0;
      const noun = count === 1 ? 'free tool slot' : 'free tool slots';
      return draft.slotMode === 'additional' ? `+${count} ${noun}` : `${count} ${noun} total`;
    }
    case 'specific_tools':
      return specificToolsPhrase(toolNamesForSlugs(draft.toolSlugs));
    case 'percent_100':
      return '100% off';
    case 'percentage':
      return `${Number.isFinite(draft.quantity) ? draft.quantity : 0}% off`;
    case 'fixed_amount':
      return `${formatDollarAmount(draft.quantity)} off / month`;
    case 'bonus_storage':
      return `+${Number.isFinite(draft.quantity) ? draft.quantity : 0} GB`;
    default:
      return 'Discount';
  }
}

export function getDisplayStatus(code: Pick<DiscountCodeDraft, 'status' | 'redeemStartDate' | 'redeemEndDate'>, today = todayIsoDate()): DisplayDiscountStatus {
  if (code.status === 'archived') return 'archived';
  if (code.status === 'draft') return 'draft';
  if (code.status === 'inactive') return 'inactive';
  if (code.redeemStartDate && code.redeemStartDate > today) return 'scheduled';
  if (code.redeemEndDate && code.redeemEndDate < today) return 'expired';
  return 'active';
}

export function listStatusHint(draft: Pick<DiscountCodeDraft, 'status' | 'redeemStartDate' | 'redeemEndDate'>): string | null {
  if (draft.status !== 'active') return null;
  const display = getDisplayStatus(draft);
  if (display === 'scheduled') return 'On the list this shows as Scheduled until the start date.';
  if (display === 'expired') return 'On the list this shows as Expired because the last redemption day has passed.';
  return 'On the list this shows as Active.';
}

export function discountTypeLabel(type: DiscountType): string {
  return DISCOUNT_TYPE_OPTIONS.find((option) => option.value === type)?.title ?? type;
}

export function platformLabel(platform: DiscountPlatform): string {
  return DISCOUNT_PLATFORMS.find((option) => option.value === platform)?.label ?? 'Not set';
}

export function assignmentLabel(method: AssignmentMethod): string {
  return ASSIGNMENT_OPTIONS.find((option) => option.value === method)?.title ?? method;
}

export function partnerCampaignLabel(code: Pick<DiscountCodeDraft, 'partnerName' | 'campaignName'>): string {
  const parts = [code.partnerName.trim(), code.campaignName.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export function redemptionLimitLabel(code: Pick<DiscountCodeDraft, 'maxRedemptionsMode' | 'maxRedemptions'>): string {
  if (code.maxRedemptionsMode === 'unlimited' || code.maxRedemptions == null) return 'Unlimited';
  return String(code.maxRedemptions);
}

export function formatRedeemWindow(start: string, end: string): string {
  if (start && end) return `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
  if (start) return `Starts ${formatDisplayDate(start)}`;
  if (end) return `Through ${formatDisplayDate(end)}`;
  return 'No redemption dates';
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function perUserLabel(value: PerUserRedemption): string {
  return value === 'once' ? 'Once per user' : 'Repeatable';
}

export function slotModeLabel(mode: SlotMode, quantity: number): string {
  const count = Number.isFinite(quantity) ? quantity : 0;
  return mode === 'additional'
    ? `Add ${count} additional free tool slots`
    : `Set total free tool slots to ${count}`;
}

export function normalizeDiscountDraft(draft: DiscountCodeDraft): DiscountCodeDraft {
  const quantity = draft.discountType === 'free_tool_slots' || draft.discountType === 'bonus_storage'
    ? Math.round(draft.quantity)
    : draft.quantity;
  return {
    ...draft,
    internalName: draft.internalName.trim(),
    publicCode: normalizePublicCode(draft.publicCode),
    customerDescription: draft.customerDescription.trim(),
    adminNotes: draft.adminNotes.trim(),
    partnerName: draft.partnerName.trim(),
    campaignName: draft.campaignName.trim(),
    partnerNotes: draft.partnerNotes.trim(),
    revenueSharePercent: draft.revenueSharePercent.trim(),
    quantity,
    durationAmount: draft.durationUnit === 'lifetime' ? draft.durationAmount : Math.round(draft.durationAmount),
    maxRedemptions: draft.maxRedemptionsMode === 'custom' && draft.maxRedemptions != null
      ? Math.round(draft.maxRedemptions)
      : null,
    toolSlugs: [...draft.toolSlugs],
  };
}

export function validateDiscountDraft(draft: DiscountCodeDraft, existing: DiscountCode[], editingId?: string): string[] {
  const normalized = normalizeDiscountDraft(draft);
  const errors: string[] = [];

  if (!normalized.internalName) errors.push('Enter an internal promotion name.');
  if (normalized.publicCode.length < 3) {
    errors.push('Enter a public code with at least 3 letters or numbers.');
  } else if (existing.some((item) => item.id !== editingId && normalizePublicCode(item.publicCode) === normalized.publicCode)) {
    errors.push('That public code is already used. Choose a different code.');
  }
  if (!normalized.redeemStartDate) errors.push('Enter the first day this code can be redeemed.');
  if (normalized.redeemStartDate && normalized.redeemEndDate && normalized.redeemEndDate < normalized.redeemStartDate) {
    errors.push('The last redemption day must be on or after the start date.');
  }
  if (normalized.durationUnit !== 'lifetime' && (!Number.isFinite(normalized.durationAmount) || normalized.durationAmount < 1)) {
    errors.push('Enter how long the benefit lasts, or choose Lifetime.');
  }

  switch (normalized.discountType) {
    case 'free_tool_slots':
      if (!Number.isInteger(normalized.quantity) || normalized.quantity < 1) {
        errors.push('Enter how many free tool slots this code includes.');
      }
      break;
    case 'specific_tools':
      if (normalized.toolSlugs.length === 0) errors.push('Select at least one tool.');
      break;
    case 'percentage':
      if (!Number.isFinite(normalized.quantity) || normalized.quantity <= 0 || normalized.quantity > 100) {
        errors.push('Enter a percentage from 1 to 100.');
      }
      break;
    case 'fixed_amount':
      if (!Number.isFinite(normalized.quantity) || normalized.quantity <= 0) {
        errors.push('Enter a dollar amount greater than zero.');
      }
      break;
    case 'bonus_storage':
      if (!Number.isInteger(normalized.quantity) || normalized.quantity < 1) {
        errors.push('Enter the bonus storage in whole gigabytes.');
      }
      break;
    case 'percent_100':
      break;
    default:
      break;
  }

  if (normalized.maxRedemptionsMode === 'custom') {
    if (normalized.maxRedemptions == null || !Number.isInteger(normalized.maxRedemptions) || normalized.maxRedemptions < 1) {
      errors.push('Enter a redemption limit of at least 1, or choose Unlimited.');
    }
  }

  if (normalized.revenueSharePercent) {
    const share = Number(normalized.revenueSharePercent);
    if (!Number.isFinite(share) || share < 0 || share > 100) {
      errors.push('Revenue share must be from 0 to 100, or left blank.');
    }
  }

  return errors;
}

export function defaultQuantityForType(type: DiscountType): number {
  switch (type) {
    case 'free_tool_slots':
      return 2;
    case 'percentage':
      return 25;
    case 'fixed_amount':
      return 5;
    case 'bonus_storage':
      return 5;
    default:
      return 0;
  }
}

export function summarizeDiscountCodes(codes: DiscountCode[], today = todayIsoDate()) {
  return codes.reduce(
    (summary, code) => {
      const status = getDisplayStatus(code, today);
      if (status === 'active') summary.active += 1;
      if (status === 'scheduled') summary.scheduled += 1;
      if (status === 'expired') summary.expired += 1;
      summary.redemptions += code.redemptionCount;
      return summary;
    },
    { active: 0, scheduled: 0, expired: 0, redemptions: 0 },
  );
}

export function attributionOptions(codes: DiscountCode[]): string[] {
  const values = new Set<string>();
  codes.forEach((code) => {
    if (code.partnerName.trim()) values.add(code.partnerName.trim());
    if (code.campaignName.trim()) values.add(code.campaignName.trim());
  });
  return Array.from(values).sort((left, right) => left.localeCompare(right));
}

function redemption(
  id: string,
  userName: string,
  daysAgo: number,
  status: DiscountRedemption['status'],
  source: RedemptionSource,
  expiresInDays: number | null,
): DiscountRedemption {
  return {
    id,
    userName,
    redeemedAt: isoDateOffset(-daysAgo),
    status,
    expiresAt: expiresInDays == null ? null : isoDateOffset(expiresInDays),
    source,
  };
}

function sampleCode(partial: DiscountCodeDraft & Pick<DiscountCode, 'id' | 'createdAt' | 'updatedAt' | 'redemptionCount' | 'activeUsers' | 'expiredAssignments' | 'estimatedMonthlyDiscount' | 'redemptions'>): DiscountCode {
  return partial;
}

export function createSeedDiscountCodes(): DiscountCode[] {
  return [
    sampleCode({
      id: 'new-user-2',
      internalName: 'New User — 2 Free Tools',
      publicCode: 'NEWUSER2',
      customerDescription: 'Your personal account includes 2 free tool slots.',
      adminNotes: 'Future default benefit for new personal accounts. Free slots are open spots, not a specific tool. This is separate from the one-time 7-day tool trial.',
      status: 'active',
      redeemStartDate: isoDateOffset(-200),
      redeemEndDate: '',
      discountType: 'free_tool_slots',
      quantity: 2,
      slotMode: 'total',
      toolSlugs: [],
      durationUnit: 'lifetime',
      durationAmount: 1,
      maxRedemptionsMode: 'unlimited',
      maxRedemptions: null,
      perUserRedemption: 'once',
      eligibleUsers: 'new_users',
      eligibleAccountType: 'personal',
      canStack: true,
      assignmentMethod: 'automatic',
      partnerName: '',
      platform: '',
      campaignName: 'Default new user benefit',
      revenueSharePercent: '',
      partnerNotes: '',
      createdAt: timestampDaysAgo(200),
      updatedAt: timestampDaysAgo(12),
      redemptionCount: 128,
      activeUsers: 121,
      expiredAssignments: 7,
      estimatedMonthlyDiscount: 484,
      redemptions: [
        redemption('nu-1', 'Avery Chen', 4, 'active', 'auto_assigned', null),
        redemption('nu-2', 'Jordan Blake', 18, 'active', 'auto_assigned', null),
        redemption('nu-3', 'Sam Rivera', 40, 'expired', 'auto_assigned', -3),
      ],
    }),
    sampleCode({
      id: 'launch-90',
      internalName: 'Launch — 90 Days Free',
      publicCode: 'LAUNCH90',
      customerDescription: 'Everything billable is free for your first 90 days.',
      adminNotes: 'Launch window promotion. Stacking is allowed.',
      status: 'active',
      redeemStartDate: isoDateOffset(-40),
      redeemEndDate: isoDateOffset(80),
      discountType: 'percent_100',
      quantity: 100,
      slotMode: 'additional',
      toolSlugs: [],
      durationUnit: 'days',
      durationAmount: 90,
      maxRedemptionsMode: 'custom',
      maxRedemptions: 500,
      perUserRedemption: 'once',
      eligibleUsers: 'everyone',
      eligibleAccountType: 'all',
      canStack: true,
      assignmentMethod: 'public_code',
      partnerName: '',
      platform: 'email',
      campaignName: 'Launch',
      revenueSharePercent: '',
      partnerNotes: '',
      createdAt: timestampDaysAgo(50),
      updatedAt: timestampDaysAgo(6),
      redemptionCount: 46,
      activeUsers: 31,
      expiredAssignments: 15,
      estimatedMonthlyDiscount: 248,
      redemptions: [
        redemption('l90-1', 'Morgan Lee', 6, 'active', 'user_entered', 84),
        redemption('l90-2', 'Casey Nguyen', 20, 'active', 'user_entered', 70),
        redemption('l90-3', 'Riley Patel', 100, 'expired', 'user_entered', -10),
      ],
    }),
    sampleCode({
      id: 'home-free',
      internalName: 'Home Maintenance Free Year',
      publicCode: 'HOMEFREE',
      customerDescription: 'Home Maintenance Schedule is free for 12 months.',
      adminNotes: 'Tied to one tool. The customer can still add other tools at the normal price.',
      status: 'active',
      redeemStartDate: isoDateOffset(-90),
      redeemEndDate: isoDateOffset(90),
      discountType: 'specific_tools',
      quantity: 1,
      slotMode: 'additional',
      toolSlugs: ['home-maintenance-schedule'],
      durationUnit: 'months',
      durationAmount: 12,
      maxRedemptionsMode: 'unlimited',
      maxRedemptions: null,
      perUserRedemption: 'once',
      eligibleUsers: 'everyone',
      eligibleAccountType: 'all',
      canStack: true,
      assignmentMethod: 'public_code',
      partnerName: '',
      platform: '',
      campaignName: 'Home feature spotlight',
      revenueSharePercent: '',
      partnerNotes: '',
      createdAt: timestampDaysAgo(90),
      updatedAt: timestampDaysAgo(9),
      redemptionCount: 18,
      activeUsers: 16,
      expiredAssignments: 2,
      estimatedMonthlyDiscount: 32,
      redemptions: [
        redemption('hf-1', 'Quinn Adams', 12, 'active', 'user_entered', 350),
        redemption('hf-2', 'Taylor Brooks', 30, 'active', 'admin_assigned', 330),
      ],
    }),
    sampleCode({
      id: 'tiktok-25',
      internalName: 'Creator — 25% for 6 Months',
      publicCode: 'TIKTOK25',
      customerDescription: '25% off for 6 months.',
      adminNotes: 'Sample creator code. Revenue share is recorded for later reporting only.',
      status: 'active',
      redeemStartDate: isoDateOffset(-20),
      redeemEndDate: isoDateOffset(40),
      discountType: 'percentage',
      quantity: 25,
      slotMode: 'additional',
      toolSlugs: [],
      durationUnit: 'months',
      durationAmount: 6,
      maxRedemptionsMode: 'custom',
      maxRedemptions: 200,
      perUserRedemption: 'once',
      eligibleUsers: 'everyone',
      eligibleAccountType: 'all',
      canStack: true,
      assignmentMethod: 'public_code',
      partnerName: 'Example Creator',
      platform: 'tiktok',
      campaignName: 'Fall creator series',
      revenueSharePercent: '15',
      partnerNotes: 'Sample partner. No payout is sent from this screen.',
      createdAt: timestampDaysAgo(25),
      updatedAt: timestampDaysAgo(2),
      redemptionCount: 22,
      activeUsers: 20,
      expiredAssignments: 2,
      estimatedMonthlyDiscount: 40,
      redemptions: [
        redemption('tt-1', 'Jamie Cole', 3, 'active', 'user_entered', 175),
        redemption('tt-2', 'Alex Morgan', 11, 'active', 'user_entered', 167),
        redemption('tt-3', 'Drew Singh', 160, 'expired', 'user_entered', -5),
      ],
    }),
    sampleCode({
      id: 'bonus-3',
      internalName: 'Bonus 3 Tool Slots',
      publicCode: 'BONUS3',
      customerDescription: 'Add 3 extra free tool slots for 6 months.',
      adminNotes: 'Additional slots sit on top of the customer’s current free slots.',
      status: 'active',
      redeemStartDate: isoDateOffset(-15),
      redeemEndDate: isoDateOffset(120),
      discountType: 'free_tool_slots',
      quantity: 3,
      slotMode: 'additional',
      toolSlugs: [],
      durationUnit: 'months',
      durationAmount: 6,
      maxRedemptionsMode: 'unlimited',
      maxRedemptions: null,
      perUserRedemption: 'once',
      eligibleUsers: 'existing_users',
      eligibleAccountType: 'all',
      canStack: true,
      assignmentMethod: 'public_code',
      partnerName: '',
      platform: 'email',
      campaignName: 'Slot upgrade',
      revenueSharePercent: '',
      partnerNotes: '',
      createdAt: timestampDaysAgo(15),
      updatedAt: timestampDaysAgo(4),
      redemptionCount: 9,
      activeUsers: 9,
      expiredAssignments: 0,
      estimatedMonthlyDiscount: 54,
      redemptions: [
        redemption('b3-1', 'Parker Diaz', 2, 'active', 'user_entered', 180),
        redemption('b3-2', 'Reese Kim', 8, 'active', 'user_entered', 174),
      ],
    }),
    sampleCode({
      id: 'early-access',
      internalName: 'Early Access Lifetime',
      publicCode: 'EARLYACCESS',
      customerDescription: 'This account is free for life.',
      adminNotes: 'Complimentary lifetime accounts. Assign by hand.',
      status: 'active',
      redeemStartDate: isoDateOffset(-180),
      redeemEndDate: '',
      discountType: 'percent_100',
      quantity: 100,
      slotMode: 'additional',
      toolSlugs: [],
      durationUnit: 'lifetime',
      durationAmount: 1,
      maxRedemptionsMode: 'custom',
      maxRedemptions: 25,
      perUserRedemption: 'once',
      eligibleUsers: 'everyone',
      eligibleAccountType: 'all',
      canStack: true,
      assignmentMethod: 'admin_only',
      partnerName: '',
      platform: '',
      campaignName: 'Early access',
      revenueSharePercent: '',
      partnerNotes: '',
      createdAt: timestampDaysAgo(180),
      updatedAt: timestampDaysAgo(20),
      redemptionCount: 4,
      activeUsers: 4,
      expiredAssignments: 0,
      estimatedMonthlyDiscount: 40,
      redemptions: [
        redemption('ea-1', 'Harper Wells', 60, 'active', 'admin_assigned', null),
        redemption('ea-2', 'Skyler Bennett', 90, 'active', 'admin_assigned', null),
      ],
    }),
    sampleCode({
      id: 'spring-5',
      internalName: 'Spring $5 Monthly Credit',
      publicCode: 'SPRING5',
      customerDescription: '$5 off each month for 6 months.',
      adminNotes: 'Starts in the future so the list can show a scheduled code.',
      status: 'active',
      redeemStartDate: isoDateOffset(30),
      redeemEndDate: isoDateOffset(120),
      discountType: 'fixed_amount',
      quantity: 5,
      slotMode: 'additional',
      toolSlugs: [],
      durationUnit: 'months',
      durationAmount: 6,
      maxRedemptionsMode: 'custom',
      maxRedemptions: 300,
      perUserRedemption: 'once',
      eligibleUsers: 'everyone',
      eligibleAccountType: 'all',
      canStack: true,
      assignmentMethod: 'public_code',
      partnerName: '',
      platform: 'email',
      campaignName: 'Spring email',
      revenueSharePercent: '',
      partnerNotes: '',
      createdAt: timestampDaysAgo(3),
      updatedAt: timestampDaysAgo(1),
      redemptionCount: 0,
      activeUsers: 0,
      expiredAssignments: 0,
      estimatedMonthlyDiscount: 0,
      redemptions: [],
    }),
    sampleCode({
      id: 'storage-5',
      internalName: 'Bonus 5 GB',
      publicCode: 'STORAGE5',
      customerDescription: '5 GB of extra storage for 12 months.',
      adminNotes: 'Redemption window has ended. Included so Expired has a sample.',
      status: 'active',
      redeemStartDate: isoDateOffset(-400),
      redeemEndDate: isoDateOffset(-30),
      discountType: 'bonus_storage',
      quantity: 5,
      slotMode: 'additional',
      toolSlugs: [],
      durationUnit: 'months',
      durationAmount: 12,
      maxRedemptionsMode: 'unlimited',
      maxRedemptions: null,
      perUserRedemption: 'once',
      eligibleUsers: 'everyone',
      eligibleAccountType: 'all',
      canStack: true,
      assignmentMethod: 'public_code',
      partnerName: '',
      platform: '',
      campaignName: 'Storage boost',
      revenueSharePercent: '',
      partnerNotes: '',
      createdAt: timestampDaysAgo(400),
      updatedAt: timestampDaysAgo(30),
      redemptionCount: 14,
      activeUsers: 0,
      expiredAssignments: 14,
      estimatedMonthlyDiscount: 0,
      redemptions: [
        redemption('st-1', 'Logan Price', 200, 'expired', 'user_entered', -20),
        redemption('st-2', 'Emerson Clark', 80, 'expired', 'user_entered', -10),
      ],
    }),
    sampleCode({
      id: 'partner-50',
      internalName: 'Partner 50% Test',
      publicCode: 'PARTNER50',
      customerDescription: '50% off for 12 months.',
      adminNotes: 'Turned off while the offer is reviewed.',
      status: 'inactive',
      redeemStartDate: isoDateOffset(-10),
      redeemEndDate: isoDateOffset(60),
      discountType: 'percentage',
      quantity: 50,
      slotMode: 'additional',
      toolSlugs: [],
      durationUnit: 'months',
      durationAmount: 12,
      maxRedemptionsMode: 'custom',
      maxRedemptions: 50,
      perUserRedemption: 'repeatable',
      eligibleUsers: 'everyone',
      eligibleAccountType: 'personal',
      canStack: true,
      assignmentMethod: 'public_code',
      partnerName: 'Example Creator',
      platform: 'instagram',
      campaignName: 'Instagram test',
      revenueSharePercent: '10',
      partnerNotes: 'Second sample for the same partner on another platform.',
      createdAt: timestampDaysAgo(10),
      updatedAt: timestampDaysAgo(1),
      redemptionCount: 3,
      activeUsers: 2,
      expiredAssignments: 1,
      estimatedMonthlyDiscount: 6,
      redemptions: [
        redemption('p50-1', 'Rowan Ellis', 7, 'active', 'user_entered', 350),
      ],
    }),
    sampleCode({
      id: 'storage-10',
      internalName: 'Lifetime Storage Draft',
      publicCode: 'STORAGE10',
      customerDescription: '10 GB of extra storage for the life of the account.',
      adminNotes: 'Draft. Not available to customers yet.',
      status: 'draft',
      redeemStartDate: isoDateOffset(0),
      redeemEndDate: '',
      discountType: 'bonus_storage',
      quantity: 10,
      slotMode: 'additional',
      toolSlugs: [],
      durationUnit: 'lifetime',
      durationAmount: 1,
      maxRedemptionsMode: 'unlimited',
      maxRedemptions: null,
      perUserRedemption: 'once',
      eligibleUsers: 'everyone',
      eligibleAccountType: 'all',
      canStack: true,
      assignmentMethod: 'public_code',
      partnerName: '',
      platform: '',
      campaignName: '',
      revenueSharePercent: '',
      partnerNotes: '',
      createdAt: timestampDaysAgo(1),
      updatedAt: timestampDaysAgo(1),
      redemptionCount: 0,
      activeUsers: 0,
      expiredAssignments: 0,
      estimatedMonthlyDiscount: 0,
      redemptions: [],
    }),
  ];
}

function isDiscountCode(value: unknown): value is DiscountCode {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<DiscountCode>;
  return typeof item.id === 'string'
    && typeof item.publicCode === 'string'
    && typeof item.internalName === 'string'
    && typeof item.discountType === 'string'
    && DISCOUNT_TYPES.includes(item.discountType as DiscountType)
    && typeof item.status === 'string'
    && STORED_STATUSES.includes(item.status as StoredDiscountStatus)
    && Array.isArray(item.toolSlugs)
    && Array.isArray(item.redemptions);
}

export function loadDiscountCodes(): DiscountCode[] {
  if (typeof window === 'undefined') return createSeedDiscountCodes();
  try {
    const raw = sessionStorage.getItem(DISCOUNT_CODE_STORAGE_KEY);
    if (!raw) return createSeedDiscountCodes();
    const parsed = JSON.parse(raw) as { version?: number; codes?: unknown };
    if (parsed.version !== 1 || !Array.isArray(parsed.codes) || !parsed.codes.every(isDiscountCode)) {
      return createSeedDiscountCodes();
    }
    return parsed.codes;
  } catch {
    return createSeedDiscountCodes();
  }
}

const discountCodeListeners = new Set<() => void>();
let discountCodeSnapshot: DiscountCode[] | null = null;
let discountCodeSnapshotRaw: string | null = null;

function notifyDiscountCodes() {
  discountCodeListeners.forEach((listener) => listener());
}

export function subscribeDiscountCodes(listener: () => void) {
  discountCodeListeners.add(listener);
  return () => {
    discountCodeListeners.delete(listener);
  };
}

export function getDiscountCodeSnapshot(): DiscountCode[] {
  const raw = typeof window === 'undefined' ? null : sessionStorage.getItem(DISCOUNT_CODE_STORAGE_KEY);
  if (discountCodeSnapshot && discountCodeSnapshotRaw === raw) return discountCodeSnapshot;
  discountCodeSnapshotRaw = raw;
  discountCodeSnapshot = loadDiscountCodes();
  return discountCodeSnapshot;
}

export function getDiscountCodeServerSnapshot(): null {
  return null;
}

export function saveDiscountCodes(codes: DiscountCode[]) {
  if (typeof window === 'undefined') return;
  const raw = JSON.stringify({ version: 1, codes });
  sessionStorage.setItem(DISCOUNT_CODE_STORAGE_KEY, raw);
  discountCodeSnapshot = codes;
  discountCodeSnapshotRaw = raw;
  notifyDiscountCodes();
}
