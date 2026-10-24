export class ToolDataRemainsError extends Error {
  constructor() {
    super('This tool could not be fully removed. Some records or files are still there. Please try again.');
    this.name = 'ToolDataRemainsError';
  }
}

export function sameHouseholdTool(
  left: { userId: string; toolId: string },
  right: { userId: string; toolId: string },
): boolean {
  return Boolean(left.userId && left.toolId && left.userId === right.userId && left.toolId === right.toolId);
}

export function storageRemovalFinished(removeFailed: boolean, filesStillPresent: number): boolean {
  return !removeFailed && filesStillPresent === 0;
}

export function removalCleanupComplete(remaining: { rows: number; files: number }): boolean {
  return remaining.rows === 0 && remaining.files === 0;
}

/**
 * Claim the ownership row, delete that household's tool data, and drop
 * ownership only after no rows or files remain. A failed step leaves the
 * claim in place so the same removal can be retried.
 */
export async function runPermanentToolRemoval(args: {
  claim: () => Promise<'claimed' | 'missing'>;
  deleteData: () => Promise<void>;
  remaining: () => Promise<{ rows: number; files: number }>;
  syncAccess: () => Promise<void>;
  dropOwnership: () => Promise<void>;
}): Promise<void> {
  const claim = await args.claim();
  if (claim === 'missing') {
    const missing = new Error('Tool not found or access denied.');
    missing.name = 'ToolRemovalMissing';
    throw missing;
  }
  await args.deleteData();
  const remaining = await args.remaining();
  if (!removalCleanupComplete(remaining)) throw new ToolDataRemainsError();
  await args.syncAccess();
  await args.dropOwnership();
}
