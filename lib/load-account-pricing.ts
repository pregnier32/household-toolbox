import { supabaseServer } from '@/lib/supabaseServer';
import {
  calculateAccountPricing,
  dollarsToCents,
  nextPricingInstant,
  type AccountPricingInput,
  type AccountPricingState,
  type BenefitType,
  type PricingAssignmentInput,
  type SlotMode,
} from '@/lib/account-pricing';

type UserRow = {
  id: string;
  account_type: string | null;
  is_test_account: boolean | null;
  storage_used_bytes: number | null;
  storage_addon_gb: number | null;
};

type OwnedToolRow = {
  user_id: string;
  tool_id: string;
  price: number | null;
  created_at: string;
  tools: { id: string; name: string; price: number | null } | { id: string; name: string; price: number | null }[] | null;
};

type EntitlementRow = {
  user_id: string;
  tool_id: string;
  trial_started_at: string | null;
  trial_used: boolean;
};

type AssignmentRow = {
  id: string;
  user_id: string;
  benefit_type: string;
  slot_mode: string | null;
  slot_count: number | null;
  percent_off: number | null;
  amount_cents: number | null;
  bonus_storage_bytes: number | null;
  effective_at: string;
  expires_at: string | null;
  removed_at: string | null;
  display_name: string;
  public_code: string | null;
  customer_description_snapshot: string;
  source: string;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function asBenefit(value: string): BenefitType {
  if (
    value === 'free_tool_slots'
    || value === 'specific_tools'
    || value === 'percent_100'
    || value === 'percentage'
    || value === 'fixed_amount'
    || value === 'bonus_storage'
  ) return value;
  return 'percent_100';
}

export async function loadAccountPricingInputs(userIds: string[]): Promise<Map<string, AccountPricingInput>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const result = new Map<string, AccountPricingInput>();
  if (ids.length === 0) return result;

  const [users, owned, entitlements, assignments] = await Promise.all([
    supabaseServer
      .from('users')
      .select('id, account_type, is_test_account, storage_used_bytes, storage_addon_gb')
      .in('id', ids),
    supabaseServer
      .from('users_tools')
      .select('user_id, tool_id, price, created_at, tools (id, name, price)')
      .in('user_id', ids)
      .eq('status', 'active'),
    supabaseServer
      .from('user_tool_entitlements')
      .select('user_id, tool_id, trial_started_at, trial_used')
      .in('user_id', ids),
    supabaseServer
      .from('promotion_assignments')
      .select('id, user_id, benefit_type, slot_mode, slot_count, percent_off, amount_cents, bonus_storage_bytes, effective_at, expires_at, removed_at, display_name, public_code, customer_description_snapshot, source')
      .in('user_id', ids),
  ]);

  if (users.error) throw users.error;
  if (owned.error) throw owned.error;
  if (entitlements.error) throw entitlements.error;
  if (assignments.error) throw assignments.error;

  const assignmentIds = (assignments.data ?? []).map((row) => row.id);
  const toolLinks = assignmentIds.length === 0
    ? { data: [] as { assignment_id: string; tool_id: string }[], error: null }
    : await supabaseServer
      .from('promotion_assignment_tools')
      .select('assignment_id, tool_id')
      .in('assignment_id', assignmentIds);
  if (toolLinks.error) throw toolLinks.error;

  const toolsByAssignment = new Map<string, string[]>();
  for (const link of toolLinks.data ?? []) {
    const list = toolsByAssignment.get(link.assignment_id) ?? [];
    list.push(link.tool_id);
    toolsByAssignment.set(link.assignment_id, list);
  }

  const trialByUser = new Map<string, Map<string, EntitlementRow>>();
  for (const row of (entitlements.data ?? []) as EntitlementRow[]) {
    const map = trialByUser.get(row.user_id) ?? new Map<string, EntitlementRow>();
    map.set(row.tool_id, row);
    trialByUser.set(row.user_id, map);
  }

  const ownedByUser = new Map<string, OwnedToolRow[]>();
  for (const row of (owned.data ?? []) as OwnedToolRow[]) {
    const list = ownedByUser.get(row.user_id) ?? [];
    list.push(row);
    ownedByUser.set(row.user_id, list);
  }

  const assignmentsByUser = new Map<string, AssignmentRow[]>();
  for (const row of (assignments.data ?? []) as AssignmentRow[]) {
    const list = assignmentsByUser.get(row.user_id) ?? [];
    list.push(row);
    assignmentsByUser.set(row.user_id, list);
  }

  for (const user of (users.data ?? []) as UserRow[]) {
    const trials = trialByUser.get(user.id) ?? new Map<string, EntitlementRow>();
    const assignmentInputs: PricingAssignmentInput[] = (assignmentsByUser.get(user.id) ?? []).map((row) => ({
      id: row.id,
      benefitType: asBenefit(row.benefit_type),
      slotMode: row.slot_mode === 'additional' || row.slot_mode === 'total' ? row.slot_mode as SlotMode : null,
      slotCount: row.slot_count,
      percentOff: row.percent_off == null ? null : Number(row.percent_off),
      amountCents: row.amount_cents,
      bonusStorageBytes: row.bonus_storage_bytes == null ? null : Number(row.bonus_storage_bytes),
      effectiveAt: row.effective_at,
      expiresAt: row.expires_at,
      removedAt: row.removed_at,
      displayName: row.display_name,
      publicCode: row.public_code,
      customerDescription: row.customer_description_snapshot,
      source: row.source,
      toolIds: toolsByAssignment.get(row.id) ?? [],
    }));

    result.set(user.id, {
      userId: user.id,
      accountType: user.account_type === 'business' ? 'business' : 'personal',
      isTestAccount: Boolean(user.is_test_account),
      storageUsedBytes: Number(user.storage_used_bytes ?? 0),
      storageAddonGb: Number(user.storage_addon_gb ?? 0),
      tools: (ownedByUser.get(user.id) ?? []).map((row) => {
        const catalog = one(row.tools);
        const trial = trials.get(row.tool_id);
        const shelf = row.price == null ? Number(catalog?.price ?? 0) : Number(row.price);
        return {
          toolId: row.tool_id,
          name: catalog?.name || 'Tool',
          shelfPriceCents: dollarsToCents(shelf),
          ownedAt: row.created_at,
          trialStartedAt: trial?.trial_started_at ?? null,
          trialUsed: Boolean(trial?.trial_used),
        };
      }),
      assignments: assignmentInputs,
    });
  }

  return result;
}

export async function getAccountPricingState(userId: string, effectiveAt: Date): Promise<AccountPricingState | null> {
  const inputs = await loadAccountPricingInputs([userId]);
  const input = inputs.get(userId);
  if (!input) return null;
  return calculateAccountPricing(input, effectiveAt);
}

export async function getAccountPricingProjection(userId: string, effectiveAt: Date): Promise<{
  current: AccountPricingState;
  input: AccountPricingInput;
  upcoming: { at: string; state: AccountPricingState } | null;
} | null> {
  const inputs = await loadAccountPricingInputs([userId]);
  const input = inputs.get(userId);
  if (!input) return null;
  const current = calculateAccountPricing(input, effectiveAt);
  const next = nextPricingInstant(input, effectiveAt);
  return {
    current,
    input,
    upcoming: next ? { at: next.toISOString(), state: calculateAccountPricing(input, next) } : null,
  };
}
