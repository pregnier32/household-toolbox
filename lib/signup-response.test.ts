import assert from 'node:assert/strict';
import test from 'node:test';
import { existingEmailSignUpResult, publicSignUpResult } from './signup-response';

test('an existing signup email gets the same public success as a new email', () => {
  const confirmed = publicSignUpResult(true);
  const open = publicSignUpResult(false);
  assert.deepEqual(existingEmailSignUpResult({ identities: [] }), confirmed);
  assert.deepEqual(existingEmailSignUpResult({ errorCode: 'user_already_exists' }), open);
  assert.equal(existingEmailSignUpResult({ errorCode: 'unexpected_failure', identities: [{ id: 'new' }] }), null);
  assert.equal('error' in confirmed, false);
  assert.equal('userId' in confirmed, false);
});
