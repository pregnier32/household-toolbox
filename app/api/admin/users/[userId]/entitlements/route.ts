import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { PUBLIC_TOOLS } from '@/lib/public-tools';
import { assignManualEntitlement, assignPromotion, endAssignment } from '@/lib/promotion-service';
import { formatCents } from '@/lib/account-pricing';
import { formatStorageBytes } from '@/lib/user-storage';
import { getAccountPricingProjection } from '@/lib/load-account-pricing';
import type { UserEntitlement } from '@/lib/user-entitlements-preview';

async function requireSuperadmin() {
  const user = await getSession();
  if (!user) return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.userStatus !== 'superadmin') return { user: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user, response: null };
}

function day(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;
  const { userId } = await context.params;
  try {
    const [assignments, links, tools, people, pricing] = await Promise.all([
      supabaseServer.from('promotion_assignments').select('*').eq('user_id', userId).order('assigned_at', { ascending: false }),
      supabaseServer.from('promotion_assignment_tools').select('assignment_id, tool_id'),
      supabaseServer.from('tools').select('id, name'),
      supabaseServer.from('users').select('id, first_name, last_name'),
      getAccountPricingProjection(userId, new Date()),
    ]);
    if (assignments.error) throw assignments.error;
    if (links.error) throw links.error;
    const toolName = new Map((tools.data ?? []).map((tool) => [tool.id, tool.name]));
    const personName = new Map((people.data ?? []).map((person) => [person.id, `${person.first_name || ''} ${person.last_name || ''}`.trim()]));
    const slugs = new Map<string, string[]>();
    for (const link of links.data ?? []) {
      const name = toolName.get(link.tool_id) || '';
      const slug = PUBLIC_TOOLS.find((tool) => tool.name === name)?.slug;
      if (!slug) continue;
      const list = slugs.get(link.assignment_id) ?? [];
      list.push(slug);
      slugs.set(link.assignment_id, list);
    }
    const entitlements: UserEntitlement[] = (assignments.data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      promotionId: row.promotion_id,
      name: row.display_name,
      publicCode: row.public_code || '',
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
      durationUnit: row.duration_unit,
      durationAmount: row.duration_amount ?? 1,
      source: row.source,
      effectiveDate: day(row.effective_at) || row.effective_at.slice(0, 10),
      expirationDate: day(row.expires_at),
      status: row.removed_at ? 'removed' : 'active',
      assignedAt: row.assigned_at,
      assignedBy: row.assigned_by_user_id ? personName.get(row.assigned_by_user_id) || 'Superadmin' : 'System',
      notes: row.internal_note || '',
      removedAt: row.removed_at,
      removedBy: row.removed_by_user_id ? personName.get(row.removed_by_user_id) || 'Superadmin' : '',
      removalReason: row.removal_reason || '',
    }));
    return NextResponse.json({
      entitlements,
      pricing: pricing ? {
        current: formatCents(pricing.current.effectiveMonthlyCents),
        upcoming: pricing.upcoming ? formatCents(pricing.upcoming.state.effectiveMonthlyCents) : 'No scheduled change',
        paymentStatus: pricing.current.paymentSetupWouldBeNeeded ? 'Payment setup will be needed' : 'No payment setup needed',
        paymentMethod: 'Not configured yet',
        tools: pricing.current.tools.map((tool) => ({
          name: tool.name,
          toolState: 'Active',
          trialState: tool.inTrial ? `${tool.daysRemaining ?? 0} days remaining` : tool.trialPreviouslyUsed ? 'Trial previously used' : 'No trial',
          pricing: tool.accessLabel,
        })),
      } : null,
      account: pricing ? {
        accountType: pricing.current.accountType,
        isTestAccount: pricing.current.isTestAccount,
        activeTools: pricing.current.activeToolCount,
        activePromotions: pricing.current.activePromotions.length,
        freeSlots: pricing.current.freeSlots,
        expectedMonthly: formatCents(pricing.current.effectiveMonthlyCents),
        storageUsed: formatStorageBytes(pricing.current.storageUsedBytes),
        storageAllowance: formatStorageBytes(pricing.current.effectiveStorageBytes),
      } : null,
    });
  } catch (error) {
    console.error('Entitlement list failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Entitlements could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const gate = await requireSuperadmin();
  if (gate.response || !gate.user) return gate.response;
  const { userId } = await context.params;
  try {
    const body = await request.json();
    if (body.promotionId) {
      const result = await assignPromotion({
        userId,
        promotionId: body.promotionId,
        source: 'admin_assigned',
        assignedBy: gate.user.actorId,
        effectiveAt: new Date().toISOString(),
        override: Boolean(body.override),
        note: typeof body.note === 'string' ? body.note : null,
        signup: false,
      });
      if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    const draft = body.manual;
    if (!draft) return NextResponse.json({ error: 'Choose a promotion or a manual benefit.' }, { status: 400 });
    const names = (draft.toolSlugs || []).map((slug: string) => PUBLIC_TOOLS.find((tool) => tool.slug === slug)?.name).filter(Boolean);
    const catalog = names.length
      ? await supabaseServer.from('tools').select('id, name').in('name', names)
      : { data: [], error: null };
    if (catalog.error) throw catalog.error;
    const toolIds = (catalog.data ?? []).map((tool) => tool.id);
    const benefit = draft.discountType;
    const result = await assignManualEntitlement({
      userId,
      actorId: gate.user.actorId,
      effectiveAt: new Date(`${draft.effectiveDate || new Date().toISOString().slice(0, 10)}T00:00:00.000Z`).toISOString(),
      note: draft.notes || '',
      benefitType: benefit,
      slotMode: benefit === 'free_tool_slots' ? draft.slotMode : null,
      slotCount: benefit === 'free_tool_slots' ? Math.round(draft.quantity) : null,
      percentOff: benefit === 'percentage' ? draft.quantity : null,
      amountCents: benefit === 'fixed_amount' ? Math.round(draft.quantity * 100) : null,
      bonusStorageBytes: benefit === 'bonus_storage' ? Math.round(draft.quantity * 1024 * 1024 * 1024) : null,
      durationUnit: draft.durationUnit,
      durationAmount: draft.durationUnit === 'lifetime' ? null : Math.round(draft.durationAmount),
      displayName: draft.discountType === 'free_tool_slots' ? 'Manual free tool slots' : 'Manual entitlement',
      customerDescription: 'A benefit added to this account.',
      toolIds: benefit === 'specific_tools' ? toolIds : [],
    });
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Entitlement create failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'That benefit could not be saved.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const gate = await requireSuperadmin();
  if (gate.response || !gate.user) return gate.response;
  const { userId } = await context.params;
  try {
    const body = await request.json();
    if (typeof body.isTestAccount !== 'boolean') {
      return NextResponse.json({ error: 'Choose whether this is a test account.' }, { status: 400 });
    }
    const updated = await supabaseServer.from('users').update({ is_test_account: body.isTestAccount }).eq('id', userId);
    if (updated.error) throw updated.error;
    console.info('Test account flag updated', { userId, isTestAccount: body.isTestAccount, actorId: gate.user.actorId });
    return NextResponse.json({ ok: true, isTestAccount: body.isTestAccount });
  } catch (error) {
    console.error('Test account flag failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The test account flag could not be saved.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response || !gate.user) return gate.response;
  try {
    const body = await request.json();
    if (!body.assignmentId) return NextResponse.json({ error: 'A benefit is required.' }, { status: 400 });
    const result = await endAssignment(gate.user.actorId, body.assignmentId, typeof body.reason === 'string' ? body.reason : '');
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Entitlement end failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'That benefit could not be ended.' }, { status: 500 });
  }
}
