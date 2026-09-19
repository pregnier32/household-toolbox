import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  createEolPlan,
  deleteEolPlan,
  listEolPlans,
  saveEolPlan,
  setSelectedEolPlan,
} from '@/lib/end-of-life-planner-db';
import type { EolPlan, EolRelationship } from '@/lib/end-of-life-planner';

function toolIdFrom(request: NextRequest, body?: { toolId?: string }) {
  return request.nextUrl.searchParams.get('toolId') || body?.toolId || '';
}

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const toolId = toolIdFrom(request);
  if (!toolId) return NextResponse.json({ error: 'toolId is required' }, { status: 400 });
  try {
    const result = await listEolPlans(user.id, toolId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('EOL GET', error);
    return NextResponse.json({ error: 'Failed to load plans' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const toolId = toolIdFrom(request, body);
    if (!toolId) return NextResponse.json({ error: 'toolId is required' }, { status: 400 });
    if (!String(body.name || '').trim() || !String(body.personFullName || '').trim()) {
      return NextResponse.json({ error: 'Plan name and person’s full name are required.' }, { status: 400 });
    }
    const plan = await createEolPlan(user.id, toolId, {
      name: body.name,
      personFullName: body.personFullName,
      relationship: (body.relationship || '') as EolRelationship | '',
      relationshipCustom: body.relationshipCustom,
      dateOfBirth: body.dateOfBirth,
      card_color: body.card_color,
      select: body.select !== false,
    });
    return NextResponse.json({ plan });
  } catch (error) {
    console.error('EOL POST', error);
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const toolId = toolIdFrom(request, body);
    const plan = body.plan as EolPlan | undefined;
    if (!toolId || !plan?.id) return NextResponse.json({ error: 'toolId and plan are required' }, { status: 400 });
    const saved = await saveEolPlan(user.id, toolId, plan);
    return NextResponse.json({ plan: saved });
  } catch (error) {
    console.error('EOL PUT', error);
    return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const toolId = toolIdFrom(request, body);
    if (!toolId) return NextResponse.json({ error: 'toolId is required' }, { status: 400 });
    await setSelectedEolPlan(user.id, toolId, body.selectedPlanId || null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('EOL PATCH', error);
    return NextResponse.json({ error: 'Failed to update selection' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const toolId = toolIdFrom(request);
  const planId = request.nextUrl.searchParams.get('id');
  if (!toolId || !planId) return NextResponse.json({ error: 'toolId and id are required' }, { status: 400 });
  try {
    await deleteEolPlan(user.id, toolId, planId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('EOL DELETE', error);
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 });
  }
}
