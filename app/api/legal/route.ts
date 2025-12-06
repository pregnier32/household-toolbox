import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Public endpoint to fetch legal documents (Terms of Service or Privacy Policy)
export async function GET(request: NextRequest) {
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
      // PGRST116 is "not found" which is okay - will use default content
      console.error(`Error fetching ${key}:`, error);
    }

    // If no document exists, return null (frontend will use default content)
    if (!data || !data.value) {
      return NextResponse.json({ content: null, lastUpdated: null });
    }

    return NextResponse.json({
      content: data.value.content || null,
      lastUpdated: data.value.lastUpdated || null,
    });
  } catch (error) {
    console.error('Error in legal documents API:', error);
    return NextResponse.json({ content: null, lastUpdated: null });
  }
}

