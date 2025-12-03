import { supabaseServer } from '@/lib/supabaseServer';

/**
 * Calculate billing period dates based on billing day of month
 */
export function calculateBillingPeriod(billingDay: number, referenceDate?: Date): {
  start: Date;
  end: Date;
  billingDate: Date;
} {
  const now = referenceDate || new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // Calculate the billing date for the current month
  const thisMonthBilling = new Date(currentYear, currentMonth, billingDay);
  thisMonthBilling.setHours(0, 0, 0, 0);
  
  const nowStartOfDay = new Date(now);
  nowStartOfDay.setHours(0, 0, 0, 0);
  
  let billingDate: Date;
  let periodStart: Date;
  let periodEnd: Date;
  
  if (nowStartOfDay >= thisMonthBilling) {
    // We've passed this month's billing date, so use next month
    billingDate = new Date(currentYear, currentMonth + 1, billingDay);
    periodStart = new Date(currentYear, currentMonth, billingDay);
    periodEnd = new Date(currentYear, currentMonth + 1, billingDay);
    periodEnd.setDate(periodEnd.getDate() - 1); // End date is day before next billing
  } else {
    // This month's billing date is in the future
    billingDate = thisMonthBilling;
    periodStart = new Date(currentYear, currentMonth - 1, billingDay);
    periodEnd = new Date(currentYear, currentMonth, billingDay);
    periodEnd.setDate(periodEnd.getDate() - 1); // End date is day before billing
  }
  
  billingDate.setHours(0, 0, 0, 0);
  periodStart.setHours(0, 0, 0, 0);
  periodEnd.setHours(23, 59, 59, 999);
  
  return { start: periodStart, end: periodEnd, billingDate };
}

/**
 * Get user's billing day from their oldest active/trial tool
 */
export async function getUserBillingDay(userId: string): Promise<number | null> {
  const { data: tools, error } = await supabaseServer
    .from('users_tools')
    .select('created_at, trial_end_date, status')
    .eq('user_id', userId)
    .in('status', ['active', 'trial'])
    .order('created_at', { ascending: true })
    .limit(1);
  
  if (error || !tools || tools.length === 0) {
    return null;
  }
  
  const oldestTool = tools[0];
  let billingDate: Date;
  
  if (oldestTool.status === 'trial' && oldestTool.trial_end_date) {
    billingDate = new Date(oldestTool.trial_end_date);
  } else {
    const createdDate = new Date(oldestTool.created_at);
    billingDate = new Date(createdDate);
    billingDate.setDate(billingDate.getDate() + 7); // 7 days after creation
  }
  
  return billingDate.getDate();
}

/**
 * Sync a user's billing_active records based on their current users_tools
 */
export async function syncUserBillingActive(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get user's billing day
    const billingDay = await getUserBillingDay(userId);
    if (!billingDay) {
      // No active tools, clear all billing_active records for this user
      await supabaseServer
        .from('billing_active')
        .delete()
        .eq('user_id', userId);
      return { success: true };
    }
    
    // Calculate billing period
    const { start, end, billingDate } = calculateBillingPeriod(billingDay);
    
    // Get all active/trial tools for user
    const { data: userTools, error: toolsError } = await supabaseServer
      .from('users_tools')
      .select(`
        id,
        tool_id,
        price,
        status,
        trial_end_date,
        tools (
          name
        )
      `)
      .eq('user_id', userId)
      .in('status', ['active', 'trial']);
    
    if (toolsError) {
      console.error('Error fetching user tools:', toolsError);
      return { success: false, error: 'Failed to fetch user tools' };
    }
    
    if (!userTools || userTools.length === 0) {
      // No active tools, clear billing_active
      await supabaseServer
        .from('billing_active')
        .delete()
        .eq('user_id', userId);
      return { success: true };
    }
    
    // Get platform fee setting
    const { data: platformFeeSetting, error: feeError } = await supabaseServer
      .from('site_settings')
      .select('value')
      .eq('key', 'platform_fee')
      .single();
    
    const platformFee = platformFeeSetting?.value && typeof platformFeeSetting.value === 'object' && 'amount' in platformFeeSetting.value
      ? Number(platformFeeSetting.value.amount)
      : 5.00;
    
    // Check if user should be charged platform fee (has at least one active/trial tool)
    const shouldChargePlatformFee = userTools.length > 0;
    
    // Start transaction: Delete existing billing_active for this user and period
    await supabaseServer
      .from('billing_active')
      .delete()
      .eq('user_id', userId)
      .eq('billing_period_start', start.toISOString().split('T')[0])
      .eq('billing_period_end', end.toISOString().split('T')[0]);
    
    // Insert tool subscription records
    const toolRecords = userTools
      .filter(tool => {
        // For trial tools, only include if trial ends before or on billing date
        if (tool.status === 'trial' && tool.trial_end_date) {
          const trialEnd = new Date(tool.trial_end_date);
          trialEnd.setHours(0, 0, 0, 0);
          return trialEnd <= billingDate;
        }
        // Include all active tools
        return tool.status === 'active';
      })
      .map(tool => {
        const toolData = tool.tools as { name: string }[] | null;
        const toolName = toolData && toolData.length > 0 ? toolData[0].name : 'Unknown Tool';
        return {
          user_id: userId,
          billing_period_start: start.toISOString().split('T')[0],
          billing_period_end: end.toISOString().split('T')[0],
          billing_date: billingDate.toISOString().split('T')[0],
          item_type: 'tool_subscription' as const,
          tool_id: tool.tool_id,
          tool_name: toolName,
          amount: Number(tool.price),
          status: 'pending' as const,
          users_tools_id: tool.id,
        };
      });
    
    // Insert platform fee if applicable
    const billingRecords: Array<{
      user_id: string;
      billing_period_start: string;
      billing_period_end: string;
      billing_date: string;
      item_type: 'tool_subscription' | 'platform_fee';
      tool_id: string | null;
      tool_name: string | null;
      amount: number;
      status: 'pending';
      users_tools_id: string | null;
    }> = [...toolRecords];
    if (shouldChargePlatformFee) {
      billingRecords.push({
        user_id: userId,
        billing_period_start: start.toISOString().split('T')[0],
        billing_period_end: end.toISOString().split('T')[0],
        billing_date: billingDate.toISOString().split('T')[0],
        item_type: 'platform_fee' as const,
        tool_id: null,
        tool_name: null,
        amount: platformFee,
        status: 'pending' as const,
        users_tools_id: null,
      });
    }
    
    // Insert all billing records
    if (billingRecords.length > 0) {
      const { error: insertError } = await supabaseServer
        .from('billing_active')
        .insert(billingRecords);
      
      if (insertError) {
        console.error('Error inserting billing records:', insertError);
        return { success: false, error: 'Failed to insert billing records' };
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error syncing user billing:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Remove billing_active records for a specific users_tools_id
 */
export async function removeToolBillingRecords(userId: string, usersToolsId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Remove tool subscription records
    const { error } = await supabaseServer
      .from('billing_active')
      .delete()
      .eq('user_id', userId)
      .eq('users_tools_id', usersToolsId);
    
    if (error) {
      console.error('Error removing billing records:', error);
      return { success: false, error: 'Failed to remove billing records' };
    }
    
    // Re-sync to update platform fee if needed
    return await syncUserBillingActive(userId);
  } catch (error) {
    console.error('Error removing tool billing records:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

