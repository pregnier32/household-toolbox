'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserMenu } from '../../components/UserMenu';
import { SideLogo } from '../../components/SideLogo';
import { useTheme } from '../../components/AppThemeProvider';
import { completeSignOut } from '@/lib/client-sign-out';
import { ReleaseNotesFeed } from '../../components/release-notes/ReleaseNotesFeed';
import { ReleaseNotesFilter } from '../../components/release-notes/ReleaseNotesFilter';
import {
  RELEASE_NOTES_VIEWED_EVENT,
  type ReleaseNote,
  type ReleaseNoteCategory,
} from '@/lib/release-notes';

export default function WhatsNewPage() {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const router = useRouter();
  const [userName, setUserName] = useState('Account');
  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  const [category, setCategory] = useState<'all' | ReleaseNoteCategory>('all');
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
  const mutedClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400';

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
    setIsLoading(true);
    setError(null);
    const params = category === 'all' ? '' : `?category=${category}`;
    fetch(`/api/release-notes${params}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) throw new Error(data.error || 'Failed to load updates');
        setNotes(data.notes || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load updates');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  useEffect(() => {
    fetch('/api/release-notes/unread', { method: 'POST' })
      .then((res) => {
        if (res.ok) {
          window.dispatchEvent(new Event(RELEASE_NOTES_VIEWED_EVENT));
        }
      })
      .catch(() => {
        // Viewing still works if the watermark cannot be saved.
      });
  }, []);

  const handleSignOut = async () => {
    await completeSignOut();
  };

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

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className={pageTitleClass}>What&apos;s New</h1>
          <p className={pageSubtitleClass}>
            Updates to Household Toolbox, including new tools, features, improvements, and important fixes.
          </p>
        </div>

        <div className="mb-6">
          <ReleaseNotesFilter value={category} onChange={setCategory} />
        </div>

        {error && <div className={errorAlertClass}>{error}</div>}

        {isLoading ? (
          <p className={mutedClass}>Loading updates...</p>
        ) : (
          <ReleaseNotesFeed notes={notes} />
        )}
      </div>
    </main>
  );
}
