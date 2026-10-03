/**
 * Sample promotion reporting figures.
 *
 * Changing the date range scales these samples so the screens can be reviewed.
 * Nothing here is queried, billed, or paid out.
 */
export const REPORT_RANGES = [
  { id: '7', label: 'Last 7 Days' },
  { id: '30', label: 'Last 30 Days' },
  { id: '90', label: 'Last 90 Days' },
  { id: 'this-month', label: 'This Month' },
  { id: 'last-month', label: 'Last Month' },
  { id: 'year', label: 'This Year' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom Range' },
  { id: 'none', label: 'No activity' },
] as const;

export type ReportRangeId = (typeof REPORT_RANGES)[number]['id'];

export const METRIC_HELP = {
  discountValue: 'Estimated amount customers did not pay because of promotions. A later pricing pass should supply this. It is not calculated here.',
  attributedMrr: 'Current recurring revenue from customers originally acquired through the promotion or campaign. Sample only.',
  conversionRate: 'Paying customers divided by unique customers acquired through the promotion.',
  revenueShare: 'Estimated partner share based on attributed eligible revenue. Not paid.',
  mrr: 'Monthly recurring revenue customers are expected to pay. Sample only. Later this should be separate from Stripe’s collected amounts.',
  lifetimeRevenue: 'Sample revenue tied to customers acquired through a promotion, campaign, or partner. It stays with the original acquisition after the code expires.',
} as const;

export type CustomerReportStatus = 'Free User' | 'Trial Only' | 'Paying Customer' | 'Promotion-Covered' | 'Payment Required' | 'Inactive';

export type PromotionReportRow = {
  id: string;
  name: string;
  code: string;
  benefitType: string;
  benefit: string;
  status: string;
  campaign: string;
  partner: string;
  platform: string;
  redemptions: number;
  activeUsers: number;
  payingUsers: number;
  conversionRate: string;
  discountValue: number;
  mrr: number;
  lifetimeRevenue: number;
  averageRevenue: string;
  revenueSharePercent: string;
  start: string;
  end: string;
  duration: string;
  eligibility: string;
  stackable: string;
  repeatable: string;
  expiredCustomers: number;
  removedAssignments: number;
  scheduledAssignments: number;
  recent?: { customer: string; date: string; source: string; promotionStatus: string; customerStatus: string }[];
};

export type CampaignReport = {
  id: string;
  name: string;
  partnerId: string;
  partner: string;
  platform: string;
  codes: string[];
  start: string;
  end: string;
  status: string;
  redemptions: number;
  newCustomers: number;
  payingCustomers: number;
  conversionRate: string;
  discountValue: number;
  mrr: number;
  lifetimeRevenue: number;
  revenueSharePercent: string;
  eligibleRevenue: number;
  estimatedShare: number;
  trend: { label: string; redemptions: number }[];
};

export type PartnerReport = {
  id: string;
  name: string;
  notes: string;
  platforms: string;
  status: string;
  revenueSharePercent: string;
  campaigns: number;
  codes: number;
  redemptions: number;
  newCustomers: number;
  payingCustomers: number;
  activeCustomers: number;
  mrr: number;
  lifetimeRevenue: number;
  discountValue: number;
  eligibleRevenue: number;
  estimatedShare: number;
};

export type AttributedCustomer = {
  id: string;
  name: string;
  email: string;
  joined: string;
  partner: string;
  campaign: string;
  originalCode: string;
  originalPromotion: string;
  currentPromotionStatus: string;
  accountStatus: CustomerReportStatus;
  activeTools: number;
  monthlyCost: string;
  lifetimeRevenue: number;
  activePromotions: number;
  lifetimeRedemptions: number;
  monthlyDiscount: string;
  freeSlots: string;
  bonusStorage: string;
  historyCount: number;
};

const RANGE_SCALE: Record<string, number> = {
  '7': 0.28,
  '30': 1,
  '90': 2.6,
  'this-month': 0.84,
  'last-month': 0.91,
  year: 7.2,
  all: 11,
  none: 0,
};

export function rangeScale(rangeId: string, customStart = '', customEnd = ''): number {
  if (rangeId === 'none') return 0;
  if (rangeId !== 'custom') return RANGE_SCALE[rangeId] ?? 1;
  if (!customStart || !customEnd || customEnd < customStart) return 1;
  const start = Date.parse(`${customStart}T12:00:00`);
  const end = Date.parse(`${customEnd}T12:00:00`);
  const days = Math.round((end - start) / 86_400_000) + 1;
  return Math.min(11, Math.max(0.2, days / 30));
}

function count(base: number, scale: number): number {
  return Math.round(base * scale);
}

function money(base: number, scale: number): number {
  return Math.round(base * scale);
}

const PROMOTION_BASE: PromotionReportRow[] = [
  { id: 'new-user-2', name: 'New User — 2 Free Tools', code: 'NEWUSER2', benefitType: 'Free Tool Slots', benefit: '2 free tool slots', status: 'Active', campaign: 'Default new user benefit', partner: '—', platform: '—', redemptions: 42, activeUsers: 40, payingUsers: 6, conversionRate: '15%', discountValue: 168, mrr: 48, lifetimeRevenue: 96, averageRevenue: '$16', revenueSharePercent: '—', start: '03/17/2026', end: '—', duration: 'Lifetime', eligibility: 'New personal accounts', stackable: 'Yes', repeatable: 'Once per user', expiredCustomers: 1, removedAssignments: 1, scheduledAssignments: 0 },
  { id: 'launch-90', name: 'Launch — 90 Days Free', code: 'LAUNCH90', benefitType: '100% Off', benefit: '100% off for 90 days', status: 'Active', campaign: 'Launch', partner: '—', platform: 'Email', redemptions: 28, activeUsers: 22, payingUsers: 9, conversionRate: '32%', discountValue: 180, mrr: 144, lifetimeRevenue: 210, averageRevenue: '$23', revenueSharePercent: '—', start: '08/24/2026', end: '12/22/2026', duration: '90 days', eligibility: 'Everyone', stackable: 'Yes', repeatable: 'Once per user', expiredCustomers: 4, removedAssignments: 0, scheduledAssignments: 0 },
  { id: 'home-free', name: 'Home Maintenance Free Year', code: 'HOMEFREE', benefitType: 'Specific Tool Free', benefit: 'Home Maintenance Schedule free', status: 'Active', campaign: 'Home maintenance', partner: '—', platform: '—', redemptions: 16, activeUsers: 14, payingUsers: 8, conversionRate: '50%', discountValue: 32, mrr: 96, lifetimeRevenue: 140, averageRevenue: '$18', revenueSharePercent: '—', start: '07/05/2026', end: '01/01/2027', duration: '12 months', eligibility: 'Everyone', stackable: 'Yes', repeatable: 'Once per user', expiredCustomers: 1, removedAssignments: 1, scheduledAssignments: 0 },
  { id: 'tiktok-25', name: 'Creator — 25% for 6 Months', code: 'TIKTOK25', benefitType: 'Percentage Off', benefit: '25% off for 6 months', status: 'Active', campaign: 'TikTok Spring Launch', partner: 'Alex Home Tips', platform: 'TikTok', redemptions: 19, activeUsers: 11, payingUsers: 7, conversionRate: '37%', discountValue: 28, mrr: 84, lifetimeRevenue: 160, averageRevenue: '$23', revenueSharePercent: '10%', start: '09/13/2026', end: '11/12/2026', duration: '6 months', eligibility: 'Everyone', stackable: 'Yes', repeatable: 'Once per user', expiredCustomers: 6, removedAssignments: 0, scheduledAssignments: 0 },
  { id: 'bonus-3', name: 'Bonus 3 Tool Slots', code: 'BONUS3', benefitType: 'Free Tool Slots', benefit: '+3 free tool slots', status: 'Active', campaign: 'Summer Organization Series', partner: 'Alex Home Tips', platform: 'TikTok', redemptions: 8, activeUsers: 7, payingUsers: 2, conversionRate: '25%', discountValue: 48, mrr: 16, lifetimeRevenue: 24, averageRevenue: '$12', revenueSharePercent: '10%', start: '09/18/2026', end: '01/31/2027', duration: '6 months', eligibility: 'Existing users', stackable: 'Yes', repeatable: 'Once per user', expiredCustomers: 0, removedAssignments: 1, scheduledAssignments: 0 },
  { id: 'spring-5', name: 'Spring $5 Monthly Credit', code: 'SPRING5', benefitType: 'Fixed Dollar Off', benefit: '$5 off per month', status: 'Scheduled', campaign: 'Spring credit', partner: '—', platform: 'Email', redemptions: 0, activeUsers: 0, payingUsers: 0, conversionRate: '—', discountValue: 0, mrr: 0, lifetimeRevenue: 0, averageRevenue: '—', revenueSharePercent: '—', start: '11/02/2026', end: '05/02/2027', duration: '6 months', eligibility: 'Everyone', stackable: 'Yes', repeatable: 'Once per user', expiredCustomers: 0, removedAssignments: 0, scheduledAssignments: 4 },
  { id: 'alex-25', name: 'Alex 25% Off', code: 'ALEX25', benefitType: 'Percentage Off', benefit: '25% off for 6 months', status: 'Expired', campaign: 'TikTok Spring Launch', partner: 'Alex Home Tips', platform: 'TikTok', redemptions: 24, activeUsers: 4, payingUsers: 11, conversionRate: '46%', discountValue: 36, mrr: 132, lifetimeRevenue: 420, averageRevenue: '$38', revenueSharePercent: '10%', start: '03/01/2026', end: '06/01/2026', duration: '6 months', eligibility: 'Everyone', stackable: 'Yes', repeatable: 'Once per user', expiredCustomers: 18, removedAssignments: 2, scheduledAssignments: 0 },
  { id: 'alex-free', name: 'Alex Free Month', code: 'ALEXFREE', benefitType: '100% Off', benefit: '100% off for 30 days', status: 'Active', campaign: 'TikTok Spring Launch', partner: 'Alex Home Tips', platform: 'TikTok', redemptions: 11, activeUsers: 6, payingUsers: 3, conversionRate: '27%', discountValue: 22, mrr: 36, lifetimeRevenue: 54, averageRevenue: '$18', revenueSharePercent: '10%', start: '09/01/2026', end: '12/01/2026', duration: '30 days', eligibility: 'New users', stackable: 'Yes', repeatable: 'Once per user', expiredCustomers: 3, removedAssignments: 0, scheduledAssignments: 0 },
  { id: 'news-20', name: 'Newsletter 20% Off', code: 'NEWS20', benefitType: 'Percentage Off', benefit: '20% off for 3 months', status: 'Active', campaign: 'Newsletter Welcome', partner: 'HomeBase Newsletter', platform: 'Email', redemptions: 17, activeUsers: 12, payingUsers: 5, conversionRate: '33%', discountValue: 40, mrr: 60, lifetimeRevenue: 110, averageRevenue: '$22', revenueSharePercent: '—', start: '01/15/2026', end: '12/31/2026', duration: '3 months', eligibility: 'Everyone', stackable: 'Yes', repeatable: 'Once per user', expiredCustomers: 3, removedAssignments: 0, scheduledAssignments: 0 },
  { id: 'reset-10', name: 'Holiday Reset 10% Off', code: 'RESET10', benefitType: 'Percentage Off', benefit: '10% off for 60 days', status: 'Scheduled', campaign: 'Holiday Home Reset', partner: 'Organized Living MN', platform: 'Instagram', redemptions: 0, activeUsers: 0, payingUsers: 0, conversionRate: '—', discountValue: 0, mrr: 0, lifetimeRevenue: 0, averageRevenue: '—', revenueSharePercent: '15%', start: '11/01/2026', end: '01/15/2027', duration: '60 days', eligibility: 'Everyone', stackable: 'Yes', repeatable: 'Once per user', expiredCustomers: 0, removedAssignments: 0, scheduledAssignments: 0 },
  { id: 'neighbor', name: 'Neighbor Referral', code: 'NEIGHBOR', benefitType: 'Fixed Dollar Off', benefit: '$3 off per month', status: 'Active', campaign: 'Neighbor Referral', partner: 'Local Partner Referral', platform: 'Referral', redemptions: 9, activeUsers: 6, payingUsers: 4, conversionRate: '44%', discountValue: 18, mrr: 48, lifetimeRevenue: 72, averageRevenue: '$18', revenueSharePercent: '5%', start: '02/01/2026', end: '—', duration: '6 months', eligibility: 'New users', stackable: 'Yes', repeatable: 'Once per user', expiredCustomers: 2, removedAssignments: 1, scheduledAssignments: 0 },
  { id: 'storage-5', name: 'Bonus 5 GB', code: 'STORAGE5', benefitType: 'Bonus Storage', benefit: '+5 GB', status: 'Expired', campaign: '—', partner: '—', platform: '—', redemptions: 9, activeUsers: 0, payingUsers: 2, conversionRate: '22%', discountValue: 0, mrr: 16, lifetimeRevenue: 28, averageRevenue: '$14', revenueSharePercent: '—', start: '01/01/2026', end: '07/01/2026', duration: '6 months', eligibility: 'Everyone', stackable: 'Yes', repeatable: 'Once per user', expiredCustomers: 9, removedAssignments: 0, scheduledAssignments: 0 },
];

export function promotionRows(scale: number): PromotionReportRow[] {
  return PROMOTION_BASE.map((row) => ({
    ...row,
    redemptions: count(row.redemptions, scale),
    activeUsers: count(row.activeUsers, scale),
    payingUsers: count(row.payingUsers, scale),
    discountValue: money(row.discountValue, scale),
    mrr: money(row.mrr, scale),
    lifetimeRevenue: money(row.lifetimeRevenue, scale),
    expiredCustomers: count(row.expiredCustomers, scale),
    removedAssignments: count(row.removedAssignments, scale),
    scheduledAssignments: count(row.scheduledAssignments, scale),
  }));
}

const CAMPAIGN_BASE: CampaignReport[] = [
  { id: 'tiktok-spring', name: 'TikTok Spring Launch', partnerId: 'alex', partner: 'Alex Home Tips', platform: 'TikTok', codes: ['ALEX25', 'ALEXFREE', 'TIKTOK25'], start: '03/01/2026', end: '06/30/2026', status: 'Active', redemptions: 54, newCustomers: 41, payingCustomers: 21, conversionRate: '51%', discountValue: 86, mrr: 252, lifetimeRevenue: 634, revenueSharePercent: '10%', eligibleRevenue: 634, estimatedShare: 63, trend: [{ label: 'Wk 1', redemptions: 8 }, { label: 'Wk 2', redemptions: 14 }, { label: 'Wk 3', redemptions: 11 }, { label: 'Wk 4', redemptions: 21 }] },
  { id: 'summer-org', name: 'Summer Organization Series', partnerId: 'alex', partner: 'Alex Home Tips', platform: 'TikTok', codes: ['BONUS3'], start: '06/01/2026', end: '08/31/2026', status: 'Ended', redemptions: 8, newCustomers: 6, payingCustomers: 2, conversionRate: '33%', discountValue: 48, mrr: 16, lifetimeRevenue: 24, revenueSharePercent: '10%', eligibleRevenue: 24, estimatedShare: 2, trend: [{ label: 'Wk 1', redemptions: 1 }, { label: 'Wk 2', redemptions: 3 }, { label: 'Wk 3', redemptions: 2 }, { label: 'Wk 4', redemptions: 2 }] },
  { id: 'holiday-reset', name: 'Holiday Home Reset', partnerId: 'organized', partner: 'Organized Living MN', platform: 'Instagram', codes: ['RESET10'], start: '11/01/2026', end: '01/15/2027', status: 'Scheduled', redemptions: 0, newCustomers: 0, payingCustomers: 0, conversionRate: '—', discountValue: 0, mrr: 0, lifetimeRevenue: 0, revenueSharePercent: '15%', eligibleRevenue: 0, estimatedShare: 0, trend: [{ label: 'Wk 1', redemptions: 0 }, { label: 'Wk 2', redemptions: 0 }, { label: 'Wk 3', redemptions: 0 }, { label: 'Wk 4', redemptions: 0 }] },
  { id: 'newsletter', name: 'Newsletter Welcome', partnerId: 'homebase', partner: 'HomeBase Newsletter', platform: 'Email', codes: ['NEWS20'], start: '01/15/2026', end: '12/31/2026', status: 'Active', redemptions: 17, newCustomers: 15, payingCustomers: 5, conversionRate: '33%', discountValue: 40, mrr: 60, lifetimeRevenue: 110, revenueSharePercent: '—', eligibleRevenue: 0, estimatedShare: 0, trend: [{ label: 'Wk 1', redemptions: 3 }, { label: 'Wk 2', redemptions: 5 }, { label: 'Wk 3', redemptions: 4 }, { label: 'Wk 4', redemptions: 5 }] },
  { id: 'neighbor', name: 'Neighbor Referral', partnerId: 'local', partner: 'Local Partner Referral', platform: 'Referral', codes: ['NEIGHBOR'], start: '02/01/2026', end: '—', status: 'Active', redemptions: 9, newCustomers: 9, payingCustomers: 4, conversionRate: '44%', discountValue: 18, mrr: 48, lifetimeRevenue: 72, revenueSharePercent: '5%', eligibleRevenue: 72, estimatedShare: 4, trend: [{ label: 'Wk 1', redemptions: 2 }, { label: 'Wk 2', redemptions: 1 }, { label: 'Wk 3', redemptions: 4 }, { label: 'Wk 4', redemptions: 2 }] },
];

export function campaignRows(scale: number): CampaignReport[] {
  return CAMPAIGN_BASE.map((row) => ({
    ...row,
    redemptions: count(row.redemptions, scale),
    newCustomers: count(row.newCustomers, scale),
    payingCustomers: count(row.payingCustomers, scale),
    discountValue: money(row.discountValue, scale),
    mrr: money(row.mrr, scale),
    lifetimeRevenue: money(row.lifetimeRevenue, scale),
    eligibleRevenue: money(row.eligibleRevenue, scale),
    estimatedShare: money(row.estimatedShare, scale),
    trend: row.trend.map((point) => ({ ...point, redemptions: count(point.redemptions, scale) })),
  }));
}

const PARTNER_BASE: PartnerReport[] = [
  { id: 'alex', name: 'Alex Home Tips', notes: 'Home-organization videos. Share applies to attributed paying customers.', platforms: 'TikTok', status: 'Active', revenueSharePercent: '10%', campaigns: 2, codes: 3, redemptions: 62, newCustomers: 47, payingCustomers: 23, activeCustomers: 31, mrr: 268, lifetimeRevenue: 658, discountValue: 134, eligibleRevenue: 658, estimatedShare: 66 },
  { id: 'organized', name: 'Organized Living MN', notes: 'Local Instagram account. Campaign has not started.', platforms: 'Instagram', status: 'Active', revenueSharePercent: '15%', campaigns: 1, codes: 1, redemptions: 0, newCustomers: 0, payingCustomers: 0, activeCustomers: 0, mrr: 0, lifetimeRevenue: 0, discountValue: 0, eligibleRevenue: 0, estimatedShare: 0 },
  { id: 'homebase', name: 'HomeBase Newsletter', notes: 'Email list. No revenue share.', platforms: 'Email', status: 'Active', revenueSharePercent: '—', campaigns: 1, codes: 1, redemptions: 17, newCustomers: 15, payingCustomers: 5, activeCustomers: 12, mrr: 60, lifetimeRevenue: 110, discountValue: 40, eligibleRevenue: 0, estimatedShare: 0 },
  { id: 'local', name: 'Local Partner Referral', notes: 'In-person referrals.', platforms: 'Referral', status: 'Inactive', revenueSharePercent: '5%', campaigns: 1, codes: 1, redemptions: 9, newCustomers: 9, payingCustomers: 4, activeCustomers: 6, mrr: 48, lifetimeRevenue: 72, discountValue: 18, eligibleRevenue: 72, estimatedShare: 4 },
];

export function partnerRows(scale: number): PartnerReport[] {
  return PARTNER_BASE.map((row) => ({
    ...row,
    redemptions: count(row.redemptions, scale),
    newCustomers: count(row.newCustomers, scale),
    payingCustomers: count(row.payingCustomers, scale),
    activeCustomers: count(row.activeCustomers, scale),
    mrr: money(row.mrr, scale),
    lifetimeRevenue: money(row.lifetimeRevenue, scale),
    discountValue: money(row.discountValue, scale),
    eligibleRevenue: money(row.eligibleRevenue, scale),
    estimatedShare: money(row.estimatedShare, scale),
  }));
}

const CUSTOMER_BASE: AttributedCustomer[] = [
  { id: 'report-sample-user', name: 'Sample User', email: 'sample.user@example.com', joined: '04/02/2026', partner: 'Alex Home Tips', campaign: 'TikTok Spring Launch', originalCode: 'ALEX25', originalPromotion: 'Alex 25% Off', currentPromotionStatus: 'Expired', accountStatus: 'Paying Customer', activeTools: 3, monthlyCost: '$2/month', lifetimeRevenue: 42, activePromotions: 0, lifetimeRedemptions: 1, monthlyDiscount: '$0', freeSlots: '2 lifetime', bonusStorage: '—', historyCount: 1 },
  { id: 'report-avery', name: 'Avery Chen', email: 'avery@example.com', joined: '09/12/2026', partner: '—', campaign: 'Launch', originalCode: 'LAUNCH90', originalPromotion: 'Launch — 90 Days Free', currentPromotionStatus: 'Active', accountStatus: 'Promotion-Covered', activeTools: 4, monthlyCost: '$0/month', lifetimeRevenue: 0, activePromotions: 3, lifetimeRedemptions: 4, monthlyDiscount: '$8', freeSlots: '2 lifetime', bonusStorage: '+5 GB', historyCount: 5 },
  { id: 'report-jordan', name: 'Jordan Blake', email: 'jordan@example.com', joined: '09/20/2026', partner: 'Alex Home Tips', campaign: 'TikTok Spring Launch', originalCode: 'ALEXFREE', originalPromotion: 'Alex Free Month', currentPromotionStatus: 'Active', accountStatus: 'Trial Only', activeTools: 3, monthlyCost: '$0/month', lifetimeRevenue: 0, activePromotions: 2, lifetimeRedemptions: 2, monthlyDiscount: '$4', freeSlots: '2 lifetime', bonusStorage: '—', historyCount: 2 },
  { id: 'report-sam', name: 'Sam Rivera', email: 'sam@example.com', joined: '08/01/2026', partner: 'HomeBase Newsletter', campaign: 'Newsletter Welcome', originalCode: 'NEWS20', originalPromotion: 'Newsletter 20% Off', currentPromotionStatus: 'Active', accountStatus: 'Paying Customer', activeTools: 5, monthlyCost: '$6/month', lifetimeRevenue: 18, activePromotions: 5, lifetimeRedemptions: 6, monthlyDiscount: '$10', freeSlots: '5 until 10/17/2026', bonusStorage: '—', historyCount: 6 },
  { id: 'report-morgan', name: 'Morgan Lee', email: 'morgan@example.com', joined: '05/18/2026', partner: 'Local Partner Referral', campaign: 'Neighbor Referral', originalCode: 'NEIGHBOR', originalPromotion: 'Neighbor Referral', currentPromotionStatus: 'Removed', accountStatus: 'Payment Required', activeTools: 3, monthlyCost: '$2/month', lifetimeRevenue: 8, activePromotions: 1, lifetimeRedemptions: 2, monthlyDiscount: '$0', freeSlots: '2 lifetime', bonusStorage: '—', historyCount: 2 },
  { id: 'report-casey', name: 'Casey Nguyen', email: 'casey@example.com', joined: '01/09/2026', partner: '—', campaign: 'Default new user benefit', originalCode: 'NEWUSER2', originalPromotion: 'New User — 2 Free Tools', currentPromotionStatus: 'Active', accountStatus: 'Free User', activeTools: 2, monthlyCost: '$0/month', lifetimeRevenue: 0, activePromotions: 1, lifetimeRedemptions: 1, monthlyDiscount: '$4', freeSlots: '2 lifetime', bonusStorage: '—', historyCount: 1 },
  { id: 'report-riley', name: 'Riley Patel', email: 'riley@example.com', joined: '07/22/2026', partner: 'Alex Home Tips', campaign: 'Summer Organization Series', originalCode: 'BONUS3', originalPromotion: 'Bonus 3 Tool Slots', currentPromotionStatus: 'Expired', accountStatus: 'Inactive', activeTools: 0, monthlyCost: '$0/month', lifetimeRevenue: 12, activePromotions: 0, lifetimeRedemptions: 1, monthlyDiscount: '$0', freeSlots: '2 lifetime', bonusStorage: '—', historyCount: 1 },
];

export function customerRows(scale: number): AttributedCustomer[] {
  if (scale === 0) return [];
  return CUSTOMER_BASE.map((row) => ({
    ...row,
    lifetimeRevenue: money(row.lifetimeRevenue, scale),
    lifetimeRedemptions: Math.max(row.lifetimeRedemptions, count(row.lifetimeRedemptions, scale)),
  }));
}

export function overviewFigures(scale: number) {
  const promotions = promotionRows(scale);
  const customers = customerRows(scale);
  const activeCodes = promotions.filter((row) => row.status === 'Active').length;
  const redemptions = promotions.reduce((sum, row) => sum + row.redemptions, 0);
  return {
    activeCodes,
    usersWithDiscounts: count(86, scale),
    redemptions,
    newCustomers: count(48, scale),
    discountValue: money(428, scale),
    revenueAfterDiscounts: money(1842, scale),
    attributedMrr: money(620, scale),
    averageDiscounts: scale === 0 ? '0' : '1.4',
    usage: {
      one: count(62, scale),
      two: count(18, scale),
      three: count(5, scale),
      five: count(1, scale),
      average: scale === 0 ? '0' : '1.4',
      maximum: scale === 0 ? 0 : 5,
    },
    funnel: [
      { label: 'Code redemptions', value: count(1000, scale) },
      { label: 'Activated a tool', value: count(780, scale) },
      { label: 'Still active after 30 days', value: count(520, scale) },
      { label: 'Became paying customers', value: count(310, scale) },
      { label: 'Current MRR', value: `$${money(620, scale).toLocaleString('en-US')}` },
    ],
    benefitTypes: ['Free Tool Slots', 'Specific Tool Free', '100% Off', 'Percentage Off', 'Fixed Dollar Off', 'Bonus Storage'].map((type) => {
      const rows = promotions.filter((row) => row.benefitType === type);
      return {
        type,
        promotions: rows.filter((row) => row.status === 'Active').length,
        users: rows.reduce((sum, row) => sum + row.activeUsers, 0),
        redemptions: rows.reduce((sum, row) => sum + row.redemptions, 0),
        discountValue: rows.reduce((sum, row) => sum + row.discountValue, 0),
      };
    }),
    sources: [
      { source: 'User Entered Code', assignments: count(70, scale), active: count(41, scale), expired: count(22, scale), removed: count(7, scale) },
      { source: 'Automatically Assigned', assignments: count(42, scale), active: count(40, scale), expired: count(1, scale), removed: count(1, scale) },
      { source: 'Superadmin Assigned', assignments: count(12, scale), active: count(9, scale), expired: count(1, scale), removed: count(2, scale) },
      { source: 'Manual Entitlement', assignments: count(8, scale), active: count(5, scale), expired: count(1, scale), removed: count(2, scale) },
    ],
    platforms: [
      { platform: 'TikTok', customers: count(47, scale), paying: count(23, scale), conversion: '49%', mrr: money(268, scale), lifetime: money(658, scale) },
      { platform: 'Instagram', customers: count(0, scale), paying: count(0, scale), conversion: '—', mrr: 0, lifetime: 0 },
      { platform: 'YouTube', customers: count(0, scale), paying: count(0, scale), conversion: '—', mrr: 0, lifetime: 0 },
      { platform: 'Email', customers: count(31, scale), paying: count(11, scale), conversion: '35%', mrr: money(120, scale), lifetime: money(210, scale) },
      { platform: 'Referral', customers: count(9, scale), paying: count(4, scale), conversion: '44%', mrr: money(48, scale), lifetime: money(72, scale) },
      { platform: 'Facebook', customers: count(0, scale), paying: count(0, scale), conversion: '—', mrr: 0, lifetime: 0 },
      { platform: 'Other', customers: count(0, scale), paying: count(0, scale), conversion: '—', mrr: 0, lifetime: 0 },
    ],
    customers,
  };
}

export function recentRedemptions(code: string, scale: number) {
  const samples = [
    { customer: 'Avery Chen', date: '09/28/2026', source: 'User Entered Code', promotionStatus: 'Active', customerStatus: 'Promotion-Covered' },
    { customer: 'Jordan Blake', date: '09/21/2026', source: 'User Entered Code', promotionStatus: 'Active', customerStatus: 'Trial Only' },
    { customer: 'Sample User', date: '04/02/2026', source: 'User Entered Code', promotionStatus: 'Expired', customerStatus: 'Paying Customer' },
    { customer: 'Casey Nguyen', date: '01/09/2026', source: 'Automatically Assigned', promotionStatus: 'Active', customerStatus: 'Free User' },
  ];
  if (scale === 0 || code === 'SPRING5') return [];
  return samples.slice(0, code === 'ALEX25' ? 3 : 2);
}
