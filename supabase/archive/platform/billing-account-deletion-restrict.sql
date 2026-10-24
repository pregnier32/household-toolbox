-- Apply only with the account-deletion application code.
-- The deletion workflow archives billing rows, then deletes those live rows,
-- then deletes public.users. RESTRICT stops an unguarded user delete from
-- cascading the ledger away before that archive exists.
-- Do not apply this while an older application build is still deleting users.
-- That build does not archive first, so RESTRICT would make account deletion fail.

ALTER TABLE public.billing_accounts DROP CONSTRAINT IF EXISTS billing_accounts_user_id_fkey;
ALTER TABLE public.billing_accounts
  ADD CONSTRAINT billing_accounts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.billing_invoices DROP CONSTRAINT IF EXISTS billing_invoices_user_id_fkey;
ALTER TABLE public.billing_invoices
  ADD CONSTRAINT billing_invoices_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.billing_operations DROP CONSTRAINT IF EXISTS billing_operations_user_id_fkey;
ALTER TABLE public.billing_operations
  ADD CONSTRAINT billing_operations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.billing_checkout_sessions DROP CONSTRAINT IF EXISTS billing_checkout_sessions_user_id_fkey;
ALTER TABLE public.billing_checkout_sessions
  ADD CONSTRAINT billing_checkout_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.billing_periods DROP CONSTRAINT IF EXISTS billing_periods_user_id_fkey;
ALTER TABLE public.billing_periods
  ADD CONSTRAINT billing_periods_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT;
