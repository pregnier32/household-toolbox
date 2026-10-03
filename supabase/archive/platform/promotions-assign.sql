-- Atomic promotion assignment. Run after promotions.sql.
-- Safe to replace. Service role only.

CREATE OR REPLACE FUNCTION public.assign_promotion(
  p_user_id UUID,
  p_promotion_id UUID,
  p_source TEXT,
  p_assigned_by UUID,
  p_effective_at TIMESTAMPTZ,
  p_override BOOLEAN,
  p_note TEXT,
  p_signup BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  promo public.promotions%ROWTYPE;
  v_account_type TEXT;
  existing_count INTEGER;
  ordinal INTEGER;
  active_pricing INTEGER;
  partner UUID;
  campaign UUID;
  platform TEXT;
  assignment_id UUID;
  expires_at TIMESTAMPTZ;
BEGIN
  IF p_source NOT IN ('user_entered', 'automatic', 'admin_assigned') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'failed', 'message', 'That assignment could not be saved.');
  END IF;

  SELECT * INTO promo FROM public.promotions WHERE id = p_promotion_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'That code was not found.');
  END IF;

  SELECT users.account_type INTO v_account_type FROM public.users WHERE id = p_user_id;
  IF v_account_type IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'failed', 'message', 'That account was not found.');
  END IF;

  IF NOT p_override THEN
    IF promo.status <> 'active' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'unavailable', 'message', 'That code is not available.');
    END IF;
    IF promo.redeem_start_date IS NOT NULL AND promo.redeem_start_date > (p_effective_at AT TIME ZONE 'UTC')::date THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_started', 'message', 'That code is not active yet.');
    END IF;
    IF promo.redeem_end_date IS NOT NULL AND promo.redeem_end_date < (p_effective_at AT TIME ZONE 'UTC')::date THEN
      RETURN jsonb_build_object('ok', false, 'code', 'expired', 'message', 'That code has expired.');
    END IF;
    IF promo.eligible_account_type <> 'all' AND promo.eligible_account_type <> v_account_type THEN
      RETURN jsonb_build_object('ok', false, 'code', 'account_type', 'message', 'That code is not available for this account.');
    END IF;
    IF promo.eligible_users = 'new_users' AND NOT p_signup THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_eligible', 'message', 'That code is only for new accounts.');
    END IF;
    IF promo.eligible_users = 'existing_users' AND p_signup THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_eligible', 'message', 'That code is for existing accounts.');
    END IF;
    IF promo.assignment_method = 'admin_only' AND p_source = 'user_entered' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'unavailable', 'message', 'That code is not available.');
    END IF;
  END IF;

  SELECT COUNT(*) INTO existing_count
  FROM public.promotion_assignments
  WHERE promotion_id = promo.id AND user_id = p_user_id;

  IF promo.per_user = 'once' AND existing_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_used', 'message', 'That code was already used on this account.');
  END IF;

  IF NOT p_override AND promo.max_redemptions IS NOT NULL THEN
    IF (SELECT COUNT(*) FROM public.promotion_assignments WHERE promotion_id = promo.id) >= promo.max_redemptions THEN
      RETURN jsonb_build_object('ok', false, 'code', 'cap_reached', 'message', 'That code is no longer available.');
    END IF;
  END IF;

  IF NOT p_override AND promo.can_stack = false AND promo.benefit_type IN ('percent_100', 'percentage', 'fixed_amount') THEN
    SELECT COUNT(*) INTO active_pricing
    FROM public.promotion_assignments existing
    WHERE existing.user_id = p_user_id
      AND existing.removed_at IS NULL
      AND existing.effective_at <= p_effective_at
      AND (existing.expires_at IS NULL OR existing.expires_at > p_effective_at)
      AND existing.benefit_type IN ('percent_100', 'percentage', 'fixed_amount');
    IF active_pricing > 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_stackable', 'message', 'That code cannot be combined with the current account discount.');
    END IF;
  END IF;

  IF promo.per_user = 'once' THEN
    ordinal := 1;
  ELSE
    SELECT COALESCE(MAX(redemption_ordinal), 0) + 1 INTO ordinal
    FROM public.promotion_assignments
    WHERE promotion_id = promo.id AND user_id = p_user_id;
  END IF;

  expires_at := CASE promo.duration_unit
    WHEN 'lifetime' THEN NULL
    WHEN 'days' THEN p_effective_at + make_interval(days => promo.duration_amount)
    WHEN 'months' THEN p_effective_at + make_interval(months => promo.duration_amount)
    WHEN 'years' THEN p_effective_at + make_interval(years => promo.duration_amount)
  END;

  INSERT INTO public.promotion_assignments (
    user_id, promotion_id, source, assigned_by_user_id, assigned_at, effective_at, expires_at,
    override_used, internal_note, benefit_type, slot_mode, slot_count, percent_off, amount_cents,
    bonus_storage_bytes, duration_unit, duration_amount, display_name, public_code,
    customer_description_snapshot, redemption_ordinal
  ) VALUES (
    p_user_id, promo.id, p_source, p_assigned_by, NOW(), p_effective_at, expires_at,
    p_override, NULLIF(btrim(COALESCE(p_note, '')), ''), promo.benefit_type, promo.slot_mode, promo.slot_count,
    promo.percent_off, promo.amount_cents, promo.bonus_storage_bytes, promo.duration_unit, promo.duration_amount,
    promo.internal_name, promo.public_code, promo.customer_description, ordinal
  ) RETURNING id INTO assignment_id;

  INSERT INTO public.promotion_assignment_tools (assignment_id, tool_id)
  SELECT assignment_id, tool_id FROM public.promotion_tools WHERE promotion_id = promo.id;

  IF p_signup AND NOT EXISTS (SELECT 1 FROM public.user_acquisitions WHERE user_id = p_user_id) THEN
    partner := promo.partner_id;
    campaign := promo.campaign_id;
    platform := promo.platform_code;
    IF promo.campaign_id IS NOT NULL THEN
      SELECT campaigns.partner_id, campaigns.platform_code
      INTO partner, platform
      FROM public.campaigns
      WHERE campaigns.id = promo.campaign_id;
    END IF;
    IF partner IS NOT NULL OR campaign IS NOT NULL THEN
      INSERT INTO public.user_acquisitions (user_id, partner_id, campaign_id, promotion_id, public_code, acquired_at)
      VALUES (p_user_id, partner, campaign, promo.id, promo.public_code, p_effective_at);
    END IF;
  END IF;

  IF p_assigned_by IS NOT NULL AND p_source = 'admin_assigned' THEN
    INSERT INTO public.admin_actions (actor_user_id, action, subject_type, subject_id, note)
    VALUES (
      p_assigned_by,
      CASE WHEN p_override THEN 'eligibility_override' ELSE 'assignment_created' END,
      'assignment',
      assignment_id,
      NULLIF(btrim(COALESCE(p_note, '')), '')
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'assignment_id', assignment_id,
    'display_name', promo.internal_name,
    'public_code', promo.public_code,
    'customer_description', promo.customer_description,
    'effective_at', p_effective_at,
    'expires_at', expires_at
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_used', 'message', 'That code was already used on this account.');
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_manual_entitlement(
  p_user_id UUID,
  p_actor UUID,
  p_effective_at TIMESTAMPTZ,
  p_note TEXT,
  p_benefit_type TEXT,
  p_slot_mode TEXT,
  p_slot_count INTEGER,
  p_percent_off NUMERIC,
  p_amount_cents INTEGER,
  p_bonus_storage_bytes BIGINT,
  p_duration_unit TEXT,
  p_duration_amount INTEGER,
  p_display_name TEXT,
  p_customer_description TEXT,
  p_tool_ids UUID[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  assignment_id UUID;
  expires_at TIMESTAMPTZ;
  tool_id UUID;
BEGIN
  expires_at := CASE p_duration_unit
    WHEN 'lifetime' THEN NULL
    WHEN 'days' THEN p_effective_at + make_interval(days => p_duration_amount)
    WHEN 'months' THEN p_effective_at + make_interval(months => p_duration_amount)
    WHEN 'years' THEN p_effective_at + make_interval(years => p_duration_amount)
  END;

  INSERT INTO public.promotion_assignments (
    user_id, promotion_id, source, assigned_by_user_id, assigned_at, effective_at, expires_at,
    internal_note, benefit_type, slot_mode, slot_count, percent_off, amount_cents, bonus_storage_bytes,
    duration_unit, duration_amount, display_name, public_code, customer_description_snapshot, redemption_ordinal
  ) VALUES (
    p_user_id, NULL, 'manual', p_actor, NOW(), p_effective_at, expires_at,
    NULLIF(btrim(COALESCE(p_note, '')), ''), p_benefit_type, p_slot_mode, p_slot_count, p_percent_off,
    p_amount_cents, p_bonus_storage_bytes, p_duration_unit, p_duration_amount, p_display_name, NULL,
    p_customer_description, 1
  ) RETURNING id INTO assignment_id;

  IF p_tool_ids IS NOT NULL THEN
    FOREACH tool_id IN ARRAY p_tool_ids LOOP
      INSERT INTO public.promotion_assignment_tools (assignment_id, tool_id) VALUES (assignment_id, tool_id);
    END LOOP;
  END IF;

  INSERT INTO public.admin_actions (actor_user_id, action, subject_type, subject_id, note)
  VALUES (p_actor, 'manual_entitlement_created', 'assignment', assignment_id, NULLIF(btrim(COALESCE(p_note, '')), ''));

  RETURN jsonb_build_object('ok', true, 'assignment_id', assignment_id, 'expires_at', expires_at);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_promotion(UUID, UUID, TEXT, UUID, TIMESTAMPTZ, BOOLEAN, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_manual_entitlement(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, INTEGER, NUMERIC, INTEGER, BIGINT, TEXT, INTEGER, TEXT, TEXT, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_promotion(UUID, UUID, TEXT, UUID, TIMESTAMPTZ, BOOLEAN, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_manual_entitlement(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, INTEGER, NUMERIC, INTEGER, BIGINT, TEXT, INTEGER, TEXT, TEXT, UUID[]) TO service_role;

NOTIFY pgrst, 'reload schema';
