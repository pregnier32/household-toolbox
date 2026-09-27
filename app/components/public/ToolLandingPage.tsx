import { PUBLIC_ANALYTICS_EVENTS } from '@/lib/public-analytics-events';
import { absoluteUrl, PUBLIC_SITE_NAME } from '@/lib/public-site';
import {
  categoryAnchorId,
  getRelatedPublicTools,
  PUBLIC_SIGNUP_NOTE,
  type PublicTool,
} from '@/lib/public-tools';
import { JsonLd } from './JsonLd';
import { PublicFooter } from './PublicFooter';
import { PublicHeader } from './PublicHeader';
import { PublicToolCard } from './PublicToolCard';
import { ToolIcon } from './ToolIcon';
import { TrackedLink } from './TrackedLink';
import { TrackPublicPageView } from './TrackPublicPageView';

const primaryButtonClass =
  'inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';

const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-emerald-500/50 hover:text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

type ToolLandingPageProps = {
  tool: PublicTool;
};

export function ToolLandingPage({ tool }: ToolLandingPageProps) {
  const related = getRelatedPublicTools(tool);
  const pageUrl = absoluteUrl(`/tools/${tool.slug}`);
  const signupParams = { slug: tool.slug };

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: 'Tools', item: absoluteUrl('/tools') },
        { '@type': 'ListItem', position: 3, name: tool.name, item: pageUrl },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: tool.name,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web',
      url: pageUrl,
      description: tool.seoDescription,
      provider: {
        '@type': 'Organization',
        name: PUBLIC_SITE_NAME,
        url: absoluteUrl('/'),
      },
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <TrackPublicPageView eventName={PUBLIC_ANALYTICS_EVENTS.toolPageView} slug={tool.slug} />
      <JsonLd data={structuredData} />
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <TrackedLink href="/" eventName={PUBLIC_ANALYTICS_EVENTS.toolsDirectoryClick} eventParams={{ source: 'breadcrumb_home' }} className="hover:text-emerald-300">
                Home
              </TrackedLink>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <TrackedLink href="/tools" eventName={PUBLIC_ANALYTICS_EVENTS.toolsDirectoryClick} eventParams={{ source: 'breadcrumb' }} className="hover:text-emerald-300">
                Tools
              </TrackedLink>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-slate-200" aria-current="page">
              {tool.name}
            </li>
          </ol>
        </nav>

        <section className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)] lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">
              <a href={`/tools#${categoryAnchorId(tool.category)}`} className="hover:text-emerald-200">
                {tool.category}
              </a>
            </p>
            <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
              {tool.headline}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">{tool.intro}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <TrackedLink
                href="/"
                eventName={PUBLIC_ANALYTICS_EVENTS.signupClick}
                eventParams={{ ...signupParams, placement: 'hero' }}
                className={primaryButtonClass}
              >
                Get Started Free
              </TrackedLink>
              <TrackedLink
                href="/tools"
                eventName={PUBLIC_ANALYTICS_EVENTS.toolsDirectoryClick}
                eventParams={{ source: 'tool_hero', slug: tool.slug }}
                className={secondaryButtonClass}
              >
                Explore All Tools
              </TrackedLink>
            </div>
            <p className="mt-3 max-w-xl text-xs leading-5 text-slate-500">{PUBLIC_SIGNUP_NOTE}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
              <ToolIcon name={tool.icon} className="h-8 w-8" />
            </div>
            <p className="mt-6 text-lg font-semibold text-slate-50">{tool.name}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{tool.shortDescription}</p>
          </div>
        </section>

        <section className="mt-16" aria-labelledby="lead-heading">
          <h2 id="lead-heading" className="text-2xl font-semibold text-slate-50">
            {tool.leadHeading}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Household Toolbox keeps this with your other household records under one account.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-2xl font-semibold text-slate-50">
            {tool.featuresTitle}
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {tool.features.map((feature) => (
              <li key={feature.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <h3 className="text-sm font-semibold text-slate-100">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{feature.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16" aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-2xl font-semibold text-slate-50">
            How It Works
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {tool.howItWorks.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Step {index + 1}</p>
                <h3 className="mt-2 text-sm font-semibold text-slate-100">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16" aria-labelledby="usecases-heading">
          <h2 id="usecases-heading" className="text-2xl font-semibold text-slate-50">
            {tool.useCasesTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{tool.useCasesIntro}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {tool.useCases.map((useCase) => (
              <li key={useCase} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-200">
                <span className="mt-0.5 text-emerald-300" aria-hidden="true">
                  ✓
                </span>
                <span>{useCase}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-2xl font-semibold text-slate-50">
            Frequently asked questions
          </h2>
          <div className="mt-6 space-y-3">
            {tool.faq.map((item) => (
              <details key={item.question} className="group rounded-2xl border border-slate-800 bg-slate-900/70">
                <summary className="cursor-pointer list-none px-5 py-4 text-base font-medium text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-2xl">
                  <span className="flex items-center justify-between gap-4">
                    {item.question}
                    <span className="text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true">
                      ▾
                    </span>
                  </span>
                </summary>
                <p className="px-5 pb-5 text-sm leading-6 text-slate-300">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {related.length > 0 && (
          <section className="mt-16" aria-labelledby="related-heading">
            <h2 id="related-heading" className="text-2xl font-semibold text-slate-50">
              Related household tools
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((relatedTool) => (
                <PublicToolCard
                  key={relatedTool.slug}
                  tool={relatedTool}
                  learnMoreEvent={PUBLIC_ANALYTICS_EVENTS.relatedToolClick}
                  learnMoreParams={{ from: tool.slug, to: relatedTool.slug }}
                />
              ))}
            </div>
          </section>
        )}

        <section className="mt-16 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-10 text-center" aria-labelledby="cta-heading">
          <h2 id="cta-heading" className="text-2xl font-semibold text-slate-50">
            Put your household information to work
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">
            Create your Household Toolbox account and start using {tool.name}. {PUBLIC_SIGNUP_NOTE}
          </p>
          <TrackedLink
            href="/"
            eventName={PUBLIC_ANALYTICS_EVENTS.signupClick}
            eventParams={{ ...signupParams, placement: 'footer' }}
            className={`${primaryButtonClass} mt-6`}
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
