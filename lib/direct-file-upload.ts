/**
 * Files at or above this size go straight to private storage.
 * Vercel rejects a function request body above 4.5 MB, so the cutoff stays under that
 * with room for the rest of a multipart form.
 */
export const DIRECT_UPLOAD_MIN_BYTES = 3_500_000;

function jsonResponse(body: { error: string }, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function formFields(formData: FormData): Record<string, string> | null {
  const fields: Record<string, string> = {};
  let file: File | null = null;
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      fields[key] = value;
      continue;
    }
    if (value.size <= 0) continue;
    if (file) return null;
    file = value;
  }
  return fields;
}

function selectedFile(formData: FormData): File | null {
  let file: File | null = null;
  for (const value of formData.values()) {
    if (typeof value === 'string' || value.size <= 0) continue;
    if (file) return null;
    file = value;
  }
  return file;
}

function allowedStorageUrl(signedUrl: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!base) return false;
  try {
    return new URL(signedUrl).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

/**
 * Posts a tool form. A single file at or above the direct-upload cutoff is sent to
 * private storage after this app authorizes it. Smaller forms stay on the existing request.
 */
export async function postToolFile(url: string, formData: FormData): Promise<Response> {
  const file = selectedFile(formData);
  if (!file || file.size < DIRECT_UPLOAD_MIN_BYTES) {
    return fetch(url, { method: 'POST', body: formData });
  }

  const fields = formFields(formData);
  if (!fields) {
    return jsonResponse({ error: 'Only one file can be uploaded at a time.' }, 400);
  }

  const prepare = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...fields,
      directUpload: 'prepare',
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    }),
  });
  if (!prepare.ok) return prepare;

  const prepared = (await prepare.json().catch(() => null)) as { signedUrl?: unknown; claim?: unknown } | null;
  if (!prepared || typeof prepared.signedUrl !== 'string' || typeof prepared.claim !== 'string' || !allowedStorageUrl(prepared.signedUrl)) {
    return jsonResponse({ error: 'Upload could not be started.' }, 502);
  }

  const body = new FormData();
  body.append('cacheControl', '3600');
  body.append('', file, file.name);
  const uploaded = await fetch(prepared.signedUrl, {
    method: 'PUT',
    headers: { 'x-upsert': 'false' },
    body,
    credentials: 'omit',
  });
  if (!uploaded.ok) {
    return jsonResponse({ error: 'Failed to upload file' }, 502);
  }

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...fields,
      directUpload: 'complete',
      claim: prepared.claim,
    }),
  });
}
