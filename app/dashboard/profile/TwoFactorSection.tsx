'use client';

import { useCallback, useEffect, useState } from 'react';
import { createSupabaseAuthBrowserClient } from '@/lib/supabaseAuthBrowser';

type VerifiedFactor = {
  id: string;
  friendlyName: string;
  enrolledOn: string | null;
};

function messageForCode(code: string | undefined): string {
  if (code === 'mfa_verification_failed' || code === 'invalid_otp' || code === 'otp_expired') {
    return 'That code is not correct. Enter the current code from your authenticator app.';
  }
  return 'Something went wrong. Try again.';
}

function qrSource(qrCode: string): string {
  const value = qrCode.trim();
  if (value.startsWith('data:image/')) return value;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
}

function formatEnrolled(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function TwoFactorSection() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factors, setFactors] = useState<VerifiedFactor[]>([]);
  const [extraFactorCount, setExtraFactorCount] = useState(0);
  const [enrolling, setEnrolling] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createSupabaseAuthBrowserClient();
    const listed = await supabase.auth.mfa.listFactors();
    if (listed.error || !listed.data) {
      console.error('MFA factor list failed', listed.error?.code ?? 'no_data');
      setError('Something went wrong. Try again.');
      setFactors([]);
      return;
    }
    const verified = listed.data.all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'verified');
    setFactors(
      verified.map((factor) => ({
        id: factor.id,
        friendlyName: factor.friendly_name || 'Authenticator app',
        enrolledOn: formatEnrolled(factor.created_at),
      })),
    );
    setExtraFactorCount(Math.max(0, verified.length - 1));
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh()
      .catch(() => {
        if (!cancelled) setError('Something went wrong. Try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const startEnroll = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const supabase = createSupabaseAuthBrowserClient();
      const listed = await supabase.auth.mfa.listFactors();
      if (listed.error || !listed.data) {
        console.error('MFA enroll preflight failed', listed.error?.code ?? 'no_data');
        setError('Something went wrong. Try again.');
        return;
      }
      const verified = listed.data.all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'verified');
      if (verified.length > 0) {
        await refresh();
        return;
      }
      const pending = listed.data.all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'unverified');
      for (const factor of pending) {
        const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removed.error) console.error('MFA unverified factor cleanup failed', removed.error.code);
      }
      const enrolled = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator app',
      });
      if (enrolled.error || !enrolled.data?.totp) {
        console.error('MFA enrollment failed', enrolled.error?.code ?? 'no_factor');
        setError('Something went wrong. Try again.');
        return;
      }
      setEnrolling({
        factorId: enrolled.data.id,
        qrCode: enrolled.data.totp.qr_code,
        secret: enrolled.data.totp.secret,
      });
      setCode('');
    } catch {
      console.error('MFA enrollment failed');
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const cancelEnroll = async () => {
    if (!enrolling) return;
    setBusy(true);
    try {
      const supabase = createSupabaseAuthBrowserClient();
      const removed = await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
      if (removed.error) console.error('MFA enrollment cancel failed', removed.error.code);
    } catch {
      console.error('MFA enrollment cancel failed');
    } finally {
      setEnrolling(null);
      setCode('');
      setBusy(false);
    }
  };

  const verifyEnroll = async () => {
    if (!enrolling) return;
    const trimmed = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(trimmed)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createSupabaseAuthBrowserClient();
      const verified = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrolling.factorId,
        code: trimmed,
      });
      if (verified.error) {
        console.error('MFA enrollment verify failed', verified.error.code);
        setError(messageForCode(verified.error.code));
        return;
      }
      setEnrolling(null);
      setCode('');
      await refresh();
    } catch {
      console.error('MFA enrollment verify failed');
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    const trimmed = disableCode.replace(/\s/g, '');
    if (!/^\d{6}$/.test(trimmed) || factors.length === 0) {
      setError('Enter the current 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createSupabaseAuthBrowserClient();
      const level = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (level.error || level.data?.currentLevel !== 'aal2') {
        console.error('MFA disable blocked', level.error?.code ?? level.data?.currentLevel ?? 'no_level');
        setError('Sign in with your authenticator code before turning two-factor authentication off.');
        return;
      }
      const verified = await supabase.auth.mfa.challengeAndVerify({
        factorId: factors[0].id,
        code: trimmed,
      });
      if (verified.error) {
        console.error('MFA disable verify failed', verified.error.code);
        setError(messageForCode(verified.error.code));
        return;
      }
      for (const factor of factors) {
        const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removed.error) {
          console.error('MFA unenroll failed', removed.error.code);
          setError('Something went wrong. Try again.');
          return;
        }
      }
      setDisabling(false);
      setDisableCode('');
      await refresh();
    } catch {
      console.error('MFA unenroll failed');
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    if (!enrolling) return;
    try {
      await navigator.clipboard.writeText(enrolling.secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-6 border-t border-slate-800 pt-6">
      <h2 className="mb-2 text-lg font-semibold text-slate-100">Two-Factor Authentication</h2>
      {loading ? (
        <p className="text-sm text-slate-400">Checking authenticator status...</p>
      ) : factors.length === 0 && !enrolling ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            Status: <span className="font-semibold text-slate-100">Off</span>
          </p>
          <p className="text-sm text-slate-400">
            Protect your account with an authenticator app. When enabled, you&apos;ll enter a security code after your password when signing in.
          </p>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="button"
            onClick={() => void startEnroll()}
            disabled={busy}
            className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Starting...' : 'Enable Two-Factor Authentication'}
          </button>
        </div>
      ) : enrolling ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">Step 1 — Scan QR Code</h3>
          <p className="text-sm text-slate-400">Open your authenticator app and scan this QR code.</p>
          {/* The SVG comes from Supabase Auth enroll. It is not sent to an outside QR service. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSource(enrolling.qrCode)}
            alt="QR code for your authenticator app"
            className="h-48 w-48 rounded-lg bg-white p-2"
          />
          <p className="text-sm text-slate-400">Can&apos;t scan it? Enter this setup key manually.</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-slate-900 px-3 py-2 text-sm tracking-wide text-slate-100">{enrolling.secret}</code>
            <button
              type="button"
              onClick={() => void copySecret()}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <h3 className="text-sm font-semibold text-slate-100">Step 2 — Verify</h3>
          <p className="text-sm text-slate-400">Enter the current code from your authenticator app.</p>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm tracking-widest text-slate-100"
            placeholder="123456"
            aria-label="Authentication code"
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void verifyEnroll()}
              disabled={busy}
              className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {busy ? 'Verifying...' : 'Verify and Enable'}
            </button>
            <button
              type="button"
              onClick={() => void cancelEnroll()}
              disabled={busy}
              className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            Status: <span className="font-semibold text-emerald-300">On</span>
          </p>
          <p className="text-sm text-slate-400">Your account requires a code from your authenticator app when signing in.</p>
          <p className="text-sm text-slate-300">Method: Authenticator App</p>
          <p className="text-sm text-slate-300">{factors[0]?.friendlyName}</p>
          {factors[0]?.enrolledOn && <p className="text-sm text-slate-400">Enabled {factors[0].enrolledOn}</p>}
          {extraFactorCount > 0 && (
            <p className="text-sm text-slate-400">
              This account has more than one authenticator. Turning it off removes all of them.
            </p>
          )}
          {error && <p className="text-sm text-red-300">{error}</p>}
          {!disabling ? (
            <button
              type="button"
              onClick={() => {
                setDisabling(true);
                setError(null);
              }}
              className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Disable Two-Factor Authentication
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">Enter the current code from your authenticator app to turn this off.</p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={disableCode}
                onChange={(event) => setDisableCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm tracking-widest text-slate-100"
                placeholder="123456"
                aria-label="Authentication code to disable two-factor authentication"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void disable()}
                  disabled={busy}
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {busy ? 'Turning off...' : 'Turn off'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDisabling(false);
                    setDisableCode('');
                    setError(null);
                  }}
                  disabled={busy}
                  className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
