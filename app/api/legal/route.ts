import { NextRequest, NextResponse } from 'next/server';
import {
  LEGAL_LAST_UPDATED,
  PRIVACY_POLICY_HTML,
  TERMS_OF_SERVICE_HTML,
} from '@/lib/legal-documents';

// GET - Public endpoint for the Terms of Service or Privacy Policy.
// Copy lives in lib/legal-documents.ts so the pages and this route stay in sync.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type || !['terms', 'privacy'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "terms" or "privacy"' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      content: type === 'terms' ? TERMS_OF_SERVICE_HTML : PRIVACY_POLICY_HTML,
      lastUpdated: LEGAL_LAST_UPDATED,
    });
  } catch (error) {
    console.error('Error in legal documents API:', error);
    return NextResponse.json({ content: null, lastUpdated: null });
  }
}
