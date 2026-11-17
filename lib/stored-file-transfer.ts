import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { ATTACHMENT_MAX_FILE_BYTES, isAllowedAttachmentType } from '@/lib/attachments';
import { objectPathForOwner } from '@/lib/storage-owner';
import { supabaseServer } from '@/lib/supabaseServer';
import { readUploadClaim, sameUploadFields, signUploadClaim, type UploadClaim } from '@/lib/upload-claim';

const FIELD_LIMIT = 100_000;
const FIELD_COUNT_LIMIT = 40;
const FILE_NAME_LIMIT = 240;

export type AttachmentFile = {
  name: string;
  size: number;
  type: string;
};

export class AttachmentInput {
  constructor(
    readonly mode: 'file' | 'prepare' | 'complete',
    private readonly fields: Record<string, string>,
    readonly file: File | null,
    private readonly described: AttachmentFile | null,
    readonly claim: UploadClaim | null,
  ) {}

  get(name: string, options?: { trim?: boolean }): string {
    const value = this.fields[name] ?? '';
    return options?.trim === false ? value : value.trim();
  }

  fileMetadata(): AttachmentFile | null {
    if (this.mode === 'file') {
      if (!this.file || this.file.size <= 0) return null;
      return { name: this.file.name, size: this.file.size, type: this.file.type };
    }
    return this.described;
  }

  fieldMap(): Record<string, string> {
    return { ...this.fields };
  }
}

function badRequest(error: string, status = 400): NextResponse {
  return NextResponse.json({ error }, { status });
}

function cleanFileName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > FILE_NAME_LIMIT) return null;
  return trimmed;
}

function cleanFields(value: Record<string, unknown>): Record<string, string> | null {
  const entries = Object.entries(value).filter(([key]) => !['directUpload', 'fileName', 'fileSize', 'fileType', 'claim'].includes(key));
  if (entries.length > FIELD_COUNT_LIMIT) return null;
  const fields: Record<string, string> = {};
  for (const [key, field] of entries) {
    if (typeof field !== 'string' || field.length > FIELD_LIMIT) return null;
    fields[key] = field;
  }
  return fields;
}

export async function readAttachmentRequest(request: NextRequest): Promise<AttachmentInput | NextResponse> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return badRequest('Request could not be read.');
    }
    const fields: Record<string, string> = {};
    let file: File | null = null;
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        if (value.length > FIELD_LIMIT) return badRequest('Request could not be read.');
        fields[key] = value;
        continue;
      }
      if (value.size <= 0) continue;
      if (file) return badRequest('Only one file can be uploaded at a time.');
      file = value;
    }
    return new AttachmentInput('file', fields, file, null, null);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return badRequest('Request could not be read.');
    body = parsed as Record<string, unknown>;
  } catch {
    return badRequest('Request could not be read.');
  }

  const directUpload = body.directUpload;
  if (directUpload !== 'prepare' && directUpload !== 'complete') {
    return badRequest('Request could not be read.');
  }
  const fields = cleanFields(body);
  if (!fields) return badRequest('Request could not be read.');

  if (directUpload === 'prepare') {
    const name = typeof body.fileName === 'string' ? cleanFileName(body.fileName) : null;
    const size = body.fileSize;
    const type = typeof body.fileType === 'string' ? body.fileType : '';
    if (!name || typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0) {
      return badRequest('A file is required');
    }
    if (size > ATTACHMENT_MAX_FILE_BYTES) {
      return badRequest('File size cannot exceed 10MB');
    }
    if (!isAllowedAttachmentType(type, name)) {
      return badRequest('That file type is not allowed');
    }
    return new AttachmentInput('prepare', fields, null, { name, size, type }, null);
  }

  const token = typeof body.claim === 'string' ? body.claim : '';
  const claim = token ? readUploadClaim(token) : null;
  if (!claim || !sameUploadFields(claim.fields, fields)) {
    return badRequest('Upload session expired. Choose the file again.');
  }
  if (claim.size > ATTACHMENT_MAX_FILE_BYTES || !isAllowedAttachmentType(claim.type, claim.name)) {
    return badRequest('That file type is not allowed');
  }
  return new AttachmentInput('complete', fields, null, {
    name: claim.name,
    size: claim.size,
    type: claim.type,
  }, claim);
}

type StoredUpload = {
  path: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
};

function storedFileUrl(bucket: string, path: string): string {
  const { data } = supabaseServer.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function removeObject(bucket: string, path: string) {
  await supabaseServer.storage.from(bucket).remove([path]);
}

export async function placeAttachmentFile(input: {
  bucket: string;
  ownerId: string;
  storagePath: string;
  upload: AttachmentInput;
}): Promise<NextResponse | StoredUpload> {
  const described = input.upload.fileMetadata();
  if (!described) return badRequest('A file is required');

  if (input.upload.mode === 'prepare') {
    const path = objectPathForOwner(input.storagePath, input.bucket, input.ownerId);
    if (!path) return badRequest('Invalid file path');
    const signed = await supabaseServer.storage.from(input.bucket).createSignedUploadUrl(path);
    if (signed.error || !signed.data?.signedUrl || !signed.data.token) {
      console.error('Signed upload URL failed');
      return badRequest('Failed to start upload', 500);
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
    let signedOrigin = '';
    let allowedOrigin = '';
    try {
      signedOrigin = new URL(signed.data.signedUrl).origin;
      allowedOrigin = new URL(supabaseUrl).origin;
    } catch {
      return badRequest('Failed to start upload', 500);
    }
    if (!allowedOrigin || signedOrigin !== allowedOrigin) {
      return badRequest('Failed to start upload', 500);
    }
    const claim = signUploadClaim({
      bucket: input.bucket,
      ownerId: input.ownerId,
      path,
      size: described.size,
      type: described.type,
      name: described.name,
      fields: input.upload.fieldMap(),
    });
    return NextResponse.json({ signedUrl: signed.data.signedUrl, claim });
  }

  if (input.upload.mode === 'complete') {
    const claim = input.upload.claim;
    if (!claim || claim.bucket !== input.bucket || claim.ownerId !== input.ownerId) {
      return badRequest('Upload session expired. Choose the file again.');
    }
    const path = objectPathForOwner(claim.path, input.bucket, input.ownerId);
    if (!path || path !== claim.path) return badRequest('Invalid file path');
    const info = await supabaseServer.storage.from(input.bucket).info(path);
    if (info.error || !info.data) {
      return badRequest('Upload session expired. Choose the file again.');
    }
    const details = info.data as { size?: number; contentType?: string; content_type?: string };
    const size = Number(details.size ?? 0);
    const storedType = String(details.contentType ?? details.content_type ?? '').split(';')[0].trim().toLowerCase();
    const typeOk = !storedType
      || storedType === 'application/octet-stream'
      || isAllowedAttachmentType(storedType, claim.name);
    if (size !== claim.size || !typeOk) {
      await removeObject(input.bucket, path);
      return badRequest('The uploaded file did not match the file you selected.');
    }
    return {
      path,
      fileUrl: storedFileUrl(input.bucket, path),
      fileName: claim.name,
      fileSize: claim.size,
      fileType: claim.type,
    };
  }

  const file = input.upload.file;
  const path = objectPathForOwner(input.storagePath, input.bucket, input.ownerId);
  if (!file || !path) return badRequest('Invalid file path');
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseServer.storage.from(input.bucket).upload(path, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 });
  }
  return {
    path,
    fileUrl: storedFileUrl(input.bucket, path),
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
  };
}

type StorageDownload = {
  asStream?: () => Promise<{ data: ReadableStream<Uint8Array> | null; error: { message?: string } | null }>;
} & Promise<{
  data: { arrayBuffer: () => Promise<ArrayBuffer> } | null;
  error: { message?: string } | null;
}>;

function safeDownloadName(fileName: string | null | undefined): string {
  const cleaned = (fileName || 'attachment').replace(/["\r\n\\]/g, '').slice(0, FILE_NAME_LIMIT);
  return cleaned || 'attachment';
}

export async function streamStoredObject(input: {
  bucket: string;
  path: string;
  fileName: string | null | undefined;
  contentType: string | null | undefined;
  inline: boolean;
}): Promise<NextResponse> {
  const safeName = safeDownloadName(input.fileName);
  const headers: Record<string, string> = {
    'Content-Type': input.contentType || 'application/octet-stream',
    'Content-Disposition': `${input.inline ? 'inline' : 'attachment'}; filename="${safeName}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  };

  const pending = supabaseServer.storage.from(input.bucket).download(input.path) as StorageDownload;
  if (typeof pending.asStream === 'function') {
    const streamed = await pending.asStream();
    if (streamed.error || !streamed.data) {
      return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 500 });
    }
    return new NextResponse(streamed.data, { status: 200, headers });
  }

  const downloaded = await pending;
  if (downloaded.error || !downloaded.data) {
    return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 500 });
  }
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      ...headers,
      'Content-Length': bytes.length.toString(),
    },
  });
}

/** Password stays in the JSON body so it is not written into the request URL. */
export async function readFileDownloadBody(request: NextRequest): Promise<{ password: string | null; inline: boolean } | NextResponse> {
  const text = await request.text();
  if (!text.trim()) return { password: null, inline: false };
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Request could not be read.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request could not be read.' }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  if (record.password != null && typeof record.password !== 'string') {
    return NextResponse.json({ error: 'Request could not be read.' }, { status: 400 });
  }
  if (record.inline != null && typeof record.inline !== 'boolean') {
    return NextResponse.json({ error: 'Request could not be read.' }, { status: 400 });
  }
  const password = typeof record.password === 'string' && record.password ? record.password : null;
  return { password, inline: record.inline === true };
}
