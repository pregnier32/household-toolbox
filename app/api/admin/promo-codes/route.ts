import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Fetch all promo codes
export async function GET() {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data, error } = await supabaseServer
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching promo codes:', error);
      return NextResponse.json({ error: 'Failed to fetch promo codes' }, { status: 500 });
    }

    return NextResponse.json({ promoCodes: data || [] });
  } catch (error) {
    console.error('Error in promo codes API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new promo code
export async function POST(request: NextRequest) {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { code, discountType, discountValue, expiresAt, maxUses, description, active } = body;

    // Validate required fields
    if (!code || !discountType || !discountValue || !expiresAt) {
      return NextResponse.json(
        { error: 'Code, discount type, discount value, and expiration date are required' },
        { status: 400 }
      );
    }

    // Validate discount type
    if (!['percentage', 'fixed'].includes(discountType)) {
      return NextResponse.json(
        { error: 'Discount type must be either "percentage" or "fixed"' },
        { status: 400 }
      );
    }

    // Validate discount value
    const discountValueNum = parseFloat(discountValue);
    if (isNaN(discountValueNum) || discountValueNum <= 0) {
      return NextResponse.json(
        { error: 'Discount value must be a positive number' },
        { status: 400 }
      );
    }

    // Validate percentage discount (should be between 0 and 100)
    if (discountType === 'percentage' && discountValueNum > 100) {
      return NextResponse.json(
        { error: 'Percentage discount cannot exceed 100%' },
        { status: 400 }
      );
    }

    // Validate expiration date
    const expirationDate = new Date(expiresAt);
    if (isNaN(expirationDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid expiration date' },
        { status: 400 }
      );
    }

    // Validate max uses if provided (allow empty string, null, or undefined)
    if (maxUses !== null && maxUses !== undefined && maxUses !== '') {
      const maxUsesNum = parseInt(maxUses);
      if (isNaN(maxUsesNum) || maxUsesNum < 1) {
        return NextResponse.json(
          { error: 'Max uses must be a positive integer' },
          { status: 400 }
        );
      }
    }

    // Check if code already exists
    const { data: existingCode, error: checkError } = await supabaseServer
      .from('promo_codes')
      .select('id')
      .eq('code', code.toUpperCase().trim())
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is what we want
      console.error('Error checking existing promo code:', checkError);
      return NextResponse.json({ error: 'Error checking existing code' }, { status: 500 });
    }

    if (existingCode) {
      return NextResponse.json(
        { error: 'A promo code with this code already exists' },
        { status: 400 }
      );
    }

    // Insert new promo code
    const { data: newPromoCode, error: insertError } = await supabaseServer
      .from('promo_codes')
      .insert({
        code: code.toUpperCase().trim(),
        discount_type: discountType,
        discount_value: discountValueNum,
        expires_at: expirationDate.toISOString(),
        max_uses: (maxUses && maxUses !== '' && maxUses !== null) ? parseInt(maxUses) : null,
        description: description || null,
        active: active !== undefined ? active : true,
        usage_count: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating promo code:', insertError);
      return NextResponse.json({ error: 'Failed to create promo code' }, { status: 500 });
    }

    return NextResponse.json({ promoCode: newPromoCode }, { status: 201 });
  } catch (error) {
    console.error('Error in promo codes API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update an existing promo code
export async function PUT(request: NextRequest) {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, code, discountType, discountValue, expiresAt, maxUses, description, active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Promo code ID is required' }, { status: 400 });
    }

    // Build update object
    const updateData: any = {};

    if (code !== undefined) {
      // Check if code is being changed and if new code already exists
      const { data: existingCode, error: checkError } = await supabaseServer
        .from('promo_codes')
        .select('id')
        .eq('code', code.toUpperCase().trim())
        .neq('id', id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing promo code:', checkError);
        return NextResponse.json({ error: 'Error checking existing code' }, { status: 500 });
      }

      if (existingCode) {
        return NextResponse.json(
          { error: 'A promo code with this code already exists' },
          { status: 400 }
        );
      }

      updateData.code = code.toUpperCase().trim();
    }

    if (discountType !== undefined) {
      if (!['percentage', 'fixed'].includes(discountType)) {
        return NextResponse.json(
          { error: 'Discount type must be either "percentage" or "fixed"' },
          { status: 400 }
        );
      }
      updateData.discount_type = discountType;
    }

    if (discountValue !== undefined) {
      const discountValueNum = parseFloat(discountValue);
      if (isNaN(discountValueNum) || discountValueNum <= 0) {
        return NextResponse.json(
          { error: 'Discount value must be a positive number' },
          { status: 400 }
        );
      }

      // Get the discount type to validate (either from update or existing record)
      let discountTypeToCheck = discountType;
      if (discountTypeToCheck === undefined) {
        const { data: existing } = await supabaseServer
          .from('promo_codes')
          .select('discount_type')
          .eq('id', id)
          .single();
        discountTypeToCheck = existing?.discount_type;
      }

      if (discountTypeToCheck === 'percentage' && discountValueNum > 100) {
        return NextResponse.json(
          { error: 'Percentage discount cannot exceed 100%' },
          { status: 400 }
        );
      }

      updateData.discount_value = discountValueNum;
    }

    if (expiresAt !== undefined) {
      const expirationDate = new Date(expiresAt);
      if (isNaN(expirationDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid expiration date' },
          { status: 400 }
        );
      }
      updateData.expires_at = expirationDate.toISOString();
    }

    if (maxUses !== undefined) {
      // Treat empty string, null, or undefined as "no limit"
      if (maxUses === null || maxUses === '' || maxUses === undefined) {
        updateData.max_uses = null;
      } else {
        const maxUsesNum = parseInt(maxUses);
        if (isNaN(maxUsesNum) || maxUsesNum < 1) {
          return NextResponse.json(
            { error: 'Max uses must be a positive integer' },
            { status: 400 }
          );
        }
        updateData.max_uses = maxUsesNum;
      }
    }

    if (description !== undefined) {
      updateData.description = description || null;
    }

    if (active !== undefined) {
      updateData.active = active;
    }

    // Update promo code
    const { data: updatedPromoCode, error: updateError } = await supabaseServer
      .from('promo_codes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating promo code:', updateError);
      return NextResponse.json({ error: 'Failed to update promo code' }, { status: 500 });
    }

    return NextResponse.json({ promoCode: updatedPromoCode });
  } catch (error) {
    console.error('Error in promo codes API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a promo code
export async function DELETE(request: NextRequest) {
  // Check if user is authenticated and is a superadmin
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Promo code ID is required' }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from('promo_codes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting promo code:', error);
      return NextResponse.json({ error: 'Failed to delete promo code' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in promo codes API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

