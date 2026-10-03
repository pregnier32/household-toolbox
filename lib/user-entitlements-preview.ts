/**
 * Per-user discount and entitlement preview.
 *
 * UI only. Records live in sessionStorage so a superadmin can click through
 * assignment, removal, and history. This module does not read or write billing,
 * trials, Stripe, or the database.
 */
import { formatDisplayDate } from '@/lib/format-display-date';
import {
  benefitLabel,
  durationPhrase,
  getDisplayStatus,
  previewHeadline,
  todayIsoDate,
  type DiscountCode,
  type DiscountType,
  type DurationUnit,
  type SlotMode,
} from '@/lib/discount-codes';

export const USER_ENTITLEMENT_STORAGE_KEY = 'household-toolbox-user-entitlements-preview-v1';

export const ENTITLEMENT_SOURCES = ['automatic', 'user_entered', 'admin_assigned', 'manual'] as const;
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];

export const ENTITLEMENT_SOURCE_LABELS: Record<EntitlementSource, string> = {
  automatic: 'Automatically Assigned',
  user_entered: 'User-entered Code',
  admin_assigned: 'Admin Assigned',
  manual: 'Manual Entitlement',
};

export const DISPLAY_ENTITLEMENT_STATUSES = ['active', 'scheduled', 'expiring_soon', 'expired', 'removed'] as const;
export type DisplayEntitlementStatus = (typeof DISPLAY_ENTITLEMENT_STATUSES)[number];

export const DISPLAY_ENTITLEMENT_LABELS: Record<DisplayEntitlementStatus, string> = {
  active: 'Active',
  scheduled: 'Scheduled',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  removed: 'Removed',
};

export const HISTORY_STATUS_FILTERS = ['all', 'active', 'scheduled', 'expired', 'removed'] as const;
export type HistoryStatusFilter = (typeof HISTORY_STATUS_FILTERS)[number];

export const HISTORY_STATUS_FILTER_LABELS: Record<HistoryStatusFilter, string> = {
  all: 'All',
  active: 'Active',
  scheduled: 'Scheduled',
  expired: 'Expired',
  removed: 'Removed',
};

/** Benefits inside this many days of their end date show as Expiring Soon. */
export const EXPIRING_SOON_DAYS = 14;

export type UserEntitlement = {
  id: string;
  userId: string;
  promotionId: string | null;
  name: string;
  publicCode: string;
  discountType: DiscountType;
  quantity: number;
  slotMode: SlotMode;
  toolSlugs: string[];
  durationUnit: DurationUnit;
  durationAmount: number;
  source: EntitlementSource;
  effectiveDate: string;
  expirationDate: string | null;
  status: 'active' | 'removed';
  assignedAt: string;
  assignedBy: string;
  notes: string;
  removedAt: string | null;
  removedBy: string;
  removalReason: string;
};

export type ManualEntitlementDraft = {
  discountType: DiscountType;
  quantity: number;
  slotMode: SlotMode;
  toolSlugs: string[];
  durationUnit: DurationUnit;
  durationAmount: number;
  effectiveDate: string;
  notes: string;
};

type Store = {
  version: 1;
  byUser: Record<string, UserEntitlement[]>;
};

const EMPTY_LIST: UserEntitlement[] = [];
const listeners = new Set<() => void>();
const snapshotCache = new Map<string, { signature: string; list: UserEntitlement[] }>();

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

function parseIso(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000);
}

export function addDuration(start: string, unit: DurationUnit, amount: number): string | null {
  if (unit === 'lifetime') return null;
  const date = parseIso(start);
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  if (unit === 'days') date.setDate(date.getDate() + safe);
  if (unit === 'months') date.setMonth(date.getMonth() + safe);
  if (unit === 'years') date.setFullYear(date.getFullYear() + safe);
  return toIso(date);
}

export function entitlementFields(item: Pick<UserEntitlement, 'discountType' | 'quantity' | 'slotMode' | 'toolSlugs' | 'durationUnit' | 'durationAmount'>) {
  return {
    discountType: item.discountType,
    quantity: item.quantity,
    slotMode: item.slotMode,
    toolSlugs: item.toolSlugs,
    durationUnit: item.durationUnit,
    durationAmount: item.durationAmount,
  };
}

export function entitlementBenefit(item: UserEntitlement): string {
  return benefitLabel(entitlementFields(item));
}

export function entitlementHeadline(item: UserEntitlement): string {
  return previewHeadline(entitlementFields(item));
}

export function expirationLabel(expirationDate: string | null): string {
  if (!expirationDate) return 'Lifetime';
  return formatDisplayDate(expirationDate);
}

export function remainingLabel(expirationDate: string | null, today = todayIsoDate()): string {
  if (!expirationDate) return 'Lifetime';
  const days = daysBetween(today, expirationDate);
  if (days < 0) return 'Ended';
  if (days === 0) return 'Ends today';
  if (days === 1) return '1 day remaining';
  return `${days} days remaining`;
}

export function getEntitlementDisplayStatus(item: Pick<UserEntitlement, 'status' | 'effectiveDate' | 'expirationDate'>, today = todayIsoDate()): DisplayEntitlementStatus {
  if (item.status === 'removed') return 'removed';
  if (item.effectiveDate > today) return 'scheduled';
  if (item.expirationDate && item.expirationDate < today) return 'expired';
  if (item.expirationDate && daysBetween(today, item.expirationDate) <= EXPIRING_SOON_DAYS) return 'expiring_soon';
  return 'active';
}

export function isCurrentEntitlement(item: UserEntitlement, today = todayIsoDate()): boolean {
  const status = getEntitlementDisplayStatus(item, today);
  return status === 'active' || status === 'expiring_soon' || status === 'scheduled';
}

export function isAffectingEntitlement(item: UserEntitlement, today = todayIsoDate()): boolean {
  const status = getEntitlementDisplayStatus(item, today);
  return status === 'active' || status === 'expiring_soon';
}

export function matchesHistoryStatus(item: UserEntitlement, filter: HistoryStatusFilter, today = todayIsoDate()): boolean {
  if (filter === 'all') return true;
  const status = getEntitlementDisplayStatus(item, today);
  if (filter === 'active') return status === 'active' || status === 'expiring_soon';
  return status === filter;
}

export function promotionAssignmentWarning(code: DiscountCode): { tone: 'override' | 'note'; message: string } | null {
  const status = getDisplayStatus(code);
  if (status === 'inactive') {
    return {
      tone: 'override',
      message: 'This promotion is inactive. Assigning it is an admin override and will be noted on the user’s record.',
    };
  }
  if (status === 'expired') {
    return {
      tone: 'override',
      message: 'This promotion’s redemption window has ended. Assigning it is an admin override and will be noted on the user’s record.',
    };
  }
  if (status === 'draft') {
    return {
      tone: 'override',
      message: 'This promotion is still a draft. Assigning it is an admin override and will be noted on the user’s record.',
    };
  }
  if (status === 'scheduled') {
    return {
      tone: 'note',
      message: 'This promotion is not redeemable until its start date. Assigning it schedules the benefit for this user.',
    };
  }
  return null;
}

export function emptyManualDraft(): ManualEntitlementDraft {
  return {
    discountType: 'free_tool_slots',
    quantity: 3,
    slotMode: 'additional',
    toolSlugs: [],
    durationUnit: 'months',
    durationAmount: 6,
    effectiveDate: todayIsoDate(),
    notes: '',
  };
}

export function validateManualDraft(draft: ManualEntitlementDraft): string | null {
  if (!draft.notes.trim()) return 'Enter an internal reason for this entitlement.';
  if (!draft.effectiveDate) return 'Enter the day this benefit starts.';
  if (draft.durationUnit !== 'lifetime' && (!Number.isFinite(draft.durationAmount) || draft.durationAmount < 1)) {
    return 'Enter how long the benefit lasts, or choose Lifetime.';
  }
  if (draft.discountType === 'free_tool_slots' && (!Number.isInteger(draft.quantity) || draft.quantity < 1)) {
    return 'Enter how many free tool slots to grant.';
  }
  if (draft.discountType === 'specific_tools' && draft.toolSlugs.length === 0) {
    return 'Select at least one tool.';
  }
  if (draft.discountType === 'percentage' && (!Number.isFinite(draft.quantity) || draft.quantity <= 0 || draft.quantity > 100)) {
    return 'Enter a percentage from 1 to 100.';
  }
  if (draft.discountType === 'fixed_amount' && (!Number.isFinite(draft.quantity) || draft.quantity <= 0)) {
    return 'Enter a dollar amount greater than zero.';
  }
  if (draft.discountType === 'bonus_storage' && (!Number.isInteger(draft.quantity) || draft.quantity < 1)) {
    return 'Enter the bonus storage in whole gigabytes.';
  }
  return null;
}

function baseRecord(userId: string, partial: Omit<UserEntitlement, 'userId'>): UserEntitlement {
  return { userId, ...partial };
}

export function createSeedEntitlements(userId: string): UserEntitlement[] {
  const launchStart = isoDateOffset(-20);
  const homeStart = isoDateOffset(-30);
  const springStart = isoDateOffset(30);

  return [
    baseRecord(userId, {
      id: `${userId}-newuser2`,
      promotionId: 'new-user-2',
      name: 'New User — 2 Free Tools',
      publicCode: 'NEWUSER2',
      discountType: 'free_tool_slots',
      quantity: 2,
      slotMode: 'total',
      toolSlugs: [],
      durationUnit: 'lifetime',
      durationAmount: 0,
      source: 'automatic',
      effectiveDate: isoDateOffset(-200),
      expirationDate: null,
      status: 'active',
      assignedAt: timestampDaysAgo(200),
      assignedBy: 'System',
      notes: 'Standard benefit for a new personal account. Separate from the one-time 7-day tool trial.',
      removedAt: null,
      removedBy: '',
      removalReason: '',
    }),
    baseRecord(userId, {
      id: `${userId}-launch90`,
      promotionId: 'launch-90',
      name: 'Launch — 90 Days Free',
      publicCode: 'LAUNCH90',
      discountType: 'percent_100',
      quantity: 100,
      slotMode: 'additional',
      toolSlugs: [],
      durationUnit: 'days',
      durationAmount: 90,
      source: 'user_entered',
      effectiveDate: launchStart,
      expirationDate: addDuration(launchStart, 'days', 90),
      status: 'active',
      assignedAt: timestampDaysAgo(20),
      assignedBy: 'User',
      notes: 'Entered by the customer during the launch window.',
      removedAt: null,
      removedBy: '',
      removalReason: '',
    }),
    baseRecord(userId, {
      id: `${userId}-homefree`,
      promotionId: 'home-free',
      name: 'Home Maintenance Free Year',
      publicCode: 'HOMEFREE',
      discountType: 'specific_tools',
      quantity: 1,
      slotMode: 'additional',
      toolSlugs: ['home-maintenance-schedule'],
      durationUnit: 'months',
      durationAmount: 12,
      source: 'admin_assigned',
      effectiveDate: homeStart,
      expirationDate: addDuration(homeStart, 'months', 12),
      status: 'active',
      assignedAt: timestampDaysAgo(30),
      assignedBy: 'Superadmin',
      notes: 'Applied so Home Maintenance Schedule stays free for a year.',
      removedAt: null,
      removedBy: '',
      removalReason: '',
    }),
    baseRecord(userId, {
      id: `${userId}-storage-current`,
      promotionId: null,
      name: 'Bonus Storage',
      publicCode: '',
      discountType: 'bonus_storage',
      quantity: 5,
      slotMode: 'additional',
      toolSlugs: [],
      durationUnit: 'months',
      durationAmount: 12,
      source: 'manual',
      effectiveDate: isoDateOffset(-355),
      expirationDate: isoDateOffset(10),
      status: 'active',
      assignedAt: timestampDaysAgo(355),
      assignedBy: 'Superadmin',
      notes: 'Extra storage for document uploads.',
      removedAt: null,
      removedBy: '',
      removalReason: '',
    }),
    baseRecord(userId, {
      id: `${userId}-spring5`,
      promotionId: 'spring-5',
      name: 'Spring $5 Monthly Credit',
      publicCode: 'SPRING5',
      discountType: 'fixed_amount',
      quantity: 5,
      slotMode: 'additional',
      toolSlugs: [],
      durationUnit: 'months',
      durationAmount: 6,
      source: 'admin_assigned',
      effectiveDate: springStart,
      expirationDate: addDuration(springStart, 'months', 6),
      status: 'active',
      assignedAt: timestampDaysAgo(2),
      assignedBy: 'Superadmin',
      notes: 'Scheduled ahead of the spring campaign.',
      removedAt: null,
      removedBy: '',
      removalReason: '',
    }),
    baseRecord(userId, {
      id: `${userId}-tiktok25`,
      promotionId: 'tiktok-25',
      name: 'Creator — 25% for 6 Months',
      publicCode: 'TIKTOK25',
      discountType: 'percentage',
      quantity: 25,
      slotMode: 'additional',
      toolSlugs: [],
      durationUnit: 'months',
      durationAmount: 6,
      source: 'user_entered',
      effectiveDate: isoDateOffset(-200),
      expirationDate: isoDateOffset(-20),
      status: 'active',
      assignedAt: timestampDaysAgo(200),
      assignedBy: 'User',
      notes: 'Earlier creator code. Kept so the expired record stays visible.',
      removedAt: null,
      removedBy: '',
      removalReason: '',
    }),
    baseRecord(userId, {
      id: `${userId}-storage-removed`,
      promotionId: null,
      name: '+5 GB Bonus Storage',
      publicCode: '',
      discountType: 'bonus_storage',
      quantity: 5,
      slotMode: 'additional',
      toolSlugs: [],
      durationUnit: 'months',
      durationAmount: 6,
      source: 'manual',
      effectiveDate: isoDateOffset(-400),
      expirationDate: isoDateOffset(40),
      status: 'removed',
      assignedAt: timestampDaysAgo(400),
      assignedBy: 'Superadmin',
      notes: 'Earlier storage grant. The record stays after it was ended.',
      removedAt: timestampDaysAgo(15),
      removedBy: 'Superadmin',
      removalReason: 'Customer request',
    }),
  ];
}

export function entitlementFromPromotion(userId: string, code: DiscountCode, notes: string): UserEntitlement {
  const today = todayIsoDate();
  const effectiveDate = code.redeemStartDate && code.redeemStartDate > today ? code.redeemStartDate : today;
  const warning = promotionAssignmentWarning(code);
  const noteParts = [notes.trim()];
  if (warning?.tone === 'override') noteParts.push('Assigned with an admin override.');
  return {
    id: crypto.randomUUID(),
    userId,
    promotionId: code.id,
    name: code.internalName,
    publicCode: code.publicCode,
    discountType: code.discountType,
    quantity: code.quantity,
    slotMode: code.slotMode,
    toolSlugs: [...code.toolSlugs],
    durationUnit: code.durationUnit,
    durationAmount: code.durationAmount,
    source: 'admin_assigned',
    effectiveDate,
    expirationDate: addDuration(effectiveDate, code.durationUnit, code.durationAmount),
    status: 'active',
    assignedAt: new Date().toISOString(),
    assignedBy: 'Superadmin',
    notes: noteParts.filter(Boolean).join(' '),
    removedAt: null,
    removedBy: '',
    removalReason: '',
  };
}

export function entitlementFromManual(userId: string, draft: ManualEntitlementDraft): UserEntitlement {
  const fields = {
    discountType: draft.discountType,
    quantity: draft.discountType === 'percent_100' ? 100 : draft.quantity,
    slotMode: draft.slotMode,
    toolSlugs: draft.discountType === 'specific_tools' ? [...draft.toolSlugs] : [],
    durationUnit: draft.durationUnit,
    durationAmount: draft.durationUnit === 'lifetime' ? 0 : draft.durationAmount,
  };
  return {
    id: crypto.randomUUID(),
    userId,
    promotionId: null,
    name: previewHeadline(fields),
    publicCode: '',
    ...fields,
    source: 'manual',
    effectiveDate: draft.effectiveDate,
    expirationDate: addDuration(draft.effectiveDate, draft.durationUnit, draft.durationAmount),
    status: 'active',
    assignedAt: new Date().toISOString(),
    assignedBy: 'Superadmin',
    notes: draft.notes.trim(),
    removedAt: null,
    removedBy: '',
    removalReason: '',
  };
}

export function endEntitlement(item: UserEntitlement, reason: string): UserEntitlement {
  return {
    ...item,
    status: 'removed',
    removedAt: new Date().toISOString(),
    removedBy: 'Superadmin',
    removalReason: reason.trim(),
  };
}

export function durationSummary(item: Pick<UserEntitlement, 'durationUnit' | 'durationAmount'>): string {
  return durationPhrase(item.durationUnit, item.durationAmount);
}

function readStore(): Store {
  if (typeof window === 'undefined') return { version: 1, byUser: {} };
  try {
    const raw = window.sessionStorage.getItem(USER_ENTITLEMENT_STORAGE_KEY);
    if (!raw) return { version: 1, byUser: {} };
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || parsed.version !== 1 || !parsed.byUser || typeof parsed.byUser !== 'object') {
      return { version: 1, byUser: {} };
    }
    return parsed;
  } catch {
    return { version: 1, byUser: {} };
  }
}

function writeStore(store: Store) {
  window.sessionStorage.setItem(USER_ENTITLEMENT_STORAGE_KEY, JSON.stringify(store));
}

function notify() {
  snapshotCache.clear();
  listeners.forEach((listener) => listener());
}

export function subscribeUserEntitlements(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUserEntitlementServerSnapshot(): UserEntitlement[] | null {
  return null;
}

export function getUserEntitlementSnapshot(userId: string): UserEntitlement[] {
  if (!userId) return EMPTY_LIST;
  const stored = readStore().byUser[userId];
  const signature = stored ? JSON.stringify(stored) : `seed:${userId}:${todayIsoDate()}`;
  const cached = snapshotCache.get(userId);
  if (cached && cached.signature === signature) return cached.list;
  const list = stored ?? createSeedEntitlements(userId);
  snapshotCache.set(userId, { signature, list });
  return list;
}

export function saveUserEntitlements(userId: string, list: UserEntitlement[]) {
  const store = readStore();
  store.byUser[userId] = list;
  writeStore(store);
  notify();
}

export function resetUserEntitlements(userId: string) {
  const store = readStore();
  delete store.byUser[userId];
  writeStore(store);
  notify();
}
