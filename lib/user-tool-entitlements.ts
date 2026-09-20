import { supabaseServer } from '@/lib/supabaseServer';

export type ToolEntitlementResult = {
  isFirstStart: boolean;
  trialGranted: boolean;
  trialUsed: boolean;
  firstStartedAt: string;
};

function isMissingRelationError(error: { message?: string; code?: string } | null): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function toolOffersTrial(tool: { name?: string | null; price?: number | null }): boolean {
  if (tool.name === 'Home Maintenance Schedule' && Number(tool.price) <= 0) {
    return false;
  }
  return Number(tool.price) > 0;
}

/**
 * Insert-once ledger for a user + catalog tool.
 * Existing rows are never updated by Remove or delete_user_tool.
 * A first insert with grantTrial=true consumes the one 7-day trial.
 */
export async function ensureToolEntitlement(
  userId: string,
  toolId: string,
  options: { grantTrial: boolean }
): Promise<ToolEntitlementResult> {
  const { data: existing, error: existingError } = await supabaseServer
    .from('user_tool_entitlements')
    .select('first_started_at, trial_used')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .maybeSingle();

  if (existingError && !isMissingRelationError(existingError)) {
    throw existingError;
  }

  if (existing) {
    return {
      isFirstStart: false,
      trialGranted: false,
      trialUsed: existing.trial_used,
      firstStartedAt: existing.first_started_at,
    };
  }

  const now = new Date().toISOString();
  const grantTrial = options.grantTrial;
  const { data: inserted, error: insertError } = await supabaseServer
    .from('user_tool_entitlements')
    .insert({
      user_id: userId,
      tool_id: toolId,
      first_started_at: now,
      trial_started_at: grantTrial ? now : null,
      trial_used: grantTrial,
    })
    .select('first_started_at, trial_used')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: raced, error: racedError } = await supabaseServer
        .from('user_tool_entitlements')
        .select('first_started_at, trial_used')
        .eq('user_id', userId)
        .eq('tool_id', toolId)
        .single();
      if (racedError) throw racedError;
      return {
        isFirstStart: false,
        trialGranted: false,
        trialUsed: raced.trial_used,
        firstStartedAt: raced.first_started_at,
      };
    }
    throw insertError;
  }

  return {
    isFirstStart: true,
    trialGranted: grantTrial,
    trialUsed: inserted.trial_used,
    firstStartedAt: inserted.first_started_at,
  };
}

export async function getUsedTrialToolIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabaseServer
    .from('user_tool_entitlements')
    .select('tool_id')
    .eq('user_id', userId);

  if (error) {
    if (isMissingRelationError(error)) return new Set();
    throw error;
  }

  return new Set((data || []).map((row) => row.tool_id));
}
