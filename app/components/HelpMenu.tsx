'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from './AppThemeProvider';

type HelpMenuProps = {
  className?: string;
};

export function HelpMenu({ className = '' }: HelpMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const triggerClass = isLight
    ? 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-emerald-700'
    : 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/50 hover:text-emerald-300';

  const menuPanelClass = isLight
    ? 'absolute right-0 z-50 mt-2 w-48 rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5'
    : 'absolute right-0 z-50 mt-2 w-48 rounded-lg border border-slate-700 bg-slate-800 shadow-lg';

  const menuItemClass = isLight
    ? 'flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100'
    : 'flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700';

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className={triggerClass}>
        <span>Help</span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className={menuPanelClass}>
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                router.push('/faq');
                setIsOpen(false);
              }}
              className={menuItemClass}
            >
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.657-1.343 3-3 3H6m12-4a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>FAQ</span>
            </button>
            <button
              type="button"
              onClick={() => {
                router.push('/support');
                setIsOpen(false);
              }}
              className={menuItemClass}
            >
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <span>Support</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
