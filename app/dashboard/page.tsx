'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UserMenu } from '../components/UserMenu';
import { SideLogo } from '../components/SideLogo';
import { useTheme } from '../components/AppThemeProvider';
import { AdminMenu } from '../components/AdminMenu';
import { ToolModal } from '../components/ToolModal';
import { GoalsProvider } from '../components/GoalsTrackingTool';
import { completeSignOut } from '@/lib/client-sign-out';
import { CalendarPanel } from './components/CalendarPanel';
import { ToolboxPanel } from './components/ToolboxPanel';
import { StorePanel } from './components/StorePanel';
import { AdminOverviewPanel } from './components/AdminOverviewPanel';
import type { DashboardTab, Tool, User } from './types';

export default function Dashboard() {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const tabActiveClass = isLight
    ? 'border-b-2 border-emerald-600 text-emerald-900 font-semibold'
    : 'border-b-2 border-emerald-500 text-emerald-300';
  const tabInactiveClass = isLight
    ? 'text-slate-600 hover:text-slate-900'
    : 'text-slate-400 hover:text-slate-300';
  const navChromeBorderClass = isLight
    ? 'border-b-2 border-slate-400'
    : 'border-b-2 border-slate-600';

  const [activeTab, setActiveTab] = useState<DashboardTab>('tools');
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [openedToolIds, setOpenedToolIds] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [buyMessage, setBuyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  const isSuperAdmin = user?.userStatus === 'superadmin';

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        } else {
          router.push('/');
        }
        setIsLoading(false);
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  const loadTools = useCallback(() => {
    setIsLoadingTools(true);
    fetch('/api/tools')
      .then((res) => res.json())
      .then((data) => {
        if (data.tools) {
          setTools(data.tools || []);
        }
        setIsLoadingTools(false);
      })
      .catch((error) => {
        console.error('Error fetching tools:', error);
        setIsLoadingTools(false);
      });
  }, []);

  useEffect(() => {
    if (activeTab === 'tools' || activeTab === 'store') {
      loadTools();
    }
  }, [activeTab, loadTools]);

  const deepLinkAppliedRef = useRef(false);
  const toolsLoadStartedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'tools' || params.get('open') === 'address-book') {
      setActiveTab('tools');
    }
  }, []);

  useEffect(() => {
    if (isLoadingTools) {
      toolsLoadStartedRef.current = true;
    }
  }, [isLoadingTools]);

  useEffect(() => {
    if (deepLinkAppliedRef.current) return;
    if (new URLSearchParams(window.location.search).get('open') !== 'address-book') return;
    if (activeTab !== 'tools' || isLoadingTools || !toolsLoadStartedRef.current) return;

    const addressBook = tools.find((t) => t.name === 'Address Book');
    if (addressBook?.isOwned) {
      setActiveToolId(addressBook.id);
      setOpenedToolIds((prev) => new Set(prev).add(addressBook.id));
    }
    deepLinkAppliedRef.current = true;
  }, [activeTab, tools, isLoadingTools]);

  const handleSignOut = async () => {
    await completeSignOut();
  };

  const handleToolClick = (tool: Tool) => {
    if (tool.isOwned) {
      setActiveTab('tools');
      setActiveToolId(tool.id);
      setOpenedToolIds((prev) => new Set(prev).add(tool.id));
      return;
    }
    setSelectedTool(tool);
    setIsModalOpen(true);
    setBuyMessage(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTool(null);
    setBuyMessage(null);
    setIsBuying(false);
  };

  const handleBuy = async (toolId: string) => {
    setIsBuying(true);
    setBuyMessage(null);

    try {
      const response = await fetch('/api/tools/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toolId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setBuyMessage({ type: 'error', text: data.error || 'Failed to purchase tool' });
        setIsBuying(false);
        return;
      }

      setBuyMessage({ type: 'success', text: data.message || 'Tool purchased successfully!' });

      setTimeout(() => {
        setIsBuying(false);
        loadTools();
        handleCloseModal();
      }, 1500);
    } catch (error) {
      console.error('Error purchasing tool:', error);
      setBuyMessage({ type: 'error', text: 'An error occurred while purchasing the tool' });
      setIsBuying(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-slate-400">Loading...</div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const goalsToolId = tools.find((t) => t.name === 'Goals Tracking')?.id ?? null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <GoalsProvider goalsToolId={goalsToolId}>
        <header className={`${navChromeBorderClass} bg-slate-900/50`}>
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="relative flex items-center">
              <SideLogo priority />
            </div>

            <div className="flex items-center gap-3">
              {isSuperAdmin && (
                <AdminMenu
                  onOverviewClick={() => {
                    setActiveTab('overview');
                    setActiveToolId(null);
                  }}
                />
              )}
              <UserMenu
                userName={`${user.firstName} ${user.lastName || ''}`.trim()}
                onSignOut={handleSignOut}
              />
            </div>
          </div>
        </header>

        <div className={`${navChromeBorderClass} bg-slate-950`}>
          <div className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => {
                setActiveTab('tools');
              }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'tools' ? tabActiveClass : tabInactiveClass
              }`}
            >
              Tool Box
            </button>
            <button
              onClick={() => {
                setActiveTab('calendar');
                setActiveToolId(null);
              }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'calendar' ? tabActiveClass : tabInactiveClass
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => {
                setActiveTab('store');
                setActiveToolId(null);
              }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'store' ? tabActiveClass : tabInactiveClass
              }`}
            >
              Store
            </button>
          </div>
        </div>

        {activeTab === 'tools' && openedToolIds.size > 0 && (
          <div className={`${navChromeBorderClass} bg-slate-950`}>
            <div className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
              <button
                onClick={() => setActiveToolId(null)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeToolId === null ? tabActiveClass : tabInactiveClass
                }`}
              >
                All Tools
              </button>
              {tools
                .filter((t) => t.isOwned === true && openedToolIds.has(t.id))
                .map((tool) => (
                  <div key={tool.id} className="group relative">
                    <button
                      onClick={() => setActiveToolId(tool.id)}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeToolId === tool.id ? tabActiveClass : tabInactiveClass
                      }`}
                    >
                      {tool.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenedToolIds((prev) => {
                          const next = new Set(prev);
                          next.delete(tool.id);
                          return next;
                        });
                        if (activeToolId === tool.id) {
                          setActiveToolId(null);
                        }
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-700 hover:text-slate-200 group-hover:opacity-100"
                      aria-label={`Close ${tool.name}`}
                      title={`Close ${tool.name}`}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {activeTab === 'tools' && (
            <ToolboxPanel
              tools={tools}
              isLoadingTools={isLoadingTools}
              activeToolId={activeToolId}
              onToolClick={handleToolClick}
            />
          )}
          {activeTab === 'calendar' && <CalendarPanel />}
          {activeTab === 'store' && (
            <StorePanel
              tools={tools}
              isLoadingTools={isLoadingTools}
              isSuperAdmin={isSuperAdmin}
              activeToolId={activeToolId}
              onToolClick={handleToolClick}
            />
          )}
          {activeTab === 'overview' && isSuperAdmin && <AdminOverviewPanel />}
        </div>

        <ToolModal
          tool={selectedTool}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onBuy={handleBuy}
          isBuying={isBuying}
          buyMessage={buyMessage}
        />
      </GoalsProvider>
    </main>
  );
}
