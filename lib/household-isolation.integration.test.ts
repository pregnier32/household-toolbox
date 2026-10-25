/**
 * Opt-in checks against an isolated Supabase project.
 *
 * Required environment, all three, and none of them may be the production project:
 *   HTB_TEST_SUPABASE_URL
 *   HTB_TEST_SUPABASE_ANON_KEY
 *   HTB_TEST_SUPABASE_SERVICE_ROLE_KEY
 *
 * Run with: npm run test:isolation
 * The project must already contain this application's schema, including the Notes
 * and Important Documents tools. The test creates two households and deletes them.
 */
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import Module from 'node:module';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';

const PRODUCTION_REF = 'hjbneuicvfbihtbufrxq';
const testUrl = process.env.HTB_TEST_SUPABASE_URL ?? '';
const testAnon = process.env.HTB_TEST_SUPABASE_ANON_KEY ?? '';
const testService = process.env.HTB_TEST_SUPABASE_SERVICE_ROLE_KEY ?? '';
const configured = Boolean(testUrl && testAnon && testService);
const pointsAtProduction = testUrl.includes(PRODUCTION_REF);
const skipReason = pointsAtProduction
  ? 'HTB_TEST_SUPABASE_URL points at the production project.'
  : 'Set HTB_TEST_SUPABASE_URL, HTB_TEST_SUPABASE_ANON_KEY, and HTB_TEST_SUPABASE_SERVICE_ROLE_KEY to an isolated project.';

test('isolation configuration does not point at production', () => {
  if (pointsAtProduction) {
    throw new Error('HTB_TEST_SUPABASE_URL points at the production project. Choose an isolated project.');
  }
});

test(
  'two households stay isolated through PostgREST and the notes and document routes',
  { skip: configured && !pointsAtProduction ? false : skipReason },
  async () => {
    await runIsolatedHouseholds();
  }
);

type CookieStore = {
  getAll: () => Array<{ name: string; value: string }>;
  set: (name: string, value: string) => void;
  delete: (name: string) => void;
};

function cookieJar(): CookieStore {
  const cookies: Array<{ name: string; value: string }> = [];
  return {
    getAll: () => cookies.map((cookie) => ({ ...cookie })),
    set(name: string, value: string) {
      const index = cookies.findIndex((cookie) => cookie.name === name);
      if (index >= 0) cookies[index] = { name, value };
      else cookies.push({ name, value });
    },
    delete(name: string) {
      const index = cookies.findIndex((cookie) => cookie.name === name);
      if (index >= 0) cookies.splice(index, 1);
    },
  };
}

function installCookieMock(store: CookieStore) {
  const loader = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const original = loader._load;
  loader._load = function (request: string, parent: unknown, isMain: boolean) {
    if (request === 'next/headers') return { cookies: async () => store };
    return original.call(this, request, parent, isMain);
  };
  return () => {
    loader._load = original;
  };
}

async function runIsolatedHouseholds() {
  if (!configured || testUrl.includes(PRODUCTION_REF)) {
    throw new Error('Refusing to run isolation tests without a non-production project.');
  }

  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = testUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = testAnon;
  process.env.SUPABASE_SERVICE_ROLE_KEY = testService;

  const { createClient } = await import('@supabase/supabase-js');
  const service = createClient(testUrl, testService, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password = `${randomBytes(18).toString('base64url')}Aa1!`;
  const stamp = randomUUID().slice(0, 8);
  const createdAuthIds: string[] = [];
  const createdNoteIds: string[] = [];
  const createdDocumentIds: string[] = [];
  const createdHouseholdIds: string[] = [];
  let storagePath = '';

  function failure(error: { message?: string; code?: string } | null, action: string) {
    if (error) throw new Error(`${action} failed (${error.code ?? 'no_code'}): ${error.message ?? 'unknown'}`);
  }

  try {
    async function createPerson(label: string, role: 'admin' | 'user', householdId?: string) {
      const email = `htb-${label}-${stamp}@example.com`;
      const created = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      failure(created.error, `create ${label}`);
      const userId = created.data.user?.id;
      if (!userId) throw new Error(`create ${label} returned no user`);
      createdAuthIds.push(userId);
      failure(await service.from('users').insert({
        id: userId,
        user_id: userId,
        email,
        first_name: label,
        last_name: 'Isolation',
        active: 'Y',
        user_status: role === 'admin' ? 'admin' : 'guest',
        theme_preference: 'light',
      }).then((result) => result.error), `profile ${label}`);

      let resolvedHousehold = householdId;
      if (!resolvedHousehold) {
        const household = await service.from('households').insert({ admin_user_id: userId }).select('id').single();
        failure(household.error, `household ${label}`);
        const createdHouseholdId = household.data?.id;
        if (!createdHouseholdId) throw new Error(`household ${label} was not created`);
        resolvedHousehold = createdHouseholdId;
        createdHouseholdIds.push(createdHouseholdId);
      }
      if (!resolvedHousehold) throw new Error(`household ${label} was not created`);
      failure(await service.from('household_members').insert({
        household_id: resolvedHousehold,
        user_id: userId,
        role,
        status: 'active',
      }).then((result) => result.error), `membership ${label}`);
      return { id: userId, email, householdId: resolvedHousehold };
    }

    const adminA = await createPerson('admin-a', 'admin');
    const memberA = await createPerson('member-a', 'user', adminA.householdId);
    const adminB = await createPerson('admin-b', 'admin');

    const notesTool = await service.from('tools').select('id').eq('name', 'Notes').maybeSingle();
    const documentsTool = await service.from('tools').select('id').eq('name', 'Important Documents').maybeSingle();
    failure(notesTool.error, 'lookup Notes tool');
    failure(documentsTool.error, 'lookup Important Documents tool');
    if (!notesTool.data?.id || !documentsTool.data?.id) {
      throw new Error('The isolated project is missing the Notes or Important Documents tool.');
    }

    for (const owner of [adminA, adminB]) {
      for (const toolId of [notesTool.data.id, documentsTool.data.id]) {
        failure(await service.from('users_tools').insert({
          user_id: owner.id,
          tool_id: toolId,
          status: 'active',
        }).then((result) => result.error), 'grant tool');
      }
    }

    const noteHash = bcrypt.hashSync('correct-password', 4);
    const lockedNoteId = randomUUID();
    const openNoteId = randomUUID();
    const foreignNoteId = randomUUID();
    createdNoteIds.push(lockedNoteId, openNoteId, foreignNoteId);
    failure(await service.from('tools_note_notes').insert([
      {
        id: lockedNoteId,
        user_id: adminA.id,
        tool_id: notesTool.data.id,
        note_name: 'Locked',
        created_date: '2026-01-01',
        date_added: '2026-01-01',
        note: 'SECRET-BODY',
        requires_password_for_view: true,
        view_password_hash: noteHash,
        is_active: true,
      },
      {
        id: foreignNoteId,
        user_id: adminB.id,
        tool_id: notesTool.data.id,
        note_name: 'Foreign',
        created_date: '2026-01-01',
        date_added: '2026-01-01',
        note: 'OTHER-SECRET',
        requires_password_for_view: true,
        view_password_hash: noteHash,
        is_active: true,
      },
      {
        id: openNoteId,
        user_id: adminA.id,
        tool_id: notesTool.data.id,
        note_name: 'Open',
        created_date: '2026-01-01',
        date_added: '2026-01-01',
        note: 'OPEN-BODY',
        requires_password_for_view: false,
        view_password_hash: null,
        is_active: true,
      },
    ]).then((result) => result.error), 'insert notes');

    storagePath = `${adminA.id}/isolation-deed.pdf`;
    const fileBytes = Uint8Array.from([9, 8, 7]);
    const uploaded = await service.storage.from('important-documents').upload(storagePath, fileBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });
    failure(uploaded.error, 'upload document');
    const documentId = randomUUID();
    const foreignDocumentId = randomUUID();
    createdDocumentIds.push(documentId, foreignDocumentId);
    const documentUrl = `${testUrl}/storage/v1/object/important-documents/${storagePath}`;
    failure(await service.from('tools_id_documents').insert([
      {
        id: documentId,
        user_id: adminA.id,
        tool_id: documentsTool.data.id,
        document_name: 'Deed',
        uploaded_date: '2026-01-01',
        date_added: '2026-01-01',
        file_url: documentUrl,
        file_name: 'deed.pdf',
        file_type: 'application/pdf',
        requires_password_for_download: true,
        download_password_hash: noteHash,
      },
      {
        id: foreignDocumentId,
        user_id: adminB.id,
        tool_id: documentsTool.data.id,
        document_name: 'Foreign deed',
        uploaded_date: '2026-01-01',
        date_added: '2026-01-01',
        file_url: `${testUrl}/storage/v1/object/important-documents/${adminB.id}/missing.pdf`,
        file_name: 'missing.pdf',
        file_type: 'application/pdf',
        requires_password_for_download: true,
        download_password_hash: noteHash,
      },
    ]).then((result) => result.error), 'insert documents');

    const anon = createClient(testUrl, testAnon, { auth: { persistSession: false, autoRefreshToken: false } });
    const memberSession = await anon.auth.signInWithPassword({ email: memberA.email, password });
    failure(memberSession.error, 'member sign-in');
    const memberToken = memberSession.data.session?.access_token;
    if (!memberToken) throw new Error('member sign-in returned no access token');
    const member = createClient(testUrl, testAnon, {
      global: { headers: { Authorization: `Bearer ${memberToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ownNotes = await member.from('tools_note_notes').select('id, note_name, user_id').eq('id', lockedNoteId);
    failure(ownNotes.error, 'member read own household note metadata');
    assert.equal(ownNotes.data?.length, 1);
    assert.equal(ownNotes.data?.[0]?.user_id, adminA.id);
    assert.equal(JSON.stringify(ownNotes.data).includes('SECRET-BODY'), false);

    const lockedBody = await member.from('tools_note_notes').select('note').eq('id', lockedNoteId);
    assert.ok(lockedBody.error, 'direct note text must be denied');
    assert.equal(JSON.stringify(lockedBody).includes('SECRET-BODY'), false);
    const noteHashRead = await member.from('tools_note_notes').select('view_password_hash').eq('id', lockedNoteId);
    assert.ok(noteHashRead.error, 'direct note password hash must be denied');
    const answerHashRead = await member.from('tools_note_security_questions').select('answer_hash').limit(1);
    assert.ok(answerHashRead.error, 'direct answer hash must be denied');
    const documentHashRead = await member.from('tools_id_documents').select('download_password_hash').eq('id', documentId);
    assert.ok(documentHashRead.error, 'direct document password hash must be denied');

    const foreignNotes = await member.from('tools_note_notes').select('id, note_name').eq('id', foreignNoteId);
    failure(foreignNotes.error, 'member read other household note');
    assert.equal(foreignNotes.data?.length, 0);

    const foreignDocuments = await member.from('tools_id_documents').select('id, document_name').eq('id', foreignDocumentId);
    failure(foreignDocuments.error, 'member read other household document');
    assert.equal(foreignDocuments.data?.length, 0);

    const crossOwner = await member.from('tools_note_notes').update({ user_id: adminB.id }).eq('id', lockedNoteId).select('id');
    assert.equal(crossOwner.data?.length ?? 0, 0);
    const afterCross = await service.from('tools_note_notes').select('user_id').eq('id', lockedNoteId).single();
    failure(afterCross.error, 'reread note owner');
    assert.ok(afterCross.data);
    assert.equal(afterCross.data.user_id, adminA.id);

    const withinHousehold = await member.from('tools_note_notes').update({ user_id: memberA.id }).eq('id', lockedNoteId).select('id, user_id');
    const afterWithin = await service.from('tools_note_notes').select('user_id').eq('id', lockedNoteId).single();
    failure(afterWithin.error, 'reread note after ownership attempt');
    assert.ok(afterWithin.data);
    assert.equal(withinHousehold.data?.length ?? 0, 0);
    assert.equal(afterWithin.data.user_id, adminA.id);

    const roleUpdate = await member.from('household_members').update({ role: 'admin' }).eq('user_id', memberA.id).select('role');
    assert.equal(roleUpdate.data?.length ?? 0, 0);
    const roleRow = await service.from('household_members').select('role').eq('user_id', memberA.id).single();
    failure(roleRow.error, 'reread membership');
    assert.ok(roleRow.data);
    assert.equal(roleRow.data.role, 'user');

    const statusUpdate = await member.from('users').update({ user_status: 'superadmin' }).eq('id', memberA.id).select('user_status');
    assert.equal(statusUpdate.data?.length ?? 0, 0);
    const statusRow = await service.from('users').select('user_status').eq('id', memberA.id).single();
    failure(statusRow.error, 'reread user status');
    assert.ok(statusRow.data);
    assert.equal(statusRow.data.user_status, 'guest');

    const standalone = await createPerson('standalone', 'admin');
    const standaloneNoteId = randomUUID();
    createdNoteIds.push(standaloneNoteId);
    failure(await service.from('tools_note_notes').insert({
      id: standaloneNoteId,
      user_id: standalone.id,
      tool_id: notesTool.data.id,
      note_name: 'Standalone',
      created_date: '2026-01-01',
      date_added: '2026-01-01',
      note: 'STANDALONE-BODY',
      requires_password_for_view: false,
      is_active: true,
    }).then((result) => result.error), 'insert standalone note');
    failure(await service.from('users_tools').insert({
      user_id: standalone.id,
      tool_id: notesTool.data.id,
      status: 'active',
    }).then((result) => result.error), 'grant standalone tool');
    const standaloneSession = await anon.auth.signInWithPassword({ email: standalone.email, password });
    failure(standaloneSession.error, 'standalone sign-in');
    const standaloneToken = standaloneSession.data.session?.access_token;
    if (!standaloneToken) throw new Error('standalone sign-in returned no access token');
    const standaloneClient = createClient(testUrl, testAnon, {
      global: { headers: { Authorization: `Bearer ${standaloneToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ownStandalone = await standaloneClient.from('tools_note_notes').select('id, note_name').eq('id', standaloneNoteId);
    failure(ownStandalone.error, 'standalone read own note metadata');
    assert.equal(ownStandalone.data?.length, 1);
    const standaloneBody = await standaloneClient.from('tools_note_notes').select('note').eq('id', standaloneNoteId);
    assert.ok(standaloneBody.error, 'standalone direct note text must be denied');
    const standaloneCross = await standaloneClient.from('tools_note_notes').select('id').eq('id', lockedNoteId);
    failure(standaloneCross.error, 'standalone read another household');
    assert.equal(standaloneCross.data?.length, 0);
    const memberSeesStandalone = await member.from('tools_note_notes').select('id').eq('id', standaloneNoteId);
    failure(memberSeesStandalone.error, 'member read standalone note');
    assert.equal(memberSeesStandalone.data?.length, 0);

    const edited = await service.from('tools_note_notes').update({
      note_name: 'Locked renamed',
      note: 'SECRET-BODY',
    }).eq('id', lockedNoteId).select('note_name, note').single();
    failure(edited.error, 'service role edit');
    assert.equal(edited.data?.note_name, 'Locked renamed');
    assert.equal(edited.data?.note, 'SECRET-BODY');
    const serviceReassign = await service.from('tools_note_notes').update({ user_id: memberA.id }).eq('id', lockedNoteId);
    assert.ok(serviceReassign.error, 'service role must not reassign user_id');
    const afterService = await service.from('tools_note_notes').select('user_id, note').eq('id', lockedNoteId).single();
    failure(afterService.error, 'reread service role note');
    assert.equal(afterService.data?.user_id, adminA.id);
    assert.equal(afterService.data?.note, 'SECRET-BODY');

    const anonRpc = await anon.rpc('apply_tools_eolp_owner_rls', { p_table: 'tools_note_notes' });
    assert.ok(anonRpc.error, 'anon must not execute apply_tools_eolp_owner_rls');
    const storageUsage = await service.rpc('get_user_storage_usage', { p_user_id: adminA.id });
    failure(storageUsage.error, 'service role storage usage');

    const store = cookieJar();
    const restoreLoader = installCookieMock(store);
    try {
      const { createSupabaseAuthServerClient } = await import('./supabaseAuthServer');
      const auth = await createSupabaseAuthServerClient();
      const signed = await auth.auth.signInWithPassword({ email: memberA.email, password });
      failure(signed.error, 'route session sign-in');
      assert.ok(store.getAll().length > 0, 'route session did not store an auth cookie');

      const { NextRequest } = await import('next/server');
      const notes = await import('@/app/api/tools/notes/route');
      const documents = await import('@/app/api/tools/important-documents/route');
      const download = await import('@/app/api/tools/important-documents/download/[documentId]/route');

      const noteResponse = await notes.GET(new NextRequest(
        `http://local/api/tools/notes?toolId=${notesTool.data.id}&noteId=${lockedNoteId}`
      ));
      assert.equal(noteResponse.status, 200);
      const noteBody = await noteResponse.json();
      assert.equal(noteBody.note?.note, '');
      assert.equal(noteBody.note?.content_locked, true);
      assert.equal(Object.hasOwn(noteBody.note ?? {}, 'view_password_hash'), false);

      const openResponse = await notes.GET(new NextRequest(
        `http://local/api/tools/notes?toolId=${notesTool.data.id}&noteId=${openNoteId}`
      ));
      assert.equal(openResponse.status, 200);
      const openBody = await openResponse.json();
      assert.equal(openBody.note?.note, 'OPEN-BODY');
      assert.equal(openBody.note?.content_locked, false);

      const foreignNoteResponse = await notes.GET(new NextRequest(
        `http://local/api/tools/notes?toolId=${notesTool.data.id}&noteId=${foreignNoteId}`
      ));
      assert.equal(foreignNoteResponse.status, 404);

      const verifyPassword = await import('@/app/api/tools/notes/verify-password/route');
      const wrongNotePassword = await verifyPassword.POST(new NextRequest('http://local/api/tools/notes/verify-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ noteId: lockedNoteId, password: 'wrong-password' }),
      }));
      assert.equal(wrongNotePassword.status, 200);
      const wrongNoteBody = await wrongNotePassword.json();
      assert.equal(wrongNoteBody.valid, false);
      assert.equal(JSON.stringify(wrongNoteBody).includes('SECRET-BODY'), false);
      const rightNotePassword = await verifyPassword.POST(new NextRequest('http://local/api/tools/notes/verify-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ noteId: lockedNoteId, password: 'correct-password' }),
      }));
      assert.equal(rightNotePassword.status, 200);
      const rightNoteBody = await rightNotePassword.json();
      assert.equal(rightNoteBody.valid, true);
      assert.equal(rightNoteBody.note, 'SECRET-BODY');
      assert.equal(JSON.stringify(rightNoteBody).includes('view_password_hash'), false);

      const documentResponse = await documents.GET(new NextRequest(
        `http://local/api/tools/important-documents?toolId=${documentsTool.data.id}&documentId=${documentId}`
      ));
      assert.equal(documentResponse.status, 200);
      const documentBody = await documentResponse.json();
      const serialized = JSON.stringify(documentBody);
      assert.equal(serialized.includes('download_password_hash'), false);
      assert.equal(serialized.includes(documentUrl), false);

      const blockedDownload = await download.GET(
        new NextRequest(`http://local/api/tools/important-documents/download/${documentId}`),
        { params: Promise.resolve({ documentId }) }
      );
      assert.equal(blockedDownload.status, 403);
      const wrongPassword = await download.GET(
        new NextRequest(`http://local/api/tools/important-documents/download/${documentId}?password=wrong-password`),
        { params: Promise.resolve({ documentId }) }
      );
      assert.equal(wrongPassword.status, 403);
      const openedDownload = await download.GET(
        new NextRequest(`http://local/api/tools/important-documents/download/${documentId}?password=correct-password`),
        { params: Promise.resolve({ documentId }) }
      );
      assert.equal(openedDownload.status, 200);
      assert.deepEqual(Array.from(new Uint8Array(await openedDownload.arrayBuffer())), [9, 8, 7]);
      const foreignDownload = await download.GET(
        new NextRequest(`http://local/api/tools/important-documents/download/${foreignDocumentId}?password=correct-password`),
        { params: Promise.resolve({ documentId: foreignDocumentId }) }
      );
      assert.equal(foreignDownload.status, 404);
    } finally {
      restoreLoader();
    }
  } finally {
    if (storagePath) await service.storage.from('important-documents').remove([storagePath]);
    if (createdDocumentIds.length > 0) await service.from('tools_id_documents').delete().in('id', createdDocumentIds);
    if (createdNoteIds.length > 0) await service.from('tools_note_notes').delete().in('id', createdNoteIds);
    if (createdAuthIds.length > 0) await service.from('users_tools').delete().in('user_id', createdAuthIds);
    if (createdAuthIds.length > 0) await service.from('household_members').delete().in('user_id', createdAuthIds);
    if (createdHouseholdIds.length > 0) await service.from('households').delete().in('id', createdHouseholdIds);
    if (createdAuthIds.length > 0) await service.from('users').delete().in('id', createdAuthIds);
    for (const userId of createdAuthIds) await service.auth.admin.deleteUser(userId);
    process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previous.anon;
    process.env.SUPABASE_SERVICE_ROLE_KEY = previous.service;
  }
}
