import { createSupabaseAuthBrowserClient } from '@/lib/supabaseAuthBrowser';
import { clearSignedInTheme } from '@/lib/theme-mode';

/** Clears the Supabase Auth session and the legacy cookie, then leaves the page. */
export async function completeSignOut() {
  try {
    const supabase = createSupabaseAuthBrowserClient();
    await supabase.auth.signOut();
  } catch {
    // The server sign-out below still clears both cookie sets when it can.
  }

  try {
    await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });
  } finally {
    clearSignedInTheme();
    window.location.replace('/');
  }
}
