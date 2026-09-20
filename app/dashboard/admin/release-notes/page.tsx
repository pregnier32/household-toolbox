'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SideLogo } from '../../../components/SideLogo';
import { AdminMenu } from '../../../components/AdminMenu';
import { UserMenu } from '../../../components/UserMenu';
import { useTheme } from '../../../components/AppThemeProvider';
import { completeSignOut } from '@/lib/client-sign-out';
import { ReleaseNoteCard } from '../../../components/release-notes/ReleaseNoteCard';
import { ReleaseNoteBadge } from '../../../components/release-notes/ReleaseNoteBadge';
import {
  RELEASE_NOTE_CATEGORIES,
  RELEASE_NOTE_CATEGORY_LABELS,
  RELEASE_NOTE_STATUS_LABELS,
  formatReleaseNoteDate,
  todayIsoDate,
  type ReleaseNote,
  type ReleaseNoteCategory,
  type ReleaseNoteStatus,
} from '@/lib/release-notes';

type FormData = {
  title: string;
  summary: string;
  content: string;
  category: ReleaseNoteCategory;
  publish_date: string;
  status: ReleaseNoteStatus;
  featured: boolean;
  link_url: string;
  link_text: string;
};

const emptyForm = (): FormData => ({
  title: '',
  summary: '',
  content: '',
  category: 'new_feature',
  publish_date: todayIsoDate(),
  status: 'draft',
  featured: false,
  link_url: '',
  link_text: '',
});

function formFromNote(note: ReleaseNote): FormData {
  return {
    title: note.title,
    summary: note.summary,
    content: note.content || '',
    category: note.category,
    publish_date: note.publish_date.slice(0, 10),
    status: note.status,
    featured: note.featured,
    link_url: note.link_url || '',
    link_text: note.link_text || '',
  };
}

function previewNote(form: FormData): ReleaseNote {
  return {
    id: 'preview',
    title: form.title || 'Untitled update',
    summary: form.summary || 'Add a short summary to preview this release.',
    content: form.content.trim() || null,
    category: form.category,
    publish_date: form.publish_date || todayIsoDate(),
    status: form.status,
    featured: form.featured,
    link_url: form.link_url.trim() || null,
    link_text: form.link_text.trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null,
  };
}

export default function AdminReleaseNotesPage() {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const router = useRouter();
  const [user, setUser] = useState<{ firstName?: string; lastName?: string; userStatus?: string } | null>(null);
  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ReleaseNoteStatus>('all');
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const headerChromeButtonClass = isLight
    ? 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900'
    : 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100';
  const headerBarClass = isLight
    ? 'border-b-2 border-slate-400 bg-slate-900/50'
    : 'border-b border-slate-800 bg-slate-900/50';
  const backLinkClass = isLight
    ? 'mb-4 flex items-center gap-2 text-sm text-slate-700 transition-colors hover:text-slate-900'
    : 'mb-4 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-300';
  const pageTitleClass = isLight ? 'text-2xl font-semibold text-slate-900 mb-2' : 'text-2xl font-semibold text-slate-50 mb-2';
  const pageSubtitleClass = isLight ? 'text-slate-600 text-sm' : 'text-slate-400 text-sm';
  const filterSelectClass = isLight
    ? 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const errorAlertClass = isLight
    ? 'mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
    : 'mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300';
  const successAlertClass = isLight
    ? 'mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900'
    : 'mb-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300';
  const tableWrapClass = isLight
    ? 'rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm'
    : 'rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden';
  const tableHeadClass = isLight ? 'bg-slate-100' : 'bg-slate-800/50';
  const tableHeadCellClass = isLight
    ? 'px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider'
    : 'px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider';
  const tableBodyClass = isLight ? 'divide-y divide-slate-200' : 'divide-y divide-slate-800';
  const rowHoverClass = isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/30';
  const titleClass = isLight ? 'font-medium text-slate-900' : 'font-medium text-slate-100';
  const mutedClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400';
  const modalCardClass = isLight
    ? 'bg-white rounded-lg border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl'
    : 'bg-slate-900 rounded-lg border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto';
  const modalTitleClass = isLight ? 'text-xl font-semibold text-slate-900' : 'text-xl font-semibold text-slate-50';
  const inputLabelClass = isLight ? 'mb-1 block text-sm font-medium text-slate-700' : 'mb-1 block text-sm font-medium text-slate-300';
  const inputClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const secondaryButtonClass = isLight
    ? 'px-4 py-2 text-sm font-medium text-slate-700 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 transition-colors'
    : 'px-4 py-2 text-sm font-medium text-slate-300 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors';
  const actionClass = isLight ? 'text-emerald-700 hover:text-emerald-800' : 'text-emerald-400 hover:text-emerald-300';
  const dangerClass = isLight ? 'text-red-700 hover:text-red-800' : 'text-red-400 hover:text-red-300';

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          if (data.user.userStatus !== 'superadmin') {
            router.push('/dashboard');
            return;
          }
          loadNotes();
        } else {
          router.push('/');
        }
      })
      .catch(() => router.push('/'));
  }, [router]);

  const loadNotes = async () => {
    try {
      const response = await fetch('/api/admin/release-notes');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load release notes');
      setNotes(data.notes || []);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load release notes');
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await completeSignOut();
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm());
    setShowPreview(false);
    setError(null);
    setSuccess(null);
    setShowForm(true);
  };

  const openEdit = (note: ReleaseNote) => {
    setEditingId(note.id);
    setFormData(formFromNote(note));
    setShowPreview(false);
    setError(null);
    setSuccess(null);
    setShowForm(true);
  };

  const saveNote = async (overrides: Partial<FormData> = {}) => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    const payload = { ...formData, ...overrides };
    try {
      const response = await fetch(editingId ? `/api/admin/release-notes/${editingId}` : '/api/admin/release-notes', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: payload.title,
          summary: payload.summary,
          content: payload.content,
          category: payload.category,
          publish_date: payload.publish_date,
          status: payload.status,
          featured: payload.featured,
          link_url: payload.link_url,
          link_text: payload.link_text,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save release note');
      setSuccess(editingId ? 'Release note updated' : 'Release note created');
      setShowForm(false);
      setShowPreview(false);
      await loadNotes();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save release note');
    } finally {
      setIsSaving(false);
    }
  };

  const patchNote = async (note: ReleaseNote, updates: Partial<FormData> & { status?: ReleaseNoteStatus; featured?: boolean }) => {
    setError(null);
    try {
      const response = await fetch(`/api/admin/release-notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          summary: note.summary,
          content: note.content || '',
          category: note.category,
          publish_date: note.publish_date.slice(0, 10),
          status: updates.status ?? note.status,
          featured: updates.featured ?? note.featured,
          link_url: note.link_url || '',
          link_text: note.link_text || '',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update release note');
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update release note');
    }
  };

  const deleteNote = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/release-notes/${deleteId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete release note');
      setDeleteId(null);
      setSuccess('Release note deleted');
      await loadNotes();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete release note');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredNotes = notes.filter((note) => statusFilter === 'all' || note.status === statusFilter);

  const statusBadgeClass = (status: ReleaseNoteStatus) => {
    if (status === 'published') {
      return isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/20 text-emerald-300';
    }
    if (status === 'archived') {
      return isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-700 text-slate-300';
    }
    return isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-500/20 text-amber-300';
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-slate-400">Loading release notes...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className={headerBarClass}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <SideLogo priority />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push('/dashboard')} className={headerChromeButtonClass}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Toolbox</span>
            </button>
            <AdminMenu />
            <UserMenu
              userName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Account'}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <button type="button" onClick={() => router.push('/dashboard/admin/site-maintenance')} className={backLinkClass}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Site Maintenance</span>
        </button>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className={pageTitleClass}>Release Notes</h1>
            <p className={pageSubtitleClass}>
              Publish customer-facing updates for new tools, features, improvements, and important fixes.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
          >
            + Create Release Note
          </button>
        </div>

        {!showForm && error && <div className={errorAlertClass}>{error}</div>}
        {!showForm && success && <div className={successAlertClass}>{success}</div>}

        <div className="mb-4 flex items-center gap-3">
          <label className={isLight ? 'text-sm font-medium text-slate-700' : 'text-sm font-medium text-slate-300'}>
            Filter by Status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | ReleaseNoteStatus)}
            className={filterSelectClass}
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className={tableWrapClass}>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={tableHeadCellClass}>Title</th>
                  <th className={tableHeadCellClass}>Category</th>
                  <th className={tableHeadCellClass}>Publish date</th>
                  <th className={tableHeadCellClass}>Status</th>
                  <th className={tableHeadCellClass}>Featured</th>
                  <th className={`${tableHeadCellClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className={tableBodyClass}>
                {filteredNotes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`px-4 py-8 text-center ${mutedClass}`}>
                      No release notes match this filter.
                    </td>
                  </tr>
                ) : (
                  filteredNotes.map((note) => (
                    <tr key={note.id} className={rowHoverClass}>
                      <td className="px-4 py-3">
                        <div className={titleClass}>{note.title}</div>
                        <div className={`mt-0.5 line-clamp-1 text-xs ${mutedClass}`}>{note.summary}</div>
                      </td>
                      <td className="px-4 py-3">
                        <ReleaseNoteBadge category={note.category} />
                      </td>
                      <td className={`px-4 py-3 ${mutedClass}`}>{formatReleaseNoteDate(note.publish_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(note.status)}`}>
                          {RELEASE_NOTE_STATUS_LABELS[note.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => patchNote(note, { featured: !note.featured })}
                          className={note.featured ? actionClass : mutedClass}
                        >
                          {note.featured ? 'Yes' : 'No'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-3 text-xs font-medium">
                          <button type="button" className={actionClass} onClick={() => openEdit(note)}>
                            Edit
                          </button>
                          {note.status !== 'published' ? (
                            <button type="button" className={actionClass} onClick={() => patchNote(note, { status: 'published' })}>
                              Publish
                            </button>
                          ) : (
                            <button type="button" className={actionClass} onClick={() => patchNote(note, { status: 'draft' })}>
                              Unpublish
                            </button>
                          )}
                          {note.status !== 'archived' && (
                            <button type="button" className={mutedClass} onClick={() => patchNote(note, { status: 'archived' })}>
                              Archive
                            </button>
                          )}
                          <button type="button" className={dangerClass} onClick={() => setDeleteId(note.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <div className={modalCardClass} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h2 className={modalTitleClass}>{editingId ? 'Edit release note' : 'Create release note'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-200">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form
              className="space-y-4 px-6 py-5"
              onSubmit={(e) => {
                e.preventDefault();
                void saveNote();
              }}
            >
              {error && <div className={errorAlertClass}>{error}</div>}
              <div>
                <label className={inputLabelClass}>Title</label>
                <input
                  className={inputClass}
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={inputLabelClass}>Category</label>
                  <select
                    className={inputClass}
                    value={formData.category}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value as ReleaseNoteCategory }))}
                  >
                    {RELEASE_NOTE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {RELEASE_NOTE_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={inputLabelClass}>Publish date</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={formData.publish_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, publish_date: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <label className={inputLabelClass}>Short summary</label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={formData.summary}
                  onChange={(e) => setFormData((prev) => ({ ...prev, summary: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className={inputLabelClass}>Detailed description</label>
                <textarea
                  className={inputClass}
                  rows={5}
                  value={formData.content}
                  onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={inputLabelClass}>Status</label>
                  <select
                    className={inputClass}
                    value={formData.status}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as ReleaseNoteStatus }))}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <label className="flex items-center gap-3 pt-6 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData((prev) => ({ ...prev, featured: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-500 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>Featured</span>
                </label>
              </div>
              <div>
                <label className={inputLabelClass}>Optional link URL</label>
                <input
                  className={inputClass}
                  placeholder="/dashboard"
                  value={formData.link_url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, link_url: e.target.value }))}
                />
              </div>
              <div>
                <label className={inputLabelClass}>Optional link button text</label>
                <input
                  className={inputClass}
                  placeholder="Open Meal Planner"
                  value={formData.link_text}
                  onChange={(e) => setFormData((prev) => ({ ...prev, link_text: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-800 pt-4">
                <button type="button" className={secondaryButtonClass} onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setShowPreview(true)}>
                  Preview
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingId ? 'Save changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowPreview(false)}>
          <div className={`${modalCardClass} max-w-xl`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className={modalTitleClass}>Customer preview</h2>
              <button type="button" onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-200">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 pb-6">
              <ReleaseNoteCard note={previewNote(formData)} defaultExpanded />
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteId(null)}>
          <div className={`${modalCardClass} max-w-md p-6`} onClick={(e) => e.stopPropagation()}>
            <h2 className={modalTitleClass}>Delete release note?</h2>
            <p className={`mt-2 ${mutedClass}`}>This permanently removes the release note. Archive it instead if you may want it later.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className={secondaryButtonClass} onClick={() => setDeleteId(null)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteNote()}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
