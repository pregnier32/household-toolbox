'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SideLogo } from '@/app/components/SideLogo';
import { AdminMenu } from '@/app/components/AdminMenu';
import { UserMenu } from '@/app/components/UserMenu';
import { useTheme } from '@/app/components/AppThemeProvider';
import { completeSignOut } from '@/lib/client-sign-out';
import {
  cloneDraftFromCode,
  draftFromCode,
  emptyDiscountDraft,
  DISPLAY_STATUS_LABELS,
  type DiscountCode,
  type DiscountCodeDraft,
  type StoredDiscountStatus,
} from '@/lib/discount-codes';
import { DiscountCodeDetail } from './DiscountCodeDetail';
import { DiscountCodeForm } from './DiscountCodeForm';
import { DiscountCodeList } from './DiscountCodeList';
import { discountAdminStyles } from './styles';

type Screen =
  | { type: 'list' }
  | { type: 'create' }
  | { type: 'edit'; id: string; returnTo: 'list' | 'view' }
  | { type: 'clone'; id: string; returnTo: 'list' | 'view' }
  | { type: 'view'; id: string };

type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function DiscountCodesAdmin() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const styles = discountAdminStyles(isLight);
  const [user, setUser] = useState<{ firstName?: string; lastName?: string; userStatus?: string } | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [codes, setCodes] = useState<DiscountCode[] | null>(null);
  const [screen, setScreen] = useState<Screen>({ type: 'list' });
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const messageTimer = useRef<number | null>(null);

  const loadCodes = useCallback(() => {
    fetch('/api/admin/promotions')
      .then((response) => response.json())
      .then((data) => setCodes(data.codes || []))
      .catch(() => setCodes([]));
  }, []);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((response) => response.json())
      .then((data) => {
        if (!data.user) {
          router.push('/');
          return;
        }
        setUser(data.user);
        if (data.user.userStatus !== 'superadmin') {
          router.push('/dashboard');
          return;
        }
        setIsAuthorized(true);
        loadCodes();
      })
      .catch(() => {
        router.push('/');
      });
  }, [router, loadCodes]);

  const handleSignOut = async () => {
    await completeSignOut();
  };

  const saveRemote = async (path: string, payload: unknown, success: string, next: Screen) => {
    const response = await fetch(path, {
      method: path === '/api/admin/promotions' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      showMessage(data.error || 'That discount code could not be saved.');
      return;
    }
    loadCodes();
    showMessage(success);
    setScreen(next);
  };

  const showMessage = (text: string) => {
    setMessage(text);
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(null), 3500);
  };

  const saveDraft = (draft: DiscountCodeDraft) => {
    if (!codes) return;
    if (screen.type === 'edit') {
      void saveRemote(
        `/api/admin/promotions/${screen.id}`,
        { draft },
        `${draft.publicCode || draft.internalName} was saved.`,
        screen.returnTo === 'view' ? { type: 'view', id: screen.id } : { type: 'list' },
      );
      return;
    }
    void saveRemote('/api/admin/promotions', { draft }, `${draft.publicCode || draft.internalName} was saved.`, { type: 'list' });
  };

  const setStatus = (id: string, status: StoredDiscountStatus) => {
    if (!codes) return;
    const current = codes.find((code) => code.id === id);
    if (!current) return;
    void saveRemote(
      `/api/admin/promotions/${id}`,
      { status },
      `${current.publicCode || current.internalName} now shows as ${DISPLAY_STATUS_LABELS[status]}.`,
      screen.type === 'view' ? { type: 'view', id } : { type: 'list' },
    );
  };

  const requestArchive = (id: string) => {
    const current = codes?.find((code) => code.id === id);
    if (!current) return;
    setConfirm({
      title: `Archive ${current.publicCode}?`,
      body: 'Archived codes stay in the list and can be restored. Nothing is permanently deleted.',
      confirmLabel: 'Archive code',
      onConfirm: () => {
        setStatus(id, 'archived');
        setConfirm(null);
      },
    });
  };

  if (!isAuthorized || !codes) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-slate-400">Loading discount codes...</div>
        </div>
      </main>
    );
  }

  const activeCode = screen.type === 'list' || screen.type === 'create'
    ? null
    : codes.find((code) => code.id === screen.id) ?? null;

  const backTarget = () => {
    if (screen.type === 'list') {
      router.push('/dashboard/admin/site-maintenance');
      return;
    }
    if ((screen.type === 'edit' || screen.type === 'clone') && screen.returnTo === 'view') {
      setScreen({ type: 'view', id: screen.id });
      return;
    }
    setScreen({ type: 'list' });
  };

  const backLabel = screen.type === 'list'
    ? 'Back to Site Maintenance'
    : (screen.type === 'edit' || screen.type === 'clone') && screen.returnTo === 'view'
      ? 'Back to discount code'
      : 'Back to discount codes';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className={styles.headerBar}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <SideLogo priority />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push('/dashboard')} className={styles.headerButton}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Toolbox</span>
            </button>
            <AdminMenu />
            <UserMenu
              userName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Account'}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <button type="button" onClick={backTarget} className={styles.backLink}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>{backLabel}</span>
        </button>

        {message && <div className={`mb-4 ${styles.success}`}>{message}</div>}

        {screen.type === 'list' && (
          <DiscountCodeList
            codes={codes}
            styles={styles}
            isLight={isLight}
            onCreate={() => {
              setMessage(null);
              setScreen({ type: 'create' });
            }}
            onOpen={(id) => setScreen({ type: 'view', id })}
            onReset={undefined}
          />
        )}

        {screen.type === 'view' && activeCode && (
          <DiscountCodeDetail
            code={activeCode}
            styles={styles}
            isLight={isLight}
            onEdit={() => setScreen({ type: 'edit', id: activeCode.id, returnTo: 'view' })}
            onClone={() => setScreen({ type: 'clone', id: activeCode.id, returnTo: 'view' })}
            onSetStatus={(status) => setStatus(activeCode.id, status)}
            onArchive={() => requestArchive(activeCode.id)}
          />
        )}

        {screen.type === 'view' && !activeCode && (
          <div className={styles.note}>That discount code was not found.</div>
        )}

        {screen.type === 'create' && (
          <DiscountCodeForm
            key="create"
            mode="create"
            initial={emptyDiscountDraft()}
            existingCodes={codes}
            styles={styles}
            isLight={isLight}
            onCancel={() => setScreen({ type: 'list' })}
            onSave={saveDraft}
          />
        )}

        {screen.type === 'edit' && activeCode && (
          <DiscountCodeForm
            key={`edit-${activeCode.id}`}
            mode="edit"
            initial={draftFromCode(activeCode)}
            existingCodes={codes}
            editingId={activeCode.id}
            styles={styles}
            isLight={isLight}
            onCancel={backTarget}
            onSave={saveDraft}
          />
        )}

        {screen.type === 'clone' && activeCode && (
          <DiscountCodeForm
            key={`clone-${activeCode.id}`}
            mode="clone"
            initial={cloneDraftFromCode(activeCode)}
            existingCodes={codes}
            sourceCode={activeCode.publicCode}
            styles={styles}
            isLight={isLight}
            onCancel={backTarget}
            onSave={saveDraft}
          />
        )}

        {(screen.type === 'edit' || screen.type === 'clone') && !activeCode && (
          <div className={styles.note}>That discount code was not found.</div>
        )}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirm(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="discount-confirm-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="discount-confirm-title" className={styles.modalTitle}>{confirm.title}</h2>
            <p className={`mt-3 ${styles.muted}`}>{confirm.body}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className={styles.secondaryButton} onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className={styles.primaryButton} onClick={confirm.onConfirm}>{confirm.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
