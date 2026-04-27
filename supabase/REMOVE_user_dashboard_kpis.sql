-- Removes legacy dashboard KPI preference table and helper function.
-- Safe to run multiple times.

DO $$
BEGIN
  IF to_regclass('public.user_dashboard_kpis') IS NOT NULL THEN
    EXECUTE 'DROP TABLE public.user_dashboard_kpis CASCADE';
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.update_user_dashboard_kpis_updated_at();
