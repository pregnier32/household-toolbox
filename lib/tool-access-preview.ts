/**
 * Mock tool-access states for the Plan & Billing preview.
 *
 * UI copy and sample scenarios only. This module does not read trials,
 * change trial history, lock tools, or calculate a bill.
 */

export type ToolAccessState =
  | 'free_slot'
  | 'trial'
  | 'promotion'
  | 'paid'
  | 'payment_required'
  | 'locked';

export type MockAccessTool = {
  id: string;
  name: string;
  state: ToolAccessState;
  daysRemaining: number | null;
  promotionCode: string | null;
  /** Example shelf price. Not a charge. */
  exampleMonthlyPrice: number;
};

export type AddToolExample = {
  id: string;
  name: string;
  headline: string;
  detail: string;
  actionLabel: string;
};

export type AccessScenario = {
  id: string;
  label: string;
  summary: string;
  tools: MockAccessTool[];
  /** Shown as an example for the story. Not a calculated bill. */
  exampleMonthlyCost: string;
  paymentAsked: boolean;
  noticeTitle: string | null;
  noticeBody: string | null;
};

export const ACCESS_STATE_LABELS: Record<ToolAccessState, string> = {
  free_slot: 'Included',
  trial: 'Free Trial',
  promotion: 'Free Through Promotion',
  paid: 'Paid',
  payment_required: 'Payment Required',
  locked: 'Locked',
};

export function trialBadge(daysRemaining: number | null): string {
  if (daysRemaining == null) return 'Free Trial';
  if (daysRemaining <= 0) return 'Free Trial — Ends Today';
  if (daysRemaining === 1) return 'Free Trial — 1 Day Left';
  return `Free Trial — ${daysRemaining} Days Left`;
}

export function toolBadge(tool: MockAccessTool): string {
  if (tool.state === 'trial') return trialBadge(tool.daysRemaining);
  if (tool.state === 'promotion' && tool.promotionCode) return `Free Through ${tool.promotionCode}`;
  if (tool.state === 'promotion') return 'Free Through Promotion';
  if (tool.state === 'free_slot') return 'Included';
  if (tool.state === 'paid') return `$${tool.exampleMonthlyPrice}/month`;
  if (tool.state === 'payment_required') return 'Trial Ended — Payment Required';
  return 'Locked — Payment Required';
}

export function toolAccessNote(tool: MockAccessTool): string {
  if (tool.state === 'free_slot') return 'Full access. Covered by a free tool slot.';
  if (tool.state === 'trial') {
    const when = tool.daysRemaining == null
      ? 'during your trial'
      : tool.daysRemaining <= 0
        ? 'today'
        : tool.daysRemaining === 1
          ? 'for 1 more day'
          : `for the next ${tool.daysRemaining} days`;
    return `Full access ${when}. No payment information is required during your trial. If this tool is not covered by a free benefit after the trial, it would cost $${tool.exampleMonthlyPrice}/month to continue.`;
  }
  if (tool.state === 'promotion') {
    const which = tool.promotionCode ? ` ${tool.promotionCode}` : ' a promotion';
    return `Full access. Covered by${which}. A trial ending does not ask for a payment method while this benefit keeps the monthly cost at $0.`;
  }
  if (tool.state === 'paid') return `Full access. Example price $${tool.exampleMonthlyPrice}/month. Nothing is charged in this preview.`;
  if (tool.state === 'payment_required' || tool.state === 'locked') {
    return `Your information is still saved. This preview does not lock the live tool. Continuing would cost $${tool.exampleMonthlyPrice}/month because no free slot or promotion covers it, and there is no payment method.`;
  }
  return '';
}

const price = 2;

function tool(
  id: string,
  name: string,
  state: ToolAccessState,
  extra: Partial<Pick<MockAccessTool, 'daysRemaining' | 'promotionCode'>> = {},
): MockAccessTool {
  return {
    id,
    name,
    state,
    daysRemaining: extra.daysRemaining ?? null,
    promotionCode: extra.promotionCode ?? null,
    exampleMonthlyPrice: price,
  };
}

/** Starting picture: two free slots and three trials that end on different days. */
export const STARTING_TOOLS: MockAccessTool[] = [
  tool('todo', 'To Do List', 'free_slot'),
  tool('meals', 'Meal Planner', 'free_slot'),
  tool('cleaning', 'Cleaning Schedule', 'trial', { daysRemaining: 1 }),
  tool('goals', 'Goals Tracking', 'trial', { daysRemaining: 4 }),
  tool('budget', 'Event Budget Planner', 'trial', { daysRemaining: 6 }),
  tool('home', 'Home Maintenance Schedule', 'promotion', { promotionCode: 'HOMEFREE' }),
];

export const ACCESS_SCENARIOS: AccessScenario[] = [
  {
    id: 'today',
    label: 'Today',
    summary: 'Two tools use the free slots. Three other tools are each on their own 7-day trial, and those trials end on different days. Home Maintenance Schedule is free through HOMEFREE. No payment method is requested.',
    tools: STARTING_TOOLS,
    exampleMonthlyCost: '$0',
    paymentAsked: false,
    noticeTitle: 'Adding another tool does not ask for a card',
    noticeBody: 'A new tool can start its one-time 7-day trial with full access. Your first 2 tools are included at no monthly cost. If you keep the new tool after its trial and no free benefit covers it, the monthly cost may increase by $2/month. No payment information is required during the trial.',
  },
  {
    id: 'first-bill',
    label: 'First tool becomes billable',
    summary: 'Cleaning Schedule’s trial ended first. The two free slots are still used by To Do List and Meal Planner, and no promotion covers Cleaning Schedule. The example monthly cost is $2. There is no payment method, so Cleaning Schedule is shown as payment required. Goals Tracking and Event Budget Planner stay fully usable because their trials have not ended.',
    tools: [
      tool('todo', 'To Do List', 'free_slot'),
      tool('meals', 'Meal Planner', 'free_slot'),
      tool('cleaning', 'Cleaning Schedule', 'locked'),
      tool('goals', 'Goals Tracking', 'trial', { daysRemaining: 3 }),
      tool('budget', 'Event Budget Planner', 'trial', { daysRemaining: 5 }),
      tool('home', 'Home Maintenance Schedule', 'promotion', { promotionCode: 'HOMEFREE' }),
    ],
    exampleMonthlyCost: '$2/month',
    paymentAsked: true,
    noticeTitle: 'Trial ended',
    noticeBody: 'Your free trial for Cleaning Schedule has ended. Your first 2 tools are included at no monthly cost. Keeping Cleaning Schedule would make the example monthly cost $2/month. Your information is still saved. Nothing has been charged, and this preview does not lock the live tool.',
  },
  {
    id: 'slot-opened',
    label: 'A free slot opened',
    summary: 'Meal Planner was removed from My Tools while Cleaning Schedule was still on its trial. When that trial ended, To Do List and Cleaning Schedule were the two active tools that needed a slot. Both fit. The example monthly cost stays $0, so no payment method is requested. Goals Tracking is still on its own trial and will be checked again when that trial ends.',
    tools: [
      tool('todo', 'To Do List', 'free_slot'),
      tool('cleaning', 'Cleaning Schedule', 'free_slot'),
      tool('goals', 'Goals Tracking', 'trial', { daysRemaining: 3 }),
      tool('budget', 'Event Budget Planner', 'trial', { daysRemaining: 5 }),
      tool('home', 'Home Maintenance Schedule', 'promotion', { promotionCode: 'HOMEFREE' }),
    ],
    exampleMonthlyCost: '$0',
    paymentAsked: false,
    noticeTitle: 'The trial ended, and the tool stayed free',
    noticeBody: 'Removing Meal Planner did not delete Cleaning Schedule. When the Cleaning Schedule trial ended, an open free slot covered it. No payment method is required while the example monthly cost is $0.',
  },
  {
    id: 'promotion-covers',
    label: 'A promotion covers the account',
    summary: 'LAUNCH90 is active, so the example monthly cost is $0 even after Event Budget Planner’s trial ends. Home Maintenance Schedule is still free through HOMEFREE. No payment method is requested.',
    tools: [
      tool('todo', 'To Do List', 'free_slot'),
      tool('meals', 'Meal Planner', 'free_slot'),
      tool('cleaning', 'Cleaning Schedule', 'promotion', { promotionCode: 'LAUNCH90' }),
      tool('goals', 'Goals Tracking', 'promotion', { promotionCode: 'LAUNCH90' }),
      tool('budget', 'Event Budget Planner', 'promotion', { promotionCode: 'LAUNCH90' }),
      tool('home', 'Home Maintenance Schedule', 'promotion', { promotionCode: 'HOMEFREE' }),
    ],
    exampleMonthlyCost: '$0',
    paymentAsked: false,
    noticeTitle: 'A trial can end without asking for payment',
    noticeBody: 'Event Budget Planner’s trial has ended. LAUNCH90 still makes the example monthly cost $0, so no payment method is requested. Your records stay in the tool.',
  },
  {
    id: 'readd',
    label: 'Add a tool again',
    summary: 'Cleaning Schedule was tried once, removed later, and is being added again. The one-time trial is not offered a second time. If a free slot or another benefit does not cover it, the example price is $2/month and a payment method would be needed before using it.',
    tools: [
      tool('todo', 'To Do List', 'free_slot'),
      tool('meals', 'Meal Planner', 'free_slot'),
      tool('home', 'Home Maintenance Schedule', 'promotion', { promotionCode: 'HOMEFREE' }),
    ],
    exampleMonthlyCost: '$0 until Cleaning Schedule is added',
    paymentAsked: true,
    noticeTitle: 'Free trial already used',
    noticeBody: 'You’ve previously used the free trial for Cleaning Schedule. If this tool is not covered by one of your free-tool slots or another promotion, it will cost $2/month. Both free slots are in use in this example, so payment setup would be required before the tool can be used. Adding it here does not change your account.',
  },
];

export const ADD_TOOL_EXAMPLES: AddToolExample[] = [
  {
    id: 'trial-start',
    name: 'Shopping List',
    headline: '$2/month after your 7-day free trial',
    detail: 'No payment method is required to start the trial. You get full access for 7 days. If you keep the tool and a free benefit does not cover it, the monthly cost may increase by $2/month.',
    actionLabel: 'Start free trial',
  },
  {
    id: 'open-slot',
    name: 'Notes',
    headline: 'Included with your account',
    detail: 'Shown when a free tool slot is open. The slot is not permanently tied to Notes. This preview does not assign the slot.',
    actionLabel: 'Add tool',
  },
  {
    id: 'specific-promo',
    name: 'Home Maintenance Schedule',
    headline: 'Free through your HOMEFREE promotion',
    detail: 'A promotion can cover a named tool even after its one-time trial has already been used.',
    actionLabel: 'Add tool',
  },
  {
    id: 'trial-used',
    name: 'Cleaning Schedule',
    headline: '$2/month',
    detail: 'Free trial already used. Deleting the tool and adding it again does not start another 7-day trial. If a free slot or promotion covers it, a payment method is still not required.',
    actionLabel: 'Add tool',
  },
];

export const STATE_GUIDE: MockAccessTool[] = [
  tool('guide-slot', 'Included tool', 'free_slot'),
  tool('guide-trial-6', 'Trial with time left', 'trial', { daysRemaining: 6 }),
  tool('guide-trial-1', 'Trial ending soon', 'trial', { daysRemaining: 1 }),
  tool('guide-trial-0', 'Trial ending today', 'trial', { daysRemaining: 0 }),
  tool('guide-promo', 'Promotion', 'promotion', { promotionCode: 'HOMEFREE' }),
  tool('guide-paid', 'Paid tool', 'paid'),
  tool('guide-pay', 'Payment required', 'payment_required'),
  tool('guide-locked', 'Locked tool', 'locked'),
];
