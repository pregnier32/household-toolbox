import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  END_OF_LIFE_PLANNER_BUCKET,
  extractEolStoragePath,
  isMissingRelationError,
  loadOwnedStoreRecord,
  lookupAttachmentById,
} from '@/lib/end-of-life-planner-storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { attachmentId } = await params;
    const inline = new URL(request.url).searchParams.get('inline') === '1';
    const found = await lookupAttachmentById(attachmentId, user.id);
    if ('error' in found && found.error) {
      if (isMissingRelationError(found.error)) {
        return NextResponse.json(
          { error: 'End of Life Planner attachments table is missing. Run supabase/ADD_end_of_life_planner_attachments.sql.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: 'Failed to look up attachment' }, { status: 500 });
    }
    if (!found.store || !found.attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const record = await loadOwnedStoreRecord(found.store, found.attachment.ownerId, user.id);
    if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

    const storagePath = extractEolStoragePath(found.attachment.file_url);
    if (!storagePath) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 500 });
    }

    const { data: fileData, error: downloadError } = await supabaseServer.storage
      .from(END_OF_LIFE_PLANNER_BUCKET)
      .download(storagePath);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const safeName = (found.attachment.file_name || 'attachment').replace(/["\r\n]/g, '');
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': found.attachment.file_type || 'application/octet-stream',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
