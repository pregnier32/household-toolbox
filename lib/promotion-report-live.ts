import { supabaseServer } from '@/lib/supabaseServer';
import { formatCents } from '@/lib/account-pricing';
import { benefitLabel, discountTypeLabel, getDisplayStatus } from '@/lib/discount-codes';
import { loadAccountPricingInputs } from '@/lib/load-account-pricing';
import { calculateAccountPricing } from '@/lib/account-pricing';
import { listDiscountCodes } from '@/lib/promotion-service';
import type {
  AttributedCustomer,
  CampaignReport,
  PartnerReport,
  PromotionReportRow,
} from '@/lib/promotion-reporting';

const BENEFIT_LABEL: Record<string, string> = {
  free_tool_slots: 'Free Tool Slots',
  specific_tools: 'Specific Tool Free',
  percent_100: '100% Off',
  percentage: 'Percentage Off',
  fixed_amount: 'Fixed Dollar Off',
  bonus_storage: 'Bonus Storage',
};

const SOURCE_LABEL: Record<string, string> = {
  user_entered: 'User Entered Code',
  automatic: 'Automatically Assigned',
  admin_assigned: 'Superadmin Assigned',
  manual: 'Manual Entitlement',
};

function inRange(iso: string, start: string | null, end: string | null): boolean {
  const time = Date.parse(iso);
  if (start && time < Date.parse(start)) return false;
  if (end && time >= Date.parse(end)) return false;
  return true;
}

function activeNow(row: { removed_at: string | null; effective_at: string; expires_at: string | null }, now: number): boolean {
  if (row.removed_at) return false;
  if (Date.parse(row.effective_at) > now) return false;
  if (row.expires_at && Date.parse(row.expires_at) <= now) return false;
  return true;
}

function displayDate(value: string | null): string {
  if (!value) return '—';
  return value.slice(0, 10);
}

export async function buildPromotionReport(start: string | null, end: string | null) {
  const now = new Date();
  const nowMs = now.getTime();
  const [codes, assignments, partners, campaigns, platforms, acquisitions, users] = await Promise.all([
    listDiscountCodes(),
    supabaseServer.from('promotion_assignments').select('id, user_id, promotion_id, source, assigned_at, effective_at, expires_at, removed_at, display_name, public_code, benefit_type'),
    supabaseServer.from('partners').select('id, name, notes, status, revenue_share_percent'),
    supabaseServer.from('campaigns').select('id, name, partner_id, platform_code, starts_on, ends_on, status'),
    supabaseServer.from('platforms').select('code, name'),
    supabaseServer.from('user_acquisitions').select('user_id, partner_id, campaign_id, promotion_id, public_code, acquired_at'),
    supabaseServer.from('users').select('id, email, first_name, last_name, created_at'),
  ]);
  if (assignments.error) throw assignments.error;
  if (acquisitions.error) throw acquisitions.error;
  if (users.error) throw users.error;

  const rows = (assignments.data ?? []).filter((row) => inRange(row.assigned_at, start, end));
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const inputs = await loadAccountPricingInputs(userIds);
  const priced = new Map([...inputs.entries()].map(([id, input]) => [id, calculateAccountPricing(input, now)]));

  const userName = new Map((users.data ?? []).map((user) => [user.id, {
    name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Account',
    email: user.email,
    joined: user.created_at,
  }]));
  const partnerById = new Map((partners.data ?? []).map((partner) => [partner.id, partner]));
  const campaignById = new Map((campaigns.data ?? []).map((campaign) => [campaign.id, campaign]));
  const platformName = new Map((platforms.data ?? []).map((platform) => [platform.code, platform.name]));

  const promotions: PromotionReportRow[] = codes.map((code) => {
    const mine = rows.filter((row) => row.promotion_id === code.id);
    const activeUsers = new Set(mine.filter((row) => activeNow(row, nowMs)).map((row) => row.user_id));
    const expectedUsers = [...activeUsers].map((id) => priced.get(id)).filter((state) => state && state.effectiveMonthlyCents > 0);
    return {
      id: code.id,
      name: code.internalName,
      code: code.publicCode || '—',
      benefitType: BENEFIT_LABEL[code.discountType] || discountTypeLabel(code.discountType),
      benefit: benefitLabel(code),
      status: titleStatus(getDisplayStatus(code)),
      campaign: code.campaignName || '—',
      partner: code.partnerName || '—',
      platform: platformName.get(code.platform) || code.platform || '—',
      redemptions: mine.length,
      activeUsers: activeUsers.size,
      payingUsers: expectedUsers.length,
      conversionRate: '—',
      discountValue: 0,
      mrr: roundDollars(expectedUsers.reduce((sum, state) => sum + (state?.effectiveMonthlyCents ?? 0), 0)),
      lifetimeRevenue: 0,
      averageRevenue: '—',
      revenueSharePercent: code.revenueSharePercent ? `${code.revenueSharePercent}%` : '—',
      start: displayDate(code.redeemStartDate || null),
      end: displayDate(code.redeemEndDate || null),
      duration: code.durationUnit === 'lifetime' ? 'Lifetime' : `${code.durationAmount} ${code.durationUnit}`,
      eligibility: code.eligibleUsers,
      stackable: code.canStack ? 'Yes' : 'No',
      repeatable: code.perUserRedemption === 'once' ? 'Once per user' : 'Repeatable',
      expiredCustomers: mine.filter((row) => !row.removed_at && row.expires_at && Date.parse(row.expires_at) <= nowMs).length,
      removedAssignments: mine.filter((row) => row.removed_at).length,
      scheduledAssignments: mine.filter((row) => !row.removed_at && Date.parse(row.effective_at) > nowMs).length,
      recent: mine.slice(0, 8).map((row) => ({
        customer: userName.get(row.user_id)?.name || 'Account',
        date: displayDate(row.assigned_at),
        source: SOURCE_LABEL[row.source] || row.source,
        promotionStatus: row.removed_at ? 'Removed' : activeNow(row, nowMs) ? 'Active' : 'Expired',
        customerStatus: accountStatus(priced.get(row.user_id)),
      })),
    };
  });

  const campaignReports: CampaignReport[] = (campaigns.data ?? []).map((campaign) => {
    const partner = partnerById.get(campaign.partner_id);
    const linkedCodes = codes.filter((code) => code.campaignName === campaign.name).map((code) => code.publicCode).filter(Boolean);
    const promoIds = new Set(codes.filter((code) => code.campaignName === campaign.name).map((code) => code.id));
    const mine = rows.filter((row) => row.promotion_id && promoIds.has(row.promotion_id));
    const acquired = (acquisitions.data ?? []).filter((row) => row.campaign_id === campaign.id && inRange(row.acquired_at, start, end));
    return {
      id: campaign.id,
      name: campaign.name,
      partnerId: campaign.partner_id,
      partner: partner?.name || '—',
      platform: platformName.get(campaign.platform_code) || campaign.platform_code,
      codes: linkedCodes,
      start: displayDate(campaign.starts_on),
      end: displayDate(campaign.ends_on),
      status: titleStatus(campaign.status),
      redemptions: mine.length,
      newCustomers: acquired.length,
      payingCustomers: acquired.filter((row) => (priced.get(row.user_id)?.effectiveMonthlyCents ?? 0) > 0).length,
      conversionRate: '—',
      discountValue: 0,
      mrr: roundDollars(uniqueExpected(acquired.map((row) => row.user_id), priced)),
      lifetimeRevenue: 0,
      revenueSharePercent: '—',
      eligibleRevenue: 0,
      estimatedShare: 0,
      trend: weeklyTrend(mine.map((row) => row.assigned_at), now),
    };
  });

  const partnerReports: PartnerReport[] = (partners.data ?? []).map((partner) => {
    const partnerCampaigns = (campaigns.data ?? []).filter((campaign) => campaign.partner_id === partner.id);
    const campaignIds = new Set(partnerCampaigns.map((campaign) => campaign.id));
    const acquired = (acquisitions.data ?? []).filter((row) => (row.partner_id === partner.id || (row.campaign_id && campaignIds.has(row.campaign_id))) && inRange(row.acquired_at, start, end));
    const relatedCodes = codes.filter((code) => code.partnerName === partner.name || partnerCampaigns.some((campaign) => campaign.name === code.campaignName));
    const promoIds = new Set(relatedCodes.map((code) => code.id));
    const mine = rows.filter((row) => row.promotion_id && promoIds.has(row.promotion_id));
    return {
      id: partner.id,
      name: partner.name,
      notes: partner.notes || '',
      platforms: partnerCampaigns.map((campaign) => platformName.get(campaign.platform_code) || campaign.platform_code).filter((value, index, list) => list.indexOf(value) === index).join(', ') || '—',
      status: titleStatus(partner.status),
      revenueSharePercent: partner.revenue_share_percent == null ? '—' : `${partner.revenue_share_percent}%`,
      campaigns: partnerCampaigns.length,
      codes: relatedCodes.length,
      redemptions: mine.length,
      newCustomers: acquired.length,
      payingCustomers: acquired.filter((row) => (priced.get(row.user_id)?.effectiveMonthlyCents ?? 0) > 0).length,
      activeCustomers: new Set(mine.filter((row) => activeNow(row, nowMs)).map((row) => row.user_id)).size,
      mrr: roundDollars(uniqueExpected(acquired.map((row) => row.user_id), priced)),
      lifetimeRevenue: 0,
      discountValue: 0,
      eligibleRevenue: 0,
      estimatedShare: 0,
    };
  });

  const customers: AttributedCustomer[] = (acquisitions.data ?? [])
    .filter((row) => inRange(row.acquired_at, start, end))
    .map((row) => {
      const person = userName.get(row.user_id);
      const state = priced.get(row.user_id);
      const campaign = row.campaign_id ? campaignById.get(row.campaign_id) : null;
      const partner = partnerById.get(row.partner_id || campaign?.partner_id || '');
      const history = (assignments.data ?? []).filter((item) => item.user_id === row.user_id);
      return {
        id: row.user_id,
        name: person?.name || 'Account',
        email: person?.email || '',
        joined: displayDate(person?.joined || row.acquired_at),
        partner: partner?.name || '—',
        campaign: campaign?.name || '—',
        originalCode: row.public_code || '—',
        originalPromotion: history.find((item) => item.promotion_id === row.promotion_id)?.display_name || '—',
        currentPromotionStatus: history.some((item) => activeNow(item, nowMs)) ? 'Active' : 'Expired',
        accountStatus: accountStatus(state),
        activeTools: state?.activeToolCount ?? 0,
        monthlyCost: state ? `${formatCents(state.effectiveMonthlyCents)}/month` : '—',
        lifetimeRevenue: 0,
        activePromotions: state?.activePromotions.length ?? 0,
        lifetimeRedemptions: history.length,
        monthlyDiscount: state ? formatCents(state.discountValueCents) : '—',
        freeSlots: state ? String(state.freeSlots) : '—',
        bonusStorage: state && state.promotionalStorageBytes > 0 ? `${state.promotionalStorageBytes} bytes` : '—',
        historyCount: history.length,
      };
    });

  const activeAssignmentUsers = new Map<string, number>();
  for (const row of rows) {
    if (!activeNow(row, nowMs)) continue;
    activeAssignmentUsers.set(row.user_id, (activeAssignmentUsers.get(row.user_id) ?? 0) + 1);
  }
  const counts = [...activeAssignmentUsers.values()];
  const expectedCents = [...priced.values()].reduce((sum, state) => sum + state.effectiveMonthlyCents, 0);
  const discountCents = [...priced.values()].reduce((sum, state) => sum + state.discountValueCents, 0);

  return {
    promotions,
    campaigns: campaignReports,
    partners: partnerReports,
    customers,
    collectedRevenueAvailable: false,
    figures: {
      activeCodes: codes.filter((code) => getDisplayStatus(code) === 'active').length,
      usersWithDiscounts: activeAssignmentUsers.size,
      redemptions: rows.length,
      newCustomers: (acquisitions.data ?? []).filter((row) => inRange(row.acquired_at, start, end)).length,
      discountValue: roundDollars(discountCents),
      revenueAfterDiscounts: roundDollars(expectedCents),
      attributedMrr: roundDollars(uniqueExpected((acquisitions.data ?? []).map((row) => row.user_id), priced)),
      averageDiscounts: counts.length === 0 ? '0' : (counts.reduce((sum, count) => sum + count, 0) / counts.length).toFixed(1),
      usage: {
        one: counts.filter((count) => count === 1).length,
        two: counts.filter((count) => count >= 2).length,
        three: counts.filter((count) => count >= 3).length,
        five: counts.filter((count) => count >= 5).length,
        average: counts.length === 0 ? '0' : (counts.reduce((sum, count) => sum + count, 0) / counts.length).toFixed(1),
        maximum: counts.reduce((max, count) => Math.max(max, count), 0),
      },
      funnel: [
        { label: 'Assignments in range', value: rows.length },
        { label: 'Accounts with an active tool', value: [...priced.values()].filter((state) => state.activeToolCount > 0).length },
        { label: 'Expected monthly cost above $0', value: [...priced.values()].filter((state) => state.effectiveMonthlyCents > 0).length },
        { label: 'Collected payments', value: 'Not available' },
        { label: 'Expected MRR', value: formatCents(expectedCents) },
      ],
      benefitTypes: Object.values(BENEFIT_LABEL).map((type) => {
        const matching = promotions.filter((row) => row.benefitType === type);
        return {
          type,
          promotions: matching.filter((row) => row.status === 'Active').length,
          users: matching.reduce((sum, row) => sum + row.activeUsers, 0),
          redemptions: matching.reduce((sum, row) => sum + row.redemptions, 0),
          discountValue: 0,
        };
      }),
      sources: Object.entries(SOURCE_LABEL).map(([source, label]) => {
        const matching = rows.filter((row) => row.source === source);
        return {
          source: label,
          assignments: matching.length,
          active: matching.filter((row) => activeNow(row, nowMs)).length,
          expired: matching.filter((row) => !row.removed_at && row.expires_at && Date.parse(row.expires_at) <= nowMs).length,
          removed: matching.filter((row) => row.removed_at).length,
        };
      }),
      platforms: (platforms.data ?? []).map((platform) => {
        const relatedCampaigns = (campaigns.data ?? []).filter((campaign) => campaign.platform_code === platform.code).map((campaign) => campaign.id);
        const acquired = (acquisitions.data ?? []).filter((row) => row.campaign_id && relatedCampaigns.includes(row.campaign_id));
        return {
          platform: platform.name,
          customers: acquired.length,
          paying: 'Not available',
          conversion: '—',
          mrr: roundDollars(uniqueExpected(acquired.map((row) => row.user_id), priced)),
          lifetime: 0,
        };
      }),
      customers,
    },
  };
}

function titleStatus(value: string): string {
  if (!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function roundDollars(cents: number): number {
  return Math.round(cents) / 100;
}

function uniqueExpected(userIds: string[], priced: Map<string, { effectiveMonthlyCents: number }>): number {
  const seen = new Set<string>();
  let cents = 0;
  for (const id of userIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    cents += priced.get(id)?.effectiveMonthlyCents ?? 0;
  }
  return cents;
}

function accountStatus(state: { effectiveMonthlyCents: number; trialToolCount: number; activeToolCount: number; activePromotions: { length: number } } | undefined): AttributedCustomer['accountStatus'] {
  if (!state || state.activeToolCount === 0) return 'Inactive';
  if (state.effectiveMonthlyCents > 0) return 'Payment Required';
  if (state.trialToolCount > 0 && state.trialToolCount === state.activeToolCount) return 'Trial Only';
  if (state.activePromotions.length > 0) return 'Promotion-Covered';
  return 'Free User';
}

function weeklyTrend(dates: string[], now: Date): { label: string; redemptions: number }[] {
  return [3, 2, 1, 0].map((weeksAgo) => {
    const end = now.getTime() - weeksAgo * 7 * 24 * 60 * 60 * 1000;
    const start = end - 7 * 24 * 60 * 60 * 1000;
    return {
      label: `Wk ${4 - weeksAgo}`,
      redemptions: dates.filter((iso) => {
        const time = Date.parse(iso);
        return time >= start && time < end;
      }).length,
    };
  });
}
