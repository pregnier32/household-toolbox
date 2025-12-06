'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { IconPicker } from '../../../components/IconPicker';
import { DynamicIcon } from '../../../components/DynamicIcon';

type ToolIcon = {
  id: string;
  icon_url: string | null;
  has_icon_data: boolean;
};

type Tool = {
  id: string;
  name: string;
  short_name: string | null;
  tool_tip: string | null;
  description: string | null;
  price: number;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  icons: {
    default?: ToolIcon;
    coming_soon?: ToolIcon;
    available?: ToolIcon;
  };
};

type ToolFormData = {
  name: string;
  short_name: string;
  description: string;
  price: string;
  status: string;
};


export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [user, setUser] = useState<{ userStatus?: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ToolFormData>({
    name: '',
    short_name: '',
    description: '',
    price: '0.00',
    status: 'coming_soon',
  });
  const [iconSelection, setIconSelection] = useState<string>('');
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
          // Load tools
          loadTools();
        } else {
          router.push('/');
        }
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  const loadTools = async () => {
    try {
      const response = await fetch('/api/admin/tools');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load tools');
      }

      setTools(data.tools || []);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading tools:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tools');
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormStep(1);
    setFormData({
      name: '',
      short_name: '',
      description: '',
      price: '0.00',
      status: 'coming_soon',
    });
    setIconSelection('');
    setError(null);
    setSuccess(null);
    setShowForm(true);
  };

  const handleEdit = (tool: Tool) => {
    setEditingId(tool.id);
    setFormStep(1);
    setFormData({
      name: tool.name,
      short_name: tool.short_name || '',
      description: tool.description || '',
      price: tool.price.toString(),
      status: tool.status,
    });
    // Pre-select the existing icon if available
    const existingIcon = tool.icons.default || tool.icons.available || tool.icons.coming_soon;
    const iconName = existingIcon?.icon_url && !existingIcon.icon_url.startsWith('http') && !existingIcon.icon_url.startsWith('/')
      ? existingIcon.icon_url
      : '';
    setIconSelection(iconName);
    setError(null);
    setSuccess(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tool? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/tools?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete tool');
      }

      setSuccess('Tool deleted successfully');
      loadTools();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tool');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleIconChange = (iconName: string) => {
    setIconSelection(iconName);
    setError(null);
  };

  const handleNext = () => {
    // Validate step 1 fields
    if (!formData.name.trim() || !formData.description.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    
    // Validate short_name if provided (max 6 characters)
    if (formData.short_name && formData.short_name.length > 6) {
      setError('Short name must be 6 characters or less');
      return;
    }
    
    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Price must be a valid non-negative number');
      return;
    }

    setError(null);
    setFormStep(2);
  };

  const handleBack = () => {
    setFormStep(1);
    setError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // First, create or update the tool
      const toolFormData = new FormData();
      
      if (editingId) {
        toolFormData.append('id', editingId);
      }
      
      toolFormData.append('name', formData.name.trim());
      // Always append short_name, even if empty, so the API can clear it when editing
      toolFormData.append('short_name', formData.short_name.trim());
      toolFormData.append('description', formData.description.trim());
      toolFormData.append('price', formData.price);
      toolFormData.append('status', formData.status);

      const url = '/api/admin/tools';
      const method = editingId ? 'PUT' : 'POST';

      // Save tool first (without icons if creating)
      const toolResponse = await fetch(url, {
        method,
        body: toolFormData,
      });

      const toolData = await toolResponse.json();

      if (!toolResponse.ok) {
        throw new Error(toolData.error || 'Failed to save tool');
      }

      // Get the tool ID (either from editing or from the created tool)
      const toolId = editingId || toolData.tool?.id;
      
      if (!toolId) {
        throw new Error('Failed to get tool ID');
      }

      // Now save icon (single icon for the tool)
      if (iconSelection) {
        const iconFormData = new FormData();
        iconFormData.append('tool_id', toolId);
        iconFormData.append('icon_name', iconSelection);
        iconFormData.append('icon_type', 'default'); // Use 'default' as the icon type

        const iconResponse = await fetch('/api/admin/tools/icons', {
          method: 'POST',
          body: iconFormData,
        });

        const iconData = await iconResponse.json();
        if (!iconResponse.ok) {
          throw new Error(iconData.error || 'Failed to save icon');
        }
      }

      setSuccess(editingId ? 'Tool updated successfully!' : 'Tool created successfully!');
      setShowForm(false);
      setFormStep(1);
      loadTools();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tool');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/20 text-emerald-300';
      case 'available':
        return 'bg-blue-500/20 text-blue-300';
      case 'coming_soon':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'inactive':
        return 'bg-red-500/20 text-red-300';
      default:
        return 'bg-slate-500/20 text-slate-300';
    }
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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
              Tools Management
            </h1>
            <p className="text-slate-400 text-sm">
              Create and manage tools that users can access. Select icons from the Lucide icon library for each status.
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 text-sm font-semibold text-slate-950 bg-emerald-500 rounded-lg hover:bg-emerald-400 transition-colors"
          >
            + Create Tool
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
                    {editingId ? 'Edit Tool' : 'Create Tool'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setFormStep(1);
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

                {/* Step Indicator */}
                <div className="mb-6 flex items-center gap-2">
                  <div className={`flex items-center ${formStep === 1 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${formStep === 1 ? 'bg-emerald-500/20 border-2 border-emerald-500' : 'bg-slate-800 border-2 border-slate-600'}`}>
                      {formStep > 1 ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-sm font-medium">1</span>
                      )}
                    </div>
                    <span className="ml-2 text-sm font-medium">Basic Info</span>
                  </div>
                  <div className="flex-1 h-0.5 bg-slate-700"></div>
                  <div className={`flex items-center ${formStep === 2 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${formStep === 2 ? 'bg-emerald-500/20 border-2 border-emerald-500' : 'bg-slate-800 border-2 border-slate-600'}`}>
                      <span className="text-sm font-medium">2</span>
                    </div>
                    <span className="ml-2 text-sm font-medium">Icons</span>
                  </div>
                </div>

                {/* Step 1: Basic Info */}
                {formStep === 1 && (
                  <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      placeholder="Maintenance Calendar"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Short Name <span className="text-xs text-slate-500">(Internal use, max 6 characters)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.short_name}
                      onChange={(e) => {
                        const value = e.target.value.slice(0, 6); // Limit to 6 characters
                        setFormData({ ...formData, short_name: value });
                      }}
                      maxLength={6}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      placeholder="e.g., MAINT"
                    />
                    {formData.short_name.length > 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        {formData.short_name.length}/6 characters
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Description <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      placeholder="Detailed description of the tool"
                      rows={3}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Price <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Status <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => {
                        // Prevent setting new tools to active
                        if (e.target.value === 'active' && !editingId) {
                          setError('Cannot set status to active. Active status is set when users purchase tools.');
                          return;
                        }
                        setFormData({ ...formData, status: e.target.value });
                        setError(null);
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      required
                    >
                      <option value="coming_soon">Coming Soon</option>
                      <option value="available">Available</option>
                      <option value="custom">Custom</option>
                      {formData.status === 'active' && (
                        <option value="active">Active</option>
                      )}
                      <option value="inactive">Inactive</option>
                    </select>
                    {formData.status === 'active' ? (
                      <p className="mt-1 text-xs text-emerald-400">
                        This tool is active. You can change it to Available or Coming Soon.
                      </p>
                    ) : formData.status === 'custom' ? (
                      <p className="mt-1 text-xs text-emerald-400">
                        Custom tools are only visible to users who have been assigned this tool. Create a users_tools record to grant access.
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">
                        Note: Tools become "Active" when users purchase them. Use the "Available" icon for purchased tools.
                      </p>
                    )}
                  </div>

                  {/* Error and Success Messages - Inside Modal */}
                  {error && (
                    <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setFormStep(1);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-semibold text-slate-950 bg-emerald-500 rounded-lg hover:bg-emerald-400 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </form>
                )}

                {/* Step 2: Icon Selection */}
                {formStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-50 mb-2">Select Icon</h3>
                      <p className="text-sm text-slate-400">
                        Choose an icon from the Lucide icon library. Each icon can only be used by one tool.
                      </p>
                    </div>

                    {/* Icon Picker */}
                    <IconPicker
                      value={iconSelection}
                      onChange={handleIconChange}
                      label="Tool Icon"
                    />
                    
                    {/* Show existing icon when editing if no new selection */}
                    {editingId && !iconSelection && (() => {
                      const tool = tools.find((t) => t.id === editingId);
                      // Get the first available icon (could be coming_soon, available, or default)
                      const existingIcon = tool?.icons.coming_soon || tool?.icons.available || tool?.icons.default;
                      
                      if (existingIcon) {
                        const iconUrl = existingIcon.icon_url;
                        return (
                          <div className="mt-2">
                            <p className="text-xs text-slate-400 mb-2">Current icon:</p>
                            <div className="inline-block border border-slate-700 rounded-lg p-2 bg-slate-800/50">
                              {iconUrl && !iconUrl.startsWith('http') && !iconUrl.startsWith('/') ? (
                                <DynamicIcon iconName={iconUrl} size={32} className="text-slate-300" />
                              ) : (
                                <p className="text-xs text-slate-500">Icon exists (select new icon to replace)</p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Error and Success Messages */}
                    {error && (
                      <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {error}
                      </div>
                    )}

                    <div className="flex justify-between gap-3 pt-4 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={handleBack}
                        className="px-4 py-2 text-sm font-medium text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-semibold text-slate-950 bg-emerald-500 rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? 'Saving...' : editingId ? 'Update Tool' : 'Create Tool'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tools List */}
        {tools.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
            <p className="text-slate-400">No tools found. Create your first one!</p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Short Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Icons
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {tools.map((tool) => (
                    <tr key={tool.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-slate-100">{tool.name}</div>
                        {tool.tool_tip && (
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{tool.tool_tip}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {tool.short_name || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        ${tool.price.toFixed(2)} / month
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(tool.status)}`}
                        >
                          {formatStatus(tool.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {(() => {
                          const icon = tool.icons.default || tool.icons.available || tool.icons.coming_soon;
                          const iconName = icon?.icon_url && !icon.icon_url.startsWith('http') && !icon.icon_url.startsWith('/') 
                            ? icon.icon_url 
                            : null;
                          return iconName ? (
                            <div className="flex items-center gap-2">
                              <DynamicIcon iconName={iconName} size={20} className="text-slate-300" />
                              <span className="text-xs text-slate-400">{iconName}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">No icon</span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(tool)}
                            className="text-emerald-400 hover:text-emerald-300 transition-colors"
                            title="Edit"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(tool.id)}
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

