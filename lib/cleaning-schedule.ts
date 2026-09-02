export type FrequencyKind =
  | 'every_day'
  | 'every_x_days'
  | 'weekly'
  | 'every_x_weeks'
  | 'monthly'
  | 'every_x_months'
  | 'quarterly'
  | 'every_6_months'
  | 'annually'
  | 'custom'
  | 'first_weekend';

export type CleaningFrequency = {
  kind: FrequencyKind;
  intervalCount?: number;
  intervalUnit?: 'days' | 'weeks' | 'months';
  daysOfWeek?: number[];
  dayOfMonth?: number;
};

export type CleaningCategory = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type CleaningLibraryItem = {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  notes: string;
  isDefault: boolean;
  isHidden: boolean;
};

export type CleaningScheduledTask = {
  id: string;
  libraryItemId: string;
  frequency: CleaningFrequency;
  nextDueDate: string;
  lastCompletedDate: string | null;
  isActive: boolean;
  dateAdded: string;
  dateInactivated?: string;
};

export type CleaningCompletion = {
  id: string;
  scheduledTaskId: string;
  scheduledDate: string;
  completedDate: string;
  lateness: 'Early' | 'On time' | 'Late';
};

export type CleaningScheduleData = {
  categories: CleaningCategory[];
  items: CleaningLibraryItem[];
  tasks: CleaningScheduledTask[];
  completions: CleaningCompletion[];
};

export const FREQUENCY_KINDS: FrequencyKind[] = [
  'every_day',
  'every_x_days',
  'weekly',
  'every_x_weeks',
  'monthly',
  'every_x_months',
  'quarterly',
  'every_6_months',
  'annually',
  'custom',
  'first_weekend',
];

const FREQUENCY_KIND_SET = new Set<string>(FREQUENCY_KINDS);

export function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function asDateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.split('T')[0];
}

export function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseLocalDate(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

export function addMonthsSetDay(iso: string, months: number, dayOfMonth?: number): string {
  const date = parseLocalDate(iso);
  const totalMonths = date.getFullYear() * 12 + date.getMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;
  const day = dayOfMonth ?? date.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return toIso(new Date(year, month, Math.min(day, lastDay)));
}

export function compareIso(a: string, b: string): number {
  return a.localeCompare(b);
}

function firstSaturdayOfMonth(year: number, month: number): string {
  const first = new Date(year, month, 1);
  const offset = (6 - first.getDay() + 7) % 7;
  return toIso(new Date(year, month, 1 + offset));
}

export function nextFirstWeekendAfter(iso: string): string {
  const date = parseLocalDate(iso);
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  if (month > 11) {
    month = 0;
    year += 1;
  }
  return firstSaturdayOfMonth(year, month);
}

export function nextWeeklyAfter(iso: string, daysOfWeek: number[]): string {
  const selected = [...new Set(daysOfWeek)].sort((a, b) => a - b);
  if (selected.length === 0) return addDays(iso, 7);
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDays(iso, offset);
    if (selected.includes(parseLocalDate(candidate).getDay())) return candidate;
  }
  return addDays(iso, 7);
}

export function advanceFrom(basisIso: string, frequency: CleaningFrequency): string {
  const count = Math.max(1, frequency.intervalCount ?? 1);
  switch (frequency.kind) {
    case 'every_day':
      return addDays(basisIso, 1);
    case 'every_x_days':
      return addDays(basisIso, count);
    case 'weekly':
      return nextWeeklyAfter(basisIso, frequency.daysOfWeek ?? []);
    case 'every_x_weeks':
      return addDays(basisIso, count * 7);
    case 'monthly':
      return addMonthsSetDay(basisIso, 1, frequency.dayOfMonth);
    case 'every_x_months':
      return addMonthsSetDay(basisIso, count, frequency.dayOfMonth);
    case 'quarterly':
      return addMonthsSetDay(basisIso, 3, frequency.dayOfMonth);
    case 'every_6_months':
      return addMonthsSetDay(basisIso, 6, frequency.dayOfMonth);
    case 'annually':
      return addMonthsSetDay(basisIso, 12, frequency.dayOfMonth);
    case 'custom':
      if (frequency.intervalUnit === 'weeks') return addDays(basisIso, count * 7);
      if (frequency.intervalUnit === 'months') return addMonthsSetDay(basisIso, count, frequency.dayOfMonth);
      return addDays(basisIso, count);
    case 'first_weekend':
      return nextFirstWeekendAfter(basisIso);
    default:
      return addDays(basisIso, 1);
  }
}

export function latenessFor(scheduledDate: string, completedDate: string): CleaningCompletion['lateness'] {
  if (compareIso(completedDate, scheduledDate) < 0) return 'Early';
  if (completedDate === scheduledDate) return 'On time';
  return 'Late';
}

function parseDaysOfWeek(value: unknown): number[] | undefined {
  if (!value) return undefined;
  const raw = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(raw)) return undefined;
  const days = raw.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return days.length ? days : undefined;
}

export function dbToFrequency(row: {
  frequency: string;
  interval_count?: number | null;
  interval_unit?: string | null;
  days_of_week?: unknown;
  day_of_month?: number | null;
}): CleaningFrequency {
  const frequency: CleaningFrequency = {
    kind: FREQUENCY_KIND_SET.has(row.frequency) ? (row.frequency as FrequencyKind) : 'every_day',
  };
  if (row.interval_count != null) frequency.intervalCount = row.interval_count;
  if (row.interval_unit === 'days' || row.interval_unit === 'weeks' || row.interval_unit === 'months') {
    frequency.intervalUnit = row.interval_unit;
  }
  const days = parseDaysOfWeek(row.days_of_week);
  if (days) frequency.daysOfWeek = days;
  if (row.day_of_month != null) frequency.dayOfMonth = row.day_of_month;
  return frequency;
}

export function frequencyToDb(frequency: CleaningFrequency) {
  const needsCount =
    frequency.kind === 'every_x_days' ||
    frequency.kind === 'every_x_weeks' ||
    frequency.kind === 'every_x_months' ||
    frequency.kind === 'custom';
  const needsDay =
    frequency.kind === 'monthly' ||
    frequency.kind === 'every_x_months' ||
    frequency.kind === 'quarterly' ||
    frequency.kind === 'every_6_months' ||
    frequency.kind === 'annually';

  return {
    frequency: frequency.kind,
    interval_count: needsCount ? Math.max(1, frequency.intervalCount ?? 1) : null,
    interval_unit: frequency.kind === 'custom' ? frequency.intervalUnit ?? 'days' : null,
    days_of_week: frequency.kind === 'weekly' ? frequency.daysOfWeek ?? [] : null,
    day_of_month: needsDay ? frequency.dayOfMonth ?? null : null,
  };
}

export function isFrequencyValid(frequency: CleaningFrequency): boolean {
  if (!FREQUENCY_KIND_SET.has(frequency.kind)) return false;
  if (frequency.kind === 'weekly') return Array.isArray(frequency.daysOfWeek) && frequency.daysOfWeek.length > 0;
  if (
    frequency.kind === 'every_x_days' ||
    frequency.kind === 'every_x_weeks' ||
    frequency.kind === 'every_x_months' ||
    frequency.kind === 'custom'
  ) {
    if (!Number.isInteger(frequency.intervalCount) || (frequency.intervalCount ?? 0) < 1) return false;
  }
  if (frequency.kind === 'monthly') {
    return Number.isInteger(frequency.dayOfMonth) && (frequency.dayOfMonth ?? 0) >= 1 && (frequency.dayOfMonth ?? 0) <= 31;
  }
  if (frequency.kind === 'custom') {
    return frequency.intervalUnit === 'days' || frequency.intervalUnit === 'weeks' || frequency.intervalUnit === 'months';
  }
  return true;
}
