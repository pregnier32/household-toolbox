import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  CLEANING_SCHEDULE_BUCKET,
  extractCleaningStoragePath,
  isMissingRelationError,
  loadOwnedCompletion,
  loadOwnedItem,
} from '@/lib/cleaning-storage';

type AttachmentRow = {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  item_id?: string;
  completion_id?: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { attachmentId } = await params;
    const inline = new URL(request.url).searchParams.get('inline') === '1';

    const { data: itemAttachment, error: itemError } = await supabaseServer
      .from('tools_cs_item_attachments')
      .select('id, item_id, file_url, file_name, file_type')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (itemError && !isMissingRelationError(itemError)) {
      return NextResponse.json({ error: 'Failed to look up attachment' }, { status: 500 });
    }

    let attachment: AttachmentRow | null = itemAttachment;
    if (attachment) {
      const item = await loadOwnedItem(attachment.item_id as string, user.id);
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    } else {
      const { data: completionAttachment, error: completionError } = await supabaseServer
        .from('tools_cs_completion_attachments')
        .select('id, completion_id, file_url, file_name, file_type')
        .eq('id', attachmentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (completionError) {
        if (isMissingRelationError(itemError) && isMissingRelationError(completionError)) {
          return NextResponse.json(
            { error: 'Cleaning Schedule attachments table is missing. Run supabase/ADD_cleaning_schedule_attachments.sql.' },
            { status: 500 }
          );
        }
        return NextResponse.json({ error: 'Failed to look up attachment' }, { status: 500 });
      }
      if (!completionAttachment) {
        return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
      }
      const completion = await loadOwnedCompletion(completionAttachment.completion_id, user.id);
      if (!completion) return NextResponse.json({ error: 'Completion not found' }, { status: 404 });
      attachment = completionAttachment;
    }

    const storagePath = extractCleaningStoragePath(attachment.file_url);
    if (!storagePath) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 500 });
    }

    const { data: fileData, error: downloadError } = await supabaseServer.storage
      .from(CLEANING_SCHEDULE_BUCKET)
      .download(storagePath);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const safeName = (attachment.file_name || 'attachment').replace(/["\r\n]/g, '');
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': attachment.file_type || 'application/octet-stream',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
