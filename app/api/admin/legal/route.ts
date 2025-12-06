import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Fetch legal documents (Terms of Service or Privacy Policy)
export async function GET(request: NextRequest) {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'terms' or 'privacy'

    if (!type || !['terms', 'privacy'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "terms" or "privacy"' },
        { status: 400 }
      );
    }

    const key = type === 'terms' ? 'terms_of_service' : 'privacy_policy';

    // Get the legal document from settings table
    const { data, error } = await supabaseServer
      .from('settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" which is okay for first time
      console.error(`Error fetching ${key}:`, error);
      return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
    }

    // If no document exists, return null (will use default content)
    if (!data || !data.value) {
      return NextResponse.json({ content: null, lastUpdated: null });
    }

    return NextResponse.json({
      content: data.value.content || null,
      lastUpdated: data.value.lastUpdated || null,
    });
  } catch (error) {
    console.error('Error in legal documents API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update legal documents (Terms of Service or Privacy Policy)
export async function PUT(request: NextRequest) {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { type, content } = body;

    if (!type || !['terms', 'privacy'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "terms" or "privacy"' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required and must be a string' },
        { status: 400 }
      );
    }

    const key = type === 'terms' ? 'terms_of_service' : 'privacy_policy';
    const lastUpdated = new Date().toISOString();

    // Upsert the legal document
    const { error } = await supabaseServer
      .from('settings')
      .upsert(
        {
          key,
          value: {
            content,
            lastUpdated,
          },
          updated_at: lastUpdated,
        },
        {
          onConflict: 'key',
        }
      );

    if (error) {
      console.error(`Error saving ${key}:`, error);
      return NextResponse.json({ error: 'Failed to save document' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      lastUpdated,
    });
  } catch (error) {
    console.error('Error in legal documents API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

