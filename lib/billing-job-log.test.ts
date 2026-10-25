import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BILLING_JOB_STALE_MS,
  BILLING_JOB_STALL_MS,
  billingJobDurationSeconds,
  billingJobNote,
  billingJobOverdue,
  billingJobStatus,
  formatJobDuration,
} from './billing-job-log';

const now = Date.parse('2026-10-25T12:00:00.000Z');

test('a job still running after half an hour is stalled', () => {
  assert.equal(billingJobStatus({
    status: 'running',
    startedAt: new Date(now - BILLING_JOB_STALL_MS).toISOString(),
    now,
  }), 'stalled');
  assert.equal(billingJobStatus({
    status: 'running',
    startedAt: new Date(now - 60 * 1000).toISOString(),
    now,
  }), 'running');
});

test('the nightly job is overdue when the last finish is more than a day old', () => {
  const recent = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const old = new Date(now - BILLING_JOB_STALE_MS).toISOString();
  assert.equal(billingJobOverdue([{ status: 'completed', startedAt: recent, finishedAt: recent }], now), false);
  assert.equal(billingJobOverdue([{ status: 'completed', startedAt: old, finishedAt: old }], now), true);
  assert.equal(billingJobOverdue([], now), true);
  assert.equal(billingJobOverdue([{
    status: 'running',
    startedAt: new Date(now - 60 * 1000).toISOString(),
    finishedAt: null,
  }], now), false);
});

test('job notes do not keep an email address or an account id', () => {
  const note = billingJobNote('Invoice failed for owner@example.com user 11111111-1111-4111-8111-111111111111');
  assert.equal(note.includes('owner@example.com'), false);
  assert.equal(note.includes('11111111-1111-4111-8111-111111111111'), false);
  assert.match(note, /Invoice failed/);
});

test('job duration is shown in seconds or minutes', () => {
  assert.equal(billingJobDurationSeconds('2026-10-25T11:15:00.000Z', '2026-10-25T11:15:12.000Z'), 12);
  assert.equal(formatJobDuration(12), '12s');
  assert.equal(formatJobDuration(75), '1m 15s');
  assert.equal(formatJobDuration(null), '—');
});
