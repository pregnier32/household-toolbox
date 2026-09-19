import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { ATTACHMENT_MAX_FILE_BYTES, isAllowedAttachmentType } from '@/lib/attachments';
import { assertCanStoreBytes, isStorageLimitError, refreshUserStorageUsage } from '@/lib/user-storage';
import {
  GOALS_TRACKING_BUCKET,
  isMissingRelationError,
  loadOwnedGoal,
  loadOwnedUpdateNote,
  mapGoalsTrackingAttachment,
  removeGoalsTrackingStorageFiles,
} from '@/lib/goals-tracking-storage';

function missingTableMessage() {
  return 'Goals Tracking attachments table is missing. Run supabase/ADD_goals_tracking_attachments.sql.';
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const toolId = (formData.get('toolId') as string | null)?.trim() || '';
    const goalId = (formData.get('goalId') as string | null)?.trim() || '';
    const noteId = (formData.get('noteId') as string | null)?.trim() || '';
    const file = formData.get('file') as File | null;

    if (!toolId || (!goalId && !noteId) || (goalId && noteId)) {
      return NextResponse.json({ error: 'Tool ID and either Goal ID or Note ID are required' }, { status: 400 });
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

    const ownerKind = goalId ? 'goal' : 'update';
    const ownerId = goalId || noteId;
    if (ownerKind === 'goal') {
      const goal = await loadOwnedGoal(ownerId, user.id, toolId);
      if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    } else {
      const note = await loadOwnedUpdateNote(ownerId, user.id, toolId);
      if (!note) return NextResponse.json({ error: 'Update not found' }, { status: 404 });
    }

    await assertCanStoreBytes(user.id, file.size);

    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folder = ownerKind === 'goal' ? 'goals' : 'updates';
    const storagePath = `${user.id}/${folder}/${ownerId}/${Date.now()}-${sanitized}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseServer.storage.from(GOALS_TRACKING_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabaseServer.storage.from(GOALS_TRACKING_BUCKET).getPublicUrl(storagePath);
    const table = ownerKind === 'goal' ? 'tools_gt_goal_attachments' : 'tools_gt_update_attachments';
    const ownerColumn = ownerKind === 'goal' ? 'goal_id' : 'note_id';
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
      await supabaseServer.storage.from(GOALS_TRACKING_BUCKET).remove([storagePath]);
      if (isMissingRelationError(insertError)) {
        return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to save attachment' }, { status: 500 });
    }

    await refreshUserStorageUsage(user.id);
    return NextResponse.json({ attachment: mapGoalsTrackingAttachment(attachment) });
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

    const { data: goalAttachment, error: goalError } = await supabaseServer
      .from('tools_gt_goal_attachments')
      .select('id, goal_id, file_url')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (goalError && !isMissingRelationError(goalError)) {
      return NextResponse.json({ error: 'Failed to look up attachment' }, { status: 500 });
    }

    if (goalAttachment) {
      const goal = await loadOwnedGoal(goalAttachment.goal_id, user.id, toolId);
      if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
      const { error: deleteError } = await supabaseServer
        .from('tools_gt_goal_attachments')
        .delete()
        .eq('id', attachmentId)
        .eq('user_id', user.id);
      if (deleteError) return NextResponse.json({ error: 'Failed to remove attachment' }, { status: 500 });
      await removeGoalsTrackingStorageFiles([goalAttachment.file_url], user.id);
      return NextResponse.json({ success: true });
    }

    const { data: updateAttachment, error: updateError } = await supabaseServer
      .from('tools_gt_update_attachments')
      .select('id, note_id, file_url')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (updateError) {
      if (isMissingRelationError(goalError) && isMissingRelationError(updateError)) {
        return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to look up attachment' }, { status: 500 });
    }
    if (!updateAttachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });

    const note = await loadOwnedUpdateNote(updateAttachment.note_id, user.id, toolId);
    if (!note) return NextResponse.json({ error: 'Update not found' }, { status: 404 });

    const { error: deleteError } = await supabaseServer
      .from('tools_gt_update_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('user_id', user.id);
    if (deleteError) return NextResponse.json({ error: 'Failed to remove attachment' }, { status: 500 });
    await removeGoalsTrackingStorageFiles([updateAttachment.file_url], user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
