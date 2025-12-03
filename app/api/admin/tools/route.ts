import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Fetch all tools with their icons
export async function GET() {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Fetch all tools
    const { data: tools, error: toolsError } = await supabaseServer
      .from('tools')
      .select('*')
      .order('created_at', { ascending: false });

    if (toolsError) {
      console.error('Error fetching tools:', toolsError);
      return NextResponse.json({ error: 'Failed to fetch tools' }, { status: 500 });
    }

    // Fetch all tool icons
    const { data: icons, error: iconsError } = await supabaseServer
      .from('tool_icons')
      .select('*');

    if (iconsError) {
      console.error('Error fetching tool icons:', iconsError);
      return NextResponse.json({ error: 'Failed to fetch tool icons' }, { status: 500 });
    }

    // Group icons by tool_id and icon_type
    const iconsByTool: Record<string, Record<string, any>> = {};
    icons?.forEach((icon) => {
      if (!iconsByTool[icon.tool_id]) {
        iconsByTool[icon.tool_id] = {};
      }
      iconsByTool[icon.tool_id][icon.icon_type] = {
        id: icon.id,
        icon_url: icon.icon_url,
        has_icon_data: !!icon.icon_data,
      };
    });

    // Attach icons to tools
    const toolsWithIcons = tools?.map((tool) => ({
      ...tool,
      icons: iconsByTool[tool.id] || {},
    }));

    return NextResponse.json({ tools: toolsWithIcons || [] });
  } catch (error) {
    console.error('Error in tools API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new tool
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
    const name = formData.get('name') as string;
    const description = formData.get('description') as string | null;
    const price = formData.get('price') as string;
    const status = formData.get('status') as string;

    // Validate required fields
    if (!name || !status) {
      return NextResponse.json(
        { error: 'Name and status are required' },
        { status: 400 }
      );
    }

    // Validate that description is required and not empty
    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: 'Description is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Validate status - superadmin can only set to coming_soon, available, or inactive
    // Active status is set when users purchase tools
    if (!['coming_soon', 'available', 'inactive'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: coming_soon, available, inactive. Active status is set when users purchase tools.' },
        { status: 400 }
      );
    }

    // Validate price
    const priceNum = price ? parseFloat(price) : 0;
    if (isNaN(priceNum) || priceNum < 0) {
      return NextResponse.json(
        { error: 'Price must be a non-negative number' },
        { status: 400 }
      );
    }

    // Create the tool (icons are uploaded separately)
    const { data: newTool, error: insertError } = await supabaseServer
      .from('tools')
      .insert({
        name: name.trim(),
        tool_tip: null,
        description: description.trim(),
        price: priceNum,
        status: status,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating tool:', insertError);
      return NextResponse.json({ error: 'Failed to create tool' }, { status: 500 });
    }

    return NextResponse.json({ tool: newTool }, { status: 201 });
  } catch (error) {
    console.error('Error in tools API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update an existing tool
export async function PUT(request: NextRequest) {
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
    const id = formData.get('id') as string;
    const name = formData.get('name') as string | null;
    const description = formData.get('description') as string | null;
    const price = formData.get('price') as string | null;
    const status = formData.get('status') as string | null;
    const iconFile = formData.get('icon_file') as File | null;
    const iconType = formData.get('icon_type') as string | null;

    if (!id) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    // Validate that description is required and not empty
    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: 'Description is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Get existing tool to check current status and icons
    const { data: existingTool, error: fetchError } = await supabaseServer
      .from('tools')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingTool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    // Build update object
    const updateData: any = {};

    if (name !== null) {
      updateData.name = name.trim();
    }

    // Description is always required, so always update it
    // Set tool_tip to null since it's no longer used
    updateData.tool_tip = null;
    updateData.description = description.trim();

    if (price !== null) {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return NextResponse.json(
          { error: 'Price must be a non-negative number' },
          { status: 400 }
        );
      }
      updateData.price = priceNum;
    }

    // Handle status change - require icon if status is not 'inactive'
    if (status !== null && status !== existingTool.status) {
      // Validate status - superadmin can only set to coming_soon, available, or inactive
      // Active status is set when users purchase tools
      // Allow keeping existing active status, but not setting new status to active
      if (status === 'active' && existingTool.status !== 'active') {
        return NextResponse.json(
          { error: 'Cannot set status to active. Active status is set when users purchase tools.' },
          { status: 400 }
        );
      }
      if (!['coming_soon', 'available', 'inactive', 'active'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be one of: coming_soon, available, inactive. Active status can only be kept if already set.' },
          { status: 400 }
        );
      }

      // If changing to a non-inactive status, check if icon exists for that status
      // Note: 'active' status uses 'available' icon, so check for 'available' icon if status is 'active'
      if (status !== 'inactive') {
        // Map status to icon type: 'active' status uses 'available' icon
        const iconTypeForStatus = status === 'active' ? 'available' : status;
        
        // Check if icon exists for the new status (or available icon for active status)
        // Also check for 'default' icon type as fallback since tools may use a single default icon
        const { data: existingIconForStatus } = await supabaseServer
          .from('tool_icons')
          .select('id')
          .eq('tool_id', id)
          .eq('icon_type', iconTypeForStatus)
          .single();

        // Also check for 'default' icon type as fallback
        const { data: existingDefaultIcon } = await supabaseServer
          .from('tool_icons')
          .select('id')
          .eq('tool_id', id)
          .eq('icon_type', 'default')
          .single();

        // If no icon exists (neither for the specific status nor default) and no icon file is provided, reject the status change
        if (!existingIconForStatus && !existingDefaultIcon && !iconFile) {
          return NextResponse.json(
            { error: `Cannot change status to "${status}" without an icon file. Please upload an icon file for ${iconTypeForStatus === 'available' ? 'available' : 'this'} status.` },
            { status: 400 }
          );
        }
      }

      updateData.status = status;
    }

    // Update tool
    if (Object.keys(updateData).length > 0) {
      const { data: updatedTool, error: updateError } = await supabaseServer
        .from('tools')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating tool:', updateError);
        return NextResponse.json({ error: 'Failed to update tool' }, { status: 500 });
      }
    }

    // Handle icon upload if provided
    if (iconFile && iconType) {
      // Validate icon type
      if (!['coming_soon', 'available'].includes(iconType)) {
        return NextResponse.json(
          { error: 'Invalid icon type. Must be one of: coming_soon, available' },
          { status: 400 }
        );
      }

      const arrayBuffer = await iconFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Check if icon already exists for this tool and type
      const { data: existingIcon } = await supabaseServer
        .from('tool_icons')
        .select('id')
        .eq('tool_id', id)
        .eq('icon_type', iconType)
        .single();

      if (existingIcon) {
        // Update existing icon
        const { error: iconUpdateError } = await supabaseServer
          .from('tool_icons')
          .update({
            icon_data: buffer,
          })
          .eq('id', existingIcon.id);

        if (iconUpdateError) {
          console.error('Error updating tool icon:', iconUpdateError);
          return NextResponse.json({ error: 'Failed to update icon' }, { status: 500 });
        }
      } else {
        // Insert new icon
        const { error: iconInsertError } = await supabaseServer
          .from('tool_icons')
          .insert({
            tool_id: id,
            icon_type: iconType,
            icon_data: buffer,
          });

        if (iconInsertError) {
          console.error('Error creating tool icon:', iconInsertError);
          return NextResponse.json({ error: 'Failed to upload icon' }, { status: 500 });
        }
      }
    }

    // Fetch updated tool with icons
    const { data: finalTool } = await supabaseServer
      .from('tools')
      .select('*')
      .eq('id', id)
      .single();

    return NextResponse.json({ tool: finalTool });
  } catch (error) {
    console.error('Error in tools API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a tool
export async function DELETE(request: NextRequest) {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    // Delete tool (icons will be cascade deleted due to ON DELETE CASCADE)
    const { error } = await supabaseServer
      .from('tools')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting tool:', error);
      return NextResponse.json({ error: 'Failed to delete tool' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in tools API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

