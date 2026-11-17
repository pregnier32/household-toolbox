import assert from 'node:assert/strict';
import test from 'node:test';
import { pageErrorReport } from './error-report';

test('page error reports keep a short path and hide an email address', () => {
  const report = pageErrorReport({
    digest: 'abc123',
    message: 'Failed for owner@example.com while saving',
    path: '/dashboard/notes?id=1',
  });
  assert.deepEqual(report, {
    digest: 'abc123',
    message: 'Failed for [email] while saving',
    path: '/dashboard/notes',
  });
  assert.equal(pageErrorReport({ message: '   ', path: 'https://evil.example' }), null);
});
