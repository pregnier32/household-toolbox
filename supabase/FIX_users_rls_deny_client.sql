-- Explicit deny-all client policies on public.users.
-- Safe to re-run.
--
-- Advisor: "RLS Enabled No Policy" after dropping
--   "Allow public user registration"
--
-- All users reads/writes go through supabaseServer (service role), which
-- bypasses RLS. This app does not use Supabase Auth, so there is no
-- auth.uid() to attach a "own row" policy to.
-- A USING (false) policy documents that lock and clears the info warning
-- without reopening INSERT to anon.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all client access to users" ON public.users;
CREATE POLICY "Deny all client access to users" ON public.users
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

NOTIFY pgrst, 'reload schema';
