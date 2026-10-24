-- Customers cannot change tool ownership, price, status, or trial history directly.
-- Activation, removal, and reactivation stay on the server through service_role.
-- Safe to re-run.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.users_tools FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.user_tool_entitlements FROM anon, authenticated;

DROP POLICY IF EXISTS "Only account owner can insert tools" ON public.users_tools;
DROP POLICY IF EXISTS "Only account owner can update tools" ON public.users_tools;
DROP POLICY IF EXISTS "Only account owner can delete tools" ON public.users_tools;

GRANT SELECT ON TABLE public.users_tools TO authenticated;
GRANT SELECT ON TABLE public.user_tool_entitlements TO authenticated;
