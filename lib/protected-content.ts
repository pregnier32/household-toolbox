const SECRET_KEYS = ['view_password_hash', 'download_password_hash', 'answer_hash'] as const;

export function withoutSecrets<T extends object>(row: T): Omit<T, (typeof SECRET_KEYS)[number]> {
  const copy = { ...row } as Record<string, unknown>;
  for (const key of SECRET_KEYS) delete copy[key];
  return copy as Omit<T, (typeof SECRET_KEYS)[number]>;
}

export function publicNoteRow<T extends { note?: string | null; requires_password_for_view?: boolean | null }>(
  note: T,
  options?: { includeContent?: boolean }
) {
  const locked = Boolean(note.requires_password_for_view);
  const includeContent = options?.includeContent === true || !locked;
  return {
    ...withoutSecrets(note),
    note: includeContent ? (note.note ?? '') : '',
    content_locked: locked && !includeContent,
  };
}
