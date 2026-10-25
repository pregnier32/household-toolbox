import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authorizeStorageKey,
  authorizeStoredFileRead,
  objectPathForOwner,
  pathsForRemoval,
  storageObjectOwnedBy,
  type StorageOperation,
} from './storage-owner';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const MEMBER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const BUCKET = 'important-documents';
const OWNED = `${OWNER}/1700000000000-deed.pdf`;
const NESTED = `${OWNER}/doc-a/1700000000000-deed.pdf`;
const FOREIGN = `${OTHER}/1700000000000-deed.pdf`;

const same = (entered: string, hash: string) => entered === hash;

test('an owner and a household member using the admin id can read an owned file', () => {
  for (const ownerId of [OWNER, OWNER]) {
    const decision = authorizeStoredFileRead({
      bucket: BUCKET,
      ownerId,
      requested: { recordId: 'doc-a', fileReference: OWNED, requiresPassword: false },
    });
    assert.equal(decision.ok, true);
    if (decision.ok) assert.equal(decision.path, OWNED);
  }

  const memberUsesAdmin = objectPathForOwner(OWNED, BUCKET, OWNER);
  const memberUsesOwnId = objectPathForOwner(OWNED, BUCKET, MEMBER);
  assert.equal(memberUsesAdmin, OWNED);
  assert.equal(memberUsesOwnId, null);
});

test('existing owner/file and owner/record/file keys still resolve', () => {
  assert.equal(objectPathForOwner(OWNED, BUCKET, OWNER), OWNED);
  assert.equal(objectPathForOwner(NESTED, 'notes', OWNER), NESTED);
  const encoded = `https://evil.example/storage/v1/object/public/notes/${OWNER}/my%20file.pdf`;
  assert.equal(objectPathForOwner(encoded, 'notes', OWNER), `${OWNER}/my file.pdf`);
});

test('an unrelated household cannot read, delete, or sign a file', () => {
  const operations: StorageOperation[] = ['download', 'signed-url', 'delete', 'move', 'copy', 'overwrite'];
  for (const operation of operations) {
    const decision = authorizeStorageKey({
      operation,
      bucket: 'notes',
      ownerId: OWNER,
      fileReference: FOREIGN,
      destinationReference: operation === 'move' || operation === 'copy' ? `${OTHER}/copied.pdf` : undefined,
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.status, 404);
  }
  assert.deepEqual(pathsForRemoval([FOREIGN, `https://files.example/${BUCKET}/${FOREIGN}`], BUCKET, OWNER), []);
});

test('rewriting an owned reference to another household file fails', () => {
  const spoofed = `https://hjbneuicvfbihtbufrxq.supabase.co/storage/v1/object/public/notes/${OTHER}/secret.pdf`;
  assert.equal(objectPathForOwner(spoofed, 'notes', OWNER), null);
  const listedAsOwner = `${OTHER}/${OWNER}/secret.pdf`;
  assert.equal(storageObjectOwnedBy(listedAsOwner, OWNER), false);
  assert.equal(storageObjectOwnedBy(OWNED, OWNER), true);
  assert.equal(storageObjectOwnedBy(OWNER, OWNER), true);
});

test('a same-household file reference cannot skip a document password', () => {
  const unprotected = authorizeStoredFileRead({
    bucket: BUCKET,
    ownerId: OWNER,
    requested: { recordId: 'copy', fileReference: OWNED, requiresPassword: false },
    related: [{ recordId: 'original', fileReference: OWNED, requiresPassword: true, passwordHash: 'original-hash' }],
    password: null,
    passwordMatches: same,
  });
  assert.equal(unprotected.ok, false);
  if (!unprotected.ok) assert.equal(unprotected.status, 403);

  const copyPassword = authorizeStoredFileRead({
    bucket: 'notes',
    ownerId: OWNER,
    requested: { recordId: 'copy', fileReference: NESTED, requiresPassword: true, passwordHash: 'copy-hash' },
    related: [{ recordId: 'original', fileReference: NESTED, requiresPassword: true, passwordHash: 'original-hash' }],
    password: 'copy-hash',
    passwordMatches: same,
  });
  assert.equal(copyPassword.ok, false);

  const originalPassword = authorizeStoredFileRead({
    bucket: BUCKET,
    ownerId: OWNER,
    requested: { recordId: 'copy', fileReference: OWNED, requiresPassword: false },
    related: [{ recordId: 'original', fileReference: OWNED, requiresPassword: true, passwordHash: 'original-hash' }],
    password: 'original-hash',
    passwordMatches: same,
  });
  assert.equal(originalPassword.ok, true);

  const differentFile = authorizeStoredFileRead({
    bucket: BUCKET,
    ownerId: OWNER,
    requested: { recordId: 'mine', fileReference: `${OWNER}/mine.pdf`, requiresPassword: false },
    related: [{ recordId: 'original', fileReference: OWNED, requiresPassword: true, passwordHash: 'original-hash' }],
  });
  assert.equal(differentFile.ok, true);
});

test('two records with the same password hash still open with that password', () => {
  const opened = authorizeStoredFileRead({
    bucket: 'notes',
    ownerId: OWNER,
    requested: { recordId: 'copy', fileReference: NESTED, requiresPassword: true, passwordHash: 'shared-hash' },
    related: [{ recordId: 'original', fileReference: NESTED, requiresPassword: true, passwordHash: 'shared-hash' }],
    password: 'shared-hash',
    passwordMatches: same,
  });
  assert.equal(opened.ok, true);
});

test('owned deletes keep the owned key and drop every other key', () => {
  assert.deepEqual(pathsForRemoval([OWNED, FOREIGN, `${OWNER}/../${OTHER}/x.pdf`, null], BUCKET, OWNER), [OWNED]);
});

test('path escapes and a supplied owner segment are rejected', () => {
  assert.equal(objectPathForOwner(`${OWNER}/../${OTHER}/secret.pdf`, BUCKET, OWNER), null);
  assert.equal(objectPathForOwner(`${OTHER}/${OWNER}/secret.pdf`, BUCKET, OWNER), null);
  assert.equal(objectPathForOwner(`${OWNER}/./secret.pdf`, BUCKET, OWNER), null);
  assert.equal(objectPathForOwner(`${OWNER}\\secret.pdf`, BUCKET, OWNER), null);
  assert.equal(authorizeStorageKey({
    operation: 'signed-url',
    bucket: BUCKET,
    ownerId: OWNER,
    fileReference: OWNED,
  }).ok, true);
});
