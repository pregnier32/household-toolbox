import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { parseReleaseNoteBody, requireSuperAdmin } from '@/lib/release-notes-admin';
import { toReleaseNote } from '@/lib/release-notes';

export async function GET() {
  const user = await getSession();
  const denied = requireSuperAdmin(user);
  if (denied) return denied;

  try {
    const { data, error } = await supabaseServer
      .from('release_notes')
      .select(
        'id, title, summary, content, category, publish_date, status, featured, link_url, link_text, created_at, updated_at, created_by'
      )
      .order('publish_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin release notes:', error);
      return NextResponse.json({ error: 'Failed to fetch release notes' }, { status: 500 });
    }

    const notes = (data || []).map(toReleaseNote).filter((note) => note !== null);
    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Error in admin release notes API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  const denied = requireSuperAdmin(user);
  if (denied) return denied;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseReleaseNoteBody(body, { partial: false });
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('release_notes')
      .insert({
        title: parsed.title,
        summary: parsed.summary,
        content: parsed.content,
        category: parsed.category,
        publish_date: parsed.publish_date,
        status: parsed.status,
        featured: parsed.featured,
        link_url: parsed.link_url,
        link_text: parsed.link_text,
        created_by: user!.id,
      })
      .select(
        'id, title, summary, content, category, publish_date, status, featured, link_url, link_text, created_at, updated_at, created_by'
      )
      .single();

    if (error) {
      console.error('Error creating release note:', error);
      return NextResponse.json({ error: 'Failed to create release note' }, { status: 500 });
    }

    const note = toReleaseNote(data);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error('Error in admin release notes API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
