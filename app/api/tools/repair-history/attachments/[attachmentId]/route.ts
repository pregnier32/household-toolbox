import { denyLockedToolAccess, denyRemovedTool } from '@/lib/billing-access';
import { NextRequest, NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { streamStoredObject } from '@/lib/stored-file-transfer';
import {
  extractRepairHistoryStoragePath,
  isMissingRelationError,
  loadOwnedRecord,
  REPAIR_HISTORY_BUCKET,
} from '@/lib/repair-history-storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const user = await getHouseholdDataSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const toolLock = await denyLockedToolAccess(user.id, user.householdRole);
  if (toolLock) return toolLock;
  const removedTool = await denyRemovedTool(user.id, 'Repair History');
  if (removedTool) return removedTool;

  try {
    const { attachmentId } = await params;
    const inline = new URL(request.url).searchParams.get('inline') === '1';

    const { data: attachment, error } = await supabaseServer
      .from('tools_rh_record_attachments')
      .select('id, record_id, file_url, file_name, file_type')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .single();

    if (error || !attachment) {
      if (isMissingRelationError(error)) {
        return NextResponse.json(
          { error: 'Repair History attachments table is missing. Run supabase/archive/tools/repair-history.sql.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const record = await loadOwnedRecord(attachment.record_id, user.id);
    if (!record) return NextResponse.json({ error: 'Repair record not found' }, { status: 404 });

    const storagePath = extractRepairHistoryStoragePath(attachment.file_url, user.id);
    if (!storagePath) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 404 });
    }

    return streamStoredObject({
      bucket: REPAIR_HISTORY_BUCKET,
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
