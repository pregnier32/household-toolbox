import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { extractHsaStoragePath, HSA_BUCKET, isMissingRelationError, loadOwnedExpense } from '@/lib/hsa-storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { attachmentId } = await params;
    const inline = new URL(request.url).searchParams.get('inline') === '1';

    const { data: attachment, error } = await supabaseServer
      .from('tools_hsa_expense_receipts')
      .select('id, expense_id, file_url, file_name, file_type')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .single();

    if (error || !attachment) {
      if (isMissingRelationError(error)) {
        return NextResponse.json({ error: 'HSA receipts table is missing. Run supabase/ADD_hsa_attachments.sql.' }, { status: 500 });
      }
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const expense = await loadOwnedExpense(attachment.expense_id, user.id);
    if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    const storagePath = extractHsaStoragePath(attachment.file_url);
    if (!storagePath) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 500 });
    }

    const { data: fileData, error: downloadError } = await supabaseServer.storage.from(HSA_BUCKET).download(storagePath);
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
