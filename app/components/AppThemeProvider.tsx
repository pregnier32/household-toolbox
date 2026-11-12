'use client';

import { createContext, useContext, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  clearSignedInTheme,
  hasSignedInTheme,
  isForcedDarkRoute,
  isSignedInThemeRoute,
  markSignedInTheme,
  readStoredTheme,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from '@/lib/theme-mode';

export type { ThemeMode };

type ThemeContextType = {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyThemeClass(theme: ThemeMode): 'light' | 'dark' {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.setAttribute('data-theme', theme);
  return theme;
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');
  const userChangedThemeRef = useRef(false);
  const signedInRef = useRef(false);

  const syncThemeFromSession = useCallback(async () => {
    if (isForcedDarkRoute(pathname)) {
      setThemeState('dark');
      setResolvedTheme(applyThemeClass('dark'));
      return;
    }

    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      const user = data?.user;

      if (!user) {
        signedInRef.current = false;
        clearSignedInTheme();
        userChangedThemeRef.current = false;
        setThemeState('dark');
        setResolvedTheme(applyThemeClass('dark'));
        return;
      }

      signedInRef.current = true;
      markSignedInTheme();

      if (userChangedThemeRef.current) return;

      const dbTheme = user.themePreference;
      if (dbTheme === 'light' || dbTheme === 'dark') {
        setThemeState(dbTheme);
        setResolvedTheme(applyThemeClass(dbTheme));
        localStorage.setItem(THEME_STORAGE_KEY, dbTheme);
        return;
      }

      const saved = readStoredTheme();
      const fallback: ThemeMode = saved ?? 'dark';
      setThemeState(fallback);
      setResolvedTheme(applyThemeClass(fallback));
    } catch {
      if (!userChangedThemeRef.current) {
        setThemeState('dark');
        setResolvedTheme(applyThemeClass('dark'));
      }
    }
  }, [pathname]);

  useLayoutEffect(() => {
    if (isForcedDarkRoute(pathname)) {
      setThemeState('dark');
      setResolvedTheme(applyThemeClass('dark'));
      return;
    }

    userChangedThemeRef.current = false;
    const stored = readStoredTheme();
    const keepPreference = !isSignedInThemeRoute(pathname) || signedInRef.current || hasSignedInTheme();
    if (keepPreference && stored) {
      setThemeState(stored);
      setResolvedTheme(applyThemeClass(stored));
    } else if (isSignedInThemeRoute(pathname)) {
      setThemeState('dark');
      setResolvedTheme(applyThemeClass('dark'));
    }
    void syncThemeFromSession();
  }, [pathname, syncThemeFromSession]);

  const setTheme = (nextTheme: ThemeMode) => {
    userChangedThemeRef.current = true;
    signedInRef.current = true;
    setThemeState(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    markSignedInTheme();
    setResolvedTheme(applyThemeClass(nextTheme));

    fetch('/api/user/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themePreference: nextTheme }),
    }).catch(() => {
      // Non-blocking: local preference still applies.
    });
  };

  const routeForcesDark = isForcedDarkRoute(pathname);
  const value = useMemo(
    () => ({
      theme: routeForcesDark ? 'dark' : theme,
      resolvedTheme: routeForcesDark ? 'dark' : resolvedTheme,
      setTheme,
    }),
    [routeForcesDark, theme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within an AppThemeProvider');
  }
  return context;
}
