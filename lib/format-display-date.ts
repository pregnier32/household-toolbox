/**
 * User-visible calendar dates as zero-padded MM/DD/YYYY.
 * Date-only strings are split as calendar days so UTC midnight does not shift the day.
 * Form inputs stay ISO. Free-form notes and day-of-month numbers are not passed here.
 */
export function formatDisplayDate(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${month}/${day}/${value.getFullYear()}`;
  }
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!slash) return value;
  return `${slash[1].padStart(2, '0')}/${slash[2].padStart(2, '0')}/${slash[3]}`;
}
