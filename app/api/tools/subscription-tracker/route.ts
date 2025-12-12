import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// Helper function to create dashboard item (calendar reminder)
async function createDashboardItem(
  userId: string,
  toolId: string,
  item: {
    title: string;
    description?: string;
    type: 'calendar_event' | 'action_item' | 'both';
    scheduled_date?: string;
    priority?: 'low' | 'medium' | 'high';
    metadata?: Record<string, any>;
  }
) {
  try {
    // First verify the tool exists
    const { data: toolData, error: toolError } = await supabaseServer
      .from('tools')
      .select('id')
      .eq('id', toolId)
      .single();
    
    if (toolError || !toolData) {
      console.error('Tool validation failed:', toolError);
      return null;
    }
    
    const insertData = {
      user_id: userId,
      tool_id: toolId,
      title: item.title,
      description: item.description || null,
      type: item.type,
      scheduled_date: item.scheduled_date || null,
      priority: null, // No priority for subscription tracker reminders
      status: 'pending',
      metadata: item.metadata || {},
    };
    
    const { data, error } = await supabaseServer
      .from('dashboard_items')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating dashboard item:', error);
      return null;
    }
    
    return data;
  } catch (error: any) {
    console.error('Exception creating dashboard item:', error);
    return null;
  }
}

// Calculate reminder date (30 days before renewal date)
function calculateReminderDate(renewalDate: string): string {
  const date = new Date(renewalDate);
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}

// GET - Fetch all subscriptions for the current user
export async function GET(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');
    const subscriptionId = searchParams.get('subscriptionId');

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    if (subscriptionId) {
      // Fetch single subscription
      const { data: subscription, error } = await supabaseServer
        .from('tools_st_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .single();

      if (error) {
        console.error('Error fetching subscription:', error);
        return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
      }

      return NextResponse.json({ subscription });
    }

    // Fetch all subscriptions for the user
    const { data: subscriptions, error } = await supabaseServer
      .from('tools_st_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('date_added', { ascending: false });

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    return NextResponse.json({ subscriptions: subscriptions || [] });
  } catch (error) {
    console.error('Error in subscription tracker GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create or update subscription
export async function POST(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { subscriptionId, toolId, subscriptionData } = body;

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    if (!subscriptionData.name || !subscriptionData.category || !subscriptionData.frequency || !subscriptionData.amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate frequency-specific fields
    if (subscriptionData.frequency === 'annual') {
      if (!subscriptionData.billed_date) {
        return NextResponse.json({ error: 'Billed date is required for annual subscriptions' }, { status: 400 });
      }
    } else {
      if (!subscriptionData.day_of_month) {
        return NextResponse.json({ error: 'Day of month is required for monthly/quarterly subscriptions' }, { status: 400 });
      }
    }

    let finalSubscriptionId = subscriptionId;
    let oldCalendarReminderId: string | null = null;
    let wasReminderEnabled = false;

    if (subscriptionId) {
      // Update existing subscription
      // First, get the current subscription to check for calendar reminder
      const { data: currentSub, error: fetchError } = await supabaseServer
        .from('tools_st_subscriptions')
        .select('calendar_reminder_id, add_reminder_to_calendar')
        .eq('id', subscriptionId)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !currentSub) {
        return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
      }

      oldCalendarReminderId = currentSub.calendar_reminder_id;
      wasReminderEnabled = currentSub.add_reminder_to_calendar || false;

      const updateData: any = {
        name: subscriptionData.name,
        category: subscriptionData.category,
        frequency: subscriptionData.frequency,
        amount: subscriptionData.amount,
        day_of_month: subscriptionData.frequency === 'annual' ? null : subscriptionData.day_of_month,
        billed_date: subscriptionData.frequency === 'annual' ? subscriptionData.billed_date : null,
        renewal_date: subscriptionData.frequency === 'annual' ? subscriptionData.renewal_date : null,
        add_reminder_to_calendar: subscriptionData.frequency === 'annual' ? (subscriptionData.add_reminder_to_calendar || false) : false,
        notes: subscriptionData.notes || null,
        is_active: subscriptionData.is_active !== undefined ? subscriptionData.is_active : true,
        date_inactivated: subscriptionData.is_active === false ? (subscriptionData.date_inactivated || new Date().toISOString().split('T')[0]) : null,
      };

      const { data: updatedSubscription, error: updateError } = await supabaseServer
        .from('tools_st_subscriptions')
        .update(updateData)
        .eq('id', subscriptionId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
      }

      // Handle calendar reminder
      const isReminderEnabled = subscriptionData.frequency === 'annual' && subscriptionData.add_reminder_to_calendar && subscriptionData.renewal_date;

      if (isReminderEnabled) {
        // Delete old reminder if it exists
        if (oldCalendarReminderId) {
          try {
            await supabaseServer
              .from('dashboard_items')
              .delete()
              .eq('id', oldCalendarReminderId);
          } catch (error) {
            console.error('Error deleting old reminder:', error);
          }
        }

        // Create new reminder
        const reminderDate = calculateReminderDate(subscriptionData.renewal_date);
        const renewalDate = new Date(subscriptionData.renewal_date);
        
        const dashboardItem = await createDashboardItem(user.id, toolId, {
          title: `${subscriptionData.name} - Renewal Reminder`,
          description: `Subscription renewal on ${renewalDate.toLocaleDateString()}. Amount: $${subscriptionData.amount.toFixed(2)}`,
          type: 'calendar_event',
          scheduled_date: reminderDate,
          metadata: {
            referenceType: 'subscription',
            referenceId: subscriptionId,
            subscriptionName: subscriptionData.name,
            renewalDate: subscriptionData.renewal_date,
          },
        });

        if (dashboardItem) {
          // Update subscription with calendar reminder ID
          await supabaseServer
            .from('tools_st_subscriptions')
            .update({ calendar_reminder_id: dashboardItem.id })
            .eq('id', subscriptionId);
        }
      } else if (oldCalendarReminderId) {
        // Delete reminder if it exists but is now disabled (frequency changed or checkbox unchecked)
        try {
          await supabaseServer
            .from('dashboard_items')
            .delete()
            .eq('id', oldCalendarReminderId);
          
          // Clear calendar_reminder_id from subscription
          await supabaseServer
            .from('tools_st_subscriptions')
            .update({ calendar_reminder_id: null })
            .eq('id', subscriptionId);
        } catch (error) {
          console.error('Error deleting reminder:', error);
        }
      }

      return NextResponse.json({ success: true, subscriptionId: finalSubscriptionId });
    } else {
      // Create new subscription
      const insertData: any = {
        user_id: user.id,
        tool_id: toolId,
        name: subscriptionData.name,
        category: subscriptionData.category,
        frequency: subscriptionData.frequency,
        amount: subscriptionData.amount,
        day_of_month: subscriptionData.frequency === 'annual' ? null : subscriptionData.day_of_month,
        billed_date: subscriptionData.frequency === 'annual' ? subscriptionData.billed_date : null,
        renewal_date: subscriptionData.frequency === 'annual' ? subscriptionData.renewal_date : null,
        add_reminder_to_calendar: subscriptionData.frequency === 'annual' ? (subscriptionData.add_reminder_to_calendar || false) : false,
        notes: subscriptionData.notes || null,
        is_active: true,
        date_added: new Date().toISOString().split('T')[0],
      };

      const { data: newSubscription, error: createError } = await supabaseServer
        .from('tools_st_subscriptions')
        .insert(insertData)
        .select()
        .single();

      if (createError) {
        console.error('Error creating subscription:', createError);
        return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
      }

      finalSubscriptionId = newSubscription.id;

      // Create calendar reminder if enabled
      if (subscriptionData.frequency === 'annual' && subscriptionData.add_reminder_to_calendar && subscriptionData.renewal_date) {
        const reminderDate = calculateReminderDate(subscriptionData.renewal_date);
        const renewalDate = new Date(subscriptionData.renewal_date);
        
        const dashboardItem = await createDashboardItem(user.id, toolId, {
          title: `${subscriptionData.name} - Renewal Reminder`,
          description: `Subscription renewal on ${renewalDate.toLocaleDateString()}. Amount: $${subscriptionData.amount.toFixed(2)}`,
          type: 'calendar_event',
          scheduled_date: reminderDate,
          metadata: {
            referenceType: 'subscription',
            referenceId: finalSubscriptionId,
            subscriptionName: subscriptionData.name,
            renewalDate: subscriptionData.renewal_date,
          },
        });

        if (dashboardItem) {
          // Update subscription with calendar reminder ID
          await supabaseServer
            .from('tools_st_subscriptions')
            .update({ calendar_reminder_id: dashboardItem.id })
            .eq('id', finalSubscriptionId);
        }
      }

      return NextResponse.json({ success: true, subscriptionId: finalSubscriptionId });
    }
  } catch (error) {
    console.error('Error saving subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a subscription
export async function DELETE(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 });
    }

    // Get subscription to check for calendar reminder
    const { data: subscription, error: fetchError } = await supabaseServer
      .from('tools_st_subscriptions')
      .select('calendar_reminder_id')
      .eq('id', subscriptionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Delete calendar reminder if it exists
    if (subscription.calendar_reminder_id) {
      try {
        await supabaseServer
          .from('dashboard_items')
          .delete()
          .eq('id', subscription.calendar_reminder_id);
      } catch (error) {
        console.error('Error deleting calendar reminder:', error);
      }
    }

    // Delete the subscription
    const { error: deleteError } = await supabaseServer
      .from('tools_st_subscriptions')
      .delete()
      .eq('id', subscriptionId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting subscription:', deleteError);
      return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

