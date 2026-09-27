'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseAuthBrowserClient } from '@/lib/supabaseAuthBrowser';

type Diagnostic =
  | { authenticated: false }
  | {
      authenticated: true;
      source: 'supabase' | 'legacy';
      userId: string;
      userStatus: string | null;
    };

const fieldClass =
  'auth-field w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';

export function AuthTestClient() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshDiagnostic = useCallback(async () => {
    const response = await fetch('/api/auth/session-test', { cache: 'no-store' });
    const body = (await response.json()) as Diagnostic;
    setDiagnostic(body);
    return body;
  }, []);

  useEffect(() => {
    void refreshDiagnostic().catch(() => {
      setMessage('Could not read the session diagnostic.');
    });
  }, [refreshDiagnostic]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createSupabaseAuthBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setPassword('');
      if (error || !data.user) {
        setAuthUserId(null);
        setMessage(error?.message || 'Sign in failed.');
        await refreshDiagnostic();
        return;
      }
      setAuthUserId(data.user.id);
      await refreshDiagnostic();
    } catch {
      setMessage('Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function signOutSupabase() {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createSupabaseAuthBrowserClient();
      const { error } = await supabase.auth.signOut();
      setAuthUserId(null);
      if (error) setMessage(error.message);
      const body = await refreshDiagnostic();
      if (body.authenticated && body.source === 'legacy') {
        setMessage('Supabase Auth is signed out. The legacy cookie is still present, so the app session remains.');
      }
    } catch {
      setMessage('Supabase sign-out failed.');
    } finally {
      setBusy(false);
    }
  }

  const profileResolved = diagnostic?.authenticated === true;
  const idsMatch =
    profileResolved && authUserId !== null && diagnostic.userId === authUserId;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Development only</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">Supabase Auth test</h1>
        <p className="mt-2 text-sm text-slate-400">
          This page signs in with Supabase Auth only. The homepage login is unchanged. Tokens are not shown.
        </p>
      </div>

      <form onSubmit={signIn} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <label htmlFor="auth-test-email" className="mb-1.5 block text-xs font-medium text-slate-300">
            Email
          </label>
          <input
            id="auth-test-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
            required
          />
        </div>
        <div>
          <label htmlFor="auth-test-password" className="mb-1.5 block text-xs font-medium text-slate-300">
            Password
          </label>
          <input
            id="auth-test-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass}
            required
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? 'Working...' : 'Sign in with Supabase'}
        </button>
      </form>

      {message && <p className="text-sm text-slate-300">{message}</p>}

      <dl className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
        <Status label="Authenticated" value={diagnostic ? (diagnostic.authenticated ? 'YES' : 'NO') : '...'} />
        <Status label="Session source" value={diagnostic?.authenticated ? diagnostic.source : 'none'} />
        <Status label="Auth user id" value={authUserId ?? 'none'} />
        <Status label="Application profile resolved" value={diagnostic ? (profileResolved ? 'YES' : 'NO') : '...'} />
        <Status label="Application user id" value={profileResolved ? diagnostic.userId : 'none'} />
        <Status label="IDs match" value={authUserId ? (idsMatch ? 'YES' : 'NO') : 'not checked'} />
        <Status label="userStatus" value={profileResolved ? diagnostic.userStatus ?? 'none' : 'none'} />
        <Status label="active status" value={profileResolved ? 'Y' : 'none'} />
      </dl>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:border-slate-500"
        >
          Dashboard
        </Link>
        <button
          type="button"
          onClick={() => {
            void refreshDiagnostic();
          }}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:border-slate-500"
        >
          Test session
        </button>
        <button
          type="button"
          onClick={() => {
            void signOutSupabase();
          }}
          disabled={busy}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:border-slate-500 disabled:opacity-50"
        >
          Supabase sign out
        </button>
      </div>
    </main>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="break-all text-right text-slate-100">{value}</dd>
    </div>
  );
}
