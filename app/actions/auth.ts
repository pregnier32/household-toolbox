'use server';

import { supabaseServer } from '@/lib/supabaseServer';
import { TablesInsert } from '@/src/types/supabase';
import { getSession } from '@/lib/session';
import { createSupabaseAuthServerClient } from '@/lib/supabaseAuthServer';
import { authCallbackUrl } from '@/lib/auth-app-origin';
import { syncLegacyPasswordHash } from '@/lib/legacy-password-sync';
import { sendWelcomeEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';

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
  needsEmailConfirmation?: boolean;
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

function isRecoverySession(claims: { amr?: { method: string }[] | string[] } | undefined): boolean {
  const methods = claims?.amr;
  if (!methods) return false;
  return methods.some((entry) => (typeof entry === 'string' ? entry : entry.method) === 'recovery');
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

async function signupsAreDisabled(): Promise<boolean | null> {
  const { data, error } = await supabaseServer
    .from('settings')
    .select('value')
    .eq('key', 'site_maintenance')
    .maybeSingle();

  if (error) {
    console.error('Signup availability check failed');
    return null;
  }
  if (!data?.value || typeof data.value !== 'object' || Array.isArray(data.value)) {
    return false;
  }
  return Boolean((data.value as { signUpsDisabled?: unknown }).signUpsDisabled);
}

export async function signIn(data: SignInData): Promise<SignInResult> {
  try {
    if (!data.email || !data.password) {
      return { success: false, error: 'Email and password are required' };
    }
    if (!EMAIL_PATTERN.test(data.email)) {
      return { success: false, error: 'Invalid email format' };
    }

    const email = normalizeEmail(data.email);
    const supabase = await createSupabaseAuthServerClient();
    const signedIn = await supabase.auth.signInWithPassword({
      email,
      password: data.password,
    });

    if (signedIn.error || !signedIn.data.user) {
      if (signedIn.error?.code === 'email_not_confirmed') {
        return {
          success: false,
          error: 'Check your email to confirm your account before signing in.',
        };
      }
      if (signedIn.error?.code === 'invalid_credentials') {
        return { success: false, error: 'Invalid email or password' };
      }
      console.error('Sign in failed', signedIn.error?.code ?? 'no_user');
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }

    const userId = signedIn.data.user.id;
    const { data: profile, error: profileError } = await supabaseServer
      .from('users')
      .select('id, email, first_name, last_name, active')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile || profile.active !== 'Y') {
      await supabase.auth.signOut();
      if (profile && profile.active !== 'Y') {
        return {
          success: false,
          error: 'Account is inactive. Please contact support.',
        };
      }
      console.error('Authenticated user has no active public.users row', userId);
      return {
        success: false,
        error: 'This account cannot be used. Please contact support.',
      };
    }

    return {
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name || undefined,
      },
    };
  } catch {
    console.error('Sign in error');
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    };
  }
}

export async function signUp(data: SignUpData): Promise<SignUpResult> {
  try {
    if (!data.email || !data.password || !data.firstName) {
      return { success: false, error: 'Email, password, and first name are required' };
    }
    if (!EMAIL_PATTERN.test(data.email)) {
      return { success: false, error: 'Invalid email format' };
    }
    if (data.password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long' };
    }

    const signupsDisabled = await signupsAreDisabled();
    if (signupsDisabled === null) {
      return { success: false, error: 'Signups are temporarily unavailable. Please try again.' };
    }
    if (signupsDisabled) {
      return {
        success: false,
        error: 'New user registration is currently disabled. Please contact support.',
      };
    }

    const email = normalizeEmail(data.email);
    const firstName = data.firstName.trim();
    const lastName = data.lastName?.trim() || '';
    if (!firstName) {
      return { success: false, error: 'Email, password, and first name are required' };
    }

    const { data: existingUser, error: checkError } = await supabaseServer
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (checkError) {
      console.error('Signup existing-user check failed');
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
    if (existingUser) {
      return { success: false, error: 'An account with this email already exists' };
    }

    const supabase = await createSupabaseAuthServerClient();
    const created = await supabase.auth.signUp({
      email,
      password: data.password,
      options: {
        emailRedirectTo: authCallbackUrl('/dashboard'),
      },
    });

    if (created.error || !created.data.user) {
      if (created.error?.code === 'user_already_exists') {
        return { success: false, error: 'An account with this email already exists' };
      }
      console.error('Auth signup failed', created.error?.code ?? 'no_user');
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }

    const identities = created.data.user.identities ?? [];
    if (identities.length === 0) {
      return { success: false, error: 'An account with this email already exists' };
    }

    const userId = created.data.user.id;
    const passwordHash = await bcrypt.hash(data.password, 10);

    const userData: TablesInsert<'users'> = {
      id: userId,
      email,
      password: passwordHash,
      first_name: firstName,
      last_name: lastName,
      active: 'Y',
      user_status: 'admin',
      theme_preference: 'light',
      user_id: userId,
    };

    const { error: insertError } = await supabaseServer.from('users').insert(userData).select('id').single();
    if (insertError) {
      console.error('Profile insert failed after Auth signup', userId);
      const removed = await supabaseServer.auth.admin.deleteUser(userId);
      if (removed.error) {
        console.error('Failed to delete orphaned Auth user', userId);
      }
      await supabase.auth.signOut();
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }

    if (created.data.session) {
      await supabase.auth.signOut();
    }

    try {
      await sendWelcomeEmail({ to: email, firstName });
    } catch {
      console.error('Failed to send welcome email', userId);
    }

    const needsEmailConfirmation = !created.data.user.email_confirmed_at;
    return { success: true, userId, needsEmailConfirmation };
  } catch {
    console.error('Sign up error');
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
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
    const session = await getSession();
    if (!session) {
      return { success: false, error: 'You must be signed in to update your profile' };
    }
    if (!data.email || !data.firstName) {
      return { success: false, error: 'Email and first name are required' };
    }
    if (!EMAIL_PATTERN.test(data.email)) {
      return { success: false, error: 'Invalid email format' };
    }

    const email = normalizeEmail(data.email);
    if (email !== session.email.toLowerCase()) {
      return { success: false, error: 'Email cannot be changed here.' };
    }

    const firstName = data.firstName.trim();
    const lastName = data.lastName?.trim() || '';
    if (!firstName) {
      return { success: false, error: 'Email and first name are required' };
    }

    const { data: updatedUser, error: updateError } = await supabaseServer
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName,
      })
      .eq('id', session.id)
      .select('id, email, first_name, last_name')
      .single();

    if (updateError || !updatedUser) {
      console.error('Update profile error');
      return { success: false, error: 'Failed to update profile' };
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
  } catch {
    console.error('Update profile error');
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
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
    const session = await getSession();
    if (!session) {
      return { success: false, error: 'You must be signed in to change your password' };
    }
    if (!data.currentPassword || !data.newPassword || !data.confirmPassword) {
      return { success: false, error: 'All password fields are required' };
    }
    if (data.newPassword.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters long' };
    }
    if (data.newPassword !== data.confirmPassword) {
      return { success: false, error: 'New password and confirmation do not match' };
    }
    if (data.currentPassword === data.newPassword) {
      return { success: false, error: 'New password must be different from your current password' };
    }

    const supabase = await createSupabaseAuthServerClient();
    const reauthenticated = await supabase.auth.signInWithPassword({
      email: session.email,
      password: data.currentPassword,
    });
    if (reauthenticated.error) {
      if (reauthenticated.error.code === 'invalid_credentials') {
        return { success: false, error: 'Current password is incorrect' };
      }
      console.error('Password reauthentication failed', reauthenticated.error.code);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }

    const updated = await supabase.auth.updateUser({ password: data.newPassword });
    if (updated.error) {
      console.error('Auth password update failed', updated.error.code);
      return { success: false, error: 'Failed to change password' };
    }

    const synced = await syncLegacyPasswordHash(session.id, data.newPassword);
    if (!synced) {
      console.error('Legacy password sync failed after Auth password change', session.id);
    }

    return { success: true };
  } catch {
    console.error('Change password error');
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}

type RequestPasswordResetData = {
  email: string;
};

type RequestPasswordResetResult = {
  success: boolean;
  error?: string;
};

export async function requestPasswordReset(data: RequestPasswordResetData): Promise<RequestPasswordResetResult> {
  try {
    if (!data.email) {
      return { success: false, error: 'Email is required' };
    }
    if (!EMAIL_PATTERN.test(data.email)) {
      return { success: false, error: 'Invalid email format' };
    }

    const supabase = await createSupabaseAuthServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(data.email), {
      redirectTo: authCallbackUrl('/reset-password'),
    });

    if (error) {
      console.error('Password recovery request failed', error.code);
      if (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit') {
        return { success: false, error: 'Please wait a moment and try again.' };
      }
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }

    return { success: true };
  } catch {
    console.error('Request password reset error');
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}

type ResetPasswordData = {
  newPassword: string;
  confirmPassword: string;
};

type ResetPasswordResult = {
  success: boolean;
  error?: string;
};

export async function hasPasswordRecoverySession(): Promise<boolean> {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const { data, error } = await supabase.auth.getClaims();
    return !error && isRecoverySession(data?.claims);
  } catch {
    return false;
  }
}

export async function resetPassword(data: ResetPasswordData): Promise<ResetPasswordResult> {
  try {
    if (!data.newPassword || !data.confirmPassword) {
      return { success: false, error: 'All fields are required' };
    }
    if (data.newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long' };
    }
    if (data.newPassword !== data.confirmPassword) {
      return { success: false, error: 'Passwords do not match' };
    }

    const supabase = await createSupabaseAuthServerClient();
    const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    const userId = claims?.claims.sub;
    if (claimsError || !userId || !isRecoverySession(claims?.claims)) {
      return { success: false, error: 'This reset link is invalid or has expired. Request a new one.' };
    }

    const updated = await supabase.auth.updateUser({ password: data.newPassword });
    if (updated.error) {
      console.error('Recovery password update failed', updated.error.code);
      return { success: false, error: 'This reset link is invalid or has expired. Request a new one.' };
    }

    const synced = await syncLegacyPasswordHash(userId, data.newPassword);
    if (!synced) {
      console.error('Legacy password sync failed after recovery', userId);
    }

    await supabase.auth.signOut();
    return { success: true };
  } catch {
    console.error('Reset password error');
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
