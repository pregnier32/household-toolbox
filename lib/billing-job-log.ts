/** The nightly billing job is scheduled once a day in vercel.json. */
export const BILLING_JOB_SCHEDULE_LABEL = 'Every day at 11:15 UTC';
export const BILLING_JOB_PATH = '/api/cron/billing-reconcile';
export const BILLING_JOB_STALE_MS = 26 * 60 * 60 * 1000;
export const BILLING_JOB_STALL_MS = 30 * 60 * 1000;

export type BillingJobStatus = 'running' | 'completed' | 'failed' | 'stalled';

export function billingJobNote(message: string): string {
  return message
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

export function billingJobDurationSeconds(startedAt: string, finishedAt: string | null): number | null {
  if (!finishedAt) return null;
  const started = Date.parse(startedAt);
  const finished = Date.parse(finishedAt);
  if (Number.isNaN(started) || Number.isNaN(finished) || finished < started) return null;
  return Math.round((finished - started) / 1000);
}

export function billingJobStatus(input: { status: string; startedAt: string; now: number }): BillingJobStatus {
  if (input.status === 'running') {
    const started = Date.parse(input.startedAt);
    if (!Number.isNaN(started) && input.now - started >= BILLING_JOB_STALL_MS) return 'stalled';
    return 'running';
  }
  if (input.status === 'completed' || input.status === 'failed') return input.status;
  return 'failed';
}

export function billingJobOverdue(
  runs: Array<{ status: string; startedAt: string; finishedAt: string | null }>,
  now: number,
): boolean {
  const active = runs.some((run) => run.status === 'running' && billingJobStatus({ status: run.status, startedAt: run.startedAt, now }) === 'running');
  if (active) return false;
  const finishedAt = runs
    .map((run) => run.finishedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((value) => !Number.isNaN(value))
    .sort((left, right) => right - left)[0];
  if (finishedAt == null) return true;
  return now - finishedAt >= BILLING_JOB_STALE_MS;
}

export function formatJobDuration(seconds: number | null): string {
  if (seconds == null || seconds < 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
  const hours = Math.floor(minutes / 60);
  const minuteRest = minutes % 60;
  return minuteRest === 0 ? `${hours}h` : `${hours}h ${minuteRest}m`;
}
