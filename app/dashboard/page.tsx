'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { UserMenu } from '../components/UserMenu';
import { HelpMenu } from '../components/HelpMenu';
import { AdminMenu } from '../components/AdminMenu';
import { ToolModal } from '../components/ToolModal';
import { DynamicIcon } from '../components/DynamicIcon';
import { PercentOfOrderTool } from '../components/PercentOfOrderTool';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  userStatus?: string;
};

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
  created_at: string | null;
  updated_at: string | null;
  isOwned?: boolean;
  trialStatus?: string | null;
  trialEndDate?: string | null;
  icons: {
    default?: ToolIcon;
    coming_soon?: ToolIcon;
    available?: ToolIcon;
  };
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'tools' | 'dashboard' | 'overview' | 'store'>('dashboard');
  const [dashboardSubTab, setDashboardSubTab] = useState<'overview' | 'calendar'>('overview');
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [openedToolIds, setOpenedToolIds] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeUserCount, setActiveUserCount] = useState<number | null>(null);
  const [guestUserCount, setGuestUserCount] = useState<number | null>(null);
  const [activeTrialToolsCount, setActiveTrialToolsCount] = useState<number | null>(null);
  const [avgToolsPerAdmin, setAvgToolsPerAdmin] = useState<number | null>(null);
  const [usersByMonth, setUsersByMonth] = useState<{ month: string; count: number }[]>([]);
  const [toolsByName, setToolsByName] = useState<{ name: string; value: number }[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number | null>(null);
  const [lifetimeRevenue, setLifetimeRevenue] = useState<number | null>(null);
  const [revenueByDay, setRevenueByDay] = useState<{ date: string; revenue: number }[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [buyMessage, setBuyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();
  
  const isSuperAdmin = user?.userStatus === 'superadmin';

  useEffect(() => {
    // Fetch user session
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
    // Fetch admin stats when Overview tab is active and user is superadmin
    if (activeTab === 'overview' && isSuperAdmin) {
      setIsLoadingStats(true);
      fetch('/api/admin/stats')
        .then((res) => res.json())
        .then((data) => {
          if (data.activeUserCount !== undefined) {
            setActiveUserCount(data.activeUserCount);
          }
          if (data.guestUserCount !== undefined) {
            setGuestUserCount(data.guestUserCount);
          }
          if (data.activeTrialToolsCount !== undefined) {
            setActiveTrialToolsCount(data.activeTrialToolsCount);
          }
          if (data.avgToolsPerAdmin !== undefined) {
            setAvgToolsPerAdmin(data.avgToolsPerAdmin);
          }
          if (data.usersByMonth) {
            setUsersByMonth(data.usersByMonth);
          }
          if (data.toolsByName) {
            setToolsByName(data.toolsByName);
          }
          if (data.monthlyRevenue !== undefined) {
            setMonthlyRevenue(data.monthlyRevenue);
          }
          if (data.lifetimeRevenue !== undefined) {
            setLifetimeRevenue(data.lifetimeRevenue);
          }
          if (data.revenueByDay) {
            setRevenueByDay(data.revenueByDay);
          }
          setIsLoadingStats(false);
        })
        .catch((error) => {
          console.error('Error fetching stats:', error);
          setIsLoadingStats(false);
        });
    }
  }, [activeTab, isSuperAdmin]);

  useEffect(() => {
    // Fetch tools when Tools or Store tab is active
    if (activeTab === 'tools' || activeTab === 'store') {
      loadTools();
    }
  }, [activeTab, loadTools]);

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/');
  };

  const handleToolClick = (tool: Tool) => {
    // If tool is owned, open it in a sub-tab
    if (tool.isOwned) {
      setActiveTab('tools');
      setActiveToolId(tool.id);
      // Track that this tool has been opened during the session
      setOpenedToolIds(prev => new Set(prev).add(tool.id));
      return;
    }
    // Otherwise, show purchase modal
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
      
      // Refresh tools list after successful purchase
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
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center relative">
            <Image
              src="/images/logo/Logo_Side_White.png"
              alt="Household Toolbox"
              width={200}
              height={40}
              className="h-auto"
              priority
            />
          </div>

          <div className="flex items-center gap-3">
            {isSuperAdmin && <AdminMenu />}
            <HelpMenu />
            <UserMenu
              userName={`${user.firstName} ${user.lastName || ''}`.trim()}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/30">
        <div className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'border-b-2 border-emerald-500 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Overview
            </button>
          )}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'border-b-2 border-emerald-500 text-emerald-300'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'tools'
                ? 'border-b-2 border-emerald-500 text-emerald-300'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Tool Box
          </button>
          <button
            onClick={() => setActiveTab('store')}
            className={`px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'store'
                ? 'border-b-2 border-emerald-500 text-emerald-300'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Store
          </button>
        </div>
      </div>

      {/* Dashboard Sub-tabs */}
      {activeTab === 'dashboard' && (
        <div className="border-b border-slate-800 bg-slate-900/20">
          <div className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setDashboardSubTab('overview')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                dashboardSubTab === 'overview'
                  ? 'border-b-2 border-emerald-500 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setDashboardSubTab('calendar')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                dashboardSubTab === 'calendar'
                  ? 'border-b-2 border-emerald-500 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Calendar
            </button>
          </div>
        </div>
      )}

      {/* Tools Sub-tabs */}
      {activeTab === 'tools' && openedToolIds.size > 0 && (
        <div className="border-b border-slate-800 bg-slate-900/20">
          <div className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setActiveToolId(null)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeToolId === null
                  ? 'border-b-2 border-emerald-500 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              All Tools
            </button>
            {tools
              .filter(t => t.isOwned === true && openedToolIds.has(t.id))
              .map((tool) => (
                <div
                  key={tool.id}
                  className="group relative"
                >
                  <button
                    onClick={() => setActiveToolId(tool.id)}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      activeToolId === tool.id
                        ? 'border-b-2 border-emerald-500 text-emerald-300'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {tool.name}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Remove tool from opened tools
                      setOpenedToolIds(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(tool.id);
                        return newSet;
                      });
                      // If this was the active tool, switch back to All Tools
                      if (activeToolId === tool.id) {
                        setActiveToolId(null);
                      }
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                    aria-label={`Close ${tool.name}`}
                  >
                    <svg
                      className="h-4 w-4"
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
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && (
          <div>
            {dashboardSubTab === 'overview' && (
              <div>
                <h1 className="text-2xl font-semibold text-slate-50 mb-4">Dashboard</h1>
                <p className="text-slate-400 mb-6">
                  Welcome to your Household Toolbox dashboard. This is your central hub for managing your household.
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                    <p className="text-2xl mb-2">📊</p>
                    <h3 className="text-sm font-semibold text-slate-100 mb-2">Overview</h3>
                    <p className="text-xs text-slate-400">
                      Get a quick view of what needs your attention this week.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                    <p className="text-2xl mb-2">🔔</p>
                    <h3 className="text-sm font-semibold text-slate-100 mb-2">Notifications</h3>
                    <p className="text-xs text-slate-400">
                      Stay on top of important reminders and updates.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                    <p className="text-2xl mb-2">📈</p>
                    <h3 className="text-sm font-semibold text-slate-100 mb-2">Activity</h3>
                    <p className="text-xs text-slate-400">
                      Track your recent activity and progress.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {dashboardSubTab === 'calendar' && (
              <div>
                <h1 className="text-2xl font-semibold text-slate-50 mb-4">Calendar</h1>
                <p className="text-slate-400 mb-6">
                  View and manage your household calendar events and schedules.
                </p>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <p className="text-slate-400 text-center py-8">
                    Calendar view coming soon...
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tools' && (
          <div>
            {activeToolId === null ? (
              <>
                <h1 className="text-2xl font-semibold text-slate-50 mb-4">Your Tool Box</h1>
                {isLoadingTools ? (
                  <p className="text-slate-400">Loading tools...</p>
                ) : (
                  <div className="space-y-8">
                    {/* Active Tools - Tools the user owns */}
                    <div>
                      <h2 className="text-lg font-semibold text-slate-100 mb-4">Active</h2>
                      {tools.filter(t => t.isOwned === true).length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
                          {tools
                            .filter(t => t.isOwned === true)
                            .map((tool) => {
                              // Use default icon first, then fallback to available/coming_soon for backward compatibility
                              const icon = tool.icons.default || tool.icons.available || tool.icons.coming_soon;
                              // Get icon name/URL - if it's a URL (starts with http or /), use it, otherwise use icon name
                              const iconSrc = icon?.icon_url || (icon?.id ? `/api/tools/icons/${icon.id}` : null);
                              return (
                                <div 
                                  key={tool.id} 
                                  onClick={() => handleToolClick(tool)}
                                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition-colors cursor-pointer hover:border-emerald-500/50"
                                >
                                  {iconSrc && (
                                    <div className="mb-3 flex items-center justify-center">
                                      <DynamicIcon 
                                        iconName={iconSrc} 
                                        size={60} 
                                        className="text-slate-300"
                                      />
                                    </div>
                                  )}
                                  <div className="flex flex-col items-center">
                                    <h3 className="text-sm font-semibold text-slate-100 mb-1 text-center">{tool.name}</h3>
                                    {tool.trialStatus === 'trial' && (
                                      <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300 mb-1">
                                        Trial
                                      </span>
                                    )}
                                    <p className="text-xs text-emerald-400 font-medium text-center">${tool.price.toFixed(2)} / month</p>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-sm">No active tools at this time.</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Individual tool view
              <>
                {tools
                  .filter(t => t.id === activeToolId)
                  .map((tool) => (
                    <div key={tool.id}>
                      {tool.name === 'Percent of my Order' ? (
                        <PercentOfOrderTool />
                      ) : (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                          <h2 className="text-xl font-semibold text-slate-50 mb-4">{tool.name}</h2>
                          <p className="text-slate-400">{tool.description || 'No description available.'}</p>
                        </div>
                      )}
                    </div>
                  ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'store' && (
          <div>
            {activeToolId === null ? (
              <>
                <h1 className="text-2xl font-semibold text-slate-50 mb-4">Shop Household Tools</h1>
                {isLoadingTools ? (
                  <p className="text-slate-400">Loading tools...</p>
                ) : (
                  <div className="space-y-8">
                    {/* Available Tools - Tools available for purchase that user doesn't own */}
                    <div>
                      <h2 className="text-lg font-semibold text-slate-100 mb-4">Available</h2>
                      {tools.filter(t => t.status === 'available' && !t.isOwned).length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
                          {tools
                            .filter(t => t.status === 'available' && !t.isOwned)
                            .map((tool) => {
                              // Use default icon first, then fallback to available/coming_soon for backward compatibility
                              const icon = tool.icons.default || tool.icons.available || tool.icons.coming_soon;
                              // Get icon name/URL - if it's a URL (starts with http or /), use it, otherwise use icon name
                              const iconSrc = icon?.icon_url || (icon?.id ? `/api/tools/icons/${icon.id}` : null);
                              return (
                                <div 
                                  key={tool.id} 
                                  onClick={() => handleToolClick(tool)}
                                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-emerald-500/50 transition-colors cursor-pointer"
                                >
                                  {iconSrc && (
                                    <div className="mb-3 flex items-center justify-center">
                                      <DynamicIcon 
                                        iconName={iconSrc} 
                                        size={60} 
                                        className="text-slate-300"
                                      />
                                    </div>
                                  )}
                                  <h3 className="text-sm font-semibold text-slate-100 mb-1 text-center">{tool.name}</h3>
                                  <p className="text-xs text-emerald-400 font-medium text-center">${tool.price.toFixed(2)} / month</p>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-sm">No available tools at this time.</p>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-800 my-6"></div>

                    {/* Coming Soon Tools */}
                    <div>
                      <h2 className="text-lg font-semibold text-slate-100 mb-4">Coming Soon</h2>
                      {tools.filter(t => t.status === 'coming_soon').length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
                          {tools
                            .filter(t => t.status === 'coming_soon')
                            .map((tool) => {
                              // Use default icon first, then fallback to coming_soon/available for backward compatibility
                              const icon = tool.icons.default || tool.icons.coming_soon || tool.icons.available;
                              // Get icon name/URL - if it's a URL (starts with http or /), use it, otherwise use icon name
                              const iconSrc = icon?.icon_url || (icon?.id ? `/api/tools/icons/${icon.id}` : null);
                              return (
                                <div 
                                  key={tool.id} 
                                  onClick={() => handleToolClick(tool)}
                                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-emerald-500/50 transition-colors cursor-pointer"
                                >
                                  {iconSrc && (
                                    <div className="mb-3 flex items-center justify-center">
                                      <DynamicIcon 
                                        iconName={iconSrc} 
                                        size={60} 
                                        className="text-slate-300"
                                      />
                                    </div>
                                  )}
                                  <h3 className="text-sm font-semibold text-slate-100 mb-1 text-center">{tool.name}</h3>
                                  <p className="text-xs text-emerald-400 font-medium text-center">${tool.price.toFixed(2)} / month</p>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-sm">No tools coming soon at this time.</p>
                      )}
                    </div>

                    {/* Custom Tools - Only visible to superadmins */}
                    {isSuperAdmin && (
                      <>
                        {/* Divider */}
                        <div className="border-t border-slate-800 my-6"></div>

                        {/* Custom Tools */}
                        <div>
                          <h2 className="text-lg font-semibold text-slate-100 mb-4">Custom</h2>
                          {tools.filter(t => t.status === 'custom').length > 0 ? (
                            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
                              {tools
                                .filter(t => t.status === 'custom')
                                .map((tool) => {
                                  // Use default icon first, then fallback to available/coming_soon for backward compatibility
                                  const icon = tool.icons.default || tool.icons.available || tool.icons.coming_soon;
                                  // Get icon name/URL - if it's a URL (starts with http or /), use it, otherwise use icon name
                                  const iconSrc = icon?.icon_url || (icon?.id ? `/api/tools/icons/${icon.id}` : null);
                                  return (
                                    <div 
                                      key={tool.id} 
                                      onClick={() => handleToolClick(tool)}
                                      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-emerald-500/50 transition-colors cursor-pointer"
                                    >
                                      {iconSrc && (
                                        <div className="mb-3 flex items-center justify-center">
                                          <DynamicIcon 
                                            iconName={iconSrc} 
                                            size={60} 
                                            className="text-slate-300"
                                          />
                                        </div>
                                      )}
                                      <h3 className="text-sm font-semibold text-slate-100 mb-1 text-center">{tool.name}</h3>
                                      <p className="text-xs text-emerald-400 font-medium text-center">${tool.price.toFixed(2)} / month</p>
                                    </div>
                                  );
                                })}
                            </div>
                          ) : (
                            <p className="text-slate-400 text-sm">No custom tools at this time.</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              // Individual tool view
              <>
                {tools
                  .filter(t => t.id === activeToolId)
                  .map((tool) => (
                    <div key={tool.id}>
                      {tool.name === 'Percent of my Order' ? (
                        <PercentOfOrderTool />
                      ) : (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                          <h2 className="text-xl font-semibold text-slate-50 mb-4">{tool.name}</h2>
                          <p className="text-slate-400">{tool.description || 'No description available.'}</p>
                        </div>
                      )}
                    </div>
                  ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'overview' && isSuperAdmin && (
          <div>
            <h1 className="text-2xl font-semibold text-slate-50 mb-4">System Stats</h1>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <p className="text-2xl mb-2">👥</p>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Active Users</h3>
                {isLoadingStats ? (
                  <p className="text-xs text-slate-400">Loading...</p>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-emerald-400 mb-1">
                      {activeUserCount !== null ? activeUserCount : '—'}
                    </p>
                    <p className="text-xs text-slate-400 mb-4">
                      Users with active status
                    </p>
                    <div className="pt-3 border-t border-slate-800">
                      <p className="text-2xl font-bold text-purple-400 mb-1">
                        {guestUserCount !== null ? guestUserCount : '—'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Guest users
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Users Created by Month</h3>
                {isLoadingStats ? (
                  <p className="text-xs text-slate-400">Loading...</p>
                ) : usersByMonth.length > 0 ? (
                  <div className="mt-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={usersByMonth}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis 
                          dataKey="month" 
                          tick={{ fill: '#94a3b8', fontSize: 10 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          tick={{ fill: '#94a3b8', fontSize: 10 }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#e2e8f0'
                          }}
                          labelStyle={{ color: '#94a3b8' }}
                        />
                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No data available</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <p className="text-2xl mb-2">🔧</p>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Active & Trial Tools</h3>
                {isLoadingStats ? (
                  <p className="text-xs text-slate-400">Loading...</p>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-emerald-400 mb-1">
                      {activeTrialToolsCount !== null ? activeTrialToolsCount : '—'}
                    </p>
                    <p className="text-xs text-slate-400 mb-4">
                      Tools with active or trial status
                    </p>
                    <div className="pt-3 border-t border-slate-800">
                      <p className="text-2xl font-bold text-emerald-400 mb-1">
                        {avgToolsPerAdmin !== null ? avgToolsPerAdmin.toFixed(2) : '—'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Average Tools per admin user
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Tools by Name</h3>
                {isLoadingStats ? (
                  <p className="text-xs text-slate-400">Loading...</p>
                ) : toolsByName.length > 0 ? (
                  <div className="mt-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={toolsByName}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {toolsByName.map((entry, index) => {
                            const colors = [
                              '#10b981', // emerald
                              '#3b82f6', // blue
                              '#8b5cf6', // purple
                              '#f59e0b', // amber
                              '#ef4444', // red
                              '#06b6d4', // cyan
                              '#ec4899', // pink
                              '#84cc16', // lime
                            ];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#e2e8f0'
                          }}
                          formatter={(value: number) => [value, 'Count']}
                        />
                        <Legend 
                          wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }}
                          formatter={(value) => value}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No data available</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <p className="text-2xl mb-2">💰</p>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Monthly Revenue</h3>
                {isLoadingStats ? (
                  <p className="text-xs text-slate-400">Loading...</p>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-emerald-400 mb-1">
                      {monthlyRevenue !== null 
                        ? new Intl.NumberFormat('en-US', { 
                            style: 'currency', 
                            currency: 'USD',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }).format(monthlyRevenue)
                        : '—'}
                    </p>
                    <p className="text-xs text-slate-400 mb-4">
                      Total pending revenue from billing_active
                    </p>
                    <div className="pt-3 border-t border-slate-800">
                      <p className="text-2xl font-bold text-emerald-400 mb-1">
                        {lifetimeRevenue !== null 
                          ? new Intl.NumberFormat('en-US', { 
                              style: 'currency', 
                              currency: 'USD',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }).format(lifetimeRevenue)
                          : '—'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Lifetime Revenue
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Revenue by Day</h3>
                {isLoadingStats ? (
                  <p className="text-xs text-slate-400">Loading...</p>
                ) : revenueByDay.length > 0 ? (
                  <div className="mt-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={revenueByDay}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#94a3b8"
                          style={{ fontSize: '12px' }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          stroke="#94a3b8"
                          style={{ fontSize: '12px' }}
                          tickFormatter={(value) => `$${value.toFixed(0)}`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#e2e8f0'
                          }}
                          formatter={(value: number) => [
                            new Intl.NumberFormat('en-US', { 
                              style: 'currency', 
                              currency: 'USD',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }).format(value),
                            'Revenue'
                          ]}
                        />
                        <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No data available</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tool Modal */}
      <ToolModal
        tool={selectedTool}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onBuy={handleBuy}
        isBuying={isBuying}
        buyMessage={buyMessage}
      />
    </main>
  );
}

