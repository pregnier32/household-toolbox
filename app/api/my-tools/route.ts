import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { deleteUserTool } from '@/lib/user-data-deletion';

type EmbeddedTool = {
  id: string;
  name: string;
  tool_tip: string | null;
};

function asOwnedTool(tools: EmbeddedTool | EmbeddedTool[] | null | undefined): EmbeddedTool | null {
  if (!tools) return null;
  return Array.isArray(tools) ? tools[0] ?? null : tools;
}

function sortOwnedTools<T extends { tools?: EmbeddedTool | EmbeddedTool[] | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    (asOwnedTool(a.tools)?.name || '').localeCompare(asOwnedTool(b.tools)?.name || '', undefined, {
      sensitivity: 'base',
    })
  );
}

// GET - Fetch current user's owned tools (active and inactive) with details
export async function GET() {
  // Check if user is authenticated
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Owned tools stay listed after Inactivate so Reactivate is available (not Store Buy).
    const { data: userTools, error } = await supabaseServer
      .from('users_tools')
      .select(`
        id,
        price,
        status,
        created_at,
        updated_at,
        tools (
          id,
          name,
          tool_tip
        )
      `)
      .eq('user_id', user.id)
      .in('status', ['active', 'inactive'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user tools:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch tools',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      tools: sortOwnedTools(userTools || []).map((row) => ({
        ...row,
        tools: asOwnedTool(row.tools),
      })),
    });
  } catch (error) {
    console.error('Error in my-tools API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Permanently wipe one tool's records/files, then drop ownership
export async function DELETE(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { toolId } = body;

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    const { data: userTool, error: fetchError } = await supabaseServer
      .from('users_tools')
      .select('id, tool_id')
      .eq('id', toolId)
      .eq('user_id', user.id)
      .in('status', ['active', 'inactive'])
      .single();

    if (fetchError || !userTool) {
      return NextResponse.json({ error: 'Tool not found or access denied' }, { status: 404 });
    }

    const deleted = await deleteUserTool(user.id, userTool.tool_id);

    // Drop current ownership only. user_tool_entitlements stays so a later
    // re-buy cannot start another 7-day trial.

    const { error: ownershipError } = await supabaseServer
      .from('users_tools')
      .delete()
      .eq('id', toolId)
      .eq('user_id', user.id);

    if (ownershipError) {
      console.error('Error removing tool ownership after data wipe:', ownershipError);
      return NextResponse.json({ error: 'Failed to remove tool' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      toolName: deleted.toolName,
      message: `${deleted.toolName} was removed`,
    });
  } catch (error) {
    console.error('Error removing user tool:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to remove tool',
    }, { status: 500 });
  }
}

