/**
 * Canonical storage keys for service-role downloads, deletes, uploads,
 * and any future signed URL, move, or copy.
 *
 * Callers must pass the trusted owner id from the session. For household
 * members that id is the household Admin id assigned by getHouseholdDataSession.
 * A file_url, a client-supplied owner id, or a URL host is not proof of ownership.
 */

const OWNER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StorageOperation = 'download' | 'signed-url' | 'delete' | 'move' | 'copy' | 'overwrite';

export type StoredFileGrant = {
  recordId: string;
  fileReference: string | null | undefined;
  requiresPassword: boolean;
  passwordHash?: string | null;
};

export type StorageAccessDecision =
  | { ok: true; path: string }
  | { ok: false; status: 403 | 404; error: string };

function decodeOnce(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function safeSegments(path: string): string[] | null {
  if (!path || path.includes('\\') || path.includes('\0') || path.includes('//') || path.startsWith('/')) {
    return null;
  }
  const segments = path.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return null;
  return segments;
}

/** Object key inside a bucket. The URL host is ignored. */
export function canonicalObjectPath(fileReference: string | null | undefined, bucket: string): string | null {
  if (!fileReference || !bucket) return null;
  const trimmed = fileReference.trim();
  if (!trimmed || trimmed.includes('\\') || trimmed.includes('\0')) return null;

  let raw = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    const marker = `/${bucket}/`;
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    raw = url.pathname.slice(index + marker.length);
  } else {
    raw = trimmed.replace(/^\/+/, '');
  }

  const decoded = decodeOnce(raw);
  if (decoded === null) return null;
  const segments = safeSegments(decoded);
  if (!segments || segments.length < 2) return null;
  return segments.join('/');
}

/** Key whose first segment is the trusted owner id. Existing keys stay `{ownerId}/...`. */
export function objectPathForOwner(
  fileReference: string | null | undefined,
  bucket: string,
  ownerId: string,
): string | null {
  if (!ownerId || !OWNER_ID.test(ownerId)) return null;
  const path = canonicalObjectPath(fileReference, bucket);
  if (!path) return null;
  const [owner] = path.split('/');
  if (owner.toLowerCase() !== ownerId.toLowerCase()) return null;
  return path;
}

/** True for an owned object key or the owner's own folder name. A nested copy of the id does not match. */
export function storageObjectOwnedBy(path: string, ownerId: string): boolean {
  if (!ownerId || !OWNER_ID.test(ownerId) || !path || path.includes('\\') || path.includes('\0')) return false;
  if (path.toLowerCase() === ownerId.toLowerCase()) return true;
  return objectPathForOwner(path, 'object', ownerId) !== null;
}

export function pathsForRemoval(
  fileReferences: Array<string | null | undefined>,
  bucket: string,
  ownerId: string,
): string[] {
  const paths = fileReferences
    .map((reference) => objectPathForOwner(reference, bucket, ownerId))
    .filter((path): path is string => Boolean(path));
  return [...new Set(paths)];
}

/**
 * Read, signed URL, delete, move, copy, or overwrite of one key.
 * Move and copy also reject a destination outside the same owner prefix.
 */
export function authorizeStorageKey(input: {
  operation: StorageOperation;
  bucket: string;
  ownerId: string;
  fileReference: string | null | undefined;
  destinationReference?: string | null;
}): StorageAccessDecision {
  const path = objectPathForOwner(input.fileReference, input.bucket, input.ownerId);
  if (!path) return { ok: false, status: 404, error: 'Invalid file path' };
  if (input.destinationReference !== undefined && input.destinationReference !== null) {
    const destination = objectPathForOwner(input.destinationReference, input.bucket, input.ownerId);
    if (!destination) return { ok: false, status: 404, error: 'Invalid file path' };
  }
  return { ok: true, path };
}

/**
 * A download is allowed only when the key belongs to the trusted owner and
 * every password-protected record that points at the same key accepts the
 * supplied password. A copy's own password is not enough when another record
 * protects that key with a different hash.
 */
export function authorizeStoredFileRead(input: {
  bucket: string;
  ownerId: string;
  requested: StoredFileGrant;
  related?: StoredFileGrant[];
  password?: string | null;
  passwordMatches?: (entered: string, hash: string) => boolean;
}): StorageAccessDecision {
  const path = objectPathForOwner(input.requested.fileReference, input.bucket, input.ownerId);
  if (!path) return { ok: false, status: 404, error: 'Invalid file path' };

  const grants = [input.requested, ...(input.related ?? [])].filter((grant) => {
    if (!grant.requiresPassword) return false;
    return objectPathForOwner(grant.fileReference, input.bucket, input.ownerId) === path;
  });
  if (grants.length === 0) return { ok: true, path };

  const entered = input.password?.trim() || '';
  if (!entered || !input.passwordMatches) {
    return { ok: false, status: 403, error: 'Password required' };
  }

  if (grants.some((grant) => !grant.passwordHash)) {
    return { ok: false, status: 403, error: 'Password required' };
  }
  const hashes = [...new Set(grants.map((grant) => grant.passwordHash).filter((hash): hash is string => Boolean(hash)))];
  for (const hash of hashes) {
    if (!input.passwordMatches(entered, hash)) {
      return { ok: false, status: 403, error: 'Incorrect password' };
    }
  }
  return { ok: true, path };
}
