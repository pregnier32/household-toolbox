-- Read-only checks plus rolled-back constraint probes. Safe to re-run.
-- Does not leave test rows.

DO $$
DECLARE
  probe_user UUID;
  probe_promotion UUID;
  probe_campaign UUID;
  probe_partner UUID;
BEGIN
  SELECT id INTO probe_user FROM public.users ORDER BY created_at LIMIT 1;
  IF probe_user IS NULL THEN
    RAISE EXCEPTION 'No user available for constraint probes';
  END IF;

  INSERT INTO public.partners (name, status)
  VALUES ('Phase 7B probe partner', 'active')
  RETURNING id INTO probe_partner;

  INSERT INTO public.campaigns (name, partner_id, platform_code, status)
  VALUES ('Phase 7B probe campaign', probe_partner, 'tiktok', 'draft')
  RETURNING id INTO probe_campaign;

  BEGIN
    INSERT INTO public.promotions (
      internal_name, customer_description, status, benefit_type, percent_off,
      duration_unit, per_user, eligible_users, eligible_account_type, can_stack, assignment_method
    ) VALUES (
      'Bad percent', 'Bad percent', 'draft', 'percentage', 0,
      'lifetime', 'once', 'everyone', 'all', true, 'admin_only'
    );
    RAISE EXCEPTION 'percentage of 0 was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.promotions (
      internal_name, customer_description, status, benefit_type, bonus_storage_bytes,
      duration_unit, per_user, eligible_users, eligible_account_type, can_stack, assignment_method
    ) VALUES (
      'Bad storage', 'Bad storage', 'draft', 'bonus_storage', 0,
      'lifetime', 'once', 'everyone', 'all', true, 'admin_only'
    );
    RAISE EXCEPTION 'zero storage was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.promotions (
      internal_name, customer_description, status, benefit_type, slot_mode, slot_count,
      duration_unit, per_user, eligible_users, eligible_account_type, can_stack, assignment_method
    ) VALUES (
      'Bad slots', 'Bad slots', 'draft', 'free_tool_slots', 'total', 0,
      'lifetime', 'once', 'everyone', 'all', true, 'automatic'
    );
    RAISE EXCEPTION 'zero slots were accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.promotions (
      internal_name, public_code, customer_description, status, benefit_type,
      duration_unit, per_user, eligible_users, eligible_account_type, can_stack, assignment_method,
      redeem_start_date, redeem_end_date
    ) VALUES (
      'Bad window', 'PHASE7BWINDOW', 'Bad window', 'draft', 'percent_100',
      'lifetime', 'once', 'everyone', 'all', true, 'public_code',
      DATE '2026-10-15', DATE '2026-10-01'
    );
    RAISE EXCEPTION 'reversed redemption window was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.promotions (
      internal_name, public_code, customer_description, status, benefit_type,
      duration_unit, per_user, eligible_users, eligible_account_type, can_stack, assignment_method,
      campaign_id, partner_id
    ) VALUES (
      'Bad attribution', 'PHASE7BATTR', 'Bad attribution', 'draft', 'percent_100',
      'lifetime', 'once', 'everyone', 'all', true, 'public_code',
      probe_campaign, probe_partner
    );
    RAISE EXCEPTION 'campaign plus direct partner was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  INSERT INTO public.promotions (
    internal_name, public_code, customer_description, status, benefit_type,
    duration_unit, per_user, eligible_users, eligible_account_type, can_stack, assignment_method,
    campaign_id
  ) VALUES (
    'Good attribution', 'phase7bgood', 'Good attribution', 'draft', 'percent_100',
    'lifetime', 'once', 'everyone', 'all', true, 'public_code',
    probe_campaign
  ) RETURNING id INTO probe_promotion;

  BEGIN
    INSERT INTO public.promotions (
      internal_name, public_code, customer_description, status, benefit_type,
      duration_unit, per_user, eligible_users, eligible_account_type, can_stack, assignment_method
    ) VALUES (
      'Code collision', 'PHASE7BGOOD', 'Code collision', 'draft', 'percent_100',
      'lifetime', 'once', 'everyone', 'all', true, 'public_code'
    );
    RAISE EXCEPTION 'case-variant public code was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  INSERT INTO public.promotion_assignments (
    user_id, promotion_id, source, assigned_at, effective_at,
    benefit_type, duration_unit, display_name, public_code, customer_description_snapshot,
    redemption_ordinal
  ) VALUES (
    probe_user, probe_promotion, 'admin_assigned', NOW(), NOW(),
    'percent_100', 'lifetime', 'Good attribution', 'phase7bgood', 'Good attribution',
    1
  );

  BEGIN
    INSERT INTO public.promotion_assignments (
      user_id, promotion_id, source, assigned_at, effective_at,
      benefit_type, duration_unit, display_name, public_code, customer_description_snapshot,
      redemption_ordinal
    ) VALUES (
      probe_user, probe_promotion, 'admin_assigned', NOW(), NOW(),
      'percent_100', 'lifetime', 'Good attribution', 'phase7bgood', 'Good attribution',
      1
    );
    RAISE EXCEPTION 'duplicate ordinal was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  INSERT INTO public.promotion_assignments (
    user_id, promotion_id, source, assigned_at, effective_at,
    benefit_type, duration_unit, display_name, public_code, customer_description_snapshot,
    redemption_ordinal
  ) VALUES (
    probe_user, probe_promotion, 'admin_assigned', NOW(), NOW(),
    'percent_100', 'lifetime', 'Good attribution', 'phase7bgood', 'Good attribution',
    2
  );

  BEGIN
    INSERT INTO public.account_notices (user_id, kind, event_key, severity, title, body)
    VALUES (probe_user, 'trial_ending', 'phase7b:probe', 'info', 'Probe', 'Probe body');
    INSERT INTO public.account_notices (user_id, kind, event_key, severity, title, body)
    VALUES (probe_user, 'trial_ending', 'phase7b:probe', 'info', 'Probe', 'Probe body');
    RAISE EXCEPTION 'duplicate notice event key was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  DELETE FROM public.account_notices WHERE event_key = 'phase7b:probe';
  DELETE FROM public.promotion_assignments WHERE promotion_id = probe_promotion;
  DELETE FROM public.promotions WHERE id = probe_promotion;
  DELETE FROM public.campaigns WHERE id = probe_campaign;
  DELETE FROM public.partners WHERE id = probe_partner;
END $$;
