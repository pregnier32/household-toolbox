'use client';

import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export type ThemeMode = 'light' | 'dark';

type ThemeContextType = {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
};

const STORAGE_KEY = 'household-toolbox-theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function isForcedDarkRoute(pathname: string): boolean {
  return pathname === '/' || pathname === '/pricing';
}

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
        userChangedThemeRef.current = false;
        setThemeState('dark');
        setResolvedTheme(applyThemeClass('dark'));
        return;
      }

      if (userChangedThemeRef.current) return;

      const dbTheme = user.themePreference;
      if (dbTheme === 'light' || dbTheme === 'dark') {
        setThemeState(dbTheme);
        setResolvedTheme(applyThemeClass(dbTheme));
        localStorage.setItem(STORAGE_KEY, dbTheme);
        return;
      }

      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      const fallback: ThemeMode = saved === 'light' || saved === 'dark' ? saved : 'dark';
      setThemeState(fallback);
      setResolvedTheme(applyThemeClass(fallback));
    } catch {
      if (!userChangedThemeRef.current) {
        setThemeState('dark');
        setResolvedTheme(applyThemeClass('dark'));
      }
    }
  }, [pathname]);

  useEffect(() => {
    syncThemeFromSession();
  }, [pathname, syncThemeFromSession]);

  const setTheme = (nextTheme: ThemeMode) => {
    userChangedThemeRef.current = true;
    setThemeState(nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
    setResolvedTheme(applyThemeClass(nextTheme));

    fetch('/api/user/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themePreference: nextTheme }),
    }).catch(() => {
      // Non-blocking: local preference still applies.
    });
  };

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme]
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
