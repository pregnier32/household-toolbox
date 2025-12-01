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
    const iconName = formData.get('icon_name') as string | null;
    const iconType = formData.get('icon_type') as string | null;

    if (!toolId || !iconName || !iconType) {
      return NextResponse.json(
        { error: 'Tool ID, icon name, and icon type are required' },
        { status: 400 }
      );
    }

    // Validate icon type - now accept 'default' as well for single icon per tool
    if (!['coming_soon', 'available', 'default'].includes(iconType)) {
      return NextResponse.json(
        { error: 'Invalid icon type. Must be one of: coming_soon, available, default' },
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

    // Check if this icon name is already used by another tool
    // Only check if it's not a URL (URLs can be reused)
    const isIconName = !iconName.startsWith('http://') && !iconName.startsWith('https://') && !iconName.startsWith('/');
    
    if (isIconName) {
      const { data: existingIconWithSameName, error: checkError } = await supabaseServer
        .from('tool_icons')
        .select('tool_id, id')
        .eq('icon_url', iconName)
        .neq('tool_id', toolId); // Exclude the current tool

      if (checkError) {
        console.error('Error checking for duplicate icon:', checkError);
        return NextResponse.json({ error: 'Failed to check for duplicate icon' }, { status: 500 });
      }

      if (existingIconWithSameName && existingIconWithSameName.length > 0) {
        return NextResponse.json(
          { error: `This icon is already being used by another tool. Please select a different icon.` },
          { status: 400 }
        );
      }
    }

    // Store icon name in icon_url field (we'll use this to distinguish from actual URLs)
    // If it starts with http://, https://, or /, it's a URL, otherwise it's an icon name
    const iconUrl = iconName;

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
          icon_url: iconUrl,
          icon_data: null, // Clear icon_data when using icon name
        })
        .eq('id', existingIcon.id);

      if (updateError) {
        console.error('Error updating tool icon:', updateError);
        // Check if it's a constraint violation for icon_type
        if (updateError.code === '23514' || updateError.message?.includes('icon_type')) {
          return NextResponse.json({ 
            error: 'Database constraint error: The icon_type "default" is not allowed. Please update your database to allow "default" as a valid icon_type.' 
          }, { status: 500 });
        }
        return NextResponse.json({ 
          error: `Failed to update icon: ${updateError.message || 'Unknown error'}` 
        }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Icon updated successfully' });
    } else {
      // Insert new icon
      const { error: insertError } = await supabaseServer
        .from('tool_icons')
        .insert({
          tool_id: toolId,
          icon_type: iconType,
          icon_url: iconUrl,
          icon_data: null, // No binary data when using icon name
        });

      if (insertError) {
        console.error('Error creating tool icon:', insertError);
        // Check if it's a constraint violation for icon_type
        if (insertError.code === '23514' || insertError.message?.includes('icon_type')) {
          return NextResponse.json({ 
            error: 'Database constraint error: The icon_type "default" is not allowed. Please update your database to allow "default" as a valid icon_type.' 
          }, { status: 500 });
        }
        return NextResponse.json({ 
          error: `Failed to save icon: ${insertError.message || 'Unknown error'}` 
        }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Icon saved successfully' });
    }
  } catch (error) {
    console.error('Error in tools icons API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

