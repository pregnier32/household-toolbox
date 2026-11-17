import { denyLockedToolAccess, denyRemovedTool } from '@/lib/billing-access';
import { NextRequest, NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { streamStoredObject } from '@/lib/stored-file-transfer';
import {
  extractShoppingListStoragePath,
  isMissingRelationError,
  loadOwnedList,
  SHOPPING_LIST_BUCKET,
} from '@/lib/shopping-list-storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const user = await getHouseholdDataSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const toolLock = await denyLockedToolAccess(user.id, user.householdRole);
  if (toolLock) return toolLock;
  const removedTool = await denyRemovedTool(user.id, 'Shopping List');
  if (removedTool) return removedTool;

  try {
    const { attachmentId } = await params;
    const inline = new URL(request.url).searchParams.get('inline') === '1';

    const { data: attachment, error } = await supabaseServer
      .from('tools_sl_list_attachments')
      .select('id, list_id, file_url, file_name, file_type')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .single();

    if (error || !attachment) {
      if (isMissingRelationError(error)) {
        return NextResponse.json(
          { error: 'Shopping List attachments table is missing. Run supabase/archive/tools/shopping-list.sql.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const list = await loadOwnedList(attachment.list_id, user.id);
    if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 });

    const storagePath = extractShoppingListStoragePath(attachment.file_url, user.id);
    if (!storagePath) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 404 });
    }

    return streamStoredObject({
      bucket: SHOPPING_LIST_BUCKET,
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
