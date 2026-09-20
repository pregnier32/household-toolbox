-- Lock get_user_storage_usage so only the service role can call it.
-- Safe to re-run.
--
-- Advisor: "Public Can Execute SECURITY DEFINER Function"
--   public.get_user_storage_usage(p_user_id uuid) executable by anon
--   via /rest/v1/rpc/get_user_storage_usage
--
-- The function stays SECURITY DEFINER so it can read storage.objects.
-- The app only calls it from supabaseServer (service role).
-- REVOKE FROM PUBLIC is not enough in Supabase — anon/authenticated
-- can still have EXECUTE from default grants.

REVOKE ALL ON FUNCTION public.get_user_storage_usage(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_storage_usage(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_user_storage_usage(uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_storage_usage(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
