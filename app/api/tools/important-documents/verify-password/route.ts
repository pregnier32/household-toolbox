import { denyLockedToolAccess, denyRemovedTool } from '@/lib/billing-access';
import { NextRequest, NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { clearSecretAttempts, registerSecretFailure, rejectLockedSecret } from '@/lib/secret-attempt-lock';
import bcrypt from 'bcryptjs';

// POST - Verify download password for a document
export async function POST(request: NextRequest) {
  const user = await getHouseholdDataSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const toolLock = await denyLockedToolAccess(user.id, user.householdRole);
  if (toolLock) return toolLock;
  const removedTool = await denyRemovedTool(user.id, 'Important Documents');
  if (removedTool) return removedTool;

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

    const attempt = { ownerId: user.id, kind: 'document' as const, recordId: String(documentId) };
    const locked = await rejectLockedSecret(attempt);
    if (locked) return locked;

    const isValid = await bcrypt.compare(password, document.download_password_hash);
    if (!isValid) return registerSecretFailure(attempt, NextResponse.json({ valid: false }));

    await clearSecretAttempts(attempt);
    return NextResponse.json({ valid: true });
  } catch (error: any) {
    console.error('Error in POST /api/tools/important-documents/verify-password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
