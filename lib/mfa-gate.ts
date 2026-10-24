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
    return mfaAccessFromFactors(
      level.data?.currentLevel,
      factors.data as { all?: FactorRow[]; totp?: FactorRow[] }
    );
  } catch {
    console.error('MFA status check failed');
    return 'unknown';
  }
}

/**
 * Data routes already verified the access token. A session at aal2 has finished
 * MFA, so the factor list is not loaded again. Any other level still checks
 * whether a verified authenticator exists.
 */
export async function readMfaAccessForVerifiedLevel(currentLevel: string | undefined): Promise<MfaAccess> {
  if (currentLevel === 'aal2') return 'open';
  try {
    const supabase = await createSupabaseAuthServerClient();
    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) {
      console.error('MFA status check failed', factors.error.code ?? 'no_code');
      return 'unknown';
    }
    return mfaAccessFromFactors(currentLevel, factors.data as { all?: FactorRow[]; totp?: FactorRow[] });
  } catch {
    console.error('MFA status check failed');
    return 'unknown';
  }
}

function mfaAccessFromFactors(
  currentLevel: string | null | undefined,
  factors: { all?: FactorRow[]; totp?: FactorRow[] } | null
): MfaAccess {
  if (verifiedTotp(factors).length === 0) return 'open';
  if (currentLevel === 'aal2') return 'open';
  return 'required';
}
