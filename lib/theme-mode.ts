export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'household-toolbox-theme';

/** Present only while a signed-in session owns the stored theme. Cleared on sign-out. */
export const THEME_SESSION_KEY = 'household-toolbox-theme-session';

/** Marketing and sign-in screens stay dark even when the signed-in preference is light. */
export const PUBLIC_DARK_PATHS = [
  '/',
  '/pricing',
  '/tools',
  '/faq',
  '/privacy-policy',
  '/terms-of-service',
  '/forgot-password',
  '/reset-password',
  '/invite',
  '/auth',
];

/**
 * Public pages that follow the signed-in theme.
 * Visitors with no active session stay on the dark marketing theme.
 */
export const SIGNED_IN_THEME_PATHS = ['/support'];

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

export function isForcedDarkRoute(pathname: string): boolean {
  return PUBLIC_DARK_PATHS.some(
    (path) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`))
  );
}

export function isSignedInThemeRoute(pathname: string): boolean {
  return SIGNED_IN_THEME_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/** Runs in <head> before first paint so a stored light theme is not preceded by the dark default. */
export function themeBootScript(): string {
  return `(function(){try{var forced=${JSON.stringify(PUBLIC_DARK_PATHS)};var sessionRoutes=${JSON.stringify(SIGNED_IN_THEME_PATHS)};var path=location.pathname;var dark=false;for(var i=0;i<forced.length;i++){var p=forced[i];if(path===p||(p!=='/'&&path.indexOf(p+'/')===0)){dark=true;break;}}var theme='dark';if(!dark){var sessionRoute=false;for(var j=0;j<sessionRoutes.length;j++){var s=sessionRoutes[j];if(path===s||path.indexOf(s+'/')===0){sessionRoute=true;break;}}var allowSaved=!sessionRoute||localStorage.getItem(${JSON.stringify(THEME_SESSION_KEY)})==='1';if(allowSaved){var saved=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(saved==='light'||saved==='dark')theme=saved;}}var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(theme);r.setAttribute('data-theme',theme);}catch(e){document.documentElement.classList.add('dark');}})();`;
}

export function markSignedInTheme() {
  try {
    localStorage.setItem(THEME_SESSION_KEY, '1');
  } catch {
    // Private browsing can block storage. The open session still applies the theme.
  }
}

export function clearSignedInTheme() {
  try {
    localStorage.removeItem(THEME_SESSION_KEY);
  } catch {
    // Ignore storage failures. The next session check applies dark for visitors.
  }
}

export function hasSignedInTheme(): boolean {
  try {
    return localStorage.getItem(THEME_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberThemePreference(theme: string | null | undefined) {
  if (!isThemeMode(theme)) return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(THEME_SESSION_KEY, '1');
  } catch {
    // Private browsing can block storage. The session fetch still applies the theme after paint.
  }
}

export function readStoredTheme(): ThemeMode | null {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(saved) ? saved : null;
  } catch {
    return null;
  }
}
