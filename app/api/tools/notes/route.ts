import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import bcrypt from 'bcryptjs';

// Constants
const SALT_ROUNDS = 10; // For password hashing

// GET - Fetch all notes and tags for the current user
export async function GET(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');
    const noteId = searchParams.get('noteId');

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    if (noteId) {
      // Fetch single note with tags and security questions
      const { data: note, error: noteError } = await supabaseServer
        .from('tools_note_notes')
        .select('*')
        .eq('id', noteId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .single();

      if (noteError || !note) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }

      // Fetch tags for this note
      const { data: noteTags } = await supabaseServer
        .from('tools_note_note_tags')
        .select('tag_id')
        .eq('note_id', noteId);

      const tagIds = noteTags?.map(nt => nt.tag_id) || [];

      // Fetch security questions (without answer hashes for security)
      const { data: securityQuestions } = await supabaseServer
        .from('tools_note_security_questions')
        .select('question_id')
        .eq('note_id', noteId);

      return NextResponse.json({
        note: {
          ...note,
          tags: tagIds,
          securityQuestions: securityQuestions?.map(sq => ({ questionId: sq.question_id })) || []
        }
      });
    }

    // Fetch all notes for the user
    const { data: notes, error: notesError } = await supabaseServer
      .from('tools_note_notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('date_added', { ascending: false });

    if (notesError) {
      console.error('Error fetching notes:', notesError);
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    // Fetch all tags for the user
    const { data: tags, error: tagsError } = await supabaseServer
      .from('tools_note_tags')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('name', { ascending: true });

    if (tagsError) {
      console.error('Error fetching tags:', tagsError);
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }

    // Fetch note tags relationships
    const noteIds = notes?.map(note => note.id) || [];
    let noteTagsMap: Record<string, string[]> = {};
    
    if (noteIds.length > 0) {
      const { data: noteTags } = await supabaseServer
        .from('tools_note_note_tags')
        .select('note_id, tag_id')
        .in('note_id', noteIds);

      noteTags?.forEach(nt => {
        if (!noteTagsMap[nt.note_id]) {
          noteTagsMap[nt.note_id] = [];
        }
        noteTagsMap[nt.note_id].push(nt.tag_id);
      });
    }

    // Transform notes to include tags
    const notesWithTags = notes?.map(note => ({
      ...note,
      tags: noteTagsMap[note.id] || []
    })) || [];

    return NextResponse.json({
      notes: notesWithTags,
      tags: tags || []
    });
  } catch (error: any) {
    console.error('Error in GET /api/tools/notes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create or update a note
export async function POST(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { toolId, noteId, action, noteName, createdDate, note, requiresPasswordForView, viewPassword, selectedTags, securityQuestions } = body;

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    // Handle delete action
    if (action === 'delete' && noteId) {
      const { error } = await supabaseServer
        .from('tools_note_notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error deleting note:', error);
        return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Handle inactivate action
    if (action === 'inactivate' && noteId) {
      const { error } = await supabaseServer
        .from('tools_note_notes')
        .update({
          is_active: false,
          date_inactivated: new Date().toISOString().split('T')[0]
        })
        .eq('id', noteId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error inactivating note:', error);
        return NextResponse.json({ error: 'Failed to inactivate note' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Handle activate action
    if (action === 'activate' && noteId) {
      const { error } = await supabaseServer
        .from('tools_note_notes')
        .update({
          is_active: true,
          date_inactivated: null
        })
        .eq('id', noteId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error activating note:', error);
        return NextResponse.json({ error: 'Failed to activate note' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Handle create or update
    // Validation
    if (!noteName || !createdDate || !note) {
      return NextResponse.json({ error: 'Note name, created date, and note content are required' }, { status: 400 });
    }

    if (!selectedTags || selectedTags.length === 0) {
      return NextResponse.json({ error: 'At least one tag is required' }, { status: 400 });
    }

    // Hash password if provided
    let viewPasswordHash: string | null = null;
    if (requiresPasswordForView && viewPassword) {
      viewPasswordHash = await bcrypt.hash(viewPassword, SALT_ROUNDS);
    }

    // Validate security questions if password protection is enabled
    if (requiresPasswordForView && action === 'create') {
      if (!securityQuestions || securityQuestions.length !== 3) {
        return NextResponse.json(
          { error: 'Exactly 3 security questions are required when password protection is enabled' },
          { status: 400 }
        );
      }

      // Check for duplicate questions
      const questionIds = securityQuestions.map((sq: { questionId: string; answer: string }) => sq.questionId);
      if (new Set(questionIds).size !== questionIds.length) {
        return NextResponse.json(
          { error: 'Security questions must be unique' },
          { status: 400 }
        );
      }

      // Validate all questions have answers
      if (securityQuestions.some((sq: { questionId: string; answer: string }) => !sq.questionId || !sq.answer.trim())) {
        return NextResponse.json(
          { error: 'All security questions must have answers' },
          { status: 400 }
        );
      }
    }

    if (action === 'create' || !noteId) {
      // Create new note
      const { data: newNote, error: noteError } = await supabaseServer
        .from('tools_note_notes')
        .insert({
          user_id: user.id,
          tool_id: toolId,
          note_name: noteName.trim(),
          created_date: createdDate,
          note: note.trim(),
          requires_password_for_view: requiresPasswordForView || false,
          view_password_hash: viewPasswordHash,
          is_active: true
        })
        .select()
        .single();

      if (noteError) {
        console.error('Error creating note:', noteError);
        return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
      }

      // Create note-tag relationships
      if (selectedTags.length > 0) {
        const noteTagInserts = selectedTags.map((tagId: string) => ({
          note_id: newNote.id,
          tag_id: tagId
        }));

        const { error: tagError } = await supabaseServer
          .from('tools_note_note_tags')
          .insert(noteTagInserts);

        if (tagError) {
          console.error('Error creating note tags:', tagError);
          // Continue even if tag creation fails - note is already created
        }
      }

      // Create security questions if password protection is enabled
      if (requiresPasswordForView && securityQuestions && securityQuestions.length === 3) {
        const securityQuestionInserts = await Promise.all(
          securityQuestions.map(async (sq: { questionId: string; answer: string }) => ({
            note_id: newNote.id,
            question_id: sq.questionId,
            answer_hash: await bcrypt.hash(sq.answer.trim().toLowerCase(), SALT_ROUNDS)
          }))
        );

        const { error: sqError } = await supabaseServer
          .from('tools_note_security_questions')
          .insert(securityQuestionInserts);

        if (sqError) {
          console.error('Error creating security questions:', sqError);
          // Continue even if security question creation fails
        }
      }

      return NextResponse.json({ note: newNote });
    } else {
      // Update existing note
      const updateData: any = {
        note_name: noteName.trim(),
        created_date: createdDate,
        note: note.trim(),
        requires_password_for_view: requiresPasswordForView || false
      };

      // Update password if provided
      if (requiresPasswordForView && viewPassword) {
        updateData.view_password_hash = await bcrypt.hash(viewPassword, SALT_ROUNDS);
      } else if (!requiresPasswordForView) {
        updateData.view_password_hash = null;
      }

      const { data: updatedNote, error: updateError } = await supabaseServer
        .from('tools_note_notes')
        .update(updateData)
        .eq('id', noteId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating note:', updateError);
        return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
      }

      // Update tags - delete old ones and insert new ones
      await supabaseServer
        .from('tools_note_note_tags')
        .delete()
        .eq('note_id', noteId);

      if (selectedTags.length > 0) {
        const noteTagInserts = selectedTags.map((tagId: string) => ({
          note_id: noteId,
          tag_id: tagId
        }));

        await supabaseServer
          .from('tools_note_note_tags')
          .insert(noteTagInserts);
      }

      // Update security questions if password is being changed
      if (requiresPasswordForView && viewPassword && securityQuestions && securityQuestions.length === 3) {
        // Delete old security questions
        await supabaseServer
          .from('tools_note_security_questions')
          .delete()
          .eq('note_id', noteId);

        // Insert new ones
        const securityQuestionInserts = await Promise.all(
          securityQuestions.map(async (sq: { questionId: string; answer: string }) => ({
            note_id: noteId,
            question_id: sq.questionId,
            answer_hash: await bcrypt.hash(sq.answer.trim().toLowerCase(), SALT_ROUNDS)
          }))
        );

        await supabaseServer
          .from('tools_note_security_questions')
          .insert(securityQuestionInserts);
      }

      return NextResponse.json({ note: updatedNote });
    }
  } catch (error: any) {
    console.error('Error in POST /api/tools/notes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a note
export async function DELETE(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('noteId');
    const toolId = searchParams.get('toolId');

    if (!noteId || !toolId) {
      return NextResponse.json({ error: 'Note ID and Tool ID are required' }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from('tools_note_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', user.id)
      .eq('tool_id', toolId);

    if (error) {
      console.error('Error deleting note:', error);
      return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/tools/notes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
