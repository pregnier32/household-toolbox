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
    // Fetch user's purchased tools first to determine which custom tools they have access to
    const { data: userTools, error: userToolsError } = await supabaseServer
      .from('users_tools')
      .select('tool_id, status, trial_start_date, trial_end_date')
      .eq('user_id', user.id)
      .in('status', ['active', 'trial', 'pending_cancellation']);

    if (userToolsError) {
      console.error('Error fetching user tools:', userToolsError);
      // Continue even if this fails, just won't include custom tools
    }

    // Get list of tool IDs the user has access to (for custom tools)
    const accessibleToolIds = new Set(userTools?.map((ut) => ut.tool_id) || []);

    // Fetch all tools (excluding inactive and custom ones for regular users)
    // Custom tools will be added separately if user has access
    const { data: tools, error: toolsError } = await supabaseServer
      .from('tools')
      .select('*')
      .neq('status', 'inactive')
      .neq('status', 'custom')
      .order('created_at', { ascending: false });

    if (toolsError) {
      console.error('Error fetching tools:', toolsError);
      return NextResponse.json({ error: 'Failed to fetch tools' }, { status: 500 });
    }

    // Fetch custom tools that the user has access to
    // For superadmins, fetch ALL custom tools; for regular users, only fetch ones they have access to
    let customTools: any[] = [];
    if (user.userStatus === 'superadmin') {
      // Superadmins can see all custom tools
      const { data: customToolsData, error: customToolsError } = await supabaseServer
        .from('tools')
        .select('*')
        .eq('status', 'custom')
        .order('created_at', { ascending: false });

      if (customToolsError) {
        console.error('Error fetching custom tools:', customToolsError);
        // Continue even if this fails
      } else {
        customTools = customToolsData || [];
      }
    } else if (accessibleToolIds.size > 0) {
      // Regular users only see custom tools they have access to
      const { data: customToolsData, error: customToolsError } = await supabaseServer
        .from('tools')
        .select('*')
        .eq('status', 'custom')
        .in('id', Array.from(accessibleToolIds))
        .order('created_at', { ascending: false });

      if (customToolsError) {
        console.error('Error fetching custom tools:', customToolsError);
        // Continue even if this fails
      } else {
        customTools = customToolsData || [];
      }
    }

    // Combine regular tools with accessible custom tools
    const allTools = [...(tools || []), ...customTools];

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

    // Log tools without icons for debugging
    const toolsWithoutIcons = allTools?.filter(tool => !iconsByTool[tool.id] || Object.keys(iconsByTool[tool.id]).length === 0);
    if (toolsWithoutIcons && toolsWithoutIcons.length > 0) {
      console.log('Tools without icons:', toolsWithoutIcons.map(t => ({ id: t.id, name: t.name })));
    }

    // Check for expired trials and convert them to active
    const now = new Date().toISOString();
    await supabaseServer
      .from('users_tools')
      .update({
        status: 'active',
        updated_at: now,
      })
      .eq('user_id', user.id)
      .eq('status', 'trial')
      .lt('trial_end_date', now);

    // userTools was already fetched above, create maps for owned tools and trial info

    // Create maps for owned tools and trial info
    const ownedToolIds = new Set(userTools?.map((ut) => ut.tool_id) || []);
    const trialInfoByToolId = new Map(
      userTools?.map((ut) => [
        ut.tool_id,
        {
          status: ut.status,
          trialStartDate: ut.trial_start_date,
          trialEndDate: ut.trial_end_date,
        },
      ]) || []
    );

    // Attach icons to tools and mark if user owns them, include trial info
    const toolsWithIcons = allTools?.map((tool) => {
      const trialInfo = trialInfoByToolId.get(tool.id);
      return {
        ...tool,
        icons: iconsByTool[tool.id] || {},
        isOwned: ownedToolIds.has(tool.id),
        trialStatus: trialInfo?.status === 'trial' ? 'trial' : null,
        trialEndDate: trialInfo?.trialEndDate || null,
      };
    });

    return NextResponse.json({ tools: toolsWithIcons || [] });
  } catch (error) {
    console.error('Error in tools API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

