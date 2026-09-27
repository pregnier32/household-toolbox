-- Phase 4: retire the custom account password and the custom reset-token table.
-- Supabase Auth is the only account credential store.
-- Does not change public.users.id, roles, storage, or tool ownership.
-- Does not change Notes or Important Documents content-password columns.

ALTER TABLE public.users DROP COLUMN IF EXISTS password;

DROP TABLE IF EXISTS public.password_reset_tokens;
