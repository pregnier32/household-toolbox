import { NextRequest, NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { deleteUserTool } from '@/lib/user-data-deletion';
import { formatCents } from '@/lib/account-pricing';
import { getAccountPricingState } from '@/lib/load-account-pricing';

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
  const user = await getHouseholdDataSession();

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

    let labels = new Map<string, { accessLabel: string; expectedMonthlyCents: number; daysRemaining: number | null }>();
    let expectedMonthlyCents = 0;
    try {
      const pricing = await getAccountPricingState(user.id, new Date());
      expectedMonthlyCents = pricing?.effectiveMonthlyCents ?? 0;
      labels = new Map((pricing?.tools ?? []).map((tool) => [tool.toolId, {
        accessLabel: tool.inTrial && tool.daysRemaining != null
          ? `Trial — ${tool.daysRemaining} day${tool.daysRemaining === 1 ? '' : 's'} remaining`
          : tool.accessLabel,
        expectedMonthlyCents: tool.expectedMonthlyCents,
        daysRemaining: tool.daysRemaining,
      }]));
    } catch (pricingError) {
      console.error('My tools pricing failed', pricingError instanceof Error ? pricingError.message : 'unknown');
    }

    return NextResponse.json({
      expectedMonthlyCost: formatCents(expectedMonthlyCents),
      tools: sortOwnedTools(userTools || []).map((row) => {
        const owned = asOwnedTool(row.tools);
        const label = owned ? labels.get(owned.id) : undefined;
        return {
          ...row,
          tools: owned,
          accessLabel: row.status === 'inactive' ? 'Inactive' : (label?.accessLabel || 'Included'),
          expectedAmount: row.status === 'inactive' ? null : formatCents(label?.expectedMonthlyCents ?? 0),
        };
      }),
    });
  } catch (error) {
    console.error('Error in my-tools API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Permanently wipe one tool's records/files, then drop ownership
export async function DELETE(request: NextRequest) {
  const user = await getHouseholdDataSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.householdRole !== 'admin') {
    return NextResponse.json({ error: 'Only the household Admin can remove tools.' }, { status: 403 });
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

