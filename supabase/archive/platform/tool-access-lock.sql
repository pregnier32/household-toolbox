-- Household tool-access lock. Safe to re-run.
-- The server writes billing_accounts.tool_access_locked. Clients cannot.
-- Tool rows and private file buckets already call can_access_user_data / can_access_storage_owner.

ALTER TABLE public.billing_accounts
  ADD COLUMN IF NOT EXISTS tool_access_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tool_access_reason TEXT,
  ADD COLUMN IF NOT EXISTS tool_access_synced_at TIMESTAMPTZ;

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS collection_state TEXT,
  ADD COLUMN IF NOT EXISTS collection_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

ALTER TABLE public.billing_invoices DROP CONSTRAINT IF EXISTS billing_invoices_collection_check;
ALTER TABLE public.billing_invoices
  ADD CONSTRAINT billing_invoices_collection_check
  CHECK (collection_state IS NULL OR collection_state IN ('processing', 'authentication_required', 'failed', 'overdue'));

CREATE OR REPLACE FUNCTION public.household_tool_access_locked(owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT tool_access_locked
    FROM public.billing_accounts
    WHERE user_id = owner_id
  ), false);
$$;

REVOKE ALL ON FUNCTION public.household_tool_access_locked(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.household_tool_access_locked(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_access_user_data(owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owner_id IS NOT NULL
    AND NOT public.household_tool_access_locked(owner_id)
    AND (
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

REVOKE ALL ON FUNCTION public.can_access_user_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_user_data(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
