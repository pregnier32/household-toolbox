'use server';

import { randomUUID } from 'crypto';
import { supabase } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { TablesInsert } from '@/src/types/supabase';

type SignUpData = {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
};

type SignUpResult = {
  success: boolean;
  error?: string;
  userId?: string;
};

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
    const { data: existingUser, error: checkError } = await supabase
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
    const { data: newUser, error: insertError } = await supabase
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

