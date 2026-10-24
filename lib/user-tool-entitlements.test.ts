import assert from 'node:assert/strict';
import test from 'node:test';
import { toolOffersTrial } from './tool-offers-trial';

test('a priced tool offers a 7-day trial by default', () => {
  assert.equal(toolOffersTrial({ name: 'Shopping List', price: 2 }), true);
  assert.equal(toolOffersTrial({ name: 'Shopping List', price: 2, offers_trial: true }), true);
});

test('unchecking the trial removes it from a priced tool', () => {
  assert.equal(toolOffersTrial({ name: 'Shopping List', price: 2, offers_trial: false }), false);
});

test('a $0 tool does not start a trial', () => {
  assert.equal(toolOffersTrial({ name: 'Home Maintenance Schedule', price: 0, offers_trial: true }), false);
  assert.equal(toolOffersTrial({ name: 'Notes', price: 0, offers_trial: true }), false);
});
