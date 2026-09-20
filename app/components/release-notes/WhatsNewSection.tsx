'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../AppThemeProvider';
import { ReleaseNotesFeed } from './ReleaseNotesFeed';
import type { ReleaseNote } from '@/lib/release-notes';

type WhatsNewSectionProps = {
  limit?: number;
};

export function WhatsNewSection({ limit = 3 }: WhatsNewSectionProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const router = useRouter();
  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/release-notes?limit=${limit}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setNotes(data?.notes || []);
      })
      .catch(() => {
        if (!cancelled) setNotes([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (isLoading || notes.length === 0) return null;

  const headingClass = isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-100';
  const linkClass = isLight
    ? 'text-sm font-medium text-emerald-700 hover:text-emerald-800'
    : 'text-sm font-medium text-emerald-400 hover:text-emerald-300';

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className={headingClass}>What&apos;s New</h2>
        <button type="button" onClick={() => router.push('/dashboard/whats-new')} className={linkClass}>
          View All Updates
        </button>
      </div>
      <ReleaseNotesFeed notes={notes} variant="compact" />
    </section>
  );
}
