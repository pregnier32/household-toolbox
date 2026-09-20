'use client';

import { useTheme } from '../AppThemeProvider';
import { ReleaseNoteCard } from './ReleaseNoteCard';
import type { ReleaseNote } from '@/lib/release-notes';

type ReleaseNotesFeedProps = {
  notes: ReleaseNote[];
  variant?: 'feed' | 'compact';
  emptyMessage?: string;
};

export function ReleaseNotesFeed({
  notes,
  variant = 'feed',
  emptyMessage = 'Nothing new to report yet. Updates to Household Toolbox will appear here.',
}: ReleaseNotesFeedProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const emptyClass = isLight
    ? 'rounded-lg border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-600 shadow-sm'
    : 'rounded-lg border border-slate-800 bg-slate-900/70 px-6 py-10 text-center text-sm text-slate-400';

  if (notes.length === 0) {
    return <div className={emptyClass}>{emptyMessage}</div>;
  }

  if (variant === 'compact') {
    return (
      <div className="space-y-3">
        {notes.map((note) => (
          <ReleaseNoteCard key={note.id} note={note} variant="compact" />
        ))}
      </div>
    );
  }

  return (
    <ol className="space-y-4">
      {notes.map((note) => (
        <li key={note.id}>
          <ReleaseNoteCard note={note} variant="feed" />
        </li>
      ))}
    </ol>
  );
}
