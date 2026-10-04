'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@/app/components/AppThemeProvider';
import { discountAdminStyles } from '@/app/components/admin/discount-codes/styles';
import { getDisplayStatus, type DiscountCode } from '@/lib/discount-codes';
import { isAffectingEntitlement, type UserEntitlement } from '@/lib/user-entitlements-preview';

export function UserDiscountCodesDialog({
  userId,
  userName,
  onClose,
}: {
  userId: string;
  userName: string;
  onClose: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const styles = discountAdminStyles(resolvedTheme === 'light');
  const [current, setCurrent] = useState<UserEntitlement[] | null>(null);
  const [codes, setCodes] = useState<DiscountCode[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [override, setOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      fetch(`/api/admin/users/${userId}/entitlements`).then((response) => response.json().then((body) => ({ ok: response.ok, body }))),
      fetch('/api/admin/promotions').then((response) => response.json().then((body) => ({ ok: response.ok, body }))),
    ])
      .then(([entitlements, promotions]) => {
        if (!entitlements.ok) throw new Error(entitlements.body.error || 'Discount codes could not be loaded.');
        if (!promotions.ok) throw new Error(promotions.body.error || 'Discount codes could not be loaded.');
        const rows = ((entitlements.body.entitlements || []) as UserEntitlement[])
          .filter((item) => item.publicCode && isAffectingEntitlement(item))
          .sort((left, right) => left.publicCode.localeCompare(right.publicCode));
        const available = ((promotions.body.codes || []) as DiscountCode[])
          .filter((code) => getDisplayStatus(code) === 'active' && code.publicCode)
          .sort((left, right) => left.publicCode.localeCompare(right.publicCode));
        setCurrent(rows);
        setCodes(available);
        setSelectedId((currentId) => (available.some((code) => code.id === currentId) ? currentId : available[0]?.id || ''));
      })
      .catch((loadError) => {
        setCurrent([]);
        setCodes([]);
        setError(loadError instanceof Error ? loadError.message : 'Discount codes could not be loaded.');
      });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const addCode = () => {
    if (!selectedId) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    fetch(`/api/admin/users/${userId}/entitlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promotionId: selectedId, override }),
    })
      .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
      .then((result) => {
        if (!result.ok) throw new Error(result.body.error || 'That discount code could not be added.');
        const added = codes?.find((code) => code.id === selectedId);
        setNotice(`${added?.publicCode || 'That code'} was added.`);
        setOverride(false);
        load();
      })
      .catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : 'That discount code could not be added.');
      })
      .finally(() => setIsSaving(false));
  };

  const descriptionFor = (code: string) => codes?.find((item) => item.publicCode === code)?.customerDescription || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className={`${styles.modal} max-h-[90vh] overflow-y-auto`}
        style={{ maxWidth: '36rem' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-discount-codes-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="user-discount-codes-title" className={styles.modalTitle}>Discount codes</h2>
            <p className={`mt-1 ${styles.muted}`}>{userName}</p>
          </div>
          <button type="button" className={styles.textButton} onClick={onClose}>Close</button>
        </div>

        {error && <p className={`mt-4 ${styles.error}`} role="alert">{error}</p>}
        {notice && <p className={`mt-4 ${styles.success}`}>{notice}</p>}

        <h3 className={`mt-5 ${styles.sectionTitle}`}>Currently in use</h3>
        {current == null ? (
          <p className={`mt-3 ${styles.muted}`}>Loading discount codes...</p>
        ) : current.length === 0 ? (
          <p className={`mt-3 ${styles.note}`}>No discount codes are on this account.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {current.map((item) => (
              <li key={item.id} className={styles.choice}>
                <p className={`font-mono text-sm font-semibold ${styles.primaryText}`}>{item.publicCode}</p>
                <p className={`mt-1 ${styles.muted}`}>{descriptionFor(item.publicCode) || item.name}</p>
              </li>
            ))}
          </ul>
        )}

        <h3 className={`mt-6 ${styles.sectionTitle}`}>Add a discount code</h3>
        <label className={`mt-3 ${styles.label}`} htmlFor="add-discount-code">Discount code</label>
        <select
          id="add-discount-code"
          className={styles.input}
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          disabled={!codes || codes.length === 0 || isSaving}
        >
          {(codes ?? []).map((code) => (
            <option key={code.id} value={code.id}>
              {code.publicCode} — {code.customerDescription}
            </option>
          ))}
        </select>
        {codes && codes.length === 0 && <p className={`mt-2 ${styles.muted}`}>No active discount codes are available to add.</p>}
        <label className={`mt-3 flex items-start gap-2 ${styles.bodyText}`}>
          <input
            type="checkbox"
            className="mt-1"
            checked={override}
            onChange={(event) => setOverride(event.target.checked)}
          />
          <span>Assign even if the code rules would block this account.</span>
        </label>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Close</button>
          <button type="button" className={styles.primaryButton} disabled={!selectedId || isSaving} onClick={addCode}>
            {isSaving ? 'Adding...' : 'Add code'}
          </button>
        </div>
      </div>
    </div>
  );
}
