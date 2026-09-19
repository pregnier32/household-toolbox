'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from './AppThemeProvider';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_FILE_BYTES,
  type AttachmentItem,
  filterIncomingAttachments,
  formatAttachmentBytes,
  isImageAttachment,
} from '@/lib/attachments';

type StorageSummary = {
  usedBytes: number;
  limitBytes: number;
  usedLabel: string;
  limitLabel: string;
};

type AttachmentModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  files: AttachmentItem[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onView?: (item: AttachmentItem) => void;
  onDownload?: (item: AttachmentItem) => void;
  previewItem?: AttachmentItem | null;
  maxFiles?: number;
  busy?: boolean;
  readOnly?: boolean;
};

export function AttachmentModal({
  open,
  onClose,
  title,
  files,
  onAdd,
  onRemove,
  onView,
  onDownload,
  previewItem = null,
  maxFiles,
  busy = false,
  readOnly = false,
}: AttachmentModalProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AttachmentItem | null>(null);
  const [storage, setStorage] = useState<StorageSummary | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setPreview(null);
      setIsDragging(false);
      return;
    }

    if (previewItem) {
      setPreview(previewItem);
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (preview) setPreview(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);

    fetch('/api/account/storage')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.storage) return;
        setStorage({
          usedBytes: data.storage.usedBytes,
          limitBytes: data.storage.limitBytes,
          usedLabel: data.storage.usedLabel,
          limitLabel: data.storage.limitLabel,
        });
      })
      .catch(() => setStorage(null));

    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose, preview, previewItem]);

  if (!open) return null;

  const heading = title?.trim() ? `Attachments · ${title.trim()}` : 'Attachments';
  const pendingBytes = files.reduce((sum, item) => (item.file ? sum + item.size : sum), 0);
  const canAddMore = maxFiles == null || files.length < maxFiles;

  const addFiles = (incoming: File[]) => {
    if (readOnly || incoming.length === 0) return;
    const { accepted, errors } = filterIncomingAttachments(incoming, {
      existingCount: maxFiles === 1 ? 0 : files.length,
      maxFiles,
      pendingBytes: maxFiles === 1 ? 0 : pendingBytes,
      usedBytes: storage?.usedBytes,
      limitBytes: storage?.limitBytes,
    });
    setError(errors[0] || null);
    if (accepted.length > 0) onAdd(accepted);
  };

  const handleView = (item: AttachmentItem) => {
    if (onView) {
      onView(item);
      return;
    }
    if (isImageAttachment(item.type) && item.url) {
      setPreview(item);
      return;
    }
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  };

  const cardClass = isLight
    ? 'relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl'
    : 'relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl';
  const titleClass = isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50';
  const mutedClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400';
  const closeClass = isLight
    ? 'rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800'
    : 'rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100';
  const listClass = isLight ? 'divide-y divide-slate-200' : 'divide-y divide-slate-800';
  const nameClass = isLight ? 'truncate text-sm font-medium text-slate-900' : 'truncate text-sm font-medium text-slate-100';
  const actionClass = isLight
    ? 'rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100'
    : 'rounded-md px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800';
  const dangerActionClass = isLight
    ? 'rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50'
    : 'rounded-md px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10';
  const dropClass = isDragging
    ? isLight
      ? 'rounded-xl border-2 border-dashed border-emerald-500 bg-emerald-50 px-4 py-6 text-center'
      : 'rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-500/10 px-4 py-6 text-center'
    : isLight
      ? 'rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center'
      : 'rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/70 px-4 py-6 text-center';
  const browseClass = isLight
    ? 'mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50'
    : 'mt-3 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className={cardClass} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="attachment-modal-title">
        <div className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          <div>
            <h2 id="attachment-modal-title" className={titleClass}>
              {heading}
            </h2>
            <p className={mutedClass}>
              {files.length === 0
                ? 'No attachments yet.'
                : `${files.length} file${files.length === 1 ? '' : 's'} attached.`}
            </p>
          </div>
          <button type="button" onClick={onClose} className={closeClass} aria-label="Close attachments">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div
              className={
                isLight
                  ? 'mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'
                  : 'mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300'
              }
            >
              {error}
            </div>
          )}

          {preview && preview.url ? (
            <div className="mb-4">
              <img src={preview.url} alt={preview.name} className="max-h-64 w-full rounded-lg object-contain" />
              <button type="button" onClick={() => setPreview(null)} className={`${actionClass} mt-2`}>
                Back to files
              </button>
            </div>
          ) : files.length === 0 ? (
            <p className={`${mutedClass} mb-4`}>
              {readOnly ? 'Restore this item to add or change files.' : 'Add a file to keep it with this item.'}
            </p>
          ) : (
            <ul className={`${listClass} mb-4`}>
              {files.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className={nameClass}>{item.name}</p>
                    <p className={mutedClass}>
                      {formatAttachmentBytes(item.size)}
                      {item.file ? ' · queued until save' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {(item.url || onView) && (
                      <button type="button" onClick={() => handleView(item)} className={actionClass}>
                        View
                      </button>
                    )}
                    {onDownload && !item.file && (
                      <button type="button" onClick={() => onDownload(item)} className={actionClass} disabled={busy}>
                        Download
                      </button>
                    )}
                    {!readOnly && (
                      <button type="button" onClick={() => onRemove(item.id)} className={dangerActionClass} disabled={busy}>
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {readOnly ? (
            files.length > 0 ? (
              <p className={mutedClass}>Restore this item to add or change files.</p>
            ) : null
          ) : (
            <div
              className={dropClass}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                addFiles(Array.from(event.dataTransfer.files || []));
              }}
            >
              <p className={isLight ? 'text-sm font-medium text-slate-800' : 'text-sm font-medium text-slate-200'}>
                {canAddMore ? 'Drop files here' : maxFiles === 1 ? 'Replace the current file' : 'File limit reached'}
              </p>
              <p className={`${mutedClass} mt-1`}>Images, PDFs, Word, and Excel up to {formatAttachmentBytes(ATTACHMENT_MAX_FILE_BYTES)} each.</p>
              <button
                type="button"
                className={browseClass}
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {maxFiles === 1 && files.length > 0 ? 'Replace file' : 'Add files'}
              </button>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept={ATTACHMENT_ACCEPT}
                multiple={maxFiles !== 1}
                onChange={(event) => {
                  addFiles(Array.from(event.target.files || []));
                  event.target.value = '';
                }}
              />
            </div>
          )}
        </div>

        {storage && (
          <div className={`border-t px-5 py-3 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
            <p className={mutedClass}>
              Storage used: {storage.usedLabel} of {storage.limitLabel}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
