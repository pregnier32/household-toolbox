import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { parseReleaseNoteBody, requireSuperAdmin } from '@/lib/release-notes-admin';
import { toReleaseNote } from '@/lib/release-notes';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getSession();
  const denied = requireSuperAdmin(user);
  if (denied) return denied;

  const { id } = await context.params;

  try {
    const { data, error } = await supabaseServer
      .from('release_notes')
      .select(
        'id, title, summary, content, category, publish_date, status, featured, link_url, link_text, created_at, updated_at, created_by'
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching release note:', error);
      return NextResponse.json({ error: 'Failed to fetch release note' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Release note not found' }, { status: 404 });
    }

    const note = toReleaseNote(data);
    if (!note) {
      return NextResponse.json({ error: 'Release note is invalid' }, { status: 500 });
    }
    return NextResponse.json({ note });
  } catch (error) {
    console.error('Error in admin release note API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const user = await getSession();
  const denied = requireSuperAdmin(user);
  if (denied) return denied;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseReleaseNoteBody(body, { partial: false });
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('release_notes')
      .update({
        title: parsed.title,
        summary: parsed.summary,
        content: parsed.content,
        category: parsed.category,
        publish_date: parsed.publish_date,
        status: parsed.status,
        featured: parsed.featured,
        link_url: parsed.link_url,
        link_text: parsed.link_text,
      })
      .eq('id', id)
      .select(
        'id, title, summary, content, category, publish_date, status, featured, link_url, link_text, created_at, updated_at, created_by'
      )
      .maybeSingle();

    if (error) {
      console.error('Error updating release note:', error);
      return NextResponse.json({ error: 'Failed to update release note' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Release note not found' }, { status: 404 });
    }

    return NextResponse.json({ note: toReleaseNote(data) });
  } catch (error) {
    console.error('Error in admin release note API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getSession();
  const denied = requireSuperAdmin(user);
  if (denied) return denied;

  const { id } = await context.params;

  try {
    const { data, error } = await supabaseServer
      .from('release_notes')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Error deleting release note:', error);
      return NextResponse.json({ error: 'Failed to delete release note' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Release note not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in admin release note API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
