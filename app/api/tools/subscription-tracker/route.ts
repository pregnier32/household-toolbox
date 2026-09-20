import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  attachmentsBySubscriptionIds,
  deleteSubscriptionStorageFiles,
} from '@/lib/subscription-tracker-storage';
import { CALENDAR_SOURCE_SUBSCRIPTION } from '@/lib/calendarPins';
import {
  deleteCalendarPinsForSources,
  getPinnedSourceIds,
  syncCalendarPin,
} from '@/lib/calendarPinsServer';

function canPinSubscription(frequency: string, billedDate?: string | null, dayOfMonth?: number | null): boolean {
  if (frequency === 'monthly') return Boolean(dayOfMonth);
  if (frequency === 'annual') return Boolean(billedDate);
  return false;
}

async function attachDashboardFlags<T extends { id: string }>(
  subscriptions: T[],
  userId: string,
  toolId?: string
): Promise<(T & { addToDashboard: boolean })[]> {
  const { ids } = await getPinnedSourceIds({
    userId,
    sourceType: CALENDAR_SOURCE_SUBSCRIPTION,
    sourceIds: subscriptions.map((subscription) => subscription.id),
    toolId,
  });
  return subscriptions.map((subscription) => ({
    ...subscription,
    addToDashboard: ids.has(subscription.id),
  }));
}

async function applySubscriptionPin({
  userId,
  toolId,
  subscriptionId,
  pinned,
  frequency,
  billedDate,
  dayOfMonth,
}: {
  userId: string;
  toolId: string;
  subscriptionId: string;
  pinned: boolean;
  frequency: string;
  billedDate?: string | null;
  dayOfMonth?: number | null;
}): Promise<{ error: string | null; pinned: boolean }> {
  const wantsPin = pinned && canPinSubscription(frequency, billedDate, dayOfMonth);
  const pinResult = await syncCalendarPin({
    userId,
    toolId,
    sourceType: CALENDAR_SOURCE_SUBSCRIPTION,
    sourceId: subscriptionId,
    pinned: wantsPin,
  });
  return { error: pinResult.error, pinned: wantsPin };
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

      const attachmentsBySubscription = await attachmentsBySubscriptionIds([subscription.id], user.id);
      const [withFlag] = await attachDashboardFlags(
        [{ ...subscription, attachments: attachmentsBySubscription[subscription.id] || [] }],
        user.id,
        toolId
      );
      return NextResponse.json({ subscription: withFlag });
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

    const rows = subscriptions || [];
    const attachmentsBySubscription = await attachmentsBySubscriptionIds(
      rows.map((row) => row.id),
      user.id
    );

    return NextResponse.json({
      subscriptions: await attachDashboardFlags(
        rows.map((row) => ({
          ...row,
          attachments: attachmentsBySubscription[row.id] || [],
        })),
        user.id,
        toolId
      ),
    });
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
    const { subscriptionId, toolId, subscriptionData, addToDashboard } = body;
    const hasPinFlag = typeof addToDashboard === 'boolean';

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

    if (subscriptionId) {
      const updateData = {
        name: subscriptionData.name,
        category: subscriptionData.category,
        frequency: subscriptionData.frequency,
        amount: subscriptionData.amount,
        day_of_month: subscriptionData.frequency === 'annual' ? null : subscriptionData.day_of_month,
        billed_date: subscriptionData.frequency === 'annual' ? subscriptionData.billed_date : null,
        renewal_date: subscriptionData.frequency === 'annual' ? subscriptionData.renewal_date : null,
        notes: subscriptionData.notes || null,
        is_active: subscriptionData.is_active !== undefined ? subscriptionData.is_active : true,
        date_inactivated: subscriptionData.is_active === false ? (subscriptionData.date_inactivated || new Date().toISOString().split('T')[0]) : null,
      };

      const { error: updateError } = await supabaseServer
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

      if (hasPinFlag) {
        const pinResult = await applySubscriptionPin({
          userId: user.id,
          toolId,
          subscriptionId,
          pinned: addToDashboard === true,
          frequency: subscriptionData.frequency,
          billedDate: subscriptionData.frequency === 'annual' ? subscriptionData.billed_date : null,
          dayOfMonth: subscriptionData.frequency === 'annual' ? null : subscriptionData.day_of_month,
        });
        if (pinResult.error) {
          return NextResponse.json(
            { error: 'Subscription saved, but failed to update the dashboard calendar' },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({ success: true, subscriptionId });
    }

    const insertData = {
      user_id: user.id,
      tool_id: toolId,
      name: subscriptionData.name,
      category: subscriptionData.category,
      frequency: subscriptionData.frequency,
      amount: subscriptionData.amount,
      day_of_month: subscriptionData.frequency === 'annual' ? null : subscriptionData.day_of_month,
      billed_date: subscriptionData.frequency === 'annual' ? subscriptionData.billed_date : null,
      renewal_date: subscriptionData.frequency === 'annual' ? subscriptionData.renewal_date : null,
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

    if (hasPinFlag || addToDashboard === true) {
      const pinResult = await applySubscriptionPin({
        userId: user.id,
        toolId,
        subscriptionId: newSubscription.id,
        pinned: addToDashboard === true,
        frequency: subscriptionData.frequency,
        billedDate: subscriptionData.frequency === 'annual' ? subscriptionData.billed_date : null,
        dayOfMonth: subscriptionData.frequency === 'annual' ? null : subscriptionData.day_of_month,
      });
      if (pinResult.error) {
        return NextResponse.json(
          { error: 'Subscription saved, but failed to add it to the dashboard calendar' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, subscriptionId: newSubscription.id });
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

    const { data: subscription, error: fetchError } = await supabaseServer
      .from('tools_st_subscriptions')
      .select('id')
      .eq('id', subscriptionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    await deleteCalendarPinsForSources({
      userId: user.id,
      sourceType: CALENDAR_SOURCE_SUBSCRIPTION,
      sourceIds: [subscriptionId],
    });
    await deleteSubscriptionStorageFiles(subscriptionId, user.id);

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

