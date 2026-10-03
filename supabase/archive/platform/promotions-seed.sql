-- Seed platforms, the default personal free-slot promotion, and one assignment
-- per existing household admin. Safe to re-run. Does not overwrite an edited
-- NEWUSER2 row. Does not create acquisition rows. Does not touch trial history.
--
-- Run supabase/archive/platform/promotions.sql first.

INSERT INTO public.platforms (code, label)
VALUES
  ('tiktok', 'TikTok'),
  ('facebook', 'Facebook'),
  ('instagram', 'Instagram'),
  ('youtube', 'YouTube'),
  ('email', 'Email'),
  ('referral', 'Referral'),
  ('other', 'Other')
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label;

INSERT INTO public.promotions (
  internal_name,
  public_code,
  customer_description,
  admin_notes,
  status,
  benefit_type,
  slot_mode,
  slot_count,
  duration_unit,
  max_redemptions,
  per_user,
  eligible_users,
  eligible_account_type,
  can_stack,
  assignment_method
)
SELECT
  'New User — 2 Free Tools',
  'NEWUSER2',
  'Your personal account includes 2 free tool slots.',
  'Default benefit for personal household admins. Slots are open spots, not a specific tool. Separate from the one-time 7-day tool trial.',
  'active',
  'free_tool_slots',
  'total',
  2,
  'lifetime',
  NULL,
  'once',
  'new_users',
  'personal',
  true,
  'automatic'
WHERE NOT EXISTS (
  SELECT 1 FROM public.promotions WHERE lower(public_code) = 'newuser2'
);

-- One lifetime assignment for each household admin. Invited members are not included.
INSERT INTO public.promotion_assignments (
  user_id,
  promotion_id,
  source,
  assigned_at,
  effective_at,
  expires_at,
  benefit_type,
  slot_mode,
  slot_count,
  duration_unit,
  display_name,
  public_code,
  customer_description_snapshot,
  redemption_ordinal
)
SELECT
  households.admin_user_id,
  promotions.id,
  'automatic',
  statement_timestamp(),
  statement_timestamp(),
  NULL,
  promotions.benefit_type,
  promotions.slot_mode,
  promotions.slot_count,
  promotions.duration_unit,
  promotions.internal_name,
  promotions.public_code,
  promotions.customer_description,
  1
FROM public.households
JOIN public.users ON users.id = households.admin_user_id
JOIN public.promotions ON lower(promotions.public_code) = 'newuser2'
WHERE users.account_type = 'personal'
  AND NOT EXISTS (
    SELECT 1
    FROM public.promotion_assignments existing
    WHERE existing.user_id = households.admin_user_id
      AND existing.promotion_id = promotions.id
  );

NOTIFY pgrst, 'reload schema';
