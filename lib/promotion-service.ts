import { supabaseServer } from '@/lib/supabaseServer';
import { PUBLIC_TOOLS } from '@/lib/public-tools';
import type { DiscountCode, DiscountCodeDraft, DiscountRedemption, RedemptionSource } from '@/lib/discount-codes';
import { draftAccountNotices } from '@/lib/account-notice-drafts';
import { ensureDefaultAccountEntitlements as ensureDefaultEntitlementWithDeps } from '@/lib/default-account-entitlements';
import { loadAccountPricingInputs } from '@/lib/load-account-pricing';

type RpcPayload = {
  ok?: boolean;
  code?: string;
  message?: string;
  assignment_id?: string;
  display_name?: string;
  public_code?: string | null;
  customer_description?: string;
  effective_at?: string;
  expires_at?: string | null;
};

export type AssignmentResult = {
  ok: boolean;
  code: string;
  message: string;
  displayName?: string;
  publicCode?: string | null;
  customerDescription?: string;
  effectiveAt?: string;
  expiresAt?: string | null;
};

const CUSTOMER_MESSAGES: Record<string, string> = {
  not_found: 'That code was not found.',
  unavailable: 'That code is not available.',
  not_started: 'That code is not active yet.',
  expired: 'That code has expired.',
  account_type: 'That code is not available for this account.',
  not_eligible: 'That code is not available for this account.',
  already_used: 'That code was already used on this account.',
  cap_reached: 'That code is no longer available.',
  not_stackable: 'That code cannot be combined with the current account discount.',
  failed: 'That code could not be applied. Please try again.',
};

function customerResult(payload: RpcPayload): AssignmentResult {
  if (payload.ok) {
    return {
      ok: true,
      code: 'ok',
      message: 'The code was applied.',
      displayName: payload.display_name,
      publicCode: payload.public_code,
      customerDescription: payload.customer_description,
      effectiveAt: payload.effective_at,
      expiresAt: payload.expires_at ?? null,
    };
  }
  const code = payload.code || 'failed';
  return { ok: false, code, message: CUSTOMER_MESSAGES[code] || CUSTOMER_MESSAGES.failed };
}

async function callRpc(name: string, args: Record<string, unknown>): Promise<RpcPayload> {
  const client = supabaseServer as unknown as {
    rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: RpcPayload | null; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc(name, args);
  if (error) {
    console.error('Promotion RPC failed', name, error.message);
    return { ok: false, code: 'failed' };
  }
  return data ?? { ok: false, code: 'failed' };
}

export async function assignPromotion(input: {
  userId: string;
  promotionId: string;
  source: 'user_entered' | 'automatic' | 'admin_assigned';
  assignedBy: string | null;
  effectiveAt: string;
  override: boolean;
  note: string | null;
  signup: boolean;
}): Promise<AssignmentResult> {
  const payload = await callRpc('assign_promotion', {
    p_user_id: input.userId,
    p_promotion_id: input.promotionId,
    p_source: input.source,
    p_assigned_by: input.assignedBy,
    p_effective_at: input.effectiveAt,
    p_override: input.override,
    p_note: input.note,
    p_signup: input.signup,
  });
  return customerResult(payload);
}

const defaultEntitlementCache = new Set<string>();

export async function ensureDefaultAccountEntitlements(userId: string) {
  const result = await ensureDefaultEntitlementWithDeps(userId, {
    loadContext: async (id) => {
      const [user, member] = await Promise.all([
        supabaseServer.from('users').select('account_type').eq('id', id).maybeSingle(),
        supabaseServer.from('household_members').select('household_id, role').eq('user_id', id).eq('status', 'active').maybeSingle(),
      ]);
      if (user.error || member.error) throw user.error || member.error;
      if (!user.data || !member.data || member.data.role !== 'admin') {
        return { accountType: user.data?.account_type ?? null, isBillingOwner: false };
      }
      const household = await supabaseServer.from('households').select('admin_user_id').eq('id', member.data.household_id).maybeSingle();
      if (household.error) throw household.error;
      return {
        accountType: user.data.account_type,
        isBillingOwner: household.data?.admin_user_id === id,
      };
    },
    loadDefaultPromotion: async () => {
      const { data, error } = await supabaseServer.from('promotions').select('id, public_code, status, assignment_method, benefit_type, eligible_users, eligible_account_type, slot_mode').ilike('public_code', 'NEWUSER2').maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        publicCode: data.public_code,
        status: data.status,
        assignmentMethod: data.assignment_method,
        benefitType: data.benefit_type,
        eligibleUsers: data.eligible_users,
        eligibleAccountType: data.eligible_account_type,
        slotMode: data.slot_mode,
      };
    },
    hasAssignment: async (id, promotionId) => {
      const { count, error } = await supabaseServer.from('promotion_assignments').select('id', { count: 'exact', head: true }).eq('user_id', id).eq('promotion_id', promotionId);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    assign: async (id, promotionId) => assignPromotion({
      userId: id,
      promotionId,
      source: 'automatic',
      assignedBy: null,
      effectiveAt: new Date().toISOString(),
      override: false,
      note: null,
      signup: true,
    }),
  }, defaultEntitlementCache);
  if (result.status === 'failed') {
    console.error('NEWUSER2 assignment was not saved', result.reason ?? 'failed');
  }
  return result;
}

function slugForName(name: string): string {
  return PUBLIC_TOOLS.find((tool) => tool.name === name)?.slug ?? '';
}

function nameForSlug(slug: string): string | null {
  return PUBLIC_TOOLS.find((tool) => tool.slug === slug)?.name ?? null;
}

type PromotionRow = {
  id: string;
  internal_name: string;
  public_code: string | null;
  customer_description: string;
  admin_notes: string | null;
  status: DiscountCode['status'];
  redeem_start_date: string | null;
  redeem_end_date: string | null;
  benefit_type: DiscountCode['discountType'];
  slot_mode: DiscountCode['slotMode'] | null;
  slot_count: number | null;
  percent_off: number | null;
  amount_cents: number | null;
  bonus_storage_bytes: number | null;
  duration_amount: number | null;
  duration_unit: DiscountCode['durationUnit'];
  max_redemptions: number | null;
  per_user: DiscountCode['perUserRedemption'];
  eligible_users: DiscountCode['eligibleUsers'];
  eligible_account_type: DiscountCode['eligibleAccountType'];
  can_stack: boolean;
  assignment_method: DiscountCode['assignmentMethod'];
  campaign_id: string | null;
  partner_id: string | null;
  platform_code: string | null;
  revenue_share_percent: number | null;
  created_at: string;
  updated_at: string;
};

function quantityFor(row: PromotionRow): number {
  if (row.benefit_type === 'percentage') return Number(row.percent_off ?? 0);
  if (row.benefit_type === 'fixed_amount') return (row.amount_cents ?? 0) / 100;
  if (row.benefit_type === 'bonus_storage') return (Number(row.bonus_storage_bytes ?? 0)) / (1024 * 1024 * 1024);
  if (row.benefit_type === 'free_tool_slots') return row.slot_count ?? 0;
  return 0;
}

function sourceLabel(source: string): RedemptionSource {
  if (source === 'user_entered') return 'user_entered';
  if (source === 'admin_assigned') return 'admin_assigned';
  return 'auto_assigned';
}

export async function listDiscountCodes(): Promise<DiscountCode[]> {
  const [promotions, tools, assignments, partners, campaigns, catalog] = await Promise.all([
    supabaseServer.from('promotions').select('*').order('created_at', { ascending: false }),
    supabaseServer.from('promotion_tools').select('promotion_id, tool_id'),
    supabaseServer.from('promotion_assignments').select('id, promotion_id, user_id, assigned_at, effective_at, expires_at, removed_at, source, users!promotion_assignments_user_id_fkey(first_name, last_name)'),
    supabaseServer.from('partners').select('id, name'),
    supabaseServer.from('campaigns').select('id, name, partner_id, platform_code'),
    supabaseServer.from('tools').select('id, name'),
  ]);
  if (promotions.error) throw promotions.error;
  if (tools.error) throw tools.error;
  if (assignments.error) throw assignments.error;

  const toolName = new Map((catalog.data ?? []).map((tool) => [tool.id, tool.name]));
  const partnerName = new Map((partners.data ?? []).map((partner) => [partner.id, partner.name]));
  const campaignById = new Map((campaigns.data ?? []).map((campaign) => [campaign.id, campaign]));
  const slugsByPromotion = new Map<string, string[]>();
  for (const link of tools.data ?? []) {
    const slug = slugForName(toolName.get(link.tool_id) || '');
    if (!slug) continue;
    const list = slugsByPromotion.get(link.promotion_id) ?? [];
    list.push(slug);
    slugsByPromotion.set(link.promotion_id, list);
  }

  const now = Date.now();
  const byPromotion = new Map<string, DiscountRedemption[]>();
  const counts = new Map<string, { total: number; activeUsers: Set<string>; expired: number }>();
  for (const row of assignments.data ?? []) {
    if (!row.promotion_id) continue;
    const count = counts.get(row.promotion_id) ?? { total: 0, activeUsers: new Set<string>(), expired: 0 };
    count.total += 1;
    const active = !row.removed_at && Date.parse(row.effective_at) <= now && (!row.expires_at || Date.parse(row.expires_at) > now);
    const expired = !row.removed_at && row.expires_at && Date.parse(row.expires_at) <= now;
    if (active) count.activeUsers.add(row.user_id);
    if (expired) count.expired += 1;
    counts.set(row.promotion_id, count);
    const person = Array.isArray(row.users) ? row.users[0] : row.users;
    const name = `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || 'Account';
    const list = byPromotion.get(row.promotion_id) ?? [];
    list.push({
      id: row.id,
      userName: name,
      redeemedAt: row.assigned_at,
      status: expired || row.removed_at ? 'expired' : 'active',
      expiresAt: row.expires_at,
      source: sourceLabel(row.source),
    });
    byPromotion.set(row.promotion_id, list);
  }

  return ((promotions.data ?? []) as PromotionRow[]).map((row) => {
    const campaign = row.campaign_id ? campaignById.get(row.campaign_id) : null;
    const count = counts.get(row.id);
    return {
      id: row.id,
      internalName: row.internal_name,
      publicCode: row.public_code || '',
      customerDescription: row.customer_description,
      adminNotes: row.admin_notes || '',
      status: row.status,
      redeemStartDate: row.redeem_start_date || '',
      redeemEndDate: row.redeem_end_date || '',
      discountType: row.benefit_type,
      quantity: quantityFor(row),
      slotMode: row.slot_mode || 'additional',
      toolSlugs: slugsByPromotion.get(row.id) ?? [],
      durationUnit: row.duration_unit,
      durationAmount: row.duration_amount ?? 1,
      maxRedemptionsMode: row.max_redemptions == null ? 'unlimited' : 'custom',
      maxRedemptions: row.max_redemptions,
      perUserRedemption: row.per_user,
      eligibleUsers: row.eligible_users,
      eligibleAccountType: row.eligible_account_type,
      canStack: row.can_stack,
      assignmentMethod: row.assignment_method,
      partnerName: campaign ? (partnerName.get(campaign.partner_id) || '') : (row.partner_id ? partnerName.get(row.partner_id) || '' : ''),
      platform: ((campaign?.platform_code || row.platform_code || '') as DiscountCode['platform']),
      campaignName: campaign?.name || '',
      revenueSharePercent: row.revenue_share_percent == null ? '' : String(row.revenue_share_percent),
      partnerNotes: '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      redemptionCount: count?.total ?? 0,
      activeUsers: count?.activeUsers.size ?? 0,
      expiredAssignments: count?.expired ?? 0,
      estimatedMonthlyDiscount: 0,
      redemptions: byPromotion.get(row.id) ?? [],
    };
  });
}

function benefitPayload(draft: DiscountCodeDraft) {
  const empty = {
    slot_mode: null as string | null,
    slot_count: null as number | null,
    percent_off: null as number | null,
    amount_cents: null as number | null,
    bonus_storage_bytes: null as number | null,
  };
  if (draft.discountType === 'free_tool_slots') {
    return { ...empty, slot_mode: draft.slotMode, slot_count: Math.round(draft.quantity) };
  }
  if (draft.discountType === 'percentage') return { ...empty, percent_off: draft.quantity };
  if (draft.discountType === 'fixed_amount') return { ...empty, amount_cents: Math.round(draft.quantity * 100) };
  if (draft.discountType === 'bonus_storage') {
    return { ...empty, bonus_storage_bytes: Math.round(draft.quantity * 1024 * 1024 * 1024) };
  }
  return empty;
}

async function resolveAttribution(draft: DiscountCodeDraft): Promise<{ campaign_id: string | null; partner_id: string | null; platform_code: string | null }> {
  const platform = draft.platform || null;
  const partnerName = draft.partnerName.trim();
  const campaignName = draft.campaignName.trim();
  let partnerId: string | null = null;
  if (partnerName) {
    const found = await supabaseServer.from('partners').select('id').eq('name', partnerName).maybeSingle();
    if (found.error) throw found.error;
    if (found.data) partnerId = found.data.id;
    else {
      const created = await supabaseServer.from('partners').insert({ name: partnerName, status: 'active' }).select('id').single();
      if (created.error || !created.data) throw created.error ?? new Error('partner');
      partnerId = created.data.id;
    }
  }
  if (!campaignName) return { campaign_id: null, partner_id: partnerId, platform_code: platform };
  if (!partnerId || !platform) {
    throw new Error('A campaign needs a partner and a platform.');
  }
  const foundCampaign = await supabaseServer.from('campaigns').select('id').eq('name', campaignName).eq('partner_id', partnerId).maybeSingle();
  if (foundCampaign.error) throw foundCampaign.error;
  if (foundCampaign.data) return { campaign_id: foundCampaign.data.id, partner_id: null, platform_code: null };
  const createdCampaign = await supabaseServer.from('campaigns').insert({
    name: campaignName,
    partner_id: partnerId,
    platform_code: platform,
    status: 'active',
  }).select('id').single();
  if (createdCampaign.error || !createdCampaign.data) throw createdCampaign.error ?? new Error('campaign');
  return { campaign_id: createdCampaign.data.id, partner_id: null, platform_code: null };
}

async function toolIdsForSlugs(slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const names = slugs.map(nameForSlug).filter((name): name is string => Boolean(name));
  const { data, error } = await supabaseServer.from('tools').select('id, name').in('name', names);
  if (error) throw error;
  const byName = new Map((data ?? []).map((tool) => [tool.name, tool.id]));
  const ids = names.map((name) => byName.get(name)).filter((id): id is string => Boolean(id));
  if (ids.length !== slugs.length) throw new Error('One of the selected tools is not in the catalog.');
  return ids;
}

function promotionWrite(draft: DiscountCodeDraft, attribution: { campaign_id: string | null; partner_id: string | null; platform_code: string | null }) {
  const share = draft.revenueSharePercent.trim();
  return {
    internal_name: draft.internalName.trim(),
    public_code: draft.publicCode.trim() ? draft.publicCode.trim().toUpperCase() : null,
    customer_description: draft.customerDescription.trim(),
    admin_notes: draft.adminNotes.trim() || null,
    status: draft.status,
    redeem_start_date: draft.redeemStartDate || null,
    redeem_end_date: draft.redeemEndDate || null,
    benefit_type: draft.discountType,
    ...benefitPayload(draft),
    duration_unit: draft.durationUnit,
    duration_amount: draft.durationUnit === 'lifetime' ? null : Math.round(draft.durationAmount),
    max_redemptions: draft.maxRedemptionsMode === 'custom' ? draft.maxRedemptions : null,
    per_user: draft.perUserRedemption,
    eligible_users: draft.eligibleUsers,
    eligible_account_type: draft.eligibleAccountType,
    can_stack: draft.canStack,
    assignment_method: draft.assignmentMethod,
    ...attribution,
    revenue_share_percent: share === '' ? null : Number(share),
  };
}

async function logPromotionAction(actorId: string, action: string, promotionId: string, detail: Record<string, unknown> | null) {
  const inserted = await supabaseServer.from('admin_actions').insert({
    actor_user_id: actorId,
    action,
    subject_type: 'promotion',
    subject_id: promotionId,
    detail,
  });
  if (inserted.error) console.error('Admin action was not saved', inserted.error.message);
}

export async function savePromotion(actorId: string, draft: DiscountCodeDraft, promotionId?: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (draft.discountType === 'specific_tools' && draft.toolSlugs.length === 0) {
      return { ok: false, message: 'Choose at least one tool.' };
    }
    const attribution = await resolveAttribution(draft);
    const toolIds = draft.discountType === 'specific_tools' ? await toolIdsForSlugs(draft.toolSlugs) : [];
    const payload = promotionWrite(draft, attribution);
    const saved = await callRpc('save_promotion', {
      p_actor: actorId,
      p_promotion_id: promotionId ?? null,
      p_fields: payload,
      p_tool_ids: toolIds,
    });
    if (!saved.ok) {
      return { ok: false, message: saved.message || 'That discount code could not be saved.' };
    }
    return { ok: true };
  } catch (error) {
    console.error('Promotion save failed', error instanceof Error ? error.message : 'unknown');
    return { ok: false, message: error instanceof Error && error.message.includes('campaign') ? error.message : 'That discount code could not be saved.' };
  }
}

export async function setPromotionStatus(actorId: string, promotionId: string, status: DiscountCode['status']) {
  const previous = await supabaseServer.from('promotions').select('status').eq('id', promotionId).maybeSingle();
  const updated = await supabaseServer.from('promotions').update({ status }).eq('id', promotionId);
  if (updated.error) return { ok: false as const, message: 'That status could not be saved.' };
  await logPromotionAction(actorId, status === 'archived' ? 'promotion_archived' : 'promotion_edited', promotionId, {
    status: { from: previous.data?.status ?? null, to: status },
  });
  return { ok: true as const };
}

export async function assignManualEntitlement(input: {
  userId: string;
  actorId: string;
  effectiveAt: string;
  note: string;
  benefitType: string;
  slotMode: string | null;
  slotCount: number | null;
  percentOff: number | null;
  amountCents: number | null;
  bonusStorageBytes: number | null;
  durationUnit: string;
  durationAmount: number | null;
  displayName: string;
  customerDescription: string;
  toolIds: string[];
}): Promise<AssignmentResult> {
  const payload = await callRpc('assign_manual_entitlement', {
    p_user_id: input.userId,
    p_actor: input.actorId,
    p_effective_at: input.effectiveAt,
    p_note: input.note,
    p_benefit_type: input.benefitType,
    p_slot_mode: input.slotMode,
    p_slot_count: input.slotCount,
    p_percent_off: input.percentOff,
    p_amount_cents: input.amountCents,
    p_bonus_storage_bytes: input.bonusStorageBytes,
    p_duration_unit: input.durationUnit,
    p_duration_amount: input.durationAmount,
    p_display_name: input.displayName,
    p_customer_description: input.customerDescription,
    p_tool_ids: input.toolIds,
  });
  if (!payload.ok) return { ok: false, code: 'failed', message: 'That entitlement could not be saved.' };
  return { ok: true, code: 'ok', message: 'The entitlement was added.', effectiveAt: input.effectiveAt, expiresAt: payload.expires_at ?? null };
}

export async function endAssignment(actorId: string, assignmentId: string, reason: string) {
  const updated = await supabaseServer.from('promotion_assignments').update({
    removed_at: new Date().toISOString(),
    removed_by_user_id: actorId,
    removal_reason: reason.trim() || null,
  }).eq('id', assignmentId).is('removed_at', null);
  if (updated.error) {
    console.error('Assignment removal failed', updated.error.message);
    return { ok: false as const, message: 'That benefit could not be ended.' };
  }
  await supabaseServer.from('admin_actions').insert({
    actor_user_id: actorId,
    action: 'assignment_removed',
    subject_type: 'assignment',
    subject_id: assignmentId,
    note: reason.trim() || null,
  });
  return { ok: true as const };
}

export async function persistAccountNotices(userId: string, effectiveAt: Date) {
  const inputs = await loadAccountPricingInputs([userId]);
  const input = inputs.get(userId);
  if (!input) return [];
  const drafts = draftAccountNotices(input, effectiveAt);
  if (drafts.length === 0) return [];
  const inserted = await supabaseServer.from('account_notices').upsert(drafts.map((draft) => ({
    user_id: userId,
    kind: draft.kind,
    event_key: draft.eventKey,
    severity: draft.severity,
    title: draft.title,
    body: draft.body,
    href: draft.href,
  })), { onConflict: 'user_id,event_key', ignoreDuplicates: true });
  if (inserted.error) console.error('Notice insert failed', inserted.error.message);
  return drafts;
}
