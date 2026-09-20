'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserMenu } from '../../components/UserMenu';
import { SideLogo } from '../../components/SideLogo';
import { useTheme } from '../../components/AppThemeProvider';
import { completeSignOut } from '@/lib/client-sign-out';

type StorageToolUsage = {
  bucket: string;
  name: string;
  usedBytes: number;
};

type StorageDetails = {
  usedBytes: number;
  limitBytes: number;
  includedBytes: number;
  addonGb: number;
  percent: number;
  plan: 'free' | 'paid';
  planLabel: string;
  usedLabel: string;
  limitLabel: string;
  tools?: StorageToolUsage[];
};

function formatBytes(bytes: number): string {
  const safe = Math.max(0, bytes);
  if (safe < 1024) return `${safe} B`;
  if (safe < 1024 * 1024) return `${(safe / 1024).toFixed(safe < 10 * 1024 ? 1 : 0)} KB`;
  if (safe < 1024 * 1024 * 1024) return `${(safe / (1024 * 1024)).toFixed(safe < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(safe / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function StoragePage() {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const router = useRouter();
  const [userName, setUserName] = useState('Account');
  const [storage, setStorage] = useState<StorageDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headerChromeButtonClass = isLight
    ? 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900'
    : 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100';

  const headerBarClass = isLight
    ? 'border-b-2 border-slate-400 bg-slate-900/50'
    : 'border-b border-slate-800 bg-slate-900/50';

  const pageTitleClass = isLight ? 'text-2xl font-semibold text-slate-900' : 'text-2xl font-semibold text-slate-50';
  const pageSubtitleClass = isLight ? 'mt-1 text-sm text-slate-600' : 'mt-1 text-sm text-slate-400';
  const errorAlertClass = isLight
    ? 'mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
    : 'mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300';
  const cardClass = isLight
    ? 'rounded-lg border border-slate-200 bg-white p-6 shadow-sm'
    : 'rounded-lg border border-slate-800 bg-slate-900/70 p-6';
  const tableCardClass = isLight
    ? 'rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm'
    : 'rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden';
  const mutedClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400';
  const labelClass = isLight ? 'text-sm font-medium text-slate-800' : 'text-sm font-medium text-slate-200';
  const disabledButtonClass = isLight
    ? 'rounded-lg border-2 border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed'
    : 'rounded-lg border-2 border-slate-700 bg-slate-800/70 px-4 py-2.5 text-sm font-medium text-slate-500 cursor-not-allowed';

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUserName(`${data.user.firstName || ''} ${data.user.lastName || ''}`.trim() || 'Account');
        } else {
          router.push('/');
        }
      })
      .catch(() => router.push('/'));
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/storage?refresh=1')
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) throw new Error(data.error || 'Failed to load storage usage');
        setStorage(data.storage);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load storage usage');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    await completeSignOut();
  };

  const tools = storage?.tools ?? [];
  const barPercent = storage?.percent ?? 0;
  const barColor = barPercent >= 95 ? 'bg-red-500' : barPercent >= 80 ? 'bg-amber-400' : 'bg-emerald-500';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className={headerBarClass}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <SideLogo priority />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push('/dashboard')} className={headerChromeButtonClass}>
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Toolbox</span>
            </button>
            <UserMenu userName={userName} onSignOut={handleSignOut} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className={pageTitleClass}>Storage</h1>
          <p className={pageSubtitleClass}>See how much attachment space you are using across your tools.</p>
        </div>

        {error && <div className={errorAlertClass}>{error}</div>}

        {isLoading ? (
          <div className={mutedClass}>Calculating your storage usage...</div>
        ) : storage ? (
          <div className="space-y-6">
            <section className={cardClass}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className={labelClass}>Current usage</p>
                  <p className={isLight ? 'mt-1 text-2xl font-semibold text-slate-900' : 'mt-1 text-2xl font-semibold text-slate-50'}>
                    {storage.usedLabel} of {storage.limitLabel}
                  </p>
                  <p className={`${mutedClass} mt-1`}>
                    {storage.planLabel} plan · {formatBytes(storage.includedBytes)} included
                    {storage.addonGb > 0 ? ` · +${storage.addonGb} GB extra` : ''}
                  </p>
                </div>
                <p className={isLight ? 'text-lg font-semibold text-slate-800' : 'text-lg font-semibold text-slate-200'}>
                  {storage.percent}%
                </p>
              </div>
              <div className={`h-2.5 overflow-hidden rounded-full ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, barPercent)}%` }} />
              </div>
            </section>

            <section className={cardClass}>
              <h2 className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>
                Increase your limit
              </h2>
              <p className={`${mutedClass} mt-1 mb-4`}>
                Plan billing is not enabled yet. These options will become available when pricing is set up.
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" disabled className={disabledButtonClass}>
                  Upgrade to Paid · 1 GB
                </button>
                <button type="button" disabled className={disabledButtonClass}>
                  Add 1 GB · $1/month
                </button>
              </div>
            </section>

            <section className={tableCardClass}>
              <div className={`px-6 py-4 ${isLight ? 'border-b border-slate-200' : 'border-b border-slate-800'}`}>
                <h2 className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>
                  Usage by tool
                </h2>
                <p className={mutedClass}>Attachment files stored in each tool&apos;s bucket.</p>
              </div>
              <table className="min-w-full">
                <thead className={isLight ? 'bg-slate-100' : 'bg-slate-800/50'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      Tool
                    </th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      Used
                    </th>
                  </tr>
                </thead>
                <tbody className={isLight ? 'divide-y divide-slate-200' : 'divide-y divide-slate-800'}>
                  {tools.map((tool) => (
                    <tr key={tool.bucket} className={isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/30'}>
                      <td className={`px-6 py-3 text-sm font-medium ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        {tool.name}
                      </td>
                      <td className={`px-6 py-3 text-right text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {formatBytes(tool.usedBytes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
