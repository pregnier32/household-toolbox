import type { MetadataRoute } from 'next';
import { getIndexableGuides } from '@/lib/public-guides';
import { absoluteUrl } from '@/lib/public-site';
import { getPublicTools } from '@/lib/public-tools';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ['/', '/tools', '/pricing', '/faq', '/support', '/terms-of-service', '/privacy-policy'];

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: path === '/' || path === '/tools' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/tools' ? 0.9 : 0.5,
  }));

  const toolEntries: MetadataRoute.Sitemap = getPublicTools().map((tool) => ({
    url: absoluteUrl(`/tools/${tool.slug}`),
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const guideEntries: MetadataRoute.Sitemap = getIndexableGuides().map((guide) => ({
    url: absoluteUrl(`/guides/${guide.slug}`),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticEntries, ...toolEntries, ...guideEntries];
}
