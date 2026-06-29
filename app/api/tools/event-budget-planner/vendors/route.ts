import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

type VendorFields = {
  name?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  serviceProvided?: string;
  notes?: string;
};

function buildVendorRow(fields: VendorFields) {
  return {
    name: (fields.name ?? '').trim(),
    contact_person: (fields.contactPerson ?? '').trim(),
    phone: (fields.phone ?? '').trim(),
    email: (fields.email ?? '').trim(),
    service_provided: (fields.serviceProvided ?? '').trim(),
    notes: (fields.notes ?? '').trim(),
  };
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { vendorId, toolId, action, name, contactPerson, phone, email, serviceProvided, notes } = body;

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    if (action === 'inactivate' && vendorId) {
      const { error } = await supabaseServer
        .from('tools_ebp_vendors')
        .update({ is_active: false, date_inactivated: todayIso() })
        .eq('id', vendorId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error inactivating vendor:', error);
        return NextResponse.json({ error: 'Failed to inactivate vendor' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'activate' && vendorId) {
      const { error } = await supabaseServer
        .from('tools_ebp_vendors')
        .update({ is_active: true, date_inactivated: null })
        .eq('id', vendorId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error activating vendor:', error);
        return NextResponse.json({ error: 'Failed to activate vendor' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });
    }

    const row = buildVendorRow({ name, contactPerson, phone, email, serviceProvided, notes });

    if (vendorId) {
      const { data: existing } = await supabaseServer
        .from('tools_ebp_vendors')
        .select('id')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .eq('name', row.name)
        .neq('id', vendorId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: 'A vendor with this name already exists' }, { status: 400 });
      }

      const { data: updated, error } = await supabaseServer
        .from('tools_ebp_vendors')
        .update(row)
        .eq('id', vendorId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .select()
        .single();

      if (error) {
        console.error('Error updating vendor:', error);
        return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 });
      }

      return NextResponse.json({ vendor: updated });
    }

    const { data: existing } = await supabaseServer
      .from('tools_ebp_vendors')
      .select('id')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .eq('name', row.name)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'A vendor with this name already exists' }, { status: 400 });
    }

    const { data: created, error } = await supabaseServer
      .from('tools_ebp_vendors')
      .insert({
        user_id: user.id,
        tool_id: toolId,
        ...row,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating vendor:', error);
      return NextResponse.json({ error: 'Failed to create vendor' }, { status: 500 });
    }

    return NextResponse.json({ vendor: created });
  } catch (error: unknown) {
    console.error('Error in POST /api/tools/event-budget-planner/vendors:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId');
    const toolId = searchParams.get('toolId');

    if (!vendorId || !toolId) {
      return NextResponse.json({ error: 'Vendor ID and Tool ID are required' }, { status: 400 });
    }

    const { data: expenses } = await supabaseServer
      .from('tools_ebp_expenses')
      .select('id')
      .eq('vendor_id', vendorId)
      .limit(1);

    if (expenses && expenses.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete vendor that is used on expenses' },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from('tools_ebp_vendors')
      .delete()
      .eq('id', vendorId)
      .eq('user_id', user.id)
      .eq('tool_id', toolId);

    if (error) {
      console.error('Error deleting vendor:', error);
      return NextResponse.json({ error: 'Failed to delete vendor' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/tools/event-budget-planner/vendors:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
