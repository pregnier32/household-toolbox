'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserMenu } from '../../components/UserMenu';
import { SideLogo } from '../../components/SideLogo';
import { useTheme } from '../../components/AppThemeProvider';
import { completeSignOut } from '@/lib/client-sign-out';

type HouseholdUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'active';
  joinedAt: string;
};

type HouseholdInvitation = {
  id: string;
  firstName: string;
  email: string;
  status: 'pending';
  invitedAt: string;
  expiresAt: string;
  expired: boolean;
};

type Directory = {
  spotsUsed: number;
  spotLimit: number;
  canInvite: boolean;
  users: HouseholdUser[];
  invitations: HouseholdInvitation[];
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function displayName(firstName: string, lastName?: string): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim() || 'User';
}

export function ManageUsersClient({ householdReady }: { householdReady: boolean }) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const router = useRouter();
  const [userName, setUserName] = useState('Account');
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(householdReady);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<HouseholdUser | null>(null);

  const headerChromeButtonClass = isLight
    ? 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900'
    : 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100';
  const headerBarClass = isLight
    ? 'border-b-2 border-slate-400 bg-slate-900/50'
    : 'border-b border-slate-800 bg-slate-900/50';
  const cardClass = isLight
    ? 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm'
    : 'rounded-lg border border-slate-800 bg-slate-900/70 p-4';
  const mutedClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400';
  const titleClass = isLight ? 'text-2xl font-semibold text-slate-900' : 'text-2xl font-semibold text-slate-50';
  const inputClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100';
  const primaryButtonClass =
    'rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50';
  const secondaryButtonClass = isLight
    ? 'rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50'
    : 'rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50';
  const dangerButtonClass =
    'rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50';

  const loadDirectory = useCallback(async () => {
    const response = await fetch('/api/household/users');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load household users.');
    setDirectory(data);
  }, []);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) {
          router.push('/');
          return;
        }
        setUserName(`${data.user.firstName || ''} ${data.user.lastName || ''}`.trim() || 'Account');
      })
      .catch(() => router.push('/'));
  }, [router]);

  useEffect(() => {
    if (!householdReady) return;
    loadDirectory()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load household users.'))
      .finally(() => setIsLoading(false));
  }, [householdReady, loadDirectory]);

  const sendInvitation = async () => {
    setIsSending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/household/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send the invitation.');
      setInviteOpen(false);
      setFirstName('');
      setEmail('');
      setNotice('Invitation sent.');
      await loadDirectory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the invitation.');
    } finally {
      setIsSending(false);
    }
  };

  const resend = async (invitationId: string) => {
    setBusyId(invitationId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/household/invitations/${invitationId}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not resend the invitation.');
      setNotice('Invitation resent.');
      await loadDirectory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the invitation.');
    } finally {
      setBusyId(null);
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    setBusyId(invitationId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/household/invitations/${invitationId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not cancel the invitation.');
      setNotice('Invitation cancelled.');
      await loadDirectory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel the invitation.');
    } finally {
      setBusyId(null);
    }
  };

  const removeUser = async () => {
    if (!removeTarget) return;
    setBusyId(removeTarget.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/household/users/${removeTarget.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not remove that User.');
      setNotice(`${removeTarget.firstName} was removed.`);
      setRemoveTarget(null);
      await loadDirectory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that User.');
    } finally {
      setBusyId(null);
    }
  };

  const spotsUsed = directory?.spotsUsed ?? 0;
  const spotLimit = directory?.spotLimit ?? 4;
  const canInvite = directory?.canInvite ?? false;

  return (
    <main className={isLight ? 'min-h-screen bg-slate-100 text-slate-900' : 'min-h-screen bg-slate-950 text-slate-100'}>
      <header className={headerBarClass}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <SideLogo />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => router.push('/dashboard')} className={headerChromeButtonClass}>
              Dashboard
            </button>
            <UserMenu userName={userName} onSignOut={() => completeSignOut()} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className={titleClass}>Household Users</h1>
            <p className={`mt-1 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
              {spotsUsed} of {spotLimit} User spots used
            </p>
            <p className={`mt-2 max-w-xl ${mutedClass}`}>
              Invite family members to share your Household Toolbox account.
            </p>
          </div>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={!householdReady || !canInvite || isLoading}
            onClick={() => {
              setError(null);
              setInviteOpen(true);
            }}
          >
            + Invite User
          </button>
        </div>

        {!canInvite && directory && (
          <p className={`mb-4 ${mutedClass}`}>Cancel a pending invitation or remove a User to free a spot.</p>
        )}
        {error && (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}
        {notice && (
          <p className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>
        )}

        {!householdReady ? (
          <div className={cardClass}>
            <p className={mutedClass}>
              Household sharing is not set up yet. Run supabase/archive/platform/households.sql in the Supabase SQL editor.
            </p>
          </div>
        ) : isLoading ? (
          <p className={mutedClass}>Loading household users...</p>
        ) : (
          <div className="space-y-3">
            {(directory?.users || []).map((member) => (
              <article key={member.id} className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}>
                <div>
                  <p className="font-medium">{displayName(member.firstName, member.lastName)}</p>
                  <p className={mutedClass}>{member.email}</p>
                  <p className={`mt-1 ${mutedClass}`}>Active · Joined {formatDate(member.joinedAt)}</p>
                </div>
                <button type="button" className={dangerButtonClass} onClick={() => setRemoveTarget(member)}>
                  Remove User
                </button>
              </article>
            ))}
            {(directory?.invitations || []).map((invitation) => (
              <article key={invitation.id} className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}>
                <div>
                  <p className="font-medium">{invitation.firstName}</p>
                  <p className={mutedClass}>{invitation.email}</p>
                  <p className={`mt-1 ${mutedClass}`}>
                    Invitation Pending · Invited {formatDate(invitation.invitedAt)}
                    {invitation.expired ? ' · Expired' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={busyId === invitation.id}
                    onClick={() => void resend(invitation.id)}
                  >
                    Resend Invitation
                  </button>
                  <button
                    type="button"
                    className={dangerButtonClass}
                    disabled={busyId === invitation.id}
                    onClick={() => void cancelInvitation(invitation.id)}
                  >
                    Cancel Invitation
                  </button>
                </div>
              </article>
            ))}
            {directory && directory.users.length === 0 && directory.invitations.length === 0 && (
              <div className={cardClass}>
                <p className={mutedClass}>No Users yet. Invite a family member to share this account.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className={`w-full max-w-md p-6 ${cardClass}`} role="dialog" aria-modal="true" aria-labelledby="invite-user-title">
            <h2 id="invite-user-title" className="mb-4 text-lg font-semibold">Invite User</h2>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void sendInvitation();
              }}
            >
              <label className="block text-sm">
                First Name
                <input className={`mt-1 ${inputClass}`} value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
              </label>
              <label className="block text-sm">
                Email Address
                <input className={`mt-1 ${inputClass}`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className={secondaryButtonClass} onClick={() => setInviteOpen(false)} disabled={isSending}>
                  Cancel
                </button>
                <button type="submit" className={primaryButtonClass} disabled={isSending}>
                  {isSending ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className={`w-full max-w-md p-6 ${cardClass}`} role="dialog" aria-modal="true">
            <h2 className="mb-2 text-lg font-semibold">
              Remove {removeTarget.firstName} from your Household Toolbox account?
            </h2>
            <p className={mutedClass}>
              {removeTarget.firstName} will immediately lose access to this household&apos;s tools and information. Data they
              previously created will remain in the household.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={secondaryButtonClass} onClick={() => setRemoveTarget(null)} disabled={busyId === removeTarget.id}>
                Cancel
              </button>
              <button type="button" className={dangerButtonClass} onClick={() => void removeUser()} disabled={busyId === removeTarget.id}>
                Remove User
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
