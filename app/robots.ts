import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/public-site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard', '/forgot-password', '/reset-password', '/toolbox', '/address-book', '/auth/mfa'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
