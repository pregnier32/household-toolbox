'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { SideLogo } from '@/app/components/SideLogo';
import { UserMenu } from '@/app/components/UserMenu';
import { useTheme } from '@/app/components/AppThemeProvider';
import { completeSignOut } from '@/lib/client-sign-out';
import { formatDisplayDate } from '@/lib/format-display-date';
import {
  CUSTOMER_SOURCE_LABELS,
  CUSTOMER_VIEW_LABELS,
  customerBenefitTitle,
  customerBenefitView,
  customerTiming,
  isAffectingCustomerBenefit,
  isCurrentCustomerBenefit,
  type CustomerBenefitView,
  type CustomerPlanBenefit,
} from '@/lib/customer-plan-preview';

type PlanPayload = {
  accountType: 'personal' | 'business';
  freeSlots: number;
  freeSlotsUsed: number;
  freeSlotsRemaining: number;
  tools: { id: string; name: string; label: string; amount: string | null }[];
  benefits: CustomerPlanBenefit[];
  currentMonthly: string;
  upcoming: { at: string; amount: string } | null;
  storageUsed: string;
  storageAllowance: string;
  paymentMethod: string;
  paymentSetupWouldBeNeeded: boolean;
  notice: { title: string; body: string } | null;
};

const PRICE_CHANGE_REASONS = [
  'A tool’s 7-day free trial ends',
  'A promotion expires',
  'You add another paid tool',
  'You remove a tool',
  'A free-tool benefit changes',
];

function viewBadgeClass(view: CustomerBenefitView, isLight: boolean): string {
  const base = 'inline-flex rounded-full px-2 py-0.5 text-xs font-medium';
  if (view === 'expires_soon') return `${base} ${isLight ? 'bg-amber-100 text-amber-900' : 'bg-amber-500/20 text-amber-200'}`;
  if (view === 'scheduled') return `${base} ${isLight ? 'bg-sky-100 text-sky-900' : 'bg-sky-500/20 text-sky-200'}`;
  if (view === 'expired') return `${base} ${isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-700 text-slate-300'}`;
  if (view === 'removed') return `${base} ${isLight ? 'bg-rose-100 text-rose-900' : 'bg-rose-500/20 text-rose-200'}`;
  return `${base} ${isLight ? 'bg-emerald-100 text-emerald-900' : 'bg-emerald-500/20 text-emerald-300'}`;
}

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

  const cardClass = isLight ? 'rounded-lg border border-slate-200 bg-white p-5 shadow-sm' : 'rounded-lg border border-slate-800 bg-slate-900/70 p-5';
  const headingClass = isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50';
  const mutedClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400';
  const bodyClass = isLight ? 'text-sm text-slate-700' : 'text-sm text-slate-300';
  const pageTitleClass = isLight ? 'text-2xl font-semibold text-slate-900' : 'text-2xl font-semibold text-slate-50';
  const pageSubtitleClass = isLight ? 'mt-1 text-sm text-slate-600' : 'mt-1 text-sm text-slate-400';
  const secondaryButtonClass = isLight
    ? 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100'
    : 'rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800';
  const primaryButtonClass = 'rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400';
  const inputClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900'
    : 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100';
  const headerChromeButtonClass = isLight
    ? 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900'
    : 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100';

  const load = () => {
    fetch('/api/account/plan')
      .then((response) => response.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setLoadedPlan(data);
      })
      .catch(() => setLoadedPlan(null));
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

  if (!plan) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-4xl px-4 py-8 text-slate-400">Loading plan and billing...</div>
      </main>
    );
  }

  const current = plan.benefits.filter((item) => isCurrentCustomerBenefit(item, asOf));
  const affectingCount = plan.benefits.filter((item) => isAffectingCustomerBenefit(item, asOf)).length;
  const covered = plan.tools.filter((tool) => tool.label === 'Included' || tool.label === 'Free Through Promotion');

  const shellClass = preview ? '' : 'min-h-screen bg-slate-950 text-slate-100';
  const Shell = preview ? 'div' : 'main';
  return (
    <Shell className={shellClass}>
      {!preview && (
        <header className={isLight ? 'border-b-2 border-slate-400 bg-slate-900/50' : 'border-b border-slate-800 bg-slate-900/50'}>
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <SideLogo priority />
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => router.push('/dashboard')} className={headerChromeButtonClass}>
                <span>Back to Toolbox</span>
              </button>
              <UserMenu userName={userName} onSignOut={() => completeSignOut()} />
            </div>
          </div>
        </header>
      )}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {preview && (
          <p className={`mb-4 rounded-lg border px-4 py-3 text-sm font-medium ${isLight ? 'border-sky-300 bg-sky-50 text-sky-950' : 'border-sky-500/40 bg-sky-500/10 text-sky-100'}`}>
            Read-only preview. Discount codes, tool changes, and notice actions are turned off.
          </p>
        )}
        <h1 className={pageTitleClass}>Plan & Billing</h1>
        <p className={pageSubtitleClass}>Your free tools, promotions, and expected monthly cost.</p>

        {plan.notice && (
          <section className={`mt-6 ${isLight ? 'rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950' : 'rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100'}`}>
            <h2 className="font-semibold">{plan.notice.title}</h2>
            <p className="mt-1">{plan.notice.body}</p>
            {!preview && <button type="button" className={`mt-3 ${secondaryButtonClass}`} onClick={() => router.push('/dashboard/notices')}>View notices</button>}
          </section>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <section className={cardClass}><p className={mutedClass}>Account</p><p className="mt-2 text-lg font-semibold">{plan.accountType === 'business' ? 'Business' : 'Personal'}</p></section>
          <section className={cardClass}><p className={mutedClass}>Free tool slots</p><p className="mt-2 text-lg font-semibold">{plan.freeSlots}</p><p className={mutedClass}>{plan.freeSlotsUsed} in use · {plan.freeSlotsRemaining} remaining</p></section>
          <section className={cardClass}><p className={mutedClass}>Active promotions</p><p className="mt-2 text-lg font-semibold">{affectingCount}</p></section>
          <section className={cardClass}><p className={mutedClass}>Expected monthly cost</p><p className="mt-2 text-lg font-semibold">{plan.currentMonthly}</p></section>
          <section className={cardClass}><p className={mutedClass}>Upcoming expected cost</p><p className="mt-2 text-lg font-semibold">{plan.upcoming ? plan.upcoming.amount : plan.currentMonthly}</p><p className={mutedClass}>{plan.upcoming ? `On ${formatDisplayDate(plan.upcoming.at)}` : 'No scheduled change'}</p></section>
          <section className={cardClass}><p className={mutedClass}>Storage</p><p className="mt-2 text-lg font-semibold">{plan.storageUsed}</p><p className={mutedClass}>of {plan.storageAllowance}</p></section>
        </div>

        <section className={`mt-6 ${cardClass}`}>
          <h2 className={headingClass}>Your free tools</h2>
          <p className={`mt-2 ${bodyClass}`}>You have {plan.freeSlots} free tool slots. Tools on a trial or covered by a specific promotion do not use one of these slots.</p>
          <p className={`mt-2 ${mutedClass}`}>{plan.freeSlotsUsed} of {plan.freeSlots} free tool slots in use.</p>
          <ul className="mt-3 space-y-1">
            {covered.map((tool) => <li key={tool.id} className={bodyClass}>{tool.name} — {tool.label}</li>)}
            {covered.length === 0 && <li className={mutedClass}>No covered tools right now.</li>}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className={headingClass}>Active promotions</h2>
          <div className="mt-4 space-y-3">
            {current.map((item) => {
              const view = customerBenefitView(item, asOf);
              return (
                <article key={item.id} className={cardClass}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{customerBenefitTitle(item)}</h3>
                      <p className={`mt-2 ${bodyClass}`}>{item.benefit}</p>
                      <p className={`mt-1 ${bodyClass}`}>{customerTiming(item, asOf)}</p>
                      <p className={`mt-1 ${mutedClass}`}>{CUSTOMER_SOURCE_LABELS[item.source]}</p>
                    </div>
                    <span className={viewBadgeClass(view, isLight)}>{CUSTOMER_VIEW_LABELS[view]}</span>
                  </div>
                  <button type="button" className={`mt-4 ${secondaryButtonClass}`} onClick={() => setSelected(item)}>View details</button>
                </article>
              );
            })}
            {current.length === 0 && <p className={mutedClass}>No active promotions.</p>}
          </div>
        </section>

        <section className={`mt-8 ${cardClass}`}>
          <h2 className={headingClass}>Have a discount code?</h2>
          {preview ? (
            <p className={`mt-3 ${bodyClass}`}>Read-only preview. A discount code cannot be applied from this screen.</p>
          ) : (
          <>
          <form className="mt-4" onSubmit={applyCode}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="discount-code" value={codeInput} onChange={(event) => setCodeInput(event.target.value)} className={inputClass} placeholder="Enter code" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
              <button type="submit" className={primaryButtonClass}>Apply</button>
            </div>
          </form>
          {formMessage && <p className={`mt-4 text-sm ${formMessage.tone === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>{formMessage.title}{formMessage.detail ? ` ${formMessage.detail}` : ''}</p>}
          </>
          )}
        </section>

        <section className="mt-8">
          <h2 className={headingClass}>Promotion history</h2>
          <div className="mt-4 space-y-3">
            {plan.benefits.map((item) => {
              const view = customerBenefitView(item, asOf);
              return (
                <article key={item.id} className={cardClass}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className={`mt-1 font-mono text-sm ${bodyClass}`}>{item.publicCode || '—'}</p>
                      <p className={`mt-1 ${bodyClass}`}>{item.benefit}</p>
                      <p className={`mt-1 ${mutedClass}`}>{customerTiming(item, asOf)}</p>
                    </div>
                    <span className={viewBadgeClass(view, isLight)}>{CUSTOMER_VIEW_LABELS[view]}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <h2 className={headingClass}>Tools</h2>
          <ul className="mt-4 space-y-3">
            {plan.tools.map((tool) => (
              <li key={tool.id} className={cardClass}>
                <p className="font-semibold">{tool.name}</p>
                <p className={`mt-1 ${bodyClass}`}>{tool.label}{tool.amount ? ` · ${tool.amount}/month expected` : ''}</p>
              </li>
            ))}
            {plan.tools.length === 0 && <li className={mutedClass}>No active tools.</li>}
          </ul>
          {!preview && (
            <button type="button" className={`mt-4 ${secondaryButtonClass}`} onClick={() => router.push('/dashboard/plan/access')}>
              Open the labeled preview examples
            </button>
          )}
        </section>

        <section className={`mt-8 ${cardClass}`}>
          <h2 className={headingClass}>Why could my expected cost change?</h2>
          <ul className={`mt-3 list-disc space-y-1 pl-5 ${bodyClass}`}>
            {PRICE_CHANGE_REASONS.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </section>

        <section className={`mt-6 ${cardClass}`}>
          <p className="font-medium">Payment method: {plan.paymentMethod}</p>
          <p className={`mt-2 ${bodyClass}`}>
            {plan.paymentSetupWouldBeNeeded
              ? 'This account has an expected monthly cost. Payment setup will be required once billing is available. No card is collected now.'
              : 'No payment information is required while the expected monthly cost is $0.00.'}
          </p>
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setSelected(null)}>
          <div className={cardClass} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2 className={headingClass}>{selected.name}</h2>
            <p className={`mt-2 ${bodyClass}`}>{selected.description}</p>
            <p className={`mt-2 ${bodyClass}`}>{selected.benefit}</p>
            <p className={`mt-2 ${mutedClass}`}>{customerTiming(selected, asOf)}</p>
            <button type="button" className={`mt-4 ${secondaryButtonClass}`} onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </Shell>
  );
}
