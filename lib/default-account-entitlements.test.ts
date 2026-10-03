import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureDefaultAccountEntitlements, type DefaultEntitlementDeps, type DefaultPromotionShape } from './default-account-entitlements';

const promotion: DefaultPromotionShape = {
  id: 'promo-1',
  publicCode: 'NEWUSER2',
  status: 'active',
  assignmentMethod: 'automatic',
  benefitType: 'free_tool_slots',
  eligibleUsers: 'new_users',
  eligibleAccountType: 'personal',
  slotMode: 'total',
};

function deps(partial: Partial<DefaultEntitlementDeps> & { assignments?: Set<string> }): DefaultEntitlementDeps {
  const assignments = partial.assignments ?? new Set<string>();
  return {
    loadContext: async () => ({ accountType: 'personal', isBillingOwner: true }),
    loadDefaultPromotion: async () => promotion,
    hasAssignment: async (userId) => assignments.has(userId),
    assign: async (userId) => {
      if (assignments.has(userId)) return { ok: false, code: 'already_used' };
      assignments.add(userId);
      return { ok: true, code: 'ok' };
    },
    ...partial,
    assignments: undefined,
  } as DefaultEntitlementDeps;
}

test('a personal billing admin missing NEWUSER2 receives one assignment', async () => {
  const assignments = new Set<string>();
  const result = await ensureDefaultAccountEntitlements('user-1', deps({ assignments }));
  assert.equal(result.status, 'granted');
  assert.equal(assignments.has('user-1'), true);
});

test('an admin who already has NEWUSER2 is not granted another', async () => {
  const assignments = new Set(['user-1']);
  let calls = 0;
  const result = await ensureDefaultAccountEntitlements('user-1', deps({
    assignments,
    assign: async () => {
      calls += 1;
      return { ok: true, code: 'ok' };
    },
  }));
  assert.equal(result.status, 'already_present');
  assert.equal(calls, 0);
  assert.equal(assignments.size, 1);
});

test('a business account is not granted NEWUSER2', async () => {
  let calls = 0;
  const result = await ensureDefaultAccountEntitlements('biz', deps({
    loadContext: async () => ({ accountType: 'business', isBillingOwner: true }),
    assign: async () => {
      calls += 1;
      return { ok: true, code: 'ok' };
    },
  }));
  assert.equal(result.status, 'skipped');
  assert.equal(calls, 0);
});

test('an invited household member is not granted a separate NEWUSER2', async () => {
  let calls = 0;
  const result = await ensureDefaultAccountEntitlements('guest', deps({
    loadContext: async () => ({ accountType: 'personal', isBillingOwner: false }),
    assign: async () => {
      calls += 1;
      return { ok: true, code: 'ok' };
    },
  }));
  assert.equal(result.status, 'skipped');
  assert.equal(calls, 0);
});

test('two simultaneous repairs still leave one assignment', async () => {
  const assignments = new Set<string>();
  let started = 0;
  const gate: { release?: () => void } = {};
  const ready = new Promise<void>((resolve) => {
    gate.release = resolve;
  });
  const shared: DefaultEntitlementDeps = {
    loadContext: async () => ({ accountType: 'personal', isBillingOwner: true }),
    loadDefaultPromotion: async () => promotion,
    hasAssignment: async () => {
      started += 1;
      if (started === 2) gate.release?.();
      await ready;
      return assignments.has('user-1');
    },
    assign: async () => {
      if (assignments.has('user-1')) return { ok: false, code: 'already_used' };
      assignments.add('user-1');
      return { ok: true, code: 'ok' };
    },
  };
  const [first, second] = await Promise.all([
    ensureDefaultAccountEntitlements('user-1', shared),
    ensureDefaultAccountEntitlements('user-1', shared),
  ]);
  assert.equal(assignments.size, 1);
  assert.equal([first.status, second.status].filter((status) => status === 'granted').length, 1);
  assert.ok([first.status, second.status].every((status) => status === 'granted' || status === 'already_present'));
});

test('a temporary failure leaves no assignment and a later retry can grant it', async () => {
  const assignments = new Set<string>();
  let fail = true;
  const shared = deps({
    assignments,
    assign: async (userId) => {
      if (fail) return { ok: false, code: 'failed' };
      assignments.add(userId);
      return { ok: true, code: 'ok' };
    },
  });
  const cache = new Set<string>();
  const first = await ensureDefaultAccountEntitlements('user-1', shared, cache);
  assert.equal(first.status, 'failed');
  assert.equal(assignments.size, 0);
  fail = false;
  const second = await ensureDefaultAccountEntitlements('user-1', shared, cache);
  assert.equal(second.status, 'granted');
  assert.equal(assignments.size, 1);
});
