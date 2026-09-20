export const RELEASE_NOTE_CATEGORIES = [
  'new_tool',
  'new_feature',
  'improvement',
  'bug_fix',
  'security',
  'announcement',
] as const;

export const RELEASE_NOTE_STATUSES = ['draft', 'published', 'archived'] as const;

export type ReleaseNoteCategory = (typeof RELEASE_NOTE_CATEGORIES)[number];
export type ReleaseNoteStatus = (typeof RELEASE_NOTE_STATUSES)[number];

export type ReleaseNote = {
  id: string;
  title: string;
  summary: string;
  content: string | null;
  category: ReleaseNoteCategory;
  publish_date: string;
  status: ReleaseNoteStatus;
  featured: boolean;
  link_url: string | null;
  link_text: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export const RELEASE_NOTE_CATEGORY_LABELS: Record<ReleaseNoteCategory, string> = {
  new_tool: 'New Tool',
  new_feature: 'New Feature',
  improvement: 'Improvement',
  bug_fix: 'Bug Fix',
  security: 'Security',
  announcement: 'Announcement',
};

export const RELEASE_NOTE_STATUS_LABELS: Record<ReleaseNoteStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

export const RELEASE_NOTES_FILTERS: Array<{ id: 'all' | ReleaseNoteCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'new_tool', label: 'New Tools' },
  { id: 'new_feature', label: 'New Features' },
  { id: 'improvement', label: 'Improvements' },
  { id: 'bug_fix', label: 'Bug Fixes' },
];

export const RELEASE_NOTES_VIEWED_EVENT = 'household-toolbox:release-notes-viewed';

export function isReleaseNoteCategory(value: string): value is ReleaseNoteCategory {
  return (RELEASE_NOTE_CATEGORIES as readonly string[]).includes(value);
}

export function isReleaseNoteStatus(value: string): value is ReleaseNoteStatus {
  return (RELEASE_NOTE_STATUSES as readonly string[]).includes(value);
}

export function formatReleaseNoteDate(publishDate: string): string {
  const datePart = publishDate.slice(0, 10);
  const parsed = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return publishDate;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function isSafeReleaseNoteLink(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//') && !trimmed.includes('\\');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function compareReleaseNotesNewestFirst(a: ReleaseNote, b: ReleaseNote): number {
  const dateCompare = b.publish_date.localeCompare(a.publish_date);
  if (dateCompare !== 0) return dateCompare;
  return b.created_at.localeCompare(a.created_at);
}

export function hasUnreadReleaseNotes(
  newest: Pick<ReleaseNote, 'id' | 'publish_date'> | null,
  lastViewed: { last_viewed_id: string | null; last_viewed_publish_date: string } | null
): boolean {
  if (!newest) return false;
  if (!lastViewed) return true;
  if (newest.publish_date > lastViewed.last_viewed_publish_date) return true;
  if (newest.publish_date < lastViewed.last_viewed_publish_date) return false;
  return newest.id !== lastViewed.last_viewed_id;
}

type ReleaseNoteRow = {
  id: string;
  title: string;
  summary: string;
  content: string | null;
  category: string;
  publish_date: string;
  status: string;
  featured: boolean;
  link_url: string | null;
  link_text: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export function toReleaseNote(row: ReleaseNoteRow): ReleaseNote | null {
  if (!isReleaseNoteCategory(row.category) || !isReleaseNoteStatus(row.status)) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    content: row.content,
    category: row.category,
    publish_date: row.publish_date,
    status: row.status,
    featured: row.featured,
    link_url: row.link_url,
    link_text: row.link_text,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
  };
}
