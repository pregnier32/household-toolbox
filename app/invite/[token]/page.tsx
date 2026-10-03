'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { SideLogo } from '@/app/components/SideLogo';
import { signIn } from '@/app/actions/auth';

type Preview = {
  state: 'invalid' | 'cancelled' | 'accepted' | 'expired' | 'valid';
  firstName?: string;
  email?: string;
  adminFirstName?: string;
};

export default function AcceptInvitationPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mode, setMode] = useState<'create' | 'signin'>('create');
  const [firstName, setFirstName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/household/invitations/preview?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data: Preview) => {
        setPreview(data);
        if (data.firstName) setFirstName(data.firstName);
      })
      .catch(() => setPreview({ state: 'invalid' }));
  }, [token]);

  const acceptSignedIn = async () => {
    const response = await fetch('/api/household/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not accept the invitation.');
    window.location.assign('/dashboard');
  };

  const createAccount = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/household/invitations/accept-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, firstName, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create the account.');
      if (data.needsEmailConfirmation) {
        setMessage('Check your email to confirm your account. After you confirm it, sign in and you will be in the household.');
        return;
      }
      window.location.assign('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInAndAccept = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await signIn({ email: preview?.email || '', password });
      if (!result.success) throw new Error(result.error || 'Could not sign in.');
      if (result.needsMfa) {
        window.location.assign(`/auth/mfa?next=${encodeURIComponent(`/invite/${token}`)}`);
        return;
      }
      await acceptSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the invitation.');
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
        <SideLogo />
        <h1 className="mt-8 text-2xl font-semibold text-slate-50">Accept Invitation</h1>
        {!preview ? (
          <p className="mt-3 text-sm text-slate-300">Loading invitation...</p>
        ) : preview.state === 'valid' ? (
          <>
            <p className="mt-3 text-sm text-slate-300">
              {preview.adminFirstName || 'A household Admin'} invited {preview.firstName} ({preview.email}) to join their
              Household Toolbox account.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm ${mode === 'create' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}
                onClick={() => setMode('create')}
              >
                Create account
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm ${mode === 'signin' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}
                onClick={() => setMode('signin')}
              >
                Sign in
              </button>
            </div>
            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
            {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
            {mode === 'create' ? (
              <form
                className="mt-4 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createAccount();
                }}
              >
                <label className="block text-sm">
                  First Name
                  <input className={inputClass} value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
                </label>
                <label className="block text-sm">
                  Email Address
                  <input className={inputClass} value={preview.email || ''} readOnly />
                </label>
                <label className="block text-sm">
                  Password
                  <input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
                </label>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating account...' : 'Accept Invitation'}
                </button>
              </form>
            ) : (
              <form
                className="mt-4 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void signInAndAccept();
                }}
              >
                <label className="block text-sm">
                  Email Address
                  <input className={inputClass} value={preview.email || ''} readOnly />
                </label>
                <label className="block text-sm">
                  Password
                  <input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                </label>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  {isSubmitting ? 'Signing in...' : 'Accept Invitation'}
                </button>
              </form>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-300">
            {preview.state === 'expired'
              ? 'This invitation has expired. Ask the household Admin to resend it.'
              : preview.state === 'accepted'
                ? 'This invitation has already been accepted. Sign in to open Household Toolbox.'
                : preview.state === 'cancelled'
                  ? 'This invitation was cancelled.'
                  : 'This invitation link is not valid.'}
          </p>
        )}
      </div>
    </main>
  );
}
