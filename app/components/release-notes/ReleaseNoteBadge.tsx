'use client';

import { useTheme } from '../AppThemeProvider';
import {
  RELEASE_NOTE_CATEGORY_LABELS,
  type ReleaseNoteCategory,
} from '@/lib/release-notes';

const CATEGORY_STYLES: Record<
  ReleaseNoteCategory,
  { light: string; dark: string }
> = {
  new_tool: {
    light: 'bg-emerald-100 text-emerald-800',
    dark: 'bg-emerald-500/20 text-emerald-300',
  },
  new_feature: {
    light: 'bg-sky-100 text-sky-800',
    dark: 'bg-sky-500/20 text-sky-300',
  },
  improvement: {
    light: 'bg-amber-100 text-amber-800',
    dark: 'bg-amber-500/20 text-amber-300',
  },
  bug_fix: {
    light: 'bg-rose-100 text-rose-800',
    dark: 'bg-rose-500/20 text-rose-300',
  },
  security: {
    light: 'bg-violet-100 text-violet-800',
    dark: 'bg-violet-500/20 text-violet-300',
  },
  announcement: {
    light: 'bg-slate-200 text-slate-700',
    dark: 'bg-slate-700 text-slate-200',
  },
};

type ReleaseNoteBadgeProps = {
  category: ReleaseNoteCategory;
  className?: string;
};

export function ReleaseNoteBadge({ category, className = '' }: ReleaseNoteBadgeProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const style = CATEGORY_STYLES[category];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        isLight ? style.light : style.dark
      } ${className}`}
    >
      {RELEASE_NOTE_CATEGORY_LABELS[category]}
    </span>
  );
}
