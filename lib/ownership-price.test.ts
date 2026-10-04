import assert from 'node:assert/strict';
import test from 'node:test';
import { keptOwnershipShelf, ownershipShelfPrice } from './ownership-price';

test('a new activation stores the catalog shelf price', () => {
  assert.equal(ownershipShelfPrice(2), 2);
});

test('a trial does not change the stored shelf price', () => {
  assert.equal(ownershipShelfPrice(2), 2);
});

test('a free-tool slot does not change the stored shelf price', () => {
  assert.equal(ownershipShelfPrice(2), 2);
});

test('a 100 percent promotion does not change the stored shelf price', () => {
  assert.equal(ownershipShelfPrice(2), 2);
});

test('a price sent by the browser is ignored', () => {
  assert.equal(ownershipShelfPrice(2, 0), 2);
  assert.equal(ownershipShelfPrice(2, 1), 2);
  assert.equal(ownershipShelfPrice(2, '0'), 2);
});

test('an existing ownership snapshot is left unchanged', () => {
  assert.equal(keptOwnershipShelf(0, 2), 0);
  assert.equal(keptOwnershipShelf(2, 3), 2);
  assert.equal(keptOwnershipShelf(null, 2), 2);
});
