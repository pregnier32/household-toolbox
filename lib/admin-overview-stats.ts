/**
 * Date window for the superadmin System Stats page.
 * The selected day is the start. Counts include that day and everything after it.
 * Days are calendar days in America/Chicago.
 */

export const STATS_TIME_ZONE = 'America/Chicago';
export const DEFAULT_AS_OF_DATE = '2026-10-01';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type MonthBucket = {
  month: string;
  monthKey: string;
};

export type ResolvedAsOf = {
  date: string;
  start: string;
  series: MonthBucket[];
};

export type LedgerInvoiceRow = {
  stripeInvoiceId: string;
  userId: string;
  status: string;
  amountPaidCents: number;
  createdAt: string;
  livemode: boolean | null;
};

export type PaymentEventRow = {
  type: string;
  createdAt: string;
  payload: unknown;
};

export type CollectedPayment = {
  paidAt: string;
  amountCents: number;
};

const COUNTED_INVOICE_STATUSES = new Set(['paid', 'open', 'uncollectible']);

export function resolveAsOf(raw: string | null | undefined, now = new Date()): ResolvedAsOf {
  const date = isIsoDate(raw) ? raw : DEFAULT_AS_OF_DATE;
  return {
    date,
    start: startOfCalendarDay(date).toISOString(),
    series: monthSeriesFrom(date, now),
  };
}

export function calendarDateInZone(instant: Date, timeZone = STATS_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const year = part(parts, 'year');
  const month = part(parts, 'month');
  const day = part(parts, 'day');
  return `${year}-${month}-${day}`;
}

export function calendarMonthKey(instant: Date, timeZone = STATS_TIME_ZONE): string {
  return calendarDateInZone(instant, timeZone).slice(0, 7);
}

export function asOfMonthLabel(isoDate: string): string {
  const match = ISO_DATE.exec(isoDate);
  if (!match) return isoDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function monthSeriesFrom(startDate: string, now = new Date()): MonthBucket[] {
  const start = ISO_DATE.exec(startDate);
  const end = ISO_DATE.exec(calendarDateInZone(now));
  if (!start || !end) return [];
  let year = Number(start[1]);
  let month = Number(start[2]);
  let endYear = Number(end[1]);
  let endMonth = Number(end[2]);
  if (endYear < year || (endYear === year && endMonth < month)) {
    endYear = year;
    endMonth = month;
  }
  const series: MonthBucket[] = [];
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    series.push({
      monthKey,
      month: new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    if (series.length > 36) break;
  }
  return series.length > 12 ? series.slice(-12) : series;
}

export function paymentsFromLedger(input: {
  invoices: LedgerInvoiceRow[];
  events: PaymentEventRow[];
  livemode: boolean;
  excludeUserIds: string[];
}): CollectedPayment[] {
  const excluded = new Set(input.excludeUserIds);
  const stamps = new Map<string, string>();
  for (const event of input.events) {
    const stamp = paidStampFromEvent(event);
    if (stamp) stamps.set(stamp.id, stamp.paidAt);
  }
  return input.invoices.flatMap((invoice) => {
    if (!invoiceMatchesMode(invoice.livemode, input.livemode)) return [];
    if (!COUNTED_INVOICE_STATUSES.has(invoice.status)) return [];
    if (invoice.amountPaidCents <= 0) return [];
    if (excluded.has(invoice.userId)) return [];
    return [{
      paidAt: stamps.get(invoice.stripeInvoiceId) ?? invoice.createdAt,
      amountCents: invoice.amountPaidCents,
    }];
  });
}

export type LiveSubscriptionRow = {
  userId: string;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  livemode: boolean | null;
  billingCycleAnchor: string | null;
  currentPeriodEnd: string | null;
  syncedAmountCents: number | null;
};

const EXPECTED_SUBSCRIPTION_STATUSES = new Set(['active', 'past_due', 'trialing']);

/** Recurring amount a live subscription will bill, on its billing day of the month. */
export function liveSubscriptionCharges(
  rows: LiveSubscriptionRow[],
  excludeUserIds: string[] = [],
): { at: string; amountCents: number }[] {
  const excluded = new Set(excludeUserIds);
  return rows.flatMap((row) => {
    if (row.livemode !== true) return [];
    if (row.cancelAtPeriodEnd) return [];
    if (!row.status || !EXPECTED_SUBSCRIPTION_STATUSES.has(row.status)) return [];
    if (excluded.has(row.userId)) return [];
    const amountCents = row.syncedAmountCents ?? 0;
    if (amountCents <= 0) return [];
    const at = row.billingCycleAnchor || row.currentPeriodEnd;
    if (!at || !Number.isFinite(Date.parse(at))) return [];
    return [{ at, amountCents }];
  });
}

export function revenueByDayOfMonth(
  bills: { at: string; amountCents: number }[],
  timeZone = STATS_TIME_ZONE,
): { day: string; revenue: number }[] {
  const totals = Array.from({ length: 32 }, () => 0);
  for (const bill of bills) {
    const atMs = Date.parse(bill.at);
    if (!Number.isFinite(atMs) || bill.amountCents <= 0) continue;
    const day = Number(calendarDateInZone(new Date(atMs), timeZone).slice(8, 10));
    if (day < 1 || day > 31) continue;
    totals[day] += bill.amountCents;
  }
  return totals.slice(1).map((cents, index) => ({
    day: String(index + 1),
    revenue: centsToDollars(cents),
  }));
}

export function revenueSummary(
  payments: CollectedPayment[],
  asOfDate: string,
  timeZone = STATS_TIME_ZONE,
): { monthlyRevenue: number; lifetimeRevenue: number } {
  const startMs = startOfCalendarDay(asOfDate, timeZone).getTime();
  const monthPrefix = asOfDate.slice(0, 7);
  let lifetimeCents = 0;
  let monthlyCents = 0;
  for (const payment of payments) {
    const paidMs = Date.parse(payment.paidAt);
    if (!Number.isFinite(paidMs) || paidMs < startMs || payment.amountCents <= 0) continue;
    lifetimeCents += payment.amountCents;
    const day = calendarDateInZone(new Date(paidMs), timeZone);
    if (day.startsWith(monthPrefix)) monthlyCents += payment.amountCents;
  }
  return {
    monthlyRevenue: centsToDollars(monthlyCents),
    lifetimeRevenue: centsToDollars(lifetimeCents),
  };
}

function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

function invoiceMatchesMode(rowLivemode: boolean | null, livemode: boolean): boolean {
  if (rowLivemode == null) return !livemode;
  return rowLivemode === livemode;
}

function paidStampFromEvent(event: PaymentEventRow): { id: string; paidAt: string } | null {
  if (!event.payload || typeof event.payload !== 'object') return null;
  const body = event.payload as { created?: unknown; data?: { object?: Record<string, unknown> } };
  const object = body.data?.object;
  const id = object && typeof object.id === 'string' ? object.id : null;
  if (!id) return null;
  if (event.type === 'invoice.paid') {
    const transitions = object?.status_transitions;
    const paidAt = unixSeconds(transitions && typeof transitions === 'object' ? (transitions as { paid_at?: unknown }).paid_at : null)
      ?? unixSeconds(body.created)
      ?? event.createdAt;
    return { id, paidAt };
  }
  if (event.type === 'payment_intent.succeeded') {
    const paidAt = unixSeconds(object?.created) ?? unixSeconds(body.created) ?? event.createdAt;
    return { id, paidAt };
  }
  return null;
}

function unixSeconds(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function isIsoDate(value: string | null | undefined): value is string {
  if (!value) return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

function startOfCalendarDay(isoDate: string, timeZone = STATS_TIME_ZONE): Date {
  const match = ISO_DATE.exec(isoDate);
  if (!match) return new Date(NaN);
  return zonedDateTimeToUtc(Number(match[1]), Number(match[2]), Number(match[3]), 0, 0, 0, timeZone);
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstOffset = timeZoneOffsetMs(new Date(utcGuess), timeZone);
  let utc = utcGuess - firstOffset;
  const secondOffset = timeZoneOffsetMs(new Date(utc), timeZone);
  if (secondOffset !== firstOffset) utc = utcGuess - secondOffset;
  return new Date(utc);
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  let hour = Number(part(parts, 'hour'));
  let day = Number(part(parts, 'day'));
  const year = Number(part(parts, 'year'));
  const month = Number(part(parts, 'month'));
  if (hour === 24) {
    hour = 0;
    day += 1;
  }
  const asUtc = Date.UTC(year, month - 1, day, hour, Number(part(parts, 'minute')), Number(part(parts, 'second')));
  return asUtc - instant.getTime();
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((item) => item.type === type)?.value ?? '';
}
