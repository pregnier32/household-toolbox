-- Remove the leftover anon INSERT policy on public.users.
-- Safe to re-run.
--
-- Advisor: "RLS Policy Always True" on
--   "Allow public user registration" (INSERT TO anon WITH CHECK (true))
--
-- Signup, profile, and admin user writes all go through supabaseServer
-- (SUPABASE_SERVICE_ROLE_KEY), which bypasses RLS. The anon policy is not
-- used by the app and lets anyone with the public anon key insert into users.

DROP POLICY IF EXISTS "Allow public user registration" ON public.users;

NOTIFY pgrst, 'reload schema';
