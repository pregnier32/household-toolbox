import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Fetch all tags for the current user
export async function GET(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    const { data: tags, error } = await supabaseServer
      .from('tools_id_tags')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching tags:', error);
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }

    return NextResponse.json({ tags: tags || [] });
  } catch (error: any) {
    console.error('Error in GET /api/tools/important-documents/tags:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create or update a tag
export async function POST(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tagId, toolId, name, action } = body;

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    // Handle inactivate action
    if (action === 'inactivate' && tagId) {
      const { error } = await supabaseServer
        .from('tools_id_tags')
        .update({
          is_active: false,
          date_inactivated: new Date().toISOString().split('T')[0]
        })
        .eq('id', tagId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error inactivating tag:', error);
        return NextResponse.json({ error: 'Failed to inactivate tag' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Handle activate action
    if (action === 'activate' && tagId) {
      const { error } = await supabaseServer
        .from('tools_id_tags')
        .update({
          is_active: true,
          date_inactivated: null
        })
        .eq('id', tagId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error activating tag:', error);
        return NextResponse.json({ error: 'Failed to activate tag' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // For create/update operations, name is required
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }

    if (tagId) {
      // Update existing tag
      // Check for duplicate names (excluding current tag)
      const { data: existingTag } = await supabaseServer
        .from('tools_id_tags')
        .select('id')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .eq('name', name.trim())
        .neq('id', tagId)
        .single();

      if (existingTag) {
        return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 400 });
      }

      const { data: updatedTag, error: updateError } = await supabaseServer
        .from('tools_id_tags')
        .update({ name: name.trim() })
        .eq('id', tagId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating tag:', updateError);
        return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
      }

      return NextResponse.json({ tag: updatedTag });
    } else {
      // Create new tag
      // Check for duplicate names
      const { data: existingTag } = await supabaseServer
        .from('tools_id_tags')
        .select('id')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .eq('name', name.trim())
        .single();

      if (existingTag) {
        return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 400 });
      }

      const { data: newTag, error: insertError } = await supabaseServer
        .from('tools_id_tags')
        .insert({
          user_id: user.id,
          tool_id: toolId,
          name: name.trim(),
          is_active: true
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating tag:', insertError);
        return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
      }

      return NextResponse.json({ tag: newTag });
    }
  } catch (error: any) {
    console.error('Error in POST /api/tools/important-documents/tags:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a tag
export async function DELETE(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get('tagId');
    const toolId = searchParams.get('toolId');

    if (!tagId || !toolId) {
      return NextResponse.json({ error: 'Tag ID and Tool ID are required' }, { status: 400 });
    }

    // Check if tag is used by any documents
    const { data: documentTags, error: checkError } = await supabaseServer
      .from('tools_id_document_tags')
      .select('document_id')
      .eq('tag_id', tagId)
      .limit(1);

    if (checkError) {
      console.error('Error checking tag usage:', checkError);
      return NextResponse.json({ error: 'Failed to check tag usage' }, { status: 500 });
    }

    if (documentTags && documentTags.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete tag that is in use by documents' },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from('tools_id_tags')
      .delete()
      .eq('id', tagId)
      .eq('user_id', user.id)
      .eq('tool_id', toolId);

    if (error) {
      console.error('Error deleting tag:', error);
      return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/tools/important-documents/tags:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
