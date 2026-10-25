import { authorizeStoredFileRead, objectPathForOwner, type StoredFileGrant } from '@/lib/storage-owner';
import bcrypt from 'bcryptjs';
import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';

export const NOTES_BUCKET = 'notes';

type NoteAccessRow = {
  id: string;
  is_active: boolean | null;
  requires_password_for_view: boolean | null;
  view_password_hash: string | null;
};

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function extractNotesStoragePath(fileUrl: string | null | undefined, ownerId: string): string | null {
  return objectPathForOwner(fileUrl, NOTES_BUCKET, ownerId);
}

export async function removeNotesStorageFiles(fileUrls: Array<string | null | undefined>, userId: string): Promise<void> {
  const paths = fileUrls.map((fileUrl) => extractNotesStoragePath(fileUrl, userId)).filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;
  await supabaseServer.storage.from(NOTES_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

export async function loadNoteFileGrants(ownerId: string, exceptAttachmentId: string): Promise<StoredFileGrant[]> {
  const attachments = await supabaseServer
    .from('tools_note_attachments')
    .select('id, note_id, file_url')
    .eq('user_id', ownerId);
  if (attachments.error || !attachments.data) {
    throw attachments.error || new Error('Failed to load note file restrictions');
  }
  const rows = (attachments.data || []).filter((row) => row.id !== exceptAttachmentId);
  const noteIds = [...new Set(rows.map((row) => row.note_id).filter(Boolean))];
  if (noteIds.length === 0) return [];

  const notes = await supabaseServer
    .from('tools_note_notes')
    .select('id, requires_password_for_view, view_password_hash')
    .eq('user_id', ownerId)
    .in('id', noteIds);
  if (notes.error || !notes.data) throw notes.error || new Error('Failed to load note file restrictions');
  const byId = new Map((notes.data || []).map((note) => [note.id, note]));
  return rows.flatMap((row) => {
    const note = byId.get(row.note_id);
    if (!note) return [];
    return [{
      recordId: note.id,
      fileReference: row.file_url,
      requiresPassword: Boolean(note.requires_password_for_view),
      passwordHash: note.view_password_hash,
    }];
  });
}

export async function loadOwnedNote(noteId: string, userId: string, toolId?: string | null): Promise<NoteAccessRow | null> {
  let query = supabaseServer
    .from('tools_note_notes')
    .select('id, is_active, requires_password_for_view, view_password_hash')
    .eq('id', noteId)
    .eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

export async function assertNotePassword(note: NoteAccessRow, password?: string | null): Promise<void> {
  if (!note.requires_password_for_view) return;
  const entered = password?.trim() || '';
  if (!entered) {
    const error = new Error('Password required');
    (error as Error & { status: number }).status = 403;
    throw error;
  }
  if (!note.view_password_hash) {
    const error = new Error('Password not set for this note');
    (error as Error & { status: number }).status = 500;
    throw error;
  }
  const isValid = await bcrypt.compare(entered, note.view_password_hash);
  if (!isValid) {
    const error = new Error('Incorrect password');
    (error as Error & { status: number }).status = 403;
    throw error;
  }
}

export function noteFileErrorStatus(error: unknown): number {
  if (error && typeof error === 'object' && 'status' in error && typeof (error as { status?: number }).status === 'number') {
    return (error as { status: number }).status;
  }
  return 500;
}
