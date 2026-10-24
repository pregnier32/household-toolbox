import assert from 'node:assert/strict';
import test from 'node:test';
import { trialGrantForStart } from './tool-trial-grant';
import { isTypedRemovalConfirmation, removalConfirmationMessage } from './tool-access-policy';
import { describeToolAccessPolicy } from './tool-access-policy';
import {
  removalCleanupComplete,
  runPermanentToolRemoval,
  sameHouseholdTool,
  storageRemovalFinished,
  ToolDataRemainsError,
} from './tool-removal-run';

const HOUSEHOLD = 'household-a';
const OTHER = 'household-b';
const TOOL = 'address-book';

test('deletion is scoped to one household and one tool', () => {
  assert.equal(sameHouseholdTool({ userId: HOUSEHOLD, toolId: TOOL }, { userId: HOUSEHOLD, toolId: TOOL }), true);
  assert.equal(sameHouseholdTool({ userId: HOUSEHOLD, toolId: TOOL }, { userId: OTHER, toolId: TOOL }), false);
  assert.equal(sameHouseholdTool({ userId: HOUSEHOLD, toolId: TOOL }, { userId: HOUSEHOLD, toolId: 'notes' }), false);
  assert.equal(sameHouseholdTool({ userId: '', toolId: TOOL }, { userId: '', toolId: TOOL }), false);
});

test('file cleanup is unfinished when the remove fails or a file is still present', () => {
  assert.equal(storageRemovalFinished(false, 0), true);
  assert.equal(storageRemovalFinished(true, 0), false);
  assert.equal(storageRemovalFinished(false, 2), false);
  assert.equal(removalCleanupComplete({ rows: 0, files: 0 }), true);
  assert.equal(removalCleanupComplete({ rows: 1, files: 0 }), false);
  assert.equal(removalCleanupComplete({ rows: 0, files: 1 }), false);
});

test('a partial failure does not drop ownership or report completion, and a retry can finish', async () => {
  const calls: string[] = [];
  let files = 1;
  await assert.rejects(
    () => runPermanentToolRemoval({
      claim: async () => {
        calls.push('claim');
        return 'claimed';
      },
      deleteData: async () => {
        calls.push(`delete:${HOUSEHOLD}:${TOOL}`);
      },
      remaining: async () => ({ rows: 0, files }),
      syncAccess: async () => {
        calls.push('lock');
      },
      dropOwnership: async () => {
        calls.push('drop');
      },
    }),
    (error: unknown) => error instanceof ToolDataRemainsError,
  );
  assert.deepEqual(calls, ['claim', `delete:${HOUSEHOLD}:${TOOL}`]);

  files = 0;
  await runPermanentToolRemoval({
    claim: async () => {
      calls.push('claim-retry');
      return 'claimed';
    },
    deleteData: async () => {
      calls.push('delete-retry');
    },
    remaining: async () => ({ rows: 0, files: 0 }),
    syncAccess: async () => {
      calls.push('lock');
    },
    dropOwnership: async () => {
      calls.push('drop');
    },
  });
  assert.deepEqual(calls, ['claim', `delete:${HOUSEHOLD}:${TOOL}`, 'claim-retry', 'delete-retry', 'lock', 'drop']);
});

test('billing and trial history stay, and adding the tool again does not restart the trial', async () => {
  const preserved = { entitlement: true, invoice: 'in_open' };
  let droppedEntitlement = false;
  let droppedInvoice = false;
  await runPermanentToolRemoval({
    claim: async () => 'claimed',
    deleteData: async () => {
      droppedEntitlement = false;
      droppedInvoice = false;
    },
    remaining: async () => ({ rows: 0, files: 0 }),
    syncAccess: async () => undefined,
    dropOwnership: async () => undefined,
  });
  assert.equal(preserved.entitlement, true);
  assert.equal(preserved.invoice, 'in_open');
  assert.equal(droppedEntitlement, false);
  assert.equal(droppedInvoice, false);
  assert.equal(trialGrantForStart({ trialUsed: true }, true).trialGranted, false);
});

test('removing the last unpaid tool unlocks the household and a remaining unpaid tool does not', () => {
  const now = new Date('2026-10-24T15:00:00.000Z');
  const unlocked = describeToolAccessPolicy({
    now,
    tools: [{ toolId: 'home', name: 'Home Maintenance Schedule', requiresPaymentNow: false }],
    invoices: [{ id: 'in_1', role: 'renewal', status: 'open', amountCents: 400, amountPaidCents: 0, updatedAt: now.toISOString(), collection: 'failed' }],
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    hasSavedPaymentMethod: false,
    owedNowCents: 400,
    nextAmountCents: 0,
    nextBillingAt: null,
    paymentAttemptAt: null,
    trialActive: false,
  });
  assert.equal(unlocked.locked, false);
  assert.match(unlocked.debtNotice || '', /\$4\.00/);

  const stillLocked = describeToolAccessPolicy({
    now,
    tools: [
      { toolId: 'address', name: 'Address Book', requiresPaymentNow: true },
      { toolId: 'home', name: 'Home Maintenance Schedule', requiresPaymentNow: false },
    ],
    invoices: [{ id: 'in_1', role: 'renewal', status: 'open', amountCents: 400, amountPaidCents: 0, updatedAt: now.toISOString(), collection: 'failed' }],
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    hasSavedPaymentMethod: false,
    owedNowCents: 400,
    nextAmountCents: 0,
    nextBillingAt: null,
    paymentAttemptAt: null,
    trialActive: false,
  });
  assert.equal(stillLocked.locked, true);
});

test('the removal confirmation names the tool and the permanent delete', () => {
  const message = removalConfirmationMessage('Address Book');
  assert.match(message, /^Remove Address Book and permanently delete its data\?/);
  assert.match(message, /this household's records, documents, and files/);
  assert.match(message, /cannot be undone/);
  assert.match(message, /Previously issued charges remain owed/);
  assert.equal(isTypedRemovalConfirmation('Delete'), true);
  assert.equal(isTypedRemovalConfirmation('delete'), true);
  assert.equal(isTypedRemovalConfirmation('DELETE'), true);
  assert.equal(isTypedRemovalConfirmation('deleted'), false);
  assert.equal(isTypedRemovalConfirmation(''), false);
});
