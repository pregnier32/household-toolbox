/**
 * users_tools.price is the catalog shelf price, in dollars, snapshotted when
 * the tool is activated. Trials, free slots, and promotions change what the
 * customer pays. They do not change this shelf price.
 *
 * A stored 0 is a real snapshot, including older rows written before the
 * catalog price was $2. Reading an account does not replace it. A new
 * activation, or an explicit reactivate through buy/assign, stores the
 * current catalog price and ignores any price sent by the browser.
 */
export function ownershipShelfPrice(catalogPrice: number | null | undefined, clientPrice?: unknown): number {
  void clientPrice;
  const catalog = Number(catalogPrice);
  if (!Number.isFinite(catalog) || catalog < 0) return 0;
  return catalog;
}

export function keptOwnershipShelf(
  storedPrice: number | null | undefined,
  catalogPrice: number | null | undefined,
): number {
  if (storedPrice == null) return ownershipShelfPrice(catalogPrice);
  const stored = Number(storedPrice);
  if (!Number.isFinite(stored) || stored < 0) return ownershipShelfPrice(catalogPrice);
  return stored;
}
