import { supabaseServer } from '@/lib/supabaseServer';
import type { Json } from '@/src/types/supabase';
import type { AccountPricingInput } from './account-pricing';
import {
  billingSchedule,
  describeBillingCycle,
  isPaidCommitment,
  toPeriodRecord,
  toolsOwnedBy,
  type PeriodToolRecord,
} from './billing-cycle';

export type PeriodLoad = {
  available: boolean;
  frozen: PeriodToolRecord[] | null;
};

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return error.code === '42P01' || error.code === 'PGRST205' || message.includes('billing_periods') && message.includes('does not exist') || message.includes('schema cache');
}

function asRecords(value: Json): PeriodToolRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const row = item as Record<string, Json | undefined>;
    if (typeof row.toolId !== 'string' || typeof row.name !== 'string') return [];
    return [{
      toolId: row.toolId,
      name: row.name,
      shelfPriceCents: Number(row.shelfPriceCents ?? 0),
      catalogPriceCents: Number(row.catalogPriceCents ?? 0),
      ownedAt: typeof row.ownedAt === 'string' ? row.ownedAt : new Date(0).toISOString(),
      trialStartedAt: typeof row.trialStartedAt === 'string' ? row.trialStartedAt : null,
      trialUsed: Boolean(row.trialUsed),
      scheduledRemoval: Boolean(row.scheduledRemoval),
    }];
  });
}

export async function loadSignupAt(userId: string): Promise<string | null> {
  const { data, error } = await supabaseServer.from('users').select('created_at').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data?.created_at ?? null;
}

export async function loadFrozenPeriod(userId: string, periodStart: string): Promise<PeriodLoad> {
  const { data, error } = await supabaseServer.from('billing_periods').select('id, period_start, tools').eq('user_id', userId);
  if (error) {
    if (missingTable(error)) return { available: false, frozen: null };
    throw error;
  }
  const target = Date.parse(periodStart);
  const match = (data ?? []).find((row) => Date.parse(row.period_start) === target);
  if (!match) return { available: true, frozen: null };
  return { available: true, frozen: asRecords(match.tools) };
}

export async function materializeBillingPeriod(
  input: AccountPricingInput,
  signupAt: string,
  effectiveAt: Date,
): Promise<PeriodToolRecord[] | null> {
  const schedule = billingSchedule(signupAt, effectiveAt);
  if (!schedule.periodStart) return null;
  const existing = await loadFrozenPeriod(input.userId, schedule.periodStart);
  if (!existing.available) return null;
  if (existing.frozen) return existing.frozen;
  const tools = toolsOwnedBy(input.tools, new Date(schedule.periodStart)).map((tool) => toPeriodRecord(tool));
  const inserted = await supabaseServer.from('billing_periods').insert({
    user_id: input.userId,
    period_start: schedule.periodStart,
    tools: tools as unknown as Json,
  });
  if (inserted.error) {
    if (inserted.error.code === '23505') {
      const raced = await loadFrozenPeriod(input.userId, schedule.periodStart);
      return raced.frozen ?? tools;
    }
    if (missingTable(inserted.error)) return null;
    throw inserted.error;
  }
  return tools;
}

export async function commitToolRemoval(
  input: AccountPricingInput,
  signupAt: string,
  effectiveAt: Date,
  toolId: string,
): Promise<void> {
  const schedule = billingSchedule(signupAt, effectiveAt);
  if (!schedule.periodStart) return;
  const frozen = await materializeBillingPeriod(input, signupAt, effectiveAt);
  if (!frozen) return;
  const cycle = describeBillingCycle(input, signupAt, effectiveAt, frozen);
  const priced = cycle.period?.tools.find((tool) => tool.toolId === toolId);
  const nextTools = priced && isPaidCommitment(priced)
    ? frozen.map((record) => record.toolId === toolId ? { ...record, scheduledRemoval: true } : record)
    : frozen.filter((record) => record.toolId !== toolId);
  const row = await supabaseServer.from('billing_periods').select('id, period_start').eq('user_id', input.userId);
  if (row.error) {
    if (missingTable(row.error)) return;
    throw row.error;
  }
  const target = Date.parse(schedule.periodStart);
  const match = (row.data ?? []).find((item) => Date.parse(item.period_start) === target);
  if (!match) return;
  const updated = await supabaseServer.from('billing_periods').update({
    tools: nextTools as unknown as Json,
  }).eq('id', match.id);
  if (updated.error) throw updated.error;
}
