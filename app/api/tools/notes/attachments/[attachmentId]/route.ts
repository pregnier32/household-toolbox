import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  NOTES_BUCKET,
  assertNotePassword,
  extractNotesStoragePath,
  isMissingRelationError,
  loadOwnedNote,
  noteFileErrorStatus,
} from '@/lib/notes-storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { attachmentId } = await params;
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');
    const inline = searchParams.get('inline') === '1';

    const { data: attachment, error } = await supabaseServer
      .from('tools_note_attachments')
      .select('id, note_id, file_url, file_name, file_type, file_size')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .single();

    if (error || !attachment) {
      if (isMissingRelationError(error)) {
        return NextResponse.json({ error: 'Notes attachments table is missing.' }, { status: 500 });
      }
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const note = await loadOwnedNote(attachment.note_id, user.id);
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    await assertNotePassword(note, password);

    const storagePath = extractNotesStoragePath(attachment.file_url);
    if (!storagePath) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 500 });
    }

    const { data: fileData, error: downloadError } = await supabaseServer.storage
      .from(NOTES_BUCKET)
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
    return NextResponse.json({ error: message }, { status: noteFileErrorStatus(error) });
  }
}
