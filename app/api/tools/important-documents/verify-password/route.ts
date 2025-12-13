import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import bcrypt from 'bcryptjs';

// POST - Verify download password for a document
export async function POST(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { documentId, password } = body;

    if (!documentId || !password) {
      return NextResponse.json({ error: 'Document ID and password are required' }, { status: 400 });
    }

    // Fetch document with password hash
    const { data: document, error: docError } = await supabaseServer
      .from('tools_id_documents')
      .select('download_password_hash, requires_password_for_download')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!document.requires_password_for_download) {
      return NextResponse.json({ error: 'Document does not require a password' }, { status: 400 });
    }

    if (!document.download_password_hash) {
      return NextResponse.json({ error: 'Password not set for this document' }, { status: 400 });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, document.download_password_hash);

    return NextResponse.json({ valid: isValid });
  } catch (error: any) {
    console.error('Error in POST /api/tools/important-documents/verify-password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
