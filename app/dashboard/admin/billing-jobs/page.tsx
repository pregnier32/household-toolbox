'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SideLogo } from '../../../components/SideLogo';
import { AdminMenu } from '../../../components/AdminMenu';
import { UserMenu } from '../../../components/UserMenu';
import { useTheme } from '../../../components/AppThemeProvider';
import { completeSignOut } from '@/lib/client-sign-out';
import { formatJobDuration, type BillingJobStatus } from '@/lib/billing-job-log';

type JobRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: BillingJobStatus;
  scannedCount: number;
  failedCount: number;
  retriedEventCount: number;
  durationSeconds: number | null;
  note: string | null;
};

type JobLog = {
  scheduleLabel: string;
  path: string;
  mode: 'test' | 'live';
  overdue: boolean;
  waiting: {
    failedEvents: number;
    unfinishedOperations: number;
    recentEventTypes: Array<{ type: string; at: string }>;
  };
  runs: JobRun[];
};

const STATUS_LABEL: Record<BillingJobStatus, string> = {
  completed: 'Completed',
  failed: 'Needs attention',
  running: 'Running',
  stalled: 'Did not finish',
};

function formatWhen(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BillingJobsPage() {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const router = useRouter();
  const [user, setUser] = useState<{ firstName?: string; lastName?: string; userStatus?: string } | null>(null);
  const [log, setLog] = useState<JobLog | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headerChromeButtonClass = isLight
    ? 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900'
    : 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100';
  const headerBarClass = isLight ? 'border-b-2 border-slate-400 bg-slate-900/50' : 'border-b border-slate-800 bg-slate-900/50';
  const backLinkClass = isLight
    ? 'mb-4 flex items-center gap-2 text-sm text-slate-700 transition-colors hover:text-slate-900'
    : 'mb-4 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-300';
  const pageTitleClass = isLight ? 'text-2xl font-semibold text-slate-900' : 'text-2xl font-semibold text-slate-50';
  const pageSubtitleClass = isLight ? 'mt-1 text-sm text-slate-600' : 'mt-1 text-sm text-slate-400';
  const cardClass = isLight
    ? 'rounded-lg border border-slate-200 bg-white p-5 shadow-sm'
    : 'rounded-lg border border-slate-800 bg-slate-900/70 p-5';
  const labelClass = isLight ? 'text-xs font-medium uppercase tracking-wide text-slate-500' : 'text-xs font-medium uppercase tracking-wide text-slate-400';
  const valueClass = isLight ? 'mt-1 text-lg font-semibold text-slate-900' : 'mt-1 text-lg font-semibold text-slate-50';
  const mutedClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400';
  const tableWrapClass = isLight
    ? 'overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm'
    : 'overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/70';
  const headClass = isLight ? 'bg-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-600' : 'bg-slate-800/50 text-left text-xs font-medium uppercase tracking-wide text-slate-300';
  const rowClass = isLight ? 'border-t border-slate-200 hover:bg-slate-50' : 'border-t border-slate-800 hover:bg-slate-800/30';
  const cellClass = isLight ? 'px-4 py-3 text-sm text-slate-700' : 'px-4 py-3 text-sm text-slate-300';

  useEffect(() => {
    fetch('/api/auth/session')
      .then((response) => response.json())
      .then((data) => {
        if (!data.user) {
          router.push('/');
          return;
        }
        setUser(data.user);
        if (data.user.userStatus !== 'superadmin') {
          router.push('/dashboard');
          return;
        }
        return fetch('/api/admin/billing-jobs', { cache: 'no-store' })
          .then((response) => response.json())
          .then((body) => {
            if (body.error) throw new Error(body.error);
            setLog(body);
            setSelectedId(body.runs?.[0]?.id ?? null);
            setIsLoading(false);
          });
      })
      .catch(() => {
        setError('The nightly billing log could not be loaded.');
        setIsLoading(false);
      });
  }, [router]);

  const handleSignOut = async () => {
    await completeSignOut();
  };

  const selected = log?.runs.find((run) => run.id === selectedId) ?? null;

  if (isLoading) {
    return (
      <main className={`min-h-screen ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-950 text-slate-400'}`}>
        <div className="mx-auto max-w-7xl px-4 py-8">Loading nightly billing...</div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      <header className={headerBarClass}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <SideLogo priority />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push('/dashboard')} className={headerChromeButtonClass}>
              <span>Back to Toolbox</span>
            </button>
            <AdminMenu />
            <UserMenu
              userName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Account'}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <button type="button" onClick={() => router.push('/dashboard/admin/site-maintenance')} className={backLinkClass}>
          <span>Back to Site Maintenance</span>
        </button>
        <div className="mb-6">
          <h1 className={pageTitleClass}>Nightly Billing</h1>
          <p className={pageSubtitleClass}>
            The daily job checks each household bill, charges a trial that has ended, and records the Stripe renewal.
          </p>
        </div>
        {error && (
          <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${isLight ? 'border-red-300 bg-red-50 text-red-800' : 'border-red-500/50 bg-red-500/10 text-red-300'}`}>{error}</div>
        )}
        {log && (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-4">
              <section className={cardClass}>
                <p className={labelClass}>Schedule</p>
                <p className={valueClass}>{log.scheduleLabel}</p>
                <p className={`mt-2 ${mutedClass}`}>{log.mode === 'live' ? 'Live billing' : 'Sandbox billing'}</p>
                <p className={`mt-1 ${mutedClass}`}>{log.path}</p>
              </section>
              <section className={cardClass}>
                <p className={labelClass}>Latest run</p>
                <p className={valueClass}>{log.runs[0] ? formatWhen(log.runs[0].startedAt) : 'None recorded'}</p>
                <p className={`mt-2 ${mutedClass}`}>{log.runs[0] ? STATUS_LABEL[log.runs[0].status] : 'The job has not written a log yet.'}</p>
              </section>
              <section className={cardClass}>
                <p className={labelClass}>Daily check</p>
                <p className={valueClass}>{log.overdue ? 'Overdue' : 'On schedule'}</p>
                <p className={`mt-2 ${mutedClass}`}>
                  {log.overdue
                    ? 'No finished run in the last day. The next daily run still picks up missed bills.'
                    : 'A run has finished within the last day, or one is in progress.'}
                </p>
              </section>
              <section className={cardClass}>
                <p className={labelClass}>Waiting for the next run</p>
                <p className={valueClass}>{log.waiting.failedEvents + log.waiting.unfinishedOperations}</p>
                <p className={`mt-2 ${mutedClass}`}>
                  {log.waiting.failedEvents} failed Stripe event{log.waiting.failedEvents === 1 ? '' : 's'} and {log.waiting.unfinishedOperations} unfinished billing operation{log.waiting.unfinishedOperations === 1 ? '' : 's'}.
                </p>
              </section>
            </div>
            {log.waiting.recentEventTypes.length > 0 && (
              <section className={`mb-6 ${cardClass}`}>
                <p className={labelClass}>Failed Stripe events the job will retry</p>
                <ul className="mt-3 space-y-2">
                  {log.waiting.recentEventTypes.map((event) => (
                    <li key={`${event.type}-${event.at}`} className={mutedClass}>
                      {event.type} · {formatWhen(event.at)}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,0.8fr)]">
              <div className={tableWrapClass}>
                <table className="min-w-full">
                  <thead className={headClass}>
                    <tr>
                      <th className="px-4 py-3">Started</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Checked</th>
                      <th className="px-4 py-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.runs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className={cellClass}>No nightly billing job has been recorded yet.</td>
                      </tr>
                    ) : log.runs.map((run) => (
                      <tr
                        key={run.id}
                        className={`${rowClass} cursor-pointer ${selectedId === run.id ? (isLight ? 'bg-emerald-50' : 'bg-emerald-500/10') : ''}`}
                        onClick={() => setSelectedId(run.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedId(run.id);
                          }
                        }}
                        tabIndex={0}
                      >
                        <td className={cellClass}>{formatWhen(run.startedAt)}</td>
                        <td className={cellClass}>{STATUS_LABEL[run.status]}</td>
                        <td className={cellClass}>{run.scannedCount}</td>
                        <td className={cellClass}>{formatJobDuration(run.durationSeconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <section className={cardClass}>
                <p className={labelClass}>Run detail</p>
                {selected ? (
                  <dl className="mt-3 space-y-3">
                    <div>
                      <dt className={labelClass}>Started</dt>
                      <dd className={mutedClass}>{formatWhen(selected.startedAt)}</dd>
                    </div>
                    <div>
                      <dt className={labelClass}>Finished</dt>
                      <dd className={mutedClass}>{formatWhen(selected.finishedAt)}</dd>
                    </div>
                    <div>
                      <dt className={labelClass}>Households checked</dt>
                      <dd className={mutedClass}>{selected.scannedCount}</dd>
                    </div>
                    <div>
                      <dt className={labelClass}>Problems</dt>
                      <dd className={mutedClass}>{selected.failedCount}</dd>
                    </div>
                    <div>
                      <dt className={labelClass}>Stripe events retried</dt>
                      <dd className={mutedClass}>{selected.retriedEventCount}</dd>
                    </div>
                    <div>
                      <dt className={labelClass}>Note</dt>
                      <dd className={`${mutedClass} whitespace-pre-wrap`}>{selected.note || 'No problems were recorded.'}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className={`mt-3 ${mutedClass}`}>Select a run to see what it recorded.</p>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
