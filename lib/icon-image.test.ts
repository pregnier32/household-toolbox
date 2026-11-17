import assert from 'node:assert/strict';
import test from 'node:test';
import { imageTypeForBytes } from './icon-image';

test('icon bytes identify the real image type', () => {
  assert.equal(imageTypeForBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), 'image/jpeg');
  assert.equal(
    imageTypeForBytes(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/png'
  );
  assert.equal(imageTypeForBytes(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), 'image/gif');
  const webp = new Uint8Array(12);
  webp.set([0x52, 0x49, 0x46, 0x46], 0);
  webp.set([0x57, 0x45, 0x42, 0x50], 8);
  assert.equal(imageTypeForBytes(webp), 'image/webp');
  assert.equal(imageTypeForBytes(Uint8Array.from([0x00, 0x01, 0x02])), null);
});
