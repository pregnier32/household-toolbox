import { NextRequest, NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { deleteUserTool } from '@/lib/user-data-deletion';
import { loadAccountPricingInputs } from '@/lib/load-account-pricing';
import { billingSchedule, removalNoticeForTool } from '@/lib/billing-cycle';
import { dropUncommittedPeriodTool, loadFrozenPeriod, loadRemovalPlan, loadSignupAt, persistScheduledRemoval } from '@/lib/billing-period-store';
import { BillingCommitmentError, deleteAfterBillingCommitment, TOOL_REMOVAL_PRESERVATION_ERROR } from '@/lib/billing-tool-removal';
import { refreshHouseholdLock } from '@/lib/billing-access';
import { isTypedRemovalConfirmation } from '@/lib/tool-access-policy';
import { runPermanentToolRemoval, ToolDataRemainsError } from '@/lib/tool-removal-run';

type EmbeddedTool = {
  id: string;
  name: string;
  tool_tip: string | null;
};

function asOwnedTool(tools: EmbeddedTool | EmbeddedTool[] | null | undefined): EmbeddedTool | null {
  if (!tools) return null;
  return Array.isArray(tools) ? tools[0] ?? null : tools;
}

function removalErrorDetail(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (error && typeof error === 'object' && 'message' in error) {
    const row = error as { code?: unknown; message?: unknown; details?: unknown };
    return [row.code, row.message, row.details].filter((part) => part != null && part !== '').join(' ');
  }
  return 'Unknown removal error';
}

function sortOwnedTools<T extends { tools?: EmbeddedTool | EmbeddedTool[] | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    (asOwnedTool(a.tools)?.name || '').localeCompare(asOwnedTool(b.tools)?.name || '', undefined, {
      sensitivity: 'base',
    })
  );
}

// GET - Fetch the household admin's active tools. A removal still in progress stays listed so it can be retried.
export async function GET() {
  // Check if user is authenticated
  const user = await getHouseholdDataSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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
      .in('status', ['active', 'removing'])
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

// DELETE - Permanently wipe one household's records and files for one tool, then drop ownership.
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
    const { toolId, confirmText } = body;

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }
    if (!isTypedRemovalConfirmation(confirmText)) {
      return NextResponse.json({
        error: 'Type delete to confirm this removal. Refresh My Tools if the confirmation box is not shown.',
      }, { status: 400 });
    }

    const { data: userTool, error: fetchError } = await supabaseServer
      .from('users_tools')
      .select('id, tool_id')
      .eq('id', toolId)
      .eq('user_id', user.id)
      .in('status', ['active', 'removing'])
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
      console.error('Tool removal stopped before data deletion:', removalErrorDetail(error));
      return NextResponse.json({ error: TOOL_REMOVAL_PRESERVATION_ERROR }, { status: 503 });
    }
    if (removal?.plan.kind === 'uncommitted' && removal.plan.dropToolId && removal.periodStart) {
      try {
        await dropUncommittedPeriodTool(user.id, removal.periodStart, removal.plan.dropToolId);
      } catch (error) {
        console.error('Non-paid billing snapshot cleanup failed; tool deletion will continue.', error);
      }
    }

    const plan = removal?.plan ?? { kind: 'schedule' as const, tools: [] };
    const preserve = async () => {
      if (!removal || removal.plan.kind !== 'schedule' || !removal.periodStart || !removal.canPersist) {
        throw new BillingCommitmentError();
      }
      await persistScheduledRemoval(user.id, removal.periodStart, removal.plan.tools, userTool.tool_id);
    };

    let deleted: { toolName: string };
    try {
      deleted = await deleteAfterBillingCommitment({
        plan,
        toolId: userTool.tool_id,
        preserve,
        deleteData: async () => {
          let toolName = 'Tool';
          let residue = { rows: 0, files: 0 };
          await runPermanentToolRemoval({
            claim: async () => {
              const claimed = await supabaseServer
                .from('users_tools')
                .update({ status: 'removing', updated_at: new Date().toISOString() })
                .eq('id', toolId)
                .eq('user_id', user.id)
                .in('status', ['active', 'removing'])
                .select('id');
              if (claimed.error) throw claimed.error;
              return claimed.data && claimed.data.length > 0 ? 'claimed' : 'missing';
            },
            deleteData: async () => {
              const wiped = await deleteUserTool(user.id, userTool.tool_id);
              toolName = wiped.toolName;
              residue = { rows: 0, files: 0 };
            },
            remaining: async () => residue,
            syncAccess: () => refreshHouseholdLock(user.id),
            dropOwnership: async () => {
              const dropped = await supabaseServer
                .from('users_tools')
                .delete()
                .eq('id', toolId)
                .eq('user_id', user.id);
              if (dropped.error) throw dropped.error;
            },
          });
          return { toolName };
        },
      });
    } catch (error) {
      if (error instanceof BillingCommitmentError || error instanceof ToolDataRemainsError) {
        console.error('Tool removal stopped before completion:', removalErrorDetail(error));
        return NextResponse.json({ error: error.message }, { status: 503 });
      }
      if (error instanceof Error && error.name === 'ToolRemovalMissing') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      console.error('Tool removal stopped before completion:', removalErrorDetail(error));
      return NextResponse.json({
        error: 'This tool could not be fully removed. Some records or files may still be there. Billing is still available. Please try again.',
      }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      toolName: deleted.toolName,
      message: `${deleted.toolName} and its saved data were permanently deleted.`,
    });
  } catch (error) {
    console.error('Error removing user tool:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to remove tool',
    }, { status: 500 });
  }
}

