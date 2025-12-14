import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import bcrypt from 'bcryptjs';

// POST - Verify view password for a note
export async function POST(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { noteId, password } = body;

    if (!noteId || !password) {
      return NextResponse.json({ error: 'Note ID and password are required' }, { status: 400 });
    }

    // Fetch note with password hash
    const { data: note, error: noteError } = await supabaseServer
      .from('tools_note_notes')
      .select('view_password_hash, requires_password_for_view')
      .eq('id', noteId)
      .eq('user_id', user.id)
      .single();

    if (noteError || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (!note.requires_password_for_view) {
      return NextResponse.json({ error: 'Note does not require a password' }, { status: 400 });
    }

    if (!note.view_password_hash) {
      return NextResponse.json({ error: 'Password not set for this note' }, { status: 400 });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, note.view_password_hash);

    return NextResponse.json({ valid: isValid });
  } catch (error: any) {
    console.error('Error in POST /api/tools/notes/verify-password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
