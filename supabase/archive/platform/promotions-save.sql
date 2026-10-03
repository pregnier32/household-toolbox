-- Atomic promotion create/update with definition tool rows and one audit record.
-- Does not change promotion_assignments or promotion_assignment_tools.
-- Safe to replace. Service role only.

CREATE OR REPLACE FUNCTION public.save_promotion(
  p_actor UUID,
  p_promotion_id UUID,
  p_fields JSONB,
  p_tool_ids UUID[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  existing public.promotions%ROWTYPE;
  saved_id UUID;
  benefit TEXT;
  tool_ids UUID[];
  old_tools UUID[];
  new_tools UUID[];
  changed JSONB := '{}'::jsonb;
  detail JSONB := '{}'::jsonb;
  action_name TEXT;
BEGIN
  benefit := p_fields->>'benefit_type';
  tool_ids := COALESCE(p_tool_ids, ARRAY[]::uuid[]);
  IF benefit IS DISTINCT FROM 'specific_tools' THEN
    tool_ids := ARRAY[]::uuid[];
  END IF;
  IF benefit = 'specific_tools' AND COALESCE(array_length(tool_ids, 1), 0) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'tools_required', 'message', 'Choose at least one tool.');
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(tool_ids) AS submitted(tool_id)
    WHERE NOT EXISTS (SELECT 1 FROM public.tools WHERE tools.id = submitted.tool_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_tool', 'message', 'One of the selected tools is not in the catalog.');
  END IF;

  IF p_promotion_id IS NULL THEN
    INSERT INTO public.promotions (
      internal_name, public_code, customer_description, admin_notes, status,
      redeem_start_date, redeem_end_date, benefit_type, slot_mode, slot_count, percent_off,
      amount_cents, bonus_storage_bytes, duration_unit, duration_amount, max_redemptions,
      per_user, eligible_users, eligible_account_type, can_stack, assignment_method,
      campaign_id, partner_id, platform_code, revenue_share_percent
    ) VALUES (
      p_fields->>'internal_name',
      NULLIF(p_fields->>'public_code', ''),
      p_fields->>'customer_description',
      NULLIF(p_fields->>'admin_notes', ''),
      p_fields->>'status',
      NULLIF(p_fields->>'redeem_start_date', '')::date,
      NULLIF(p_fields->>'redeem_end_date', '')::date,
      benefit,
      NULLIF(p_fields->>'slot_mode', ''),
      NULLIF(p_fields->>'slot_count', '')::integer,
      NULLIF(p_fields->>'percent_off', '')::numeric,
      NULLIF(p_fields->>'amount_cents', '')::integer,
      NULLIF(p_fields->>'bonus_storage_bytes', '')::bigint,
      p_fields->>'duration_unit',
      NULLIF(p_fields->>'duration_amount', '')::integer,
      NULLIF(p_fields->>'max_redemptions', '')::integer,
      p_fields->>'per_user',
      p_fields->>'eligible_users',
      p_fields->>'eligible_account_type',
      COALESCE((p_fields->>'can_stack')::boolean, false),
      p_fields->>'assignment_method',
      NULLIF(p_fields->>'campaign_id', '')::uuid,
      NULLIF(p_fields->>'partner_id', '')::uuid,
      NULLIF(p_fields->>'platform_code', ''),
      NULLIF(p_fields->>'revenue_share_percent', '')::numeric
    ) RETURNING id INTO saved_id;
    action_name := 'promotion_created';
    detail := jsonb_build_object('created', p_fields, 'tools', to_jsonb(tool_ids));
  ELSE
    SELECT * INTO existing FROM public.promotions WHERE id = p_promotion_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'That discount code was not found.');
    END IF;
    SELECT COALESCE(array_agg(tool_id ORDER BY tool_id), ARRAY[]::uuid[])
      INTO old_tools
      FROM public.promotion_tools
      WHERE promotion_id = p_promotion_id;

    UPDATE public.promotions SET
      internal_name = p_fields->>'internal_name',
      public_code = NULLIF(p_fields->>'public_code', ''),
      customer_description = p_fields->>'customer_description',
      admin_notes = NULLIF(p_fields->>'admin_notes', ''),
      status = p_fields->>'status',
      redeem_start_date = NULLIF(p_fields->>'redeem_start_date', '')::date,
      redeem_end_date = NULLIF(p_fields->>'redeem_end_date', '')::date,
      benefit_type = benefit,
      slot_mode = NULLIF(p_fields->>'slot_mode', ''),
      slot_count = NULLIF(p_fields->>'slot_count', '')::integer,
      percent_off = NULLIF(p_fields->>'percent_off', '')::numeric,
      amount_cents = NULLIF(p_fields->>'amount_cents', '')::integer,
      bonus_storage_bytes = NULLIF(p_fields->>'bonus_storage_bytes', '')::bigint,
      duration_unit = p_fields->>'duration_unit',
      duration_amount = NULLIF(p_fields->>'duration_amount', '')::integer,
      max_redemptions = NULLIF(p_fields->>'max_redemptions', '')::integer,
      per_user = p_fields->>'per_user',
      eligible_users = p_fields->>'eligible_users',
      eligible_account_type = p_fields->>'eligible_account_type',
      can_stack = COALESCE((p_fields->>'can_stack')::boolean, false),
      assignment_method = p_fields->>'assignment_method',
      campaign_id = NULLIF(p_fields->>'campaign_id', '')::uuid,
      partner_id = NULLIF(p_fields->>'partner_id', '')::uuid,
      platform_code = NULLIF(p_fields->>'platform_code', ''),
      revenue_share_percent = NULLIF(p_fields->>'revenue_share_percent', '')::numeric
    WHERE id = p_promotion_id;
    saved_id := p_promotion_id;
    action_name := 'promotion_updated';

    IF existing.internal_name IS DISTINCT FROM p_fields->>'internal_name' THEN
      changed := changed || jsonb_build_object('internal_name', jsonb_build_object('from', existing.internal_name, 'to', p_fields->>'internal_name'));
    END IF;
    IF existing.benefit_type IS DISTINCT FROM benefit THEN
      changed := changed || jsonb_build_object('benefit_type', jsonb_build_object('from', existing.benefit_type, 'to', benefit));
    END IF;
    IF existing.public_code IS DISTINCT FROM NULLIF(p_fields->>'public_code', '') THEN
      changed := changed || jsonb_build_object('public_code', jsonb_build_object('from', existing.public_code, 'to', NULLIF(p_fields->>'public_code', '')));
    END IF;
    IF existing.customer_description IS DISTINCT FROM p_fields->>'customer_description' THEN
      changed := changed || jsonb_build_object('customer_description', jsonb_build_object('from', existing.customer_description, 'to', p_fields->>'customer_description'));
    END IF;
    IF existing.status IS DISTINCT FROM p_fields->>'status' THEN
      changed := changed || jsonb_build_object('status', jsonb_build_object('from', existing.status, 'to', p_fields->>'status'));
    END IF;
    IF existing.percent_off IS DISTINCT FROM NULLIF(p_fields->>'percent_off', '')::numeric THEN
      changed := changed || jsonb_build_object('percent_off', jsonb_build_object('from', existing.percent_off, 'to', NULLIF(p_fields->>'percent_off', '')::numeric));
    END IF;
    IF existing.amount_cents IS DISTINCT FROM NULLIF(p_fields->>'amount_cents', '')::integer THEN
      changed := changed || jsonb_build_object('amount_cents', jsonb_build_object('from', existing.amount_cents, 'to', NULLIF(p_fields->>'amount_cents', '')::integer));
    END IF;
    IF existing.slot_mode IS DISTINCT FROM NULLIF(p_fields->>'slot_mode', '') THEN
      changed := changed || jsonb_build_object('slot_mode', jsonb_build_object('from', existing.slot_mode, 'to', NULLIF(p_fields->>'slot_mode', '')));
    END IF;
    IF existing.slot_count IS DISTINCT FROM NULLIF(p_fields->>'slot_count', '')::integer THEN
      changed := changed || jsonb_build_object('slot_count', jsonb_build_object('from', existing.slot_count, 'to', NULLIF(p_fields->>'slot_count', '')::integer));
    END IF;
    IF existing.duration_unit IS DISTINCT FROM p_fields->>'duration_unit' THEN
      changed := changed || jsonb_build_object('duration_unit', jsonb_build_object('from', existing.duration_unit, 'to', p_fields->>'duration_unit'));
    END IF;
    IF existing.duration_amount IS DISTINCT FROM NULLIF(p_fields->>'duration_amount', '')::integer THEN
      changed := changed || jsonb_build_object('duration_amount', jsonb_build_object('from', existing.duration_amount, 'to', NULLIF(p_fields->>'duration_amount', '')::integer));
    END IF;
    IF existing.admin_notes IS DISTINCT FROM NULLIF(p_fields->>'admin_notes', '') THEN
      changed := changed || jsonb_build_object('admin_notes', jsonb_build_object('from', existing.admin_notes, 'to', NULLIF(p_fields->>'admin_notes', '')));
    END IF;
    IF existing.redeem_start_date IS DISTINCT FROM NULLIF(p_fields->>'redeem_start_date', '')::date THEN
      changed := changed || jsonb_build_object('redeem_start_date', jsonb_build_object('from', existing.redeem_start_date, 'to', NULLIF(p_fields->>'redeem_start_date', '')::date));
    END IF;
    IF existing.redeem_end_date IS DISTINCT FROM NULLIF(p_fields->>'redeem_end_date', '')::date THEN
      changed := changed || jsonb_build_object('redeem_end_date', jsonb_build_object('from', existing.redeem_end_date, 'to', NULLIF(p_fields->>'redeem_end_date', '')::date));
    END IF;
    IF existing.bonus_storage_bytes IS DISTINCT FROM NULLIF(p_fields->>'bonus_storage_bytes', '')::bigint THEN
      changed := changed || jsonb_build_object('bonus_storage_bytes', jsonb_build_object('from', existing.bonus_storage_bytes, 'to', NULLIF(p_fields->>'bonus_storage_bytes', '')::bigint));
    END IF;
    IF existing.max_redemptions IS DISTINCT FROM NULLIF(p_fields->>'max_redemptions', '')::integer THEN
      changed := changed || jsonb_build_object('max_redemptions', jsonb_build_object('from', existing.max_redemptions, 'to', NULLIF(p_fields->>'max_redemptions', '')::integer));
    END IF;
    IF existing.per_user IS DISTINCT FROM p_fields->>'per_user' THEN
      changed := changed || jsonb_build_object('per_user', jsonb_build_object('from', existing.per_user, 'to', p_fields->>'per_user'));
    END IF;
    IF existing.eligible_users IS DISTINCT FROM p_fields->>'eligible_users' THEN
      changed := changed || jsonb_build_object('eligible_users', jsonb_build_object('from', existing.eligible_users, 'to', p_fields->>'eligible_users'));
    END IF;
    IF existing.eligible_account_type IS DISTINCT FROM p_fields->>'eligible_account_type' THEN
      changed := changed || jsonb_build_object('eligible_account_type', jsonb_build_object('from', existing.eligible_account_type, 'to', p_fields->>'eligible_account_type'));
    END IF;
    IF existing.can_stack IS DISTINCT FROM COALESCE((p_fields->>'can_stack')::boolean, false) THEN
      changed := changed || jsonb_build_object('can_stack', jsonb_build_object('from', existing.can_stack, 'to', COALESCE((p_fields->>'can_stack')::boolean, false)));
    END IF;
    IF existing.assignment_method IS DISTINCT FROM p_fields->>'assignment_method' THEN
      changed := changed || jsonb_build_object('assignment_method', jsonb_build_object('from', existing.assignment_method, 'to', p_fields->>'assignment_method'));
    END IF;
    IF existing.campaign_id IS DISTINCT FROM NULLIF(p_fields->>'campaign_id', '')::uuid THEN
      changed := changed || jsonb_build_object('campaign_id', jsonb_build_object('from', existing.campaign_id, 'to', NULLIF(p_fields->>'campaign_id', '')::uuid));
    END IF;
    IF existing.partner_id IS DISTINCT FROM NULLIF(p_fields->>'partner_id', '')::uuid THEN
      changed := changed || jsonb_build_object('partner_id', jsonb_build_object('from', existing.partner_id, 'to', NULLIF(p_fields->>'partner_id', '')::uuid));
    END IF;
    IF existing.platform_code IS DISTINCT FROM NULLIF(p_fields->>'platform_code', '') THEN
      changed := changed || jsonb_build_object('platform_code', jsonb_build_object('from', existing.platform_code, 'to', NULLIF(p_fields->>'platform_code', '')));
    END IF;
    IF existing.revenue_share_percent IS DISTINCT FROM NULLIF(p_fields->>'revenue_share_percent', '')::numeric THEN
      changed := changed || jsonb_build_object('revenue_share_percent', jsonb_build_object('from', existing.revenue_share_percent, 'to', NULLIF(p_fields->>'revenue_share_percent', '')::numeric));
    END IF;
  END IF;

  DELETE FROM public.promotion_tools
  WHERE promotion_id = saved_id
    AND NOT (tool_id = ANY(tool_ids));

  INSERT INTO public.promotion_tools (promotion_id, tool_id)
  SELECT saved_id, submitted.tool_id
  FROM unnest(tool_ids) AS submitted(tool_id)
  ON CONFLICT DO NOTHING;

  SELECT COALESCE(array_agg(tool_id ORDER BY tool_id), ARRAY[]::uuid[])
    INTO new_tools
    FROM public.promotion_tools
    WHERE promotion_id = saved_id;

  IF p_promotion_id IS NOT NULL AND old_tools IS DISTINCT FROM new_tools THEN
    detail := jsonb_build_object('changed', changed, 'tools', jsonb_build_object('from', to_jsonb(old_tools), 'to', to_jsonb(new_tools)));
  ELSIF p_promotion_id IS NOT NULL THEN
    detail := jsonb_build_object('changed', changed);
  END IF;

  INSERT INTO public.admin_actions (actor_user_id, action, subject_type, subject_id, detail)
  VALUES (p_actor, action_name, 'promotion', saved_id, detail);

  RETURN jsonb_build_object('ok', true, 'promotion_id', saved_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'duplicate_code', 'message', 'That public code is already in use.');
  WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'That discount code could not be saved.');
END;
$$;

REVOKE ALL ON FUNCTION public.save_promotion(UUID, UUID, JSONB, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_promotion(UUID, UUID, JSONB, UUID[]) TO service_role;

NOTIFY pgrst, 'reload schema';
