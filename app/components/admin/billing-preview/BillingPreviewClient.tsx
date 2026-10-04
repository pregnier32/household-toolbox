'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SideLogo } from '@/app/components/SideLogo';
import { useTheme } from '@/app/components/AppThemeProvider';
import { discountAdminStyles } from '@/app/components/admin/discount-codes/styles';
import { PlanBilling } from '@/app/components/plan/PlanBilling';
import { formatPreviewInstant, shiftPreviewDate } from '@/lib/account-pricing';
import { billingDateLabel, dayBeforeLabel } from '@/lib/billing-cycle';
import type { BillingPreviewPayload } from '@/lib/billing-preview';
import { formatDisplayDate } from '@/lib/format-display-date';

const DAY_SHORTCUTS = [
  { label: 'Today', days: 0 },
  { label: '+1 Day', days: 1 },
  { label: '+7 Days', days: 7 },
  { label: '+30 Days', days: 30 },
  { label: '+90 Days', days: 90 },
];

export function BillingPreviewClient({
  userId,
  mode,
}: {
  userId: string;
  mode: 'simulator' | 'customer';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const styles = discountAdminStyles(isLight);
  const [preview, setPreview] = useState<BillingPreviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const effectiveAt = search.get('effectiveAt') || '';
  const customerView = search.get('view') === 'tools' || search.get('view') === 'notices' ? search.get('view') : 'plan';

  useEffect(() => {
    let cancelled = false;
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
        const query = effectiveAt ? `?effectiveAt=${encodeURIComponent(effectiveAt)}` : '';
        return fetch(`/api/admin/users/${userId}/billing-preview${query}`).then((response) => response.json().then((body) => ({ ok: response.ok, body })));
      })
      .then((result) => {
        if (cancelled || !result) return;
        if (!result.ok) {
          setError(result.body.error || 'The billing preview could not be loaded.');
          setPreview(null);
          return;
        }
        setError(null);
        setPreview(result.body);
      })
      .catch(() => {
        if (!cancelled) setError('The billing preview could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveAt, router, userId]);

  const replaceQuery = (next: URLSearchParams) => {
    const text = next.toString();
    router.replace(text ? `${pathname}?${text}` : pathname);
  };

  const setShortcut = (days: number) => {
    const next = new URLSearchParams(search.toString());
    if (days === 0 || !preview) {
      next.delete('effectiveAt');
    } else {
      next.set('effectiveAt', shiftPreviewDate(new Date(preview.actualAt), days).toISOString());
    }
    replaceQuery(next);
  };

  const setCustom = (value: string) => {
    const next = new URLSearchParams(search.toString());
    if (!value) next.delete('effectiveAt');
    else next.set('effectiveAt', value);
    replaceQuery(next);
  };

  const openCustomer = (view: 'plan' | 'tools' | 'notices') => {
    const next = new URLSearchParams(search.toString());
    next.set('view', view);
    const text = next.toString();
    router.push(`/dashboard/admin/users/${userId}/view?${text}`);
  };

  const card = styles.card;
  const promotions = (preview?.promotions ?? []).filter((item) => showHistory || item.timing === 'active' || item.timing === 'scheduled');

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className={styles.headerBar}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <SideLogo priority />
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section
          className={`rounded-lg border px-4 py-4 ${preview?.isTestAccount ? (isLight ? 'border-sky-400 bg-sky-50 text-sky-950' : 'border-sky-400 bg-sky-500/15 text-sky-50') : (isLight ? 'border-amber-500 bg-amber-50 text-amber-950' : 'border-amber-400 bg-amber-500/15 text-amber-50')}`}
          aria-label="Superadmin billing preview"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-wide">SUPERADMIN BILLING PREVIEW</p>
              <p className="mt-1 text-sm font-semibold">{preview?.isTestAccount ? 'TEST ACCOUNT' : 'LIVE CUSTOMER DATA — READ ONLY'}</p>
              <p className="mt-2 text-sm">Viewing: {preview ? `${preview.viewingName} / ${preview.viewingEmail}` : 'Loading account'}</p>
              <p className="text-sm">Actual Date: {preview ? formatPreviewInstant(preview.actualAt) : '—'}</p>
              <p className="text-sm">Simulated Date: {preview ? formatPreviewInstant(preview.simulatedAt) : '—'}</p>
              <p className="text-sm">Simulation: {preview?.simulationIsToday ? 'Today' : 'Future or past date'}</p>
              <p className="text-sm">Account: {preview ? (preview.accountType === 'business' ? 'Business' : 'Personal') : '—'}</p>
              <p className="text-sm">Test Account: {preview ? (preview.isTestAccount ? 'Yes' : 'No') : '—'}</p>
            </div>
            <button type="button" className={styles.secondaryButton} onClick={() => router.push('/dashboard/admin/users')}>
              Exit Preview
            </button>
          </div>
        </section>

        <div className="mt-4 flex flex-wrap items-end gap-2" role="group" aria-label="Simulated date">
          {DAY_SHORTCUTS.map((shortcut) => (
            <button key={shortcut.label} type="button" className={styles.secondaryButton} onClick={() => setShortcut(shortcut.days)}>
              {shortcut.label}
            </button>
          ))}
          {preview?.cycle && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                const next = new URLSearchParams(search.toString());
                next.set('effectiveAt', preview.cycle!.actualNextBillingAt);
                replaceQuery(next);
              }}
            >
              Next Billing Date
            </button>
          )}
          <label className={`text-sm ${styles.muted}`}>
            Custom Date
            <input
              type="date"
              className={`ml-2 ${styles.input}`}
              style={{ width: '11rem' }}
              value={preview ? preview.simulatedAt.slice(0, 10) : ''}
              onChange={(event) => setCustom(event.target.value)}
            />
          </label>
          <button type="button" className={styles.secondaryButton} onClick={() => setShortcut(0)}>Reset</button>
        </div>
        <p className={`mt-2 text-sm ${styles.muted}`}>
          Shortcuts are counted from the actual current time. +30 Days does not add another 30 days to the simulated date.
        </p>

        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Preview sections">
          <button type="button" className={mode === 'simulator' ? styles.primaryButton : styles.secondaryButton} onClick={() => router.push(withQuery(`/dashboard/admin/users/${userId}/billing-preview`, search))}>Billing simulator</button>
          <button type="button" className={styles.secondaryButton} onClick={() => openCustomer('plan')}>View Customer Billing Page</button>
          <button type="button" className={styles.secondaryButton} onClick={() => openCustomer('tools')}>My Tools</button>
          <button type="button" className={styles.secondaryButton} onClick={() => openCustomer('notices')}>Notices</button>
        </nav>

        {error && <p className={`mt-4 ${styles.error}`} role="alert">{error}</p>}
        {!preview && !error && <p className={`mt-6 ${styles.muted}`}>Loading billing preview...</p>}

        {preview && mode === 'simulator' && (
          <div className="mt-6 space-y-8">
            <section>
              <h2 className={styles.sectionTitle}>Account summary</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Active Tools', String(preview.summary.activeTools)],
                  ['Tools in Trial', String(preview.summary.toolsInTrial)],
                  ['Free / Included Tools', String(preview.summary.includedTools)],
                  ['Billable Tools', String(preview.summary.billableTools)],
                  ['Expected Monthly Cost', preview.summary.expectedMonthly],
                  ['Storage Allowance', preview.summary.storageAllowance],
                  ['Storage Used', preview.summary.storageUsed],
                  ['Payment Setup', preview.summary.paymentSetup],
                ].map(([label, value]) => (
                  <div key={label} className={card}>
                    <p className={`text-xs font-medium uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
                    <p className={`mt-2 text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>{value}</p>
                  </div>
                ))}
              </div>
              <p className={`mt-3 ${styles.muted}`}>Payment setup means the account would need payment once billing exists. It does not mean a card is missing. Current expected monthly cost is the live configuration. The current billing-period amount was set at the last anniversary and does not change mid-cycle.</p>
            </section>

            {preview.cycle && (
              <section>
                <h2 className={styles.sectionTitle}>Billing cycle</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['Billing anniversary', `Day ${preview.cycle.anniversaryDay}`],
                    ['First billing date', billingDateLabel(preview.cycle.firstBillingAt)],
                    ['Previous billing date', preview.cycle.previousBillingAt ? billingDateLabel(preview.cycle.previousBillingAt) : 'Not yet'],
                    ['Next billing date', billingDateLabel(preview.cycle.nextBillingAt)],
                    ['Current billing period', preview.cycle.periodStart && preview.cycle.periodEnd ? `${billingDateLabel(preview.cycle.periodStart)} – ${dayBeforeLabel(preview.cycle.periodEnd)}` : 'Not yet'],
                    ['Current expected monthly cost', preview.cycle.currentExpectedMonthly],
                    ['Current billing-period amount', preview.cycle.currentPeriodAmount],
                    ['Estimated next billing amount', preview.cycle.estimatedNextAmount],
                    ['Free slots at next billing', String(preview.cycle.nextFreeSlots)],
                    ['Promotions at next billing', preview.cycle.nextPromotionCodes.join(', ') || 'None'],
                  ].map(([label, value]) => (
                    <div key={label} className={card}>
                      <p className={`text-xs font-medium uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
                      <p className={`mt-2 text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>{value}</p>
                    </div>
                  ))}
                </div>
                <p className={`mt-3 ${styles.muted}`}>Trials: {preview.cycle.trialTools.map((tool) => `${tool.name} (${tool.note})`).join('; ') || 'None'}</p>
                <p className={`mt-1 ${styles.muted}`}>Scheduled for removal: {preview.cycle.scheduledRemovals.map((tool) => `${tool.name} (${tool.note})`).join('; ') || 'None'}</p>
                <h3 className={`mt-6 ${styles.sectionTitle}`}>{preview.cycle.nextBill.heading}</h3>
                <div className={`mt-4 ${styles.tableWrap}`}>
                  <table className="w-full">
                    <thead className={styles.tableHead}>
                      <tr>
                        {['Tool', 'Status', 'Amount'].map((heading) => (
                          <th key={heading} className={styles.tableHeadCell}>{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={styles.tableBody}>
                      {preview.cycle.nextBill.lines.map((line) => (
                        <tr key={line.name} className={styles.row}>
                          <td className={`px-4 py-3 ${styles.primaryText}`}>{line.name}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{line.status}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{line.amount}</td>
                        </tr>
                      ))}
                      {preview.cycle.nextBill.lines.length === 0 && (
                        <tr><td className={`px-4 py-3 ${styles.muted}`} colSpan={3}>No tools on the next bill.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className={`mt-3 ${styles.bodyText}`}>Regular monthly cost: {preview.cycle.nextBill.regularMonthly}</p>
                <p className={styles.bodyText}>Promotions: {preview.cycle.nextBill.promotions}</p>
                <p className={styles.bodyText}>Estimated billing amount: {preview.cycle.nextBill.estimated}</p>
              </section>
            )}

            <section>
              <h2 className={styles.sectionTitle}>Tools</h2>
              <div className={`mt-4 ${styles.tableWrap}`}>
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full">
                    <thead className={styles.tableHead}>
                      <tr>
                        {['Tool', 'Started / Added', 'Trial Status', 'Trial End', 'Coverage', 'Shelf Price', 'Expected Charge', 'Status', 'Why?'].map((heading) => (
                          <th key={heading} className={styles.tableHeadCell}>{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={styles.tableBody}>
                      {preview.tools.map((tool) => (
                        <tr key={tool.id} className={styles.row}>
                          <td className={`px-4 py-3 ${styles.primaryText}`}>{tool.name}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{formatDisplayDate(tool.added)}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{tool.trialStatus}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{tool.trialEnd ? formatDisplayDate(tool.trialEnd) : '—'}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{tool.coverage}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{tool.shelfPrice}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{tool.expectedCharge}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{tool.status}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{tool.reason}</td>
                        </tr>
                      ))}
                      {preview.tools.length === 0 && (
                        <tr><td className={`px-4 py-3 ${styles.muted}`} colSpan={9}>No active tools.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className={card}>
              <h2 className={styles.sectionTitle}>Free tool slots</h2>
              <dl className={`mt-3 space-y-1 ${styles.bodyText}`}>
                <div>Base/Total Free Slots: {preview.slots.baseline}</div>
                <div>Additional Slots: {preview.slots.additional.length > 0 ? preview.slots.additional.join(', ') : 'None'}</div>
                <div>Effective Free Slots: {preview.slots.effective}</div>
                <div>Used: {preview.slots.used}</div>
                <div>Available: {preview.slots.available}</div>
              </dl>
              {preview.slots.effective === 0 && <p className={`mt-2 ${styles.muted}`}>No free-slot benefit is active at this date.</p>}
            </section>

            <section>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className={styles.sectionTitle}>Promotions</h2>
                <button type="button" className={styles.secondaryButton} aria-pressed={showHistory} onClick={() => setShowHistory((value) => !value)}>
                  {showHistory ? 'Hide Promotion History' : 'Show Promotion History'}
                </button>
              </div>
              <div className={`mt-4 ${styles.tableWrap}`}>
                <div className="overflow-x-auto">
                  <table className="min-w-[900px] w-full">
                    <thead className={styles.tableHead}>
                      <tr>
                        {['Name', 'Code', 'Benefit', 'Source', 'Effective', 'Expiration', 'Timing', 'Tools'].map((heading) => (
                          <th key={heading} className={styles.tableHeadCell}>{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={styles.tableBody}>
                      {promotions.map((item) => (
                        <tr key={item.id} className={styles.row}>
                          <td className={`px-4 py-3 ${styles.primaryText}`}>{item.name}</td>
                          <td className={`px-4 py-3 font-mono text-sm ${styles.bodyText}`}>{item.code || '—'}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{item.benefit}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{item.source}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{formatDisplayDate(item.effective)}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{item.expiration ? `${formatDisplayDate(item.expiration)} · ${item.daysRemaining}` : item.daysRemaining}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{item.timing}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{item.tools.length > 0 ? item.tools.join(', ') : '—'}</td>
                        </tr>
                      ))}
                      {promotions.length === 0 && (
                        <tr><td className={`px-4 py-3 ${styles.muted}`} colSpan={8}>{showHistory ? 'No promotion assignments.' : 'No active or scheduled promotions.'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className={card}>
              <h2 className={styles.sectionTitle}>Pricing calculation</h2>
              <ul className="mt-3 space-y-1">
                {preview.pricingLines.map((line) => (
                  <li key={line.label} className={`flex justify-between gap-4 ${line.label === 'Expected monthly cost' ? 'font-semibold' : ''} ${styles.bodyText}`}>
                    <span>{line.label}</span>
                    <span>{line.amount}</span>
                  </li>
                ))}
              </ul>
              <ol className={`mt-4 list-decimal space-y-1 pl-5 ${styles.muted}`}>
                {preview.trace.map((line) => <li key={line}>{line}</li>)}
              </ol>
            </section>

            <section className={card}>
              <h2 className={styles.sectionTitle}>Storage</h2>
              <dl className={`mt-3 space-y-1 ${styles.bodyText}`}>
                <div>Base Storage: {preview.storage.base}</div>
                <div>Purchased Add-On: {preview.storage.addon}</div>
                <div>Promotion Bonus: {preview.storage.bonus}</div>
                <div>Effective Allowance: {preview.storage.allowance}</div>
                <div>Current Usage: {preview.storage.used}</div>
                <div>Percentage Used: {preview.storage.percent}%</div>
              </dl>
              <p className={`mt-2 ${styles.muted}`}>This allowance is calculated only. Upload limits and stored files are not changed.</p>
            </section>

            <section>
              <h2 className={styles.sectionTitle}>Notices at Simulated Date</h2>
              <p className={`mt-2 font-medium ${isLight ? 'text-sky-800' : 'text-sky-200'}`}>Simulation Only — Not Sent</p>
              <div className="mt-3 space-y-3">
                {preview.simulatedNotices.map((notice) => (
                  <article key={notice.eventKey} className={card}>
                    <h3 className="font-semibold">{notice.title}</h3>
                    <p className={`mt-1 ${styles.bodyText}`}>{notice.body}</p>
                  </article>
                ))}
                {preview.simulatedNotices.length === 0 && <p className={styles.muted}>No notice drafts at this date.</p>}
              </div>
            </section>

            <section>
              <h2 className={styles.sectionTitle}>Actual Account Notices</h2>
              <div className="mt-3 space-y-3">
                {preview.actualNotices.map((notice) => (
                  <article key={notice.id} className={card}>
                    <h3 className="font-semibold">{notice.title}</h3>
                    <p className={`mt-1 ${styles.bodyText}`}>{notice.body}</p>
                    <p className={`mt-1 ${styles.muted}`}>{notice.readAt ? 'Read' : 'Unread'} · {formatDisplayDate(notice.createdAt)}</p>
                  </article>
                ))}
                {preview.actualNotices.length === 0 && <p className={styles.muted}>No saved notices.</p>}
              </div>
            </section>

            <section>
              <h2 className={styles.sectionTitle}>Upcoming Billing Events</h2>
              <p className={`mt-2 ${styles.muted}`}>The next 12 months, up to 20 dates. Events at the same instant are grouped. Lifetime benefits have no expiration event.</p>
              <div className={`mt-4 ${styles.tableWrap}`}>
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full">
                    <thead className={styles.tableHead}>
                      <tr>
                        {['Date', 'Event', 'Expected cost before', 'Expected cost after'].map((heading) => (
                          <th key={heading} className={styles.tableHeadCell}>{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={styles.tableBody}>
                      {preview.events.map((event) => (
                        <tr key={event.at} className={styles.row}>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{formatPreviewInstant(event.at)}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{event.labels.join('; ')}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{event.before}</td>
                          <td className={`px-4 py-3 ${styles.bodyText}`}>{event.after}</td>
                        </tr>
                      ))}
                      {preview.events.length === 0 && (
                        <tr><td className={`px-4 py-3 ${styles.muted}`} colSpan={4}>No upcoming billing events in the next 12 months.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        )}

        {preview && mode === 'customer' && customerView === 'plan' && (
          <div className="mt-6">
            <PlanBilling userName={preview.viewingName} preview={{ plan: preview.customerPlan, asOf: preview.simulatedAt.slice(0, 10) }} />
          </div>
        )}

        {preview && mode === 'customer' && customerView === 'tools' && (
          <section className="mt-6">
            <h2 className={styles.sectionTitle}>My Tools</h2>
            <p className={`mt-2 font-medium ${isLight ? 'text-sky-800' : 'text-sky-200'}`}>Read-only preview. Tools cannot be opened, changed, or removed.</p>
            <div className={`mt-4 ${styles.tableWrap}`}>
              <div className="overflow-x-auto">
                <table className="min-w-[640px] w-full">
                  <thead className={styles.tableHead}>
                    <tr>
                      {['Tool', 'Status', 'Expected charge'].map((heading) => (
                        <th key={heading} className={styles.tableHeadCell}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={styles.tableBody}>
                    {preview.customerPlan.tools.map((tool) => (
                      <tr key={tool.id} className={styles.row}>
                        <td className={`px-4 py-3 ${styles.primaryText}`}>{tool.name}</td>
                        <td className={`px-4 py-3 ${styles.bodyText}`}>{tool.label}</td>
                        <td className={`px-4 py-3 ${styles.bodyText}`}>{tool.amount ? `${tool.amount}/month` : '—'}</td>
                      </tr>
                    ))}
                    {preview.customerPlan.tools.length === 0 && (
                      <tr><td className={`px-4 py-3 ${styles.muted}`} colSpan={3}>No active tools.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p className={`mt-4 ${styles.bodyText}`}>Expected Monthly Cost: {preview.customerPlan.currentMonthly}</p>
          </section>
        )}

        {preview && mode === 'customer' && customerView === 'notices' && (
          <div className="mt-6 space-y-8">
            <section>
              <h2 className={styles.sectionTitle}>Actual Account Notices</h2>
              <p className={`mt-2 ${styles.muted}`}>Read-only preview. These notices are not marked read.</p>
              <div className="mt-3 space-y-3">
                {preview.actualNotices.map((notice) => (
                  <article key={notice.id} className={card}>
                    <h3 className="font-semibold">{notice.title}</h3>
                    <p className={`mt-1 ${styles.bodyText}`}>{notice.body}</p>
                  </article>
                ))}
                {preview.actualNotices.length === 0 && <p className={styles.muted}>No saved notices.</p>}
              </div>
            </section>
            <section>
              <h2 className={styles.sectionTitle}>Simulated Notices</h2>
              <p className={`mt-2 font-medium ${isLight ? 'text-sky-800' : 'text-sky-200'}`}>Simulation Only — Not Sent</p>
              <div className="mt-3 space-y-3">
                {preview.simulatedNotices.map((notice) => (
                  <article key={notice.eventKey} className={card}>
                    <h3 className="font-semibold">{notice.title}</h3>
                    <p className={`mt-1 ${styles.bodyText}`}>{notice.body}</p>
                  </article>
                ))}
                {preview.simulatedNotices.length === 0 && <p className={styles.muted}>No notice drafts at this date.</p>}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function withQuery(path: string, search: { toString(): string }): string {
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}
