export const QUARTER_GROUPS = [
  { offset: 0, label: 'Jan, Apr, Jul, Oct' },
  { offset: 1, label: 'Feb, May, Aug, Nov' },
  { offset: 2, label: 'Mar, Jun, Sep, Dec' },
] as const;

/** Year-2000 dates stored in billed_date to remember a quarterly cycle. */
const QUARTER_ANCHOR_DATE = /^2000-0[123]-01$/;

export function isQuarterAnchorDate(isoDate: string | null | undefined): boolean {
  return QUARTER_ANCHOR_DATE.test(isoDate || '');
}

export function monthIndexFromIso(isoDate: string | null | undefined): number | null {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate || '');
  if (!match) return null;
  const month = Number(match[2]);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return month - 1;
}

export function quarterOffsetFromMonth(monthIndex: number): number {
  return ((monthIndex % 3) + 3) % 3;
}

export function quarterOffsetFromIso(isoDate: string | null | undefined): number | null {
  const month = monthIndexFromIso(isoDate);
  if (month == null) return null;
  return quarterOffsetFromMonth(month);
}

export function quarterAnchorDate(offset: number): string {
  const month = (quarterOffsetFromMonth(offset) % 3) + 1;
  return `2000-${String(month).padStart(2, '0')}-01`;
}

export function quarterGroupLabel(offset: number): string {
  return QUARTER_GROUPS[quarterOffsetFromMonth(offset)].label;
}

export function isQuarterMonth(viewedMonthIndex: number, anchorMonthIndex: number): boolean {
  return quarterOffsetFromMonth(viewedMonthIndex) === quarterOffsetFromMonth(anchorMonthIndex);
}

export function quarterAnchorMonthIndex(
  billedDate: string | null | undefined,
  dateAdded: string | null | undefined
): number | null {
  return monthIndexFromIso(billedDate) ?? monthIndexFromIso(dateAdded);
}
