import { NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { formatCents } from '@/lib/account-pricing';
import { formatStorageBytes } from '@/lib/user-storage';
import { getAccountPricingProjection } from '@/lib/load-account-pricing';
import { persistAccountNotices } from '@/lib/promotion-service';
import { benefitLabel } from '@/lib/discount-codes';
import { PUBLIC_TOOLS } from '@/lib/public-tools';
import type { CustomerPlanBenefit, CustomerPlanSource } from '@/lib/customer-plan-preview';

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
    const [projection, assignments, links, tools, notice] = await Promise.all([
      getAccountPricingProjection(user.id, now),
      supabaseServer.from('promotion_assignments').select('id, display_name, public_code, customer_description_snapshot, benefit_type, slot_mode, slot_count, percent_off, amount_cents, bonus_storage_bytes, effective_at, expires_at, removed_at, source').eq('user_id', user.id).order('assigned_at', { ascending: false }),
      supabaseServer.from('promotion_assignment_tools').select('assignment_id, tool_id'),
      supabaseServer.from('tools').select('id, name'),
      supabaseServer.from('account_notices').select('title, body').eq('user_id', user.id).is('read_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!projection) return NextResponse.json({ error: 'Account could not be loaded.' }, { status: 404 });
    if (assignments.error) throw assignments.error;
    const toolName = new Map((tools.data ?? []).map((tool) => [tool.id, tool.name]));
    const slugs = new Map<string, string[]>();
    for (const link of links.data ?? []) {
      const name = toolName.get(link.tool_id) || '';
      const slug = PUBLIC_TOOLS.find((tool) => tool.name === name)?.slug;
      if (!slug) continue;
      const list = slugs.get(link.assignment_id) ?? [];
      list.push(slug);
      slugs.set(link.assignment_id, list);
    }
    const benefits: CustomerPlanBenefit[] = (assignments.data ?? []).map((row) => {
      const draft = {
        discountType: row.benefit_type,
        quantity: row.benefit_type === 'percentage'
          ? Number(row.percent_off ?? 0)
          : row.benefit_type === 'fixed_amount'
            ? (row.amount_cents ?? 0) / 100
            : row.benefit_type === 'bonus_storage'
              ? Number(row.bonus_storage_bytes ?? 0) / (1024 * 1024 * 1024)
              : row.slot_count ?? 0,
        slotMode: row.slot_mode || 'additional',
        toolSlugs: slugs.get(row.id) ?? [],
      };
      return {
        id: row.id,
        name: row.display_name,
        publicCode: row.public_code || '',
        benefit: benefitLabel(draft),
        description: row.customer_description_snapshot,
        effectiveDate: day(row.effective_at) || '',
        expirationDate: day(row.expires_at),
        status: row.removed_at ? 'removed' as const : 'active' as const,
        source: sourceFor(row.source),
      };
    });
    const state = projection.current;
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
      })),
      benefits,
      currentMonthly: formatCents(state.effectiveMonthlyCents),
      upcoming: projection.upcoming ? {
        at: projection.upcoming.at.slice(0, 10),
        amount: formatCents(projection.upcoming.state.effectiveMonthlyCents),
      } : null,
      storageUsed: formatStorageBytes(state.storageUsedBytes),
      storageAllowance: formatStorageBytes(state.effectiveStorageBytes),
      paymentMethod: 'Not configured yet',
      paymentSetupWouldBeNeeded: state.paymentSetupWouldBeNeeded,
      notice: notice.data ? { title: notice.data.title, body: notice.data.body } : null,
    });
  } catch (error) {
    console.error('Plan load failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Plan and billing could not be loaded.' }, { status: 500 });
  }
}
