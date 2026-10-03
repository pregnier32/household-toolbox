export type DefaultPromotionShape = {
  id: string;
  publicCode: string | null;
  status: string;
  assignmentMethod: string;
  benefitType: string;
  eligibleUsers: string;
  eligibleAccountType: string;
  slotMode: string | null;
};

export type EnsureStatus = 'granted' | 'already_present' | 'skipped' | 'failed';

export type EnsureResult = {
  status: EnsureStatus;
  reason?: string;
};

export type DefaultEntitlementDeps = {
  loadContext: (userId: string) => Promise<{ accountType: string | null; isBillingOwner: boolean } | null>;
  loadDefaultPromotion: () => Promise<DefaultPromotionShape | null>;
  hasAssignment: (userId: string, promotionId: string) => Promise<boolean>;
  assign: (userId: string, promotionId: string) => Promise<{ ok: boolean; code: string }>;
};

export function isDefaultNewUserPromotion(promotion: DefaultPromotionShape | null): boolean {
  if (!promotion) return false;
  return promotion.publicCode?.trim().toLowerCase() === 'newuser2'
    && promotion.status === 'active'
    && promotion.assignmentMethod === 'automatic'
    && promotion.benefitType === 'free_tool_slots'
    && promotion.slotMode === 'total'
    && promotion.eligibleUsers === 'new_users'
    && (promotion.eligibleAccountType === 'personal' || promotion.eligibleAccountType === 'all');
}

/**
 * Repairs a missing NEWUSER2 benefit for a personal household billing admin.
 * Safe to call on every session. A process cache skips repeat lookups after success.
 * A database failure is not cached, so a later session can retry.
 * Automatic grants do not write admin_actions; the assignment service only audits superadmin assignments.
 */
export async function ensureDefaultAccountEntitlements(
  userId: string,
  deps: DefaultEntitlementDeps,
  cache: Set<string> = new Set(),
): Promise<EnsureResult> {
  if (cache.has(userId)) return { status: 'already_present' };
  try {
    const context = await deps.loadContext(userId);
    if (!context?.isBillingOwner) return { status: 'skipped', reason: 'not_billing_owner' };
    if (context.accountType !== 'personal') {
      cache.add(userId);
      return { status: 'skipped', reason: 'not_personal' };
    }
    const promotion = await deps.loadDefaultPromotion();
    if (!isDefaultNewUserPromotion(promotion) || !promotion) {
      return { status: 'skipped', reason: 'promotion_not_default' };
    }
    if (await deps.hasAssignment(userId, promotion.id)) {
      cache.add(userId);
      return { status: 'already_present' };
    }
    const assigned = await deps.assign(userId, promotion.id);
    if (assigned.ok || assigned.code === 'already_used') {
      cache.add(userId);
      return { status: assigned.ok ? 'granted' : 'already_present' };
    }
    return { status: 'failed', reason: assigned.code };
  } catch (error) {
    console.error('Default entitlement check failed', error instanceof Error ? error.message : 'unknown');
    return { status: 'failed', reason: 'failed' };
  }
}
