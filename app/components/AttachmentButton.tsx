'use client';

import { useTheme } from './AppThemeProvider';

type AttachmentButtonProps = {
  count?: number;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
};

export function AttachmentButton({
  count = 0,
  onClick,
  disabled = false,
  ariaLabel,
}: AttachmentButtonProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const hasFiles = count > 0;

  const buttonClass = hasFiles
    ? isLight
      ? 'relative inline-flex h-10 w-10 items-center justify-center rounded-lg border-2 border-emerald-700 bg-white text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
      : 'relative inline-flex h-10 w-10 items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50'
    : isLight
      ? 'relative inline-flex h-10 w-10 items-center justify-center rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
      : 'relative inline-flex h-10 w-10 items-center justify-center rounded-lg border-2 border-slate-600 bg-slate-800 text-slate-200 transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || (hasFiles ? `Attachments, ${count} file${count === 1 ? '' : 's'}` : 'Add attachments')}
      className={buttonClass}
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
        />
      </svg>
      {hasFiles && (
        <span
          className={
            isLight
              ? 'absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-emerald-600 px-1 text-center text-[10px] font-semibold leading-5 text-white'
              : 'absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-emerald-500 px-1 text-center text-[10px] font-semibold leading-5 text-slate-950'
          }
        >
          {count}
        </span>
      )}
    </button>
  );
}
