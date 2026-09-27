'use client';

import { useState } from 'react';
import { createSupabaseAuthBrowserClient } from '@/lib/supabaseAuthBrowser';
import { completeSignOut } from '@/lib/client-sign-out';
import { SideLogo } from '@/app/components/SideLogo';

function messageForCode(code: string | undefined): string {
  if (code === 'mfa_verification_failed' || code === 'invalid_otp' || code === 'otp_expired') {
    return 'That code is not correct. Enter the current code from your authenticator app.';
  }
  return 'Something went wrong. Try again.';
}

export function MfaChallengeClient({ checkFailed }: { checkFailed: boolean }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const verify = async () => {
    const trimmed = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(trimmed)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setIsVerifying(true);
    setError(null);
    try {
      const supabase = createSupabaseAuthBrowserClient();
      const listed = await supabase.auth.mfa.listFactors();
      if (listed.error || !listed.data) {
        console.error('MFA factor list failed', listed.error?.code ?? 'no_data');
        setError('Something went wrong. Try again.');
        return;
      }
      const factor = listed.data.totp.find((item) => item.status === 'verified') ?? listed.data.all.find(
        (item) => item.factor_type === 'totp' && item.status === 'verified',
      );
      if (!factor) {
        setError('No authenticator is on this sign-in. Sign out and try again.');
        return;
      }
      const verified = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: trimmed,
      });
      if (verified.error) {
        console.error('MFA challenge failed', verified.error.code);
        setError(messageForCode(verified.error.code));
        return;
      }
      window.location.assign('/dashboard');
    } catch {
      console.error('MFA challenge failed');
      setError('Something went wrong. Try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
        <SideLogo />
        <h1 className="mt-8 text-2xl font-semibold text-slate-50">Two-Factor Authentication</h1>
        {checkFailed ? (
          <p className="mt-3 text-sm text-slate-300">
            We couldn&apos;t confirm your sign-in security. Try again, or sign out and sign in once more.
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-300">Enter the 6-digit code from your authenticator app.</p>
        )}
        {!checkFailed && (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void verify();
            }}
          >
            {error && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="mfa-code" className="mb-1.5 block text-xs font-medium text-slate-300">
                Authentication Code
              </label>
              <input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm tracking-widest text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                placeholder="123456"
              />
            </div>
            <button
              type="submit"
              disabled={isVerifying}
              className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isVerifying ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        )}
        {checkFailed && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Try again
          </button>
        )}
        <button
          type="button"
          onClick={() => void completeSignOut()}
          className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          Sign Out
        </button>
      </div>
    </main>
  );
}
