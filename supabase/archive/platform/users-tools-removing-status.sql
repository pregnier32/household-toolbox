-- A removal claims the ownership row as 'removing' before records and files
-- are deleted. That status blocks new writes and lets a failed cleanup be retried.
-- 'inactive' stays allowed for any ownership row already stored that way.
ALTER TABLE public.users_tools DROP CONSTRAINT IF EXISTS users_tools_status_check;

ALTER TABLE public.users_tools
  ADD CONSTRAINT users_tools_status_check
  CHECK (status IN ('active', 'inactive', 'removing'));
