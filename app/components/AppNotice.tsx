'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useTheme } from './AppThemeProvider';

type Notice = { type: 'success' | 'error'; text: string };

type AppNoticeContextValue = {
  showError: (text: string) => void;
  showSuccess: (text: string) => void;
  clearNotice: () => void;
};

const AppNoticeContext = createContext<AppNoticeContextValue | null>(null);

export function AppNoticeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const [notice, setNotice] = useState<Notice | null>(null);

  const showError = useCallback((text: string) => {
    const message = (text || '').trim();
    if (!message) return;
    setNotice({ type: 'error', text: message });
  }, []);

  const showSuccess = useCallback((text: string) => {
    const message = (text || '').trim();
    if (!message) return;
    setNotice({ type: 'success', text: message });
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(clearNotice, 6000);
    return () => window.clearTimeout(timer);
  }, [notice, clearNotice]);

  const bannerClass =
    notice?.type === 'success'
      ? isLight
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
      : isLight
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-red-500/40 bg-red-500/15 text-red-200';

  return (
    <AppNoticeContext.Provider value={{ showError, showSuccess, clearNotice }}>
      {children}
      {notice && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center px-4">
          <div
            role="alert"
            className={`pointer-events-auto flex max-w-lg items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl ${bannerClass}`}
          >
            <p className="min-w-0 flex-1 whitespace-pre-wrap">{notice.text}</p>
            <button
              type="button"
              onClick={clearNotice}
              className={
                isLight
                  ? 'rounded-md p-1 text-slate-500 hover:bg-black/5 hover:text-slate-800'
                  : 'rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white'
              }
              aria-label="Dismiss notice"
              title="Dismiss notice"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </AppNoticeContext.Provider>
  );
}

export function useAppNotice(): AppNoticeContextValue {
  const context = useContext(AppNoticeContext);
  if (context) return context;
  return {
    showError: (text: string) => {
      if (text) console.error(text);
    },
    showSuccess: (text: string) => {
      if (text) console.info(text);
    },
    clearNotice: () => {},
  };
}
