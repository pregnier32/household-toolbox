export type PublicSignUpResult = {
  success: true;
  needsEmailConfirmation: boolean;
};

export function publicSignUpResult(needsEmailConfirmation: boolean): PublicSignUpResult {
  return { success: true, needsEmailConfirmation };
}

/** An existing email uses the same success reply as a new signup. */
export function existingEmailSignUpResult(input: {
  errorCode?: string | null;
  identities?: unknown[] | null;
}): PublicSignUpResult | null {
  if (input.errorCode === 'user_already_exists') return publicSignUpResult(false);
  if (Array.isArray(input.identities) && input.identities.length === 0) return publicSignUpResult(true);
  return null;
}
