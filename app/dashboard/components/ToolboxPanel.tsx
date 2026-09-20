'use client';

import { ToolCard } from './ToolCard';
import { ToolRenderer } from './ToolRenderer';
import type { Tool } from '../types';

type ToolboxPanelProps = {
  tools: Tool[];
  isLoadingTools: boolean;
  activeToolId: string | null;
  onToolClick: (tool: Tool) => void;
};

export function ToolboxPanel({
  tools,
  isLoadingTools,
  activeToolId,
  onToolClick,
}: ToolboxPanelProps) {
  if (activeToolId !== null) {
    const tool = tools.find((t) => t.id === activeToolId);
    if (!tool) return null;
    return (
      <div>
        <ToolRenderer tool={tool} />
      </div>
    );
  }

  const activeTools = tools
    .filter((t) => t.isOwned === true && t.isActive === true)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-50">Your Tool Box</h1>
      {isLoadingTools ? (
        <p className="text-slate-400">Loading tools...</p>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-slate-100">Active</h2>
            {activeTools.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
                {activeTools.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onClick={() => onToolClick(tool)}
                    iconPreference="owned"
                    titleClamp
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No active tools at this time.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
