import { supabaseServer } from './supabaseServer';
import type { HouseholdRole } from './session-types';

export type HouseholdAccess = {
  ready: boolean;
  householdId: string;
  householdRole: HouseholdRole;
  householdOwnerId: string;
};

function selfAdmin(userId: string, ready: boolean): HouseholdAccess {
  return {
    ready,
    householdId: userId,
    householdRole: 'admin',
    householdOwnerId: userId,
  };
}

function isMissingHouseholdTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const message = (error.message || '').toLowerCase();
  return message.includes('does not exist') || message.includes('could not find the table');
}

async function loadMembership(userId: string): Promise<
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'none' }
  | { status: 'found'; access: HouseholdAccess }
> {
  const memberResult = await supabaseServer
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (memberResult.error) {
    if (isMissingHouseholdTable(memberResult.error)) return { status: 'missing' };
    console.error('Household membership lookup failed', memberResult.error.code ?? 'unknown');
    return { status: 'error' };
  }
  if (!memberResult.data) return { status: 'none' };

  const householdResult = await supabaseServer
    .from('households')
    .select('id, admin_user_id')
    .eq('id', memberResult.data.household_id)
    .maybeSingle();

  if (householdResult.error || !householdResult.data) {
    console.error('Household lookup failed', householdResult.error?.code ?? 'missing');
    return { status: 'error' };
  }

  const role: HouseholdRole = memberResult.data.role === 'user' ? 'user' : 'admin';
  return {
    status: 'found',
    access: {
      ready: true,
      householdId: householdResult.data.id,
      householdRole: role,
      householdOwnerId: householdResult.data.admin_user_id,
    },
  };
}

async function provisionHousehold(userId: string): Promise<HouseholdAccess> {
  const inserted = await supabaseServer
    .from('households')
    .insert({ admin_user_id: userId })
    .select('id, admin_user_id')
    .maybeSingle();

  let household = inserted.data;
  if (inserted.error || !household) {
    const existing = await supabaseServer
      .from('households')
      .select('id, admin_user_id')
      .eq('admin_user_id', userId)
      .maybeSingle();
    household = existing.data;
  }
  if (!household) return selfAdmin(userId, false);

  const member = await supabaseServer.from('household_members').insert({
    household_id: household.id,
    user_id: userId,
    role: 'admin',
    status: 'active',
  });

  if (member.error && member.error.code !== '23505') {
    console.error('Household admin membership insert failed', member.error.code ?? 'unknown');
  }

  return {
    ready: true,
    householdId: household.id,
    householdRole: 'admin',
    householdOwnerId: household.admin_user_id,
  };
}

export async function resolveHouseholdAccess(userId: string): Promise<HouseholdAccess> {
  try {
    const loaded = await loadMembership(userId);
    if (loaded.status === 'missing') return selfAdmin(userId, false);
    if (loaded.status === 'error') return selfAdmin(userId, false);
    if (loaded.status === 'found') return loaded.access;
    return provisionHousehold(userId);
  } catch (error) {
    console.error('Household access lookup failed', error instanceof Error ? error.message : 'unknown');
    return selfAdmin(userId, false);
  }
}
