'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../AppThemeProvider';
import { ReleaseNoteBadge } from './ReleaseNoteBadge';
import {
  formatReleaseNoteDate,
  isSafeReleaseNoteLink,
  type ReleaseNote,
} from '@/lib/release-notes';

type ReleaseNoteCardProps = {
  note: ReleaseNote;
  variant?: 'feed' | 'compact';
  defaultExpanded?: boolean;
};

export function ReleaseNoteCard({
  note,
  variant = 'feed',
  defaultExpanded = false,
}: ReleaseNoteCardProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const router = useRouter();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasDetails = Boolean(note.content && note.content.trim());
  const canLink = isSafeReleaseNoteLink(note.link_url);
  const isCompact = variant === 'compact';

  const cardClass = note.featured
    ? isLight
      ? 'rounded-lg border border-emerald-200 bg-emerald-50/60 pl-3 shadow-sm'
      : 'rounded-lg border border-emerald-500/30 bg-emerald-500/5 pl-3'
    : isLight
      ? 'rounded-lg border border-slate-200 bg-white pl-3 shadow-sm'
      : 'rounded-lg border border-slate-800 bg-slate-900/70 pl-3';

  const accentClass = note.featured
    ? 'bg-emerald-500'
    : isLight
      ? 'bg-slate-300'
      : 'bg-slate-700';

  const titleClass = isLight
    ? 'text-base font-semibold text-slate-900'
    : 'text-base font-semibold text-slate-50';
  const compactTitleClass = isLight
    ? 'text-sm font-semibold text-slate-900'
    : 'text-sm font-semibold text-slate-100';
  const dateClass = isLight ? 'text-xs text-slate-500' : 'text-xs text-slate-400';
  const summaryClass = isLight ? 'text-sm text-slate-700' : 'text-sm text-slate-300';
  const detailsClass = isLight ? 'mt-2 text-sm leading-relaxed text-slate-600' : 'mt-2 text-sm leading-relaxed text-slate-400';
  const featuredLabelClass = isLight
    ? 'text-[11px] font-semibold uppercase tracking-wide text-emerald-700'
    : 'text-[11px] font-semibold uppercase tracking-wide text-emerald-300';
  const expandClass = isLight
    ? 'text-xs font-medium text-slate-600 hover:text-slate-900'
    : 'text-xs font-medium text-slate-400 hover:text-slate-200';
  const linkClass = isLight
    ? 'inline-flex items-center rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400'
    : 'inline-flex items-center rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400';

  const handleLink = () => {
    if (!note.link_url || !canLink) return;
    if (note.link_url.startsWith('/')) {
      router.push(note.link_url);
      return;
    }
    window.open(note.link_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <article className={`relative ${cardClass} ${isCompact ? 'py-3 pr-4' : 'py-4 pr-4 sm:py-5'}`}>
      <span className={`absolute inset-y-0 left-0 w-0.5 rounded-l-lg ${accentClass}`} aria-hidden />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ReleaseNoteBadge category={note.category} />
        {note.featured && <span className={featuredLabelClass}>Featured</span>}
        <span className={dateClass}>{formatReleaseNoteDate(note.publish_date)}</span>
      </div>
      <h3 className={`mt-2 ${isCompact ? compactTitleClass : titleClass}`}>{note.title}</h3>
      <p className={`mt-1 ${summaryClass} ${isCompact ? 'line-clamp-2' : ''}`}>{note.summary}</p>

      {!isCompact && hasDetails && expanded && (
        <p className={`${detailsClass} whitespace-pre-wrap`}>{note.content}</p>
      )}

      {!isCompact && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {hasDetails && (
            <button type="button" onClick={() => setExpanded((value) => !value)} className={expandClass}>
              {expanded ? 'Hide details' : 'Show details'}
            </button>
          )}
          {canLink && (
            <button type="button" onClick={handleLink} className={linkClass}>
              {note.link_text || 'Open'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
