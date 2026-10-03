'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SideLogo } from '@/app/components/SideLogo';
import { useTheme } from '@/app/components/AppThemeProvider';
import { discountAdminStyles, statusBadgeClass } from '@/app/components/admin/discount-codes/styles';
import { formatDisplayDate } from '@/lib/format-display-date';
import type { DiscountCode } from '@/lib/discount-codes';
import {
  DISPLAY_ENTITLEMENT_LABELS,
  ENTITLEMENT_SOURCE_LABELS,
  ENTITLEMENT_SOURCES,
  HISTORY_STATUS_FILTERS,
  HISTORY_STATUS_FILTER_LABELS,
  entitlementBenefit,
  entitlementHeadline,
  expirationLabel,
  getEntitlementDisplayStatus,
  isAffectingEntitlement,
  isCurrentEntitlement,
  matchesHistoryStatus,
  remainingLabel,
  type DisplayEntitlementStatus,
  type EntitlementSource,
  type HistoryStatusFilter,
  type UserEntitlement,
} from '@/lib/user-entitlements-preview';
import { ApplyPromotionDialog, EndBenefitDialog, ManualEntitlementDialog } from './EntitlementDialogs';

type LiveTool = { name: string; toolState: string; trialState: string; pricing: string };
type LivePricing = { current: string; upcoming: string; paymentStatus: string; paymentMethod: string; tools: LiveTool[] };
type AccountSummary = {
  accountType: 'personal' | 'business';
  isTestAccount: boolean;
  activeTools: number;
  activePromotions: number;
  freeSlots: number;
  expectedMonthly: string;
  storageUsed: string;
  storageAllowance: string;
};

function entitlementBadge(status: DisplayEntitlementStatus, isLight: boolean): string {
  if (status === 'expiring_soon') {
    const base = 'inline-flex rounded-full px-2 py-0.5 text-xs font-medium';
    return `${base} ${isLight ? 'bg-amber-100 text-amber-900' : 'bg-amber-500/20 text-amber-200'}`;
  }
  if (status === 'removed') {
    const base = 'inline-flex rounded-full px-2 py-0.5 text-xs font-medium';
    return `${base} ${isLight ? 'bg-rose-100 text-rose-900' : 'bg-rose-500/20 text-rose-200'}`;
  }
  return statusBadgeClass(status === 'expired' ? 'expired' : status, isLight);
}

function SummaryCard({
  title,
  value,
  lines,
  styles,
  isLight,
}: {
  title: string;
  value: string;
  lines: string[];
  styles: ReturnType<typeof discountAdminStyles>;
  isLight: boolean;
}) {
  return (
    <div className={styles.card}>
      <p className={`text-xs font-medium uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{title}</p>
      <p className={`mt-2 text-xl font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>{value}</p>
      <ul className="mt-2 space-y-1">
        {lines.length === 0 && <li className={styles.muted}>None</li>}
        {lines.map((line) => (
          <li key={line} className={styles.muted}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export function UserEntitlementsAdmin({
  userId,
  userName,
  userEmail,
}: {
  userId: string;
  userName: string;
  userEmail: string;
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const styles = discountAdminStyles(isLight);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [entitlements, setEntitlements] = useState<UserEntitlement[] | null>(null);
  const [codes, setCodes] = useState<DiscountCode[] | null>(null);
  const [pricing, setPricing] = useState<LivePricing | null>(null);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [ending, setEnding] = useState<UserEntitlement | null>(null);
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<EntitlementSource | 'all'>('all');
  const messageTimer = useRef<number | null>(null);

  const loadEntitlements = useCallback(() => {
    fetch(`/api/admin/users/${userId}/entitlements`)
      .then((response) => response.json())
      .then((data) => {
        setEntitlements(data.entitlements || []);
        setPricing(data.pricing || null);
        setAccount(data.account || null);
      })
      .catch(() => setEntitlements([]));
  }, [userId]);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((response) => response.json())
      .then((data) => {
        if (!data.user) {
          router.push('/');
          return;
        }
        if (data.user.userStatus !== 'superadmin') {
          router.push('/dashboard');
          return;
        }
        setIsAuthorized(true);
        loadEntitlements();
        fetch('/api/admin/promotions')
          .then((response) => response.json())
          .then((payload) => setCodes(payload.codes || []))
          .catch(() => setCodes([]));
      })
      .catch(() => {
        router.push('/');
      });
  }, [router, loadEntitlements]);

  const showMessage = (text: string) => {
    setMessage(text);
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(null), 3500);
  };

  const current = useMemo(
    () => (entitlements ?? []).filter((item) => isCurrentEntitlement(item)),
    [entitlements],
  );
  const affecting = useMemo(
    () => (entitlements ?? []).filter((item) => isAffectingEntitlement(item)),
    [entitlements],
  );
  const history = useMemo(() => {
    return (entitlements ?? [])
      .filter((item) => matchesHistoryStatus(item, statusFilter))
      .filter((item) => sourceFilter === 'all' || item.source === sourceFilter)
      .slice()
      .sort((left, right) => right.assignedAt.localeCompare(left.assignedAt));
  }, [entitlements, sourceFilter, statusFilter]);

  if (!isAuthorized || !entitlements || !codes) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-slate-400">Loading discounts and entitlements...</div>
        </div>
      </main>
    );
  }

  const displayName = userName || 'User';
  const summaryLine = (item: UserEntitlement) => {
    const prefix = getEntitlementDisplayStatus(item) === 'scheduled' ? 'Scheduled · ' : '';
    if (item.discountType === 'free_tool_slots') {
      const lifetime = item.expirationDate ? remainingLabel(item.expirationDate) : 'Lifetime';
      return `${prefix}${item.name} · ${entitlementBenefit(item)} · ${lifetime} · ${ENTITLEMENT_SOURCE_LABELS[item.source]}`;
    }
    if (item.discountType === 'specific_tools') {
      return `${prefix}${entitlementHeadline(item)}`;
    }
    if (item.discountType === 'bonus_storage') {
      const when = item.expirationDate ? `Expires ${formatDisplayDate(item.expirationDate)}` : 'Lifetime';
      return `${prefix}${entitlementBenefit(item)} · ${when} · ${remainingLabel(item.expirationDate)}`;
    }
    return `${prefix}${item.publicCode || item.name} · ${entitlementBenefit(item)} · ${remainingLabel(item.expirationDate)}`;
  };
  const linesFor = (type: UserEntitlement['discountType']) => (
    current.filter((item) => item.discountType === type).map(summaryLine)
  );
  const slotTotal = affecting.find((item) => item.discountType === 'free_tool_slots' && item.slotMode === 'total');
  const storageBenefit = affecting.find((item) => item.discountType === 'bonus_storage');

  const accountDiscounts = affecting.filter((item) => (
    item.discountType === 'percent_100' || item.discountType === 'percentage' || item.discountType === 'fixed_amount'
  ));

  const reload = (text: string) => {
    loadEntitlements();
    showMessage(text);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className={styles.headerBar}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <SideLogo priority />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <button type="button" onClick={() => router.push('/dashboard/admin/users')} className={styles.backLink}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Users</span>
        </button>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className={styles.title}>Discounts & Entitlements</h1>
            <p className={styles.subtitle}>
              {displayName}{userEmail ? ` · ${userEmail}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={styles.primaryButton} onClick={() => setApplyOpen(true)}>
              Apply Discount / Promotion
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => setManualOpen(true)}>
              Add Manual Entitlement
            </button>
          </div>
        </div>

        {message && <div className={`mb-4 ${styles.success}`}>{message}</div>}

        <p className={`mb-4 ${styles.note}`}>
          These benefits are saved for this account. Each one keeps its own history. Expected cost is calculated. No payment is collected here.
        </p>

        <section className="mb-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <h2 className={styles.sectionTitle}>Account</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={styles.primaryButton} onClick={() => router.push(`/dashboard/admin/users/${userId}/billing-preview`)}>
                Open Billing Preview
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => router.push(`/dashboard/admin/users/${userId}/view?view=plan`)}>
                View as Customer
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Account Type', account ? (account.accountType === 'business' ? 'Business' : 'Personal') : '—'],
              ['Test Account', account ? (account.isTestAccount ? 'Yes' : 'No') : '—'],
              ['Active Tools', account ? String(account.activeTools) : '—'],
              ['Active Promotions', account ? String(account.activePromotions) : '—'],
              ['Effective Free Slots', account ? String(account.freeSlots) : '—'],
              ['Current Expected Monthly Cost', account?.expectedMonthly || '—'],
              ['Storage Used / Allowance', account ? `${account.storageUsed} / ${account.storageAllowance}` : '—'],
            ].map(([label, value]) => (
              <div key={label} className={styles.card}>
                <p className={`text-xs font-medium uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
                <p className={`mt-2 ${styles.bodyText}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className={styles.bodyText}>Test Account</span>
            <button
              type="button"
              className={styles.secondaryButton}
              aria-pressed={Boolean(account?.isTestAccount)}
              onClick={() => {
                if (!account) return;
                const next = !account.isTestAccount;
                fetch(`/api/admin/users/${userId}/entitlements`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ isTestAccount: next }),
                })
                  .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
                  .then((result) => {
                    if (!result.ok) {
                      showMessage(result.body.error || 'The test account flag could not be saved.');
                      return;
                    }
                    setAccount({ ...account, isTestAccount: next });
                    showMessage(next ? 'Marked as a test account.' : 'Marked as a live account.');
                  })
                  .catch(() => showMessage('The test account flag could not be saved.'));
              }}
            >
              {account?.isTestAccount ? 'Yes' : 'No'}
            </button>
            <p className={styles.muted}>Changing this flag does not change pricing, promotions, or stored data.</p>
          </div>
        </section>

        <div className="mb-6 flex flex-wrap gap-2">
          <a href="#benefit-summary" className={styles.jump}>Summary</a>
          <a href="#current-benefits" className={styles.jump}>Current</a>
          <a href="#benefit-history" className={styles.jump}>History</a>
          <a href="#tool-context" className={styles.jump}>Tools</a>
          <a href="#billing-placeholder" className={styles.jump}>Billing</a>
        </div>

        <section id="benefit-summary" className="mb-8">
          <h2 className={styles.sectionTitle}>Account benefit summary</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              title="Active Promotions"
              value={String(affecting.length)}
              lines={[
                ...affecting.map((item) => item.publicCode || item.name),
                ...current.filter((item) => getEntitlementDisplayStatus(item) === 'scheduled').map((item) => `Scheduled · ${item.publicCode || item.name}`),
              ]}
              styles={styles}
              isLight={isLight}
            />
            <SummaryCard
              title="Free Tool Slots"
              value={slotTotal ? `${slotTotal.quantity} total` : (affecting.some((item) => item.discountType === 'free_tool_slots') ? 'On account' : 'None')}
              lines={linesFor('free_tool_slots')}
              styles={styles}
              isLight={isLight}
            />
            <SummaryCard
              title="Specific Free Tools"
              value={affecting.some((item) => item.discountType === 'specific_tools') ? 'On account' : 'None'}
              lines={linesFor('specific_tools')}
              styles={styles}
              isLight={isLight}
            />
            <SummaryCard
              title="Account Discount"
              value={accountDiscounts.length > 0 ? entitlementBenefit(accountDiscounts[0]) : 'None'}
              lines={[
                ...accountDiscounts.map((item) => summaryLine(item)),
                ...current
                  .filter((item) => getEntitlementDisplayStatus(item) === 'scheduled' && (
                    item.discountType === 'percent_100' || item.discountType === 'percentage' || item.discountType === 'fixed_amount'
                  ))
                  .map((item) => summaryLine(item)),
              ]}
              styles={styles}
              isLight={isLight}
            />
            <SummaryCard
              title="Bonus Storage"
              value={storageBenefit ? entitlementBenefit(storageBenefit) : 'None'}
              lines={linesFor('bonus_storage')}
              styles={styles}
              isLight={isLight}
            />
          </div>
        </section>

        <section id="current-benefits" className="mb-8">
          <h2 className={styles.sectionTitle}>Active discounts and entitlements</h2>
          <p className={styles.subtitle}>Benefits that are active, expiring soon, or scheduled. Expired and removed records stay in history.</p>
          <div className={`mt-4 ${styles.tableWrap}`}>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full">
                <thead className={styles.tableHead}>
                  <tr>
                    {['Promotion / Entitlement', 'Code', 'Benefit', 'Source', 'Effective Date', 'Expiration', 'Status', 'Actions'].map((heading) => (
                      <th key={heading} className={styles.tableHeadCell}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={styles.tableBody}>
                  {current.length === 0 && (
                    <tr>
                      <td colSpan={8} className={`px-4 py-6 ${styles.muted}`}>No current benefits on this preview.</td>
                    </tr>
                  )}
                  {current.map((item) => {
                    const status = getEntitlementDisplayStatus(item);
                    return (
                      <tr key={item.id} className={styles.row}>
                        <td className="px-4 py-3">
                          <div className={styles.primaryText}>{item.name}</div>
                          {item.notes && <div className={`mt-1 max-w-xs text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{item.notes}</div>}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm">{item.publicCode || '—'}</td>
                        <td className={`px-4 py-3 ${styles.bodyText}`}>{entitlementBenefit(item)}</td>
                        <td className={`px-4 py-3 ${styles.bodyText}`}>{ENTITLEMENT_SOURCE_LABELS[item.source]}</td>
                        <td className={`px-4 py-3 ${styles.bodyText}`}>{formatDisplayDate(item.effectiveDate)}</td>
                        <td className={`px-4 py-3 ${styles.bodyText}`}>
                          <div>{expirationLabel(item.expirationDate)}</div>
                          <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{remainingLabel(item.expirationDate)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={entitlementBadge(status, isLight)}>{DISPLAY_ENTITLEMENT_LABELS[status]}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button type="button" className={styles.actionMuted} onClick={() => setEnding(item)}>
                            End benefit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="benefit-history" className="mb-8">
          <h2 className={styles.sectionTitle}>Promotion and entitlement history</h2>
          <p className={styles.subtitle}>Records stay here after they expire or are ended. This preview does not delete history.</p>
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {HISTORY_STATUS_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`${styles.jump} ${statusFilter === filter ? (isLight ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-emerald-500 bg-emerald-500/10 text-emerald-200') : ''}`}
                  onClick={() => setStatusFilter(filter)}
                >
                  {HISTORY_STATUS_FILTER_LABELS[filter]}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <span className={styles.muted}>Source</span>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value as EntitlementSource | 'all')}
                className={`${styles.input} w-auto`}
                aria-label="Filter history by source"
              >
                <option value="all">All sources</option>
                {ENTITLEMENT_SOURCES.map((source) => (
                  <option key={source} value={source}>{ENTITLEMENT_SOURCE_LABELS[source]}</option>
                ))}
              </select>
            </label>
          </div>
          <div className={`mt-4 ${styles.tableWrap}`}>
            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full">
                <thead className={styles.tableHead}>
                  <tr>
                    {['Promotion / Entitlement', 'Code', 'Benefit', 'Source', 'Assigned', 'Effective', 'Expiration', 'Status', 'Assigned By', 'Removed'].map((heading) => (
                      <th key={heading} className={styles.tableHeadCell}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={styles.tableBody}>
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={10} className={`px-4 py-6 ${styles.muted}`}>No history records match these filters.</td>
                    </tr>
                  )}
                  {history.map((item) => {
                    const status = getEntitlementDisplayStatus(item);
                    return (
                      <tr key={item.id} className={styles.row}>
                        <td className="px-4 py-3">
                          <div className={styles.primaryText}>{item.name}</div>
                          {item.notes && <div className={`mt-1 max-w-xs text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{item.notes}</div>}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm">{item.publicCode || '—'}</td>
                        <td className={`px-4 py-3 ${styles.bodyText}`}>{entitlementBenefit(item)}</td>
                        <td className={`px-4 py-3 ${styles.bodyText}`}>{ENTITLEMENT_SOURCE_LABELS[item.source]}</td>
                        <td className={`px-4 py-3 ${styles.bodyText}`}>{formatDisplayDate(item.assignedAt)}</td>
                        <td className={`px-4 py-3 ${styles.bodyText}`}>{formatDisplayDate(item.effectiveDate)}</td>
                        <td className={`px-4 py-3 ${styles.bodyText}`}>{expirationLabel(item.expirationDate)}</td>
                        <td className="px-4 py-3">
                          <span className={entitlementBadge(status, isLight)}>{DISPLAY_ENTITLEMENT_LABELS[status]}</span>
                        </td>
                        <td className={`px-4 py-3 ${styles.bodyText}`}>{item.assignedBy}</td>
                        <td className={`px-4 py-3 ${styles.bodyText}`}>
                          {item.removedAt ? (
                            <>
                              <div>{formatDisplayDate(item.removedAt)}</div>
                              <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{item.removedBy || 'Superadmin'}</div>
                              {item.removalReason && <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{item.removalReason}</div>}
                            </>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="tool-context" className="mb-8">
          <h2 className={styles.sectionTitle}>Tool and trial context</h2>
          <p className={styles.subtitle}>
            Current tool access from the pricing engine. This screen does not change trial history.
          </p>
          <div className={`mt-4 ${styles.tableWrap}`}>
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full">
                <thead className={styles.tableHead}>
                  <tr>
                    {['Tool', 'Tool State', 'Trial State', 'Pricing Context'].map((heading) => (
                      <th key={heading} className={styles.tableHeadCell}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={styles.tableBody}>
                  {(pricing?.tools ?? []).map((row) => (
                    <tr key={row.name} className={styles.row}>
                      <td className={`px-4 py-3 ${styles.primaryText}`}>{row.name}</td>
                      <td className={`px-4 py-3 ${styles.bodyText}`}>{row.toolState}</td>
                      <td className={`px-4 py-3 ${styles.bodyText}`}>{row.trialState}</td>
                      <td className={`px-4 py-3 ${styles.bodyText}`}>{row.pricing}</td>
                    </tr>
                  ))}
                  {(pricing?.tools.length ?? 0) === 0 && (
                    <tr>
                      <td className={`px-4 py-3 ${styles.muted}`} colSpan={4}>No active tools.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="billing-placeholder">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className={styles.sectionTitle}>Billing</h2>
              <p className={styles.subtitle}>Expected cost from the pricing engine. No payment method is stored.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Expected Monthly Cost', pricing?.current || '—'],
              ['Upcoming Expected Cost', pricing?.upcoming || '—'],
              ['Payment setup', pricing?.paymentStatus || '—'],
              ['Payment Method', pricing?.paymentMethod || 'Not configured yet'],
            ].map(([label, value]) => (
              <div key={label} className={styles.card}>
                <p className={`text-xs font-medium uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
                <p className={`mt-2 ${styles.bodyText}`}>{value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {applyOpen && (
        <ApplyPromotionDialog
          codes={codes}
          entitlements={entitlements}
          userName={displayName}
          styles={styles}
          isLight={isLight}
          onClose={() => setApplyOpen(false)}
          onApply={(code, notes, override) => {
            fetch(`/api/admin/users/${userId}/entitlements`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ promotionId: code.id, note: notes, override }),
            })
              .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'That promotion could not be applied.');
                setApplyOpen(false);
                reload(`${code.publicCode || code.internalName} was applied to this account.`);
              })
              .catch((error) => showMessage(error instanceof Error ? error.message : 'That promotion could not be applied.'));
          }}
        />
      )}

      {manualOpen && (
        <ManualEntitlementDialog
          styles={styles}
          isLight={isLight}
          onClose={() => setManualOpen(false)}
          onSave={(draft) => {
            fetch(`/api/admin/users/${userId}/entitlements`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ manual: draft }),
            })
              .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'That entitlement could not be saved.');
                setManualOpen(false);
                reload('The manual entitlement was added.');
              })
              .catch((error) => showMessage(error instanceof Error ? error.message : 'That entitlement could not be saved.'));
          }}
        />
      )}

      {ending && (
        <EndBenefitDialog
          item={ending}
          userName={displayName}
          styles={styles}
          onClose={() => setEnding(null)}
          onConfirm={(reason) => {
            fetch(`/api/admin/users/${userId}/entitlements`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ assignmentId: ending.id, reason }),
            })
              .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'That benefit could not be ended.');
                setEnding(null);
                reload(`${ending.name} was ended. The record stays in history as Removed.`);
              })
              .catch((error) => showMessage(error instanceof Error ? error.message : 'That benefit could not be ended.'));
          }}
        />
      )}
    </main>
  );
}
