export function toolOffersTrial(tool: {
  name?: string | null;
  price?: number | null;
  offers_trial?: boolean | null;
}): boolean {
  if (tool.offers_trial === false) return false;
  if (tool.name === 'Home Maintenance Schedule' && Number(tool.price) <= 0) {
    return false;
  }
  return Number(tool.price) > 0;
}
