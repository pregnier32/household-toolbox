'use client';

import { getToolComponent } from '../toolRegistry';
import type { Tool } from '../types';

export function ToolRenderer({ tool }: { tool: Tool }) {
  const Component = getToolComponent(tool.name);

  if (!Component) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-50">{tool.name}</h2>
        <p className="text-slate-400">{tool.description || 'No description available.'}</p>
      </div>
    );
  }

  return <Component toolId={tool.id} />;
}
