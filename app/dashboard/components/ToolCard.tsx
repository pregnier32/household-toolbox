'use client';

import { DynamicIcon } from '../../components/DynamicIcon';
import { getToolIconSrc, type Tool } from '../types';

type ToolCardProps = {
  tool: Tool;
  onClick: () => void;
  iconPreference?: 'owned' | 'available' | 'coming_soon';
  titleClamp?: boolean;
};

export function ToolCard({
  tool,
  onClick,
  iconPreference = 'owned',
  titleClamp = false,
}: ToolCardProps) {
  const iconSrc = getToolIconSrc(tool, iconPreference);

  return (
    <div
      onClick={onClick}
      className="relative flex min-h-[180px] cursor-pointer flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition-colors hover:border-emerald-500/50"
    >
      {iconSrc && (
        <div className="mb-3 flex min-h-[60px] flex-1 items-center justify-center">
          <DynamicIcon iconName={iconSrc} size={60} className="text-slate-300" />
        </div>
      )}
      {titleClamp ? (
        <div className="flex flex-col items-center">
          <h3 className="line-clamp-2 text-center text-sm font-semibold text-slate-100">{tool.name}</h3>
        </div>
      ) : (
        <h3 className="mb-1 text-center text-sm font-semibold text-slate-100">{tool.name}</h3>
      )}
    </div>
  );
}
