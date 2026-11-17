import { denyLockedToolAccess, denyRemovedTool } from '@/lib/billing-access';
import { NextRequest, NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { streamStoredObject } from '@/lib/stored-file-transfer';
import { extractHsaStoragePath, HSA_BUCKET, isMissingRelationError, loadOwnedExpense } from '@/lib/hsa-storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const user = await getHouseholdDataSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const toolLock = await denyLockedToolAccess(user.id, user.householdRole);
  if (toolLock) return toolLock;
  const removedTool = await denyRemovedTool(user.id, 'HSA Tracker');
  if (removedTool) return removedTool;

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
        return NextResponse.json({ error: 'HSA receipts table is missing. Run supabase/archive/tools/hsa-tracker.sql.' }, { status: 500 });
      }
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const expense = await loadOwnedExpense(attachment.expense_id, user.id);
    if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    const storagePath = extractHsaStoragePath(attachment.file_url, user.id);
    if (!storagePath) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 404 });
    }

    return streamStoredObject({
      bucket: HSA_BUCKET,
      path: storagePath,
      fileName: attachment.file_name,
      contentType: attachment.file_type,
      inline,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
