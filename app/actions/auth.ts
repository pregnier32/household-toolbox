'use server';

import { randomUUID } from 'crypto';
import { supabaseServer } from '@/lib/supabaseServer';
import bcrypt from 'bcryptjs';
import { TablesInsert } from '@/src/types/supabase';
import { createSession } from '@/lib/session';

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
    const firstName = data.firstName.trim() || null;
    const lastName = data.lastName?.trim() || null;

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

