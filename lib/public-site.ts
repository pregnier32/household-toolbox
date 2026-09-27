/**
 * Public marketing site URL and metadata helpers.
 * Canonicals always use the production host so localhost env values are not indexed.
 */

import type { Metadata } from 'next';

export const PUBLIC_SITE_NAME = 'Household Toolbox';
export const PUBLIC_PRODUCTION_URL = 'https://householdtoolbox.com';
export const PUBLIC_OG_IMAGE_PATH = '/images/logo/Logo_Side_Black.png';

export function getPublicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (raw && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (parsed.hostname === 'householdtoolbox.com' || parsed.hostname === 'www.householdtoolbox.com') {
        parsed.protocol = 'https:';
        parsed.hostname = 'householdtoolbox.com';
        return parsed.origin;
      }
      return raw;
    } catch {
      return PUBLIC_PRODUCTION_URL;
    }
  }
  return PUBLIC_PRODUCTION_URL;
}

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getPublicSiteUrl()}${normalized}`;
}

type PublicMetadataInput = {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  keywords?: string[];
};

export function publicMetadata({
  title,
  description,
  path,
  index = true,
  keywords,
}: PublicMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const image = absoluteUrl(PUBLIC_OG_IMAGE_PATH);

  return {
    title: { absolute: title },
    description,
    keywords,
    alternates: { canonical: url },
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
    openGraph: {
      title,
      description,
      url,
      siteName: PUBLIC_SITE_NAME,
      type: 'website',
      images: [{ url: image, alt: PUBLIC_SITE_NAME }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export function privatePageMetadata(): Metadata {
  return {
    robots: { index: false, follow: false, nocache: true },
  };
}
