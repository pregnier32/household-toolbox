'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type PromoCode = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  expires_at: string;
  usage_count: number;
  max_uses: number | null;
  active: boolean;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type PromoCodeFormData = {
  code: string;
  discountType: string;
  discountValue: string;
  expiresAt: string;
  maxUses: string;
  description: string;
  active: boolean;
};

export default function PromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [user, setUser] = useState<{ userStatus?: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PromoCodeFormData>({
    code: '',
    discountType: 'percentage',
    discountValue: '',
    expiresAt: '',
    maxUses: '',
    description: '',
    active: true,
  });
  const router = useRouter();

  useEffect(() => {
    // Check authentication and superadmin status
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          if (data.user.userStatus !== 'superadmin') {
            router.push('/dashboard');
            return;
          }
          // Load promo codes
          loadPromoCodes();
        } else {
          router.push('/');
        }
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  const loadPromoCodes = async () => {
    try {
      const response = await fetch('/api/admin/promo-codes');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load promo codes');
      }

      setPromoCodes(data.promoCodes || []);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading promo codes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load promo codes');
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      code: '',
      discountType: 'percentage',
      discountValue: '',
      expiresAt: '',
      maxUses: '',
      description: '',
      active: true,
    });
    setError(null);
    setSuccess(null);
    setShowForm(true);
  };

  const handleEdit = (promoCode: PromoCode) => {
    setEditingId(promoCode.id);
    setFormData({
      code: promoCode.code,
      discountType: promoCode.discount_type,
      discountValue: promoCode.discount_value.toString(),
      expiresAt: promoCode.expires_at.split('T')[0], // Format date for input
      maxUses: promoCode.max_uses ? promoCode.max_uses.toString() : '',
      description: promoCode.description || '',
      active: promoCode.active,
    });
    setError(null);
    setSuccess(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promo code? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/promo-codes?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete promo code');
      }

      setSuccess('Promo code deleted successfully');
      loadPromoCodes();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete promo code');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const url = '/api/admin/promo-codes';
      const method = editingId ? 'PUT' : 'POST';
      const body = {
        ...(editingId && { id: editingId }),
        ...formData,
        // Convert empty string to null for maxUses (optional field)
        maxUses: formData.maxUses.trim() === '' ? null : formData.maxUses,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save promo code');
      }

      setSuccess(editingId ? 'Promo code updated successfully!' : 'Promo code created successfully!');
      setShowForm(false);
      loadPromoCodes();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save promo code');
    } finally {
      setIsSaving(false);
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const formatDiscount = (type: string, value: number) => {
    if (type === 'percentage') {
      return `${value}%`;
    }
    return `$${value.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-slate-400 hover:text-slate-300 transition-colors"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
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
            <h1 className="text-2xl font-semibold text-slate-50 mb-2">
              Promo Codes Management
            </h1>
            <p className="text-slate-400 text-sm">
              Create and manage promotional codes for customer discounts.
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 text-sm font-semibold text-slate-950 bg-emerald-500 rounded-lg hover:bg-emerald-400 transition-colors"
          >
            + Create Promo Code
          </button>
        </div>

        {/* Only show messages on main page when modal is closed */}
        {!showForm && error && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {!showForm && success && (
          <div className="mb-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {success}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-lg border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-slate-50">
                    {editingId ? 'Edit Promo Code' : 'Create Promo Code'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-slate-400 hover:text-slate-300"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Code <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      placeholder="SUMMER2024"
                      required
                      disabled={!!editingId}
                    />
                    {editingId && (
                      <p className="mt-1 text-xs text-slate-500">Code cannot be changed after creation</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        Discount Type <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={formData.discountType}
                        onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        required
                      >
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed Amount</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        Discount Value <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={formData.discountType === 'percentage' ? '100' : undefined}
                        value={formData.discountValue}
                        onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        placeholder={formData.discountType === 'percentage' ? '10' : '25.00'}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Expiration Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Max Uses (optional)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.maxUses}
                      onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      placeholder="Leave empty for unlimited"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Description (optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      placeholder="Summer promotion 2024"
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="active"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-900/70 text-emerald-500 focus:ring-emerald-500/50"
                    />
                    <label htmlFor="active" className="text-sm text-slate-300">
                      Active
                    </label>
                  </div>

                  {/* Error and Success Messages - Inside Modal */}
                  {error && (
                    <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                      {success}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-2 text-sm font-semibold text-slate-950 bg-emerald-500 rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Promo Codes List */}
        {promoCodes.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
            <p className="text-slate-400">No promo codes found. Create your first one!</p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Discount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Usage
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {promoCodes.map((promoCode) => (
                    <tr key={promoCode.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-slate-100">{promoCode.code}</div>
                        {promoCode.description && (
                          <div className="text-xs text-slate-500 mt-0.5">{promoCode.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {formatDiscount(promoCode.discount_type, promoCode.discount_value)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        <div>{new Date(promoCode.expires_at).toLocaleDateString()}</div>
                        {isExpired(promoCode.expires_at) && (
                          <div className="text-xs text-red-400 mt-0.5">Expired</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {promoCode.usage_count}
                        {promoCode.max_uses && ` / ${promoCode.max_uses}`}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            !promoCode.active
                              ? 'bg-red-500/20 text-red-300'
                              : isExpired(promoCode.expires_at)
                              ? 'bg-yellow-500/20 text-yellow-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {!promoCode.active
                            ? 'Inactive'
                            : isExpired(promoCode.expires_at)
                            ? 'Expired'
                            : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(promoCode)}
                            className="text-emerald-400 hover:text-emerald-300 transition-colors"
                            title="Edit"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(promoCode.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Delete"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

