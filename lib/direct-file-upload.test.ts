import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DIRECT_UPLOAD_MIN_BYTES, postToolFile } from './direct-file-upload';

const STORAGE = 'https://example.supabase.co';

function pdf(size: number): File {
  return new File([new Uint8Array(size)], 'scan.pdf', { type: 'application/pdf' });
}

test('a smaller file stays on the multipart request', async () => {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;
  try {
    const form = new FormData();
    form.append('toolId', 'notes');
    form.append('file', pdf(1024));
    const response = await postToolFile('/api/tools/notes/attachments', form);
    assert.equal(response.status, 200);
    assert.deepEqual(calls, ['/api/tools/notes/attachments']);
  } finally {
    globalThis.fetch = original;
  }
});

test('a large file is prepared, sent to storage, then completed', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = STORAGE;
  const calls: Array<{ url: string; method: string; body: string }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    const method = init?.method ?? 'GET';
    if (target.endsWith('/attachments') && method === 'POST') {
      const text = String(init?.body ?? '');
      calls.push({ url: target, method, body: text });
      if (text.includes('"directUpload":"prepare"')) {
        return new Response(JSON.stringify({
          signedUrl: `${STORAGE}/storage/v1/object/upload/sign/notes/file.pdf?token=abc`,
          claim: 'signed-claim',
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ attachment: { id: '1' } }), { status: 200 });
    }
    calls.push({ url: target, method, body: 'file' });
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  try {
    const form = new FormData();
    form.append('toolId', 'notes');
    form.append('noteId', 'note-1');
    form.append('password', 'secret');
    form.append('file', pdf(DIRECT_UPLOAD_MIN_BYTES));
    const response = await postToolFile('/api/tools/notes/attachments', form);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 3);
    assert.equal(calls[0].method, 'POST');
    assert.match(calls[0].body, /"directUpload":"prepare"/);
    assert.match(calls[0].body, /"fileSize":3500000/);
    assert.equal(calls[1].method, 'PUT');
    assert.equal(calls[1].url.startsWith(`${STORAGE}/`), true);
    assert.equal(calls[2].method, 'POST');
    assert.match(calls[2].body, /"directUpload":"complete"/);
    assert.match(calls[2].body, /"claim":"signed-claim"/);
    assert.match(calls[2].body, /"password":"secret"/);
  } finally {
    globalThis.fetch = original;
  }
});

test('a signed upload URL on another origin is refused', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = STORAGE;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    signedUrl: 'https://evil.example/upload',
    claim: 'signed-claim',
  }), { status: 200 })) as typeof fetch;
  try {
    const form = new FormData();
    form.append('file', pdf(DIRECT_UPLOAD_MIN_BYTES));
    const response = await postToolFile('/api/tools/notes/attachments', form);
    assert.equal(response.status, 502);
    const body = await response.json() as { error: string };
    assert.equal(body.error, 'Upload could not be started.');
  } finally {
    globalThis.fetch = original;
  }
});
