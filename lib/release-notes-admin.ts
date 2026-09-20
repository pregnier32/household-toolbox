import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  isReleaseNoteCategory,
  isReleaseNoteStatus,
  isSafeReleaseNoteLink,
  normalizeOptionalText,
  type ReleaseNoteCategory,
  type ReleaseNoteStatus,
} from '@/lib/release-notes';

export type ParsedReleaseNoteInput = {
  title: string;
  summary: string;
  content: string | null;
  category: ReleaseNoteCategory;
  publish_date: string;
  status: ReleaseNoteStatus;
  featured: boolean;
  link_url: string | null;
  link_text: string | null;
};

export function requireSuperAdmin(user: Awaited<ReturnType<typeof getSession>>) {
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export function parseReleaseNoteBody(
  body: Record<string, unknown>,
  { partial }: { partial: boolean }
): { error: string } | ParsedReleaseNoteInput {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const status = typeof body.status === 'string' ? body.status.trim() : '';
  const publishDate = typeof body.publish_date === 'string' ? body.publish_date.trim() : '';
  const content = normalizeOptionalText(body.content);
  const linkUrl = normalizeOptionalText(body.link_url);
  const linkText = normalizeOptionalText(body.link_text);
  const featured = body.featured;

  if (!partial || body.title !== undefined) {
    if (!title) return { error: 'Title is required' };
  }
  if (!partial || body.summary !== undefined) {
    if (!summary) return { error: 'Summary is required' };
  }
  if (!partial || body.category !== undefined) {
    if (!isReleaseNoteCategory(category)) return { error: 'Invalid category' };
  }
  if (!partial || body.status !== undefined) {
    if (!isReleaseNoteStatus(status)) return { error: 'Invalid status' };
  }
  if (!partial || body.publish_date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) {
      return { error: 'Publish date must be YYYY-MM-DD' };
    }
  }
  if (featured !== undefined && typeof featured !== 'boolean') {
    return { error: 'Featured must be a boolean' };
  }
  if (linkUrl && !isSafeReleaseNoteLink(linkUrl)) {
    return { error: 'Link URL must be an internal path or http(s) URL' };
  }
  if (linkUrl && !linkText) {
    return { error: 'Link button text is required when a link URL is provided' };
  }
  if (linkText && !linkUrl) {
    return { error: 'Link URL is required when link button text is provided' };
  }

  return {
    title,
    summary,
    content,
    category: category as ReleaseNoteCategory,
    publish_date: publishDate,
    status: status as ReleaseNoteStatus,
    featured: typeof featured === 'boolean' ? featured : false,
    link_url: linkUrl,
    link_text: linkText,
  };
}
