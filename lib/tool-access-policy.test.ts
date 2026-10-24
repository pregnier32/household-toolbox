import assert from 'node:assert/strict';
import test from 'node:test';
import { trialGrantForStart } from './tool-trial-grant';
import {
  LOCK_WARNING_SENTENCE,
  LOCKED_ADMIN_MESSAGE,
  LOCKED_MEMBER_MESSAGE,
  PAYMENT_PENDING_MS,
  describeToolAccessPolicy,
  TOOL_ACCESS_UNVERIFIED_MESSAGE,
  toolAccessBlocked,
  toolAccessDenial,
  toolAccessNotice,
  unverifiedToolAccessNotice,
  type AccessInvoice,
  type ToolAccessPolicyInput,
} from './tool-access-policy';

const NOW = new Date('2026-10-24T15:00:00.000Z');
const NEXT = '2026-10-31T15:00:00.000Z';
const PAID = { toolId: 'address', name: 'Address Book', requiresPaymentNow: true };
const FREE = { toolId: 'home', name: 'Home Maintenance Schedule', requiresPaymentNow: false };

function policy(overrides: Partial<ToolAccessPolicyInput> = {}) {
  return describeToolAccessPolicy({
    now: NOW,
    tools: [],
    invoices: [],
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    hasSavedPaymentMethod: false,
    owedNowCents: 0,
    nextAmountCents: 0,
    nextBillingAt: NEXT,
    paymentAttemptAt: null,
    trialActive: false,
    ...overrides,
  });
}

function invoice(overrides: Partial<AccessInvoice> = {}): AccessInvoice {
  return {
    id: 'in_1',
    role: 'renewal',
    status: 'open',
    amountCents: 400,
    amountPaidCents: 0,
    updatedAt: '2026-10-24T14:00:00.000Z',
    collection: null,
    ...overrides,
  };
}

test('a free-only household stays unlocked', () => {
  const result = policy({ tools: [FREE] });
  assert.equal(result.locked, false);
  assert.equal(result.pending, false);
  assert.equal(result.reason, 'open');
  assert.equal(result.warning, null);
  assert.equal(result.causingTools.length, 0);
  assert.equal(toolAccessBlocked(result, true), false);
  assert.equal(toolAccessDenial(result, 'admin'), null);
});

test('a positive future bill during a valid trial stays unlocked and warns', () => {
  const result = policy({
    tools: [{ ...PAID, requiresPaymentNow: false }],
    trialActive: true,
    nextAmountCents: 400,
    owedNowCents: 0,
  });
  assert.equal(result.locked, false);
  assert.equal(result.reason, 'trial_warning');
  assert.equal(result.causingTools.length, 0);
  assert.match(result.warning || '', /\$4\.00/);
  assert.match(result.warning || '', /October 31, 2026/);
  assert.match(result.warning || '', new RegExp(LOCK_WARNING_SENTENCE.replace(/[.]/g, '\\.')));
  assert.deepEqual(result.recovery, ['setup_payment', 'review_tools']);
  assert.equal(toolAccessBlocked(result, true), false);
});

test('an active unpaid tool locks paid and free tools, including after a failed charge', () => {
  const missingSetup = policy({
    tools: [PAID, FREE],
    owedNowCents: 400,
  });
  assert.equal(missingSetup.locked, true);
  assert.equal(missingSetup.reason, 'setup_required');
  assert.deepEqual(missingSetup.causingTools, [{ toolId: 'address', name: 'Address Book' }]);
  assert.equal(toolAccessBlocked(missingSetup, true), true);
  assert.match(missingSetup.adminMessage || '', new RegExp(`^${LOCKED_ADMIN_MESSAGE.replace(/[.]/g, '\\.')}`));
  assert.match(missingSetup.adminMessage || '', /\$4\.00/);
  assert.match(missingSetup.adminMessage || '', /including free tools/);

  const failedWithCard = policy({
    tools: [PAID, FREE],
    owedNowCents: 400,
    hasSavedPaymentMethod: true,
    subscriptionStatus: 'past_due',
    invoices: [invoice({ collection: 'failed', updatedAt: NOW.toISOString() })],
  });
  assert.equal(failedWithCard.locked, true);
  assert.equal(failedWithCard.reason, 'payment_failed');
  assert.match(failedWithCard.adminMessage || '', /did not go through/);
  assert.equal(toolAccessBlocked(failedWithCard, true), true);
});

test('a failed access check is unverified and is not an open toolbox', () => {
  const notice = unverifiedToolAccessNotice();
  assert.equal(notice.locked, false);
  assert.equal(notice.unverified, true);
  assert.equal(notice.message, TOOL_ACCESS_UNVERIFIED_MESSAGE);
});

test('invited members get the same lock without billing details', () => {
  const result = policy({ tools: [PAID, FREE], owedNowCents: 400 });
  const member = toolAccessNotice(result, 'user');
  const admin = toolAccessNotice(result, 'admin');
  assert.equal(member.locked, true);
  assert.equal(admin.locked, true);
  assert.equal(member.message, LOCKED_MEMBER_MESSAGE);
  assert.equal(member.message?.includes('$'), false);
  assert.equal(member.message?.includes('Address Book'), false);
  assert.match(admin.message || '', /\$4\.00/);
  const denial = toolAccessDenial(result, 'user');
  assert.equal(denial?.status, 403);
  assert.equal(denial?.error, LOCKED_MEMBER_MESSAGE);
});

test('a confirmed payment restores access and a fresh processing payment does not lock', () => {
  const paid = policy({
    tools: [PAID, FREE],
    owedNowCents: 400,
    hasSavedPaymentMethod: true,
    subscriptionStatus: 'active',
    invoices: [invoice({ status: 'paid', amountPaidCents: 400 })],
  });
  assert.equal(paid.locked, false);
  assert.equal(toolAccessDenial(paid, 'admin'), null);
  const currentNextBill = policy({
    tools: [PAID],
    owedNowCents: 0,
    nextAmountCents: 400,
    hasSavedPaymentMethod: true,
    subscriptionStatus: 'active',
    invoices: [invoice({ status: 'paid', amountPaidCents: 400 })],
  });
  assert.equal(currentNextBill.locked, false);
  assert.equal(currentNextBill.warning, null);

  const processing = policy({
    tools: [PAID],
    owedNowCents: 400,
    invoices: [invoice({ updatedAt: NOW.toISOString() })],
    paymentAttemptAt: NOW.toISOString(),
  });
  assert.equal(processing.locked, false);
  assert.equal(processing.pending, true);
  assert.equal(processing.reason, 'payment_processing');

  const bankStillProcessing = policy({
    tools: [PAID],
    owedNowCents: 400,
    hasSavedPaymentMethod: true,
    subscriptionStatus: 'active',
    invoices: [invoice({
      collection: 'processing',
      updatedAt: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    })],
  });
  assert.equal(bankStillProcessing.locked, false);
  assert.equal(bankStillProcessing.pending, true);
  assert.equal(bankStillProcessing.reason, 'payment_processing');

  const overdue = policy({
    tools: [PAID],
    owedNowCents: 400,
    invoices: [invoice({ collection: 'overdue', updatedAt: new Date(NOW.getTime() - PAYMENT_PENDING_MS - 1000).toISOString() })],
  });
  assert.equal(overdue.locked, true);
  assert.equal(overdue.reason, 'payment_overdue');
  assert.match(overdue.adminMessage || '', /overdue/);

  const draft = policy({
    tools: [PAID],
    owedNowCents: 400,
    subscriptionStatus: 'active',
    hasSavedPaymentMethod: true,
    invoices: [invoice({ status: 'draft', updatedAt: '2026-10-01T15:00:00.000Z' })],
  });
  assert.equal(draft.locked, false);

  const authentication = policy({
    tools: [PAID],
    owedNowCents: 400,
    hasSavedPaymentMethod: true,
    subscriptionStatus: 'active',
    invoices: [invoice({ collection: 'authentication_required', updatedAt: NOW.toISOString() })],
  });
  assert.equal(authentication.locked, true);
  assert.equal(authentication.reason, 'authentication_required');
  assert.match(authentication.adminMessage || '', /confirm a payment of \$4\.00/);
});

test('removing every tool that requires payment restores free tools and keeps the debt', () => {
  const result = policy({
    tools: [FREE],
    owedNowCents: 0,
    invoices: [invoice({ amountCents: 400, amountPaidCents: 0, updatedAt: '2026-10-01T15:00:00.000Z' })],
  });
  assert.equal(result.locked, false);
  assert.equal(toolAccessBlocked(result, true), false);
  assert.match(result.debtNotice || '', /\$4\.00/);
  assert.match(result.debtNotice || '', /still owed/);
  assert.equal(result.causingTools.length, 0);
});

test('removing only some tools that require payment leaves the lock in place', () => {
  const both = policy({
    tools: [PAID, { toolId: 'calendar', name: 'Calendar Events', requiresPaymentNow: true }, FREE],
    owedNowCents: 400,
  });
  assert.equal(both.locked, true);
  assert.equal(both.causingTools.length, 2);
  const oneLeft = policy({
    tools: [PAID, FREE],
    owedNowCents: 200,
  });
  assert.equal(oneLeft.locked, true);
  assert.deepEqual(oneLeft.causingTools.map((tool) => tool.toolId), ['address']);
});

test('re-adding an unpaid tool does not grant another trial or bypass the lock', () => {
  const again = trialGrantForStart({ trialUsed: true }, true);
  assert.equal(again.trialGranted, false);
  assert.equal(again.trialUsed, true);
  const first = trialGrantForStart(null, true);
  assert.equal(first.trialGranted, true);
  const restored = policy({
    tools: [PAID, FREE],
    owedNowCents: 200,
    trialActive: false,
  });
  assert.equal(restored.locked, true);
  assert.equal(restored.causingTools.some((tool) => tool.toolId === 'address'), true);
});

test('scheduled cancellation keeps access and an ended subscription locks paid tools', () => {
  const scheduled = policy({
    tools: [PAID, FREE],
    owedNowCents: 400,
    hasSavedPaymentMethod: true,
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: true,
    currentPeriodEnd: '2026-11-24T15:00:00.000Z',
    invoices: [invoice({ status: 'paid', amountPaidCents: 400 })],
  });
  assert.equal(scheduled.locked, false);
  assert.equal(scheduled.reason === 'subscription_ended', false);

  const ended = policy({
    tools: [PAID, FREE],
    owedNowCents: 400,
    hasSavedPaymentMethod: true,
    subscriptionStatus: 'canceled',
    cancelAtPeriodEnd: true,
    currentPeriodEnd: '2026-10-24T15:00:00.000Z',
    invoices: [invoice({ status: 'paid', amountPaidCents: 400 })],
  });
  assert.equal(ended.locked, true);
  assert.equal(ended.reason, 'subscription_ended');
  assert.equal(toolAccessBlocked(ended, true), true);
  assert.match(ended.adminMessage || '', /subscription has ended/);
});

test('the tool API denial follows the policy and a Stripe redirect does not unlock it', () => {
  const unpaid = policy({ tools: [PAID, FREE], owedNowCents: 400 });
  const admin = toolAccessDenial(unpaid, 'admin');
  const member = toolAccessDenial(unpaid, 'user');
  assert.equal(admin?.status, 403);
  assert.match(admin?.error || '', /All household tools, including free tools/);
  assert.equal(member?.error, LOCKED_MEMBER_MESSAGE);
  assert.equal(member?.error.includes('$'), false);

  const staleAttempt = policy({
    tools: [PAID],
    owedNowCents: 400,
    paymentAttemptAt: '2026-10-24T12:00:00.000Z',
  });
  assert.equal(staleAttempt.locked, true);
  assert.equal(toolAccessDenial(policy({ tools: [FREE] }), 'admin'), null);
});
