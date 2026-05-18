'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from './AppThemeProvider';

const DEFAULT_TAGS = ['Birthday', 'Graduation', 'Christmas'];

type AddressTag = {
  id: string;
  name: string;
  isActive: boolean;
  dateAdded: string;
  dateInactivated?: string;
};

export type AddressRecord = {
  id: string;
  mailingName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  tags: string[];
  isActive: boolean;
  dateAdded: string;
  dateInactivated?: string;
};

type AddressFormState = {
  mailingName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  selectedTags: string[];
};

function emptyAddressForm(): AddressFormState {
  return {
    mailingName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    streetAddress: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    selectedTags: [],
  };
}

function formatDisplayDate(isoDate: string | undefined): string {
  if (!isoDate) return 'N/A';
  const parts = isoDate.split('T')[0].split('-');
  if (parts.length !== 3) {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  }
  const [year, month, day] = parts;
  return `${Number(month)}/${Number(day)}/${year}`;
}

function transformAddressFromDb(row: Record<string, unknown>): AddressRecord {
  return {
    id: row.id as string,
    mailingName: (row.mailing_name as string) ?? '',
    firstName: (row.first_name as string) ?? '',
    lastName: (row.last_name as string) ?? '',
    email: (row.email as string) ?? '',
    phone: (row.phone as string) ?? '',
    streetAddress: (row.street_address as string) ?? '',
    city: (row.city as string) ?? '',
    state: (row.state as string) ?? '',
    zip: (row.zip as string) ?? '',
    country: (row.country as string) ?? '',
    tags: (row.tags as string[]) || [],
    isActive: row.is_active !== false,
    dateAdded: (row.date_added as string) ?? '',
    dateInactivated: (row.date_inactivated as string) || undefined,
  };
}

function transformTagFromDb(row: Record<string, unknown>): AddressTag {
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    isActive: row.is_active !== false,
    dateAdded: (row.date_added as string) ?? '',
    dateInactivated: (row.date_inactivated as string) || undefined,
  };
}

function formToApiPayload(form: AddressFormState) {
  return {
    mailingName: form.mailingName.trim(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    streetAddress: form.streetAddress.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    zip: form.zip.trim(),
    country: form.country.trim(),
    selectedTags: form.selectedTags,
  };
}

function formatAddressLine(record: AddressRecord): string {
  const parts = [
    record.streetAddress,
    [record.city, record.state].filter(Boolean).join(', '),
    record.zip,
    record.country,
  ].filter(Boolean);
  return parts.join(' · ') || 'No address on file';
}

type AddressBookToolProps = {
  toolId?: string;
};

export function AddressBookTool({ toolId }: AddressBookToolProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const titleClass = isLight ? 'text-2xl font-semibold text-slate-900 mb-2' : 'text-2xl font-semibold text-slate-50 mb-2';
  const descClass = isLight ? 'text-slate-600 text-sm' : 'text-slate-400 text-sm';
  const loadingClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400';
  const cardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-6';
  const nestedCardClass = isLight
    ? 'p-3 rounded-lg border border-slate-200 bg-slate-50'
    : 'p-3 rounded-lg border border-slate-700 bg-slate-800/50';
  const sectionTitleClass = isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50';
  const counterTextClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400';
  const labelClass = isLight ? 'block text-sm font-medium text-slate-700 mb-2' : 'block text-sm font-medium text-slate-300 mb-2';
  const inputClass = isLight
    ? 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const selectClass = isLight
    ? 'w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const primaryButtonClass = isLight
    ? 'px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
    : 'px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
  const secondaryButtonClass = isLight
    ? 'px-4 py-2 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors'
    : 'px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors';
  const tabStripClass = isLight ? 'border-b border-slate-200' : 'border-b border-slate-800';
  const tabActiveClass = isLight
    ? 'border-b-2 border-emerald-600 text-emerald-900 font-semibold'
    : 'border-b-2 border-emerald-500 text-emerald-300';
  const tabInactiveClass = isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-300';
  const modalCardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-xl'
    : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4';
  const modalCardLgClass = isLight
    ? 'bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-xl'
    : 'bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto';
  const rowIconEmeraldClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-700 bg-white p-2 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 p-2 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20';
  const rowIconSecondaryClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-slate-400 bg-slate-100 p-2 text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-slate-600 bg-slate-800 p-2 text-slate-200 transition-colors hover:bg-slate-700';
  const rowIconDangerClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-red-300 bg-white p-2 text-red-700 transition-colors hover:bg-red-50 hover:border-red-400'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-800/50 p-2 text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20';
  const tagChipActiveClass = isLight
    ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-emerald-300 bg-emerald-50 text-emerald-800'
    : 'px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300';
  const tagChipHistoryClass = isLight
    ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-slate-300 bg-slate-100 text-slate-700'
    : 'px-1.5 py-0.5 rounded text-xs font-medium bg-slate-600/50 text-slate-400';
  const usageBadgeClass = isLight
    ? 'px-2 py-1 rounded text-xs font-medium border border-slate-300 bg-white text-slate-800'
    : 'px-2 py-1 rounded text-xs font-medium bg-slate-700 text-slate-300';
  const viewLabelClass = isLight ? 'text-sm font-medium text-slate-600' : 'text-sm font-medium text-slate-300';
  const viewValueClass = isLight ? 'text-slate-900 text-base ml-2' : 'text-slate-100 text-base ml-2';
  const tagPickerClass = isLight
    ? 'flex flex-wrap gap-2 p-4 rounded-lg border border-slate-300 bg-slate-50 min-h-[60px]'
    : 'flex flex-wrap gap-2 p-4 rounded-lg border border-slate-700 bg-slate-900/70 min-h-[60px]';
  const tagPickerButtonSelected = isLight ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-slate-950';
  const tagPickerButtonUnselected = isLight
    ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
    : 'bg-slate-700 text-slate-300 hover:bg-slate-600';

  const [addresses, setAddresses] = useState<AddressRecord[]>([]);
  const [tags, setTags] = useState<AddressTag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'addresses' | 'tags'>('addresses');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');

  const [isAdding, setIsAdding] = useState(false);
  const [newAddress, setNewAddress] = useState<AddressFormState>(emptyAddressForm);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState<AddressFormState>(emptyAddressForm);

  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');

  const [showHistory, setShowHistory] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteTagConfirmId, setDeleteTagConfirmId] = useState<string | null>(null);
  const [deleteTagConfirmText, setDeleteTagConfirmText] = useState('');
  const [viewAddressModal, setViewAddressModal] = useState<AddressRecord | null>(null);

  const getTagName = useCallback(
    (tagId: string) => tags.find((t) => t.id === tagId)?.name ?? 'Unknown',
    [tags]
  );

  const getTagUsageCount = useCallback(
    (tagId: string) => addresses.filter((a) => a.tags.includes(tagId)).length,
    [addresses]
  );

  const filteredAddresses = addresses.filter((address) => {
    const q = searchQuery.toLowerCase().trim();
    const searchable = [
      address.mailingName,
      address.firstName,
      address.lastName,
      address.email,
      address.phone,
      address.streetAddress,
      address.city,
      address.state,
      address.zip,
      address.country,
    ]
      .join(' ')
      .toLowerCase();

    const matchesSearch = q === '' || searchable.indexOf(q) !== -1;
    const matchesTag =
      selectedTagFilter === 'all' || address.tags.includes(selectedTagFilter);

    return matchesSearch && matchesTag;
  });

  const activeAddresses = filteredAddresses
    .filter((a) => a.isActive)
    .sort((a, b) => a.mailingName.localeCompare(b.mailingName));
  const inactiveAddresses = filteredAddresses.filter((a) => !a.isActive);
  const activeTags = tags.filter((t) => t.isActive).sort((a, b) => a.name.localeCompare(b.name));
  const inactiveTags = tags.filter((t) => !t.isActive).sort((a, b) => a.name.localeCompare(b.name));

  const toggleTagSelection = (tagId: string, isEdit: boolean) => {
    if (isEdit) {
      setEditingAddress((prev) => {
        const isSelected = prev.selectedTags.includes(tagId);
        return {
          ...prev,
          selectedTags: isSelected
            ? prev.selectedTags.filter((id) => id !== tagId)
            : [...prev.selectedTags, tagId],
        };
      });
    } else {
      setNewAddress((prev) => {
        const isSelected = prev.selectedTags.includes(tagId);
        return {
          ...prev,
          selectedTags: isSelected
            ? prev.selectedTags.filter((id) => id !== tagId)
            : [...prev.selectedTags, tagId],
        };
      });
    }
  };

  const recordToForm = (record: AddressRecord): AddressFormState => ({
    mailingName: record.mailingName,
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
    phone: record.phone,
    streetAddress: record.streetAddress,
    city: record.city,
    state: record.state,
    zip: record.zip,
    country: record.country,
    selectedTags: [...record.tags],
  });

  const validateForm = (form: AddressFormState): boolean => {
    if (!form.mailingName.trim()) {
      alert('Please enter a mailing name.');
      return false;
    }
    if (form.selectedTags.length === 0) {
      alert('Please select at least one tag.');
      return false;
    }
    return true;
  };

  const reloadAddresses = useCallback(async () => {
    if (!toolId) return;
    const response = await fetch(`/api/tools/address-book?toolId=${toolId}`);
    if (!response.ok) return;
    const data = await response.json();
    setAddresses((data.addresses || []).map((row: Record<string, unknown>) => transformAddressFromDb(row)));
  }, [toolId]);

  const reloadTags = useCallback(async () => {
    if (!toolId) return;
    const response = await fetch(`/api/tools/address-book/tags?toolId=${toolId}`);
    if (!response.ok) return;
    const data = await response.json();
    setTags((data.tags || []).map((row: Record<string, unknown>) => transformTagFromDb(row)));
  }, [toolId]);

  const seedDefaultTagsIfNeeded = useCallback(async () => {
    if (!toolId) return;
    await Promise.all(
      DEFAULT_TAGS.map((tagName) =>
        fetch('/api/tools/address-book/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toolId, name: tagName }),
        })
      )
    );
    await reloadTags();
  }, [toolId, reloadTags]);

  useEffect(() => {
    const loadData = async () => {
      if (!toolId) return;

      setIsLoading(true);
      try {
        const response = await fetch(`/api/tools/address-book?toolId=${toolId}`);
        if (response.ok) {
          const data = await response.json();
          setAddresses((data.addresses || []).map((row: Record<string, unknown>) => transformAddressFromDb(row)));

          const transformedTags: AddressTag[] = (data.tags || []).map((row: Record<string, unknown>) =>
            transformTagFromDb(row)
          );

          if (transformedTags.length === 0) {
            await seedDefaultTagsIfNeeded();
          } else {
            setTags(transformedTags);
          }
        } else {
          setAddresses([]);
          setTags([]);
        }
      } catch {
        setAddresses([]);
        setTags([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [toolId, seedDefaultTagsIfNeeded]);

  const addAddress = async () => {
    if (!validateForm(newAddress) || !toolId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/address-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          action: 'create',
          ...formToApiPayload(newAddress),
        }),
      });

      if (response.ok) {
        await reloadAddresses();
        setNewAddress(emptyAddressForm());
        setIsAdding(false);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(errorData.error || 'Failed to add address.');
      }
    } catch {
      alert('Error adding address. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (record: AddressRecord) => {
    setEditingId(record.id);
    setEditingAddress(recordToForm(record));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingAddress(emptyAddressForm());
  };

  const saveEdit = async () => {
    if (!editingId || !validateForm(editingAddress) || !toolId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/address-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          addressId: editingId,
          action: 'update',
          ...formToApiPayload(editingAddress),
        }),
      });

      if (response.ok) {
        await reloadAddresses();
        cancelEditing();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(errorData.error || 'Failed to update address.');
      }
    } catch {
      alert('Error updating address. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inactivateAddress = async (id: string) => {
    if (!toolId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/address-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, addressId: id, action: 'inactivate' }),
      });

      if (response.ok) {
        await reloadAddresses();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(errorData.error || 'Failed to move address to history.');
      }
    } catch {
      alert('Error inactivating address. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const activateAddress = async (id: string) => {
    if (!toolId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/address-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, addressId: id, action: 'activate' }),
      });

      if (response.ok) {
        await reloadAddresses();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(errorData.error || 'Failed to restore address.');
      }
    } catch {
      alert('Error activating address. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAddress = async () => {
    if (!deleteConfirmId || deleteConfirmText.toLowerCase() !== 'delete' || !toolId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/tools/address-book?addressId=${deleteConfirmId}&toolId=${toolId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        await reloadAddresses();
        setDeleteConfirmId(null);
        setDeleteConfirmText('');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(errorData.error || 'Failed to delete address.');
      }
    } catch {
      alert('Error deleting address. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const addTag = async () => {
    if (!newTagName.trim() || !toolId) return;

    const trimmedName = newTagName.trim();
    if (tags.some((t) => t.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert('A tag with this name already exists.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/address-book/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, name: trimmedName }),
      });

      if (response.ok) {
        await reloadTags();
        setNewTagName('');
        setIsAddingTag(false);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(errorData.error || 'Failed to add tag.');
      }
    } catch {
      alert('Error adding tag. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditingTag = (tag: AddressTag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
  };

  const cancelEditingTag = () => {
    setEditingTagId(null);
    setEditingTagName('');
  };

  const saveTagEdit = async () => {
    if (!editingTagId || !editingTagName.trim() || !toolId) return;

    const trimmedName = editingTagName.trim();
    if (
      tags.some(
        (t) => t.id !== editingTagId && t.name.toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      alert('A tag with this name already exists.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/address-book/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId: editingTagId, toolId, name: trimmedName }),
      });

      if (response.ok) {
        await reloadTags();
        cancelEditingTag();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(errorData.error || 'Failed to update tag.');
      }
    } catch {
      alert('Error updating tag. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inactivateTag = async (id: string) => {
    if (!toolId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/address-book/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId: id, toolId, action: 'inactivate' }),
      });

      if (response.ok) {
        await reloadTags();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(errorData.error || 'Failed to inactivate tag.');
      }
    } catch {
      alert('Error inactivating tag. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const activateTag = async (id: string) => {
    if (!toolId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/address-book/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId: id, toolId, action: 'activate' }),
      });

      if (response.ok) {
        await reloadTags();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(errorData.error || 'Failed to activate tag.');
      }
    } catch {
      alert('Error activating tag. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTag = async () => {
    if (!deleteTagConfirmId || deleteTagConfirmText.toLowerCase() !== 'delete' || !toolId) return;

    if (getTagUsageCount(deleteTagConfirmId) > 0) {
      alert('This tag is still in use and cannot be deleted.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/tools/address-book/tags?tagId=${deleteTagConfirmId}&toolId=${toolId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        await reloadTags();
        setDeleteTagConfirmId(null);
        setDeleteTagConfirmText('');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(errorData.error || 'Failed to delete tag.');
      }
    } catch {
      alert('Error deleting tag. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteConfirmId) {
        setDeleteConfirmId(null);
        setDeleteConfirmText('');
      }
      if (deleteTagConfirmId) {
        setDeleteTagConfirmId(null);
        setDeleteTagConfirmText('');
      }
      if (viewAddressModal) setViewAddressModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteConfirmId, deleteTagConfirmId, viewAddressModal]);

  const renderAddressFields = (
    form: AddressFormState,
    setForm: React.Dispatch<React.SetStateAction<AddressFormState>>,
    isEdit: boolean
  ) => (
  <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            Mailing Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.mailingName}
            onChange={(e) => setForm({ ...form, mailingName: e.target.value })}
            placeholder="e.g., Smith Family"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>First Name</label>
          <input
            type="text"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Last Name</label>
          <input
            type="text"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Street Address</label>
          <textarea
            value={form.streetAddress}
            onChange={(e) => setForm({ ...form, streetAddress: e.target.value })}
            placeholder="Street address, apartment, suite, etc."
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>
        <div>
          <label className={labelClass}>City</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>State</label>
          <input
            type="text"
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Zip</label>
          <input
            type="text"
            value={form.zip}
            onChange={(e) => setForm({ ...form, zip: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Country</label>
          <input
            type="text"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>
          Tags <span className="text-red-400">*</span> (Select one or more)
        </label>
        <div className={tagPickerClass}>
          {activeTags.length > 0 ? (
            activeTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTagSelection(tag.id, isEdit)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  form.selectedTags.includes(tag.id)
                    ? tagPickerButtonSelected
                    : tagPickerButtonUnselected
                }`}
              >
                {tag.name}
              </button>
            ))
          ) : (
            <p className={descClass}>No active tags available. Add tags in the Tags tab.</p>
          )}
        </div>
        {form.selectedTags.length > 0 && (
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Selected: {form.selectedTags.map((id) => getTagName(id)).join(', ')}
          </p>
        )}
      </div>
    </div>
  );

  const renderAddressRow = (record: AddressRecord, inHistory: boolean) => {
    const chipClass = inHistory ? tagChipHistoryClass : tagChipActiveClass;
    const nameClass = inHistory
      ? isLight
        ? 'text-base font-semibold text-slate-600'
        : 'text-base font-semibold text-slate-300'
      : isLight
        ? 'text-base font-semibold text-slate-900'
        : 'text-base font-semibold text-slate-100';
    const metaClass = inHistory
      ? isLight
        ? 'text-xs text-slate-500'
        : 'text-xs text-slate-400'
      : isLight
        ? 'text-xs text-slate-600'
        : 'text-xs text-slate-300';

    if (editingId === record.id) {
      return (
        <div key={record.id} className={nestedCardClass}>
          <div className="space-y-4">
            {renderAddressFields(editingAddress, setEditingAddress, true)}
            <div className="flex gap-2">
              <button
                onClick={saveEdit}
                disabled={
                  !editingAddress.mailingName.trim() ||
                  editingAddress.selectedTags.length === 0
                }
                className={primaryButtonClass}
              >
                Save
              </button>
              <button onClick={cancelEditing} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={record.id}
        className={`${nestedCardClass}${inHistory ? ' opacity-75' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h4 className={nameClass}>{record.mailingName}</h4>
              <div className="flex flex-wrap gap-1.5">
                {record.tags.map((tagId) => {
                  const tag = tags.find((t) => t.id === tagId);
                  return tag ? (
                    <span key={tagId} className={chipClass}>
                      {tag.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
            {(record.firstName || record.lastName) && (
              <p className={metaClass}>
                {[record.firstName, record.lastName].filter(Boolean).join(' ')}
              </p>
            )}
            <p className={`${metaClass} mt-1`}>{formatAddressLine(record)}</p>
            {(record.email || record.phone) && (
              <p className={`${metaClass} mt-1`}>
                {[record.email, record.phone].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className={`${metaClass} mt-1`}>
              <span className={isLight ? 'text-slate-500' : 'text-slate-500'}>Added:</span>{' '}
              {formatDisplayDate(record.dateAdded.split('T')[0])}
              {inHistory && record.dateInactivated && (
                <>
                  {' '}
                  · <span className={isLight ? 'text-slate-500' : 'text-slate-500'}>Inactivated:</span>{' '}
                  {formatDisplayDate(record.dateInactivated.split('T')[0])}
                </>
              )}
            </p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setViewAddressModal(record)}
              className={rowIconSecondaryClass}
              title="View address"
              aria-label="View address"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            {!inHistory && (
              <button
                type="button"
                onClick={() => startEditing(record)}
                className={rowIconEmeraldClass}
                title="Edit address"
                aria-label="Edit address"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {inHistory ? (
              <>
                <button
                  type="button"
                  onClick={() => activateAddress(record.id)}
                  className={rowIconEmeraldClass}
                  title="Restore address"
                  aria-label="Restore address"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(record.id)}
                  className={rowIconDangerClass}
                  title="Delete address"
                  aria-label="Delete address"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => inactivateAddress(record.id)}
                className={rowIconSecondaryClass}
                title="Move to history"
                aria-label="Move to history"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={titleClass}>Address Book</h2>
          <p className={descClass}>Store, tag, and manage mailing addresses for your household.</p>
        </div>
        {isLoading && <div className={loadingClass}>Loading...</div>}
      </div>

      <div className={tabStripClass}>
        <div className="flex gap-2">
          {[
            { id: 'addresses' as const, label: 'Addresses' },
            { id: 'tags' as const, label: 'Tags' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id ? tabActiveClass : tabInactiveClass
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'addresses' && (
        <div className="space-y-6">
          <div className={cardClass}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Search Addresses</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, phone, or address..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Filter by Tag</label>
                <select
                  value={selectedTagFilter}
                  onChange={(e) => setSelectedTagFilter(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All Tags</option>
                  {activeTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!isAdding ? (
            <div className="flex justify-start">
              <button type="button" onClick={() => setIsAdding(true)} className={primaryButtonClass}>
                + Add New Address
              </button>
            </div>
          ) : (
            <div className={cardClass}>
              <h3 className={`${sectionTitleClass} mb-4`}>Add New Address</h3>
              {renderAddressFields(newAddress, setNewAddress, false)}
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={addAddress}
                  disabled={
                    !newAddress.mailingName.trim() || newAddress.selectedTags.length === 0
                  }
                  className={primaryButtonClass}
                >
                  Add Address
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setNewAddress(emptyAddressForm());
                  }}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>Active Addresses</h3>
              <span className={counterTextClass}>
                {activeAddresses.length}{' '}
                {activeAddresses.length === 1 ? 'address' : 'addresses'}
              </span>
            </div>
            {activeAddresses.length > 0 ? (
              <div className="space-y-4">
                {activeAddresses.map((record) => renderAddressRow(record, false))}
              </div>
            ) : (
              <p className={`${descClass} text-center py-8`}>
                No active addresses. Add one to get started!
              </p>
            )}
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>History</h3>
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className={
                  isLight
                    ? 'text-sm text-slate-600 hover:text-slate-900 transition-colors'
                    : 'text-sm text-slate-400 hover:text-slate-300 transition-colors'
                }
              >
                {showHistory ? 'Hide' : 'Show'} ({inactiveAddresses.length})
              </button>
            </div>
            {showHistory &&
              (inactiveAddresses.length > 0 ? (
                <div className="space-y-4">
                  {inactiveAddresses.map((record) => renderAddressRow(record, true))}
                </div>
              ) : (
                <p className={`${descClass} text-center py-8`}>No inactive addresses in history.</p>
              ))}
          </div>
        </div>
      )}

      {activeTab === 'tags' && (
        <div className="space-y-6">
          {!isAddingTag ? (
            <div className="flex justify-start">
              <button type="button" onClick={() => setIsAddingTag(true)} className={primaryButtonClass}>
                + Add New Tag
              </button>
            </div>
          ) : (
            <div className={cardClass}>
              <h3 className={`${sectionTitleClass} mb-4`}>Add New Tag</h3>
              <div className="flex gap-4 flex-wrap">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Enter tag name"
                  className={`flex-1 min-w-[200px] ${inputClass}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addTag();
                  }}
                />
                <button
                  type="button"
                  onClick={addTag}
                  disabled={!newTagName.trim()}
                  className={primaryButtonClass}
                >
                  Add Tag
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingTag(false);
                    setNewTagName('');
                  }}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>Active Tags</h3>
              <span className={counterTextClass}>
                {activeTags.length} {activeTags.length === 1 ? 'tag' : 'tags'}
              </span>
            </div>
            {activeTags.length > 0 ? (
              <div className="space-y-3">
                {activeTags.map((tag) => (
                  <div
                    key={tag.id}
                    className={
                      isLight
                        ? 'p-4 rounded-lg border border-slate-200 bg-slate-50'
                        : 'p-4 rounded-lg border border-slate-700 bg-slate-800/50'
                    }
                  >
                    {editingTagId === tag.id ? (
                      <div className="flex gap-4 items-center flex-wrap">
                        <input
                          type="text"
                          value={editingTagName}
                          onChange={(e) => setEditingTagName(e.target.value)}
                          className={`flex-1 min-w-[200px] ${inputClass}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveTagEdit();
                            else if (e.key === 'Escape') cancelEditingTag();
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={saveTagEdit}
                          disabled={!editingTagName.trim()}
                          className={`${primaryButtonClass} text-sm`}
                        >
                          Save
                        </button>
                        <button type="button" onClick={cancelEditingTag} className={secondaryButtonClass}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <span
                            className={
                              isLight ? 'text-lg font-medium text-slate-900' : 'text-lg font-medium text-slate-100'
                            }
                          >
                            {tag.name}
                          </span>
                          <span className={usageBadgeClass}>
                            Used {getTagUsageCount(tag.id)}{' '}
                            {getTagUsageCount(tag.id) === 1 ? 'time' : 'times'}
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEditingTag(tag)}
                            className={rowIconEmeraldClass}
                            title="Edit tag"
                            aria-label="Edit tag"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => inactivateTag(tag.id)}
                            className={rowIconSecondaryClass}
                            title="Move tag to history"
                            aria-label="Move tag to history"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className={`${descClass} text-center py-8`}>No active tags. Add one to get started!</p>
            )}
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>Inactive Tags</h3>
              <span className={counterTextClass}>
                {inactiveTags.length} {inactiveTags.length === 1 ? 'tag' : 'tags'}
              </span>
            </div>
            {inactiveTags.length > 0 ? (
              <div className="space-y-3">
                {inactiveTags.map((tag) => {
                  const usageCount = getTagUsageCount(tag.id);
                  return (
                    <div
                      key={tag.id}
                      className={
                        isLight
                          ? 'p-4 rounded-lg border border-slate-200 bg-slate-50 opacity-75'
                          : 'p-4 rounded-lg border border-slate-700 bg-slate-800/50 opacity-75'
                      }
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <span
                            className={
                              isLight ? 'text-lg font-medium text-slate-600' : 'text-lg font-medium text-slate-300'
                            }
                          >
                            {tag.name}
                          </span>
                          <span className={usageBadgeClass}>
                            Used {usageCount} {usageCount === 1 ? 'time' : 'times'}
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => activateTag(tag.id)}
                            className={rowIconEmeraldClass}
                            title="Activate tag"
                            aria-label="Activate tag"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                            </svg>
                          </button>
                          {usageCount === 0 && (
                            <button
                              type="button"
                              onClick={() => setDeleteTagConfirmId(tag.id)}
                              className={rowIconDangerClass}
                              title="Delete tag"
                              aria-label="Delete tag"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={`${descClass} text-center py-8`}>No inactive tags.</p>
            )}
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={modalCardClass}>
            <h3 className={isLight ? 'text-xl font-semibold text-slate-900 mb-2' : 'text-xl font-semibold text-slate-50 mb-2'}>
              Delete Address
            </h3>
            <div
              className={
                isLight
                  ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 mb-4'
                  : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4'
              }
            >
              <p className={isLight ? 'text-red-700 font-semibold mb-2' : 'text-red-300 font-semibold mb-2'}>
                ⚠️ Warning: This action cannot be undone!
              </p>
              <p className={isLight ? 'text-red-600 text-sm' : 'text-red-200 text-sm'}>
                This address will be permanently deleted.
              </p>
            </div>
            <p className={isLight ? 'text-slate-600 text-sm mb-4' : 'text-slate-400 text-sm mb-4'}>
              To confirm, please type <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>delete</strong> in
              the box below:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className={
                isLight
                  ? 'w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4'
                  : 'w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4'
              }
              autoFocus
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={deleteAddress}
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Address
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteConfirmText('');
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTagConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={modalCardClass}>
            <h3 className={isLight ? 'text-xl font-semibold text-slate-900 mb-2' : 'text-xl font-semibold text-slate-50 mb-2'}>
              Delete Tag
            </h3>
            <div
              className={
                isLight
                  ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 mb-4'
                  : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4'
              }
            >
              <p className={isLight ? 'text-red-700 font-semibold mb-2' : 'text-red-300 font-semibold mb-2'}>
                ⚠️ Warning: This action cannot be undone!
              </p>
              <p className={isLight ? 'text-red-600 text-sm' : 'text-red-200 text-sm'}>
                This tag will be permanently deleted.
              </p>
            </div>
            <p className={isLight ? 'text-slate-600 text-sm mb-4' : 'text-slate-400 text-sm mb-4'}>
              To confirm, please type <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>delete</strong>{' '}
              in the box below:
            </p>
            <input
              type="text"
              value={deleteTagConfirmText}
              onChange={(e) => setDeleteTagConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className={
                isLight
                  ? 'w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4'
                  : 'w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4'
              }
              autoFocus
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={deleteTag}
                disabled={deleteTagConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Tag
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteTagConfirmId(null);
                  setDeleteTagConfirmText('');
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {viewAddressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={modalCardLgClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>View Address</h3>
              <button
                type="button"
                onClick={() => setViewAddressModal(null)}
                className={isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'}
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {[
                ['Mailing Name', viewAddressModal.mailingName],
                ['First Name', viewAddressModal.firstName],
                ['Last Name', viewAddressModal.lastName],
                ['Email', viewAddressModal.email],
                ['Phone', viewAddressModal.phone],
                ['Street Address', viewAddressModal.streetAddress],
                ['City', viewAddressModal.city],
                ['State', viewAddressModal.state],
                ['Zip', viewAddressModal.zip],
                ['Country', viewAddressModal.country],
              ].map(([label, value]) =>
                value ? (
                  <div key={label}>
                    <span className={viewLabelClass}>{label}:</span>
                    {label === 'Street Address' ? (
                      <div
                        className={`mt-1 ${isLight ? 'text-slate-900' : 'text-slate-100'} whitespace-pre-wrap break-words`}
                      >
                        {value}
                      </div>
                    ) : (
                      <span className={viewValueClass}>{value}</span>
                    )}
                  </div>
                ) : null
              )}
              {viewAddressModal.tags.length > 0 && (
                <div>
                  <span className={viewLabelClass}>Tags:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {viewAddressModal.tags.map((tagId) => {
                      const tag = tags.find((t) => t.id === tagId);
                      return tag ? (
                        <span key={tagId} className={tagChipActiveClass}>
                          {tag.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setViewAddressModal(null)} className={secondaryButtonClass}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
