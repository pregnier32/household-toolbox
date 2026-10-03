-- Proves promotion saves roll back together and do not rewrite assignment snapshots.
-- Deletes its own probe rows. Safe to re-run.

DO $$
DECLARE
  actor UUID;
  tool_a UUID;
  tool_b UUID;
  promo UUID;
  assignment UUID;
  bad_tool UUID := '00000000-0000-4000-8000-000000000099';
  result JSONB;
  name_after TEXT;
  definition_tools UUID[];
  snapshot_tools UUID[];
  audit_count INTEGER;
  fields JSONB;
BEGIN
  SELECT id INTO actor FROM public.users ORDER BY created_at LIMIT 1;
  SELECT id INTO tool_a FROM public.tools ORDER BY name LIMIT 1;
  SELECT id INTO tool_b FROM public.tools WHERE id <> tool_a ORDER BY name LIMIT 1;
  IF actor IS NULL OR tool_a IS NULL OR tool_b IS NULL THEN
    RAISE EXCEPTION 'Need a user and two tools for the promotion save probe';
  END IF;

  fields := jsonb_build_object(
    'internal_name', 'Phase 8 cleanup probe',
    'public_code', NULL,
    'customer_description', 'Probe description',
    'admin_notes', NULL,
    'status', 'draft',
    'benefit_type', 'specific_tools',
    'duration_unit', 'lifetime',
    'per_user', 'once',
    'eligible_users', 'everyone',
    'eligible_account_type', 'all',
    'can_stack', true,
    'assignment_method', 'admin_only'
  );

  result := public.save_promotion(actor, NULL, fields, ARRAY[tool_a]);
  IF result->>'ok' <> 'true' THEN
    RAISE EXCEPTION 'Probe create failed: %', result;
  END IF;
  promo := (result->>'promotion_id')::uuid;

  INSERT INTO public.promotion_assignments (
    user_id, promotion_id, source, assigned_at, effective_at, benefit_type,
    duration_unit, display_name, customer_description_snapshot, redemption_ordinal
  ) VALUES (
    actor, promo, 'admin_assigned', NOW(), NOW(), 'specific_tools',
    'lifetime', 'Phase 8 cleanup probe', 'Probe description', 1
  ) RETURNING id INTO assignment;
  INSERT INTO public.promotion_assignment_tools (assignment_id, tool_id) VALUES (assignment, tool_a);

  result := public.save_promotion(actor, promo, fields || jsonb_build_object('internal_name', 'Should roll back'), ARRAY[bad_tool]);
  IF result->>'ok' <> 'false' THEN
    RAISE EXCEPTION 'Invalid tool id was accepted';
  END IF;

  SELECT internal_name INTO name_after FROM public.promotions WHERE id = promo;
  SELECT COALESCE(array_agg(tool_id ORDER BY tool_id), ARRAY[]::uuid[]) INTO definition_tools
    FROM public.promotion_tools WHERE promotion_id = promo;
  SELECT COUNT(*) INTO audit_count FROM public.admin_actions WHERE subject_id = promo;
  IF name_after <> 'Phase 8 cleanup probe' OR definition_tools <> ARRAY[tool_a] OR audit_count <> 1 THEN
    RAISE EXCEPTION 'Failed edit was not rolled back. name=% tools=% audits=%', name_after, definition_tools, audit_count;
  END IF;

  result := public.save_promotion(actor, promo, fields || jsonb_build_object('internal_name', 'Phase 8 cleanup updated'), ARRAY[tool_b]);
  IF result->>'ok' <> 'true' THEN
    RAISE EXCEPTION 'Valid tool edit failed: %', result;
  END IF;
  SELECT COALESCE(array_agg(tool_id ORDER BY tool_id), ARRAY[]::uuid[]) INTO definition_tools
    FROM public.promotion_tools WHERE promotion_id = promo;
  SELECT COALESCE(array_agg(tool_id ORDER BY tool_id), ARRAY[]::uuid[]) INTO snapshot_tools
    FROM public.promotion_assignment_tools WHERE assignment_id = assignment;
  IF definition_tools <> ARRAY[tool_b] OR snapshot_tools <> ARRAY[tool_a] THEN
    RAISE EXCEPTION 'Tool edit changed the assignment snapshot. definition=% snapshot=%', definition_tools, snapshot_tools;
  END IF;

  result := public.save_promotion(
    actor,
    promo,
    fields || jsonb_build_object('benefit_type', 'percentage', 'percent_off', 10, 'internal_name', 'Phase 8 cleanup percent'),
    ARRAY[]::uuid[]
  );
  IF result->>'ok' <> 'true' THEN
    RAISE EXCEPTION 'Benefit transition failed: %', result;
  END IF;
  SELECT COUNT(*) INTO audit_count FROM public.promotion_tools WHERE promotion_id = promo;
  SELECT COALESCE(array_agg(tool_id ORDER BY tool_id), ARRAY[]::uuid[]) INTO snapshot_tools
    FROM public.promotion_assignment_tools WHERE assignment_id = assignment;
  IF audit_count <> 0 OR snapshot_tools <> ARRAY[tool_a] THEN
    RAISE EXCEPTION 'Benefit transition did not keep the assignment snapshot. definition_rows=% snapshot=%', audit_count, snapshot_tools;
  END IF;

  DELETE FROM public.promotion_assignment_tools WHERE assignment_id = assignment;
  DELETE FROM public.promotion_assignments WHERE id = assignment;
  DELETE FROM public.promotion_tools WHERE promotion_id = promo;
  DELETE FROM public.admin_actions WHERE subject_id = promo;
  DELETE FROM public.promotions WHERE id = promo;
EXCEPTION WHEN OTHERS THEN
  IF assignment IS NOT NULL THEN
    DELETE FROM public.promotion_assignment_tools WHERE assignment_id = assignment;
    DELETE FROM public.promotion_assignments WHERE id = assignment;
  END IF;
  IF promo IS NOT NULL THEN
    DELETE FROM public.promotion_tools WHERE promotion_id = promo;
    DELETE FROM public.admin_actions WHERE subject_id = promo;
    DELETE FROM public.promotions WHERE id = promo;
  END IF;
  RAISE;
END $$;
