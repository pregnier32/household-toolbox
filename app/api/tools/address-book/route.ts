import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

type AddressFields = {
  mailingName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
};

function buildAddressRow(fields: AddressFields) {
  return {
    mailing_name: (fields.mailingName ?? '').trim(),
    first_name: (fields.firstName ?? '').trim(),
    last_name: (fields.lastName ?? '').trim(),
    email: (fields.email ?? '').trim(),
    phone: (fields.phone ?? '').trim(),
    street_address: (fields.streetAddress ?? '').trim(),
    city: (fields.city ?? '').trim(),
    state: (fields.state ?? '').trim(),
    zip: (fields.zip ?? '').trim(),
    country: (fields.country ?? '').trim(),
  };
}

async function attachTagsToAddresses(addressIds: string[]) {
  const addressTagsMap: Record<string, string[]> = {};

  if (addressIds.length === 0) {
    return addressTagsMap;
  }

  const { data: addressTags } = await supabaseServer
    .from('tools_ab_address_tags')
    .select('address_id, tag_id')
    .in('address_id', addressIds);

  addressTags?.forEach((row) => {
    if (!addressTagsMap[row.address_id]) {
      addressTagsMap[row.address_id] = [];
    }
    addressTagsMap[row.address_id].push(row.tag_id);
  });

  return addressTagsMap;
}

async function replaceAddressTags(addressId: string, selectedTags: string[]) {
  await supabaseServer.from('tools_ab_address_tags').delete().eq('address_id', addressId);

  if (selectedTags.length > 0) {
    const inserts = selectedTags.map((tagId) => ({
      address_id: addressId,
      tag_id: tagId,
    }));

    const { error } = await supabaseServer.from('tools_ab_address_tags').insert(inserts);

    if (error) {
      console.error('Error updating address tags:', error);
    }
  }
}

// GET - Fetch all addresses and tags for the current user
export async function GET(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    const { data: addresses, error: addressesError } = await supabaseServer
      .from('tools_ab_addresses')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('date_added', { ascending: false });

    if (addressesError) {
      console.error('Error fetching addresses:', addressesError);
      return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 });
    }

    const { data: tags, error: tagsError } = await supabaseServer
      .from('tools_ab_tags')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('name', { ascending: true });

    if (tagsError) {
      console.error('Error fetching tags:', tagsError);
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }

    const addressIds = addresses?.map((a) => a.id) || [];
    const addressTagsMap = await attachTagsToAddresses(addressIds);

    const addressesWithTags =
      addresses?.map((address) => ({
        ...address,
        tags: addressTagsMap[address.id] || [],
      })) || [];

    return NextResponse.json({
      addresses: addressesWithTags,
      tags: tags || [],
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/tools/address-book:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create, update, inactivate, activate, or delete an address
export async function POST(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      toolId,
      addressId,
      action,
      mailingName,
      firstName,
      lastName,
      email,
      phone,
      streetAddress,
      city,
      state,
      zip,
      country,
      selectedTags,
    } = body;

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    if (action === 'delete' && addressId) {
      const { error } = await supabaseServer
        .from('tools_ab_addresses')
        .delete()
        .eq('id', addressId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error deleting address:', error);
        return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'inactivate' && addressId) {
      const { error } = await supabaseServer
        .from('tools_ab_addresses')
        .update({
          is_active: false,
          date_inactivated: new Date().toISOString().split('T')[0],
        })
        .eq('id', addressId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error inactivating address:', error);
        return NextResponse.json({ error: 'Failed to inactivate address' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'activate' && addressId) {
      const { error } = await supabaseServer
        .from('tools_ab_addresses')
        .update({
          is_active: true,
          date_inactivated: null,
        })
        .eq('id', addressId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error activating address:', error);
        return NextResponse.json({ error: 'Failed to activate address' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (!mailingName || !String(mailingName).trim()) {
      return NextResponse.json({ error: 'Mailing name is required' }, { status: 400 });
    }

    if (!selectedTags || selectedTags.length === 0) {
      return NextResponse.json({ error: 'At least one tag is required' }, { status: 400 });
    }

    const addressRow = buildAddressRow({
      mailingName,
      firstName,
      lastName,
      email,
      phone,
      streetAddress,
      city,
      state,
      zip,
      country,
    });

    if (action === 'create' || !addressId) {
      const { data: newAddress, error: insertError } = await supabaseServer
        .from('tools_ab_addresses')
        .insert({
          user_id: user.id,
          tool_id: toolId,
          ...addressRow,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating address:', insertError);
        return NextResponse.json({ error: 'Failed to create address' }, { status: 500 });
      }

      await replaceAddressTags(newAddress.id, selectedTags);

      return NextResponse.json({ address: newAddress });
    }

    const { data: updatedAddress, error: updateError } = await supabaseServer
      .from('tools_ab_addresses')
      .update(addressRow)
      .eq('id', addressId)
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating address:', updateError);
      return NextResponse.json({ error: 'Failed to update address' }, { status: 500 });
    }

    await replaceAddressTags(addressId, selectedTags);

    return NextResponse.json({ address: updatedAddress });
  } catch (error: unknown) {
    console.error('Error in POST /api/tools/address-book:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Permanently delete an address (from history)
export async function DELETE(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const addressId = searchParams.get('addressId');
    const toolId = searchParams.get('toolId');

    if (!addressId || !toolId) {
      return NextResponse.json({ error: 'Address ID and Tool ID are required' }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from('tools_ab_addresses')
      .delete()
      .eq('id', addressId)
      .eq('user_id', user.id)
      .eq('tool_id', toolId);

    if (error) {
      console.error('Error deleting address:', error);
      return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/tools/address-book:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
