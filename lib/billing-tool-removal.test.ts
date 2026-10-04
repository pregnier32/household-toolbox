import assert from 'node:assert/strict';
import test from 'node:test';
import type { AccountPricingInput, PricingToolInput } from './account-pricing';
import { planToolRemoval } from './billing-cycle';
import { BillingCommitmentError, deleteAfterBillingCommitment } from './billing-tool-removal';

const SIGNUP = '2026-10-08T15:00:00.000Z';
const DURING_PERIOD = new Date('2026-10-20T15:00:00.000Z');
const BEFORE_FIRST_BILL = new Date('2026-10-12T15:00:00.000Z');

function tool(partial: Partial<PricingToolInput> & Pick<PricingToolInput, 'toolId'>): PricingToolInput {
  return {
    name: partial.name || 'Family Chores',
    shelfPriceCents: 200,
    ownedAt: '2026-09-01T15:00:00.000Z',
    trialStartedAt: '2026-09-01T15:00:00.000Z',
    trialUsed: true,
    ...partial,
  };
}

function account(tools: PricingToolInput[]): AccountPricingInput {
  return {
    userId: 'user-1',
    accountType: 'personal',
    isTestAccount: false,
    storageUsedBytes: 0,
    storageAddonGb: 0,
    tools,
    assignments: [],
  };
}

test('a saved billing commitment lets a paid tool deletion continue', async () => {
  const input = account([tool({ toolId: 'chores' })]);
  const plan = planToolRemoval(input, SIGNUP, DURING_PERIOD, 'chores', null);
  assert.equal(plan.kind, 'schedule');
  let preserved = false;
  let deleted = false;
  await deleteAfterBillingCommitment({
    plan,
    toolId: 'chores',
    preserve: async () => {
      preserved = true;
    },
    deleteData: async () => {
      deleted = true;
    },
  });
  assert.equal(preserved, true);
  assert.equal(deleted, true);
  if (plan.kind === 'schedule') {
    assert.equal(plan.tools.find((record) => record.toolId === 'chores')?.scheduledRemoval, true);
  }
});

test('a failed billing commitment save does not delete tool data or ownership', async () => {
  const input = account([tool({ toolId: 'chores' })]);
  const plan = planToolRemoval(input, SIGNUP, DURING_PERIOD, 'chores', null);
  let deleted = false;
  await assert.rejects(
    () => deleteAfterBillingCommitment({
      plan,
      toolId: 'chores',
      preserve: async () => {
        throw new Error('database unavailable');
      },
      deleteData: async () => {
        deleted = true;
      },
    }),
    (error: unknown) => error instanceof BillingCommitmentError && /has not been deleted/.test(error.message),
  );
  assert.equal(deleted, false);
});

test('a tool still in its free trial can be deleted without a paid commitment', async () => {
  const input = account([tool({
    toolId: 'clean',
    ownedAt: '2026-10-10T15:00:00.000Z',
    trialStartedAt: '2026-10-10T15:00:00.000Z',
  })]);
  const plan = planToolRemoval(input, SIGNUP, DURING_PERIOD, 'clean', null);
  assert.equal(plan.kind, 'uncommitted');
  let preserved = false;
  let deleted = false;
  await deleteAfterBillingCommitment({
    plan,
    toolId: 'clean',
    preserve: async () => {
      preserved = true;
    },
    deleteData: async () => {
      deleted = true;
    },
  });
  assert.equal(preserved, false);
  assert.equal(deleted, true);
});

test('a tool removed before the first billing anniversary is not preserved as a charge', async () => {
  const input = account([tool({
    toolId: 'chores',
    ownedAt: '2026-10-01T15:00:00.000Z',
    trialStartedAt: '2026-10-01T15:00:00.000Z',
  })]);
  const plan = planToolRemoval(input, SIGNUP, BEFORE_FIRST_BILL, 'chores', null);
  assert.equal(plan.kind, 'uncommitted');
  if (plan.kind === 'uncommitted') assert.equal(plan.dropToolId, null);
  let deleted = false;
  await deleteAfterBillingCommitment({
    plan,
    toolId: 'chores',
    preserve: async () => {
      throw new Error('should not preserve');
    },
    deleteData: async () => {
      deleted = true;
    },
  });
  assert.equal(deleted, true);
});
