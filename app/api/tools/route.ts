import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Fetch all tools with their icons for authenticated users
export async function GET() {
  // Check if user is authenticated
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all tools (excluding inactive ones for regular users)
    const { data: tools, error: toolsError } = await supabaseServer
      .from('tools')
      .select('*')
      .neq('status', 'inactive')
      .order('created_at', { ascending: false });

    if (toolsError) {
      console.error('Error fetching tools:', toolsError);
      return NextResponse.json({ error: 'Failed to fetch tools' }, { status: 500 });
    }

    // Fetch all tool icons - explicitly select fields we need
    // Note: We don't select icon_data here to avoid large payloads, we'll check if it exists
    const { data: icons, error: iconsError } = await supabaseServer
      .from('tool_icons')
      .select('id, tool_id, icon_type, icon_url, icon_data');

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
      // Check if icon_data exists (it might be null, undefined, or a Buffer)
      const hasIconData = icon.icon_data !== null && icon.icon_data !== undefined;
      iconsByTool[icon.tool_id][icon.icon_type] = {
        id: icon.id,
        icon_url: icon.icon_url,
        has_icon_data: hasIconData,
      };
    });

    // Fetch user's purchased tools
    const { data: userTools, error: userToolsError } = await supabaseServer
      .from('users_tools')
      .select('tool_id, status')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (userToolsError) {
      console.error('Error fetching user tools:', userToolsError);
      // Continue even if this fails, just won't mark tools as owned
    }

    // Create a set of tool IDs that the user owns
    const ownedToolIds = new Set(userTools?.map((ut) => ut.tool_id) || []);

    // Attach icons to tools and mark if user owns them
    const toolsWithIcons = tools?.map((tool) => ({
      ...tool,
      icons: iconsByTool[tool.id] || {},
      isOwned: ownedToolIds.has(tool.id),
    }));

    return NextResponse.json({ tools: toolsWithIcons || [] });
  } catch (error) {
    console.error('Error in tools API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

