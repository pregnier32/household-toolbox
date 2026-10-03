import { calculateAccountPricing, formatCents, type AccountPricingInput } from './account-pricing';

export type NoticeDraft = {
  kind: 'trial_ending' | 'trial_ended' | 'promotion_expiring' | 'promotion_expired' | 'cost_changing' | 'payment_required' | 'access_changed' | 'storage_expiring';
  eventKey: string;
  severity: 'info' | 'attention' | 'action';
  title: string;
  body: string;
  href: string;
};

function utcDay(value: Date | string): string {
  const iso = typeof value === 'string' ? value : value.toISOString();
  return iso.slice(0, 10);
}

function dayGap(from: Date, toIso: string): number {
  const start = Date.parse(`${utcDay(from)}T00:00:00.000Z`);
  const end = Date.parse(`${utcDay(toIso)}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

function money(cents: number): string {
  return `${formatCents(cents)}/month`;
}

export function draftAccountNotices(input: AccountPricingInput, effectiveAt: Date): NoticeDraft[] {
  const current = calculateAccountPricing(input, effectiveAt);
  const drafts: NoticeDraft[] = [];

  for (const tool of current.tools) {
    if (!tool.trialEndsAt) continue;
    const gap = dayGap(effectiveAt, tool.trialEndsAt);
    const later = calculateAccountPricing(input, new Date(Date.parse(tool.trialEndsAt)));
    const laterTool = later.tools.find((item) => item.toolId === tool.toolId);
    const laterLabel = laterTool?.accessLabel ?? 'Included';
    const laterCost = money(later.effectiveMonthlyCents);

    if (gap === 2) {
      drafts.push({
        kind: 'trial_ending',
        eventKey: `trial_ending:${tool.toolId}:${tool.trialEndsAt}`,
        severity: 'attention',
        title: `Your ${tool.name} trial ends in 2 days`,
        body: `Your free trial ends on ${utcDay(tool.trialEndsAt)}. After the trial, the expected monthly cost for the account is ${laterCost}. ${laterLabel === 'Included' || laterLabel === 'Free Through Promotion' ? `${tool.name} is expected to stay covered.` : `${tool.name} is expected to need payment setup if you keep it.`} No payment information is required during the trial.`,
        href: '/dashboard/plan',
      });
    }

    if (gap === 0) {
      drafts.push({
        kind: 'trial_ending',
        eventKey: `trial_ends_today:${tool.toolId}:${tool.trialEndsAt}`,
        severity: 'attention',
        title: `Your ${tool.name} trial ends today`,
        body: `You keep access through the end of this trial. After it ends, the expected monthly cost is ${laterCost}. This notice is only for ${tool.name}.`,
        href: '/dashboard/plan',
      });
    }
  }

  for (const tool of input.tools) {
    if (!tool.trialUsed || !tool.trialStartedAt) continue;
    const end = new Date(Date.parse(tool.trialStartedAt) + 7 * 24 * 60 * 60 * 1000).toISOString();
    if (dayGap(effectiveAt, end) !== -1) continue;
    const after = calculateAccountPricing(input, effectiveAt);
    const afterTool = after.tools.find((item) => item.toolId === tool.toolId);
    const covered = afterTool && (afterTool.accessLabel === 'Included' || afterTool.accessLabel === 'Free Through Promotion');
    drafts.push({
      kind: 'trial_ended',
      eventKey: `trial_ended:${tool.toolId}:${end}`,
      severity: covered ? 'info' : 'action',
      title: covered ? `${tool.name} trial has ended` : `${tool.name} trial has ended`,
      body: covered
        ? `Your free trial has ended. ${tool.name} is covered, and the expected monthly cost is ${money(after.effectiveMonthlyCents)}.`
        : `Your free trial has ended. Keeping ${tool.name} is expected to cost ${money(afterTool?.shelfPriceCents ?? 0)}. The account expected monthly cost is ${money(after.effectiveMonthlyCents)}. Your information is still saved. Payment setup will be required once billing is available.`,
      href: '/dashboard/plan',
    });
    if (!covered && after.paymentSetupWouldBeNeeded) {
      drafts.push({
        kind: 'payment_required',
        eventKey: `payment_required:${tool.toolId}:${end}`,
        severity: 'action',
        title: 'Payment setup will be needed',
        body: `The expected monthly cost is ${money(after.effectiveMonthlyCents)}. No card is collected yet. This is the amount the account would owe once payment setup exists.`,
        href: '/dashboard/plan',
      });
    }
  }

  for (const assignment of input.assignments) {
    if (assignment.removedAt || !assignment.expiresAt) continue;
    const gap = dayGap(effectiveAt, assignment.expiresAt);
    const after = calculateAccountPricing(input, new Date(Date.parse(assignment.expiresAt)));
    const priceChanges = after.effectiveMonthlyCents !== current.effectiveMonthlyCents;
    const storageChanges = after.effectiveStorageBytes !== current.effectiveStorageBytes;
    if (gap === 7 && priceChanges) {
      drafts.push({
        kind: 'promotion_expiring',
        eventKey: `promotion_expiring:${assignment.id}`,
        severity: 'attention',
        title: `${assignment.displayName} expires in 7 days`,
        body: `Your current expected monthly cost is ${money(current.effectiveMonthlyCents)}. After this promotion expires, the expected monthly cost is ${money(after.effectiveMonthlyCents)}, effective ${utcDay(assignment.expiresAt)}.`,
        href: '/dashboard/plan',
      });
      drafts.push({
        kind: 'cost_changing',
        eventKey: `cost_changing:${assignment.id}:${utcDay(assignment.expiresAt)}`,
        severity: 'attention',
        title: 'Your expected monthly cost will change',
        body: `Your expected monthly cost will become ${money(after.effectiveMonthlyCents)} on ${utcDay(assignment.expiresAt)}.`,
        href: '/dashboard/plan',
      });
    }
    if (gap === 7 && assignment.benefitType === 'bonus_storage' && storageChanges) {
      drafts.push({
        kind: 'storage_expiring',
        eventKey: `storage_expiring:${assignment.id}`,
        severity: 'attention',
        title: 'Bonus storage expires in 7 days',
        body: 'Existing files stay in place. New uploads can be limited after the bonus storage ends if usage is over the remaining allowance.',
        href: '/dashboard/plan',
      });
    }
    if (gap === -1 && priceChanges) {
      drafts.push({
        kind: 'promotion_expired',
        eventKey: `promotion_expired:${assignment.id}`,
        severity: after.paymentSetupWouldBeNeeded ? 'action' : 'info',
        title: `${assignment.displayName} has ended`,
        body: `The expected monthly cost is now ${money(after.effectiveMonthlyCents)}.`,
        href: '/dashboard/plan',
      });
    }
    if (gap === -1) {
      const changed = current.tools.filter((tool) => {
        const before = calculateAccountPricing(input, new Date(Date.parse(assignment.expiresAt!) - 1000));
        const previous = before.tools.find((item) => item.toolId === tool.toolId);
        return previous && previous.accessLabel !== tool.accessLabel;
      });
      for (const tool of changed) {
        drafts.push({
          kind: 'access_changed',
          eventKey: `access_changed:${assignment.id}:${tool.toolId}`,
          severity: 'info',
          title: `${tool.name} access changed`,
          body: `${tool.name} is now ${tool.accessLabel}.`,
          href: '/dashboard/my-tools',
        });
      }
    }
  }

  return drafts;
}

export function noticeSignature(drafts: NoticeDraft[]): string {
  return drafts.map((draft) => draft.eventKey).sort().join('|');
}
