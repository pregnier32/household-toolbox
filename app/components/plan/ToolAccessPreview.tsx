'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SideLogo } from '@/app/components/SideLogo';
import { UserMenu } from '@/app/components/UserMenu';
import { useTheme } from '@/app/components/AppThemeProvider';
import { completeSignOut } from '@/lib/client-sign-out';
import {
  ACCESS_SCENARIOS,
  ADD_TOOL_EXAMPLES,
  STATE_GUIDE,
  toolAccessNote,
  toolBadge,
  type MockAccessTool,
  type ToolAccessState,
} from '@/lib/tool-access-preview';

function badgeClass(state: ToolAccessState, isLight: boolean): string {
  const base = 'inline-flex rounded-full px-2 py-0.5 text-xs font-medium';
  if (state === 'trial') return `${base} ${isLight ? 'bg-sky-100 text-sky-900' : 'bg-sky-500/20 text-sky-200'}`;
  if (state === 'payment_required') return `${base} ${isLight ? 'bg-amber-100 text-amber-950' : 'bg-amber-500/20 text-amber-100'}`;
  if (state === 'locked') return `${base} ${isLight ? 'bg-rose-100 text-rose-900' : 'bg-rose-500/20 text-rose-200'}`;
  if (state === 'paid') return `${base} ${isLight ? 'bg-slate-200 text-slate-800' : 'bg-slate-700 text-slate-200'}`;
  return `${base} ${isLight ? 'bg-emerald-100 text-emerald-900' : 'bg-emerald-500/20 text-emerald-300'}`;
}

export function ToolAccessPreview({ userName }: { userName: string }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const [scenarioId, setScenarioId] = useState(ACCESS_SCENARIOS[0].id);
  const [removeOpen, setRemoveOpen] = useState(false);
  const scenario = ACCESS_SCENARIOS.find((item) => item.id === scenarioId) ?? ACCESS_SCENARIOS[0];
  const locked = scenario.tools.filter((tool) => tool.state === 'locked' || tool.state === 'payment_required');

  const headerChromeButtonClass = isLight
    ? 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900'
    : 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100';
  const headerBarClass = isLight ? 'border-b-2 border-slate-400 bg-slate-900/50' : 'border-b border-slate-800 bg-slate-900/50';
  const cardClass = isLight ? 'rounded-lg border border-slate-200 bg-white p-5 shadow-sm' : 'rounded-lg border border-slate-800 bg-slate-900/70 p-5';
  const headingClass = isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50';
  const mutedClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400';
  const bodyClass = isLight ? 'text-sm text-slate-700' : 'text-sm text-slate-300';
  const titleClass = isLight ? 'text-2xl font-semibold text-slate-900' : 'text-2xl font-semibold text-slate-50';
  const chipClass = isLight
    ? 'rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100'
    : 'rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800';
  const chipOnClass = isLight ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-emerald-500 bg-emerald-500/10 text-emerald-200';
  const secondaryButtonClass = isLight
    ? 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100'
    : 'rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800';
  const disabledButtonClass = `${secondaryButtonClass} cursor-not-allowed opacity-60`;
  const noteClass = isLight
    ? 'rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600'
    : 'rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-400';
  const warningClass = isLight
    ? 'rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950'
    : 'rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100';

  useEffect(() => {
    if (!removeOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRemoveOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [removeOpen]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
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

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <button type="button" onClick={() => router.push('/dashboard/plan')} className={`mb-4 ${mutedClass} underline-offset-2 hover:underline`}>
          Back to Plan & Billing
        </button>
        <h1 className={titleClass}>Preview — tools, trials, and payment</h1>
        <p className={`mt-1 ${mutedClass}`}>
          Preview and test only. These examples are not your live tools, and this page does not change access or billing.
        </p>

        <section className="mt-6">
          <h2 className={headingClass}>How a tool can look</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {STATE_GUIDE.map((tool) => (
              <li key={tool.id} className={badgeClass(tool.state, isLight)} title={toolAccessNote(tool)}>
                {toolBadge(tool)}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Sample situations">
          {ACCESS_SCENARIOS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === scenario.id}
              className={`${chipClass} ${item.id === scenario.id ? chipOnClass : ''}`}
              onClick={() => setScenarioId(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className={`mt-4 ${bodyClass}`}>{scenario.summary}</p>

        {scenario.noticeTitle && (
          <div className={`mt-4 ${scenario.paymentAsked ? warningClass : noteClass}`}>
            <p className="font-medium">{scenario.noticeTitle}</p>
            <p className="mt-1">{scenario.noticeBody}</p>
          </div>
        )}

        <section className="mt-6">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 className={headingClass}>My Tools</h2>
            <p className={mutedClass}>Example monthly cost {scenario.exampleMonthlyCost}. Not a charge.</p>
          </div>
          <ul className="space-y-3 md:hidden">
            {scenario.tools.map((tool) => (
              <li key={tool.id} className={cardClass}>
                <ToolSummary tool={tool} isLight={isLight} />
              </li>
            ))}
          </ul>
          <div className={`hidden overflow-hidden md:block ${isLight ? 'rounded-lg border border-slate-200 bg-white shadow-sm' : 'rounded-lg border border-slate-800 bg-slate-900/70'}`}>
            <table className="w-full">
              <thead className={isLight ? 'bg-slate-100' : 'bg-slate-800/50'}>
                <tr>
                  {['Tool', 'Status', 'Access'].map((heading) => (
                    <th key={heading} className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={isLight ? 'divide-y divide-slate-200' : 'divide-y divide-slate-800'}>
                {scenario.tools.map((tool) => (
                  <tr key={tool.id}>
                    <td className={`px-4 py-3 text-sm font-medium ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{tool.name}</td>
                    <td className="px-4 py-3"><span className={badgeClass(tool.state, isLight)}>{toolBadge(tool)}</span></td>
                    <td className={`px-4 py-3 text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{tool.state === 'locked' || tool.state === 'payment_required' ? 'Saved, not open in this example' : 'Full access'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {locked.length > 0 && (
          <section className={`mt-6 ${cardClass}`}>
            <h2 className={headingClass}>Trial ended</h2>
            {locked.map((tool) => (
              <div key={tool.id} className="mt-3">
                <p className={bodyClass}>Your free trial for {tool.name} has ended.</p>
                <p className={`mt-2 ${bodyClass}`}>Your first 2 tools are included at no monthly cost.</p>
                <p className={`mt-2 ${bodyClass}`}>
                  Keeping {tool.name} would make your monthly cost <span className="font-semibold">${tool.exampleMonthlyPrice}/month</span>.
                </p>
                <p className={`mt-2 ${bodyClass}`}>Your information is still saved. Add a payment method to continue using this tool.</p>
              </div>
            ))}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button type="button" className={disabledButtonClass} disabled>
                Add Payment Method & Continue
                <span className="ml-2 rounded-full bg-slate-500/20 px-2 py-0.5 text-xs">Coming later</span>
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => router.push('/dashboard/my-tools')}>
                Manage Tool
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => setRemoveOpen(true)}>
                Export or Remove
              </button>
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className={headingClass}>Before you add a tool</h2>
          <p className={`mt-1 ${mutedClass}`}>Examples only. These buttons do not add a tool or start a trial.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ADD_TOOL_EXAMPLES.map((example) => (
              <article key={example.id} className={cardClass}>
                <h3 className={`font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>{example.name}</h3>
                <p className={`mt-2 ${bodyClass}`}>{example.headline}</p>
                <p className={`mt-2 ${mutedClass}`}>{example.detail}</p>
                <button type="button" className={`mt-4 ${disabledButtonClass}`} disabled>{example.actionLabel}</button>
              </article>
            ))}
          </div>
        </section>

        <section className={`mt-8 ${noteClass}`}>
          <p className={`font-medium ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Your records stay put</p>
          <p className="mt-2">
            A trial ending, a promotion ending, or a missing payment method does not delete a tool. The only way to delete a tool’s records is Remove in My Tools, which already asks you to export a PDF and confirm twice. A tool’s one-time trial is remembered after that removal.
          </p>
        </section>
      </div>

      {removeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setRemoveOpen(false)}>
          <div
            className={isLight ? 'w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl' : 'w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl'}
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-remove-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="export-remove-title" className={headingClass}>Export or remove</h2>
            <p className={`mt-3 ${bodyClass}`}>
              Export the PDF from the tool itself before you remove it. My Tools then asks you to confirm the export, type delete, and confirm a second time. That is the only delete path. This preview does not remove anything.
            </p>
            <p className={`mt-3 ${bodyClass}`}>
              If you add the tool again later, the 7-day trial is not offered a second time.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className={secondaryButtonClass} onClick={() => setRemoveOpen(false)} autoFocus>Close</button>
              <button type="button" className={secondaryButtonClass} onClick={() => router.push('/dashboard/my-tools')}>Open My Tools</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ToolSummary({ tool, isLight }: { tool: MockAccessTool; isLight: boolean }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className={`font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>{tool.name}</p>
        <span className={badgeClass(tool.state, isLight)}>{toolBadge(tool)}</span>
      </div>
      <p className={`mt-2 text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{toolAccessNote(tool)}</p>
    </>
  );
}
