import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  isReleaseNoteCategory,
  todayIsoDate,
  toReleaseNote,
  type ReleaseNoteCategory,
} from '@/lib/release-notes';

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const categoryParam = request.nextUrl.searchParams.get('category');
  const limitParam = request.nextUrl.searchParams.get('limit');
  const category =
    categoryParam && categoryParam !== 'all' && isReleaseNoteCategory(categoryParam)
      ? (categoryParam as ReleaseNoteCategory)
      : null;

  const limit = limitParam ? Number.parseInt(limitParam, 10) : null;
  if (limit !== null && (!Number.isFinite(limit) || limit < 1 || limit > 50)) {
    return NextResponse.json({ error: 'limit must be between 1 and 50' }, { status: 400 });
  }

  try {
    let query = supabaseServer
      .from('release_notes')
      .select(
        'id, title, summary, content, category, publish_date, status, featured, link_url, link_text, created_at, updated_at, created_by'
      )
      .eq('status', 'published')
      .lte('publish_date', todayIsoDate())
      .order('publish_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }
    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching release notes:', error);
      return NextResponse.json({ error: 'Failed to fetch release notes' }, { status: 500 });
    }

    const notes = (data || []).map(toReleaseNote).filter((note) => note !== null);
    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Error in release notes API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
