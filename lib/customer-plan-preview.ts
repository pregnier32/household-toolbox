/**
 * Customer Plan & Billing preview.
 *
 * UI only. The sample plan lives in sessionStorage so the signed-in customer
 * screens can be clicked through. This module does not read or write billing,
 * trials, Stripe, or the database, and it does not store admin notes.
 */
import { formatDisplayDate } from '@/lib/format-display-date';
import {
  getDisplayStatus,
  normalizePublicCode,
  previewHeadline,
  todayIsoDate,
  toolNamesForSlugs,
  type DiscountCode,
} from '@/lib/discount-codes';
import { addDuration, daysBetween, EXPIRING_SOON_DAYS } from '@/lib/user-entitlements-preview';

export const CUSTOMER_PLAN_STORAGE_KEY = 'household-toolbox-customer-plan-preview-v1';

export const BILLING_PLACEHOLDER = 'Not available until billing is implemented';

/** This preview account already has tools and older promotions, so it is not a new account. */
export const SAMPLE_ACCOUNT_IS_NEW = false;

export type CustomerPlanSource = 'included' | 'code' | 'added';

export const CUSTOMER_SOURCE_LABELS: Record<CustomerPlanSource, string> = {
  included: 'Included with your account',
  code: 'Discount code',
  added: 'Added to your account',
};

export type CustomerBenefitView = 'active' | 'expires_soon' | 'scheduled' | 'lifetime' | 'expired' | 'removed';

export const CUSTOMER_VIEW_LABELS: Record<CustomerBenefitView, string> = {
  active: 'Active',
  expires_soon: 'Expires Soon',
  scheduled: 'Scheduled',
  lifetime: 'Lifetime',
  expired: 'Expired',
  removed: 'Removed',
};

export type CustomerPlanBenefit = {
  id: string;
  name: string;
  publicCode: string;
  benefit: string;
  description: string;
  effectiveDate: string;
  expirationDate: string | null;
  status: 'active' | 'removed';
  source: CustomerPlanSource;
};

export type ApplyCodeResult =
  | { ok: true; benefit: CustomerPlanBenefit; headline: string }
  | { ok: false; message: string };

type Store = {
  version: 1;
  benefits: CustomerPlanBenefit[];
};

const listeners = new Set<() => void>();
let snapshot: { signature: string; list: CustomerPlanBenefit[] } | null = null;

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function customerBenefitView(item: Pick<CustomerPlanBenefit, 'status' | 'effectiveDate' | 'expirationDate'>, today = todayIsoDate()): CustomerBenefitView {
  if (item.status === 'removed') return 'removed';
  if (item.effectiveDate > today) return 'scheduled';
  if (item.expirationDate && item.expirationDate < today) return 'expired';
  if (!item.expirationDate) return 'lifetime';
  if (daysBetween(today, item.expirationDate) <= EXPIRING_SOON_DAYS) return 'expires_soon';
  return 'active';
}

export function isCurrentCustomerBenefit(item: CustomerPlanBenefit, today = todayIsoDate()): boolean {
  const view = customerBenefitView(item, today);
  return view === 'active' || view === 'expires_soon' || view === 'scheduled' || view === 'lifetime';
}

export function isAffectingCustomerBenefit(item: CustomerPlanBenefit, today = todayIsoDate()): boolean {
  const view = customerBenefitView(item, today);
  return view === 'active' || view === 'expires_soon' || view === 'lifetime';
}

export function customerTiming(item: CustomerPlanBenefit, today = todayIsoDate()): string {
  const view = customerBenefitView(item, today);
  if (view === 'lifetime') return 'Lifetime';
  if (view === 'scheduled') return `Starts ${formatDisplayDate(item.effectiveDate)}`;
  if (!item.expirationDate) return 'Lifetime';
  if (view === 'expired' || view === 'removed') return 'Ended';
  const days = daysBetween(today, item.expirationDate);
  if (days === 0) return 'Ends today';
  if (days === 1) return '1 day remaining';
  return `${days} days remaining`;
}

export function customerBenefitTitle(item: CustomerPlanBenefit): string {
  return item.publicCode || item.name;
}

function customerBenefitText(code: DiscountCode): string {
  switch (code.discountType) {
    case 'free_tool_slots': {
      const count = Number.isFinite(code.quantity) ? code.quantity : 0;
      const noun = count === 1 ? 'Free Tool Slot' : 'Free Tool Slots';
      return code.slotMode === 'additional' ? `+${count} ${noun}` : `${count} ${noun}`;
    }
    case 'specific_tools': {
      const names = toolNamesForSlugs(code.toolSlugs);
      if (names.length === 0) return 'Selected tools free';
      if (names.length === 1) return `${names[0]} Free`;
      return `${names.length} tools free`;
    }
    case 'percent_100':
      return '100% Off';
    case 'percentage':
      return `${Number.isFinite(code.quantity) ? code.quantity : 0}% Off`;
    case 'fixed_amount': {
      const amount = Number.isFinite(code.quantity) ? code.quantity : 0;
      const dollars = Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
      return `${dollars} Off`;
    }
    case 'bonus_storage':
      return `+${Number.isFinite(code.quantity) ? code.quantity : 0} GB`;
    default:
      return 'Discount';
  }
}

export function createSeedCustomerPlan(): CustomerPlanBenefit[] {
  const launchStart = isoDateOffset(-20);
  const homeStart = isoDateOffset(-30);
  const springStart = isoDateOffset(30);

  return [
    {
      id: 'plan-newuser2',
      name: 'New User — 2 Free Tools',
      publicCode: 'NEWUSER2',
      benefit: '2 Free Tool Slots',
      description: 'Your personal account includes 2 free tool slots.',
      effectiveDate: isoDateOffset(-200),
      expirationDate: null,
      status: 'active',
      source: 'included',
    },
    {
      id: 'plan-launch90',
      name: 'Launch — 90 Days Free',
      publicCode: 'LAUNCH90',
      benefit: '100% Off',
      description: 'Everything billable is free for your first 90 days.',
      effectiveDate: launchStart,
      expirationDate: addDuration(launchStart, 'days', 90),
      status: 'active',
      source: 'code',
    },
    {
      id: 'plan-homefree',
      name: 'Home Maintenance Free Year',
      publicCode: 'HOMEFREE',
      benefit: 'Home Maintenance Schedule Free',
      description: 'Home Maintenance Schedule is free for 12 months.',
      effectiveDate: homeStart,
      expirationDate: addDuration(homeStart, 'months', 12),
      status: 'active',
      source: 'added',
    },
    {
      id: 'plan-storage',
      name: 'Bonus Storage',
      publicCode: '',
      benefit: '+5 GB',
      description: 'Extra space for files you keep with your tools.',
      effectiveDate: isoDateOffset(-355),
      expirationDate: isoDateOffset(10),
      status: 'active',
      source: 'added',
    },
    {
      id: 'plan-spring5',
      name: 'Spring $5 Monthly Credit',
      publicCode: 'SPRING5',
      benefit: '$5 Off',
      description: '$5 off each month for 6 months.',
      effectiveDate: springStart,
      expirationDate: addDuration(springStart, 'months', 6),
      status: 'active',
      source: 'added',
    },
    {
      id: 'plan-tiktok',
      name: 'Creator — 25% for 6 Months',
      publicCode: 'TIKTOK25',
      benefit: '25% Off',
      description: '25% off for 6 months.',
      effectiveDate: isoDateOffset(-200),
      expirationDate: isoDateOffset(-20),
      status: 'active',
      source: 'code',
    },
    {
      id: 'plan-storage-removed',
      name: 'Bonus Storage',
      publicCode: '',
      benefit: '+5 GB',
      description: 'Extra space for files you keep with your tools.',
      effectiveDate: isoDateOffset(-400),
      expirationDate: isoDateOffset(-15),
      status: 'removed',
      source: 'added',
    },
  ];
}

function benefitFromCode(code: DiscountCode): CustomerPlanBenefit {
  const today = todayIsoDate();
  const effectiveDate = code.redeemStartDate && code.redeemStartDate > today ? code.redeemStartDate : today;
  return {
    id: crypto.randomUUID(),
    name: code.internalName,
    publicCode: code.publicCode,
    benefit: customerBenefitText(code),
    description: code.customerDescription.trim() || previewHeadline(code),
    effectiveDate,
    expirationDate: addDuration(effectiveDate, code.durationUnit, code.durationAmount),
    status: 'active',
    source: 'code',
  };
}

export function applyCustomerCode(raw: string, benefits: CustomerPlanBenefit[], codes: DiscountCode[]): ApplyCodeResult {
  const publicCode = normalizePublicCode(raw);
  if (!publicCode) return { ok: false, message: 'Enter a discount code.' };

  const code = codes.find((item) => normalizePublicCode(item.publicCode) === publicCode);
  if (!code) return { ok: false, message: 'That code isn’t valid. Check the letters and try again.' };

  const display = getDisplayStatus(code);
  if (display === 'archived') return { ok: false, message: 'That code is no longer available.' };
  if (display === 'draft') return { ok: false, message: 'That code is not available.' };
  if (display === 'inactive') return { ok: false, message: 'That code is not active.' };
  if (display === 'expired') return { ok: false, message: 'That code has expired.' };
  if (display === 'scheduled') {
    return { ok: false, message: `That code isn’t active yet. It starts on ${formatDisplayDate(code.redeemStartDate)}.` };
  }
  if (code.eligibleUsers === 'new_users' && !SAMPLE_ACCOUNT_IS_NEW) {
    return { ok: false, message: 'This code is only for new accounts.' };
  }
  if (code.eligibleAccountType === 'business') {
    return { ok: false, message: 'This code is for business accounts.' };
  }
  if (code.perUserRedemption === 'once' && benefits.some((item) => normalizePublicCode(item.publicCode) === publicCode)) {
    return { ok: false, message: 'You have already used this code.' };
  }

  return { ok: true, benefit: benefitFromCode(code), headline: previewHeadline(code) };
}

function readStore(): Store | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CUSTOMER_PLAN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.benefits)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStore(store: Store) {
  window.sessionStorage.setItem(CUSTOMER_PLAN_STORAGE_KEY, JSON.stringify(store));
}

function notify() {
  snapshot = null;
  listeners.forEach((listener) => listener());
}

export function subscribeCustomerPlan(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCustomerPlanServerSnapshot(): CustomerPlanBenefit[] | null {
  return null;
}

export function getCustomerPlanSnapshot(): CustomerPlanBenefit[] {
  const stored = readStore();
  const signature = stored ? JSON.stringify(stored.benefits) : `seed:${todayIsoDate()}`;
  if (snapshot && snapshot.signature === signature) return snapshot.list;
  const list = stored?.benefits ?? createSeedCustomerPlan();
  snapshot = { signature, list };
  return list;
}

export function saveCustomerPlan(benefits: CustomerPlanBenefit[]) {
  writeStore({ version: 1, benefits });
  notify();
}

export function resetCustomerPlan() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(CUSTOMER_PLAN_STORAGE_KEY);
  notify();
}
