import type { Metadata } from 'next';
import { ExploreToolbox } from './components/public/ExploreToolbox';
import { HomePage } from './components/public/HomePage';
import { JsonLd } from './components/public/JsonLd';
import { absoluteUrl, PUBLIC_SITE_NAME, publicMetadata } from '@/lib/public-site';

const title = 'Household Toolbox - All your home life admin, in one place';
const description =
  'The digital toolbox for your whole household. Add tools from the store, pin dates to one dashboard calendar, keep files on each record, and export a PDF when you want a copy.';

export const metadata: Metadata = publicMetadata({
  title,
  description,
  path: '/',
});

export default function Page() {
  const siteUrl = absoluteUrl('/');
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: PUBLIC_SITE_NAME,
      url: siteUrl,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: PUBLIC_SITE_NAME,
      url: siteUrl,
      email: 'support@householdtoolbox.com',
      logo: absoluteUrl('/images/logo/Logo_Side_Black.png'),
    },
  ];

  return (
    <>
      <JsonLd data={structuredData} />
      <HomePage explore={<ExploreToolbox />} />
    </>
  );
}
