'use client';

import { useCallback, useEffect, useState } from 'react';
import { RELEASE_NOTES_VIEWED_EVENT } from '@/lib/release-notes';

export function useHasUnreadReleaseNotes() {
  const [hasUnread, setHasUnread] = useState(false);

  const loadUnread = useCallback(() => {
    fetch('/api/release-notes/unread')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setHasUnread(Boolean(data?.hasUnread));
      })
      .catch(() => {
        setHasUnread(false);
      });
  }, []);

  useEffect(() => {
    loadUnread();
    const handleViewed = () => setHasUnread(false);
    const handleFocus = () => loadUnread();
    window.addEventListener(RELEASE_NOTES_VIEWED_EVENT, handleViewed);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener(RELEASE_NOTES_VIEWED_EVENT, handleViewed);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadUnread]);

  return hasUnread;
}

type WhatsNewIndicatorProps = {
  visible: boolean;
  className?: string;
  label?: string;
};

export function WhatsNewIndicator({
  visible,
  className = '',
  label = 'New',
}: WhatsNewIndicatorProps) {
  if (!visible) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-950 ${className}`}
    >
      {label}
    </span>
  );
}

export function WhatsNewDot({
  visible,
  className = '',
}: {
  visible: boolean;
  className?: string;
}) {
  if (!visible) return null;

  return (
    <span
      className={`inline-block h-2 w-2 rounded-full bg-emerald-400 ${className}`}
      aria-label="New updates available"
    />
  );
}
