import { createHmac, timingSafeEqual } from 'node:crypto';

const CLAIM_TTL_MS = 10 * 60 * 1000;

/** These stay on the complete request. They are not copied into the signed claim. */
const SECRET_FIELDS = new Set(['password', 'downloadPassword', 'securityQuestions']);

export type UploadClaim = {
  v: 1;
  bucket: string;
  ownerId: string;
  path: string;
  size: number;
  type: string;
  name: string;
  fields: Record<string, string>;
  exp: number;
};

function claimKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  return key;
}

export function publicUploadFields(fields: Record<string, string>): Record<string, string> {
  const copy: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_FIELDS.has(key)) continue;
    copy[key] = value;
  }
  return copy;
}

export function sameUploadFields(left: Record<string, string>, right: Record<string, string>): boolean {
  const a = publicUploadFields(left);
  const b = publicUploadFields(right);
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key, index) => key === bKeys[index] && a[key] === b[key]);
}

export function signUploadClaim(input: Omit<UploadClaim, 'v' | 'exp'>): string {
  const payload: UploadClaim = {
    v: 1,
    exp: Date.now() + CLAIM_TTL_MS,
    bucket: input.bucket,
    ownerId: input.ownerId,
    path: input.path,
    size: input.size,
    type: input.type,
    name: input.name,
    fields: publicUploadFields(input.fields),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', claimKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function readUploadClaim(token: string, now = Date.now()): UploadClaim | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expected = createHmac('sha256', claimKey()).update(body).digest('base64url');
  const received = Buffer.from(sig);
  const wanted = Buffer.from(expected);
  if (received.length !== wanted.length || !timingSafeEqual(received, wanted)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as UploadClaim;
    if (parsed.v !== 1 || typeof parsed.exp !== 'number' || parsed.exp < now) return null;
    if (!parsed.bucket || !parsed.ownerId || !parsed.path || !parsed.name) return null;
    if (!Number.isSafeInteger(parsed.size) || parsed.size <= 0) return null;
    if (!parsed.fields || typeof parsed.fields !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}
