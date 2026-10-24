import { NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { getUsedTrialToolIds, toolOffersTrial } from '@/lib/user-tool-entitlements';
import { dollarsToCents, formatCents } from '@/lib/account-pricing';
import { getAccountPricingState } from '@/lib/load-account-pricing';

function offerNoteForTool(input: {
  owned: boolean;
  trialEligible: boolean;
  specificallyCovered: boolean;
  freeSlotsRemaining: number;
  shelfCents: number;
}): string | null {
  if (input.owned || input.shelfCents <= 0) return null;
  if (input.trialEligible) return '7-day free trial. No payment is required to start.';
  if (input.specificallyCovered) return 'Free through a promotion.';
  if (input.freeSlotsRemaining > 0) return 'Included with your account.';
  return `Expected cost ${formatCents(input.shelfCents)} per month. Payment setup will be required later. No payment is collected now.`;
}

// GET - Fetch all tools with their icons for authenticated users
export async function GET() {
  // Check if user is authenticated
  const user = await getHouseholdDataSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const isSuperAdmin = user.userStatus === 'superadmin';
    // Owned tools, the catalog, icons, trials, and pricing do not depend on each other.
    // Icon bytes stay out of this response. A second icons read only asks which rows have stored bytes.
    const [
      userToolsResult,
      toolsResult,
      iconsResult,
      storedIconResult,
      usedTrialToolIds,
      pricing,
      superAdminCustomResult,
    ] = await Promise.all([
      supabaseServer
        .from('users_tools')
        .select('tool_id, status')
        .eq('user_id', user.id)
        .in('status', ['active', 'inactive']),
      supabaseServer
        .from('tools')
        .select('*')
        .neq('status', 'inactive')
        .neq('status', 'custom')
        .order('created_at', { ascending: false }),
      supabaseServer.from('tool_icons').select('id, tool_id, icon_type, icon_url'),
      supabaseServer.from('tool_icons').select('id').not('icon_data', 'is', null),
      getUsedTrialToolIds(user.id).catch((entitlementError: unknown) => {
        console.error('Error fetching tool entitlements:', entitlementError);
        return new Set<string>();
      }),
      getAccountPricingState(user.id, new Date()).catch((pricingError: unknown) => {
        console.error(
          'Error calculating tool offers:',
          pricingError instanceof Error ? pricingError.message : 'unknown'
        );
        return null;
      }),
      isSuperAdmin
        ? supabaseServer.from('tools').select('*').eq('status', 'custom').order('created_at', { ascending: false })
        : Promise.resolve(null),
    ]);

    const { data: userTools, error: userToolsError } = userToolsResult;
    if (userToolsError) {
      console.error('Error fetching user tools:', userToolsError);
    }

    const { data: tools, error: toolsError } = toolsResult;
    if (toolsError) {
      console.error('Error fetching tools:', toolsError);
      return NextResponse.json({ error: 'Failed to fetch tools' }, { status: 500 });
    }

    // Active and inactive both count as owned. Inactivate must not drop entitlement
    // or Store will offer Buy instead of My Tools Reactivate.
    const accessibleToolIds = new Set(userTools?.map((ut) => ut.tool_id) || []);

    let customTools: any[] = [];
    if (isSuperAdmin) {
      const customToolsError = superAdminCustomResult?.error;
      if (customToolsError) {
        console.error('Error fetching custom tools:', customToolsError);
      } else {
        customTools = superAdminCustomResult?.data || [];
      }
    } else if (accessibleToolIds.size > 0) {
      const { data: customToolsData, error: customToolsError } = await supabaseServer
        .from('tools')
        .select('*')
        .eq('status', 'custom')
        .in('id', Array.from(accessibleToolIds))
        .order('created_at', { ascending: false });

      if (customToolsError) {
        console.error('Error fetching custom tools:', customToolsError);
      } else {
        customTools = customToolsData || [];
      }
    }

    const allTools = [...(tools || []), ...customTools];

    if (iconsResult.error) {
      console.error('Error fetching tool icons:', iconsResult.error);
      return NextResponse.json({ error: 'Failed to fetch tool icons' }, { status: 500 });
    }
    if (storedIconResult.error) {
      console.error('Error fetching tool icon storage flags:', storedIconResult.error);
      return NextResponse.json({ error: 'Failed to fetch tool icons' }, { status: 500 });
    }

    const storedIconIds = new Set((storedIconResult.data || []).map((icon) => icon.id));
    const iconsByTool: Record<string, Record<string, any>> = {};
    iconsResult.data?.forEach((icon) => {
      if (!iconsByTool[icon.tool_id]) {
        iconsByTool[icon.tool_id] = {};
      }
      iconsByTool[icon.tool_id][icon.icon_type] = {
        id: icon.id,
        icon_url: icon.icon_url,
        has_icon_data: storedIconIds.has(icon.id),
      };
    });

    // Log tools without icons for debugging
    const toolsWithoutIcons = allTools?.filter(tool => !iconsByTool[tool.id] || Object.keys(iconsByTool[tool.id]).length === 0);
    if (toolsWithoutIcons && toolsWithoutIcons.length > 0) {
      console.log('Tools without icons:', toolsWithoutIcons.map(t => ({ id: t.id, name: t.name })));
    }

    // Create map for owned tools (active or inactivated — data stays)
    const ownedToolIds = new Set(userTools?.map((ut) => ut.tool_id) || []);
    const activeToolIds = new Set(
      (userTools || []).filter((ut) => ut.status === 'active').map((ut) => ut.tool_id)
    );

    const coveredToolIds = new Set(
      (pricing?.activePromotions ?? [])
        .filter((promotion) => promotion.benefitType === 'specific_tools')
        .flatMap((promotion) => promotion.toolIds),
    );

    // Attach icons to tools and mark if user owns them
    const toolsWithIcons = allTools?.map((tool) => {
      const offersTrial = toolOffersTrial(tool);
      return {
        ...tool,
        icons: iconsByTool[tool.id] || {},
        isOwned: ownedToolIds.has(tool.id),
        isActive: activeToolIds.has(tool.id),
        trialEligible: offersTrial && !usedTrialToolIds.has(tool.id),
        trialStatus: null,
        trialEndDate: null,
        offerNote: offerNoteForTool({
          owned: ownedToolIds.has(tool.id),
          trialEligible: offersTrial && !usedTrialToolIds.has(tool.id),
          specificallyCovered: coveredToolIds.has(tool.id),
          freeSlotsRemaining: pricing?.freeSlotsRemaining ?? 0,
          shelfCents: dollarsToCents(Number(tool.price) || 0),
        }),
      };
    });

    return NextResponse.json({ tools: toolsWithIcons || [] });
  } catch (error) {
    console.error('Error in tools API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

