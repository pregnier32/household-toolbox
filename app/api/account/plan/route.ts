import { NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { formatCents } from '@/lib/account-pricing';
import { buildCycleCustomerStatement, buildCustomerStatement, toolListCents } from '@/lib/billing-preview';
import { billingSchedule } from '@/lib/billing-cycle';
import { loadFrozenPeriod, loadSignupAt, materializeBillingPeriod } from '@/lib/billing-period-store';
import { formatStorageBytes } from '@/lib/user-storage';
import { getAccountPricingProjection } from '@/lib/load-account-pricing';
import { persistAccountNotices } from '@/lib/promotion-service';
import { loadBillingAccount } from '@/lib/billing-store';
import type { CustomerPlanBenefit, CustomerPlanSource } from '@/lib/customer-plan-preview';

const LIVE_PAYMENT = new Set(['active', 'past_due', 'unpaid', 'trialing', 'paused']);

function day(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

function sourceFor(source: string): CustomerPlanSource {
  if (source === 'user_entered') return 'code';
  if (source === 'automatic') return 'included';
  return 'added';
}

export async function GET() {
  const user = await getHouseholdDataSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.householdRole !== 'admin') return NextResponse.json({ error: 'Only the household Admin can view plan and billing.' }, { status: 403 });
  try {
    const now = new Date();
    await persistAccountNotices(user.id, now);
    const [projection, assignments, notice] = await Promise.all([
      getAccountPricingProjection(user.id, now),
      supabaseServer.from('promotion_assignments').select('id, display_name, public_code, customer_description_snapshot, effective_at, expires_at, removed_at, source').eq('user_id', user.id).order('assigned_at', { ascending: false }),
      supabaseServer.from('account_notices').select('title, body').eq('user_id', user.id).is('read_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!projection) return NextResponse.json({ error: 'Account could not be loaded.' }, { status: 404 });
    if (assignments.error) throw assignments.error;
    const benefits: CustomerPlanBenefit[] = (assignments.data ?? []).map((row) => {
      return {
        id: row.id,
        name: row.display_name,
        publicCode: row.public_code || '',
        benefit: '',
        description: row.customer_description_snapshot,
        effectiveDate: day(row.effective_at) || '',
        expirationDate: day(row.expires_at),
        status: row.removed_at ? 'removed' as const : 'active' as const,
        source: sourceFor(row.source),
      };
    });
    const state = projection.current;
    const signupAt = await loadSignupAt(user.id);
    let statement = buildCustomerStatement(projection.input, state);
    let billingCycle = null;
    if (signupAt) {
      const schedule = billingSchedule(signupAt, now);
      let frozen = null;
      if (schedule.periodStart) {
        const loaded = await loadFrozenPeriod(user.id, schedule.periodStart);
        frozen = loaded.available && !loaded.frozen
          ? await materializeBillingPeriod(projection.input, signupAt, now)
          : loaded.frozen;
      }
      const cycle = buildCycleCustomerStatement(projection.input, signupAt, now, frozen);
      statement = cycle.statement;
      billingCycle = cycle.billingCycle;
    }
    const account = await loadBillingAccount(user.id);
    const card = account?.card_brand && account.card_last4 ? `${account.card_brand} •••• ${account.card_last4}` : 'Not configured yet';
    const total = statement.find((row) => row.kind === 'total');
    const amountIsDue = Boolean(total?.amount && total.amount !== '$0.00') || state.paymentSetupWouldBeNeeded;
    const paymentAction = account?.subscription_status && LIVE_PAYMENT.has(account.subscription_status)
      ? 'manage'
      : amountIsDue
        ? 'setup'
        : 'none';
    return NextResponse.json({
      accountType: state.accountType,
      freeSlots: state.freeSlots,
      freeSlotsUsed: state.freeSlotsUsed,
      freeSlotsRemaining: state.freeSlotsRemaining,
      tools: state.tools.map((tool) => ({
        id: tool.toolId,
        name: tool.name,
        label: tool.inTrial && tool.daysRemaining != null ? `Free Trial — ${tool.daysRemaining} day${tool.daysRemaining === 1 ? '' : 's'} remaining` : tool.accessLabel,
        amount: tool.billable ? formatCents(tool.expectedMonthlyCents) : null,
        addedAt: tool.ownedAt,
        price: formatCents(toolListCents(tool)),
      })),
      statement,
      billingCycle,
      benefits,
      currentMonthly: formatCents(state.effectiveMonthlyCents),
      upcoming: projection.upcoming ? {
        at: projection.upcoming.at.slice(0, 10),
        amount: formatCents(projection.upcoming.state.effectiveMonthlyCents),
      } : null,
      storageUsed: formatStorageBytes(state.storageUsedBytes),
      storageAllowance: formatStorageBytes(state.effectiveStorageBytes),
      paymentMethod: card,
      paymentAction,
      subscriptionStatus: account?.subscription_status ?? null,
      paymentSetupWouldBeNeeded: state.paymentSetupWouldBeNeeded,
      notice: notice.data ? { title: notice.data.title, body: notice.data.body } : null,
    });
  } catch (error) {
    console.error('Plan load failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Plan and billing could not be loaded.' }, { status: 500 });
  }
}
