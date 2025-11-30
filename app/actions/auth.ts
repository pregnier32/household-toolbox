'use server';

import { randomUUID } from 'crypto';
import { supabaseServer } from '@/lib/supabaseServer';
import bcrypt from 'bcryptjs';
import { TablesInsert } from '@/src/types/supabase';
import { createSession, getSession } from '@/lib/session';
import { sendWelcomeEmail } from '@/lib/email';

type SignUpData = {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
};

type SignInData = {
  email: string;
  password: string;
};

type SignUpResult = {
  success: boolean;
  error?: string;
  userId?: string;
};

type SignInResult = {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName?: string;
  };
};

export async function signIn(data: SignInData): Promise<SignInResult> {
  try {
    // Validate input
    if (!data.email || !data.password) {
      return {
        success: false,
        error: 'Email and password are required',
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return {
        success: false,
        error: 'Invalid email format',
      };
    }

    // Find user by email
    const { data: user, error: fetchError } = await supabaseServer
      .from('users')
      .select('id, email, password, first_name, last_name, active')
      .eq('email', data.email.toLowerCase().trim())
      .single();

    if (fetchError || !user) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    // Check if user is active
    if (user.active !== 'Y') {
      return {
        success: false,
        error: 'Account is inactive. Please contact support.',
      };
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    // Create session
    await createSession(user.id);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name || undefined,
      },
    };
  } catch (error) {
    console.error('Sign in error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    };
  }
}

export async function signUp(data: SignUpData): Promise<SignUpResult> {
  try {
    // Validate input
    if (!data.email || !data.password || !data.firstName) {
      return {
        success: false,
        error: 'Email, password, and first name are required',
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return {
        success: false,
        error: 'Invalid email format',
      };
    }

    // Validate password length
    if (data.password.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters long',
      };
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabaseServer
      .from('users')
      .select('email')
      .eq('email', data.email.toLowerCase().trim())
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is what we want
      return {
        success: false,
        error: 'Error checking existing user',
      };
    }

    if (existingUser) {
      return {
        success: false,
        error: 'An account with this email already exists',
      };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Trim and prepare name fields
    // first_name is required, so it will always be a string after trim
    const firstName = data.firstName.trim();
    // last_name is required by schema, so use empty string if not provided
    const lastName = data.lastName?.trim() || '';

    // Generate UUID for user id
    const userId = randomUUID();

    // Prepare user data
    const userData: TablesInsert<'users'> = {
      id: userId,
      email: data.email.toLowerCase().trim(),
      password: hashedPassword,
      first_name: firstName,
      last_name: lastName,
      active: 'Y', // Default to active
      user_status: 'admin', // Default status
      user_id: userId,
    };

    // Insert user into database
    const { data: newUser, error: insertError } = await supabaseServer
      .from('users')
      .insert(userData)
      .select('id')
      .single();

    if (insertError) {
      console.error('Sign up error:', insertError);
      return {
        success: false,
        error: insertError.message || 'Failed to create account',
      };
    }

    // Send welcome email (non-blocking - don't fail signup if email fails)
    try {
      await sendWelcomeEmail({
        to: data.email.toLowerCase().trim(),
        firstName: firstName,
      });
    } catch (emailError) {
      // Log the error but don't fail the signup process
      console.error('Failed to send welcome email:', emailError);
    }

    return {
      success: true,
      userId: newUser.id,
    };
  } catch (error) {
    console.error('Sign up error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    };
  }
}

type UpdateProfileData = {
  firstName: string;
  lastName?: string;
  email: string;
};

type UpdateProfileResult = {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName?: string;
  };
};

export async function updateProfile(data: UpdateProfileData): Promise<UpdateProfileResult> {
  try {
    // Get current session to verify user
    const session = await getSession();
    if (!session) {
      return {
        success: false,
        error: 'You must be signed in to update your profile',
      };
    }

    // Validate input
    if (!data.email || !data.firstName) {
      return {
        success: false,
        error: 'Email and first name are required',
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return {
        success: false,
        error: 'Invalid email format',
      };
    }

    // Trim and prepare name fields
    const firstName = data.firstName.trim();
    const lastName = data.lastName?.trim() || '';
    const email = data.email.toLowerCase().trim();

    // Check if email is being changed and if it's already taken by another user
    if (email !== session.email) {
      const { data: existingUser, error: checkError } = await supabaseServer
        .from('users')
        .select('id, email')
        .eq('email', email)
        .neq('id', session.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 is "not found" which is what we want
        return {
          success: false,
          error: 'Error checking existing user',
        };
      }

      if (existingUser) {
        return {
          success: false,
          error: 'An account with this email already exists',
        };
      }
    }

    // Update user in database
    const { data: updatedUser, error: updateError } = await supabaseServer
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName,
        email: email,
      })
      .eq('id', session.id)
      .select('id, email, first_name, last_name')
      .single();

    if (updateError) {
      console.error('Update profile error:', updateError);
      return {
        success: false,
        error: updateError.message || 'Failed to update profile',
      };
    }

    return {
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name || undefined,
      },
    };
  } catch (error) {
    console.error('Update profile error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    };
  }
}

type ChangePasswordData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type ChangePasswordResult = {
  success: boolean;
  error?: string;
};

export async function changePassword(data: ChangePasswordData): Promise<ChangePasswordResult> {
  try {
    // Get current session to verify user
    const session = await getSession();
    if (!session) {
      return {
        success: false,
        error: 'You must be signed in to change your password',
      };
    }

    // Validate input
    if (!data.currentPassword || !data.newPassword || !data.confirmPassword) {
      return {
        success: false,
        error: 'All password fields are required',
      };
    }

    // Validate new password length
    if (data.newPassword.length < 8) {
      return {
        success: false,
        error: 'New password must be at least 8 characters long',
      };
    }

    // Check if new password matches confirmation
    if (data.newPassword !== data.confirmPassword) {
      return {
        success: false,
        error: 'New password and confirmation do not match',
      };
    }

    // Check if new password is different from current password
    if (data.currentPassword === data.newPassword) {
      return {
        success: false,
        error: 'New password must be different from your current password',
      };
    }

    // Get user's current password from database
    const { data: user, error: fetchError } = await supabaseServer
      .from('users')
      .select('password')
      .eq('id', session.id)
      .single();

    if (fetchError || !user) {
      return {
        success: false,
        error: 'Error fetching user data',
      };
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return {
        success: false,
        error: 'Current password is incorrect',
      };
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(data.newPassword, 10);

    // Update password in database
    const { error: updateError } = await supabaseServer
      .from('users')
      .update({ password: hashedNewPassword })
      .eq('id', session.id);

    if (updateError) {
      console.error('Change password error:', updateError);
      return {
        success: false,
        error: updateError.message || 'Failed to change password',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Change password error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    };
  }
}

