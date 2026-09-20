'use client';

import { useTheme } from './AppThemeProvider';

type ExportPdfIconButtonProps = {
  title?: string;
  onClick?: () => void;
};

export function ExportPdfIconButton({
  title = 'Export to PDF',
  onClick,
}: ExportPdfIconButtonProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        isLight
          ? 'shrink-0 p-2 rounded-lg text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-900'
          : 'shrink-0 p-2 rounded-lg text-emerald-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300'
      }
      title={title}
      aria-label={title}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </button>
  );
}
