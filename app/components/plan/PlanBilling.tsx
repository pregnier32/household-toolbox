'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { SideLogo } from '@/app/components/SideLogo';
import { UserMenu } from '@/app/components/UserMenu';
import { useTheme } from '@/app/components/AppThemeProvider';
import { completeSignOut } from '@/lib/client-sign-out';
import { formatDisplayDate } from '@/lib/format-display-date';
import {
  CUSTOMER_SOURCE_LABELS,
  customerTiming,
  type CustomerPlanBenefit,
} from '@/lib/customer-plan-preview';
import type { PlanStatementRow } from '@/lib/billing-preview';

type PlanPayload = {
  accountType: 'personal' | 'business';
  freeSlots: number;
  freeSlotsUsed: number;
  freeSlotsRemaining: number;
  tools: { id: string; name: string; label: string; amount: string | null; addedAt: string | null; price: string }[];
  statement: PlanStatementRow[];
  benefits: CustomerPlanBenefit[];
  currentMonthly: string;
  upcoming: { at: string; amount: string } | null;
  storageUsed: string;
  storageAllowance: string;
  paymentMethod: string;
  paymentMethodStatus?: 'saved' | 'absent' | 'pending';
  paymentAction?: 'none' | 'setup' | 'pay' | 'manage';
  paymentRoute?: 'none' | 'checkout' | 'portal';
  paymentExplanation?: string;
  paymentButtonLabel?: string | null;
  collectedTodayCents?: number;
  nextAmountCents?: number;
  outstandingInvoiceCents?: number;
  paymentSecondary?: {
    action: 'pay' | 'manage';
    route: 'portal';
    collectedTodayCents: number;
    buttonLabel: string;
  } | null;
  subscriptionStatus?: string | null;
  cancellation?: { message: string | null; accessEndsLabel: string | null } | null;
  paymentSetupWouldBeNeeded: boolean;
  access?: {
    locked: boolean;
    pending: boolean;
    message: string | null;
    warning: string | null;
    debtNotice: string | null;
    recovery: Array<'setup_payment' | 'review_tools' | 'manage_billing'>;
    causingTools: { toolId: string; name: string }[];
  } | null;
  notice: { title: string; body: string } | null;
  billingCycle?: {
    nextBillingDate: string;
    estimatedNextBill: string;
    nextBillingAt: string;
    anchorDate?: string;
    amountDueNow?: string;
    scheduledChargeDate?: string | null;
    scheduledChargeAmount?: string | null;
    renewalDate?: string;
    renewalAmount?: string;
  } | null;
};

export function PlanBilling({
  userName,
  preview,
}: {
  userName: string;
  preview?: { plan: PlanPayload; asOf: string };
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const [loadedPlan, setLoadedPlan] = useState<PlanPayload | null>(null);
  const plan = preview?.plan ?? loadedPlan;
  const [codeInput, setCodeInput] = useState('');
  const [formMessage, setFormMessage] = useState<{ tone: 'ok' | 'error'; title: string; detail?: string } | null>(null);
  const [selected, setSelected] = useState<CustomerPlanBenefit | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<{ tone: 'error' | 'notice'; text: string } | null>(null);
  const [openingPayment, setOpeningPayment] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const openingPaymentRef = useRef(false);
  const checkout = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get('checkout'),
    () => null,
  );
  const setupConfirmed = plan?.paymentMethodStatus === 'saved';
  const checkoutNote = checkout === 'success' && !setupConfirmed
    ? { tone: 'ok' as const, text: 'Payment setup was submitted. This page updates after Stripe confirms the result.' }
    : checkout === 'cancel'
      ? { tone: 'notice' as const, text: 'Payment setup was canceled. No payment was collected.' }
      : null;

  const headerChromeButtonClass = isLight
    ? 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900'
    : 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100';
  const headerBarClass = isLight
    ? 'border-b-2 border-slate-400 bg-slate-900/50'
    : 'border-b border-slate-800 bg-slate-900/50';
  const pageTitleClass = isLight ? 'text-2xl font-semibold text-slate-900' : 'text-2xl font-semibold text-slate-50';
  const pageSubtitleClass = isLight ? 'mt-1 text-sm text-slate-600' : 'mt-1 text-sm text-slate-400';
  const tableCardClass = isLight
    ? 'mb-6 rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm'
    : 'mb-6 rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden';
  const theadClass = isLight ? 'bg-slate-100' : 'bg-slate-800/50';
  const thLeftClass = isLight
    ? 'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600'
    : 'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300';
  const thMidClass = isLight
    ? 'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600'
    : 'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300';
  const thRightClass = isLight
    ? 'px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-600'
    : 'px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-300';
  const tbodyDivideClass = isLight ? 'divide-y divide-slate-200' : 'divide-y divide-slate-800';
  const rowHoverClass = isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/30';
  const cellNameClass = isLight ? 'text-sm font-medium text-slate-900' : 'text-sm font-medium text-slate-100';
  const cellMutedClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-300';
  const amountClass = isLight ? 'text-sm font-medium text-slate-900' : 'text-sm font-medium text-slate-100';
  const discountClass = isLight ? 'text-sm font-medium text-emerald-800' : 'text-sm font-medium text-emerald-300';
  const subtotalRowClass = isLight ? 'bg-slate-50' : 'bg-slate-800/40';
  const totalRowClass = isLight ? 'bg-emerald-50' : 'bg-emerald-500/10';
  const noticeClass = isLight
    ? 'mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950'
    : 'mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100';
  const previewNoteClass = isLight
    ? 'mb-6 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-950'
    : 'mb-6 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-100';
  const messageClass = (tone: 'ok' | 'error') => tone === 'ok'
    ? (isLight ? 'mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900' : 'mb-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300')
    : (isLight ? 'mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800' : 'mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300');
  const inputClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 sm:max-w-xs'
    : 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 sm:max-w-xs';
  const primaryButtonClass = 'rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400';
  const textButtonClass = isLight
    ? 'text-sm font-medium text-emerald-800 underline-offset-2 hover:underline'
    : 'text-sm font-medium text-emerald-300 underline-offset-2 hover:underline';
  const modalCardClass = isLight
    ? 'w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl'
    : 'w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl';
  const modalTitleClass = isLight ? 'text-xl font-semibold text-slate-900' : 'text-xl font-semibold text-slate-50';
  const modalBodyClass = isLight ? 'text-sm text-slate-700' : 'text-sm text-slate-300';
  const cancelButtonClass = isLight
    ? 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100'
    : 'rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700';

  const load = () => {
    return fetch('/api/account/plan')
      .then((response) => response.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setLoadError(null);
        setLoadedPlan(data);
      })
      .catch(() => {
        setLoadError('Plan and billing could not be loaded.');
      });
  };

  useEffect(() => {
    if (preview) return;
    load();
  }, [preview]);

  const asOf = preview?.asOf;
  const applyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (preview) return;
    const response = await fetch('/api/account/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeInput }),
    });
    const data = await response.json();
    if (!response.ok) {
      setFormMessage({ tone: 'error', title: data.error || 'That code could not be applied.' });
      return;
    }
    setCodeInput('');
    setFormMessage({
      tone: 'ok',
      title: `${data.displayName || 'The code'} was applied.`,
      detail: data.description,
    });
    load();
  };

  const openPayment = (request: { action: 'setup' | 'pay' | 'manage'; route: 'checkout' | 'portal'; collectedTodayCents: number }) => {
    if (preview || !plan || openingPaymentRef.current) return;
    openingPaymentRef.current = true;
    setOpeningPayment(true);
    setPaymentMessage(null);
    const path = request.route === 'portal' ? '/api/stripe/portal' : '/api/stripe/checkout';
    fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: request.action,
        collectedTodayCents: request.collectedTodayCents,
        nextAmountCents: plan.nextAmountCents ?? 0,
        outstandingInvoiceCents: plan.outstandingInvoiceCents ?? 0,
      }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (data.refresh) {
          setPaymentMessage({
            tone: 'notice',
            text: data.explanation || 'These amounts changed after the page loaded. Review the updated billing state before continuing.',
          });
          openingPaymentRef.current = false;
          setOpeningPayment(false);
          load();
          return;
        }
        if (!response.ok || !data.url) throw new Error(data.error || 'Payment could not be opened.');
        window.location.assign(data.url);
      })
      .catch((error: unknown) => {
        setPaymentMessage({
          tone: 'error',
          text: error instanceof Error ? error.message : 'Payment could not be opened.',
        });
        openingPaymentRef.current = false;
        setOpeningPayment(false);
      });
  };

  if (!plan) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {checkoutNote && (
            <p className={checkoutNote.tone === 'ok' ? messageClass('ok') : noticeClass}>{checkoutNote.text}</p>
          )}
          {loadError ? (
            <div className={messageClass('error')}>
              <p>{loadError}</p>
              <button type="button" className={`mt-3 ${primaryButtonClass}`} onClick={() => { setLoadError(null); load(); }}>Try again</button>
            </div>
          ) : (
            <div className={pageSubtitleClass}>Loading plan and billing...</div>
          )}
        </div>
      </main>
    );
  }

  const accountLabel = plan.accountType === 'business' ? 'Business' : 'Personal';
  const loadedStatement = plan.statement ?? [];
  const statement: PlanStatementRow[] = [];
  const sawTools = loadedStatement.some((row) => row.kind === 'section' && row.label === 'Tools');
  let sawStorage = loadedStatement.some((row) => row.kind === 'section' && row.label === 'Storage');
  if (!sawTools) statement.push({ id: 'section-tools', kind: 'section', label: 'Tools', detail: null, amount: null, benefitId: null });
  for (const row of loadedStatement) {
    if (row.kind === 'storage' && !sawStorage) {
      statement.push({ id: 'section-storage', kind: 'section', label: 'Storage', detail: null, amount: null, benefitId: null });
      sawStorage = true;
    }
    statement.push(row.kind === 'storage' && row.label === 'Storage'
      ? { ...row, label: row.detail?.endsWith('of 200 MB') ? 'Free Acct' : 'Paid Acct' }
      : row);
  }
  const openBenefit = (id: string | null) => {
    if (!id) return;
    const match = plan.benefits.find((item) => item.id === id);
    if (match) setSelected(match);
  };

  const shellClass = preview ? '' : 'min-h-screen bg-slate-950 text-slate-100';
  const Shell = preview ? 'div' : 'main';
  return (
    <Shell className={shellClass}>
      {!preview && (
        <header className={headerBarClass}>
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <SideLogo priority />
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => router.push('/dashboard')} className={headerChromeButtonClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Toolbox</span>
              </button>
              <UserMenu userName={userName} onSignOut={() => completeSignOut()} />
            </div>
          </div>
        </header>
      )}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className={pageTitleClass}>Plan & Billing</h1>
            <p className={pageSubtitleClass}>
              {accountLabel} account. Your tools, storage, and monthly cost.
            </p>
          </div>
          {!preview && (
            <form className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center" onSubmit={applyCode}>
              <label className="sr-only" htmlFor="discount-code">Discount code</label>
              <input id="discount-code" value={codeInput} onChange={(event) => setCodeInput(event.target.value)} className={inputClass} placeholder="Discount code" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
              <button type="submit" className={primaryButtonClass}>Apply</button>
            </form>
          )}
        </div>

        {preview && (
          <p className={previewNoteClass}>
            Read-only preview. Discount codes, tool changes, and notice actions are turned off.
          </p>
        )}

        {(plan.access?.message || plan.access?.warning || plan.access?.debtNotice) && (
          <section className={`mb-4 ${noticeClass}`}>
            {plan.access.message && <p>{plan.access.message}</p>}
            {plan.access.warning && <p className={plan.access.message ? 'mt-2' : ''}>{plan.access.warning}</p>}
            {plan.access.debtNotice && <p className="mt-2">{plan.access.debtNotice}</p>}
            {plan.access.causingTools.length > 0 && (
              <p className="mt-2">Tools requiring payment: {plan.access.causingTools.map((tool) => tool.name).join(', ')}.</p>
            )}
            {!preview && plan.access.recovery.length > 0 && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {plan.access.recovery.includes('setup_payment') && plan.paymentRoute && plan.paymentRoute !== 'none' && (
                  <button
                    type="button"
                    className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
                    disabled={openingPayment}
                    onClick={() => openPayment({
                      action: plan.paymentAction === 'pay' ? 'pay' : 'setup',
                      route: plan.paymentRoute === 'portal' ? 'portal' : 'checkout',
                      collectedTodayCents: plan.collectedTodayCents ?? 0,
                    })}
                  >
                    {openingPayment ? 'Opening payment...' : (plan.paymentButtonLabel || 'Add Payment Method')}
                  </button>
                )}
                {plan.access.recovery.includes('manage_billing') && (plan.paymentRoute === 'portal' || plan.paymentSecondary?.route === 'portal') && (
                  <button
                    type="button"
                    className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
                    disabled={openingPayment}
                    onClick={() => openPayment({
                      action: 'manage',
                      route: 'portal',
                      collectedTodayCents: 0,
                    })}
                  >
                    Update payment
                  </button>
                )}
                {plan.access.recovery.includes('review_tools') && (
                  <button type="button" className={cancelButtonClass} onClick={() => router.push('/dashboard/my-tools')}>
                    Review tools
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {plan.notice && (
          <section className={noticeClass}>
            <h2 className="font-semibold">{plan.notice.title}</h2>
            <p className="mt-1">{plan.notice.body}</p>
            {!preview && (
              <button type="button" className={`mt-2 ${textButtonClass}`} onClick={() => router.push('/dashboard/notices')}>
                View notices
              </button>
            )}
          </section>
        )}

        {formMessage && (
          <div className={messageClass(formMessage.tone)}>
            {formMessage.title}{formMessage.detail ? ` ${formMessage.detail}` : ''}
          </div>
        )}

        <div className={tableCardClass}>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className={theadClass}>
                <tr>
                  <th className={`${thLeftClass} w-1/3`}>Billing Item</th>
                  <th className={`${thMidClass} w-1/3`}><span className="sr-only">Details</span></th>
                  <th className={`${thRightClass} w-1/3`}>Cost</th>
                </tr>
              </thead>
              <tbody className={tbodyDivideClass}>
                {statement.map((row) => {
                  const indented = row.kind === 'tool' || row.kind === 'storage' || row.kind === 'adjustment';
                  const rowClass = row.kind === 'total'
                    ? totalRowClass
                    : row.kind === 'subtotal'
                      ? subtotalRowClass
                      : rowHoverClass;
                  const labelClass = row.kind === 'subtotal' || row.kind === 'total'
                    ? (isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50')
                    : row.kind === 'section'
                      ? (isLight ? 'text-sm font-semibold text-slate-900' : 'text-sm font-semibold text-slate-100')
                      : cellNameClass;
                  const moneyClass = row.kind === 'adjustment'
                    ? discountClass
                    : row.kind === 'subtotal'
                      ? (isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50')
                      : row.kind === 'total'
                        ? (isLight ? 'text-lg font-semibold text-emerald-800' : 'text-lg font-semibold text-emerald-300')
                        : amountClass;
                  return (
                    <tr key={row.id} className={rowClass}>
                      <td className={`py-3 pr-6 ${indented ? 'py-3 pl-12' : 'px-6'}`}>
                        <span className={labelClass}>{row.label}</span>
                        {row.note && <div className={`mt-1 text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{row.note}</div>}
                      </td>
                      <td className={`px-6 py-3 text-center ${cellMutedClass}`}>
                        {row.detail}
                        {row.benefitId && (
                          <button type="button" className={`${row.detail ? 'ml-3' : ''} ${textButtonClass}`} onClick={() => openBenefit(row.benefitId)}>Details</button>
                        )}
                      </td>
                      <td className={`px-6 py-3 text-right align-middle whitespace-nowrap ${moneyClass}`}>{row.amount}</td>
                    </tr>
                  );
                })}
                {statement.length === 0 && (
                  <tr>
                    <td className={`px-6 py-8 ${cellMutedClass}`} colSpan={3}>No billing items yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {plan.billingCycle && (
          <div className={`mt-4 grid gap-3 sm:grid-cols-3 ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
            <p>
              <span className={isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400'}>Amount due now</span>
              <br />
              <span className="text-base font-semibold">{plan.billingCycle.amountDueNow ?? plan.billingCycle.estimatedNextBill}</span>
            </p>
            {plan.billingCycle.scheduledChargeDate && plan.billingCycle.scheduledChargeAmount && (
              <p>
                <span className={isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400'}>Trial-end charge</span>
                <br />
                <span className="text-base font-semibold">{plan.billingCycle.scheduledChargeAmount} on {plan.billingCycle.scheduledChargeDate}</span>
              </p>
            )}
            <p>
              <span className={isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400'}>{plan.cancellation?.accessEndsLabel ? 'Access ends' : 'Monthly renewal'}</span>
              <br />
              <span className="text-base font-semibold">
                {plan.cancellation?.accessEndsLabel
                  ?? `${plan.billingCycle.renewalAmount ?? plan.billingCycle.estimatedNextBill} on ${plan.billingCycle.renewalDate ?? plan.billingCycle.nextBillingDate}`}
              </span>
            </p>
          </div>
        )}

        {loadError && (
          <div className={`mt-4 ${messageClass('error')}`}>
            <p>{loadError}</p>
            <button type="button" className={`mt-3 ${primaryButtonClass}`} onClick={() => { setLoadError(null); load(); }}>Try again</button>
          </div>
        )}
        {plan.cancellation?.message && (
          <p className={`mt-4 ${noticeClass}`}>{plan.cancellation.message}</p>
        )}
        <p className={`mt-4 ${pageSubtitleClass}`}>
          {plan.paymentExplanation
            ?? (plan.paymentAction === 'manage'
              ? `Payment method: ${plan.paymentMethod}. Subscription status: ${plan.subscriptionStatus || 'active'}.`
              : plan.paymentAction === 'setup'
                ? 'Set up payment when you are ready.'
                : (statement.find((row) => row.kind === 'total')?.amount ?? '$0/month') === '$0/month'
                  ? 'No payment method needed on your current plan.'
                  : 'Payment setup will be required once this account is billed.')}
          {!plan.billingCycle && plan.upcoming ? ` Upcoming ${plan.upcoming.amount} on ${formatDisplayDate(plan.upcoming.at)}.` : ''}
        </p>
        {checkoutNote && (
          <p className={`mt-3 ${checkoutNote.tone === 'ok' ? messageClass('ok') : noticeClass}`}>{checkoutNote.text}</p>
        )}
        {paymentMessage && (
          <p className={`mt-3 ${paymentMessage.tone === 'error' ? messageClass('error') : noticeClass}`}>{paymentMessage.text}</p>
        )}
        {!preview && plan.paymentButtonLabel && plan.paymentRoute && plan.paymentRoute !== 'none' && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
              disabled={openingPayment}
              onClick={() => openPayment({
                action: plan.paymentAction === 'pay' || plan.paymentAction === 'manage' ? plan.paymentAction : 'setup',
                route: plan.paymentRoute === 'portal' ? 'portal' : 'checkout',
                collectedTodayCents: plan.collectedTodayCents ?? 0,
              })}
            >
              {openingPayment ? 'Opening payment...' : plan.paymentButtonLabel}
            </button>
            {plan.paymentSecondary && (
              <button
                type="button"
                className={`${cancelButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
                disabled={openingPayment}
                onClick={() => openPayment(plan.paymentSecondary!)}
              >
                {openingPayment ? 'Opening payment...' : plan.paymentSecondary.buttonLabel}
              </button>
            )}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className={modalCardClass} role="dialog" aria-modal="true" aria-labelledby="plan-benefit-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="plan-benefit-title" className={modalTitleClass}>{selected.name}</h2>
            <p className={`mt-2 ${modalBodyClass}`}>{selected.description}</p>
            <p className={`mt-2 ${modalBodyClass}`}>{customerTiming(selected, asOf)}</p>
            <p className={`mt-2 ${pageSubtitleClass}`}>{CUSTOMER_SOURCE_LABELS[selected.source]}</p>
            <button type="button" className={`mt-4 ${cancelButtonClass}`} onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </Shell>
  );
}
