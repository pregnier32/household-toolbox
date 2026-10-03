'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SideLogo } from '@/app/components/SideLogo';
import { UserMenu } from '@/app/components/UserMenu';
import { useTheme } from '@/app/components/AppThemeProvider';
import { completeSignOut } from '@/lib/client-sign-out';

type Notice = {
  id: string;
  severity: 'info' | 'attention' | 'action';
  title: string;
  body: string;
  href: string | null;
  created_at: string;
  read_at: string | null;
};

function severityClass(severity: Notice['severity'], isLight: boolean): string {
  const base = 'inline-flex rounded-full px-2 py-0.5 text-xs font-medium';
  if (severity === 'action') return `${base} ${isLight ? 'bg-rose-100 text-rose-900' : 'bg-rose-500/20 text-rose-200'}`;
  if (severity === 'attention') return `${base} ${isLight ? 'bg-amber-100 text-amber-950' : 'bg-amber-500/20 text-amber-100'}`;
  return `${base} ${isLight ? 'bg-emerald-100 text-emerald-900' : 'bg-emerald-500/20 text-emerald-300'}`;
}

export function AccountNotices({ userName }: { userName: string }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const headerChromeButtonClass = isLight
    ? 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900'
    : 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100';
  const cardClass = isLight ? 'rounded-lg border border-slate-200 bg-white p-5 shadow-sm' : 'rounded-lg border border-slate-800 bg-slate-900/70 p-5';
  const mutedClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400';
  const titleClass = isLight ? 'text-2xl font-semibold text-slate-900' : 'text-2xl font-semibold text-slate-50';
  const secondaryButtonClass = isLight
    ? 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100'
    : 'rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800';

  const load = () => {
    fetch('/api/account/notices')
      .then((response) => response.json())
      .then((data) => setNotices(data.notices || []))
      .catch(() => setNotices([]));
  };

  useEffect(() => {
    load();
  }, []);

  const mark = async (id?: string) => {
    await fetch('/api/account/notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    load();
  };

  const unread = (notices ?? []).filter((notice) => !notice.read_at);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className={isLight ? 'border-b-2 border-slate-400 bg-slate-900/50' : 'border-b border-slate-800 bg-slate-900/50'}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <SideLogo priority />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push('/dashboard')} className={headerChromeButtonClass}>
              <span>Back to Toolbox</span>
            </button>
            <UserMenu userName={userName} onSignOut={() => completeSignOut()} />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className={titleClass}>Notices</h1>
            <p className={`mt-1 ${mutedClass}`}>Messages about trials, promotions, and expected cost. No email is sent from this page.</p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={() => mark()} disabled={unread.length === 0}>
            Mark all read
          </button>
        </div>
        {!notices && <p className={`mt-6 ${mutedClass}`}>Loading notices...</p>}
        {notices && notices.length === 0 && (
          <section className={`mt-6 ${cardClass}`}>
            <p className={mutedClass}>You have no notices right now.</p>
          </section>
        )}
        <div className="mt-6 space-y-3">
          {(notices ?? []).map((notice) => (
            <article key={notice.id} className={cardClass}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={severityClass(notice.severity, isLight)}>{notice.severity}</span>
                <span className={mutedClass}>{notice.read_at ? 'Read' : 'Unread'}</span>
              </div>
              <h2 className={`mt-2 text-base font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>{notice.title}</h2>
              <p className={`mt-2 text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{notice.body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {notice.href && (
                  <button type="button" className={secondaryButtonClass} onClick={() => router.push(notice.href || '/dashboard')}>
                    View details
                  </button>
                )}
                {!notice.read_at && (
                  <button type="button" className={secondaryButtonClass} onClick={() => mark(notice.id)}>
                    Mark read
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
