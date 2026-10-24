/**
 * A tool that already has a ledger row cannot start a second trial.
 * `existing` is null only when this is the first start.
 */
export function trialGrantForStart(
  existing: { trialUsed: boolean } | null,
  requested: boolean,
): { trialGranted: boolean; trialUsed: boolean } {
  if (existing) return { trialGranted: false, trialUsed: existing.trialUsed };
  return { trialGranted: requested, trialUsed: requested };
}
