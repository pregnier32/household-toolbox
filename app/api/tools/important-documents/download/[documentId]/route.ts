import { denyLockedToolAccess, denyRemovedTool } from '@/lib/billing-access';
import { NextRequest, NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { readFileDownloadBody, streamStoredObject } from '@/lib/stored-file-transfer';
import bcrypt from 'bcryptjs';
import { authorizeStoredFileRead, type StoredFileGrant } from '@/lib/storage-owner';

// POST - Download a document file. The password is in the JSON body.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const user = await getHouseholdDataSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const toolLock = await denyLockedToolAccess(user.id, user.householdRole);
  if (toolLock) return toolLock;
  const removedTool = await denyRemovedTool(user.id, 'Important Documents');
  if (removedTool) return removedTool;

  try {
    const { documentId } = await params;

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const download = await readFileDownloadBody(request);
    if (download instanceof NextResponse) return download;
    const { password, inline } = download;

    // Fetch document to verify ownership and get file info
    const { data: document, error: docError } = await supabaseServer
      .from('tools_id_documents')
      .select('file_url, file_name, file_type, user_id, requires_password_for_download, download_password_hash')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!document.file_url) {
      return NextResponse.json({ error: 'No file available for download' }, { status: 404 });
    }

    if (document.requires_password_for_download && !document.download_password_hash) {
      return NextResponse.json({ error: 'Password not set for this document' }, { status: 500 });
    }

    const relatedResult = await supabaseServer
      .from('tools_id_documents')
      .select('id, file_url, requires_password_for_download, download_password_hash')
      .eq('user_id', user.id);
    if (relatedResult.error || !relatedResult.data) {
      console.error('Error loading document file restrictions');
      return NextResponse.json({ error: 'Failed to verify document access' }, { status: 500 });
    }

    const related: StoredFileGrant[] = (relatedResult.data || [])
      .filter((row) => row.id !== documentId)
      .map((row) => ({
        recordId: row.id,
        fileReference: row.file_url,
        requiresPassword: Boolean(row.requires_password_for_download),
        passwordHash: row.download_password_hash,
      }));
    const decision = authorizeStoredFileRead({
      bucket: 'important-documents',
      ownerId: user.id,
      requested: {
        recordId: documentId,
        fileReference: document.file_url,
        requiresPassword: Boolean(document.requires_password_for_download),
        passwordHash: document.download_password_hash,
      },
      related,
      password,
      passwordMatches: (entered, hash) => bcrypt.compareSync(entered, hash),
    });
    if (!decision.ok) {
      const error = decision.error === 'Incorrect password'
        ? 'Incorrect password'
        : decision.error === 'Password required'
          ? 'Password required for download'
          : 'Invalid file path';
      return NextResponse.json({ error }, { status: decision.status });
    }
    const storagePath = decision.path;

    // Download file from Supabase Storage
    return streamStoredObject({
      bucket: 'important-documents',
      path: storagePath,
      fileName: document.file_name,
      contentType: document.file_type,
      inline,
    });
  } catch (error: any) {
    console.error('Error in POST /api/tools/important-documents/download/[documentId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
