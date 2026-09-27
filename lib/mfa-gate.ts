import { createSupabaseAuthServerClient } from '@/lib/supabaseAuthServer';

export type MfaAccess = 'open' | 'required' | 'unknown';

type FactorRow = {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string;
  created_at?: string;
};

function verifiedTotp(factors: { all?: FactorRow[]; totp?: FactorRow[] } | null): FactorRow[] {
  const all = factors?.all ?? [];
  const fromAll = all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'verified');
  if (fromAll.length > 0) return fromAll;
  return (factors?.totp ?? []).filter((factor) => factor.status === 'verified' && factor.factor_type !== 'phone');
}

/** open: no verified authenticator, or this session already completed MFA. */
export async function readMfaAccess(): Promise<MfaAccess> {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const [level, factors] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    if (level.error || factors.error) {
      console.error('MFA status check failed', level.error?.code ?? factors.error?.code ?? 'no_code');
      return 'unknown';
    }
    const verified = verifiedTotp(factors.data as { all?: FactorRow[]; totp?: FactorRow[] });
    if (verified.length === 0) return 'open';
    if (level.data?.currentLevel === 'aal2') return 'open';
    return 'required';
  } catch {
    console.error('MFA status check failed');
    return 'unknown';
  }
}
