import { PUBLIC_ANALYTICS_EVENTS } from '@/lib/public-analytics-events';
import { getFeaturedPublicTools } from '@/lib/public-tools';
import { PublicToolCard } from './PublicToolCard';
import { TrackedLink } from './TrackedLink';

export function ExploreToolbox() {
  const tools = getFeaturedPublicTools();

  return (
    <section className="mb-16" aria-labelledby="explore-toolbox">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">The toolbox</p>
      <h2 id="explore-toolbox" className="mt-2 text-xl font-semibold text-slate-50 sm:text-2xl">
        Explore the Toolbox
      </h2>
      <p className="mt-2 max-w-xl text-sm text-slate-300">
        Household Toolbox includes more than a single checklist. These are a few of the tools. Each one keeps its own records.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((tool) => (
          <PublicToolCard
            key={tool.slug}
            tool={tool}
            headingLevel="h3"
            learnMoreEvent={PUBLIC_ANALYTICS_EVENTS.featuredToolClick}
            learnMoreParams={{ source: 'homepage' }}
          />
        ))}
      </div>
      <TrackedLink
        href="/tools"
        eventName={PUBLIC_ANALYTICS_EVENTS.toolsDirectoryClick}
        eventParams={{ source: 'homepage_explore' }}
        className="mt-6 inline-flex items-center text-sm font-medium text-emerald-300 hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm"
      >
        View All Tools
      </TrackedLink>
    </section>
  );
}
