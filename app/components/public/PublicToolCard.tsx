import { PUBLIC_ANALYTICS_EVENTS } from '@/lib/public-analytics-events';
import type { PublicTool } from '@/lib/public-tools';
import { ToolIcon } from './ToolIcon';
import { TrackedLink } from './TrackedLink';

type PublicToolCardProps = {
  tool: PublicTool;
  learnMoreEvent?: string;
  learnMoreParams?: Record<string, string>;
  headingLevel?: 'h2' | 'h3';
};

export function PublicToolCard({
  tool,
  learnMoreEvent = PUBLIC_ANALYTICS_EVENTS.toolsDirectoryClick,
  learnMoreParams,
  headingLevel = 'h3',
}: PublicToolCardProps) {
  const Heading = headingLevel;
  const params = { slug: tool.slug, ...(learnMoreParams ?? {}) };

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
          <ToolIcon name={tool.icon} className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-300">{tool.category}</p>
          <Heading className="mt-1 text-base font-semibold text-slate-50">{tool.name}</Heading>
        </div>
      </div>
      <p className="mt-3 flex-1 text-sm leading-6 text-slate-300">{tool.shortDescription}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <TrackedLink
          href={`/tools/${tool.slug}`}
          eventName={learnMoreEvent}
          eventParams={params}
          className="text-sm font-medium text-emerald-300 hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm"
        >
          Learn more about {tool.name}
        </TrackedLink>
      </div>
    </article>
  );
}
