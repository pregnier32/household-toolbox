import type { ReactNode } from 'react';

type StatusPageProps = {
  title: string;
  body: string;
  children?: ReactNode;
};

export const statusPrimaryClass = 'rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950';
export const statusSecondaryClass = 'rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200';

export function StatusPage({ title, body, children }: StatusPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-semibold text-emerald-400">Household Toolbox</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-50">{title}</h1>
        <p className="mt-3 text-sm text-slate-300">{body}</p>
        {children ? <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div> : null}
      </div>
    </main>
  );
}
