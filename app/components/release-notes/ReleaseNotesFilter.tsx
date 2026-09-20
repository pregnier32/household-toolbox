'use client';

import { useTheme } from '../AppThemeProvider';
import { RELEASE_NOTES_FILTERS, type ReleaseNoteCategory } from '@/lib/release-notes';

type ReleaseNotesFilterProps = {
  value: 'all' | ReleaseNoteCategory;
  onChange: (value: 'all' | ReleaseNoteCategory) => void;
};

export function ReleaseNotesFilter({ value, onChange }: ReleaseNotesFilterProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const wrapClass = isLight
    ? 'flex flex-wrap gap-2'
    : 'flex flex-wrap gap-2';

  return (
    <div className={wrapClass} role="tablist" aria-label="Filter release notes">
      {RELEASE_NOTES_FILTERS.map((filter) => {
        const selected = value === filter.id;
        const buttonClass = selected
          ? isLight
            ? 'rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950'
            : 'rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950'
          : isLight
            ? 'rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900'
            : 'rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100';

        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(filter.id)}
            className={buttonClass}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
