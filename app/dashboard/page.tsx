'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { UserMenu } from '../components/UserMenu';

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'tools' | 'dashboard'>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

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

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/');
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

          <div className="flex items-center">
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
            Tools
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && (
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

        {activeTab === 'tools' && (
          <div>
            <h1 className="text-2xl font-semibold text-slate-50 mb-4">Tools</h1>
            <p className="text-slate-400 mb-6">
              Select and launch the tools you need to manage your household.
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 hover:border-emerald-500/50 transition-colors cursor-pointer">
                <p className="text-2xl mb-2">🧰</p>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Maintenance Timeline</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Track filters, gutters, inspections, and more with reminders.
                </p>
                <button className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
                  Launch →
                </button>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 hover:border-emerald-500/50 transition-colors cursor-pointer">
                <p className="text-2xl mb-2">📂</p>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Document Vault</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Keep warranties, policies, and records organized and easy to find.
                </p>
                <button className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
                  Launch →
                </button>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 hover:border-emerald-500/50 transition-colors cursor-pointer">
                <p className="text-2xl mb-2">✅</p>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Checklists</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Coordinate move-in, hosting, packing, and seasonal checklists.
                </p>
                <button className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
                  Launch →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

