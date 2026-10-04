'use client';

import { useTheme } from './AppThemeProvider';

type ExportLabelsIconButtonProps = {
  title?: string;
  onClick?: () => void;
};

export function ExportLabelsIconButton({
  title = 'Export mailing labels',
  onClick,
}: ExportLabelsIconButtonProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        isLight
          ? 'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-900'
          : 'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-emerald-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300'
      }
      title={title}
      aria-label={title}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="1.5" strokeWidth="2" />
        <rect x="6.2" y="5.2" width="4.7" height="3.2" rx="0.4" strokeWidth="1.5" />
        <rect x="13.1" y="5.2" width="4.7" height="3.2" rx="0.4" strokeWidth="1.5" />
        <rect x="6.2" y="10.4" width="4.7" height="3.2" rx="0.4" strokeWidth="1.5" />
        <rect x="13.1" y="10.4" width="4.7" height="3.2" rx="0.4" strokeWidth="1.5" />
        <rect x="6.2" y="15.6" width="4.7" height="3.2" rx="0.4" strokeWidth="1.5" />
        <rect x="13.1" y="15.6" width="4.7" height="3.2" rx="0.4" strokeWidth="1.5" />
      </svg>
    </button>
  );
}
