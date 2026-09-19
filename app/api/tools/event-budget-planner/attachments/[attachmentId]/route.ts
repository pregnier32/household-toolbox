import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  EBP_BUCKET,
  extractEbpStoragePath,
  isMissingRelationError,
  loadOwnedEvent,
  loadOwnedExpense,
} from '@/lib/ebp-storage';

type AttachmentRow = {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  event_id?: string;
  expense_id?: string;
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

    const { data: eventAttachment, error: eventError } = await supabaseServer
      .from('tools_ebp_event_attachments')
      .select('id, event_id, file_url, file_name, file_type')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (eventError && !isMissingRelationError(eventError)) {
      return NextResponse.json({ error: 'Failed to look up attachment' }, { status: 500 });
    }

    let attachment: AttachmentRow | null = eventAttachment;
    if (attachment) {
      const event = await loadOwnedEvent(attachment.event_id as string, user.id);
      if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    } else {
      const { data: expenseAttachment, error: expenseError } = await supabaseServer
        .from('tools_ebp_expense_attachments')
        .select('id, expense_id, file_url, file_name, file_type')
        .eq('id', attachmentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (expenseError) {
        if (isMissingRelationError(eventError) && isMissingRelationError(expenseError)) {
          return NextResponse.json(
            { error: 'Event Budget Planner attachments table is missing. Run supabase/ADD_event_budget_planner_attachments.sql.' },
            { status: 500 }
          );
        }
        return NextResponse.json({ error: 'Failed to look up attachment' }, { status: 500 });
      }
      if (!expenseAttachment) {
        return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
      }
      const expense = await loadOwnedExpense(expenseAttachment.expense_id, user.id);
      if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
      attachment = expenseAttachment;
    }

    const storagePath = extractEbpStoragePath(attachment.file_url);
    if (!storagePath) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 500 });
    }

    const { data: fileData, error: downloadError } = await supabaseServer.storage.from(EBP_BUCKET).download(storagePath);
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
