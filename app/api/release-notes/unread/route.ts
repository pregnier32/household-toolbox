import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { hasUnreadReleaseNotes, todayIsoDate } from '@/lib/release-notes';

async function getNewestPublishedNote() {
  const { data, error } = await supabaseServer
    .from('release_notes')
    .select('id, publish_date')
    .eq('status', 'published')
    .lte('publish_date', todayIsoDate())
    .order('publish_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const newest = await getNewestPublishedNote();
    const { data: lastViewed, error: readError } = await supabaseServer
      .from('user_release_note_reads')
      .select('last_viewed_id, last_viewed_publish_date')
      .eq('user_id', user.id)
      .maybeSingle();

    if (readError) {
      console.error('Error fetching release note read watermark:', readError);
      return NextResponse.json({ error: 'Failed to fetch unread status' }, { status: 500 });
    }

    return NextResponse.json({
      hasUnread: hasUnreadReleaseNotes(newest, lastViewed),
    });
  } catch (error) {
    console.error('Error in release notes unread API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const newest = await getNewestPublishedNote();
    if (!newest) {
      return NextResponse.json({ success: true, hasUnread: false });
    }

    const { error } = await supabaseServer.from('user_release_note_reads').upsert(
      {
        user_id: user.id,
        last_viewed_id: newest.id,
        last_viewed_publish_date: newest.publish_date,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.error('Error saving release note read watermark:', error);
      return NextResponse.json({ error: 'Failed to mark release notes viewed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, hasUnread: false });
  } catch (error) {
    console.error('Error in release notes unread API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
