-- Site promo flag. One active discount code can be applied to new household accounts.
-- Safe to re-run. Does not change existing assignments.
-- After this script, re-run promotions-save.sql so saving a code can update the flag.

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS is_site_promo BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS promotions_one_site_promo
  ON public.promotions (is_site_promo)
  WHERE is_site_promo;

UPDATE public.promotions
SET is_site_promo = true
WHERE id = (
  SELECT id
  FROM public.promotions
  WHERE status = 'active'
    AND lower(public_code) = '2-free'
  ORDER BY created_at
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM public.promotions WHERE is_site_promo = true
);

NOTIFY pgrst, 'reload schema';
