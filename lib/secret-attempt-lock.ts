import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { assertNotePassword } from '@/lib/notes-storage';

export const SECRET_ATTEMPT_LIMIT = 5;
export const SECRET_LOCK_MS = 15 * 60 * 1000;

const TABLE = 'secret_attempt_locks';

export type SecretRecordKind = 'note' | 'document';

export type SecretAttemptKey = {
  ownerId: string;
  kind: SecretRecordKind;
  recordId: string;
};

type LockRow = {
  id: string;
  failure_count: number | null;
  locked_until: string | null;
};

type DbError = { code?: string; message?: string };

let reportedMissingTable = false;

function asDbError(error: unknown): DbError | null {
  if (!error || typeof error !== 'object') return null;
  return error as DbError;
}

function isMissingLockTable(error: DbError | null): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const message = (error.message || '').toLowerCase();
  return message.includes('does not exist') || message.includes('schema cache');
}

function noteMissingTable(): void {
  if (reportedMissingTable) return;
  reportedMissingTable = true;
  console.error(
    'secret_attempt_locks is missing. Run supabase/migrations/20261116210000_secret_attempt_locks.sql in the SQL editor before launch.'
  );
}

function isActiveLock(lockedUntil: string | null, now: number): boolean {
  if (!lockedUntil) return false;
  const until = Date.parse(lockedUntil);
  return Number.isFinite(until) && until > now;
}

export function secretLockMessage(lockedUntil: string, now = Date.now()): string {
  const remaining = Date.parse(lockedUntil) - now;
  const minutes = Math.max(1, Math.ceil(remaining / 60000));
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

function lockedResponse(lockedUntil: string): NextResponse {
  const response = NextResponse.json({ error: secretLockMessage(lockedUntil) }, { status: 429 });
  const seconds = Math.max(1, Math.ceil((Date.parse(lockedUntil) - Date.now()) / 1000));
  response.headers.set('Retry-After', String(seconds));
  return response;
}

function unavailableResponse(): NextResponse {
  return NextResponse.json({ error: 'Password check is unavailable. Try again shortly.' }, { status: 503 });
}

async function readLock(key: SecretAttemptKey): Promise<{ missing: true } | { unavailable: true } | { row: LockRow | null }> {
  const { data, error } = await supabaseServer
    .from(TABLE)
    .select('id, failure_count, locked_until')
    .eq('user_id', key.ownerId)
    .eq('record_kind', key.kind)
    .eq('record_id', key.recordId)
    .maybeSingle();
  const dbError = asDbError(error);
  if (dbError) {
    if (isMissingLockTable(dbError)) {
      noteMissingTable();
      return { missing: true };
    }
    console.error('Error reading secret attempt lock:', dbError.message);
    return { unavailable: true };
  }
  return { row: (data as LockRow | null) ?? null };
}

export async function rejectLockedSecret(key: SecretAttemptKey): Promise<NextResponse | null> {
  const result = await readLock(key);
  if ('missing' in result) return null;
  if ('unavailable' in result) return unavailableResponse();
  if (result.row && isActiveLock(result.row.locked_until, Date.now())) {
    return lockedResponse(result.row.locked_until as string);
  }
  return null;
}

export async function registerSecretFailure(key: SecretAttemptKey, failure: NextResponse): Promise<NextResponse> {
  const now = Date.now();
  const result = await readLock(key);
  if ('missing' in result) return failure;
  if ('unavailable' in result) return unavailableResponse();

  const row = result.row;
  if (row && isActiveLock(row.locked_until, now)) {
    return lockedResponse(row.locked_until as string);
  }

  const previous = row && !isActiveLock(row.locked_until, now) && row.locked_until ? 0 : Number(row?.failure_count) || 0;
  const nextCount = previous + 1;
  const lockedUntil = nextCount >= SECRET_ATTEMPT_LIMIT ? new Date(now + SECRET_LOCK_MS).toISOString() : null;
  const payload = {
    failure_count: nextCount,
    locked_until: lockedUntil,
    updated_at: new Date(now).toISOString(),
  };

  const write = row
    ? await supabaseServer.from(TABLE).update(payload).eq('id', row.id).eq('user_id', key.ownerId)
    : await supabaseServer.from(TABLE).insert({
        user_id: key.ownerId,
        record_kind: key.kind,
        record_id: key.recordId,
        ...payload,
      });
  const writeError = asDbError(write.error);
  if (writeError) {
    if (isMissingLockTable(writeError)) {
      noteMissingTable();
      return failure;
    }
    console.error('Error saving secret attempt lock:', writeError.message);
    return unavailableResponse();
  }

  return lockedUntil ? lockedResponse(lockedUntil) : failure;
}

export async function clearSecretAttempts(key: SecretAttemptKey): Promise<void> {
  const { error } = await supabaseServer
    .from(TABLE)
    .delete()
    .eq('user_id', key.ownerId)
    .eq('record_kind', key.kind)
    .eq('record_id', key.recordId);
  const dbError = asDbError(error);
  if (!dbError) return;
  if (isMissingLockTable(dbError)) {
    noteMissingTable();
    return;
  }
  console.error('Error clearing secret attempt lock:', dbError.message);
}

type NotePasswordRow = {
  id: string;
  is_active: boolean | null;
  requires_password_for_view: boolean | null;
  view_password_hash: string | null;
};

export async function notePasswordDenied(
  ownerId: string,
  note: NotePasswordRow,
  password: string | null | undefined
): Promise<NextResponse | null> {
  if (!note.requires_password_for_view) return null;
  const key: SecretAttemptKey = { ownerId, kind: 'note', recordId: note.id };
  const locked = await rejectLockedSecret(key);
  if (locked) return locked;
  try {
    await assertNotePassword(note, password);
  } catch (error) {
    if (error instanceof Error && error.message === 'Incorrect password') {
      return registerSecretFailure(
        key,
        NextResponse.json({ error: 'Incorrect password' }, { status: 403 })
      );
    }
    throw error;
  }
  return null;
}
