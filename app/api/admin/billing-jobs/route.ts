import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { requireSuperAdmin } from '@/lib/release-notes-admin';
import { stripeLivemode, stripeMode } from '@/lib/stripe-mode';
import {
  BILLING_JOB_PATH,
  BILLING_JOB_SCHEDULE_LABEL,
  billingJobDurationSeconds,
  billingJobNote,
  billingJobOverdue,
  billingJobStatus,
  type BillingJobStatus,
} from '@/lib/billing-job-log';

type RunRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  scanned_count: number | null;
  failed_count: number | null;
  retried_event_count: number | null;
  last_error: string | null;
  detail: string | null;
};

function missingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return error.code === '42P01' || error.code === 'PGRST205' || message.includes('does not exist') || message.includes('schema cache');
}

function countOf(result: { error: { code?: string; message?: string } | null; count: number | null }): number {
  if (!result.error) return result.count ?? 0;
  if (missingRelation(result.error)) return 0;
  throw result.error;
}

function recentEventTypes(result: { error: { code?: string; message?: string } | null; data: Array<{ type?: string | null; created_at?: string | null }> | null }) {
  if (result.error) {
    if (missingRelation(result.error)) return [];
    throw result.error;
  }
  return (result.data ?? []).flatMap((row) => (
    typeof row.type === 'string' && typeof row.created_at === 'string'
      ? [{ type: row.type, at: row.created_at }]
      : []
  ));
}

export async function GET() {
  const denied = requireSuperAdmin(await getSession());
  if (denied) return denied;
  const now = Date.now();
  try {
    const [runsResult, failedEvents, unfinishedOperations, recentFailures] = await Promise.all([
      supabaseServer
        .from('billing_reconcile_runs')
        .select('id, started_at, finished_at, status, scanned_count, failed_count, retried_event_count, last_error, detail')
        .order('started_at', { ascending: false })
        .limit(60),
      supabaseServer
        .from('stripe_events')
        .select('stripe_event_id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .eq('livemode', stripeLivemode()),
      supabaseServer
        .from('billing_operations')
        .select('id', { count: 'exact', head: true })
        .in('status', ['started', 'stripe_succeeded', 'failed'])
        .eq('livemode', stripeLivemode()),
      supabaseServer
        .from('stripe_events')
        .select('type, created_at')
        .eq('status', 'failed')
        .eq('livemode', stripeLivemode())
        .order('created_at', { ascending: false })
        .limit(5),
    ]);
    if (runsResult.error) throw runsResult.error;
    const rows = (runsResult.data ?? []) as RunRow[];
    const runs = rows.map((row) => {
      const status: BillingJobStatus = billingJobStatus({ status: row.status, startedAt: row.started_at, now });
      const note = billingJobNote(row.detail || row.last_error || '');
      return {
        id: row.id,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        status,
        scannedCount: row.scanned_count ?? 0,
        failedCount: row.failed_count ?? 0,
        retriedEventCount: row.retried_event_count ?? 0,
        durationSeconds: billingJobDurationSeconds(row.started_at, row.finished_at),
        note: note || null,
      };
    });
    const mode = stripeMode();
    return NextResponse.json({
      scheduleLabel: BILLING_JOB_SCHEDULE_LABEL,
      path: BILLING_JOB_PATH,
      mode,
      overdue: billingJobOverdue(rows.map((row) => ({
        status: row.status,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
      })), now),
      waiting: {
        failedEvents: countOf(failedEvents),
        unfinishedOperations: countOf(unfinishedOperations),
        recentEventTypes: recentEventTypes(recentFailures),
      },
      runs,
    });
  } catch (error) {
    console.error('Billing job log could not be loaded', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The nightly billing log could not be loaded.' }, { status: 500 });
  }
}
