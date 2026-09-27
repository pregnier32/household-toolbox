/**
 * Future educational guides.
 *
 * Do not add a guide here until it has real, useful content. Empty or
 * placeholder guides should not be published.
 *
 * To add a guide later:
 * 1. Add an entry to PUBLIC_GUIDES with indexable: true.
 * 2. Build /guides and /guides/[slug] from this list, using the same public
 *    header, footer, metadata helpers, and sitemap path as the tool pages.
 * 3. Point relatedToolSlugs at public tool slugs so the article can link to
 *    the matching tool.
 * 4. Indexable guides are included in the sitemap automatically.
 */

export type PublicGuide = {
  slug: string;
  title: string;
  description: string;
  relatedToolSlugs: string[];
  indexable: boolean;
};

export const PUBLIC_GUIDES: PublicGuide[] = [];

export function getIndexableGuides(): PublicGuide[] {
  return PUBLIC_GUIDES.filter((guide) => guide.indexable);
}
