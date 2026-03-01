import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DEFAULT_MEAL_TYPES = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'High-Protein',
  'Vegetarian',
  'Kid-Friendly',
];

// Categories used in Meal Planner Items tab; we seed from tools_sl_default_items for these only
const MEAL_PLANNER_ITEM_CATEGORIES = [
  'Bakery & Bread',
  'Beverages',
  'Dairy & Refrigerated',
  'Frozen Foods',
  'Meat & Seafood',
  'Pantry Staples',
  'Paper & Disposable Goods',
  'Produce',
  'Snacks',
  'Spices & Seasonings',
];

async function copyDefaultItemsFromShoppingList(userId: string, toolId: string) {
  const { data: existing } = await supabaseServer
    .from('tools_mp_items')
    .select('id')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .limit(1);

  if (existing && existing.length > 0) return;

  const { data: defaults, error: defErr } = await supabaseServer
    .from('tools_sl_default_items')
    .select('category, name, display_order')
    .in('category', MEAL_PLANNER_ITEM_CATEGORIES)
    .order('category', { ascending: true })
    .order('display_order', { ascending: true });

  if (defErr || !defaults?.length) return;

  let order = 0;
  const toInsert = defaults.map((d) => ({
    user_id: userId,
    tool_id: toolId,
    category: d.category,
    name: d.name,
    display_order: order++,
  }));

  await supabaseServer.from('tools_mp_items').insert(toInsert);
}

async function ensureDefaultMealTypes(userId: string, toolId: string) {
  const { data: existing } = await supabaseServer
    .from('tools_mp_meal_types')
    .select('id')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .limit(1);

  if (existing && existing.length > 0) return;

  const toInsert = DEFAULT_MEAL_TYPES.map((name, i) => ({
    user_id: userId,
    tool_id: toolId,
    name,
    display_order: i,
  }));
  await supabaseServer.from('tools_mp_meal_types').insert(toInsert);
}

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const toolId = searchParams.get('toolId');
  const resource = searchParams.get('resource'); // 'items' | 'meal-types' | 'meals' | 'plans'

  if (!toolId) {
    return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
  }

  try {
    if (resource === 'items' || !resource) {
      const { data: items, error } = await supabaseServer
        .from('tools_mp_items')
        .select('id, name, category, display_order')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .order('category', { ascending: true })
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Meal planner fetch items:', error);
        return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
      }

      if (!items || items.length === 0) {
        await copyDefaultItemsFromShoppingList(user.id, toolId);
        const { data: reloaded, error: reloadErr } = await supabaseServer
          .from('tools_mp_items')
          .select('id, name, category, display_order')
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .order('category', { ascending: true })
          .order('display_order', { ascending: true });

        if (reloadErr) {
          return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
        }
        return NextResponse.json({
          items: (reloaded || []).map((i) => ({ id: i.id, name: i.name, category: i.category })),
        });
      }

      return NextResponse.json({
        items: items.map((i) => ({ id: i.id, name: i.name, category: i.category })),
      });
    }

    if (resource === 'meal-types') {
      await ensureDefaultMealTypes(user.id, toolId);
      const { data: types, error } = await supabaseServer
        .from('tools_mp_meal_types')
        .select('id, name, display_order')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Meal planner fetch meal types:', error);
        return NextResponse.json({ error: 'Failed to fetch meal types' }, { status: 500 });
      }
      return NextResponse.json({
        mealTypes: (types || []).map((t) => ({ id: t.id, name: t.name })),
      });
    }

    if (resource === 'meals') {
      const { data: meals, error: mealsError } = await supabaseServer
        .from('tools_mp_meals')
        .select('id, meal_type_id, name, description, instructions, prep_time_minutes, difficulty, rating, is_active')
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (mealsError) {
        console.error('Meal planner fetch meals:', mealsError);
        return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 });
      }

      const result: {
        id: string;
        name: string;
        mealTypeId: string;
        description: string;
        instructions: string;
        ingredientIds: string[];
        prepTimeMinutes: number | null;
        difficulty: string;
        rating: number;
        isActive: boolean;
      }[] = [];

      for (const m of meals || []) {
        const { data: ingRows } = await supabaseServer
          .from('tools_mp_meal_ingredients')
          .select('item_id')
          .eq('meal_id', m.id)
          .order('display_order', { ascending: true });
        const ingredientIds = (ingRows || []).map((r: { item_id: string }) => r.item_id);
        result.push({
          id: m.id,
          name: m.name,
          mealTypeId: m.meal_type_id ?? '',
          description: m.description ?? '',
          instructions: m.instructions ?? '',
          ingredientIds,
          prepTimeMinutes: m.prep_time_minutes ?? null,
          difficulty: m.difficulty ?? '',
          rating: m.rating ?? 0,
          isActive: m.is_active !== false,
        });
      }
      return NextResponse.json({ meals: result });
    }

    if (resource === 'plans') {
      const { data: plans, error: plansError } = await supabaseServer
        .from('tools_mp_plans')
        .select('id, name, start_date, is_active')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .order('start_date', { ascending: false });

      if (plansError) {
        console.error('Meal planner fetch plans:', plansError);
        return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
      }

      const list: {
        id: string;
        name: string;
        startDate: string;
        isActive: boolean;
        assignments: Record<string, string[]>;
      }[] = [];

      for (const p of plans || []) {
        const { data: assignRows } = await supabaseServer
          .from('tools_mp_plan_assignments')
          .select('day_key, meal_id, display_order')
          .eq('plan_id', p.id)
          .order('day_key', { ascending: true })
          .order('display_order', { ascending: true });

        const assignments: Record<string, string[]> = {};
        for (const d of DAY_KEYS) assignments[d] = [];
        for (const row of assignRows || []) {
          const day = row.day_key as (typeof DAY_KEYS)[number];
          if (assignments[day]) assignments[day].push(row.meal_id);
        }
        list.push({
          id: p.id,
          name: p.name,
          startDate: p.start_date,
          isActive: !!p.is_active,
          assignments,
        });
      }
      return NextResponse.json({ plans: list });
    }

    return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
  } catch (err) {
    console.error('Meal planner GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type DayAssignments = Record<string, string[]>;

function assignmentsToRows(planId: string, assignments: DayAssignments) {
  const rows: { plan_id: string; day_key: string; meal_id: string; display_order: number }[] = [];
  for (const day of DAY_KEYS) {
    const mealIds = assignments[day] ?? [];
    mealIds.forEach((mealId, i) => {
      rows.push({ plan_id: planId, day_key: day, meal_id: mealId, display_order: i });
    });
  }
  return rows;
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, toolId } = body as { action: string; toolId?: string };

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    // --- Items ---
    if (action === 'createItem') {
      const { name, category } = body as { name: string; category: string };
      if (!name?.trim() || !category?.trim()) {
        return NextResponse.json({ error: 'Item name and category are required' }, { status: 400 });
      }
      const { data: maxOrder } = await supabaseServer
        .from('tools_mp_items')
        .select('display_order')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();
      const displayOrder = (maxOrder?.display_order ?? -1) + 1;
      const { data: item, error } = await supabaseServer
        .from('tools_mp_items')
        .insert({
          user_id: user.id,
          tool_id: toolId,
          name: name.trim(),
          category: category.trim(),
          display_order: displayOrder,
        })
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ item: { id: item.id, name: item.name, category: item.category } });
    }

    if (action === 'updateItem') {
      const { itemId, name, category } = body as { itemId: string; name?: string; category?: string };
      if (!itemId) {
        return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
      }
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name.trim();
      if (category !== undefined) updates.category = category.trim();
      const { error } = await supabaseServer
        .from('tools_mp_items')
        .update(updates)
        .eq('id', itemId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'deleteItem') {
      const { itemId } = body as { itemId: string };
      if (!itemId) {
        return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
      }
      const { error } = await supabaseServer
        .from('tools_mp_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // --- Meal types ---
    if (action === 'createMealType') {
      const { name } = body as { name: string };
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Meal type name is required' }, { status: 400 });
      }
      const { data: maxOrder } = await supabaseServer
        .from('tools_mp_meal_types')
        .select('display_order')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();
      const displayOrder = (maxOrder?.display_order ?? -1) + 1;
      const { data: row, error } = await supabaseServer
        .from('tools_mp_meal_types')
        .insert({
          user_id: user.id,
          tool_id: toolId,
          name: name.trim(),
          display_order: displayOrder,
        })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ mealType: { id: row.id, name: row.name } });
    }

    if (action === 'updateMealType') {
      const { mealTypeId, name } = body as { mealTypeId: string; name: string };
      if (!mealTypeId || !name?.trim()) {
        return NextResponse.json({ error: 'Meal type ID and name are required' }, { status: 400 });
      }
      const { error } = await supabaseServer
        .from('tools_mp_meal_types')
        .update({ name: name.trim() })
        .eq('id', mealTypeId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'deleteMealType') {
      const { mealTypeId } = body as { mealTypeId: string };
      if (!mealTypeId) {
        return NextResponse.json({ error: 'Meal type ID is required' }, { status: 400 });
      }
      const { error } = await supabaseServer
        .from('tools_mp_meal_types')
        .delete()
        .eq('id', mealTypeId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // --- Meals ---
    if (action === 'createMeal') {
      const {
        name,
        mealTypeId,
        description,
        instructions,
        ingredientIds,
        prepTimeMinutes,
        difficulty,
        rating,
      } = body as {
        name: string;
        mealTypeId?: string;
        description?: string;
        instructions?: string;
        ingredientIds?: string[];
        prepTimeMinutes?: number | null;
        difficulty?: string | null;
        rating?: number;
      };
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Meal name is required' }, { status: 400 });
      }
      const { data: meal, error: mealErr } = await supabaseServer
        .from('tools_mp_meals')
        .insert({
          user_id: user.id,
          tool_id: toolId,
          meal_type_id: mealTypeId || null,
          name: name.trim(),
          description: (description ?? '').trim(),
          instructions: (instructions ?? '').trim(),
          prep_time_minutes: prepTimeMinutes ?? null,
          difficulty: difficulty || null,
          rating: rating ?? 0,
          is_active: true,
        })
        .select()
        .single();
      if (mealErr) return NextResponse.json({ error: mealErr.message }, { status: 500 });

      const itemIds = Array.isArray(ingredientIds) ? ingredientIds : [];
      if (itemIds.length > 0) {
        await supabaseServer.from('tools_mp_meal_ingredients').insert(
          itemIds.map((item_id, i) => ({
            meal_id: meal.id,
            item_id,
            display_order: i,
          }))
        );
      }
      return NextResponse.json({
        meal: {
          id: meal.id,
          name: meal.name,
          mealTypeId: meal.meal_type_id ?? '',
          description: meal.description ?? '',
          instructions: meal.instructions ?? '',
          ingredientIds: itemIds,
          prepTimeMinutes: meal.prep_time_minutes ?? null,
          difficulty: meal.difficulty ?? '',
          rating: meal.rating ?? 0,
        },
      });
    }

    if (action === 'updateMeal') {
      const {
        mealId,
        name,
        mealTypeId,
        description,
        instructions,
        ingredientIds,
        prepTimeMinutes,
        difficulty,
        rating,
      } = body as {
        mealId: string;
        name?: string;
        mealTypeId?: string;
        description?: string;
        instructions?: string;
        ingredientIds?: string[];
        prepTimeMinutes?: number | null;
        difficulty?: string | null;
        rating?: number;
      };
      if (!mealId) {
        return NextResponse.json({ error: 'Meal ID is required' }, { status: 400 });
      }
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name.trim();
      if (mealTypeId !== undefined) updates.meal_type_id = mealTypeId || null;
      if (description !== undefined) updates.description = (description ?? '').trim();
      if (instructions !== undefined) updates.instructions = (instructions ?? '').trim();
      if (prepTimeMinutes !== undefined) updates.prep_time_minutes = prepTimeMinutes ?? null;
      if (difficulty !== undefined) updates.difficulty = difficulty || null;
      if (rating !== undefined) updates.rating = rating ?? 0;
      if (Object.keys(updates).length > 0) {
        const { error: upErr } = await supabaseServer
          .from('tools_mp_meals')
          .update(updates)
          .eq('id', mealId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId);
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      if (ingredientIds !== undefined) {
        await supabaseServer.from('tools_mp_meal_ingredients').delete().eq('meal_id', mealId);
        const itemIds = Array.isArray(ingredientIds) ? ingredientIds : [];
        if (itemIds.length > 0) {
          await supabaseServer.from('tools_mp_meal_ingredients').insert(
            itemIds.map((item_id, i) => ({
              meal_id: mealId,
              item_id,
              display_order: i,
            }))
          );
        }
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'setMealActive') {
      const { mealId, isActive } = body as { mealId: string; isActive: boolean };
      if (!mealId) {
        return NextResponse.json({ error: 'Meal ID is required' }, { status: 400 });
      }
      const { error } = await supabaseServer
        .from('tools_mp_meals')
        .update({ is_active: !!isActive })
        .eq('id', mealId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'deleteMeal') {
      const { mealId } = body as { mealId: string };
      if (!mealId) {
        return NextResponse.json({ error: 'Meal ID is required' }, { status: 400 });
      }
      const { error } = await supabaseServer
        .from('tools_mp_meals')
        .delete()
        .eq('id', mealId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // --- Plans ---
    if (action === 'createPlan') {
      const { name, startDate, assignments, copyFromPlanId } = body as {
        name: string;
        startDate: string;
        assignments?: DayAssignments;
        copyFromPlanId?: string;
      };
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Plan name is required' }, { status: 400 });
      }
      let assign: DayAssignments = assignments ?? {};
      if (copyFromPlanId) {
        const { data: fromRows } = await supabaseServer
          .from('tools_mp_plan_assignments')
          .select('day_key, meal_id, display_order')
          .eq('plan_id', copyFromPlanId)
          .order('day_key')
          .order('display_order');
        assign = {} as DayAssignments;
        for (const d of DAY_KEYS) assign[d] = [];
        for (const row of fromRows || []) {
          const day = row.day_key as (typeof DAY_KEYS)[number];
          if (assign[day]) assign[day].push(row.meal_id);
        }
      } else {
        for (const d of DAY_KEYS) if (!assign[d]) assign[d] = [];
      }
      const { data: plan, error: planErr } = await supabaseServer
        .from('tools_mp_plans')
        .insert({
          user_id: user.id,
          tool_id: toolId,
          name: name.trim(),
          start_date: startDate || new Date().toISOString().split('T')[0],
          is_active: true,
        })
        .select()
        .single();
      if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 });

      const rows = assignmentsToRows(plan.id, assign);
      if (rows.length > 0) {
        await supabaseServer.from('tools_mp_plan_assignments').insert(rows);
      }
      return NextResponse.json({
        plan: {
          id: plan.id,
          name: plan.name,
          startDate: plan.start_date,
          isActive: true,
          assignments: assign,
        },
      });
    }

    if (action === 'updatePlan') {
      const { planId, name, startDate, assignments } = body as {
        planId: string;
        name?: string;
        startDate?: string;
        assignments?: DayAssignments;
      };
      if (!planId) {
        return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
      }
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name.trim();
      if (startDate !== undefined) updates.start_date = startDate;
      if (Object.keys(updates).length > 0) {
        const { error: upErr } = await supabaseServer
          .from('tools_mp_plans')
          .update(updates)
          .eq('id', planId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId);
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      if (assignments !== undefined) {
        await supabaseServer.from('tools_mp_plan_assignments').delete().eq('plan_id', planId);
        const rows = assignmentsToRows(planId, assignments);
        if (rows.length > 0) {
          await supabaseServer.from('tools_mp_plan_assignments').insert(rows);
        }
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'deletePlan') {
      const { planId } = body as { planId: string };
      if (!planId) {
        return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
      }
      const { error } = await supabaseServer
        .from('tools_mp_plans')
        .delete()
        .eq('id', planId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'movePlanToHistory') {
      const { planId } = body as { planId: string };
      if (!planId) {
        return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
      }
      const { error } = await supabaseServer
        .from('tools_mp_plans')
        .update({ is_active: false })
        .eq('id', planId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Meal planner POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
