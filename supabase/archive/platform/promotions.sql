-- Promotions, assignments, campaigns, partners, acquisition, and account notices.
-- Safe to re-run. Does not change trials, tool ownership, storage enforcement, or households.
--
-- Campaign attribution:
-- If promotions.campaign_id is set, partner and platform come from that campaign.
-- The promotion row must leave partner_id and platform_code null.
-- A promotion with no campaign may set partner_id and platform_code directly.

-- ============================================================================
-- Users: account type and test-account flag
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'personal';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_account_type_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_account_type_check
      CHECK (account_type IN ('personal', 'business'));
  END IF;
END $$;

UPDATE public.users
SET account_type = 'personal'
WHERE account_type IS NULL;

-- ============================================================================
-- Shared updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Platforms
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platforms (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  CONSTRAINT platforms_code_not_blank CHECK (length(trim(code)) > 0),
  CONSTRAINT platforms_label_not_blank CHECK (length(trim(label)) > 0)
);

-- ============================================================================
-- Partners
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL,
  revenue_share_percent NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partners_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT partners_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT partners_revenue_share_check CHECK (
    revenue_share_percent IS NULL
    OR (revenue_share_percent >= 0 AND revenue_share_percent <= 100)
  )
);

DROP TRIGGER IF EXISTS trigger_partners_updated_at ON public.partners;
CREATE TRIGGER trigger_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.partner_platforms (
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  platform_code TEXT NOT NULL REFERENCES public.platforms(code) ON DELETE RESTRICT,
  PRIMARY KEY (partner_id, platform_code)
);

-- ============================================================================
-- Campaigns
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  platform_code TEXT NOT NULL REFERENCES public.platforms(code) ON DELETE RESTRICT,
  starts_on DATE,
  ends_on DATE,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT campaigns_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT campaigns_status_check CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  CONSTRAINT campaigns_window_check CHECK (
    ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on
  )
);

CREATE INDEX IF NOT EXISTS idx_campaigns_partner_id ON public.campaigns (partner_id);

DROP TRIGGER IF EXISTS trigger_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER trigger_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- Promotions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_name TEXT NOT NULL,
  public_code TEXT,
  customer_description TEXT NOT NULL,
  admin_notes TEXT,
  status TEXT NOT NULL,
  redeem_start_date DATE,
  redeem_end_date DATE,
  benefit_type TEXT NOT NULL,
  slot_mode TEXT,
  slot_count INTEGER,
  percent_off NUMERIC(5,2),
  amount_cents INTEGER,
  bonus_storage_bytes BIGINT,
  duration_amount INTEGER,
  duration_unit TEXT NOT NULL,
  max_redemptions INTEGER,
  per_user TEXT NOT NULL,
  eligible_users TEXT NOT NULL,
  eligible_account_type TEXT NOT NULL,
  can_stack BOOLEAN NOT NULL,
  assignment_method TEXT NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  partner_id UUID REFERENCES public.partners(id) ON DELETE RESTRICT,
  platform_code TEXT REFERENCES public.platforms(code) ON DELETE RESTRICT,
  revenue_share_percent NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT promotions_internal_name_not_blank CHECK (length(trim(internal_name)) > 0),
  CONSTRAINT promotions_customer_description_not_blank CHECK (length(trim(customer_description)) > 0),
  CONSTRAINT promotions_public_code_not_blank CHECK (
    public_code IS NULL OR length(trim(public_code)) > 0
  ),
  CONSTRAINT promotions_status_check CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  CONSTRAINT promotions_slot_mode_check CHECK (
    slot_mode IS NULL OR slot_mode IN ('additional', 'total')
  ),
  CONSTRAINT promotions_duration_unit_check CHECK (
    duration_unit IN ('days', 'months', 'years', 'lifetime')
  ),
  CONSTRAINT promotions_duration_check CHECK (
    (duration_unit = 'lifetime' AND duration_amount IS NULL)
    OR (duration_unit IN ('days', 'months', 'years') AND duration_amount IS NOT NULL AND duration_amount > 0)
  ),
  CONSTRAINT promotions_per_user_check CHECK (per_user IN ('once', 'repeatable')),
  CONSTRAINT promotions_eligible_users_check CHECK (
    eligible_users IN ('everyone', 'new_users', 'existing_users')
  ),
  CONSTRAINT promotions_eligible_account_type_check CHECK (
    eligible_account_type IN ('all', 'personal', 'business')
  ),
  CONSTRAINT promotions_assignment_method_check CHECK (
    assignment_method IN ('public_code', 'automatic', 'admin_only')
  ),
  CONSTRAINT promotions_benefit_type_check CHECK (
    benefit_type IN (
      'free_tool_slots',
      'specific_tools',
      'percent_100',
      'percentage',
      'fixed_amount',
      'bonus_storage'
    )
  ),
  CONSTRAINT promotions_benefit_shape_check CHECK (
    (
      benefit_type = 'free_tool_slots'
      AND slot_mode IS NOT NULL
      AND slot_count IS NOT NULL AND slot_count > 0
      AND percent_off IS NULL
      AND amount_cents IS NULL
      AND bonus_storage_bytes IS NULL
    )
    OR (
      benefit_type = 'specific_tools'
      AND slot_mode IS NULL AND slot_count IS NULL
      AND percent_off IS NULL AND amount_cents IS NULL AND bonus_storage_bytes IS NULL
    )
    OR (
      benefit_type = 'percent_100'
      AND slot_mode IS NULL AND slot_count IS NULL
      AND percent_off IS NULL AND amount_cents IS NULL AND bonus_storage_bytes IS NULL
    )
    OR (
      benefit_type = 'percentage'
      AND percent_off IS NOT NULL AND percent_off > 0 AND percent_off <= 100
      AND slot_mode IS NULL AND slot_count IS NULL
      AND amount_cents IS NULL AND bonus_storage_bytes IS NULL
    )
    OR (
      benefit_type = 'fixed_amount'
      AND amount_cents IS NOT NULL AND amount_cents > 0
      AND slot_mode IS NULL AND slot_count IS NULL
      AND percent_off IS NULL AND bonus_storage_bytes IS NULL
    )
    OR (
      benefit_type = 'bonus_storage'
      AND bonus_storage_bytes IS NOT NULL AND bonus_storage_bytes > 0
      AND slot_mode IS NULL AND slot_count IS NULL
      AND percent_off IS NULL AND amount_cents IS NULL
    )
  ),
  CONSTRAINT promotions_redeem_window_check CHECK (
    redeem_end_date IS NULL OR redeem_start_date IS NULL OR redeem_end_date >= redeem_start_date
  ),
  CONSTRAINT promotions_max_redemptions_check CHECK (
    max_redemptions IS NULL OR max_redemptions > 0
  ),
  CONSTRAINT promotions_revenue_share_check CHECK (
    revenue_share_percent IS NULL
    OR (revenue_share_percent >= 0 AND revenue_share_percent <= 100)
  ),
  CONSTRAINT promotions_campaign_attribution_check CHECK (
    campaign_id IS NULL
    OR (partner_id IS NULL AND platform_code IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS promotions_public_code_lower_key
  ON public.promotions (lower(public_code))
  WHERE public_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promotions_status ON public.promotions (status);
CREATE INDEX IF NOT EXISTS idx_promotions_campaign_id ON public.promotions (campaign_id);
CREATE INDEX IF NOT EXISTS idx_promotions_partner_id ON public.promotions (partner_id);

DROP TRIGGER IF EXISTS trigger_promotions_updated_at ON public.promotions;
CREATE TRIGGER trigger_promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.promotion_tools (
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE RESTRICT,
  tool_id UUID NOT NULL REFERENCES public.tools(id) ON DELETE RESTRICT,
  PRIMARY KEY (promotion_id, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_promotion_tools_tool_id ON public.promotion_tools (tool_id);

-- ============================================================================
-- Assignments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.promotion_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  promotion_id UUID REFERENCES public.promotions(id) ON DELETE RESTRICT,
  source TEXT NOT NULL,
  assigned_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  removed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  removal_reason TEXT,
  override_used BOOLEAN NOT NULL DEFAULT false,
  internal_note TEXT,
  benefit_type TEXT NOT NULL,
  slot_mode TEXT,
  slot_count INTEGER,
  percent_off NUMERIC(5,2),
  amount_cents INTEGER,
  bonus_storage_bytes BIGINT,
  duration_unit TEXT NOT NULL,
  duration_amount INTEGER,
  display_name TEXT NOT NULL,
  public_code TEXT,
  customer_description_snapshot TEXT NOT NULL,
  redemption_ordinal INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT promotion_assignments_source_check CHECK (
    source IN ('user_entered', 'automatic', 'admin_assigned', 'manual')
  ),
  CONSTRAINT promotion_assignments_source_promotion_check CHECK (
    (source = 'manual' AND promotion_id IS NULL)
    OR (source <> 'manual' AND promotion_id IS NOT NULL)
  ),
  CONSTRAINT promotion_assignments_ordinal_check CHECK (redemption_ordinal > 0),
  CONSTRAINT promotion_assignments_display_name_not_blank CHECK (length(trim(display_name)) > 0),
  CONSTRAINT promotion_assignments_description_not_blank CHECK (
    length(trim(customer_description_snapshot)) > 0
  ),
  CONSTRAINT promotion_assignments_public_code_not_blank CHECK (
    public_code IS NULL OR length(trim(public_code)) > 0
  ),
  CONSTRAINT promotion_assignments_slot_mode_check CHECK (
    slot_mode IS NULL OR slot_mode IN ('additional', 'total')
  ),
  CONSTRAINT promotion_assignments_duration_unit_check CHECK (
    duration_unit IN ('days', 'months', 'years', 'lifetime')
  ),
  CONSTRAINT promotion_assignments_duration_check CHECK (
    (duration_unit = 'lifetime' AND duration_amount IS NULL)
    OR (duration_unit IN ('days', 'months', 'years') AND duration_amount IS NOT NULL AND duration_amount > 0)
  ),
  CONSTRAINT promotion_assignments_benefit_type_check CHECK (
    benefit_type IN (
      'free_tool_slots',
      'specific_tools',
      'percent_100',
      'percentage',
      'fixed_amount',
      'bonus_storage'
    )
  ),
  CONSTRAINT promotion_assignments_benefit_shape_check CHECK (
    (
      benefit_type = 'free_tool_slots'
      AND slot_mode IS NOT NULL
      AND slot_count IS NOT NULL AND slot_count > 0
      AND percent_off IS NULL
      AND amount_cents IS NULL
      AND bonus_storage_bytes IS NULL
    )
    OR (
      benefit_type = 'specific_tools'
      AND slot_mode IS NULL AND slot_count IS NULL
      AND percent_off IS NULL AND amount_cents IS NULL AND bonus_storage_bytes IS NULL
    )
    OR (
      benefit_type = 'percent_100'
      AND slot_mode IS NULL AND slot_count IS NULL
      AND percent_off IS NULL AND amount_cents IS NULL AND bonus_storage_bytes IS NULL
    )
    OR (
      benefit_type = 'percentage'
      AND percent_off IS NOT NULL AND percent_off > 0 AND percent_off <= 100
      AND slot_mode IS NULL AND slot_count IS NULL
      AND amount_cents IS NULL AND bonus_storage_bytes IS NULL
    )
    OR (
      benefit_type = 'fixed_amount'
      AND amount_cents IS NOT NULL AND amount_cents > 0
      AND slot_mode IS NULL AND slot_count IS NULL
      AND percent_off IS NULL AND bonus_storage_bytes IS NULL
    )
    OR (
      benefit_type = 'bonus_storage'
      AND bonus_storage_bytes IS NOT NULL AND bonus_storage_bytes > 0
      AND slot_mode IS NULL AND slot_count IS NULL
      AND percent_off IS NULL AND amount_cents IS NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS promotion_assignments_user_promotion_ordinal_key
  ON public.promotion_assignments (user_id, promotion_id, redemption_ordinal)
  WHERE promotion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promotion_assignments_user_effective
  ON public.promotion_assignments (user_id, effective_at);

CREATE INDEX IF NOT EXISTS idx_promotion_assignments_promotion_assigned
  ON public.promotion_assignments (promotion_id, assigned_at);

CREATE INDEX IF NOT EXISTS idx_promotion_assignments_user_open
  ON public.promotion_assignments (user_id)
  WHERE removed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.promotion_assignment_tools (
  assignment_id UUID NOT NULL REFERENCES public.promotion_assignments(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES public.tools(id) ON DELETE RESTRICT,
  PRIMARY KEY (assignment_id, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_promotion_assignment_tools_tool_id
  ON public.promotion_assignment_tools (tool_id);

-- ============================================================================
-- Acquisition
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_acquisitions (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.partners(id) ON DELETE RESTRICT,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  promotion_id UUID REFERENCES public.promotions(id) ON DELETE RESTRICT,
  public_code TEXT,
  acquired_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_acquisitions_partner_id ON public.user_acquisitions (partner_id);
CREATE INDEX IF NOT EXISTS idx_user_acquisitions_campaign_id ON public.user_acquisitions (campaign_id);
CREATE INDEX IF NOT EXISTS idx_user_acquisitions_promotion_id ON public.user_acquisitions (promotion_id);

-- ============================================================================
-- Account notices
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.account_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  event_key TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  cta_label TEXT,
  href TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  CONSTRAINT account_notices_kind_check CHECK (
    kind IN (
      'trial_ending',
      'trial_ended',
      'promotion_expiring',
      'promotion_expired',
      'cost_changing',
      'payment_required',
      'access_changed',
      'storage_expiring'
    )
  ),
  CONSTRAINT account_notices_severity_check CHECK (severity IN ('info', 'attention', 'action')),
  CONSTRAINT account_notices_event_key_not_blank CHECK (length(trim(event_key)) > 0),
  CONSTRAINT account_notices_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT account_notices_body_not_blank CHECK (length(trim(body)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS account_notices_user_event_key
  ON public.account_notices (user_id, event_key);

CREATE INDEX IF NOT EXISTS idx_account_notices_user_created
  ON public.account_notices (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_notices_user_unread
  ON public.account_notices (user_id)
  WHERE read_at IS NULL;

-- ============================================================================
-- Admin actions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  note TEXT,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_actions_action_not_blank CHECK (length(trim(action)) > 0),
  CONSTRAINT admin_actions_subject_type_check CHECK (subject_type IN ('promotion', 'assignment'))
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_subject
  ON public.admin_actions (subject_type, subject_id, created_at DESC);

-- ============================================================================
-- RLS: clients denied. Service role bypasses RLS.
-- ============================================================================

ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_assignment_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_acquisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target TEXT;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'platforms',
    'partners',
    'partner_platforms',
    'campaigns',
    'promotions',
    'promotion_tools',
    'promotion_assignments',
    'promotion_assignment_tools',
    'user_acquisitions',
    'account_notices',
    'admin_actions'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Deny all client access to %1$s" ON public.%1$I', target);
    EXECUTE format(
      'CREATE POLICY "Deny all client access to %1$s" ON public.%1$I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      target
    );
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', target);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', target);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
