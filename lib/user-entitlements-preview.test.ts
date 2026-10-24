import assert from 'node:assert/strict';
import test from 'node:test';
import { isDiscountCodeInUse } from './user-entitlements-preview';

const now = new Date('2026-10-24T03:19:00.000Z');

test('a code that started this evening is in use even when its UTC date is tomorrow locally', () => {
  assert.equal(isDiscountCodeInUse({
    status: 'active',
    publicCode: '2-FREE',
    effectiveAt: '2026-10-24T03:02:16.117Z',
    expiresAt: null,
  }, now), true);
});

test('a code that has not started yet is not in use', () => {
  assert.equal(isDiscountCodeInUse({
    status: 'active',
    publicCode: '2-FREE',
    effectiveAt: '2026-10-24T04:00:00.000Z',
    expiresAt: null,
  }, now), false);
});

test('a code is in use from its UTC date when the start timestamp is missing', () => {
  assert.equal(isDiscountCodeInUse({
    status: 'active',
    publicCode: '2-FREE',
    effectiveDate: '2026-10-24',
    expirationDate: null,
  }, now), true);
});

test('a removed or expired code is not in use', () => {
  assert.equal(isDiscountCodeInUse({
    status: 'removed',
    publicCode: '2-FREE',
    effectiveAt: '2026-10-24T03:02:16.117Z',
    expiresAt: null,
  }, now), false);
  assert.equal(isDiscountCodeInUse({
    status: 'active',
    publicCode: '2-FREE',
    effectiveAt: '2026-10-23T03:02:16.117Z',
    expiresAt: '2026-10-24T03:00:00.000Z',
  }, now), false);
});
