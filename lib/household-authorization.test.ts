import assert from 'node:assert/strict';
import Module from 'module';
import { before, test } from 'node:test';
import bcrypt from 'bcryptjs';

function isolateEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'isolated-test-key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'isolated-test-anon';
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.CRON_SECRET;
  process.env.RESEND_API_KEY = 'isolated-test-key';
  delete process.env.DATABASE_URL;
}

isolateEnv();

type Row = Record<string, unknown> & { id: string };
type QueryResult = { data: Row[] | Row | null; error: { message: string } | null };
type Session = {
  id: string;
  actorId: string;
  householdRole: 'admin' | 'user';
  email: string;
  userStatus: string;
  householdReady: boolean;
  householdId: string;
  householdOwnerId: string;
};

const tables = new Map<string, Map<string, Row>>();
const state: { session: Session | null } = { session: null };

class Query {
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: Row | Row[] | null = null;
  private filters: Array<(row: Row) => boolean> = [];

  constructor(private table: string) {}

  select() {
    return this;
  }

  insert(payload: Row | Row[]) {
    this.action = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.action = 'update';
    this.payload = payload as Row;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: readonly unknown[]) {
    const allowed = new Set(values);
    this.filters.push((row) => allowed.has(row[column]));
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  not() {
    return this;
  }

  maybeSingle() {
    return this.execute('maybe');
  }

  single() {
    return this.execute('single');
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute('many').then(onfulfilled, onrejected);
  }

  private bucket() {
    let bucket = tables.get(this.table);
    if (!bucket) {
      bucket = new Map();
      tables.set(this.table, bucket);
    }
    return bucket;
  }

  private matching() {
    return [...this.bucket().values()].filter((row) => this.filters.every((filter) => filter(row)));
  }

  private async execute(mode: 'many' | 'single' | 'maybe'): Promise<QueryResult> {
    const bucket = this.bucket();
    if (this.action === 'insert') {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload ?? { id: '' }];
      const saved: Row[] = [];
      for (const row of incoming) {
        const id = String(row.id || crypto.randomUUID());
        if (bucket.has(id)) return { data: null, error: { message: 'duplicate key' } };
        const stored = { ...row, id };
        bucket.set(id, stored);
        saved.push({ ...stored });
      }
      return this.finish(saved, mode);
    }

    const matches = this.matching();
    if (this.action === 'update') {
      if (mode === 'single' && matches.length !== 1) {
        return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
      }
      const payload: Record<string, unknown> = {
        ...(this.payload && !Array.isArray(this.payload) ? this.payload : {}),
      };
      delete payload.id;
      for (const row of matches) Object.assign(row, payload);
      return this.finish(matches.map((row) => ({ ...row })), mode);
    }

    if (this.action === 'delete') {
      for (const row of matches) bucket.delete(row.id);
      return { data: null, error: null };
    }

    return this.finish(matches.map((row) => ({ ...row })), mode);
  }

  private finish(rows: Row[], mode: 'many' | 'single' | 'maybe'): QueryResult {
    if (mode === 'many') return { data: rows, error: null };
    if (rows.length === 1) return { data: rows[0], error: null };
    if (mode === 'maybe' && rows.length === 0) return { data: null, error: null };
    return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
  }
}

const supabaseServer = {
  from(table: string) {
    return new Query(table);
  },
  storage: {
    from() {
      return {
        upload: async () => ({ data: { path: 'isolated' }, error: null }),
        remove: async () => ({ data: null, error: null }),
        download: async () => ({
          data: { arrayBuffer: async () => Uint8Array.from([9, 8, 7]).buffer },
          error: null,
        }),
        getPublicUrl: () => ({
          data: { publicUrl: 'https://example.test/storage/v1/object/public/important-documents/isolated/file.pdf' },
        }),
        list: async () => ({ data: [], error: null }),
      };
    },
  },
};

type NextRequestCtor = typeof import('next/server').NextRequest;
let NextRequest: NextRequestCtor;
let goals: typeof import('@/app/api/tools/goals-tracking/route');
let shopping: typeof import('@/app/api/tools/shopping-list/route');
let meals: typeof import('@/app/api/tools/meal-planner/route');
let notes: typeof import('@/app/api/tools/notes/route');
let verifyPassword: typeof import('@/app/api/tools/notes/verify-password/route');
let documents: typeof import('@/app/api/tools/important-documents/route');
let download: typeof import('@/app/api/tools/important-documents/download/[documentId]/route');
let addresses: typeof import('@/app/api/tools/address-book/route');
let repairs: typeof import('@/app/api/tools/repair-history/route');
let healthcare: typeof import('@/app/api/tools/healthcare-appts-history/route');
let budgets: typeof import('@/app/api/tools/event-budget-planner/route');
let notices: typeof import('@/app/api/account/notices/route');
let checkout: typeof import('@/app/api/stripe/checkout/route');
let portal: typeof import('@/app/api/stripe/portal/route');
let redeem: typeof import('@/app/api/account/redeem/route');
let buyTool: typeof import('@/app/api/tools/buy/route');
let myTools: typeof import('@/app/api/my-tools/route');
let householdUsers: typeof import('@/app/api/household/users/route');
let saveEolPlan: typeof import('@/lib/end-of-life-planner-db').saveEolPlan;
let emptyPlanData: typeof import('@/lib/end-of-life-planner').emptyPlanData;

const ready = (async () => {
  const loader = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = loader._load;
  loader._load = function (request: string, parent: unknown, isMain: boolean) {
    const normalized = request.replace(/\\/g, '/');
    if (normalized === 'server-only' || normalized.endsWith('/server-only')) return {};
    if (normalized.includes('supabaseServer')) return { supabaseServer };
    if (normalized.includes('/lib/session') || normalized.endsWith('/session')) {
      return {
        getHouseholdDataSession: async () => state.session,
        getSession: async () => {
          const session = state.session;
          if (!session) return null;
          return { ...session, id: session.actorId };
        },
      };
    }
    if (normalized.includes('/lib/billing-access')) {
      return {
        denyLockedToolAccess: async () => null,
        denyRemovedTool: async () => null,
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  isolateEnv();
  ({ NextRequest } = await import('next/server'));
  isolateEnv();
  goals = await import('@/app/api/tools/goals-tracking/route');
  shopping = await import('@/app/api/tools/shopping-list/route');
  meals = await import('@/app/api/tools/meal-planner/route');
  notes = await import('@/app/api/tools/notes/route');
  verifyPassword = await import('@/app/api/tools/notes/verify-password/route');
  documents = await import('@/app/api/tools/important-documents/route');
  download = await import('@/app/api/tools/important-documents/download/[documentId]/route');
  addresses = await import('@/app/api/tools/address-book/route');
  repairs = await import('@/app/api/tools/repair-history/route');
  healthcare = await import('@/app/api/tools/healthcare-appts-history/route');
  budgets = await import('@/app/api/tools/event-budget-planner/route');
  notices = await import('@/app/api/account/notices/route');
  checkout = await import('@/app/api/stripe/checkout/route');
  portal = await import('@/app/api/stripe/portal/route');
  redeem = await import('@/app/api/account/redeem/route');
  buyTool = await import('@/app/api/tools/buy/route');
  myTools = await import('@/app/api/my-tools/route');
  householdUsers = await import('@/app/api/household/users/route');
  ({ saveEolPlan } = await import('@/lib/end-of-life-planner-db'));
  ({ emptyPlanData } = await import('@/lib/end-of-life-planner'));
  loader._load = originalLoad;
})();

const OWNER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const OWNER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const MEMBER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const PLAN_A = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const FOREIGN_FAMILY = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';

let passwordHash = '';

function signIn(id: string, role: 'admin' | 'user' = 'admin') {
  state.session = {
    id,
    actorId: role === 'admin' ? id : MEMBER_A,
    householdRole: role,
    email: `${role}@household.test`,
    userStatus: role === 'admin' ? 'admin' : 'guest',
    householdReady: true,
    householdId: 'household-a',
    householdOwnerId: id,
  };
}

function seed(table: string, row: Row) {
  let bucket = tables.get(table);
  if (!bucket) {
    bucket = new Map();
    tables.set(table, bucket);
  }
  bucket.set(row.id, { ...row });
}

function read(table: string, id: string) {
  return tables.get(table)?.get(id);
}

function count(table: string) {
  return tables.get(table)?.size ?? 0;
}

function snapshot(table: string) {
  return JSON.stringify([...(tables.get(table)?.values() ?? [])].map((row) => ({ ...row })).sort((a, b) => a.id.localeCompare(b.id)));
}

function post(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

before(async () => {
  await ready;
  passwordHash = await bcrypt.hash('correct-password', 4);
});

function seedHouseholds() {
  tables.clear();
  seed('tools_gt_goals', { id: 'goal-a', user_id: OWNER_A, tool_id: 'goals', name: 'Goal A', last_update_date: null });
  seed('tools_gt_goals', { id: 'goal-a2', user_id: OWNER_A, tool_id: 'goals', name: 'Goal A2', last_update_date: null });
  seed('tools_gt_goals', { id: 'goal-b', user_id: OWNER_B, tool_id: 'goals', name: 'Goal B', last_update_date: null });
  seed('tools_gt_phases', { id: 'phase-a', goal_id: 'goal-a', name: 'Phase A', display_order: 0 });
  seed('tools_gt_phases', { id: 'phase-b', goal_id: 'goal-b', name: 'Phase B', display_order: 0 });
  seed('tools_gt_tasks', { id: 'task-b', phase_id: 'phase-b', goal_id: 'goal-b', title: 'Task B', completed: false });
  seed('tools_gt_update_notes', { id: 'unote-b', goal_id: 'goal-b', note_date: '2026-01-01', note: 'keep-note' });

  seed('tools_sl_lists', { id: 'list-a', user_id: OWNER_A, tool_id: 'shopping', name: 'List A', list_date: '2026-01-01', is_active: true });
  seed('tools_sl_lists', { id: 'list-b', user_id: OWNER_B, tool_id: 'shopping', name: 'List B', list_date: '2026-01-01', is_active: true });
  seed('tools_sl_items', { id: 'item-a', user_id: OWNER_A, tool_id: 'shopping', name: 'Milk' });
  seed('tools_sl_items', { id: 'item-b', user_id: OWNER_B, tool_id: 'shopping', name: 'Bread' });
  seed('tools_sl_list_items', { id: 'line-b', list_id: 'list-b', item_id: 'item-b', is_checked: false });

  seed('tools_mp_meals', { id: 'meal-b', user_id: OWNER_B, tool_id: 'meals', name: 'Meal B' });
  seed('tools_mp_items', { id: 'ingredient-b', user_id: OWNER_B, tool_id: 'meals', name: 'Rice' });
  seed('tools_mp_meal_ingredients', { id: 'meal-line-b', meal_id: 'meal-b', item_id: 'ingredient-b', display_order: 0 });
  seed('tools_mp_plans', { id: 'plan-b', user_id: OWNER_B, tool_id: 'meals', name: 'Plan B', start_date: '2026-01-01' });
  seed('tools_mp_plan_assignments', { id: 'assign-b', plan_id: 'plan-b', meal_id: 'meal-b', day_key: 'mon', display_order: 0 });

  seed('tools_note_notes', {
    id: 'note-locked',
    user_id: OWNER_A,
    tool_id: 'notes',
    note_name: 'Locked',
    created_date: '2026-01-01',
    date_added: '2026-01-01',
    note: 'SECRET-BODY',
    requires_password_for_view: true,
    view_password_hash: passwordHash,
    is_active: true,
  });
  seed('tools_note_notes', {
    id: 'note-open',
    user_id: OWNER_A,
    tool_id: 'notes',
    note_name: 'Open',
    created_date: '2026-01-01',
    date_added: '2026-01-01',
    note: 'OPEN-BODY',
    requires_password_for_view: false,
    view_password_hash: null,
    is_active: true,
  });
  seed('tools_note_notes', {
    id: 'note-b',
    user_id: OWNER_B,
    tool_id: 'notes',
    note_name: 'Other',
    created_date: '2026-01-01',
    date_added: '2026-01-01',
    note: 'B-SECRET',
    requires_password_for_view: true,
    view_password_hash: passwordHash,
    is_active: true,
  });
  seed('tools_note_tags', { id: 'tag-a', user_id: OWNER_A, tool_id: 'notes', name: 'Home' });
  seed('tools_note_tags', { id: 'tag-b', user_id: OWNER_B, tool_id: 'notes', name: 'Other' });

  seed('tools_id_documents', {
    id: 'doc-a',
    user_id: OWNER_A,
    tool_id: 'docs',
    document_name: 'Deed',
    uploaded_date: '2026-01-01',
    date_added: '2026-01-01',
    file_url: `https://example.test/storage/v1/object/public/important-documents/${OWNER_A}/deed.pdf`,
    file_name: 'deed.pdf',
    file_type: 'application/pdf',
    requires_password_for_download: true,
    download_password_hash: passwordHash,
    is_active: true,
  });
  seed('tools_id_tags', { id: 'doc-tag-a', user_id: OWNER_A, tool_id: 'docs', name: 'Home' });
  seed('tools_id_tags', { id: 'doc-tag-b', user_id: OWNER_B, tool_id: 'docs', name: 'Other' });

  seed('tools_ab_addresses', { id: 'addr-a', user_id: OWNER_A, tool_id: 'addresses', mailing_name: 'Ada', is_active: true });
  seed('tools_ab_addresses', { id: 'addr-b', user_id: OWNER_B, tool_id: 'addresses', mailing_name: 'Bea', is_active: true });
  seed('tools_ab_tags', { id: 'addr-tag-a', user_id: OWNER_A, tool_id: 'addresses', name: 'Family' });
  seed('tools_ab_tags', { id: 'addr-tag-b', user_id: OWNER_B, tool_id: 'addresses', name: 'Other' });

  seed('tools_rh_headers', { id: 'header-b', user_id: OWNER_B, tool_id: 'repair', name: 'Kitchen' });
  seed('tools_hcah_headers', { id: 'care-header-b', user_id: OWNER_B, tool_id: 'care', name: 'Clinic' });

  seed('tools_ebp_events', { id: 'event-a', user_id: OWNER_A, tool_id: 'budget', name: 'Party' });
  seed('tools_ebp_events', { id: 'event-b', user_id: OWNER_B, tool_id: 'budget', name: 'Other party' });
  seed('tools_ebp_categories', { id: 'cat-a', user_id: OWNER_A, tool_id: 'budget', name: 'Food' });
  seed('tools_ebp_vendors', { id: 'vendor-a', user_id: OWNER_A, tool_id: 'budget', name: 'Market' });
  seed('tools_ebp_expenses', { id: 'expense-b', event_id: 'event-b', category_id: 'cat-b', vendor_id: 'vendor-b', amount: 12, note: 'keep' });
  seed('tools_ebp_expense_splits', { id: 'split-b', expense_id: 'expense-b', vendor_id: 'vendor-b', amount: 12 });

  seed('tools_eolp_plans', { id: PLAN_A, user_id: OWNER_A, tool_id: 'eol', name: 'Plan A' });
  seed('tools_eolp_family_members', {
    id: FOREIGN_FAMILY,
    user_id: OWNER_B,
    tool_id: 'eol',
    plan_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    name: 'Keep',
  });
}

test('another household cannot change goal children or move them', async () => {
  seedHouseholds();
  signIn(OWNER_A);
  const phasesBefore = snapshot('tools_gt_phases');
  const tasksBefore = snapshot('tools_gt_tasks');
  const notesBefore = snapshot('tools_gt_update_notes');
  const goalsBefore = snapshot('tools_gt_goals');

  const phaseUpdate = await goals.POST(post('http://local/goals', {
    resource: 'phase',
    action: 'update',
    toolId: 'goals',
    phaseId: 'phase-b',
    goalId: 'goal-a',
    name: 'Stolen',
    user_id: OWNER_A,
  }));
  assert.equal(phaseUpdate.status, 404);
  assert.equal(snapshot('tools_gt_phases'), phasesBefore);

  const phaseDelete = await goals.POST(post('http://local/goals', {
    resource: 'phase',
    action: 'delete',
    toolId: 'goals',
    phaseId: 'phase-b',
  }));
  assert.equal(phaseDelete.status, 404);
  assert.equal(snapshot('tools_gt_phases'), phasesBefore);

  const phaseCreate = await goals.POST(post('http://local/goals', {
    resource: 'phase',
    action: 'create',
    toolId: 'goals',
    goalId: 'goal-b',
    name: 'Injected',
    user_id: OWNER_A,
  }));
  assert.equal(phaseCreate.status, 404);
  assert.equal(count('tools_gt_phases'), 2);

  const taskDelete = await goals.POST(post('http://local/goals', {
    resource: 'task',
    action: 'delete',
    toolId: 'goals',
    taskId: 'task-b',
  }));
  assert.equal(taskDelete.status, 404);
  assert.equal(snapshot('tools_gt_tasks'), tasksBefore);

  const swapped = await goals.POST(post('http://local/goals', {
    resource: 'task',
    action: 'create',
    toolId: 'goals',
    phaseId: 'phase-a',
    goalId: 'goal-a2',
    title: 'Swapped',
  }));
  assert.equal(swapped.status, 404);
  assert.equal(count('tools_gt_tasks'), 1);

  const noteUpdate = await goals.POST(post('http://local/goals', {
    resource: 'update_note',
    action: 'update',
    toolId: 'goals',
    noteId: 'unote-b',
    goalId: 'goal-a',
    note: 'stolen',
    noteDate: '2026-02-02',
  }));
  assert.equal(noteUpdate.status, 404);
  assert.equal(snapshot('tools_gt_update_notes'), notesBefore);
  assert.equal(snapshot('tools_gt_goals'), goalsBefore);
});

test('a household member can update the household goal and a forged owner id is ignored', async () => {
  seedHouseholds();
  signIn(OWNER_A, 'user');
  const response = await goals.POST(post('http://local/goals', {
    resource: 'phase',
    action: 'update',
    toolId: 'goals',
    phaseId: 'phase-a',
    name: 'Shared edit',
    user_id: OWNER_B,
  }));
  assert.equal(response.status, 200);
  assert.equal(read('tools_gt_phases', 'phase-a')?.name, 'Shared edit');
  assert.equal(read('tools_gt_phases', 'phase-a')?.goal_id, 'goal-a');
  assert.equal(read('tools_gt_goals', 'goal-a')?.user_id, OWNER_A);

  const created = await goals.POST(post('http://local/goals', {
    resource: 'phase',
    action: 'create',
    toolId: 'goals',
    goalId: 'goal-a',
    name: 'Added by member',
    user_id: OWNER_B,
  }));
  assert.equal(created.status, 200);
  const body = await created.json();
  assert.equal(body.phase.goalId, 'goal-a');
  assert.equal(read('tools_gt_phases', body.phase.id)?.goal_id, 'goal-a');
  assert.notEqual(read('tools_gt_phases', body.phase.id)?.user_id, OWNER_B);
  assert.equal(read('tools_gt_phases', 'phase-b')?.name, 'Phase B');
});

test('shopping list, meal, and plan child writes stay inside the household', async () => {
  seedHouseholds();
  signIn(OWNER_A);
  const linesBefore = snapshot('tools_sl_list_items');
  const ingredientsBefore = snapshot('tools_mp_meal_ingredients');
  const assignmentsBefore = snapshot('tools_mp_plan_assignments');
  const plansBefore = count('tools_mp_plans');

  const cleared = await shopping.POST(post('http://local/shopping', {
    action: 'updateList',
    toolId: 'shopping',
    listId: 'list-b',
    itemIds: [],
    user_id: OWNER_A,
  }));
  assert.equal(cleared.status, 404);
  assert.equal(snapshot('tools_sl_list_items'), linesBefore);
  assert.equal(read('tools_sl_lists', 'list-b')?.name, 'List B');

  const foreignItem = await shopping.POST(post('http://local/shopping', {
    action: 'updateList',
    toolId: 'shopping',
    listId: 'list-a',
    itemIds: ['item-b'],
  }));
  assert.equal(foreignItem.status, 404);
  assert.equal(read('tools_sl_lists', 'list-a')?.name, 'List A');
  assert.equal(count('tools_sl_list_items'), 1);

  const meal = await meals.POST(post('http://local/meals', {
    action: 'updateMeal',
    toolId: 'meals',
    mealId: 'meal-b',
    ingredientIds: [],
  }));
  assert.equal(meal.status, 404);
  assert.equal(snapshot('tools_mp_meal_ingredients'), ingredientsBefore);

  const plan = await meals.POST(post('http://local/meals', {
    action: 'updatePlan',
    toolId: 'meals',
    planId: 'plan-b',
    name: 'Stolen plan',
  }));
  assert.equal(plan.status, 404);
  assert.equal(read('tools_mp_plans', 'plan-b')?.name, 'Plan B');
  assert.equal(snapshot('tools_mp_plan_assignments'), assignmentsBefore);

  const copied = await meals.POST(post('http://local/meals', {
    action: 'createPlan',
    toolId: 'meals',
    name: 'Copied',
    startDate: '2026-01-05',
    copyFromPlanId: 'plan-b',
  }));
  assert.equal(copied.status, 404);
  assert.equal(count('tools_mp_plans'), plansBefore);
});

test('protected notes hide content until the server accepts the password', async () => {
  seedHouseholds();
  signIn(OWNER_A);
  const listed = await notes.GET(new NextRequest('http://local/notes?toolId=notes'));
  assert.equal(listed.status, 200);
  const listBody = await listed.text();
  assert.equal(listBody.includes('SECRET-BODY'), false);
  assert.equal(listBody.includes('B-SECRET'), false);
  assert.equal(listBody.includes(passwordHash), false);
  assert.equal(listBody.includes('view_password_hash'), false);
  assert.equal(listBody.includes('OPEN-BODY'), true);
  const parsed = JSON.parse(listBody);
  const locked = parsed.notes.find((note: { id: string }) => note.id === 'note-locked');
  assert.equal(locked.note, '');
  assert.equal(locked.content_locked, true);

  const other = await notes.GET(new NextRequest('http://local/notes?toolId=notes&noteId=note-b'));
  assert.equal(other.status, 404);

  const hashBefore = read('tools_note_notes', 'note-locked')?.view_password_hash;
  const wrong = await verifyPassword.POST(post('http://local/notes/verify', { noteId: 'note-locked', password: 'nope' }));
  const wrongBody = await wrong.json();
  assert.equal(wrong.status, 200);
  assert.deepEqual(wrongBody, { valid: false });
  assert.equal(read('tools_note_notes', 'note-locked')?.view_password_hash, hashBefore);
  assert.equal(read('tools_note_notes', 'note-locked')?.note, 'SECRET-BODY');

  const right = await verifyPassword.POST(post('http://local/notes/verify', { noteId: 'note-locked', password: 'correct-password' }));
  const rightText = await right.text();
  assert.equal(right.status, 200);
  assert.equal(rightText.includes(passwordHash), false);
  assert.deepEqual(JSON.parse(rightText), { valid: true, note: 'SECRET-BODY' });

  const foreignPassword = await verifyPassword.POST(post('http://local/notes/verify', { noteId: 'note-b', password: 'correct-password' }));
  assert.equal(foreignPassword.status, 404);
  const foreignText = await foreignPassword.text();
  assert.equal(foreignText.includes('B-SECRET'), false);
});

test('note and address tag ids from another household do not change the record', async () => {
  seedHouseholds();
  signIn(OWNER_A);
  const noteBefore = snapshot('tools_note_notes');
  const noteTagsBefore = snapshot('tools_note_note_tags');
  const addressBefore = snapshot('tools_ab_addresses');
  const addressTagsBefore = snapshot('tools_ab_address_tags');

  const noteResponse = await notes.POST(post('http://local/notes', {
    toolId: 'notes',
    noteId: 'note-open',
    action: 'update',
    noteName: 'Changed',
    createdDate: '2026-01-01',
    note: 'Changed body',
    selectedTags: ['tag-b'],
  }));
  assert.equal(noteResponse.status, 404);
  assert.equal(snapshot('tools_note_notes'), noteBefore);
  assert.equal(snapshot('tools_note_note_tags'), noteTagsBefore);

  const addressResponse = await addresses.POST(post('http://local/addresses', {
    toolId: 'addresses',
    action: 'update',
    addressId: 'addr-a',
    mailingName: 'Changed',
    selectedTags: ['addr-tag-b'],
  }));
  assert.equal(addressResponse.status, 404);
  assert.equal(snapshot('tools_ab_addresses'), addressBefore);
  assert.equal(snapshot('tools_ab_address_tags'), addressTagsBefore);

  const foreignAddress = await addresses.POST(post('http://local/addresses', {
    toolId: 'addresses',
    action: 'update',
    addressId: 'addr-b',
    mailingName: 'Stolen',
    selectedTags: ['addr-tag-a'],
  }));
  assert.equal(foreignAddress.status, 404);
  assert.equal(read('tools_ab_addresses', 'addr-b')?.mailing_name, 'Bea');
});

test('document responses omit password hashes and downloads require the password', async () => {
  seedHouseholds();
  signIn(OWNER_A);
  const listed = await documents.GET(new NextRequest('http://local/documents?toolId=docs'));
  const listedText = await listed.text();
  assert.equal(listed.status, 200);
  assert.equal(listedText.includes(passwordHash), false);
  assert.equal(listedText.includes('download_password_hash'), false);
  assert.equal(listedText.includes('file_url'), false);
  assert.equal(listedText.includes('deed.pdf'), true);

  const hashBefore = read('tools_id_documents', 'doc-a')?.download_password_hash;
  const missing = await download.GET(new NextRequest('http://local/documents/doc-a'), { params: Promise.resolve({ documentId: 'doc-a' }) });
  assert.equal(missing.status, 403);
  const wrong = await download.GET(new NextRequest('http://local/documents/doc-a?password=nope'), { params: Promise.resolve({ documentId: 'doc-a' }) });
  assert.equal(wrong.status, 403);
  assert.equal(read('tools_id_documents', 'doc-a')?.download_password_hash, hashBefore);

  const allowed = await download.GET(
    new NextRequest('http://local/documents/doc-a?password=correct-password'),
    { params: Promise.resolve({ documentId: 'doc-a' }) }
  );
  assert.equal(allowed.status, 200);
  const bytes = Buffer.from(await allowed.arrayBuffer());
  assert.deepEqual([...bytes], [9, 8, 7]);
  assert.equal(Buffer.from(bytes).toString('utf8').includes(passwordHash), false);

  signIn(OWNER_B);
  const cross = await download.GET(
    new NextRequest('http://local/documents/doc-a?password=correct-password'),
    { params: Promise.resolve({ documentId: 'doc-a' }) }
  );
  assert.equal(cross.status, 404);
});

test('repair, healthcare, and budget child ids cannot be pointed at another household', async () => {
  seedHouseholds();
  signIn(OWNER_A);
  const repairsBefore = snapshot('tools_rh_records');
  const careBefore = snapshot('tools_hcah_records');
  const expensesBefore = snapshot('tools_ebp_expenses');
  const splitsBefore = snapshot('tools_ebp_expense_splits');

  const repairForm = new FormData();
  repairForm.set('toolId', 'repair');
  repairForm.set('resource', 'record');
  repairForm.set('action', 'create');
  repairForm.set('headerId', 'header-b');
  repairForm.set('itemName', 'Stolen repair');
  repairForm.set('date', '2026-01-01');
  repairForm.set('type', 'repair');
  const repairResponse = await repairs.POST(new NextRequest('http://local/repair', { method: 'POST', body: repairForm }));
  assert.equal(repairResponse.status, 404);
  assert.equal(snapshot('tools_rh_records'), repairsBefore);

  const careForm = new FormData();
  careForm.set('toolId', 'care');
  careForm.set('resource', 'record');
  careForm.set('action', 'create');
  careForm.set('headerId', 'care-header-b');
  careForm.set('appointmentDate', '2026-01-01');
  const careResponse = await healthcare.POST(new NextRequest('http://local/care', { method: 'POST', body: careForm }));
  assert.equal(careResponse.status, 404);
  assert.equal(snapshot('tools_hcah_records'), careBefore);

  const expense = await budgets.POST(post('http://local/budget', {
    toolId: 'budget',
    action: 'updateExpense',
    eventId: 'event-a',
    expenseId: 'expense-b',
    categoryId: 'cat-a',
    vendorId: 'vendor-a',
    amount: 99,
    note: 'stolen',
  }));
  assert.equal(expense.status, 404);
  assert.equal(snapshot('tools_ebp_expenses'), expensesBefore);
  assert.equal(snapshot('tools_ebp_expense_splits'), splitsBefore);
});

test('an end-of-life child id from another household is not overwritten', async () => {
  seedHouseholds();
  const data = emptyPlanData();
  data.personal = {
    ...data.personal,
    familyMembers: [{ id: FOREIGN_FAMILY, name: 'Stolen', contactInfo: '', relationship: 'Cousin' }],
  };
  await assert.rejects(
    () => saveEolPlan(OWNER_A, 'eol', {
      id: PLAN_A,
      name: 'Plan A',
      personFullName: 'Ada',
      relationship: '',
      relationshipCustom: '',
      dateOfBirth: '',
      dateCreated: '2026-01-01T00:00:00.000Z',
      lastUpdated: '2026-01-01T00:00:00.000Z',
      card_color: '#10b981',
      status: 'Active',
      historyEvents: [],
      data,
    }),
    /Record not found/
  );
  const foreign = read('tools_eolp_family_members', FOREIGN_FAMILY);
  assert.equal(foreign?.user_id, OWNER_B);
  assert.equal(foreign?.name, 'Keep');
  assert.equal(foreign?.plan_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2');
});

test('a household member resolved to the admin data owner does not receive admin permissions', async () => {
  seedHouseholds();
  seed('account_notices', { id: 'notice-a', user_id: OWNER_A, kind: 'billing', title: 'Bill', read_at: null });
  seed('users_tools', { id: 'owned-tool', user_id: OWNER_A, tool_id: 'notes', status: 'active' });
  seed('household_invitations', {
    id: 'invite-existing',
    household_id: 'household-a',
    invited_email: 'keep@household.test',
    status: 'pending',
  });
  signIn(OWNER_A, 'user');
  assert.equal(state.session?.id, OWNER_A);
  assert.equal(state.session?.actorId, MEMBER_A);
  assert.equal(state.session?.householdRole, 'user');

  const noticeList = await notices.GET();
  assert.equal(noticeList.status, 403);
  const noticeUpdate = await notices.POST(post('http://local/notices', { all: true }));
  assert.equal(noticeUpdate.status, 403);
  assert.equal(read('account_notices', 'notice-a')?.read_at, null);

  const payment = await checkout.POST(new NextRequest('http://local/checkout', { method: 'POST' }));
  assert.equal(payment.status, 403);
  const manage = await portal.POST(new NextRequest('http://local/portal', { method: 'POST' }));
  assert.equal(manage.status, 403);
  const code = await redeem.POST(post('http://local/redeem', { code: 'SAVE' }));
  assert.equal(code.status, 403);
  const purchase = await buyTool.POST(post('http://local/buy', { toolId: 'notes' }));
  assert.equal(purchase.status, 403);
  assert.equal(count('users_tools'), 1);
  assert.equal(read('users_tools', 'owned-tool')?.user_id, OWNER_A);

  const removal = await myTools.DELETE(post('http://local/my-tools', { toolId: 'owned-tool', confirmText: 'delete' }));
  assert.equal(removal.status, 403);
  assert.equal(read('users_tools', 'owned-tool')?.status, 'active');

  const invite = await householdUsers.POST(post('http://local/household/users', {
    firstName: 'Sam',
    email: 'sam@household.test',
  }));
  assert.equal(invite.status, 403);
  assert.equal(count('household_invitations'), 1);
  assert.equal(read('household_invitations', 'invite-existing')?.invited_email, 'keep@household.test');
});
