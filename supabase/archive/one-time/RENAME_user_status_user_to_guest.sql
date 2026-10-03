-- User Status 'user' is now 'guest'.
-- This changes public.users.user_status only.
-- Household membership role stays 'admin' or 'user'.
-- Safe to re-run.

UPDATE public.users
SET user_status = 'guest'
WHERE lower(user_status) = 'user';
