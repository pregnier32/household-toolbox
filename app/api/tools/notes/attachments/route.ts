import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { isAllowedAttachmentType, ATTACHMENT_MAX_FILE_BYTES } from '@/lib/attachments';
import { assertCanStoreBytes, isStorageLimitError, refreshUserStorageUsage } from '@/lib/user-storage';
import {
  NOTES_BUCKET,
  assertNotePassword,
  isMissingRelationError,
  loadOwnedNote,
  noteFileErrorStatus,
  removeNotesStorageFiles,
} from '@/lib/notes-storage';

function mapAttachment(row: {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
}) {
  return {
    id: row.id,
    name: row.file_name,
    size: row.file_size,
    type: row.file_type,
  };
}

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const toolId = searchParams.get('toolId');
  const noteId = searchParams.get('noteId');
  if (!toolId || !noteId) {
    return NextResponse.json({ error: 'Tool ID and Note ID are required' }, { status: 400 });
  }

  const note = await loadOwnedNote(noteId, user.id, toolId);
  if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

  const { data, error } = await supabaseServer
    .from('tools_note_attachments')
    .select('id, file_name, file_size, file_type')
    .eq('note_id', noteId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingRelationError(error)) return NextResponse.json({ attachments: [] });
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 });
  }

  return NextResponse.json({ attachments: (data || []).map(mapAttachment) });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const toolId = (formData.get('toolId') as string | null)?.trim() || '';
    const noteId = (formData.get('noteId') as string | null)?.trim() || '';
    const password = (formData.get('password') as string | null) || '';
    const file = formData.get('file') as File | null;

    if (!toolId || !noteId) {
      return NextResponse.json({ error: 'Tool ID and Note ID are required' }, { status: 400 });
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

    const note = await loadOwnedNote(noteId, user.id, toolId);
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    if (note.is_active === false) {
      return NextResponse.json({ error: 'Restore this item to add or change files.' }, { status: 403 });
    }
    await assertNotePassword(note, password);
    await assertCanStoreBytes(user.id, file.size);

    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${user.id}/${noteId}/${Date.now()}-${sanitized}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseServer.storage.from(NOTES_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabaseServer.storage.from(NOTES_BUCKET).getPublicUrl(storagePath);
    const { data: attachment, error: insertError } = await supabaseServer
      .from('tools_note_attachments')
      .insert({
        note_id: noteId,
        user_id: user.id,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      })
      .select('id, file_name, file_size, file_type')
      .single();

    if (insertError || !attachment) {
      await supabaseServer.storage.from(NOTES_BUCKET).remove([storagePath]);
      if (isMissingRelationError(insertError)) {
        return NextResponse.json(
          { error: 'Notes attachments table is missing. Run supabase/ADD_notes_attachments.sql.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: 'Failed to save attachment' }, { status: 500 });
    }

    await refreshUserStorageUsage(user.id);
    return NextResponse.json({ attachment: mapAttachment(attachment) });
  } catch (error) {
    if (isStorageLimitError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 413 });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: noteFileErrorStatus(error) });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const toolId = typeof body.toolId === 'string' ? body.toolId : '';
    const attachmentId = typeof body.attachmentId === 'string' ? body.attachmentId : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!toolId || !attachmentId) {
      return NextResponse.json({ error: 'Tool ID and attachment ID are required' }, { status: 400 });
    }

    const { data: attachment, error: attachmentError } = await supabaseServer
      .from('tools_note_attachments')
      .select('id, note_id, file_url')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .single();

    if (attachmentError || !attachment) {
      if (isMissingRelationError(attachmentError)) {
        return NextResponse.json({ error: 'Notes attachments table is missing.' }, { status: 500 });
      }
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const note = await loadOwnedNote(attachment.note_id, user.id, toolId);
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    if (note.is_active === false) {
      return NextResponse.json({ error: 'Restore this item to add or change files.' }, { status: 403 });
    }
    await assertNotePassword(note, password);

    const { error: deleteError } = await supabaseServer
      .from('tools_note_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to remove attachment' }, { status: 500 });
    }

    await removeNotesStorageFiles([attachment.file_url], user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: noteFileErrorStatus(error) });
  }
}
