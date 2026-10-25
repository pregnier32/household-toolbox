import { NextRequest, NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { formatCents } from '@/lib/account-pricing';
import { buildCycleCustomerStatement, buildCustomerStatement, toolListCents } from '@/lib/billing-preview';
import { billingSchedule } from '@/lib/billing-cycle';
import { loadFrozenPeriod, loadSignupAt, materializeBillingPeriod } from '@/lib/billing-period-store';
import { formatStorageBytes } from '@/lib/user-storage';
import { loadAccountPricingInputs, projectAccountPricing } from '@/lib/load-account-pricing';
import { persistAccountNotices } from '@/lib/promotion-service';
import { paidCents } from '@/lib/billing-ledger';
import { listStoredInvoices, loadBillingAccount, loadStripeObservedAt } from '@/lib/billing-store';
import { loadCollectibleSnapshot } from '@/lib/billing-amount';
import { describePaymentWorkflow } from '@/lib/billing-payment-workflow';
import { describePaymentMethod } from '@/lib/billing-card';
import { refreshPlanBillingFromStripe, type SavedCardSync } from '@/lib/billing-sync';
import { loadLiveCommencement, billingAccountForMode } from '@/lib/billing-environment';
import { describeCancellationNotice } from '@/lib/billing-subscription';
import { loadToolAccessPolicy } from '@/lib/billing-access';
import { reconcileOpenCheckoutAttempts } from '@/lib/billing-payment-state';
import { planStripeRefreshDue } from '@/lib/plan-stripe-refresh';
import { stripeConfigured } from '@/lib/stripe-server';
import { stripeIdForMode } from '@/lib/stripe-mode';
import type { CustomerPlanBenefit, CustomerPlanSource } from '@/lib/customer-plan-preview';

function day(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

function sourceFor(source: string): CustomerPlanSource {
  if (source === 'user_entered') return 'code';
  if (source === 'automatic') return 'included';
  return 'added';
}

export async function GET(request: NextRequest) {
  const user = await getHouseholdDataSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.householdRole !== 'admin') return NextResponse.json({ error: 'Only the household Admin can view plan and billing.' }, { status: 403 });
  const checkoutSuccess = request.nextUrl.searchParams.get('checkout') === 'success';
  try {
    const now = new Date();
    const [pricingMap, invoices, account, signupAt, assignments, commencement, observedAt] = await Promise.all([
      loadAccountPricingInputs([user.id]),
      listStoredInvoices(user.id),
      loadBillingAccount(user.id),
      loadSignupAt(user.id),
      supabaseServer.from('promotion_assignments').select('id, display_name, public_code, customer_description_snapshot, effective_at, expires_at, removed_at, source').eq('user_id', user.id).order('assigned_at', { ascending: false }),
      loadLiveCommencement(user.id),
      loadStripeObservedAt(user.id),
    ]);
    const input = pricingMap.get(user.id);
    if (!input) return NextResponse.json({ error: 'Account could not be loaded.' }, { status: 404 });
    if (assignments.error) throw assignments.error;
    await persistAccountNotices(user.id, now, input);
    const notice = await supabaseServer.from('account_notices').select('title, body').eq('user_id', user.id).is('read_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const projection = projectAccountPricing(input, now);
    const benefits: CustomerPlanBenefit[] = (assignments.data ?? []).map((row) => {
      return {
        id: row.id,
        name: row.display_name,
        publicCode: row.public_code || '',
        benefit: '',
        description: row.customer_description_snapshot,
        effectiveDate: day(row.effective_at) || '',
        expirationDate: day(row.expires_at),
        status: row.removed_at ? 'removed' as const : 'active' as const,
        source: sourceFor(row.source),
      };
    });
    const state = projection.current;
    let frozen = null;
    if (signupAt) {
      const schedule = billingSchedule(signupAt, now);
      if (schedule.periodStart) {
        const loaded = await loadFrozenPeriod(user.id, schedule.periodStart);
        frozen = loaded.available && !loaded.frozen
          ? await materializeBillingPeriod(projection.input, signupAt, now)
          : loaded.frozen;
      }
    }
    const collectible = await loadCollectibleSnapshot(user.id, now, {
      pricing: input,
      signupAt,
      frozen,
      account,
      commencement,
    });
    let ledger = invoices;
    const checkoutAttempt = checkoutSuccess
      ? await reconcileOpenCheckoutAttempts(user.id).catch((error: unknown) => {
        console.error('Checkout payment state could not be read', error instanceof Error ? error.message : 'unknown');
        return null;
      })
      : null;
    if (checkoutSuccess) ledger = await listStoredInvoices(user.id);
    let statement = buildCustomerStatement(projection.input, state);
    let billingCycle = null;
    if (signupAt) {
      const schedule = billingSchedule(signupAt, now);
      const cycle = buildCycleCustomerStatement(projection.input, signupAt, now, frozen, {
        paidTowardPeriodCents: paidCents(ledger, schedule.periodStart),
        excludedOwedCents: collectible?.historicalOwedCents ?? 0,
        excludedScheduledCents: collectible?.historicalScheduledCents ?? 0,
        excludedToolIds: collectible?.excludedToolIds ?? [],
      });
      statement = cycle.statement;
      billingCycle = cycle.billingCycle;
    }
    const hasSameModeCustomer = Boolean(
      stripeIdForMode(account?.stripe_customer_id, account?.livemode)
      || stripeIdForMode(account?.stripe_subscription_id, account?.livemode),
    );
    let currentAccount = account;
    let cardSync: SavedCardSync | null = null;
    if (stripeConfigured() && planStripeRefreshDue({
      checkoutSuccess,
      hasSameModeCustomer,
      observedAt,
      now: now.getTime(),
    })) {
      const refreshed = await refreshPlanBillingFromStripe(user.id).catch((error: unknown) => {
        console.error('Plan billing could not be read from Stripe', error instanceof Error ? error.message : 'unknown');
        return null;
      });
      if (refreshed) {
        currentAccount = refreshed.account;
        cardSync = refreshed.card;
      }
    }
    const visible = billingAccountForMode(currentAccount);
    const paymentMethodStatus = cardSync?.state
      ?? (visible?.card_brand && visible.card_last4 ? 'saved' : visible?.stripe_customer_id ? 'pending' : 'absent');
    const paymentMethodLabel = paymentMethodStatus === 'saved'
      ? (cardSync?.label ?? (visible?.card_brand && visible.card_last4
        ? describePaymentMethod('saved', { brand: visible.card_brand, last4: visible.card_last4 })
        : null))
      : null;
    const card = describePaymentMethod(paymentMethodStatus, cardSync?.card ?? (visible?.card_brand && visible.card_last4
      ? { brand: visible.card_brand, last4: visible.card_last4 }
      : null));
    const snapshot = collectible;
    const payment = describePaymentWorkflow({
      owedNowCents: snapshot?.owedNowCents ?? 0,
      nextAmountCents: snapshot?.nextAmountCents ?? 0,
      nextBillingAt: snapshot?.nextBillingAt ?? billingCycle?.nextBillingAt ?? null,
      periodStart: snapshot?.periodStart ?? null,
      invoices: ledger,
      account: visible ? {
        subscriptionStatus: visible.subscription_status,
        stripeCustomerId: visible.stripe_customer_id,
        stripeSubscriptionId: visible.stripe_subscription_id,
        hasSavedPaymentMethod: paymentMethodStatus === 'saved',
      } : null,
      paymentMethodLabel,
      paymentMethodStatus,
      trialPaymentDeferred: snapshot?.trialPaymentDeferred ?? false,
      scheduledChargeCents: snapshot?.scheduledChargeCents ?? 0,
      scheduledChargeAt: snapshot?.scheduledChargeAt ?? null,
      historicalCents: (snapshot?.historicalOwedCents ?? 0) + (snapshot?.historicalScheduledCents ?? 0),
    });
    return NextResponse.json({
      accountType: state.accountType,
      freeSlots: state.freeSlots,
      freeSlotsUsed: state.freeSlotsUsed,
      freeSlotsRemaining: state.freeSlotsRemaining,
      tools: state.tools.map((tool) => ({
        id: tool.toolId,
        name: tool.name,
        label: tool.inTrial && tool.daysRemaining != null ? `Free Trial — ${tool.daysRemaining} day${tool.daysRemaining === 1 ? '' : 's'} remaining` : tool.accessLabel,
        amount: tool.billable ? formatCents(tool.expectedMonthlyCents) : null,
        addedAt: tool.ownedAt,
        price: formatCents(toolListCents(tool)),
      })),
      statement,
      billingCycle,
      benefits,
      currentMonthly: formatCents(state.effectiveMonthlyCents),
      upcoming: projection.upcoming ? {
        at: projection.upcoming.at.slice(0, 10),
        amount: formatCents(projection.upcoming.state.effectiveMonthlyCents),
      } : null,
      storageUsed: formatStorageBytes(state.storageUsedBytes),
      storageAllowance: formatStorageBytes(state.effectiveStorageBytes),
      paymentMethod: card,
      paymentMethodStatus,
      paymentAction: payment.action,
      paymentRoute: payment.route,
      paymentExplanation: payment.explanation,
      paymentButtonLabel: payment.buttonLabel,
      collectedTodayCents: payment.collectedTodayCents,
      nextAmountCents: payment.nextAmountCents,
      outstandingInvoiceCents: payment.outstandingInvoiceCents,
      paymentSecondary: payment.secondary,
      subscriptionStatus: visible?.subscription_status ?? null,
      cancellation: describeCancellationNotice({
        scheduled: Boolean(visible?.cancel_at_period_end),
        effectiveAt: visible?.cancel_at_period_end ? visible.current_period_end : null,
      }),
      paymentSetupWouldBeNeeded: state.paymentSetupWouldBeNeeded,
      access: await loadToolAccessPolicy(user.id, now, {
        snapshot: collectible,
        account: visible,
        invoices: ledger,
        pricing: input,
        frozen,
        checkoutAttempt,
      }).then((policy) => ({
        locked: policy.locked,
        pending: policy.pending,
        message: policy.adminMessage,
        warning: policy.warning,
        debtNotice: policy.debtNotice,
        recovery: policy.recovery,
        causingTools: policy.causingTools,
      })).catch(() => null),
      notice: notice.data ? { title: notice.data.title, body: notice.data.body } : null,
    });
  } catch (error) {
    console.error('Plan load failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Plan and billing could not be loaded.' }, { status: 500 });
  }
}
