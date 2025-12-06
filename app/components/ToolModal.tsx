'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { DynamicIcon } from './DynamicIcon';

type ToolIcon = {
  id: string;
  icon_url: string | null;
  has_icon_data: boolean;
};

type Tool = {
  id: string;
  name: string;
  tool_tip: string | null;
  description: string | null;
  price: number;
  status: string;
  icons: {
    default?: ToolIcon;
    coming_soon?: ToolIcon;
    available?: ToolIcon;
  };
};

type ToolModalProps = {
  tool: Tool | null;
  isOpen: boolean;
  onClose: () => void;
  onBuy: (toolId: string) => Promise<void>;
  isBuying?: boolean;
  buyMessage?: { type: 'success' | 'error'; text: string } | null;
};

export function ToolModal({ tool, isOpen, onClose, onBuy, isBuying = false, buyMessage }: ToolModalProps) {
  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !tool) {
    return null;
  }

  // Use default icon first, then fallback to available/coming_soon for backward compatibility
  const icon = tool.icons.default || tool.icons.available || tool.icons.coming_soon;
  // Get icon name/URL - if it's a URL (starts with http or /), use it, otherwise use icon name
  const iconSrc = icon?.icon_url || (icon?.id ? `/api/tools/icons/${icon.id}` : null);

  const handleBuy = async () => {
    await onBuy(tool.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          aria-label="Close modal"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Tool Icon */}
        {iconSrc && (
          <div className="mb-4 flex justify-center">
            <DynamicIcon 
              iconName={iconSrc} 
              size={80} 
              className="text-slate-300"
            />
          </div>
        )}

        {/* Tool Name */}
        <h2 className="text-2xl font-semibold text-slate-50 mb-2 text-center">
          {tool.name}
        </h2>

        {/* Price */}
        <p className="text-lg font-medium text-emerald-400 mb-4 text-center">
          ${tool.price.toFixed(2)} / month
        </p>

        {/* Trial Notice - Not shown for coming_soon or custom tools */}
        {tool.status !== 'coming_soon' && tool.status !== 'custom' && (
          <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2">
            <p className="text-sm text-amber-300 text-center">
              <span className="font-semibold">7-day free trial</span> - Start your trial today, no charge until after 7 days
            </p>
          </div>
        )}

        {/* Tool Tip */}
        {tool.tool_tip && (
          <div className="mb-4">
            <p className="text-sm text-slate-300">{tool.tool_tip}</p>
          </div>
        )}

        {/* Description */}
        {tool.description && (
          <div className="mb-6">
            <p className="text-sm text-slate-400 whitespace-pre-line">{tool.description}</p>
          </div>
        )}

        {/* Buy Message */}
        {buyMessage && (
          <div
            className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
              buyMessage.type === 'success'
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/50 bg-red-500/10 text-red-300'
            }`}
          >
            {buyMessage.text}
          </div>
        )}

        {/* Buy Button - Only show for tools that are not "coming_soon" */}
        {tool.status !== 'coming_soon' && (
          <div className="border-t border-slate-800 pt-4">
            <button
              onClick={handleBuy}
              disabled={isBuying}
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBuying ? 'Processing...' : 'Buy'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

