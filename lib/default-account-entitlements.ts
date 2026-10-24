export type DefaultPromotionShape = {
  id: string;
  publicCode: string | null;
  status: string;
  isSitePromo: boolean;
  eligibleAccountType: string;
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

export function isSitePromo(promotion: DefaultPromotionShape | null): boolean {
  return Boolean(promotion?.isSitePromo) && promotion?.status === 'active';
}

function accountCanReceiveSitePromo(accountType: string | null, promotion: DefaultPromotionShape): boolean {
  if (promotion.eligibleAccountType === 'all') return true;
  return accountType === promotion.eligibleAccountType;
}

/**
 * Grants the discount code flagged as the site promo to a new household billing account.
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
    const promotion = await deps.loadDefaultPromotion();
    if (!isSitePromo(promotion) || !promotion) {
      return { status: 'skipped', reason: 'promotion_not_default' };
    }
    if (!accountCanReceiveSitePromo(context.accountType, promotion)) {
      return { status: 'skipped', reason: 'account_type' };
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
