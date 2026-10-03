'use client';

import { formatDisplayDate } from '@/lib/format-display-date';
import {
  ACCOUNT_TYPE_LABELS,
  assignmentLabel,
  discountTypeLabel,
  DISPLAY_STATUS_LABELS,
  durationPhrase,
  ELIGIBLE_USER_LABELS,
  formatRedeemWindow,
  getDisplayStatus,
  partnerCampaignLabel,
  perUserLabel,
  platformLabel,
  previewHeadline,
  redemptionLimitLabel,
  REDEMPTION_SOURCE_LABELS,
  slotModeLabel,
  toolNamesForSlugs,
  type DiscountCode,
} from '@/lib/discount-codes';
import { statusBadgeClass, type DiscountAdminStyles } from './styles';

type DiscountCodeDetailProps = {
  code: DiscountCode;
  styles: DiscountAdminStyles;
  isLight: boolean;
  onEdit: () => void;
  onClone: () => void;
  onSetStatus: (status: DiscountCode['status']) => void;
  onArchive: () => void;
};

function statusAction(code: DiscountCode): { label: string; next: DiscountCode['status'] } {
  const display = getDisplayStatus(code);
  if (display === 'archived') return { label: 'Unarchive', next: 'inactive' };
  if (display === 'inactive' || display === 'draft') return { label: 'Activate', next: 'active' };
  return { label: 'Deactivate', next: 'inactive' };
}

export function DiscountCodeDetail({
  code,
  styles,
  isLight,
  onEdit,
  onClone,
  onSetStatus,
  onArchive,
}: DiscountCodeDetailProps) {
  const display = getDisplayStatus(code);
  const action = statusAction(code);
  const toolNames = toolNamesForSlugs(code.toolSlugs);

  const facts: { label: string; value: string }[] = [
    { label: 'Promotion name', value: code.internalName },
    { label: 'Public code', value: code.publicCode },
    { label: 'Benefit type', value: discountTypeLabel(code.discountType) },
    { label: 'Benefit', value: previewHeadline(code) },
    { label: 'Duration', value: durationPhrase(code.durationUnit, code.durationAmount) },
    { label: 'Can be redeemed', value: formatRedeemWindow(code.redeemStartDate, code.redeemEndDate) },
    { label: 'Redemption limit', value: redemptionLimitLabel(code) },
    { label: 'Per user', value: perUserLabel(code.perUserRedemption) },
    { label: 'Eligible users', value: ELIGIBLE_USER_LABELS[code.eligibleUsers] },
    { label: 'Account types', value: ACCOUNT_TYPE_LABELS[code.eligibleAccountType] },
    { label: 'Combines with other discounts', value: code.canStack ? 'Yes' : 'No' },
    { label: 'Assignment', value: assignmentLabel(code.assignmentMethod) },
    { label: 'Partner / campaign', value: partnerCampaignLabel(code) },
    { label: 'Platform', value: platformLabel(code.platform) },
    { label: 'Revenue share', value: code.revenueSharePercent.trim() ? `${code.revenueSharePercent}% for later reporting` : 'Not set' },
    { label: 'Created', value: formatDisplayDate(code.createdAt) || '—' },
    { label: 'Last updated', value: formatDisplayDate(code.updatedAt) || '—' },
  ];

  if (code.discountType === 'free_tool_slots') {
    facts.splice(4, 0, { label: 'Slot behavior', value: slotModeLabel(code.slotMode, code.quantity) });
  }
  if (code.discountType === 'specific_tools') {
    facts.splice(4, 0, { label: 'Tools', value: toolNames.length > 0 ? toolNames.join(', ') : 'None selected' });
  }

  const reportCards = [
    { label: 'Total redemptions', value: code.redemptionCount.toLocaleString('en-US') },
    { label: 'Active users', value: code.activeUsers.toLocaleString('en-US') },
    { label: 'Expired assignments', value: code.expiredAssignments.toLocaleString('en-US') },
    { label: 'Expected discount', value: 'Not split per code' },
    { label: 'Revenue generated', value: 'Not available yet' },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={styles.title}>{code.internalName}</h1>
            <span className={statusBadgeClass(display, isLight)}>{DISPLAY_STATUS_LABELS[display]}</span>
          </div>
          <p className={`${styles.subtitle} font-mono tracking-wide`}>{code.publicCode}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={styles.secondaryButton} onClick={onEdit}>Edit</button>
          <button type="button" className={styles.secondaryButton} onClick={onClone}>Duplicate</button>
          <button type="button" className={styles.secondaryButton} onClick={() => onSetStatus(action.next)}>{action.label}</button>
          {display !== 'archived' && (
            <button type="button" className={styles.secondaryButton} onClick={onArchive}>Archive</button>
          )}
        </div>
      </div>

      <div className={`mb-6 ${styles.preview}`}>
        <p className={`text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>Customer-facing benefit</p>
        <p className={`mt-2 text-2xl font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>{previewHeadline(code)}</p>
        {code.customerDescription && <p className={`mt-2 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{code.customerDescription}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Promotion details</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>{fact.label}</dt>
                <dd className={`mt-1 text-sm ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <div className="space-y-4">
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Description shown to customer</h2>
            <p className={`mt-3 text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{code.customerDescription || 'No customer description.'}</p>
          </section>
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Internal admin notes</h2>
            <p className={`mt-3 text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{code.adminNotes || 'No internal notes.'}</p>
          </section>
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Partner notes</h2>
            <p className={`mt-3 text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{code.partnerNotes || 'No partner notes.'}</p>
          </section>
        </div>
      </div>

      <section className="mt-6">
        <h2 className={styles.sectionTitle}>Sample reporting</h2>
        <p className={styles.hint}>These figures are sample data for layout review.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {reportCards.map((card) => (
            <div key={card.label} className={styles.card}>
              <p className={styles.muted}>{card.label}</p>
              <p className={`mt-2 text-xl font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>{card.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className={`${styles.sectionTitle} mb-3`}>Recent redemptions</h2>
        <div className={styles.tableWrap}>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full">
              <thead className={styles.tableHead}>
                <tr>
                  {['User', 'Redemption date', 'Status', 'Expiration date', 'Source'].map((heading) => (
                    <th key={heading} className={styles.tableHeadCell}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={styles.tableBody}>
                {code.redemptions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`px-4 py-8 text-center ${styles.muted}`}>No redemptions yet.</td>
                  </tr>
                ) : code.redemptions.map((redemption) => (
                  <tr key={redemption.id} className={styles.row}>
                    <td className={`px-4 py-3 ${styles.primaryText}`}>{redemption.userName}</td>
                    <td className={`px-4 py-3 ${styles.muted}`}>{formatDisplayDate(redemption.redeemedAt)}</td>
                    <td className="px-4 py-3">
                      <span className={statusBadgeClass(redemption.status === 'active' ? 'active' : 'expired', isLight)}>
                        {redemption.status === 'active' ? 'Active' : 'Expired'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${styles.muted}`}>{redemption.expiresAt ? formatDisplayDate(redemption.expiresAt) : 'Lifetime'}</td>
                    <td className={`px-4 py-3 ${styles.bodyText}`}>{REDEMPTION_SOURCE_LABELS[redemption.source]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
