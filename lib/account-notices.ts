/**
 * Sample account notices for the Plan & Billing preview.
 *
 * UI copy only. Nothing here is emailed, scheduled, or stored as a real notice.
 * Each notice id is the one event key for that moment, so the list does not
 * grow again when the page reloads.
 */
export type NoticeSeverity = 'info' | 'attention' | 'action';

export const NOTICE_SEVERITY_LABELS: Record<NoticeSeverity, string> = {
  info: 'Information',
  attention: 'Heads up',
  action: 'Action needed',
};

export type NoticeKind =
  | 'trial_ending'
  | 'trial_ended'
  | 'promotion_expiring'
  | 'promotion_expired'
  | 'cost_changing'
  | 'payment_required'
  | 'access_changed'
  | 'storage_expiring';

export type AccountNotice = {
  id: string;
  severity: NoticeSeverity;
  kind: NoticeKind;
  title: string;
  body: string;
  when: string;
  cta: string | null;
  href: string | null;
};

export type NoticeEmail = {
  id: string;
  subject: string;
  paragraphs: string[];
  figures: { label: string; value: string }[];
  cta: string;
};

/** Values a later pricing pass can fill. This preview does not calculate them. */
export type NoticeProjection = {
  currentMonthlyCost: string;
  projectedMonthlyCost: string | null;
  increase: string | null;
  effectiveDate: string | null;
  paymentRequired: boolean;
  coverageNote: string;
  storageUsed: string | null;
  storageAllowanceAfter: string | null;
};

export type ToolNoticeRow = {
  name: string;
  status: string;
  detail: string;
};

export type NoticeMoment = {
  id: string;
  group: string;
  label: string;
  summary: string;
  banner: { severity: NoticeSeverity; title: string; body: string } | null;
  notices: AccountNotice[];
  tools: ToolNoticeRow[];
  projection: NoticeProjection | null;
  emails: NoticeEmail[];
  paymentRequired: boolean;
};

const plan = '/dashboard/plan';
const tools = '/dashboard/my-tools';

function email(id: string, subject: string, paragraphs: string[], figures: NoticeEmail['figures'], cta: string): NoticeEmail {
  return { id, subject, paragraphs, figures, cta };
}

export const NOTICE_MOMENTS: NoticeMoment[] = [
  {
    id: 'trial-day-1',
    group: 'Trial',
    label: 'Day 1 — trial starts',
    summary: 'Cleaning Schedule just started its one-time 7-day trial. There is no urgent notice and no request for a payment method.',
    banner: null,
    notices: [],
    tools: [
      { name: 'Cleaning Schedule', status: '7-Day Free Trial', detail: 'Ends 10/10/2026. Full access. No payment information is required.' },
    ],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: null,
      increase: null,
      effectiveDate: '10/10/2026',
      paymentRequired: false,
      coverageNote: 'The account is checked again when the trial ends. A price is not projected on day 1.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [],
    paymentRequired: false,
  },
  {
    id: 'trial-day-5',
    group: 'Trial',
    label: '2 days remaining',
    summary: 'This is the notice for two days before Cleaning Schedule’s trial ends. It names that tool and does not say a charge will happen.',
    banner: {
      severity: 'attention',
      title: 'Your Cleaning Schedule trial ends in 2 days',
      body: 'Your free trial ends on 10/10/2026. If Cleaning Schedule is not covered by one of your free-tool benefits after the trial, it will cost $2/month to continue. No payment information is required during your trial.',
    },
    notices: [
      {
        id: 'trial-ending:cleaning-schedule:2026-10-10',
        severity: 'attention',
        kind: 'trial_ending',
        title: 'Your Cleaning Schedule trial ends in 2 days',
        body: 'Your free trial ends on 10/10/2026. If Cleaning Schedule is not covered by one of your free-tool benefits after the trial, it will cost $2/month to continue. No payment information is required during your trial.',
        when: '10/08/2026 · 9:00 AM',
        cta: 'View Plan & Billing',
        href: plan,
      },
    ],
    tools: [
      { name: 'Cleaning Schedule', status: 'Free Trial — 2 Days Remaining', detail: 'Ends 10/10/2026. Full access through the trial.' },
    ],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: null,
      increase: null,
      effectiveDate: '10/10/2026',
      paymentRequired: false,
      coverageNote: 'A new monthly cost is not shown yet. Free slots and promotions are checked when the trial ends.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [
      email(
        'email-trial-2-days',
        'Your Cleaning Schedule trial ends in 2 days',
        [
          'Your free trial for Cleaning Schedule ends on 10/10/2026.',
          'If Cleaning Schedule is not covered by one of your free-tool benefits after the trial, it will cost $2/month to continue.',
          'No payment information is required during your trial. Your records stay in the tool.',
        ],
        [],
        'View Plan & Billing',
      ),
    ],
    paymentRequired: false,
  },
  {
    id: 'trial-day-7',
    group: 'Trial',
    label: 'Ends today',
    summary: 'Cleaning Schedule’s trial ends today. Access continues through the end of the trial. The account is checked after that.',
    banner: {
      severity: 'attention',
      title: 'Your Cleaning Schedule trial ends today',
      body: 'You’ll continue to have full access through the end of your trial. After the trial, Household Toolbox will check your free-tool benefits and active promotions. If Cleaning Schedule is not covered, it will cost $2/month to continue.',
    },
    notices: [
      {
        id: 'trial-ending-today:cleaning-schedule:2026-10-10',
        severity: 'attention',
        kind: 'trial_ending',
        title: 'Your Cleaning Schedule trial ends today',
        body: 'You’ll continue to have full access through the end of your trial. After the trial, Household Toolbox will check your free-tool benefits and active promotions. If Cleaning Schedule is not covered, it will cost $2/month to continue.',
        when: '10/10/2026 · 8:00 AM',
        cta: 'View Plan & Billing',
        href: plan,
      },
    ],
    tools: [
      { name: 'Cleaning Schedule', status: 'Trial Ends Today', detail: 'Full access through the end of today. No payment information is required during the trial.' },
    ],
    projection: null,
    emails: [],
    paymentRequired: false,
  },
  {
    id: 'day-8-free-slot',
    group: 'Trial',
    label: 'Day 8 — now included',
    summary: 'The trial ended and an open free-tool slot covers Cleaning Schedule. This is information, not a warning.',
    banner: {
      severity: 'info',
      title: 'Cleaning Schedule is now included with your account',
      body: 'Your free trial has ended, but Cleaning Schedule is now covered by one of your free-tool slots. Your monthly cost remains $0. No payment information is required.',
    },
    notices: [
      {
        id: 'trial-ended:cleaning-schedule:covered-slot',
        severity: 'info',
        kind: 'access_changed',
        title: 'Cleaning Schedule is now included with your account',
        body: 'Your free trial has ended, but Cleaning Schedule is now covered by one of your free-tool slots. Your monthly cost remains $0. No payment information is required.',
        when: '10/11/2026 · 8:00 AM',
        cta: 'View Plan & Billing',
        href: plan,
      },
    ],
    tools: [
      { name: 'Cleaning Schedule', status: 'Included', detail: 'Trial ended. Covered by a free tool slot. Records are still saved.' },
    ],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: '$0/month',
      increase: '$0/month',
      effectiveDate: '10/11/2026',
      paymentRequired: false,
      coverageNote: 'Covered by a free tool slot.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [],
    paymentRequired: false,
  },
  {
    id: 'day-8-specific-promo',
    group: 'Trial',
    label: 'Day 8 — HOMEFREE covers it',
    summary: 'The trial ended and HOMEFREE still covers the tool. No payment information is required.',
    banner: {
      severity: 'info',
      title: 'Home Maintenance Schedule remains free',
      body: 'Your free trial has ended, but this tool is covered by your HOMEFREE promotion through 09/03/2027. No payment information is required.',
    },
    notices: [
      {
        id: 'trial-ended:home-maintenance:homefree',
        severity: 'info',
        kind: 'trial_ended',
        title: 'Home Maintenance Schedule remains free',
        body: 'Your free trial has ended, but this tool is covered by your HOMEFREE promotion through 09/03/2027. No payment information is required.',
        when: '10/11/2026 · 8:00 AM',
        cta: 'View Plan & Billing',
        href: plan,
      },
    ],
    tools: [
      { name: 'Home Maintenance Schedule', status: 'Free Through HOMEFREE', detail: 'Trial ended. Promotion still covers this tool.' },
    ],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: '$0/month',
      increase: '$0/month',
      effectiveDate: '10/11/2026',
      paymentRequired: false,
      coverageNote: 'Covered by HOMEFREE.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [],
    paymentRequired: false,
  },
  {
    id: 'day-8-account-promo',
    group: 'Trial',
    label: 'Day 8 — bill still $0',
    summary: 'Cleaning Schedule’s trial is over. LAUNCH90 still keeps the monthly cost at $0, so this is not a payment warning.',
    banner: {
      severity: 'info',
      title: 'Your trial has ended — your current cost is still $0',
      body: 'Cleaning Schedule’s free trial has ended. Your active promotion currently keeps your monthly cost at $0. No payment information is required at this time.',
    },
    notices: [
      {
        id: 'trial-ended:cleaning-schedule:launch90',
        severity: 'info',
        kind: 'trial_ended',
        title: 'Your Cleaning Schedule trial has ended, but your current promotion continues to cover your account',
        body: 'LAUNCH90 keeps your monthly cost at $0 for now. No payment information is required at this time.',
        when: '10/11/2026 · 8:00 AM',
        cta: 'View Plan & Billing',
        href: plan,
      },
    ],
    tools: [
      { name: 'Cleaning Schedule', status: 'Free Through LAUNCH90', detail: 'Trial ended. Account promotion still covers the monthly cost.' },
    ],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: '$0/month',
      increase: '$0/month',
      effectiveDate: '10/11/2026',
      paymentRequired: false,
      coverageNote: 'LAUNCH90 is still active.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [],
    paymentRequired: false,
  },
  {
    id: 'day-8-payment',
    group: 'Trial',
    label: 'Day 8 — payment required',
    summary: 'The trial ended, both free slots are in use, and no promotion covers Cleaning Schedule. The example cost is $2/month and there is no payment method.',
    banner: {
      severity: 'action',
      title: 'Trial ended — payment required',
      body: 'Your Cleaning Schedule free trial has ended. Your first 2 tools are included at no monthly cost. Keeping Cleaning Schedule will cost $2/month. Your information is still saved.',
    },
    notices: [
      {
        id: 'payment-required:cleaning-schedule:2026-10-11',
        severity: 'action',
        kind: 'payment_required',
        title: 'Payment method required',
        body: 'Your Cleaning Schedule trial has ended. Keeping this tool costs $2/month. Your information is still saved, but you’ll need to add a payment method to continue using the tool.',
        when: '10/11/2026 · 8:00 AM',
        cta: 'Manage Tools',
        href: tools,
      },
    ],
    tools: [
      { name: 'Cleaning Schedule', status: 'Payment Required', detail: 'Trial ended. Not covered by a free slot or promotion. Records are still saved. This preview does not lock the live tool.' },
    ],
    projection: {
      currentMonthlyCost: '$2/month',
      projectedMonthlyCost: '$2/month',
      increase: null,
      effectiveDate: '10/11/2026',
      paymentRequired: true,
      coverageNote: 'One billable tool. No payment method on the account.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [
      email(
        'email-payment-required',
        'Action needed to continue using Cleaning Schedule',
        [
          'Your Cleaning Schedule free trial has ended.',
          'Your first 2 tools are included at no monthly cost. Keeping Cleaning Schedule will cost $2/month.',
          'Your information is still saved. A payment method is not collected in this preview, and nothing has been charged.',
        ],
        [{ label: 'To continue', value: '$2/month' }],
        'Manage Tools',
      ),
    ],
    paymentRequired: true,
  },
  {
    id: 'multiple-trials',
    group: 'Trial',
    label: 'Several trials at once',
    summary: 'Each tool has its own end date. Only Cleaning Schedule is at “ends today,” so only that tool gets the stronger notice. The others stay visible on their own rows.',
    banner: {
      severity: 'attention',
      title: 'Your Cleaning Schedule trial ends today',
      body: 'Goals Tracking and Event Budget Planner are still in their own trials. Those end on different days and are not part of this notice.',
    },
    notices: [
      {
        id: 'trial-ending-today:cleaning-schedule:multi',
        severity: 'attention',
        kind: 'trial_ending',
        title: 'Your Cleaning Schedule trial ends today',
        body: 'This notice is only for Cleaning Schedule. It does not say your account trial ends today.',
        when: '10/10/2026 · 8:00 AM',
        cta: 'View Plan & Billing',
        href: plan,
      },
    ],
    tools: [
      { name: 'Cleaning Schedule', status: 'Trial Ends Today', detail: 'Ends 10/10/2026.' },
      { name: 'Goals Tracking', status: 'Free Trial — 3 Days Remaining', detail: 'Ends 10/13/2026. No separate warning yet.' },
      { name: 'Event Budget Planner', status: 'Free Trial — 5 Days Remaining', detail: 'Ends 10/15/2026. No separate warning yet.' },
    ],
    projection: null,
    emails: [],
    paymentRequired: false,
  },
  {
    id: 'promo-price-up',
    group: 'Promotion',
    label: 'LAUNCH90 — cost will rise',
    summary: 'Seven days before LAUNCH90 ends, the sample bill goes from $0 to $6. Nothing has been charged.',
    banner: {
      severity: 'attention',
      title: 'Your LAUNCH90 promotion expires in 7 days',
      body: 'Your current monthly cost is $0/month. After the promotion expires, the expected monthly cost is $6/month, effective 10/17/2026.',
    },
    notices: [
      {
        id: 'promotion-expiring:launch90:2026-10-17:price',
        severity: 'attention',
        kind: 'promotion_expiring',
        title: 'Your LAUNCH90 promotion expires in 7 days',
        body: 'Your current monthly cost is $0/month. After your promotion expires, the expected monthly cost is $6/month. Effective 10/17/2026. Nothing has been charged.',
        when: '10/10/2026 · 9:00 AM',
        cta: 'Review My Tools',
        href: tools,
      },
    ],
    tools: [],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: '$6/month',
      increase: '$6/month',
      effectiveDate: '10/17/2026',
      paymentRequired: false,
      coverageNote: 'Sample result after LAUNCH90 ends. Not a charge.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [
      email(
        'email-promo-7-days',
        'Your Household Toolbox promotion expires in 7 days',
        [
          'LAUNCH90 expires on 10/17/2026.',
          'Your current monthly cost is $0/month. After the promotion expires, the expected monthly cost is $6/month.',
          'Nothing has been charged. Review your tools if you want to change what stays on the account.',
        ],
        [
          { label: 'Current monthly cost', value: '$0/month' },
          { label: 'Expected monthly cost', value: '$6/month' },
          { label: 'Effective', value: '10/17/2026' },
        ],
        'Review My Tools',
      ),
    ],
    paymentRequired: false,
  },
  {
    id: 'promo-no-impact',
    group: 'Promotion',
    label: 'HOMEFREE ended — no price change',
    summary: 'HOMEFREE ended and Home Maintenance Schedule moved into a free-tool slot. There is no price warning.',
    banner: null,
    notices: [
      {
        id: 'promotion-expired:homefree:no-price',
        severity: 'info',
        kind: 'promotion_expired',
        title: 'HOMEFREE has ended',
        body: 'Home Maintenance Schedule is now included through your free-tool benefit. Your monthly cost stays $0.',
        when: '10/17/2026 · 8:00 AM',
        cta: 'View Plan & Billing',
        href: plan,
      },
    ],
    tools: [
      { name: 'Home Maintenance Schedule', status: 'Included', detail: 'HOMEFREE has ended. Covered by a free tool slot. No price change.' },
    ],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: '$0/month',
      increase: '$0/month',
      effectiveDate: '10/17/2026',
      paymentRequired: false,
      coverageNote: 'No billing warning. The promotion end date still shows on Plan & Billing.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [],
    paymentRequired: false,
  },
  {
    id: 'promo-partial',
    group: 'Promotion',
    label: 'Cost rises by $4',
    summary: 'A promotion is ending and the sample bill goes from $2 to $6. The notice shows the change, not only that a discount is ending.',
    banner: {
      severity: 'attention',
      title: 'Your monthly cost is expected to change',
      body: 'Current monthly cost $2/month. New monthly cost $6/month. Increase $4/month. Nothing has been charged.',
    },
    notices: [
      {
        id: 'promotion-expiring:partial:2026-10-17',
        severity: 'attention',
        kind: 'cost_changing',
        title: 'Your monthly cost is expected to change in 7 days',
        body: 'Current monthly cost $2/month. New monthly cost $6/month. Increase $4/month, effective 10/17/2026.',
        when: '10/10/2026 · 9:00 AM',
        cta: 'Review My Tools',
        href: tools,
      },
    ],
    tools: [],
    projection: {
      currentMonthlyCost: '$2/month',
      projectedMonthlyCost: '$6/month',
      increase: '$4/month',
      effectiveDate: '10/17/2026',
      paymentRequired: false,
      coverageNote: 'Sample partial change. Not a charge.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [],
    paymentRequired: false,
  },
  {
    id: 'specific-tool-promo',
    group: 'Promotion',
    label: 'HOMEFREE expires in 7 days',
    summary: 'HOMEFREE ends in 7 days and no free slot is open for Home Maintenance Schedule. The expected cost goes from $0 to $2. A payment method is not described as already charging.',
    banner: {
      severity: 'attention',
      title: 'Your Home Maintenance Schedule promotion expires in 7 days',
      body: 'HOMEFREE currently covers Home Maintenance Schedule. When the promotion ends, this tool will cost $2/month unless another free benefit covers it.',
    },
    notices: [
      {
        id: 'promotion-expiring:homefree:2026-10-17',
        severity: 'attention',
        kind: 'promotion_expiring',
        title: 'Your Home Maintenance Schedule promotion expires in 7 days',
        body: 'Current monthly cost $0/month. Expected monthly cost $2/month, effective 10/17/2026, unless another free benefit covers the tool.',
        when: '10/10/2026 · 9:00 AM',
        cta: 'Review My Tools',
        href: tools,
      },
    ],
    tools: [
      { name: 'Home Maintenance Schedule', status: 'HOMEFREE Ends in 7 Days', detail: 'Expected $2/month after 10/17/2026 if no other free benefit covers it.' },
    ],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: '$2/month',
      increase: '$2/month',
      effectiveDate: '10/17/2026',
      paymentRequired: false,
      coverageNote: 'No free slot is open for this tool in this sample.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [],
    paymentRequired: false,
  },
  {
    id: 'bonus-slots',
    group: 'Promotion',
    label: 'Bonus free slots expire',
    summary: 'A promotion adds 3 free slots on top of the usual 2. Five tools are active. After 10/17/2026 only 2 slots remain, so the sample cost goes from $0 to $6.',
    banner: {
      severity: 'attention',
      title: 'Your bonus free-tool slots expire in 7 days',
      body: 'You currently have 5 free tool slots. After 10/17/2026 you will have 2. Based on your current tools, the expected monthly cost goes from $0/month to $6/month.',
    },
    notices: [
      {
        id: 'promotion-expiring:bonus-slots:2026-10-17',
        severity: 'attention',
        kind: 'promotion_expiring',
        title: 'Your bonus free-tool slots expire in 7 days',
        body: '5 free tool slots now. 2 after 10/17/2026. Expected monthly cost $0/month to $6/month.',
        when: '10/10/2026 · 9:00 AM',
        cta: 'Review My Tools',
        href: tools,
      },
    ],
    tools: [],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: '$6/month',
      increase: '$6/month',
      effectiveDate: '10/17/2026',
      paymentRequired: false,
      coverageNote: 'Usual benefit is 2 free tool slots. The promotion adds 3 more until 10/17/2026.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [],
    paymentRequired: false,
  },
  {
    id: 'storage-ok',
    group: 'Storage',
    label: 'Bonus storage — under the next limit',
    summary: 'The +5 GB promotion is ending. Usage is 600 MB and the allowance after that is 1 GB. No files are removed and no urgent warning is shown.',
    banner: null,
    notices: [
      {
        id: 'storage-expiring:under-limit',
        severity: 'info',
        kind: 'storage_expiring',
        title: 'Your +5 GB bonus storage ends on 10/17/2026',
        body: 'You’re using 600 MB. After the promotion, your allowance is 1 GB. No action is needed, and your files stay where they are.',
        when: '10/10/2026 · 9:00 AM',
        cta: 'View storage',
        href: '/dashboard/storage',
      },
    ],
    tools: [],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: '$0/month',
      increase: null,
      effectiveDate: '10/17/2026',
      paymentRequired: false,
      coverageNote: 'Usage is under the allowance that remains.',
      storageUsed: '600 MB',
      storageAllowanceAfter: '1 GB',
    },
    emails: [],
    paymentRequired: false,
  },
  {
    id: 'storage-over',
    group: 'Storage',
    label: 'Bonus storage — over the next limit',
    summary: 'Usage is 3.4 GB. After the +5 GB promotion the allowance in this sample is 1 GB. Files are not deleted.',
    banner: {
      severity: 'action',
      title: 'Your bonus storage expires in 7 days',
      body: 'You’re currently using 3.4 GB. Your storage allowance after this promotion expires is 1 GB. Your existing files will not be deleted.',
    },
    notices: [
      {
        id: 'storage-expiring:over-limit',
        severity: 'action',
        kind: 'storage_expiring',
        title: 'Your bonus storage expires in 7 days',
        body: 'You’re using 3.4 GB. After 10/17/2026 the allowance in this sample is 1 GB. Your existing files will not be deleted. You’ll need to reduce storage or add more before uploading more files. That limit is not enforced in this preview.',
        when: '10/10/2026 · 9:00 AM',
        cta: 'View storage',
        href: '/dashboard/storage',
      },
    ],
    tools: [],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: null,
      increase: null,
      effectiveDate: '10/17/2026',
      paymentRequired: false,
      coverageNote: 'Files stay. Upload rules come later.',
      storageUsed: '3.4 GB',
      storageAllowanceAfter: '1 GB',
    },
    emails: [
      email(
        'email-storage',
        'Your Household Toolbox bonus storage expires soon',
        [
          'Your +5 GB bonus storage expires on 10/17/2026.',
          'You’re currently using 3.4 GB. The allowance after the promotion expires is 1 GB in this sample.',
          'Your existing files will not be deleted. This preview does not block uploads.',
        ],
        [
          { label: 'Using', value: '3.4 GB' },
          { label: 'Allowance after 10/17/2026', value: '1 GB' },
        ],
        'View storage',
      ),
    ],
    paymentRequired: false,
  },
  {
    id: 'projection-updated',
    group: 'Account changes',
    label: 'Tools removed — projection updated',
    summary: 'An earlier sample said the bill would become $6. Two tools were removed. The notice now shows $2. The old $6 figure is not left on screen.',
    banner: {
      severity: 'attention',
      title: 'Your upcoming cost has changed',
      body: 'Based on your current tools, the expected monthly cost after LAUNCH90 expires is $2/month, not the earlier $6/month sample.',
    },
    notices: [
      {
        id: 'cost-changing:launch90:revised-2',
        severity: 'attention',
        kind: 'cost_changing',
        title: 'Your upcoming cost has changed',
        body: 'LAUNCH90 still expires on 10/17/2026. Expected monthly cost is now $2/month. The earlier $6 projection is no longer shown.',
        when: '10/13/2026 · 2:00 PM',
        cta: 'Review My Tools',
        href: tools,
      },
    ],
    tools: [],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: '$2/month',
      increase: '$2/month',
      effectiveDate: '10/17/2026',
      paymentRequired: false,
      coverageNote: 'Replaces the earlier $6 sample. Based on the tools still on the account.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [],
    paymentRequired: false,
  },
  {
    id: 'projection-cleared',
    group: 'Account changes',
    label: 'Expected charge went away',
    summary: 'Enough tools were removed that the rest fit in the free slots. The $6 warning is gone. A short information notice explains the new result.',
    banner: {
      severity: 'info',
      title: 'Your upcoming cost has changed',
      body: 'Based on your current tools, your monthly cost is expected to remain $0 after LAUNCH90 expires. No payment information is required.',
    },
    notices: [
      {
        id: 'cost-changing:launch90:now-zero',
        severity: 'info',
        kind: 'cost_changing',
        title: 'Your upcoming cost has changed',
        body: 'Based on your current tools, your monthly cost is expected to remain $0 after LAUNCH90 expires. No payment information is required.',
        when: '10/14/2026 · 11:00 AM',
        cta: 'View Plan & Billing',
        href: plan,
      },
    ],
    tools: [],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: '$0/month',
      increase: '$0/month',
      effectiveDate: '10/17/2026',
      paymentRequired: false,
      coverageNote: 'The earlier $6 warning is not shown.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [],
    paymentRequired: false,
  },
  {
    id: 'promo-during-trial',
    group: 'Overlaps',
    label: 'Promotion ends during a trial',
    summary: 'LAUNCH90 expires tomorrow. Event Budget Planner still has 4 days left on its own trial, so that tool is not billable when the promotion ends.',
    banner: {
      severity: 'info',
      title: 'LAUNCH90 expires tomorrow',
      body: 'Event Budget Planner still has 4 days left on its free trial. That tool is not billable when the promotion ends. The account is checked again when the trial ends.',
    },
    notices: [
      {
        id: 'promotion-expiring:launch90:trial-still-open',
        severity: 'info',
        kind: 'promotion_expiring',
        title: 'LAUNCH90 expires tomorrow',
        body: 'Event Budget Planner remains on its trial for 4 more days, so this promotion ending does not make that tool billable tomorrow.',
        when: '10/09/2026 · 9:00 AM',
        cta: 'View Plan & Billing',
        href: plan,
      },
    ],
    tools: [
      { name: 'Event Budget Planner', status: 'Free Trial — 4 Days Remaining', detail: 'Still on its own trial after LAUNCH90 ends.' },
    ],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: '$0/month',
      increase: '$0/month',
      effectiveDate: '10/10/2026',
      paymentRequired: false,
      coverageNote: 'Trial coverage continues after the promotion date.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [],
    paymentRequired: false,
  },
  {
    id: 'trial-during-promo',
    group: 'Overlaps',
    label: 'Trial ends during LAUNCH90',
    summary: 'Cleaning Schedule’s trial ends today. LAUNCH90 still has about 30 days left, so tomorrow is not a payment-required notice.',
    banner: {
      severity: 'info',
      title: 'Your Cleaning Schedule trial has ended, but your current promotion continues to cover your account',
      body: 'LAUNCH90 remains active. No payment information is required.',
    },
    notices: [
      {
        id: 'trial-ended:cleaning-schedule:promo-remains',
        severity: 'info',
        kind: 'trial_ended',
        title: 'Your Cleaning Schedule trial has ended, but your current promotion continues to cover your account',
        body: 'LAUNCH90 still has about 30 days left. No payment information is required.',
        when: '10/10/2026 · 8:00 AM',
        cta: 'View Plan & Billing',
        href: plan,
      },
    ],
    tools: [
      { name: 'Cleaning Schedule', status: 'Free Through LAUNCH90', detail: 'Trial ended. Promotion still covers the account.' },
    ],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: '$0/month',
      increase: '$0/month',
      effectiveDate: '10/11/2026',
      paymentRequired: false,
      coverageNote: 'LAUNCH90 continues for about 30 days.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [],
    paymentRequired: false,
  },
  {
    id: 'same-day',
    group: 'Overlaps',
    label: 'Trial and LAUNCH90 end together',
    summary: 'Cleaning Schedule’s trial and LAUNCH90 both end on 10/10/2026. The notice is the result after both end, not two separate warnings. In this sample the tool is then uncovered, so the expected cost is $2/month.',
    banner: {
      severity: 'action',
      title: 'Cleaning Schedule needs a payment method after 10/10/2026',
      body: 'The trial and LAUNCH90 end on the same day. After both end, Cleaning Schedule is not covered by a free slot. Keeping it would cost $2/month. Your information is still saved. Nothing has been charged.',
    },
    notices: [
      {
        id: 'same-day:cleaning-schedule:launch90:2026-10-10',
        severity: 'action',
        kind: 'payment_required',
        title: 'Payment method required after 10/10/2026',
        body: 'This is the result after both the Cleaning Schedule trial and LAUNCH90 end on 10/10/2026. Keeping Cleaning Schedule would cost $2/month. Your information is still saved.',
        when: '10/10/2026 · 8:00 AM',
        cta: 'Manage Tools',
        href: tools,
      },
    ],
    tools: [
      { name: 'Cleaning Schedule', status: 'Payment Required', detail: 'Final state after both expirations on 10/10/2026.' },
    ],
    projection: {
      currentMonthlyCost: '$0/month',
      projectedMonthlyCost: '$2/month',
      increase: '$2/month',
      effectiveDate: '10/10/2026',
      paymentRequired: true,
      coverageNote: 'One combined result. The trial notice and the promotion notice are not sent as separate price warnings.',
      storageUsed: null,
      storageAllowanceAfter: null,
    },
    emails: [],
    paymentRequired: true,
  },
];

export const PLAN_TEASER_ID = 'trial-day-5';

export function noticeMoment(id: string): NoticeMoment {
  return NOTICE_MOMENTS.find((moment) => moment.id === id) ?? NOTICE_MOMENTS[0];
}

const READ_KEY = 'household-toolbox-notice-preview-read-v1';
const listeners = new Set<() => void>();
let readSnapshot: { signature: string; ids: string[] } | null = null;

function readIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(READ_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function notify() {
  readSnapshot = null;
  listeners.forEach((listener) => listener());
}

export function subscribeNoticeReads(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNoticeReadServerSnapshot(): string[] | null {
  return null;
}

export function getNoticeReadSnapshot(): string[] {
  const ids = readIds();
  const signature = ids.join('|');
  if (readSnapshot && readSnapshot.signature === signature) return readSnapshot.ids;
  readSnapshot = { signature, ids };
  return ids;
}

export function markNoticeRead(id: string, read: boolean) {
  const next = new Set(readIds());
  if (read) next.add(id);
  else next.delete(id);
  window.sessionStorage.setItem(READ_KEY, JSON.stringify([...next]));
  notify();
}

export function markNoticesRead(ids: string[]) {
  const next = new Set(readIds());
  ids.forEach((id) => next.add(id));
  window.sessionStorage.setItem(READ_KEY, JSON.stringify([...next]));
  notify();
}
