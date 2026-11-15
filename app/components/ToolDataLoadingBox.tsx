'use client';

import { useTheme } from './AppThemeProvider';

export function ToolDataLoadingBox() {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={
        isLight
          ? 'rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm'
          : 'rounded-2xl border border-slate-700 bg-slate-900/70 px-6 py-10 text-center'
      }
    >
      <p className={isLight ? 'text-base font-medium text-slate-900' : 'text-base font-medium text-slate-50'}>
        Please Wait, Loading your Data
      </p>
    </div>
  );
}
