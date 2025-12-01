import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// POST - Upload or update an icon for a tool
export async function POST(request: NextRequest) {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const toolId = formData.get('tool_id') as string;
    const iconFile = formData.get('icon_file') as File | null;
    const iconType = formData.get('icon_type') as string | null;

    if (!toolId || !iconFile || !iconType) {
      return NextResponse.json(
        { error: 'Tool ID, icon file, and icon type are required' },
        { status: 400 }
      );
    }

    // Validate icon type
    if (!['coming_soon', 'available', 'active'].includes(iconType)) {
      return NextResponse.json(
        { error: 'Invalid icon type. Must be one of: coming_soon, available, active' },
        { status: 400 }
      );
    }

    // Verify tool exists
    const { data: tool, error: toolError } = await supabaseServer
      .from('tools')
      .select('id')
      .eq('id', toolId)
      .single();

    if (toolError || !tool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    // Convert file to buffer
    const arrayBuffer = await iconFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check if icon already exists for this tool and type
    const { data: existingIcon } = await supabaseServer
      .from('tool_icons')
      .select('id')
      .eq('tool_id', toolId)
      .eq('icon_type', iconType)
      .single();

    if (existingIcon) {
      // Update existing icon
      const { error: updateError } = await supabaseServer
        .from('tool_icons')
        .update({
          icon_data: buffer,
        })
        .eq('id', existingIcon.id);

      if (updateError) {
        console.error('Error updating tool icon:', updateError);
        return NextResponse.json({ error: 'Failed to update icon' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Icon updated successfully' });
    } else {
      // Insert new icon
      const { error: insertError } = await supabaseServer
        .from('tool_icons')
        .insert({
          tool_id: toolId,
          icon_type: iconType,
          icon_data: buffer,
        });

      if (insertError) {
        console.error('Error creating tool icon:', insertError);
        return NextResponse.json({ error: 'Failed to upload icon' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Icon uploaded successfully' });
    }
  } catch (error) {
    console.error('Error in tools icons API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

