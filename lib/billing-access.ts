import { NextResponse } from 'next/server';
import { loadCollectibleSnapshot } from './billing-amount';
import { remainingDueCents } from './billing-ledger';
import { describeBillingCycle } from './billing-cycle';
import { loadFrozenPeriod } from './billing-period-store';
import { loadAccountPricingInputs } from './load-account-pricing';
import {
  listPaymentAttention,
  listStoredInvoices,
  loadBillingAccount,
  syncHouseholdToolAccess,
} from './billing-store';
import { collectionNeedsRefresh, reconcileCustomerPayments, reconcileOpenCheckoutAttempts } from './billing-payment-state';
import { billingAccountForMode } from './billing-environment';
import { supabaseServer } from './supabaseServer';
import {
  describeToolAccessPolicy,
  toolAccessDenial,
  type AccessInvoice,
  type ToolAccessPolicy,
} from './tool-access-policy';

export type { ToolAccessPolicy } from './tool-access-policy';
export {
  LOCKED_ADMIN_MESSAGE,
  LOCKED_MEMBER_MESSAGE,
  TOOL_ACCESS_UNVERIFIED_MESSAGE,
  toolAccessDenial,
  toolAccessNotice,
  unverifiedToolAccessNotice,
} from './tool-access-policy';

export async function loadToolAccessPolicy(
  userId: string,
  now = new Date(),
  options?: { requireSavedLock?: boolean },
): Promise<ToolAccessPolicy> {
  const checkoutAttempt = await reconcileOpenCheckoutAttempts(userId).catch((error: unknown) => {
    console.error('Checkout payment state could not be read', error instanceof Error ? error.message : 'unknown');
    return null;
  });
  const storedInvoices = await listStoredInvoices(userId);
  const needsStripe = storedInvoices.some((invoice) => (
    (invoice.status === 'open' || invoice.status === 'uncollectible')
    && collectionNeedsRefresh(invoice.collectionCheckedAt, now)
  ));
  if (needsStripe) {
    await reconcileCustomerPayments(userId, now).catch((error: unknown) => {
      console.error('Stripe payment state could not be reconciled', error instanceof Error ? error.message : 'unknown');
    });
  }
  const [snapshot, account, invoices, attention, pricing] = await Promise.all([
    loadCollectibleSnapshot(userId, now),
    billingAccountForMode(await loadBillingAccount(userId)),
    needsStripe ? listStoredInvoices(userId) : Promise.resolve(storedInvoices),
    listPaymentAttention(userId),
    loadAccountPricingInputs([userId]),
  ]);
  const input = pricing.get(userId) ?? null;
  let tools: Array<{ toolId: string; name: string; requiresPaymentNow: boolean }> = [];
  let trialActive = false;
  if (input && snapshot) {
    let frozen = null;
    if (snapshot.periodStart) {
      const loaded = await loadFrozenPeriod(userId, snapshot.periodStart);
      frozen = loaded.frozen;
    }
    const cycle = describeBillingCycle(input, snapshot.signupAt, now, frozen);
    trialActive = cycle.current.tools.some((tool) => tool.inTrial);
    const remaining = snapshot.periodStart ? remainingDueCents(snapshot.owedNowCents, invoices, snapshot.periodStart) : snapshot.owedNowCents;
    tools = cycle.current.tools.map((tool) => ({
      toolId: tool.toolId,
      name: tool.name,
      requiresPaymentNow: remaining > 0 && tool.billable && tool.expectedMonthlyCents > 0,
    }));
  }
  const notes = new Map(attention.map((item) => [item.invoiceId, item.collection]));
  const accessInvoices: AccessInvoice[] = invoices.map((invoice) => ({
    id: invoice.stripeInvoiceId,
    role: invoice.role,
    status: invoice.status,
    amountCents: invoice.amountCents,
    amountPaidCents: invoice.amountPaidCents,
    updatedAt: invoice.updatedAt,
    collection: invoice.collectionState ?? notes.get(invoice.stripeInvoiceId) ?? null,
  }));
  for (const note of attention) {
    if (accessInvoices.some((invoice) => invoice.id === note.invoiceId)) continue;
    if (accessInvoices.some((invoice) => invoice.status === 'open' && invoice.collection === note.collection)) continue;
    accessInvoices.push({
      id: note.invoiceId,
      role: 'renewal',
      status: 'open',
      amountCents: Math.max(0, snapshot?.owedNowCents ?? 0),
      amountPaidCents: 0,
      updatedAt: note.createdAt,
      collection: note.collection,
    });
  }
  const policy = describeToolAccessPolicy({
    now,
    tools,
    invoices: accessInvoices,
    subscriptionStatus: account?.subscription_status ?? null,
    cancelAtPeriodEnd: Boolean(account?.cancel_at_period_end),
    currentPeriodEnd: account?.current_period_end ?? null,
    hasSavedPaymentMethod: Boolean(account?.card_brand && account.card_last4),
    owedNowCents: snapshot?.periodStart
      ? remainingDueCents(snapshot.owedNowCents, invoices, snapshot.periodStart)
      : (snapshot?.owedNowCents ?? 0),
    nextAmountCents: snapshot?.nextAmountCents ?? 0,
    nextBillingAt: snapshot?.nextBillingAt ?? null,
    scheduledChargeCents: snapshot?.scheduledChargeCents ?? 0,
    scheduledChargeAt: snapshot?.scheduledChargeAt ?? null,
    paymentAttemptAt: null,
    trialActive,
    checkoutAttempt,
    alreadyLocked: Boolean(account?.tool_access_locked),
  });
  if (options?.requireSavedLock) {
    await syncHouseholdToolAccess(userId, policy.locked, policy.reason);
  } else {
    await syncHouseholdToolAccess(userId, policy.locked, policy.reason).catch((error: unknown) => {
      console.error('Household tool access could not be saved', error instanceof Error ? error.message : 'unknown');
    });
  }
  return policy;
}

export async function refreshHouseholdLock(userId: string, now = new Date()): Promise<void> {
  await loadToolAccessPolicy(userId, now, { requireSavedLock: true });
}

export async function toolAccessSyncResponse(userId: string, now = new Date()): Promise<NextResponse | null> {
  try {
    await refreshHouseholdLock(userId, now);
    return null;
  } catch (error) {
    console.error('Household tool access could not be saved', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({
      error: 'The tool change was saved, but household access could not be updated. Please try again.',
    }, { status: 503 });
  }
}

export async function denyRemovedTool(userId: string, toolName: string): Promise<NextResponse | null> {
  const { data, error } = await supabaseServer
    .from('users_tools')
    .select('status, tools!inner(name)')
    .eq('user_id', userId)
    .eq('tools.name', toolName)
    .maybeSingle();
  if (error) {
    console.error('Removed tool check failed', error.message);
    return NextResponse.json({ error: 'This tool could not be checked.' }, { status: 503 });
  }
  const status = data && typeof data === 'object' && 'status' in data ? String(data.status) : null;
  if (status === 'active') return null;
  return NextResponse.json({
    error: status === 'removing'
      ? 'This tool is being removed.'
      : 'This tool is not on your account.',
  }, { status: 403 });
}

export async function accountToolAccessLocked(userId: string, now = new Date()): Promise<boolean> {
  return (await loadToolAccessPolicy(userId, now)).locked;
}

export async function denyLockedToolAccess(
  userId: string,
  role: 'admin' | 'user' = 'admin',
): Promise<NextResponse | null> {
  const denial = toolAccessDenial(await loadToolAccessPolicy(userId), role);
  if (!denial) return null;
  return NextResponse.json({ error: denial.error }, { status: denial.status });
}
