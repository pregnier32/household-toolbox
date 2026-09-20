'use client';

import { ToolCard } from './ToolCard';
import { ToolRenderer } from './ToolRenderer';
import type { Tool } from '../types';

type StorePanelProps = {
  tools: Tool[];
  isLoadingTools: boolean;
  isSuperAdmin: boolean;
  activeToolId: string | null;
  onToolClick: (tool: Tool) => void;
};

function ToolSection({
  title,
  tools,
  emptyText,
  iconPreference,
  onToolClick,
}: {
  title: string;
  tools: Tool[];
  emptyText: string;
  iconPreference: 'owned' | 'available' | 'coming_soon';
  onToolClick: (tool: Tool) => void;
}) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-100">{title}</h2>
      {tools.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
          {tools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onClick={() => onToolClick(tool)}
              iconPreference={iconPreference}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">{emptyText}</p>
      )}
    </div>
  );
}

export function StorePanel({
  tools,
  isLoadingTools,
  isSuperAdmin,
  activeToolId,
  onToolClick,
}: StorePanelProps) {
  if (activeToolId !== null) {
    const tool = tools.find((t) => t.id === activeToolId);
    if (!tool) return null;
    return (
      <div>
        <ToolRenderer tool={tool} />
      </div>
    );
  }

  const availableTools = tools.filter((t) => t.status === 'available' && !t.isOwned);
  const comingSoonTools = tools.filter((t) => t.status === 'coming_soon');
  const customTools = tools.filter((t) => t.status === 'custom');

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-50">Shop Household Tools</h1>
      {isLoadingTools ? (
        <p className="text-slate-400">Loading tools...</p>
      ) : (
        <div className="space-y-8">
          <ToolSection
            title="Available"
            tools={availableTools}
            emptyText="No available tools at this time."
            iconPreference="available"
            onToolClick={onToolClick}
          />
          <div className="my-6 border-t border-slate-800" />
          <ToolSection
            title="Coming Soon"
            tools={comingSoonTools}
            emptyText="No tools coming soon at this time."
            iconPreference="coming_soon"
            onToolClick={onToolClick}
          />
          {isSuperAdmin && (
            <>
              <div className="my-6 border-t border-slate-800" />
              <ToolSection
                title="Custom"
                tools={customTools}
                emptyText="No custom tools at this time."
                iconPreference="available"
                onToolClick={onToolClick}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
