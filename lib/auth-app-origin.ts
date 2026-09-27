/**
 * Origin used in Supabase Auth email links.
 * Local dev always returns localhost so recovery links hit this machine.
 * Production uses the canonical site, not the optional http app URL.
 */
export function getAuthAppOrigin(): string {
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000';
  }
  return 'https://householdtoolbox.com';
}

export function authCallbackUrl(nextPath: string): string {
  const next = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';
  return `${getAuthAppOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;
}
