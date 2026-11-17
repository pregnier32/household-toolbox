import { denyLockedToolAccess, denyRemovedTool } from '@/lib/billing-access';
import { NextRequest, NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { readFileDownloadBody, streamStoredObject } from '@/lib/stored-file-transfer';
import bcrypt from 'bcryptjs';
import { authorizeStoredFileRead } from '@/lib/storage-owner';
import {
  NOTES_BUCKET,
  assertNotePassword,
  isMissingRelationError,
  loadNoteFileGrants,
  loadOwnedNote,
  noteFileErrorStatus,
} from '@/lib/notes-storage';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const user = await getHouseholdDataSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const toolLock = await denyLockedToolAccess(user.id, user.householdRole);
  if (toolLock) return toolLock;
  const removedTool = await denyRemovedTool(user.id, 'Notes');
  if (removedTool) return removedTool;

  try {
    const { attachmentId } = await params;
    const download = await readFileDownloadBody(request);
    if (download instanceof NextResponse) return download;
    const { password, inline } = download;

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

    const related = await loadNoteFileGrants(user.id, attachment.id);
    const decision = authorizeStoredFileRead({
      bucket: NOTES_BUCKET,
      ownerId: user.id,
      requested: {
        recordId: note.id,
        fileReference: attachment.file_url,
        requiresPassword: Boolean(note.requires_password_for_view),
        passwordHash: note.view_password_hash,
      },
      related,
      password,
      passwordMatches: (entered, hash) => bcrypt.compareSync(entered, hash),
    });
    if (!decision.ok) {
      return NextResponse.json({ error: decision.error === 'Incorrect password' ? 'Incorrect password' : decision.error === 'Password required' ? 'Password required' : 'Invalid file path' }, { status: decision.status });
    }
    const storagePath = decision.path;

    return streamStoredObject({
      bucket: NOTES_BUCKET,
      path: storagePath,
      fileName: attachment.file_name,
      contentType: attachment.file_type,
      inline,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: noteFileErrorStatus(error) });
  }
}
