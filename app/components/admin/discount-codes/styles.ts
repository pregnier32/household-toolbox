export function discountAdminStyles(isLight: boolean) {
  return {
    headerBar: isLight
      ? 'border-b-2 border-slate-400 bg-slate-900/50'
      : 'border-b border-slate-800 bg-slate-900/50',
    headerButton: isLight
      ? 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900'
      : 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100',
    backLink: isLight
      ? 'mb-4 flex items-center gap-2 text-sm text-slate-700 transition-colors hover:text-slate-900'
      : 'mb-4 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-300',
    title: isLight ? 'text-2xl font-semibold text-slate-900' : 'text-2xl font-semibold text-slate-50',
    subtitle: isLight ? 'mt-1 text-sm text-slate-600' : 'mt-1 text-sm text-slate-400',
    card: isLight
      ? 'rounded-lg border border-slate-200 bg-white p-5 shadow-sm'
      : 'rounded-lg border border-slate-800 bg-slate-900/70 p-5',
    cardButton: isLight
      ? 'rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-emerald-500/50'
      : 'rounded-lg border border-slate-800 bg-slate-900/70 p-5 text-left transition-colors hover:border-emerald-500/50',
    cardButtonSelected: isLight
      ? 'rounded-lg border border-emerald-600 bg-emerald-50 p-5 text-left shadow-sm'
      : 'rounded-lg border border-emerald-500/60 bg-emerald-500/10 p-5 text-left',
    label: isLight ? 'mb-1 block text-sm font-medium text-slate-700' : 'mb-1 block text-sm font-medium text-slate-300',
    hint: isLight ? 'mt-1 text-xs text-slate-500' : 'mt-1 text-xs text-slate-400',
    input: isLight
      ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
      : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50',
    searchInput: isLight
      ? 'w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
      : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50',
    error: isLight
      ? 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
      : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300',
    success: isLight
      ? 'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900'
      : 'rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300',
    note: isLight
      ? 'rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600'
      : 'rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-400',
    tableWrap: isLight
      ? 'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm'
      : 'overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70',
    tableHead: isLight ? 'bg-slate-100' : 'bg-slate-800/50',
    tableHeadCell: isLight
      ? 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600'
      : 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300',
    tableBody: isLight ? 'divide-y divide-slate-200' : 'divide-y divide-slate-800',
    row: isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/30',
    primaryText: isLight ? 'text-sm font-medium text-slate-900' : 'text-sm font-medium text-slate-100',
    bodyText: isLight ? 'text-sm text-slate-700' : 'text-sm text-slate-300',
    muted: isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400',
    sectionTitle: isLight ? 'text-base font-semibold text-slate-900' : 'text-base font-semibold text-slate-50',
    choice: isLight
      ? 'rounded-lg border border-slate-300 bg-white p-3 text-left transition-colors hover:border-slate-400'
      : 'rounded-lg border border-slate-700 bg-slate-900/40 p-3 text-left transition-colors hover:border-slate-500',
    choiceSelected: isLight
      ? 'rounded-lg border border-emerald-600 bg-emerald-50 p-3 text-left'
      : 'rounded-lg border border-emerald-500 bg-emerald-500/10 p-3 text-left',
    primaryButton: 'rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60',
    secondaryButton: isLight
      ? 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100'
      : 'rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800',
    textButton: isLight ? 'text-sm font-medium text-slate-600 hover:text-slate-900' : 'text-sm font-medium text-slate-400 hover:text-slate-200',
    action: isLight ? 'text-xs font-medium text-emerald-700 hover:text-emerald-800' : 'text-xs font-medium text-emerald-400 hover:text-emerald-300',
    actionMuted: isLight ? 'text-xs font-medium text-slate-600 hover:text-slate-900' : 'text-xs font-medium text-slate-400 hover:text-slate-200',
    codeLink: isLight ? 'font-mono text-sm font-semibold tracking-wide text-emerald-700 hover:text-emerald-800' : 'font-mono text-sm font-semibold tracking-wide text-emerald-400 hover:text-emerald-300',
    modal: isLight
      ? 'w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl'
      : 'w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-6',
    modalTitle: isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50',
    chip: isLight
      ? 'inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs text-slate-700'
      : 'inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200',
    jump: isLight
      ? 'rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100'
      : 'rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800',
    preview: isLight
      ? 'rounded-lg border border-emerald-600/40 bg-emerald-50 p-5'
      : 'rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-5',
  };
}

export function statusBadgeClass(status: string, isLight: boolean): string {
  const base = 'inline-flex rounded-full px-2 py-0.5 text-xs font-medium';
  if (status === 'active') {
    return `${base} ${isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/20 text-emerald-300'}`;
  }
  if (status === 'scheduled') {
    return `${base} ${isLight ? 'bg-sky-100 text-sky-800' : 'bg-sky-500/20 text-sky-300'}`;
  }
  if (status === 'expired' || status === 'inactive') {
    return `${base} ${isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-700 text-slate-300'}`;
  }
  if (status === 'archived') {
    return `${base} ${isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-400'}`;
  }
  return `${base} ${isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-500/20 text-amber-300'}`;
}

export type DiscountAdminStyles = ReturnType<typeof discountAdminStyles>;
