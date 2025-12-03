'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  active: string;
  user_status: string;
  created_at: string;
  updated_at: string | null;
};

type UserFormData = {
  email: string;
  firstName: string;
  lastName: string;
  active: string;
  userStatus: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [user, setUser] = useState<{ id?: string; userStatus?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    firstName: '',
    lastName: '',
    active: 'Y',
    userStatus: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; userId: string | null; userEmail: string }>({
    isOpen: false,
    userId: null,
    userEmail: '',
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check authentication and superadmin status
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser({ id: data.user.id, userStatus: data.user.userStatus });
          if (data.user.userStatus !== 'superadmin') {
            router.push('/dashboard');
            return;
          }
          // Load users
          loadUsers();
        } else {
          router.push('/');
        }
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(
        (u) =>
          u.email.toLowerCase().includes(query) ||
          u.first_name.toLowerCase().includes(query) ||
          (u.last_name && u.last_name.toLowerCase().includes(query))
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/users');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load users');
      }

      setUsers(data.users || []);
      setFilteredUsers(data.users || []);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
      setIsLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingId(user.id);
    setFormData({
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name || '',
      active: user.active,
      userStatus: user.user_status,
    });
    setError(null);
    setSuccess(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      active: 'Y',
      userStatus: '',
    });
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    if (!editingId) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingId,
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          active: formData.active,
          userStatus: formData.userStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      setSuccess('User updated successfully');
      setEditingId(null);
      
      // Reload users after a short delay to show success message
      setTimeout(() => {
        loadUsers();
        setSuccess(null);
      }, 1500);
    } catch (err) {
      console.error('Error updating user:', err);
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (userToDelete: User) => {
    setDeleteConfirm({
      isOpen: true,
      userId: userToDelete.id,
      userEmail: userToDelete.email,
    });
    setError(null);
    setSuccess(null);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({
      isOpen: false,
      userId: null,
      userEmail: '',
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.userId) return;

    setIsDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/users?id=${deleteConfirm.userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setSuccess('User and all related records deleted successfully');
      setDeleteConfirm({
        isOpen: false,
        userId: null,
        userEmail: '',
      });
      
      // Reload users after a short delay to show success message
      setTimeout(() => {
        loadUsers();
        setSuccess(null);
      }, 1500);
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-slate-400">Loading users...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Image
              src="/images/logo/Logo_Side_White.png"
              alt="Household Toolbox"
              width={200}
              height={40}
              className="h-auto"
              priority
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-300"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span>Back to Dashboard</span>
          </button>
        </div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">Users Management</h1>
            <p className="mt-1 text-sm text-slate-400">
              View and manage all users in the system
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by email, first name, or last name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2.5 pl-10 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
            <svg
              className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {success}
          </div>
        )}

        {/* Users Table */}
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">
                    First Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">
                    Last Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">
                    User Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-400">
                      {searchQuery ? 'No users found matching your search.' : 'No users found.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((tableUser) => (
                    <tr key={tableUser.id} className="hover:bg-slate-800/30">
                      {editingId === tableUser.id ? (
                        <>
                          <td className="px-6 py-4">
                            <input
                              type="email"
                              value={formData.email}
                              onChange={(e) =>
                                setFormData({ ...formData, email: e.target.value })
                              }
                              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={formData.firstName}
                              onChange={(e) =>
                                setFormData({ ...formData, firstName: e.target.value })
                              }
                              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={formData.lastName}
                              onChange={(e) =>
                                setFormData({ ...formData, lastName: e.target.value })
                              }
                              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={formData.active}
                              onChange={(e) =>
                                setFormData({ ...formData, active: e.target.value })
                              }
                              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none"
                            >
                              <option value="Y">Active</option>
                              <option value="N">Inactive</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={formData.userStatus}
                              onChange={(e) =>
                                setFormData({ ...formData, userStatus: e.target.value })
                              }
                              placeholder="user, admin, superadmin"
                              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none"
                            />
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-400">
                            {formatDate(tableUser.created_at)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="rounded bg-emerald-500 px-3 py-1 text-xs font-medium text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isSaving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={handleCancel}
                                disabled={isSaving}
                                className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  const userToDelete = users.find(u => u.id === editingId);
                                  if (userToDelete) {
                                    handleCancel();
                                    handleDeleteClick(userToDelete);
                                  }
                                }}
                                disabled={isSaving || user?.id === editingId}
                                className="rounded bg-red-500/20 px-3 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                                title={user?.id === editingId ? 'Cannot delete your own account' : 'Delete user'}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 text-sm text-slate-100">{tableUser.email}</td>
                          <td className="px-6 py-4 text-sm text-slate-100">
                            {tableUser.first_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-100">
                            {tableUser.last_name || '—'}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                tableUser.active === 'Y'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-red-500/20 text-red-300'
                              }`}
                            >
                              {tableUser.active === 'Y' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300">
                            {tableUser.user_status || 'user'}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-400">
                            {formatDate(tableUser.created_at)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(tableUser)}
                                className="rounded bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/30"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteClick(tableUser)}
                                disabled={user?.id === tableUser.id}
                                className="rounded bg-red-500/20 px-3 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                                title={user?.id === tableUser.id ? 'Cannot delete your own account' : 'Delete user'}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-4 text-sm text-slate-400">
          Showing {filteredUsers.length} of {users.length} users
          {searchQuery && ` matching "${searchQuery}"`}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-50 mb-2">Delete User</h2>
            <p className="text-sm text-slate-300 mb-4">
              Are you sure you want to delete <span className="font-semibold text-slate-100">{deleteConfirm.userEmail}</span>?
            </p>
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 mb-4">
              <p className="text-sm text-red-300 font-medium mb-1">⚠️ This action cannot be undone</p>
              <p className="text-xs text-red-300/80">
                This will permanently delete the user account and all related records including:
              </p>
              <ul className="text-xs text-red-300/80 mt-2 ml-4 list-disc">
                <li>User account</li>
                <li>All user tools and subscriptions</li>
                <li>Password reset tokens</li>
                <li>All associated data</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="rounded bg-red-500 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

