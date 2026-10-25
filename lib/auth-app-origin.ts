/**
 * Origin used in Supabase Auth email links.
 * Local dev always returns localhost so recovery links hit this machine.
 * Production uses the canonical site, not the optional http app URL.
 */
export const PLAN_BILLING_PATH = '/dashboard/plan';

export function getAuthAppOrigin(): string {
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000';
  }
  return 'https://householdtoolbox.com';
}

/** Portal return URL. Production uses the www host that serves the signed-in app. */
export function planBillingReturnUrl(): string {
  const origin = process.env.NODE_ENV === 'production'
    ? 'https://www.householdtoolbox.com'
    : getAuthAppOrigin();
  return `${origin}${PLAN_BILLING_PATH}`;
}

/** Path a customer may resume after sign-in or MFA. Anything else stays on the dashboard. */
export function resumeAfterAuth(value: string | null | undefined): string {
  if (value === PLAN_BILLING_PATH) return PLAN_BILLING_PATH;
  if (value && value.startsWith('/invite/') && !value.startsWith('//') && !value.includes('\\')) return value;
  return '/dashboard';
}

export function authCallbackUrl(nextPath: string): string {
  const next = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';
  return `${getAuthAppOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;
}
