import { supabaseServer } from '@/lib/supabaseServer';
import type { Json } from '@/src/types/supabase';
import type { AccountPricingInput } from './account-pricing';
import {
  billingSchedule,
  planToolRemoval,
  toPeriodRecord,
  toolsOwnedBy,
  type PeriodToolRecord,
  type ToolRemovalPlan,
} from './billing-cycle';
import { BillingCommitmentError } from './billing-tool-removal';

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

async function periodRowId(userId: string, periodStart: string): Promise<string | null> {
  const row = await supabaseServer.from('billing_periods').select('id, period_start').eq('user_id', userId);
  if (row.error) {
    if (missingTable(row.error)) throw new BillingCommitmentError();
    throw row.error;
  }
  const target = Date.parse(periodStart);
  return (row.data ?? []).find((item) => Date.parse(item.period_start) === target)?.id ?? null;
}

async function writePeriodTools(userId: string, periodStart: string, tools: PeriodToolRecord[], hadRow: boolean): Promise<void> {
  if (!hadRow) {
    const inserted = await supabaseServer.from('billing_periods').insert({
      user_id: userId,
      period_start: periodStart,
      tools: tools as unknown as Json,
    });
    if (!inserted.error) return;
    if (inserted.error.code !== '23505') throw inserted.error;
  }
  const id = await periodRowId(userId, periodStart);
  if (!id) throw new BillingCommitmentError();
  const updated = await supabaseServer.from('billing_periods').update({
    tools: tools as unknown as Json,
  }).eq('id', id).select('id');
  if (updated.error) throw updated.error;
  if (!updated.data?.length) throw new BillingCommitmentError();
}

export async function loadRemovalPlan(
  input: AccountPricingInput,
  signupAt: string,
  effectiveAt: Date,
  toolId: string,
): Promise<{ plan: ToolRemovalPlan; periodStart: string | null; canPersist: boolean }> {
  const schedule = billingSchedule(signupAt, effectiveAt);
  if (!schedule.periodStart) {
    return { plan: planToolRemoval(input, signupAt, effectiveAt, toolId, null), periodStart: null, canPersist: true };
  }
  const loaded = await loadFrozenPeriod(input.userId, schedule.periodStart);
  return {
    plan: planToolRemoval(input, signupAt, effectiveAt, toolId, loaded.available ? loaded.frozen : null),
    periodStart: schedule.periodStart,
    canPersist: loaded.available,
  };
}

export async function persistScheduledRemoval(
  userId: string,
  periodStart: string,
  tools: PeriodToolRecord[],
  toolId: string,
): Promise<void> {
  const existing = await loadFrozenPeriod(userId, periodStart);
  if (!existing.available) throw new BillingCommitmentError();
  await writePeriodTools(userId, periodStart, tools, Boolean(existing.frozen));
  const saved = await loadFrozenPeriod(userId, periodStart);
  const line = saved.frozen?.find((record) => record.toolId === toolId);
  if (!saved.available || !line?.scheduledRemoval) throw new BillingCommitmentError();
}

export async function dropUncommittedPeriodTool(userId: string, periodStart: string, toolId: string): Promise<void> {
  const existing = await loadFrozenPeriod(userId, periodStart);
  if (!existing.available || !existing.frozen) return;
  const tools = existing.frozen.filter((record) => record.toolId !== toolId);
  if (tools.length === existing.frozen.length) return;
  await writePeriodTools(userId, periodStart, tools, true);
}
