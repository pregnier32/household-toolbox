-- Household sharing: one Admin and up to 4 Users.
-- Safe to re-run. Does not move existing tool rows.
-- Tool data, storage, and users_tools stay on the Admin's user id.
-- Active household members reach that data through can_access_user_data().
--
-- Run in the Supabase SQL editor before using Manage Users.

CREATE TABLE IF NOT EXISTS public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS household_members_one_admin
  ON public.household_members (household_id)
  WHERE role = 'admin';

CREATE TABLE IF NOT EXISTS public.household_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_first_name TEXT NOT NULL,
  invited_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS household_invitations_one_pending_email
  ON public.household_invitations (household_id, lower(invited_email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_household_members_household
  ON public.household_members (household_id, role, status);

CREATE INDEX IF NOT EXISTS idx_household_invitations_household_status
  ON public.household_invitations (household_id, status);

-- Existing customers become the Admin of their own household.
INSERT INTO public.households (admin_user_id)
SELECT users.id
FROM public.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.household_members members WHERE members.user_id = users.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.households households WHERE households.admin_user_id = users.id
);

INSERT INTO public.household_members (household_id, user_id, role, status)
SELECT households.id, households.admin_user_id, 'admin', 'active'
FROM public.households
WHERE NOT EXISTS (
  SELECT 1 FROM public.household_members members WHERE members.user_id = households.admin_user_id
);

CREATE OR REPLACE FUNCTION public.can_access_user_data(owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owner_id IS NOT NULL AND (
    owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.household_members member
      JOIN public.households household ON household.id = member.household_id
      WHERE member.user_id = (SELECT auth.uid())
        AND member.status = 'active'
        AND household.admin_user_id = owner_id
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_storage_owner(folder TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT folder IS NOT NULL
    AND folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.can_access_user_data(folder::uuid);
$$;

REVOKE ALL ON FUNCTION public.can_access_user_data(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_storage_owner(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_user_data(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_storage_owner(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_household_member_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  admin_id UUID;
  user_count INTEGER;
BEGIN
  SELECT admin_user_id INTO admin_id FROM public.households WHERE id = NEW.household_id;
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Household not found';
  END IF;

  IF NEW.role = 'admin' AND NEW.user_id IS DISTINCT FROM admin_id THEN
    RAISE EXCEPTION 'Household admin member must be the household admin';
  END IF;
  IF NEW.role = 'user' AND NEW.user_id = admin_id THEN
    RAISE EXCEPTION 'The household Admin cannot also be a User';
  END IF;

  IF NEW.role = 'user' AND TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO user_count
    FROM public.household_members
    WHERE household_id = NEW.household_id
      AND role = 'user'
      AND status = 'active';
    IF user_count >= 4 THEN
      RAISE EXCEPTION 'Household user limit reached';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_household_member_rules ON public.household_members;
CREATE TRIGGER trigger_enforce_household_member_rules
  BEFORE INSERT OR UPDATE ON public.household_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_household_member_rules();

DROP TRIGGER IF EXISTS trigger_prevent_household_admin_removal ON public.household_members;

CREATE OR REPLACE FUNCTION public.enforce_household_invitation_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  occupied INTEGER;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT
    (SELECT COUNT(*) FROM public.household_members
      WHERE household_id = NEW.household_id AND role = 'user' AND status = 'active')
    +
    (SELECT COUNT(*) FROM public.household_invitations
      WHERE household_id = NEW.household_id AND status = 'pending' AND id IS DISTINCT FROM NEW.id)
  INTO occupied;

  IF occupied >= 4 THEN
    RAISE EXCEPTION 'Household user limit reached';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_household_invitation_limit ON public.household_invitations;
CREATE TRIGGER trigger_enforce_household_invitation_limit
  BEFORE INSERT OR UPDATE ON public.household_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_household_invitation_limit();

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.households FROM anon, authenticated;
REVOKE ALL ON TABLE public.household_members FROM anon, authenticated;
REVOKE ALL ON TABLE public.household_invitations FROM anon, authenticated;

DROP POLICY IF EXISTS "Deny all client access to households" ON public.households;
CREATE POLICY "Deny all client access to households" ON public.households
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all client access to household members" ON public.household_members;
CREATE POLICY "Deny all client access to household members" ON public.household_members
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all client access to household invitations" ON public.household_invitations;
CREATE POLICY "Deny all client access to household invitations" ON public.household_invitations
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Tool tables and calendar pins: household members can use the Admin's rows.
-- users_tools and user_tool_entitlements stay owner-only so a User cannot add tools.
CREATE OR REPLACE FUNCTION public.rewrite_household_owner_check(expr TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result TEXT := expr;
BEGIN
  IF result IS NULL OR result ILIKE '%can_access_user_data%' THEN
    RETURN result;
  END IF;

  result := regexp_replace(
    result,
    '(([[:alnum:]_]+)\.)?user_id[[:space:]]*=[[:space:]]*\([[:space:]]*SELECT[[:space:]]+auth\.uid\(\)[[:space:]]*(AS[[:space:]]+uid)?[[:space:]]*\)',
    'public.can_access_user_data(\1user_id)',
    'gi'
  );
  result := regexp_replace(
    result,
    '\([[:space:]]*SELECT[[:space:]]+auth\.uid\(\)[[:space:]]*(AS[[:space:]]+uid)?[[:space:]]*\)[[:space:]]*=[[:space:]]*(([[:alnum:]_]+)\.)?user_id',
    'public.can_access_user_data(\2user_id)',
    'gi'
  );
  RETURN result;
END;
$$;

DO $$
DECLARE
  pol RECORD;
  new_qual TEXT;
  new_check TEXT;
  original TEXT;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (tablename LIKE 'tools\_%' OR tablename = 'calendar_pins')
      AND tablename <> 'tools'
      AND (
        COALESCE(qual, '') ILIKE '%auth.uid()%'
        OR COALESCE(with_check, '') ILIKE '%auth.uid()%'
        OR COALESCE(qual, '') ILIKE '%can_access_user_data%'
        OR COALESCE(with_check, '') ILIKE '%can_access_user_data%'
      )
      AND (
        COALESCE(qual, '') ILIKE '%user_id%'
        OR COALESCE(with_check, '') ILIKE '%user_id%'
      )
  LOOP
    new_qual := public.rewrite_household_owner_check(pol.qual);
    new_check := public.rewrite_household_owner_check(pol.with_check);
    original := COALESCE(pol.qual, '') || COALESCE(pol.with_check, '');

    IF new_qual IS NOT DISTINCT FROM pol.qual AND new_check IS NOT DISTINCT FROM pol.with_check THEN
      IF original ILIKE '%auth.uid()%' THEN
        RAISE NOTICE 'Household RLS left unchanged: %.%', pol.tablename, pol.policyname;
      END IF;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s',
      pol.policyname,
      pol.tablename,
      pol.permissive,
      pol.cmd,
      array_to_string(pol.roles, ', '),
      CASE WHEN new_qual IS NOT NULL THEN format(' USING (%s)', new_qual) ELSE '' END,
      CASE WHEN new_check IS NOT NULL THEN format(' WITH CHECK (%s)', new_check) ELSE '' END
    );
  END LOOP;
END $$;

-- Storage folder access follows the household Admin id used in object paths.
DO $$
DECLARE
  buckets TEXT[] := ARRAY[
    'address-book',
    'calendar-events',
    'cleaning-schedule',
    'end-of-life-planner',
    'event-budget-planner',
    'goals-tracking',
    'healthcare-appt-history',
    'home-maintenance-schedule',
    'hsa-tracker',
    'important-documents',
    'meal-planner',
    'notes',
    'pet-care-schedule',
    'repair-history',
    'shopping-list',
    'subscription-tracker',
    'to-do-list',
    'travel-log'
  ];
  bucket_name TEXT;
BEGIN
  FOREACH bucket_name IN ARRAY buckets LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', bucket_name || ': Users can upload to their own folder');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', bucket_name || ': Users can read their own files');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', bucket_name || ': Users can update their own files');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', bucket_name || ': Users can delete their own files');

    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L AND public.can_access_storage_owner((storage.foldername(name))[1]))',
      bucket_name || ': Users can upload to their own folder',
      bucket_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (bucket_id = %L AND public.can_access_storage_owner((storage.foldername(name))[1]))',
      bucket_name || ': Users can read their own files',
      bucket_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L AND public.can_access_storage_owner((storage.foldername(name))[1])) WITH CHECK (bucket_id = %L AND public.can_access_storage_owner((storage.foldername(name))[1]))',
      bucket_name || ': Users can update their own files',
      bucket_name,
      bucket_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L AND public.can_access_storage_owner((storage.foldername(name))[1]))',
      bucket_name || ': Users can delete their own files',
      bucket_name
    );
  END LOOP;
END $$;

-- Tool ownership stays with the household Admin. Members can read the list.
-- Adding, removing, or changing a tool requires the Admin's own user id.
ALTER TABLE public.users_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household can view owned tools" ON public.users_tools;
CREATE POLICY "Household can view owned tools" ON public.users_tools
  FOR SELECT TO authenticated
  USING (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Only account owner can insert tools" ON public.users_tools;
CREATE POLICY "Only account owner can insert tools" ON public.users_tools
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Only account owner can update tools" ON public.users_tools;
CREATE POLICY "Only account owner can update tools" ON public.users_tools
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Only account owner can delete tools" ON public.users_tools;
CREATE POLICY "Only account owner can delete tools" ON public.users_tools
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

NOTIFY pgrst, 'reload schema';
