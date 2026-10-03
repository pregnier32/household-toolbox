'use client';

import { useMemo, useState } from 'react';
import { formatDisplayDate } from '@/lib/format-display-date';
import {
  attributionOptions,
  benefitLabel,
  DISCOUNT_TYPE_OPTIONS,
  discountTypeLabel,
  DISPLAY_STATUS_LABELS,
  durationPhrase,
  getDisplayStatus,
  redemptionLimitLabel,
  summarizeDiscountCodes,
  type DiscountCode,
  type DiscountType,
  type DisplayDiscountStatus,
} from '@/lib/discount-codes';
import { statusBadgeClass, type DiscountAdminStyles } from './styles';

type SortKey = 'code' | 'name' | 'benefit' | 'duration' | 'start' | 'end' | 'redemptions' | 'limit' | 'status';
type StatusFilter = 'all' | DisplayDiscountStatus;

type DiscountCodeListProps = {
  codes: DiscountCode[];
  styles: DiscountAdminStyles;
  isLight: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onReset?: () => void;
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'expired', label: 'Expired' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

function durationSortValue(code: DiscountCode): number {
  if (code.durationUnit === 'lifetime') return Number.POSITIVE_INFINITY;
  if (code.durationUnit === 'days') return code.durationAmount;
  if (code.durationUnit === 'months') return code.durationAmount * 30;
  return code.durationAmount * 365;
}

function limitSortValue(code: DiscountCode): number {
  if (code.maxRedemptionsMode === 'unlimited' || code.maxRedemptions == null) return Number.POSITIVE_INFINITY;
  return code.maxRedemptions;
}

function compareCodes(left: DiscountCode, right: DiscountCode, key: SortKey): number {
  switch (key) {
    case 'code':
      return left.publicCode.localeCompare(right.publicCode);
    case 'name':
      return left.internalName.localeCompare(right.internalName);
    case 'benefit':
      return benefitLabel(left).localeCompare(benefitLabel(right));
    case 'duration':
      return durationSortValue(left) - durationSortValue(right);
    case 'start':
      return (left.redeemStartDate || '').localeCompare(right.redeemStartDate || '');
    case 'end':
      return (left.redeemEndDate || '9999-99-99').localeCompare(right.redeemEndDate || '9999-99-99');
    case 'redemptions':
      return left.redemptionCount - right.redemptionCount;
    case 'limit':
      return limitSortValue(left) - limitSortValue(right);
    case 'status':
      return getDisplayStatus(left).localeCompare(getDisplayStatus(right));
    default:
      return 0;
  }
}

export function DiscountCodeList({
  codes,
  styles,
  isLight,
  onCreate,
  onOpen,
  onReset,
}: DiscountCodeListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | DiscountType>('all');
  const [attribution, setAttribution] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const summary = useMemo(() => summarizeDiscountCodes(codes), [codes]);
  const partners = useMemo(() => attributionOptions(codes), [codes]);

  const visibleCodes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = codes.filter((code) => {
      const display = getDisplayStatus(code);
      if (statusFilter !== 'all' && display !== statusFilter) return false;
      if (typeFilter !== 'all' && code.discountType !== typeFilter) return false;
      if (attribution !== 'all' && code.partnerName.trim() !== attribution && code.campaignName.trim() !== attribution) return false;
      if (!query) return true;
      const haystack = [
        code.publicCode,
        code.internalName,
        code.customerDescription,
        code.partnerName,
        code.campaignName,
        benefitLabel(code),
        discountTypeLabel(code.discountType),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
    if (!sortKey) return filtered;
    const sorted = [...filtered].sort((left, right) => compareCodes(left, right, sortKey));
    return sortDirection === 'asc' ? sorted : sorted.reverse();
  }, [attribution, codes, search, sortDirection, sortKey, statusFilter, typeFilter]);

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
      return;
    }
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  const summaryCards: { label: string; value: string; filter: StatusFilter | null }[] = [
    { label: 'Active Codes', value: String(summary.active), filter: 'active' },
    { label: 'Scheduled Codes', value: String(summary.scheduled), filter: 'scheduled' },
    { label: 'Expired Codes', value: String(summary.expired), filter: 'expired' },
    { label: 'Total Redemptions', value: summary.redemptions.toLocaleString('en-US'), filter: null },
  ];

  const columns: { key: SortKey; label: string }[] = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Promotion Name' },
    { key: 'benefit', label: 'Benefit' },
    { key: 'duration', label: 'Duration' },
    { key: 'start', label: 'Start Date' },
    { key: 'end', label: 'End Date' },
    { key: 'redemptions', label: 'Redemptions' },
    { key: 'limit', label: 'Redemption Limit' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={styles.title}>Discount Codes</h1>
          <p className={styles.subtitle}>
            Create and review promotional codes and account benefits. Changes are saved for every account.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {onReset && (
            <button type="button" className={styles.textButton} onClick={onReset}>
              Restore sample codes
            </button>
          )}
          <button type="button" className={styles.primaryButton} onClick={onCreate}>
            Create Discount Code
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const selected = card.filter != null && statusFilter === card.filter;
          if (card.filter == null) {
            return (
              <div key={card.label} className={styles.card}>
                <p className={styles.muted}>{card.label}</p>
                <p className={`mt-2 text-2xl font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>{card.value}</p>
              </div>
            );
          }
          const filter = card.filter;
          return (
            <button
              key={card.label}
              type="button"
              aria-pressed={selected}
              onClick={() => setStatusFilter(selected ? 'all' : filter)}
              className={selected ? styles.cardButtonSelected : styles.cardButton}
            >
              <p className={styles.muted}>{card.label}</p>
              <p className={`mt-2 text-2xl font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>{card.value}</p>
            </button>
          );
        })}
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code, name, partner, or campaign"
            className={styles.searchInput}
            aria-label="Search discount codes"
          />
          <svg className={`pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select className={styles.input} value={statusFilter} aria-label="Filter by status" onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select className={styles.input} value={typeFilter} aria-label="Filter by discount type" onChange={(event) => setTypeFilter(event.target.value as 'all' | DiscountType)}>
          <option value="all">All discount types</option>
          {DISCOUNT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.title}</option>
          ))}
        </select>
        <select className={styles.input} value={attribution} aria-label="Filter by partner or campaign" onChange={(event) => setAttribution(event.target.value)}>
          <option value="all">All partners and campaigns</option>
          {partners.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      <div className={styles.tableWrap}>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full">
            <thead className={styles.tableHead}>
              <tr>
                {columns.map((column) => {
                  const active = sortKey === column.key;
                  const arrow = active ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';
                  return (
                    <th key={column.key} className={styles.tableHeadCell} aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className="uppercase tracking-wider" onClick={() => toggleSort(column.key)}>
                        {column.label}{arrow}
                      </button>
                    </th>
                  );
                })}
                <th className={`${styles.tableHeadCell} text-right`}>
                  <span className="sr-only">View</span>
                </th>
              </tr>
            </thead>
            <tbody className={styles.tableBody}>
              {visibleCodes.length === 0 ? (
                <tr>
                  <td colSpan={10} className={`px-4 py-8 text-center ${styles.muted}`}>
                    No discount codes match these filters.
                  </td>
                </tr>
              ) : visibleCodes.map((code) => {
                const display = getDisplayStatus(code);
                return (
                  <tr key={code.id} className={styles.row}>
                    <td className="px-4 py-3">
                      <button type="button" className={styles.codeLink} onClick={() => onOpen(code.id)}>
                        {code.publicCode}
                      </button>
                    </td>
                    <td className={`px-4 py-3 ${styles.primaryText}`}>{code.internalName}</td>
                    <td className={`px-4 py-3 ${styles.bodyText}`}>
                      <div>{benefitLabel(code)}</div>
                      <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>{discountTypeLabel(code.discountType)}</div>
                    </td>
                    <td className={`px-4 py-3 ${styles.bodyText}`}>{durationPhrase(code.durationUnit, code.durationAmount)}</td>
                    <td className={`px-4 py-3 ${styles.muted}`}>{code.redeemStartDate ? formatDisplayDate(code.redeemStartDate) : '—'}</td>
                    <td className={`px-4 py-3 ${styles.muted}`}>{code.redeemEndDate ? formatDisplayDate(code.redeemEndDate) : '—'}</td>
                    <td className={`px-4 py-3 ${styles.bodyText}`}>{code.redemptionCount.toLocaleString('en-US')}</td>
                    <td className={`px-4 py-3 ${styles.muted}`}>{redemptionLimitLabel(code)}</td>
                    <td className="px-4 py-3">
                      <span className={statusBadgeClass(display, isLight)}>{DISPLAY_STATUS_LABELS[display]}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className={`inline-flex rounded p-1 transition-colors ${isLight ? 'text-blue-700 hover:text-blue-800' : 'text-blue-400 hover:text-blue-300'}`}
                        title={`View ${code.publicCode}`}
                        aria-label={`View ${code.publicCode}`}
                        onClick={() => onOpen(code.id)}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
