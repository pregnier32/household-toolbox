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
      .from('tools_ab_tags')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching tags:', error);
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }

    return NextResponse.json({ tags: tags || [] });
  } catch (error: unknown) {
    console.error('Error in GET /api/tools/address-book/tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create or update a tag, or inactivate/activate
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

    if (action === 'inactivate' && tagId) {
      const { error } = await supabaseServer
        .from('tools_ab_tags')
        .update({
          is_active: false,
          date_inactivated: new Date().toISOString().split('T')[0],
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

    if (action === 'activate' && tagId) {
      const { error } = await supabaseServer
        .from('tools_ab_tags')
        .update({
          is_active: true,
          date_inactivated: null,
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

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }

    const trimmedName = String(name).trim();

    if (tagId) {
      const { data: existingTag } = await supabaseServer
        .from('tools_ab_tags')
        .select('id')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .eq('name', trimmedName)
        .neq('id', tagId)
        .maybeSingle();

      if (existingTag) {
        return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 400 });
      }

      const { data: updatedTag, error: updateError } = await supabaseServer
        .from('tools_ab_tags')
        .update({ name: trimmedName })
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
    }

    const { data: existingTag } = await supabaseServer
      .from('tools_ab_tags')
      .select('id')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .eq('name', trimmedName)
      .maybeSingle();

    if (existingTag) {
      return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 400 });
    }

    const { data: newTag, error: insertError } = await supabaseServer
      .from('tools_ab_tags')
      .insert({
        user_id: user.id,
        tool_id: toolId,
        name: trimmedName,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating tag:', insertError);
      return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
    }

    return NextResponse.json({ tag: newTag });
  } catch (error: unknown) {
    console.error('Error in POST /api/tools/address-book/tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a tag (only when unused)
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

    const { data: addressTags, error: checkError } = await supabaseServer
      .from('tools_ab_address_tags')
      .select('address_id')
      .eq('tag_id', tagId)
      .limit(1);

    if (checkError) {
      console.error('Error checking tag usage:', checkError);
      return NextResponse.json({ error: 'Failed to check tag usage' }, { status: 500 });
    }

    if (addressTags && addressTags.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete tag that is in use by addresses' },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from('tools_ab_tags')
      .delete()
      .eq('id', tagId)
      .eq('user_id', user.id)
      .eq('tool_id', toolId);

    if (error) {
      console.error('Error deleting tag:', error);
      return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/tools/address-book/tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
