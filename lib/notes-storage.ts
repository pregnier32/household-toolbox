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

export function extractNotesStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${NOTES_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removeNotesStorageFiles(fileUrls: Array<string | null | undefined>, userId: string): Promise<void> {
  const paths = fileUrls.map(extractNotesStoragePath).filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;
  await supabaseServer.storage.from(NOTES_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
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
