/** Production Sign Out path: clear session cookie, then leave so router cache cannot keep /dashboard/*. */
export async function completeSignOut() {
  try {
    await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });
  } finally {
    window.location.replace('/');
  }
}
