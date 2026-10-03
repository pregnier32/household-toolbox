'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SideLogo } from '@/app/components/SideLogo';
import { AdminMenu } from '@/app/components/AdminMenu';
import { UserMenu } from '@/app/components/UserMenu';
import { useTheme } from '@/app/components/AppThemeProvider';
import { completeSignOut } from '@/lib/client-sign-out';
import { formatMoney } from '@/lib/discount-codes';
import { discountAdminStyles, type DiscountAdminStyles } from '@/app/components/admin/discount-codes/styles';
import {
  METRIC_HELP,
  REPORT_RANGES,
  overviewFigures,
  type AttributedCustomer,
  type CampaignReport,
  type PartnerReport,
  type PromotionReportRow,
  type ReportRangeId,
} from '@/lib/promotion-reporting';

type ReportFigures = ReturnType<typeof overviewFigures>;

type Screen =
  | { type: 'overview' }
  | { type: 'promotions' }
  | { type: 'promotion'; id: string }
  | { type: 'campaigns' }
  | { type: 'campaign'; id: string }
  | { type: 'partners' }
  | { type: 'partner'; id: string }
  | { type: 'customers' }
  | { type: 'customer'; id: string };

type SortKey = 'name' | 'redemptions' | 'activeUsers' | 'payingUsers' | 'discountValue' | 'mrr' | 'lifetimeRevenue';

const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'partners', label: 'Partners' },
  { id: 'customers', label: 'Customers' },
] as const;

export function PromotionReportingAdmin() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const styles = discountAdminStyles(isLight);
  const [user, setUser] = useState<{ firstName?: string; lastName?: string; userStatus?: string } | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [screen, setScreen] = useState<Screen>({ type: 'overview' });
  const [rangeId, setRangeId] = useState<ReportRangeId>('30');
  const [customStart, setCustomStart] = useState('2026-09-01');
  const [customEnd, setCustomEnd] = useState('2026-09-30');
  const [statusFilter, setStatusFilter] = useState('All');
  const [benefitFilter, setBenefitFilter] = useState('All');
  const [campaignFilter, setCampaignFilter] = useState('All');
  const [partnerFilter, setPartnerFilter] = useState('All');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [customerStatus, setCustomerStatus] = useState('All');
  const [promoStatus, setPromoStatus] = useState('All');
  const [customerPartner, setCustomerPartner] = useState('All');
  const [customerCampaign, setCustomerCampaign] = useState('All');
  const [customerCode, setCustomerCode] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>('redemptions');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [figures, setFigures] = useState<ReportFigures | null>(null);
  const [promotions, setPromotions] = useState<PromotionReportRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignReport[]>([]);
  const [partners, setPartners] = useState<PartnerReport[]>([]);
  const [customers, setCustomers] = useState<AttributedCustomer[]>([]);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((response) => response.json())
      .then((data) => {
        if (!data.user) {
          router.push('/');
          return;
        }
        setUser(data.user);
        if (data.user.userStatus !== 'superadmin') {
          router.push('/dashboard');
          return;
        }
        setIsAuthorized(true);
      })
      .catch(() => router.push('/'));
  }, [router]);

  useEffect(() => {
    if (!isAuthorized) return;
    const params = new URLSearchParams({ range: rangeId, start: customStart, end: customEnd });
    fetch(`/api/admin/promotion-reporting?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        setFigures(data.figures);
        setPromotions(data.promotions || []);
        setCampaigns(data.campaigns || []);
        setPartners(data.partners || []);
        setCustomers(data.customers || []);
      })
      .catch(() => {
        setFigures(null);
      });
  }, [isAuthorized, rangeId, customStart, customEnd]);

  const empty = promotions.length === 0 && customers.length === 0;

  const filteredPromotions = useMemo(() => {
    const rows = promotions.filter((row) =>
      (statusFilter === 'All' || row.status === statusFilter)
      && (benefitFilter === 'All' || row.benefitType === benefitFilter)
      && (campaignFilter === 'All' || row.campaign === campaignFilter)
      && (partnerFilter === 'All' || row.partner === partnerFilter)
      && (platformFilter === 'All' || row.platform === platformFilter),
    );
    return [...rows].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      const result = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
      return sortDir === 'asc' ? result : -result;
    });
  }, [promotions, statusFilter, benefitFilter, campaignFilter, partnerFilter, platformFilter, sortKey, sortDir]);

  const filteredCustomers = useMemo(() => customers.filter((row) =>
    (customerStatus === 'All' || row.accountStatus === customerStatus)
    && (promoStatus === 'All' || row.currentPromotionStatus === promoStatus)
    && (customerPartner === 'All' || row.partner === customerPartner)
    && (customerCampaign === 'All' || row.campaign === customerCampaign)
    && (customerCode === 'All' || row.originalCode === customerCode),
  ), [customers, customerStatus, promoStatus, customerPartner, customerCampaign, customerCode]);

  const handleSignOut = async () => {
    await completeSignOut();
  };

  const sortBy = (key: SortKey) => {
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const exportPromotions = () => {
    const header = ['Promotion', 'Code', 'Benefit Type', 'Status', 'Campaign', 'Partner', 'Redemptions', 'Active Users', 'Paying Users', 'Conversion Rate', 'Discount Value', 'Expected MRR', 'Collected revenue', 'Revenue Share %'];
    const lines = filteredPromotions.map((row) => [row.name, row.code, row.benefitType, row.status, row.campaign, row.partner, row.redemptions, row.activeUsers, row.payingUsers, row.conversionRate, row.discountValue, row.mrr, row.lifetimeRevenue, row.revenueSharePercent]);
    const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'promotion-reporting.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isAuthorized || !user || !figures) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  const openPromotion = (id: string) => setScreen({ type: 'promotion', id });
  const openCampaign = (id: string) => setScreen({ type: 'campaign', id });
  const openPartner = (id: string) => setScreen({ type: 'partner', id });
  const openCustomer = (id: string) => setScreen({ type: 'customer', id });

  return (
    <div className="min-h-screen bg-slate-950">
      <header className={styles.headerBar}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <SideLogo priority />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push('/dashboard')} className={styles.headerButton}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Toolbox</span>
            </button>
            <AdminMenu />
            <UserMenu
              userName={`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Account'}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <button type="button" onClick={() => router.push('/dashboard/admin/site-maintenance')} className={styles.backLink}>
          <span aria-hidden="true">←</span> Site Maintenance
        </button>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className={styles.title}>Promotion Reporting</h1>
            <p className={styles.subtitle}>How promotions, campaigns, and partners are performing. These figures are samples for review.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[12rem]">
              <span className={styles.label}>Reporting period</span>
              <select className={styles.input} value={rangeId} onChange={(event) => setRangeId(event.target.value as ReportRangeId)}>
                {REPORT_RANGES.map((range) => <option key={range.id} value={range.id}>{range.label}</option>)}
              </select>
            </label>
            {rangeId === 'custom' && (
              <>
                <label>
                  <span className={styles.label}>Start</span>
                  <input type="date" className={styles.input} value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
                </label>
                <label>
                  <span className={styles.label}>End</span>
                  <input type="date" className={styles.input} value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
                </label>
              </>
            )}
            <button type="button" className={styles.secondaryButton} onClick={exportPromotions} disabled={filteredPromotions.length === 0}>
              Export CSV
            </button>
          </div>
        </div>
        <p className={`${styles.note} mb-4`}>
          Counts, assignment sources, and Expected MRR come from saved promotions and the pricing engine. Collected revenue and lifetime collected revenue are not available until billing exists. Per-code discount dollars are not split.
        </p>
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Reporting sections">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={screen.type === item.id || (item.id === 'promotions' && screen.type === 'promotion') || (item.id === 'campaigns' && screen.type === 'campaign') || (item.id === 'partners' && screen.type === 'partner') || (item.id === 'customers' && screen.type === 'customer') ? styles.choiceSelected : styles.jump}
              onClick={() => setScreen({ type: item.id })}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {screen.type === 'overview' && (
          <Overview
            styles={styles}
            figures={figures}
            empty={empty}
            customers={customers}
            onCustomers={() => setScreen({ type: 'customers' })}
            onCustomer={openCustomer}
          />
        )}
        {screen.type === 'promotions' && (
          <PromotionTable
            styles={styles}
            rows={filteredPromotions}
            empty={empty}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={sortBy}
            onOpen={openPromotion}
            statusFilter={statusFilter}
            benefitFilter={benefitFilter}
            campaignFilter={campaignFilter}
            partnerFilter={partnerFilter}
            platformFilter={platformFilter}
            options={promotions}
            onStatus={setStatusFilter}
            onBenefit={setBenefitFilter}
            onCampaign={setCampaignFilter}
            onPartner={setPartnerFilter}
            onPlatform={setPlatformFilter}
          />
        )}
        {screen.type === 'promotion' && (
          <PromotionDetail
            styles={styles}
            row={promotions.find((row) => row.id === screen.id)}
            campaigns={campaigns}
            partners={partners}
            onBack={() => setScreen({ type: 'promotions' })}
            onCampaign={openCampaign}
            onPartner={openPartner}
          />
        )}
        {screen.type === 'campaigns' && (
          <CampaignTable styles={styles} rows={campaigns} empty={empty} onOpen={openCampaign} onPartner={openPartner} />
        )}
        {screen.type === 'campaign' && (
          <CampaignDetail
            styles={styles}
            isLight={isLight}
            row={campaigns.find((row) => row.id === screen.id)}
            promotions={promotions}
            onBack={() => setScreen({ type: 'campaigns' })}
            onPromotion={openPromotion}
            onPartner={openPartner}
          />
        )}
        {screen.type === 'partners' && (
          <PartnerTable styles={styles} rows={partners} empty={empty} onOpen={openPartner} />
        )}
        {screen.type === 'partner' && (
          <PartnerDetail
            styles={styles}
            row={partners.find((row) => row.id === screen.id)}
            campaigns={campaigns}
            promotions={promotions}
            onBack={() => setScreen({ type: 'partners' })}
            onCampaign={openCampaign}
            onPromotion={openPromotion}
          />
        )}
        {screen.type === 'customers' && (
          <CustomerTable
            styles={styles}
            rows={filteredCustomers}
            all={customers}
            empty={empty}
            onOpen={openCustomer}
            customerStatus={customerStatus}
            promoStatus={promoStatus}
            partner={customerPartner}
            campaign={customerCampaign}
            code={customerCode}
            onCustomerStatus={setCustomerStatus}
            onPromoStatus={setPromoStatus}
            onPartner={setCustomerPartner}
            onCampaign={setCustomerCampaign}
            onCode={setCustomerCode}
          />
        )}
        {screen.type === 'customer' && (
          <CustomerDetail
            styles={styles}
            row={customers.find((row) => row.id === screen.id)}
            campaigns={campaigns}
            partners={partners}
            onBack={() => setScreen({ type: 'customers' })}
            onCampaign={openCampaign}
            onPartner={openPartner}
          />
        )}
      </main>
    </div>
  );
}

function Help({ styles, text }: { styles: DiscountAdminStyles; text: string }) {
  return (
    <details className="inline">
      <summary className={`${styles.action} cursor-pointer list-none`}>What this means</summary>
      <p className={`${styles.hint} max-w-xs`}>{text}</p>
    </details>
  );
}

function EmptyNote({ styles, text }: { styles: DiscountAdminStyles; text: string }) {
  return <p className={styles.note}>{text}</p>;
}

function Kpi({ styles, label, value, help }: { styles: DiscountAdminStyles; label: string; value: string; help?: string }) {
  return (
    <div className={styles.card}>
      <p className={styles.muted}>{label}</p>
      <p className="mt-2 text-2xl font-semibold text-emerald-500">{value}</p>
      {help && <div className="mt-2"><Help styles={styles} text={help} /></div>}
    </div>
  );
}

function Overview({
  styles, figures, empty, customers, onCustomers, onCustomer,
}: {
  styles: DiscountAdminStyles;
  figures: ReturnType<typeof overviewFigures>;
  empty: boolean;
  customers: AttributedCustomer[];
  onCustomers: () => void;
  onCustomer: (id: string) => void;
}) {
  const multi = customers.filter((row) => row.activePromotions >= 1);
  return (
    <div className="space-y-8">
      <section>
        <h2 className={styles.sectionTitle}>Performance</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi styles={styles} label="Active Discount Codes" value={String(figures.activeCodes)} />
          <Kpi styles={styles} label="Users With Active Discounts" value={figures.usersWithDiscounts.toLocaleString('en-US')} />
          <Kpi styles={styles} label="Total Redemptions" value={figures.redemptions.toLocaleString('en-US')} />
          <Kpi styles={styles} label="New Customers From Promotions" value={figures.newCustomers.toLocaleString('en-US')} />
          <Kpi styles={styles} label="Current expected discount" value={formatMoney(figures.discountValue)} help="Account-level expected discount for accounts with assignments in this range. It is not collected revenue." />
          <Kpi styles={styles} label="Expected monthly cost" value={formatMoney(figures.revenueAfterDiscounts)} />
          <Kpi styles={styles} label="Expected MRR from acquisitions" value={formatMoney(figures.attributedMrr)} help="Expected monthly cost for accounts with a saved acquisition. Collected revenue is not available." />
          <Kpi styles={styles} label="Average Discounts Per Discounted User" value={figures.averageDiscounts} />
        </div>
      </section>
      <section>
        <h2 className={styles.sectionTitle}>How many promotions customers have</h2>
        <p className={`${styles.hint} mb-3`}>Household Toolbox allows different promotions to be active together. These counts are for visibility.</p>
        {empty ? <EmptyNote styles={styles} text="No promotion redemptions during this period." /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi styles={styles} label="Users With 1 Active Discount" value={String(figures.usage.one)} />
            <Kpi styles={styles} label="Users With 2+ Active Discounts" value={String(figures.usage.two)} />
            <Kpi styles={styles} label="Users With 3+ Active Discounts" value={String(figures.usage.three)} />
            <Kpi styles={styles} label="Users With 5+ Active Discounts" value={String(figures.usage.five)} />
            <Kpi styles={styles} label="Average Active Promotions Per User" value={figures.usage.average} />
            <Kpi styles={styles} label="Maximum Active Promotions on One User" value={String(figures.usage.maximum)} />
          </div>
        )}
      </section>
      <section>
        <h2 className={styles.sectionTitle}>Promotion funnel</h2>
        <p className={`${styles.hint} mb-3`}>A sample path from redemption to paying customers. The steps can change later.</p>
        {empty ? <EmptyNote styles={styles} text="No promotion redemptions during this period." /> : (
          <ol className="space-y-2">
            {figures.funnel.map((step, index) => (
              <li key={step.label} className={styles.card}>
                <p className={styles.muted}>Step {index + 1}</p>
                <p className={styles.primaryText}>{step.label}</p>
                <p className="text-xl font-semibold text-emerald-500">{step.value}</p>
              </li>
            ))}
          </ol>
        )}
        <p className={`${styles.hint} mt-2`}>Conversion rate on this screen means paying customers divided by unique customers acquired through the promotion. <Help styles={styles} text={METRIC_HELP.conversionRate} /></p>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className={styles.sectionTitle}>Benefit types</h2>
          <SimpleTable
            styles={styles}
            headers={['Benefit', 'Active promotions', 'Active users', 'Redemptions', 'Discount value']}
            rows={figures.benefitTypes.map((row) => [row.type, row.promotions, row.users, row.redemptions, formatMoney(row.discountValue)])}
            emptyText="No promotion redemptions during this period."
            empty={empty}
          />
        </div>
        <div>
          <h2 className={styles.sectionTitle}>How promotions were assigned</h2>
          <SimpleTable
            styles={styles}
            headers={['Source', 'Assignments', 'Active', 'Expired', 'Removed']}
            rows={figures.sources.map((row) => [row.source, row.assignments, row.active, row.expired, row.removed])}
            emptyText="No promotion redemptions during this period."
            empty={empty}
          />
        </div>
      </section>
      <section>
        <h2 className={styles.sectionTitle}>Acquisition by platform</h2>
        <SimpleTable
          styles={styles}
          headers={['Platform', 'Customers', 'Paying customers', 'Conversion rate', 'Expected MRR', 'Collected revenue']}
          rows={figures.platforms.map((row) => [row.platform, row.customers, 'Not available', '—', formatMoney(row.mrr), 'Not available'])}
          emptyText="No partner attribution yet."
          empty={empty}
        />
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className={styles.sectionTitle}>Promotion usage by customer</h2>
          <button type="button" className={styles.secondaryButton} onClick={onCustomers}>All attributed customers</button>
        </div>
        {multi.length === 0 ? <EmptyNote styles={styles} text="No promotion redemptions during this period." /> : (
          <div className="grid gap-3 md:grid-cols-2">
            {multi.map((row) => (
              <button key={row.id} type="button" className={styles.cardButton} onClick={() => onCustomer(row.id)}>
                <p className={styles.primaryText}>{row.name}</p>
                <p className={styles.muted}>{row.activePromotions} active promotion{row.activePromotions === 1 ? '' : 's'}</p>
                <p className={styles.hint}>Lifetime redemptions {row.lifetimeRedemptions} · Discount {row.monthlyDiscount} · Cost {row.monthlyCost}</p>
                <p className={styles.hint}>Free tool slots {row.freeSlots} · Bonus storage {row.bonusStorage}</p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SimpleTable({ styles, headers, rows, empty, emptyText }: { styles: DiscountAdminStyles; headers: string[]; rows: (string | number)[][]; empty: boolean; emptyText: string }) {
  if (empty) return <div className="mt-3"><EmptyNote styles={styles} text={emptyText} /></div>;
  return (
    <div className={`${styles.tableWrap} mt-3 overflow-x-auto`}>
      <table className="min-w-full">
        <thead className={styles.tableHead}>
          <tr>{headers.map((header) => <th key={header} className={styles.tableHeadCell}>{header}</th>)}</tr>
        </thead>
        <tbody className={styles.tableBody}>
          {rows.map((row) => (
            <tr key={String(row[0])} className={styles.row}>
              {row.map((cell, index) => <td key={`${row[0]}-${index}`} className={`px-4 py-3 ${styles.bodyText}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterSelect({ styles, label, value, options, onChange }: { styles: DiscountAdminStyles; label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="min-w-[10rem]">
      <span className={styles.label}>{label}</span>
      <select className={styles.input} value={value} onChange={(event) => onChange(event.target.value)}>
        <option>All</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function unique(values: string[]) {
  return [...new Set(values.filter((value) => value && value !== '—'))].sort();
}

function PromotionTable(props: {
  styles: DiscountAdminStyles;
  rows: PromotionReportRow[];
  options: PromotionReportRow[];
  empty: boolean;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  onOpen: (id: string) => void;
  statusFilter: string;
  benefitFilter: string;
  campaignFilter: string;
  partnerFilter: string;
  platformFilter: string;
  onStatus: (value: string) => void;
  onBenefit: (value: string) => void;
  onCampaign: (value: string) => void;
  onPartner: (value: string) => void;
  onPlatform: (value: string) => void;
}) {
  const { styles, rows, options } = props;
  const sortLabel = (key: SortKey, label: string) => `${label}${props.sortKey === key ? (props.sortDir === 'asc' ? ' ↑' : ' ↓') : ''}`;
  return (
    <section>
      <h2 className={styles.sectionTitle}>Promotion performance</h2>
      <div className="mt-3 flex flex-wrap gap-3">
        <FilterSelect styles={styles} label="Status" value={props.statusFilter} options={unique(options.map((row) => row.status))} onChange={props.onStatus} />
        <FilterSelect styles={styles} label="Benefit type" value={props.benefitFilter} options={unique(options.map((row) => row.benefitType))} onChange={props.onBenefit} />
        <FilterSelect styles={styles} label="Campaign" value={props.campaignFilter} options={unique(options.map((row) => row.campaign))} onChange={props.onCampaign} />
        <FilterSelect styles={styles} label="Partner" value={props.partnerFilter} options={unique(options.map((row) => row.partner))} onChange={props.onPartner} />
        <FilterSelect styles={styles} label="Platform" value={props.platformFilter} options={unique(options.map((row) => row.platform))} onChange={props.onPlatform} />
      </div>
      {props.empty || rows.length === 0 ? <div className="mt-4"><EmptyNote styles={styles} text="No promotion redemptions during this period." /></div> : (
        <>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <div className={styles.tableWrap}>
              <table className="min-w-[1400px]">
                <thead className={styles.tableHead}>
                  <tr>
                    {([
                      ['name', 'Promotion'],
                      ['redemptions', 'Redemptions'],
                      ['activeUsers', 'Active users'],
                      ['payingUsers', 'Expected billable'],
                      ['discountValue', 'Discount value'],
                      ['mrr', 'MRR'],
                      ['lifetimeRevenue', 'Collected revenue'],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <th key={key} className={styles.tableHeadCell} aria-sort={props.sortKey === key ? (props.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className={styles.action} onClick={() => props.onSort(key)}>{sortLabel(key, label)}</button>
                      </th>
                    ))}
                    <th className={styles.tableHeadCell}>Code</th>
                    <th className={styles.tableHeadCell}>Benefit</th>
                    <th className={styles.tableHeadCell}>Status</th>
                    <th className={styles.tableHeadCell}>Campaign</th>
                    <th className={styles.tableHeadCell}>Partner</th>
                    <th className={styles.tableHeadCell}>Conversion</th>
                    <th className={styles.tableHeadCell}>Revenue share</th>
                  </tr>
                </thead>
                <tbody className={styles.tableBody}>
                  {rows.map((row) => (
                    <tr key={row.id} className={styles.row}>
                      <td className="px-4 py-3"><button type="button" className={styles.codeLink} onClick={() => props.onOpen(row.id)}>{row.name}</button></td>
                      <td className={`px-4 py-3 ${styles.bodyText}`}>{row.redemptions}</td>
                      <td className={`px-4 py-3 ${styles.bodyText}`}>{row.activeUsers}</td>
                      <td className={`px-4 py-3 ${styles.bodyText}`}>{row.payingUsers}</td>
                      <td className={`px-4 py-3 ${styles.bodyText}`}>{formatMoney(row.discountValue)}</td>
                      <td className={`px-4 py-3 ${styles.bodyText}`}>{formatMoney(row.mrr)}</td>
                      <td className={`px-4 py-3 ${styles.bodyText}`}>{'Not available'}</td>
                      <td className={`px-4 py-3 font-mono ${styles.bodyText}`}>{row.code}</td>
                      <td className={`px-4 py-3 ${styles.bodyText}`}>{row.benefitType}</td>
                      <td className={`px-4 py-3 ${styles.bodyText}`}>{row.status}</td>
                      <td className={`px-4 py-3 ${styles.bodyText}`}>{row.campaign}</td>
                      <td className={`px-4 py-3 ${styles.bodyText}`}>{row.partner}</td>
                      <td className={`px-4 py-3 ${styles.bodyText}`}>{row.conversionRate}</td>
                      <td className={`px-4 py-3 ${styles.bodyText}`}>{row.revenueSharePercent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:hidden">
            {rows.map((row) => (
              <button key={row.id} type="button" className={styles.cardButton} onClick={() => props.onOpen(row.id)}>
                <p className={styles.primaryText}>{row.name}</p>
                <p className={styles.muted}>{row.code} · {row.status} · {row.benefitType}</p>
                <p className={styles.hint}>{row.redemptions} redemptions · {formatMoney(row.discountValue)} discount value · {formatMoney(row.mrr)} MRR</p>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Fact({ styles, label, value }: { styles: DiscountAdminStyles; label: string; value: string }) {
  return (
    <div>
      <dt className={styles.muted}>{label}</dt>
      <dd className={styles.primaryText}>{value}</dd>
    </div>
  );
}

function PromotionDetail({
  styles, row, campaigns, partners, onBack, onCampaign, onPartner,
}: {
  styles: DiscountAdminStyles;
  row?: PromotionReportRow;
  campaigns: CampaignReport[];
  partners: PartnerReport[];
  onBack: () => void;
  onCampaign: (id: string) => void;
  onPartner: (id: string) => void;
}) {
  if (!row) return <EmptyNote styles={styles} text="No promotion redemptions during this period." />;
  const campaign = campaigns.find((item) => item.name === row.campaign);
  const partner = partners.find((item) => item.name === row.partner);
  const redemptions = row.recent ?? [];
  return (
    <div className="space-y-6">
      <button type="button" className={styles.backLink} onClick={onBack}>← Promotions</button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={styles.sectionTitle}>{row.name}</h2>
        <a className={styles.secondaryButton} href="/dashboard/admin/discount-codes">Discount Code Management</a>
      </div>
      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Promotion summary</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact styles={styles} label="Code" value={row.code} />
          <Fact styles={styles} label="Benefit" value={row.benefit} />
          <Fact styles={styles} label="Status" value={row.status} />
          <Fact styles={styles} label="Start" value={row.start} />
          <Fact styles={styles} label="End" value={row.end} />
          <Fact styles={styles} label="Duration" value={row.duration} />
          <Fact styles={styles} label="Eligibility" value={row.eligibility} />
          <Fact styles={styles} label="Stackable" value={row.stackable} />
          <Fact styles={styles} label="Repeat" value={row.repeatable} />
        </dl>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        <div className={styles.card}>
          <h3 className={styles.sectionTitle}>Usage</h3>
          <dl className="mt-3 space-y-2">
            <Fact styles={styles} label="Total redemptions" value={String(row.redemptions)} />
            <Fact styles={styles} label="Active customers" value={String(row.activeUsers)} />
            <Fact styles={styles} label="Expired customers" value={String(row.expiredCustomers)} />
            <Fact styles={styles} label="Removed assignments" value={String(row.removedAssignments)} />
            <Fact styles={styles} label="Scheduled assignments" value={String(row.scheduledAssignments)} />
          </dl>
        </div>
        <div className={styles.card}>
          <h3 className={styles.sectionTitle}>Financial sample</h3>
          <dl className="mt-3 space-y-2">
            <Fact styles={styles} label="Discount value" value={formatMoney(row.discountValue)} />
            <Fact styles={styles} label="MRR from acquired customers" value={formatMoney(row.mrr)} />
            <Fact styles={styles} label="Collected revenue" value="Not available" />
            <Fact styles={styles} label="Conversion rate" value={row.conversionRate} />
            <Fact styles={styles} label="Average revenue per converted customer" value={row.averageRevenue} />
          </dl>
          <Help styles={styles} text={METRIC_HELP.conversionRate} />
        </div>
        <div className={styles.card}>
          <h3 className={styles.sectionTitle}>Attribution</h3>
          <dl className="mt-3 space-y-2">
            <Fact styles={styles} label="Campaign" value={row.campaign} />
            <Fact styles={styles} label="Partner" value={row.partner} />
            <Fact styles={styles} label="Platform" value={row.platform} />
            <Fact styles={styles} label="Revenue share %" value={row.revenueSharePercent} />
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {campaign && <button type="button" className={styles.secondaryButton} onClick={() => onCampaign(campaign.id)}>Open campaign</button>}
            {partner && <button type="button" className={styles.secondaryButton} onClick={() => onPartner(partner.id)}>Open partner</button>}
          </div>
        </div>
      </section>
      <section>
        <h3 className={styles.sectionTitle}>Recent redemptions</h3>
        {redemptions.length === 0 ? <div className="mt-3"><EmptyNote styles={styles} text="No promotion redemptions during this period." /></div> : (
          <SimpleTable
            styles={styles}
            headers={['Customer', 'Date', 'Source', 'Promotion status', 'Customer status']}
            rows={redemptions.map((item) => [item.customer, item.date, item.source, item.promotionStatus, item.customerStatus])}
            empty={false}
            emptyText=""
          />
        )}
      </section>
    </div>
  );
}

function CampaignTable({ styles, rows, empty, onOpen, onPartner }: { styles: DiscountAdminStyles; rows: CampaignReport[]; empty: boolean; onOpen: (id: string) => void; onPartner: (id: string) => void }) {
  if (empty) return <EmptyNote styles={styles} text="No campaign data yet." />;
  return (
    <section>
      <h2 className={styles.sectionTitle}>Campaigns</h2>
      <p className={`${styles.hint} mb-3`}>A campaign can use more than one code. The partner is separate from the campaign.</p>
      <div className="grid gap-3">
        {rows.map((row) => (
          <div key={row.id} className={styles.card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <button type="button" className={styles.codeLink} onClick={() => onOpen(row.id)}>{row.name}</button>
                <p className={styles.muted}>{row.status} · {row.platform} · {row.start} to {row.end}</p>
                <button type="button" className={styles.action} onClick={() => onPartner(row.partnerId)}>{row.partner}</button>
                <p className={styles.hint}>Codes {row.codes.join(', ')}</p>
              </div>
              <p className={styles.primaryText}>{row.redemptions} redemptions · {formatMoney(row.mrr)} MRR</p>
            </div>
            <p className={`${styles.hint} mt-2`}>{row.newCustomers} new customers · {row.payingCustomers} paying · {row.conversionRate} conversion · Discount {formatMoney(row.discountValue)} · Collected revenue not available · Estimated share {formatMoney(row.estimatedShare)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CampaignDetail({
  styles, isLight, row, promotions, onBack, onPromotion, onPartner,
}: {
  styles: DiscountAdminStyles;
  isLight: boolean;
  row?: CampaignReport;
  promotions: PromotionReportRow[];
  onBack: () => void;
  onPromotion: (id: string) => void;
  onPartner: (id: string) => void;
}) {
  if (!row) return <EmptyNote styles={styles} text="No campaign data yet." />;
  const codes = promotions.filter((item) => row.codes.includes(item.code));
  return (
    <div className="space-y-6">
      <button type="button" className={styles.backLink} onClick={onBack}>← Campaigns</button>
      <h2 className={styles.sectionTitle}>{row.name}</h2>
      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Overview</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact styles={styles} label="Partner" value={row.partner} />
          <Fact styles={styles} label="Platform" value={row.platform} />
          <Fact styles={styles} label="Status" value={row.status} />
          <Fact styles={styles} label="Start" value={row.start} />
          <Fact styles={styles} label="End" value={row.end} />
        </dl>
        <button type="button" className={`${styles.secondaryButton} mt-3`} onClick={() => onPartner(row.partnerId)}>Open partner</button>
      </section>
      <section>
        <h3 className={styles.sectionTitle}>Codes</h3>
        {codes.length === 0 ? <div className="mt-3"><EmptyNote styles={styles} text="No campaign data yet." /></div> : (
          <div className="mt-3 flex flex-wrap gap-2">
            {codes.map((code) => (
              <button key={code.id} type="button" className={styles.secondaryButton} onClick={() => onPromotion(code.id)}>{code.code}</button>
            ))}
            {row.codes.filter((code) => !codes.some((item) => item.code === code)).map((code) => (
              <span key={code} className={styles.chip}>{code}</span>
            ))}
          </div>
        )}
      </section>
      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Performance</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact styles={styles} label="Redemptions" value={String(row.redemptions)} />
          <Fact styles={styles} label="Unique customers" value={String(row.newCustomers)} />
          <Fact styles={styles} label="Paying customers" value={String(row.payingCustomers)} />
          <Fact styles={styles} label="Conversion rate" value={row.conversionRate} />
          <Fact styles={styles} label="Expected MRR" value={formatMoney(row.mrr)} />
          <Fact styles={styles} label="Collected revenue" value="Not available" />
          <Fact styles={styles} label="Discount value" value={formatMoney(row.discountValue)} />
          <Fact styles={styles} label="Estimated revenue share" value={formatMoney(row.estimatedShare)} />
        </dl>
        <p className={`${styles.hint} mt-3`}>Estimated. Eligible revenue {formatMoney(row.eligibleRevenue)} at {row.revenueSharePercent}. This has not been paid.</p>
      </section>
      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Redemptions over time</h3>
        <div className="mt-4 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={row.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#cbd5e1' : '#334155'} />
              <XAxis dataKey="label" tick={{ fill: isLight ? '#475569' : '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: isLight ? '#475569' : '#94a3b8', fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="redemptions" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <SimpleTable styles={styles} headers={['Week', 'Redemptions']} rows={row.trend.map((point) => [point.label, point.redemptions])} empty={false} emptyText="" />
      </section>
    </div>
  );
}

function PartnerTable({ styles, rows, empty, onOpen }: { styles: DiscountAdminStyles; rows: PartnerReport[]; empty: boolean; onOpen: (id: string) => void }) {
  if (empty) return <EmptyNote styles={styles} text="No partner attribution yet." />;
  return (
    <section>
      <h2 className={styles.sectionTitle}>Partners and influencers</h2>
      <div className={`${styles.tableWrap} mt-3 hidden overflow-x-auto md:block`}>
        <table className="min-w-[980px]">
          <thead className={styles.tableHead}>
            <tr>{['Partner', 'Platforms', 'Campaigns', 'Codes', 'Redemptions', 'New customers', 'Paying', 'MRR', 'Lifetime', 'Estimated share'].map((header) => <th key={header} className={styles.tableHeadCell}>{header}</th>)}</tr>
          </thead>
          <tbody className={styles.tableBody}>
            {rows.map((row) => (
              <tr key={row.id} className={styles.row}>
                <td className="px-4 py-3"><button type="button" className={styles.codeLink} onClick={() => onOpen(row.id)}>{row.name}</button></td>
                <td className={`px-4 py-3 ${styles.bodyText}`}>{row.platforms}</td>
                <td className={`px-4 py-3 ${styles.bodyText}`}>{row.campaigns}</td>
                <td className={`px-4 py-3 ${styles.bodyText}`}>{row.codes}</td>
                <td className={`px-4 py-3 ${styles.bodyText}`}>{row.redemptions}</td>
                <td className={`px-4 py-3 ${styles.bodyText}`}>{row.newCustomers}</td>
                <td className={`px-4 py-3 ${styles.bodyText}`}>{row.payingCustomers}</td>
                <td className={`px-4 py-3 ${styles.bodyText}`}>{formatMoney(row.mrr)}</td>
                <td className={`px-4 py-3 ${styles.bodyText}`}>{'Not available'}</td>
                <td className={`px-4 py-3 ${styles.bodyText}`}>{formatMoney(row.estimatedShare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid gap-3 md:hidden">
        {rows.map((row) => (
          <button key={row.id} type="button" className={styles.cardButton} onClick={() => onOpen(row.id)}>
            <p className={styles.primaryText}>{row.name}</p>
            <p className={styles.muted}>{row.platforms} · {row.campaigns} campaigns · {row.codes} codes</p>
            <p className={styles.hint}>{row.redemptions} redemptions · {formatMoney(row.mrr)} MRR · Estimated share {formatMoney(row.estimatedShare)}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function PartnerDetail({
  styles, row, campaigns, promotions, onBack, onCampaign, onPromotion,
}: {
  styles: DiscountAdminStyles;
  row?: PartnerReport;
  campaigns: CampaignReport[];
  promotions: PromotionReportRow[];
  onBack: () => void;
  onCampaign: (id: string) => void;
  onPromotion: (id: string) => void;
}) {
  if (!row) return <EmptyNote styles={styles} text="No partner attribution yet." />;
  const relatedCampaigns = campaigns.filter((item) => item.partnerId === row.id);
  const relatedCodes = promotions.filter((item) => item.partner === row.name);
  return (
    <div className="space-y-6">
      <button type="button" className={styles.backLink} onClick={onBack}>← Partners</button>
      <h2 className={styles.sectionTitle}>{row.name}</h2>
      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Partner information</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Fact styles={styles} label="Status" value={row.status} />
          <Fact styles={styles} label="Platforms" value={row.platforms} />
          <Fact styles={styles} label="Notes" value={row.notes} />
          <Fact styles={styles} label="Revenue share %" value={row.revenueSharePercent} />
        </dl>
      </section>
      <section>
        <h3 className={styles.sectionTitle}>Campaigns</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {relatedCampaigns.map((item) => <button key={item.id} type="button" className={styles.secondaryButton} onClick={() => onCampaign(item.id)}>{item.name}</button>)}
        </div>
      </section>
      <section>
        <h3 className={styles.sectionTitle}>Promotion codes</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {relatedCodes.map((item) => <button key={item.id} type="button" className={styles.secondaryButton} onClick={() => onPromotion(item.id)}>{item.code}</button>)}
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className={styles.card}>
          <h3 className={styles.sectionTitle}>Customer attribution</h3>
          <dl className="mt-3 space-y-2">
            <Fact styles={styles} label="Attributed customers" value={String(row.newCustomers)} />
            <Fact styles={styles} label="Active customers" value={String(row.activeCustomers)} />
            <Fact styles={styles} label="Paying customers" value={String(row.payingCustomers)} />
          </dl>
        </div>
        <div className={styles.card}>
          <h3 className={styles.sectionTitle}>Revenue sample</h3>
          <dl className="mt-3 space-y-2">
            <Fact styles={styles} label="Expected MRR" value={formatMoney(row.mrr)} />
            <Fact styles={styles} label="Collected revenue" value="Not available" />
            <Fact styles={styles} label="Discount value" value={formatMoney(row.discountValue)} />
            <Fact styles={styles} label="Eligible revenue" value={formatMoney(row.eligibleRevenue)} />
            <Fact styles={styles} label="Estimated revenue share" value={formatMoney(row.estimatedShare)} />
          </dl>
          <p className={`${styles.hint} mt-2`}>Estimated. Nothing has been paid. There is no payout step on this screen.</p>
          <Help styles={styles} text={METRIC_HELP.revenueShare} />
        </div>
      </section>
    </div>
  );
}

function CustomerTable(props: {
  styles: DiscountAdminStyles;
  rows: AttributedCustomer[];
  all: AttributedCustomer[];
  empty: boolean;
  onOpen: (id: string) => void;
  customerStatus: string;
  promoStatus: string;
  partner: string;
  campaign: string;
  code: string;
  onCustomerStatus: (value: string) => void;
  onPromoStatus: (value: string) => void;
  onPartner: (value: string) => void;
  onCampaign: (value: string) => void;
  onCode: (value: string) => void;
}) {
  const { styles, rows, all } = props;
  return (
    <section>
      <h2 className={styles.sectionTitle}>Customers acquired through promotions</h2>
      <p className={`${styles.hint} mb-3`}>The original partner, campaign, and code stay on the customer after that promotion ends.</p>
      <div className="flex flex-wrap gap-3">
        <FilterSelect styles={styles} label="Partner" value={props.partner} options={unique(all.map((row) => row.partner))} onChange={props.onPartner} />
        <FilterSelect styles={styles} label="Campaign" value={props.campaign} options={unique(all.map((row) => row.campaign))} onChange={props.onCampaign} />
        <FilterSelect styles={styles} label="Code" value={props.code} options={unique(all.map((row) => row.originalCode))} onChange={props.onCode} />
        <FilterSelect styles={styles} label="Customer status" value={props.customerStatus} options={unique(all.map((row) => row.accountStatus))} onChange={props.onCustomerStatus} />
        <FilterSelect styles={styles} label="Promotion status" value={props.promoStatus} options={unique(all.map((row) => row.currentPromotionStatus))} onChange={props.onPromoStatus} />
      </div>
      {props.empty || rows.length === 0 ? <div className="mt-4"><EmptyNote styles={styles} text="No partner attribution yet." /></div> : (
        <>
          <div className={`${styles.tableWrap} mt-4 hidden overflow-x-auto lg:block`}>
            <table className="min-w-[1100px]">
              <thead className={styles.tableHead}>
                <tr>{['Customer', 'Joined', 'Partner', 'Campaign', 'Original code', 'Current promotion', 'Account', 'Tools', 'Monthly cost', 'Collected revenue'].map((header) => <th key={header} className={styles.tableHeadCell}>{header}</th>)}</tr>
              </thead>
              <tbody className={styles.tableBody}>
                {rows.map((row) => (
                  <tr key={row.id} className={styles.row}>
                    <td className="px-4 py-3"><button type="button" className={styles.codeLink} onClick={() => props.onOpen(row.id)}>{row.name}</button></td>
                    <td className={`px-4 py-3 ${styles.bodyText}`}>{row.joined}</td>
                    <td className={`px-4 py-3 ${styles.bodyText}`}>{row.partner}</td>
                    <td className={`px-4 py-3 ${styles.bodyText}`}>{row.campaign}</td>
                    <td className={`px-4 py-3 font-mono ${styles.bodyText}`}>{row.originalCode}</td>
                    <td className={`px-4 py-3 ${styles.bodyText}`}>{row.currentPromotionStatus}</td>
                    <td className={`px-4 py-3 ${styles.bodyText}`}>{row.accountStatus}</td>
                    <td className={`px-4 py-3 ${styles.bodyText}`}>{row.activeTools}</td>
                    <td className={`px-4 py-3 ${styles.bodyText}`}>{row.monthlyCost}</td>
                    <td className={`px-4 py-3 ${styles.bodyText}`}>{'Not available'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-3 lg:hidden">
            {rows.map((row) => (
              <button key={row.id} type="button" className={styles.cardButton} onClick={() => props.onOpen(row.id)}>
                <p className={styles.primaryText}>{row.name}</p>
                <p className={styles.muted}>{row.accountStatus} · Promotion {row.currentPromotionStatus}</p>
                <p className={styles.hint}>{row.partner} → {row.campaign} → {row.originalCode}</p>
                <p className={styles.hint}>{row.monthlyCost} · Collected revenue not available</p>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CustomerDetail({
  styles, row, campaigns, partners, onBack, onCampaign, onPartner,
}: {
  styles: DiscountAdminStyles;
  row?: AttributedCustomer;
  campaigns: CampaignReport[];
  partners: PartnerReport[];
  onBack: () => void;
  onCampaign: (id: string) => void;
  onPartner: (id: string) => void;
}) {
  if (!row) return <EmptyNote styles={styles} text="No partner attribution yet." />;
  const campaign = campaigns.find((item) => item.name === row.campaign);
  const partner = partners.find((item) => item.name === row.partner);
  const manageHref = `/dashboard/admin/users/${row.id}?name=${encodeURIComponent(row.name)}&email=${encodeURIComponent(row.email)}`;
  return (
    <div className="space-y-6">
      <button type="button" className={styles.backLink} onClick={onBack}>← Customers</button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={styles.sectionTitle}>{row.name}</h2>
          <p className={styles.muted}>{row.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className={styles.primaryButton} href={manageHref}>Manage Discounts & Entitlements</a>
          <button type="button" className={styles.secondaryButton} disabled>Open Billing Preview — Coming Later</button>
        </div>
      </div>
      <section className={styles.preview}>
        <p className={styles.muted}>Acquired through</p>
        <p className={styles.primaryText}>{row.partner} → {row.campaign} → {row.originalCode}</p>
        <p className={`${styles.hint} mt-2`}>Original promotion: {row.originalPromotion}. Current promotion: {row.currentPromotionStatus}. Account: {row.accountStatus}. Collected revenue is not available.</p>
        <p className={`${styles.hint} mt-1`}>The acquisition stays with this customer after the original code expires. The current discount is a separate fact.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {partner && <button type="button" className={styles.secondaryButton} onClick={() => onPartner(partner.id)}>Open partner</button>}
          {campaign && <button type="button" className={styles.secondaryButton} onClick={() => onCampaign(campaign.id)}>Open campaign</button>}
        </div>
      </section>
      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Promotion summary</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact styles={styles} label="Active promotions" value={String(row.activePromotions)} />
          <Fact styles={styles} label="Lifetime redemptions" value={String(row.lifetimeRedemptions)} />
          <Fact styles={styles} label="Current monthly discount" value={row.monthlyDiscount} />
          <Fact styles={styles} label="Current monthly cost" value={row.monthlyCost} />
          <Fact styles={styles} label="Free-tool benefits" value={row.freeSlots} />
          <Fact styles={styles} label="Bonus storage" value={row.bonusStorage} />
          <Fact styles={styles} label="Promotion history count" value={String(row.historyCount)} />
          <Fact styles={styles} label="Active tools" value={String(row.activeTools)} />
          <Fact styles={styles} label="Joined" value={row.joined} />
        </dl>
      </section>
    </div>
  );
}
