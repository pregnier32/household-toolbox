import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import bcrypt from 'bcryptjs';

// GET - Download a document file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { documentId } = await params;

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Get password from query parameter if provided
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');

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

    // Verify password if required
    if (document.requires_password_for_download) {
      if (!password) {
        return NextResponse.json({ error: 'Password required for download' }, { status: 403 });
      }

      if (!document.download_password_hash) {
        return NextResponse.json({ error: 'Password not set for this document' }, { status: 500 });
      }

      const isValid = await bcrypt.compare(password, document.download_password_hash);
      if (!isValid) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
      }
    }

    // Extract storage path from the file URL
    // The URL format is: https://[project].supabase.co/storage/v1/object/public/important-documents/[path]
    // Or: https://[project].supabase.co/storage/v1/object/sign/important-documents/[path]
    let storagePath: string;
    
    try {
      const url = new URL(document.file_url);
      // Extract path after 'important-documents/'
      const pathMatch = url.pathname.match(/important-documents\/(.+)$/);
      if (pathMatch) {
        storagePath = pathMatch[1];
      } else {
        // If URL parsing fails, try to extract from the stored URL directly
        // The storage path should be in format: userId/timestamp-filename
        // We stored it as: ${user.id}/${Date.now()}-${sanitizedFileName}
        // So we can try to extract it from the URL
        const segments = url.pathname.split('/');
        const importantDocsIndex = segments.indexOf('important-documents');
        if (importantDocsIndex !== -1 && segments[importantDocsIndex + 1]) {
          storagePath = segments.slice(importantDocsIndex + 1).join('/');
        } else {
          throw new Error('Could not extract storage path from URL');
        }
      }
    } catch (urlError) {
      console.error('Error parsing file URL:', urlError);
      return NextResponse.json({ error: 'Invalid file URL format' }, { status: 500 });
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseServer
      .storage
      .from('important-documents')
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error('Error downloading file from storage:', downloadError);
      return NextResponse.json(
        { error: 'Failed to download file from storage' },
        { status: 500 }
      );
    }

    // Convert the downloaded data to a buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Return the file with appropriate headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': document.file_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${document.file_name || 'document'}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/tools/important-documents/download/[documentId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
