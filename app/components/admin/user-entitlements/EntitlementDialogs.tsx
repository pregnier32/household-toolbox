'use client';

import { useMemo, useState } from 'react';
import {
  ACCOUNT_TYPE_LABELS,
  DISCOUNT_TYPE_OPTIONS,
  DISPLAY_STATUS_LABELS,
  ELIGIBLE_USER_LABELS,
  assignmentLabel,
  benefitLabel,
  discountToolsByCategory,
  durationPhrase,
  getDisplayStatus,
  partnerCampaignLabel,
  previewHeadline,
  slotModeLabel,
  type DiscountCode,
  type DiscountType,
  type DurationUnit,
  type SlotMode,
} from '@/lib/discount-codes';
import {
  emptyManualDraft,
  entitlementBenefit,
  entitlementFromManual,
  expirationLabel,
  promotionAssignmentWarning,
  validateManualDraft,
  type ManualEntitlementDraft,
  type UserEntitlement,
} from '@/lib/user-entitlements-preview';
import { statusBadgeClass, type DiscountAdminStyles } from '@/app/components/admin/discount-codes/styles';

const DURATION_OPTIONS: { value: DurationUnit; label: string }[] = [
  { value: 'days', label: 'Days' },
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
  { value: 'lifetime', label: 'Lifetime' },
];

function warningClass(isLight: boolean): string {
  return isLight
    ? 'rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950'
    : 'rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100';
}

function DetailLine({ label, value, styles }: { label: string; value: string; styles: DiscountAdminStyles }) {
  return (
    <div>
      <dt className={styles.hint}>{label}</dt>
      <dd className={`mt-0.5 ${styles.bodyText}`}>{value}</dd>
    </div>
  );
}

export function ApplyPromotionDialog({
  codes,
  entitlements,
  userName,
  styles,
  isLight,
  onClose,
  onApply,
}: {
  codes: DiscountCode[];
  entitlements: UserEntitlement[];
  userName: string;
  styles: DiscountAdminStyles;
  isLight: boolean;
  onClose: () => void;
  onApply: (code: DiscountCode, notes: string, override: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);

  const available = useMemo(() => {
    const query = search.trim().toLowerCase();
    return codes
      .filter((code) => getDisplayStatus(code) !== 'archived')
      .filter((code) => {
        if (!query) return true;
        const haystack = `${code.internalName} ${code.publicCode} ${previewHeadline(code)} ${code.partnerName} ${code.campaignName}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((left, right) => left.publicCode.localeCompare(right.publicCode));
  }, [codes, search]);

  const selected = available.find((code) => code.id === selectedId) ?? null;
  const warning = selected ? promotionAssignmentWarning(selected) : null;
  const alreadyOpen = selected
    ? entitlements.some((item) => item.status !== 'removed' && item.publicCode === selected.publicCode)
    : false;
  const needsOverride = warning?.tone === 'override';
  const canAssign = Boolean(selected) && (!needsOverride || overrideConfirmed);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        className={`${styles.modal} flex max-h-[90vh] flex-col`}
        style={{ maxWidth: '48rem' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-promotion-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="apply-promotion-title" className={styles.modalTitle}>Apply Discount / Promotion</h2>
            <p className={`mt-1 ${styles.muted}`}>Choose a promotion for {userName}. Archived promotions are not listed.</p>
          </div>
          <button type="button" className={styles.textButton} onClick={onClose}>Close</button>
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, code, or benefit"
            className={styles.input}
            aria-label="Search promotions"
          />

          <div className="max-h-52 space-y-2 overflow-y-auto">
            {available.length === 0 && <p className={styles.note}>No promotions match that search.</p>}
            {available.map((code) => {
              const status = getDisplayStatus(code);
              const selectedRow = code.id === selectedId;
              return (
                <button
                  key={code.id}
                  type="button"
                  className={`w-full ${selectedRow ? styles.choiceSelected : styles.choice}`}
                  onClick={() => {
                    setSelectedId(code.id);
                    setOverrideConfirmed(false);
                  }}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className={styles.primaryText}>{code.internalName}</span>
                    <span className={statusBadgeClass(status, isLight)}>{DISPLAY_STATUS_LABELS[status]}</span>
                  </span>
                  <span className={`mt-1 block font-mono text-xs ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>{code.publicCode}</span>
                  <span className={`mt-1 block ${styles.muted}`}>{previewHeadline(code)}</span>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className={styles.preview}>
              <p className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>{previewHeadline(selected)}</p>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <DetailLine label="Promotion" value={selected.internalName} styles={styles} />
                <DetailLine label="Code" value={selected.publicCode} styles={styles} />
                <DetailLine label="Benefit" value={benefitLabel(selected)} styles={styles} />
                <DetailLine label="Duration" value={durationPhrase(selected.durationUnit, selected.durationAmount)} styles={styles} />
                <DetailLine label="Promotion status" value={DISPLAY_STATUS_LABELS[getDisplayStatus(selected)]} styles={styles} />
                <DetailLine label="How it is offered" value={assignmentLabel(selected.assignmentMethod)} styles={styles} />
                <DetailLine label="Eligibility" value={`${ELIGIBLE_USER_LABELS[selected.eligibleUsers]} · ${ACCOUNT_TYPE_LABELS[selected.eligibleAccountType]}`} styles={styles} />
                <DetailLine label="Campaign / partner" value={partnerCampaignLabel(selected)} styles={styles} />
              </dl>
            </div>
          )}

          {warning && <p className={warningClass(isLight)}>{warning.message}</p>}
          {alreadyOpen && (
            <p className={styles.note}>
              This user already has an open record for {selected?.publicCode}. Applying it again adds another stacked benefit. It does not replace the earlier one.
            </p>
          )}

          {needsOverride && (
            <label className={`flex items-start gap-2 ${styles.bodyText}`}>
              <input
                type="checkbox"
                className="mt-1"
                checked={overrideConfirmed}
                onChange={(event) => setOverrideConfirmed(event.target.checked)}
              />
              <span>Assign anyway and keep this override on the record.</span>
            </label>
          )}

          <div>
            <label className={styles.label} htmlFor="apply-notes">Internal note</label>
            <textarea
              id="apply-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className={styles.input}
              placeholder="Optional note for the audit trail"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!canAssign}
            onClick={() => {
              if (selected && canAssign) onApply(selected, notes, overrideConfirmed);
            }}
          >
            Apply to user
          </button>
        </div>
      </div>
    </div>
  );
}

export function ManualEntitlementDialog({
  styles,
  isLight,
  onClose,
  onSave,
}: {
  styles: DiscountAdminStyles;
  isLight: boolean;
  onClose: () => void;
  onSave: (draft: ManualEntitlementDraft) => void;
}) {
  const [draft, setDraft] = useState<ManualEntitlementDraft>(emptyManualDraft);
  const [error, setError] = useState<string | null>(null);
  const groups = discountToolsByCategory();
  const preview = entitlementFromManual('preview', {
    ...draft,
    notes: draft.notes.trim() || 'Preview',
  });

  const setType = (discountType: DiscountType) => {
    setDraft((current) => ({ ...current, discountType }));
  };

  const toggleTool = (slug: string) => {
    setDraft((current) => ({
      ...current,
      toolSlugs: current.toolSlugs.includes(slug)
        ? current.toolSlugs.filter((item) => item !== slug)
        : [...current.toolSlugs, slug],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        className={`${styles.modal} flex max-h-[90vh] flex-col`}
        style={{ maxWidth: '48rem' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-entitlement-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="manual-entitlement-title" className={styles.modalTitle}>Add Manual Entitlement</h2>
            <p className={`mt-1 ${styles.muted}`}>A benefit that does not come from a public discount code.</p>
          </div>
          <button type="button" className={styles.textButton} onClick={onClose}>Close</button>
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-2 sm:grid-cols-2">
            {DISCOUNT_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={draft.discountType === option.value ? styles.choiceSelected : styles.choice}
                onClick={() => setType(option.value)}
              >
                <span className={styles.primaryText}>{option.title}</span>
                <span className={`mt-1 block text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{option.description}</span>
              </button>
            ))}
          </div>

          {draft.discountType === 'free_tool_slots' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={styles.label} htmlFor="slot-count">Free tool slots</label>
                <input
                  id="slot-count"
                  type="number"
                  min={1}
                  value={draft.quantity}
                  onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })}
                  className={styles.input}
                />
              </div>
              <div className="space-y-2">
                <span className={styles.label}>How to apply the slots</span>
                {(['additional', 'total'] as SlotMode[]).map((mode) => (
                  <label key={mode} className={`flex items-center gap-2 ${styles.bodyText}`}>
                    <input
                      type="radio"
                      name="slot-mode"
                      checked={draft.slotMode === mode}
                      onChange={() => setDraft({ ...draft, slotMode: mode })}
                    />
                    {slotModeLabel(mode, draft.quantity)}
                  </label>
                ))}
              </div>
            </div>
          )}

          {draft.discountType === 'specific_tools' && (
            <div>
              <span className={styles.label}>Tools</span>
              <div className={`max-h-48 space-y-3 overflow-y-auto rounded-lg border p-3 ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
                {groups.map((group) => (
                  <div key={group.category}>
                    <p className={`mb-1 text-xs font-medium uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{group.category}</p>
                    <div className="space-y-1">
                      {group.tools.map((tool) => (
                        <label key={tool.slug} className={`flex items-center gap-2 ${styles.bodyText}`}>
                          <input
                            type="checkbox"
                            checked={draft.toolSlugs.includes(tool.slug)}
                            onChange={() => toggleTool(tool.slug)}
                          />
                          {tool.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {draft.discountType === 'percentage' && (
            <div>
              <label className={styles.label} htmlFor="percent-off">Percent off</label>
              <input
                id="percent-off"
                type="number"
                min={1}
                max={100}
                value={draft.quantity}
                onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })}
                className={styles.input}
              />
            </div>
          )}

          {draft.discountType === 'fixed_amount' && (
            <div>
              <label className={styles.label} htmlFor="dollar-off">Dollars off per month</label>
              <input
                id="dollar-off"
                type="number"
                min={0.01}
                step="0.01"
                value={draft.quantity}
                onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })}
                className={styles.input}
              />
            </div>
          )}

          {draft.discountType === 'bonus_storage' && (
            <div>
              <label className={styles.label} htmlFor="bonus-gb">Bonus storage (GB)</label>
              <input
                id="bonus-gb"
                type="number"
                min={1}
                value={draft.quantity}
                onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })}
                className={styles.input}
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={styles.label} htmlFor="duration-amount">Duration</label>
              <input
                id="duration-amount"
                type="number"
                min={1}
                disabled={draft.durationUnit === 'lifetime'}
                value={draft.durationUnit === 'lifetime' ? '' : draft.durationAmount}
                onChange={(event) => setDraft({ ...draft, durationAmount: Number(event.target.value) })}
                className={styles.input}
              />
            </div>
            <div>
              <label className={styles.label} htmlFor="duration-unit">Unit</label>
              <select
                id="duration-unit"
                value={draft.durationUnit}
                onChange={(event) => setDraft({ ...draft, durationUnit: event.target.value as DurationUnit })}
                className={styles.input}
              >
                {DURATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={styles.label} htmlFor="effective-date">Effective date</label>
              <input
                id="effective-date"
                type="date"
                value={draft.effectiveDate}
                onChange={(event) => setDraft({ ...draft, effectiveDate: event.target.value })}
                className={styles.input}
              />
            </div>
          </div>

          <div>
            <label className={styles.label} htmlFor="manual-reason">Internal reason / notes</label>
            <textarea
              id="manual-reason"
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              rows={3}
              className={styles.input}
              placeholder="Beta tester appreciation"
            />
          </div>

          <div className={styles.preview}>
            <p className={styles.hint}>Preview</p>
            <p className={`mt-1 text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>{preview.name}</p>
            <p className={`mt-1 ${styles.bodyText}`}>
              {entitlementBenefit(preview)} · {durationPhrase(draft.durationUnit, draft.durationAmount)} · Assigned by Superadmin
            </p>
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              const nextError = validateManualDraft(draft);
              setError(nextError);
              if (!nextError) onSave(draft);
            }}
          >
            Add entitlement
          </button>
        </div>
      </div>
    </div>
  );
}

export function EndBenefitDialog({
  item,
  userName,
  styles,
  onClose,
  onConfirm,
}: {
  item: UserEntitlement;
  userName: string;
  styles: DiscountAdminStyles;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="end-benefit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="end-benefit-title" className={styles.modalTitle}>End Benefit</h2>
        <p className={`mt-2 ${styles.muted}`}>
          This stops the benefit for {userName}. The record stays in history as Removed.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <DetailLine label="Promotion / entitlement" value={item.name} styles={styles} />
          <DetailLine label="Benefit" value={entitlementBenefit(item)} styles={styles} />
          <DetailLine label="Current expiration" value={expirationLabel(item.expirationDate)} styles={styles} />
          <DetailLine label="User" value={userName} styles={styles} />
        </dl>
        <div className="mt-4">
          <label className={styles.label} htmlFor="removal-reason">Reason for removal</label>
          <textarea
            id="removal-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            className={styles.input}
            placeholder="Customer request, promotion correction, or another note"
          />
          <p className={styles.hint}>Optional. Saved on the history record with who ended it and when.</p>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400"
            onClick={() => onConfirm(reason)}
          >
            End benefit
          </button>
        </div>
      </div>
    </div>
  );
}
