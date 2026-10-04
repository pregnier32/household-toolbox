import { NextRequest, NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { deleteUserTool } from '@/lib/user-data-deletion';
import { loadAccountPricingInputs } from '@/lib/load-account-pricing';
import { billingSchedule, removalNoticeForTool } from '@/lib/billing-cycle';
import { dropUncommittedPeriodTool, loadFrozenPeriod, loadRemovalPlan, loadSignupAt, persistScheduledRemoval } from '@/lib/billing-period-store';
import { BillingCommitmentError, deleteAfterBillingCommitment, TOOL_REMOVAL_PRESERVATION_ERROR } from '@/lib/billing-tool-removal';

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

    const signupAt = await loadSignupAt(user.id);
    const pricing = signupAt ? (await loadAccountPricingInputs([user.id])).get(user.id) : undefined;
    const now = new Date();
    const schedule = signupAt ? billingSchedule(signupAt, now) : null;
    const frozen = signupAt && pricing && schedule?.periodStart
      ? (await loadFrozenPeriod(user.id, schedule.periodStart)).frozen
      : null;
    return NextResponse.json({
      tools: sortOwnedTools(userTools || []).map((row) => {
        const owned = asOwnedTool(row.tools);
        const removalNotice = signupAt && pricing && owned
          ? removalNoticeForTool(pricing, signupAt, now, owned.id, frozen)
          : null;
        return {
          ...row,
          tools: owned,
          removalNotice,
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

    const now = new Date();
    let removal: Awaited<ReturnType<typeof loadRemovalPlan>> | null = null;
    try {
      const signupAt = await loadSignupAt(user.id);
      const pricing = signupAt ? (await loadAccountPricingInputs([user.id])).get(user.id) : undefined;
      removal = signupAt && pricing
        ? await loadRemovalPlan(pricing, signupAt, now, userTool.tool_id)
        : null;
    } catch (error) {
      console.error('Tool removal stopped before data deletion:', error);
      return NextResponse.json({ error: TOOL_REMOVAL_PRESERVATION_ERROR }, { status: 503 });
    }
    if (removal?.plan.kind === 'uncommitted' && removal.plan.dropToolId && removal.periodStart) {
      try {
        await dropUncommittedPeriodTool(user.id, removal.periodStart, removal.plan.dropToolId);
      } catch (error) {
        console.error('Non-paid billing snapshot cleanup failed; tool deletion will continue.', error);
      }
    }

    let deleted;
    try {
      deleted = await deleteAfterBillingCommitment({
        plan: removal?.plan ?? { kind: 'schedule', tools: [] },
        toolId: userTool.tool_id,
        preserve: async () => {
          if (!removal || removal.plan.kind !== 'schedule' || !removal.periodStart || !removal.canPersist) {
            throw new BillingCommitmentError();
          }
          await persistScheduledRemoval(user.id, removal.periodStart, removal.plan.tools, userTool.tool_id);
        },
        deleteData: () => deleteUserTool(user.id, userTool.tool_id),
      });
    } catch (error) {
      if (!(error instanceof BillingCommitmentError)) throw error;
      console.error('Tool removal stopped before data deletion:', error);
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

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

