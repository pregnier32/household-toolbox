import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { ATTACHMENT_MAX_FILE_BYTES, isAllowedAttachmentType } from '@/lib/attachments';
import { assertCanStoreBytes, isStorageLimitError, refreshUserStorageUsage } from '@/lib/user-storage';
import {
  isMissingRelationError,
  loadOwnedList,
  mapShoppingListAttachment,
  SHOPPING_LIST_BUCKET,
  removeShoppingListStorageFiles,
} from '@/lib/shopping-list-storage';

function missingTableMessage() {
  return 'Shopping List attachments table is missing. Run supabase/ADD_shopping_list_attachments.sql.';
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const toolId = (formData.get('toolId') as string | null)?.trim() || '';
    const listId = (formData.get('listId') as string | null)?.trim() || '';
    const file = formData.get('file') as File | null;

    if (!toolId || !listId) {
      return NextResponse.json({ error: 'Tool ID and List ID are required' }, { status: 400 });
    }
    if (!file || file.size <= 0) {
      return NextResponse.json({ error: 'A file is required' }, { status: 400 });
    }
    if (file.size > ATTACHMENT_MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File size cannot exceed 10MB' }, { status: 400 });
    }
    if (!isAllowedAttachmentType(file.type, file.name)) {
      return NextResponse.json({ error: 'That file type is not allowed' }, { status: 400 });
    }

    const list = await loadOwnedList(listId, user.id, toolId);
    if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 });
    await assertCanStoreBytes(user.id, file.size);

    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${user.id}/${listId}/${Date.now()}-${sanitized}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseServer.storage.from(SHOPPING_LIST_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabaseServer.storage.from(SHOPPING_LIST_BUCKET).getPublicUrl(storagePath);
    const { data: attachment, error: insertError } = await supabaseServer
      .from('tools_sl_list_attachments')
      .insert({
        list_id: listId,
        user_id: user.id,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      })
      .select('id, file_name, file_size, file_type')
      .single();

    if (insertError || !attachment) {
      await supabaseServer.storage.from(SHOPPING_LIST_BUCKET).remove([storagePath]);
      if (isMissingRelationError(insertError)) {
        return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to save attachment' }, { status: 500 });
    }

    await refreshUserStorageUsage(user.id);
    return NextResponse.json({ attachment: mapShoppingListAttachment(attachment) });
  } catch (error) {
    if (isStorageLimitError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 413 });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const toolId = typeof body.toolId === 'string' ? body.toolId : '';
    const attachmentId = typeof body.attachmentId === 'string' ? body.attachmentId : '';

    if (!toolId || !attachmentId) {
      return NextResponse.json({ error: 'Tool ID and attachment ID are required' }, { status: 400 });
    }

    const { data: attachment, error: attachmentError } = await supabaseServer
      .from('tools_sl_list_attachments')
      .select('id, list_id, file_url')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .single();

    if (attachmentError || !attachment) {
      if (isMissingRelationError(attachmentError)) {
        return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
      }
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const list = await loadOwnedList(attachment.list_id, user.id, toolId);
    if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 });

    const { error: deleteError } = await supabaseServer
      .from('tools_sl_list_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to remove attachment' }, { status: 500 });
    }

    await removeShoppingListStorageFiles([attachment.file_url], user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
