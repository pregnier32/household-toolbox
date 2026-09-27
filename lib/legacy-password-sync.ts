import bcrypt from 'bcryptjs';
import { supabaseServer } from '@/lib/supabaseServer';

/** Keeps the legacy password column aligned after a Supabase password change. Not used to sign in. */
export async function syncLegacyPasswordHash(userId: string, password: string): Promise<boolean> {
  const hashedPassword = await bcrypt.hash(password, 10);
  const { error } = await supabaseServer.from('users').update({ password: hashedPassword }).eq('id', userId);
  if (error) {
    console.error('Legacy password sync failed', userId);
    return false;
  }
  return true;
}
