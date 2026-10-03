import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { delete_user, delete_user_tools, listLinkedGuestAccounts } from '@/lib/user-data-deletion';

type LinkedAccount = {
  email: string;
  first_name: string;
  last_name: string | null;
};

async function linkedHouseholdAccounts(userIds: string[]): Promise<Map<string, LinkedAccount>> {
  const links = new Map<string, LinkedAccount>();
  if (userIds.length === 0) return links;

  const members = await supabaseServer
    .from('household_members')
    .select('user_id, household_id')
    .in('user_id', userIds)
    .eq('role', 'user')
    .eq('status', 'active');

  if (members.error || !members.data?.length) {
    if (members.error) console.error('Household link lookup failed', members.error.code ?? 'unknown');
    return links;
  }

  const householdIds = [...new Set(members.data.map((member) => member.household_id))];
  const households = await supabaseServer
    .from('households')
    .select('id, admin_user_id')
    .in('id', householdIds);

  if (households.error || !households.data?.length) {
    if (households.error) console.error('Household admin lookup failed', households.error.code ?? 'unknown');
    return links;
  }

  const adminIds = [...new Set(households.data.map((household) => household.admin_user_id))];
  const admins = await supabaseServer
    .from('users')
    .select('id, email, first_name, last_name')
    .in('id', adminIds);

  if (admins.error || !admins.data) {
    if (admins.error) console.error('Linked account lookup failed', admins.error.code ?? 'unknown');
    return links;
  }

  const householdAdmin = new Map(households.data.map((household) => [household.id, household.admin_user_id]));
  const adminById = new Map(admins.data.map((admin) => [admin.id, admin]));

  for (const member of members.data) {
    const adminId = householdAdmin.get(member.household_id);
    const admin = adminId ? adminById.get(adminId) : undefined;
    if (!admin) continue;
    links.set(member.user_id, {
      email: admin.email,
      first_name: admin.first_name,
      last_name: admin.last_name,
    });
  }

  return links;
}

// GET - Fetch all users
export async function GET(request: NextRequest) {
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
      .from('users')
      .select('id, email, first_name, last_name, active, user_status, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Fetch active tool counts for all users
    const { data: toolCounts, error: toolCountsError } = await supabaseServer
      .from('users_tools')
      .select('user_id')
      .eq('status', 'active');

    if (toolCountsError) {
      console.error('Error fetching tool counts:', toolCountsError);
      // Continue without tool counts if there's an error
    }

    // Count tools per user
    const toolCountMap = new Map<string, number>();
    toolCounts?.forEach((item) => {
      const count = toolCountMap.get(item.user_id) || 0;
      toolCountMap.set(item.user_id, count + 1);
    });

    const householdUserIds = (data || [])
      .filter((user) => (user.user_status || 'guest').toLowerCase() === 'guest')
      .map((user) => user.id);
    const linkedAccounts = await linkedHouseholdAccounts(householdUserIds);
    const adminUserIds = (data || [])
      .filter((user) => (user.user_status || 'guest').toLowerCase() !== 'guest')
      .map((user) => user.id);
    const linkedGuests = await listLinkedGuestAccounts(adminUserIds);

    // Add tool counts to users
    const usersWithToolCounts = (data || []).map((user) => ({
      ...user,
      active_tools_count: toolCountMap.get(user.id) || 0,
      linked_account: linkedAccounts.get(user.id) ?? null,
      linked_guests: linkedGuests.get(user.id) ?? [],
    }));

    return NextResponse.json({ users: usersWithToolCounts });
  } catch (error) {
    console.error('Error in users API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update an existing user
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
    const { id, email, firstName, lastName, active, userStatus } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Build update object
    const updateData: any = {};

    if (email !== undefined) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }

      // Check if email is being changed and if new email already exists
      const { data: existingUser, error: checkError } = await supabaseServer
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .neq('id', id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing user:', checkError);
        return NextResponse.json({ error: 'Error checking existing email' }, { status: 500 });
      }

      if (existingUser) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 400 }
        );
      }

      updateData.email = email.toLowerCase().trim();
    }

    if (firstName !== undefined) {
      if (!firstName.trim()) {
        return NextResponse.json({ error: 'First name cannot be empty' }, { status: 400 });
      }
      updateData.first_name = firstName.trim();
    }

    if (lastName !== undefined) {
      updateData.last_name = lastName.trim() || null;
    }

    if (active !== undefined) {
      if (!['Y', 'N'].includes(active)) {
        return NextResponse.json({ error: 'Active status must be "Y" or "N"' }, { status: 400 });
      }
      updateData.active = active;
    }

    if (userStatus !== undefined) {
      updateData.user_status = userStatus;
    }

    // Update user
    const { data: updatedUser, error: updateError } = await supabaseServer
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, email, first_name, last_name, active, user_status, created_at, updated_at')
      .single();

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Error in users API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a user and all related records
export async function DELETE(request: NextRequest) {
  // Check if user is authenticated and is a superadmin
  const currentUser = await getSession();

  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (currentUser.userStatus !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Prevent deleting the current logged-in superadmin
    if (id === currentUser.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    // Verify the user exists before deletion
    const { data: userToDelete, error: fetchError } = await supabaseServer
      .from('users')
      .select('id, email, user_status')
      .eq('id', id)
      .single();

    if (fetchError || !userToDelete) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    try {
      await delete_user_tools(id);
      await delete_user(id);
    } catch (deleteError) {
      console.error('Error deleting user and associated data:', deleteError);
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'User and all related records deleted successfully' });
  } catch (error) {
    console.error('Error in users API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

