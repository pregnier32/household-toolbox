import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  GOALS_TRACKING_BUCKET,
  extractGoalsTrackingStoragePath,
  isMissingRelationError,
  loadOwnedGoal,
  loadOwnedUpdateNote,
} from '@/lib/goals-tracking-storage';

type AttachmentRow = {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  goal_id?: string;
  note_id?: string;
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

    const { data: goalAttachment, error: goalError } = await supabaseServer
      .from('tools_gt_goal_attachments')
      .select('id, goal_id, file_url, file_name, file_type')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (goalError && !isMissingRelationError(goalError)) {
      return NextResponse.json({ error: 'Failed to look up attachment' }, { status: 500 });
    }

    let attachment: AttachmentRow | null = goalAttachment;
    if (attachment) {
      const goal = await loadOwnedGoal(attachment.goal_id as string, user.id);
      if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    } else {
      const { data: updateAttachment, error: updateError } = await supabaseServer
        .from('tools_gt_update_attachments')
        .select('id, note_id, file_url, file_name, file_type')
        .eq('id', attachmentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (updateError) {
        if (isMissingRelationError(goalError) && isMissingRelationError(updateError)) {
          return NextResponse.json(
            { error: 'Goals Tracking attachments table is missing. Run supabase/ADD_goals_tracking_attachments.sql.' },
            { status: 500 }
          );
        }
        return NextResponse.json({ error: 'Failed to look up attachment' }, { status: 500 });
      }
      if (!updateAttachment) {
        return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
      }
      const note = await loadOwnedUpdateNote(updateAttachment.note_id, user.id);
      if (!note) return NextResponse.json({ error: 'Update not found' }, { status: 404 });
      attachment = updateAttachment;
    }

    const storagePath = extractGoalsTrackingStoragePath(attachment.file_url);
    if (!storagePath) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 500 });
    }

    const { data: fileData, error: downloadError } = await supabaseServer.storage
      .from(GOALS_TRACKING_BUCKET)
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
