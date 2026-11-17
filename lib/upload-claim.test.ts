import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readUploadClaim, sameUploadFields, signUploadClaim } from './upload-claim';

process.env.SUPABASE_SERVICE_ROLE_KEY = 'claim-test-key';

const claimInput = {
  bucket: 'to-do-list',
  ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  path: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/task/file.pdf',
  size: 5_000_000,
  type: 'application/pdf',
  name: 'deed.pdf',
  fields: {
    toolId: 'tool-1',
    taskId: 'task-1',
    password: 'secret-password',
  },
};

test('a signed upload claim round-trips and leaves the password out', () => {
  const token = signUploadClaim(claimInput);
  const claim = readUploadClaim(token);
  assert.ok(claim);
  assert.equal(claim?.path, claimInput.path);
  assert.equal(claim?.size, 5_000_000);
  assert.equal(claim?.fields.password, undefined);
  assert.equal(claim?.fields.taskId, 'task-1');
  assert.equal(sameUploadFields(claim?.fields ?? {}, claimInput.fields), true);
});

test('a changed upload claim is rejected', () => {
  const token = signUploadClaim(claimInput);
  const [body, sig] = token.split('.');
  const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { size: number };
  parsed.size = 10;
  const tampered = `${Buffer.from(JSON.stringify(parsed)).toString('base64url')}.${sig}`;
  assert.equal(readUploadClaim(tampered), null);
});

test('an expired upload claim is rejected', () => {
  const token = signUploadClaim(claimInput);
  assert.equal(readUploadClaim(token, Date.now() + 11 * 60 * 1000), null);
});

test('record ids in the claim must match the complete request', () => {
  const token = signUploadClaim(claimInput);
  const claim = readUploadClaim(token);
  assert.equal(sameUploadFields(claim?.fields ?? {}, { ...claimInput.fields, taskId: 'other-task' }), false);
  assert.equal(sameUploadFields(claim?.fields ?? {}, { ...claimInput.fields, password: 'different' }), true);
});
