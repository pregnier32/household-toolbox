import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { ATTACHMENT_MAX_FILE_BYTES, isAllowedAttachmentType } from '@/lib/attachments';
import { assertCanStoreBytes, isStorageLimitError, refreshUserStorageUsage } from '@/lib/user-storage';
import {
  HOME_MAINTENANCE_SCHEDULE_BUCKET,
  isMissingRelationError,
  loadOwnedCompletion,
  loadOwnedItem,
  mapHmsAttachment,
  removeHmsStorageFiles,
} from '@/lib/home-maintenance-storage';

function missingTableMessage() {
  return 'Home Maintenance Schedule attachments table is missing. Run supabase/ADD_home_maintenance_schedule_attachments.sql.';
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const toolId = (formData.get('toolId') as string | null)?.trim() || '';
    const itemId = (formData.get('itemId') as string | null)?.trim() || '';
    const completionId = (formData.get('completionId') as string | null)?.trim() || '';
    const file = formData.get('file') as File | null;

    if (!toolId || (!itemId && !completionId) || (itemId && completionId)) {
      return NextResponse.json({ error: 'Tool ID and either Item ID or Completion ID are required' }, { status: 400 });
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

    const ownerKind = itemId ? 'item' : 'completion';
    const ownerId = itemId || completionId;
    if (ownerKind === 'item') {
      const item = await loadOwnedItem(ownerId, user.id, toolId);
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    } else {
      const completion = await loadOwnedCompletion(ownerId, user.id, toolId);
      if (!completion) return NextResponse.json({ error: 'Completion not found' }, { status: 404 });
    }

    await assertCanStoreBytes(user.id, file.size);

    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folder = ownerKind === 'item' ? 'items' : 'completions';
    const storagePath = `${user.id}/${folder}/${ownerId}/${Date.now()}-${sanitized}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseServer.storage.from(HOME_MAINTENANCE_SCHEDULE_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabaseServer.storage.from(HOME_MAINTENANCE_SCHEDULE_BUCKET).getPublicUrl(storagePath);
    const table = ownerKind === 'item' ? 'tools_hms_item_attachments' : 'tools_hms_completion_attachments';
    const ownerColumn = ownerKind === 'item' ? 'item_id' : 'completion_id';
    const { data: attachment, error: insertError } = await supabaseServer
      .from(table)
      .insert({
        [ownerColumn]: ownerId,
        user_id: user.id,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      })
      .select('id, file_name, file_size, file_type')
      .single();

    if (insertError || !attachment) {
      await supabaseServer.storage.from(HOME_MAINTENANCE_SCHEDULE_BUCKET).remove([storagePath]);
      if (isMissingRelationError(insertError)) {
        return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to save attachment' }, { status: 500 });
    }

    await refreshUserStorageUsage(user.id);
    return NextResponse.json({ attachment: mapHmsAttachment(attachment) });
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

    const { data: itemAttachment, error: itemError } = await supabaseServer
      .from('tools_hms_item_attachments')
      .select('id, item_id, file_url')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (itemError && !isMissingRelationError(itemError)) {
      return NextResponse.json({ error: 'Failed to look up attachment' }, { status: 500 });
    }

    if (itemAttachment) {
      const item = await loadOwnedItem(itemAttachment.item_id, user.id, toolId);
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

      const { error: deleteError } = await supabaseServer
        .from('tools_hms_item_attachments')
        .delete()
        .eq('id', attachmentId)
        .eq('user_id', user.id);

      if (deleteError) {
        return NextResponse.json({ error: 'Failed to remove attachment' }, { status: 500 });
      }

      await removeHmsStorageFiles([itemAttachment.file_url], user.id);
      return NextResponse.json({ success: true });
    }

    const { data: completionAttachment, error: completionError } = await supabaseServer
      .from('tools_hms_completion_attachments')
      .select('id')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (completionError && !isMissingRelationError(completionError)) {
      return NextResponse.json({ error: 'Failed to look up attachment' }, { status: 500 });
    }
    if (completionAttachment) {
      return NextResponse.json({ error: 'Completion files cannot be changed.' }, { status: 403 });
    }
    if (isMissingRelationError(itemError) && isMissingRelationError(completionError)) {
      return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
    }

    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
