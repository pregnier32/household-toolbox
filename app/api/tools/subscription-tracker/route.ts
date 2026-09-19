import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

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

