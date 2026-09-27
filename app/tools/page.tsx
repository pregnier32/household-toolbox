import type { Metadata } from 'next';
import { JsonLd } from '@/app/components/public/JsonLd';
import { PublicFooter } from '@/app/components/public/PublicFooter';
import { PublicHeader } from '@/app/components/public/PublicHeader';
import { PublicToolCard } from '@/app/components/public/PublicToolCard';
import { TrackPublicPageView } from '@/app/components/public/TrackPublicPageView';
import { PUBLIC_ANALYTICS_EVENTS } from '@/lib/public-analytics-events';
import { absoluteUrl, PUBLIC_SITE_NAME, publicMetadata } from '@/lib/public-site';
import { categoryAnchorId, getPublicTools, getPublicToolsByCategory, PUBLIC_SIGNUP_NOTE } from '@/lib/public-tools';
import { TrackedLink } from '@/app/components/public/TrackedLink';

export const metadata: Metadata = publicMetadata({
  title: 'Household Tools & Apps | Household Toolbox',
  description:
    'Household Toolbox is a collection of practical tools for home upkeep, health, money, plans, and records, all under one account.',
  path: '/tools',
});

export default function ToolsDirectoryPage() {
  const groups = getPublicToolsByCategory();
  const toolCount = getPublicTools().length;

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: 'Tools', item: absoluteUrl('/tools') },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Household Tools & Apps',
      url: absoluteUrl('/tools'),
      description:
        'A directory of the focused tools in Household Toolbox for managing a home and everyday life.',
      isPartOf: {
        '@type': 'WebSite',
        name: PUBLIC_SITE_NAME,
        url: absoluteUrl('/'),
      },
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <TrackPublicPageView eventName={PUBLIC_ANALYTICS_EVENTS.toolsDirectoryView} />
      <JsonLd data={structuredData} />
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <TrackedLink href="/" className="hover:text-emerald-300" eventName={PUBLIC_ANALYTICS_EVENTS.toolsDirectoryClick} eventParams={{ source: 'directory_breadcrumb_home' }}>
                Home
              </TrackedLink>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-slate-200" aria-current="page">
              Tools
            </li>
          </ol>
        </nav>

        <header className="mt-8 max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">Household Toolbox</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Tools for Managing Your Home and Everyday Life
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-300">
            Household Toolbox is a collection of focused tools that work together under one account. Home upkeep, health,
            money, plans, and records each live in their own tool. Dates you pin show up on one dashboard calendar.
          </p>
          <p className="mt-3 text-sm text-slate-400">{toolCount} tools, grouped the way the toolbox is organized.</p>
        </header>

        <nav aria-label="Tool categories" className="mt-8 flex flex-wrap gap-2">
          {groups.map((group) => (
            <a
              key={group.category}
              href={`#${categoryAnchorId(group.category)}`}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              {group.category}
            </a>
          ))}
        </nav>

        <div className="mt-12 space-y-14">
          {groups.map((group) => (
            <section key={group.category} id={categoryAnchorId(group.category)} aria-labelledby={categoryAnchorId(group.category) + '-title'} className="scroll-mt-8">
              <h2 id={`${categoryAnchorId(group.category)}-title`} className="text-2xl font-semibold text-slate-50">
                {group.category}
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.tools.map((tool) => (
                  <PublicToolCard key={tool.slug} tool={tool} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-16 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-10 text-center">
          <h2 className="text-2xl font-semibold text-slate-50">Start with the tools you need</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">
            Create an account and turn on the tools you want. {PUBLIC_SIGNUP_NOTE}
          </p>
          <TrackedLink
            href="/"
            eventName={PUBLIC_ANALYTICS_EVENTS.signupClick}
            eventParams={{ placement: 'tools_directory' }}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Get Started Free
          </TrackedLink>
        </section>

        <div className="mt-16">
          <PublicFooter />
        </div>
      </div>
    </main>
  );
}
