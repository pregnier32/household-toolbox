import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BUCKET_NAME = 'heathcare-appt-history';

async function findHealthcareDashboardItem(
  userId: string,
  toolId: string,
  recordId: string
): Promise<{ id: string } | null> {
  const { data: items } = await supabaseServer
    .from('dashboard_items')
    .select('id, metadata')
    .eq('user_id', userId)
    .eq('tool_id', toolId);
  const row = (items || []).find(
    (item: { metadata?: { source?: string; record_id?: string } }) =>
      item.metadata?.source === 'healthcare_appt' && item.metadata?.record_id === recordId
  );
  return row ? { id: row.id } : null;
}

async function syncHealthcareRecordToDashboard(
  userId: string,
  toolId: string,
  recordId: string,
  showOnDashboard: boolean,
  payload: {
    appointment_date: string;
    care_facility: string | null;
    provider_info: string | null;
    reason_for_visit: string | null;
  }
): Promise<void> {
  const existing = await findHealthcareDashboardItem(userId, toolId, recordId);
  if (existing) {
    await supabaseServer.from('dashboard_items').delete().eq('id', existing.id);
  }
  if (!showOnDashboard) return;
  const title =
    payload.care_facility?.trim() || payload.reason_for_visit?.trim()
      ? `Healthcare: ${[payload.care_facility?.trim(), payload.reason_for_visit?.trim()].filter(Boolean).join(' – ')}`
      : 'Healthcare appointment';
  const scheduledDate = `${payload.appointment_date}T12:00:00.000Z`;
  await supabaseServer.from('dashboard_items').insert({
    user_id: userId,
    tool_id: toolId,
    title,
    description: payload.provider_info || null,
    type: 'calendar_event',
    scheduled_date: scheduledDate,
    status: 'pending',
    metadata: { source: 'healthcare_appt', record_id: recordId },
  });
}

async function copyDefaultsToUser(userId: string, toolId: string) {
  const { data: existing } = await supabaseServer
    .from('tools_hcah_headers')
    .select('id')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .limit(1);
  if (existing?.length) return;

  const { data: defaultHeaders } = await supabaseServer
    .from('tools_hcah_default_headers')
    .select('*')
    .order('display_order', { ascending: true });
  if (!defaultHeaders?.length) return;

  await supabaseServer.from('tools_hcah_headers').insert(
    defaultHeaders.map((h) => ({
      user_id: userId,
      tool_id: toolId,
      name: h.name,
      card_color: h.card_color,
    }))
  );
}

async function uploadFile(
  file: File,
  userId: string,
  folder: string
): Promise<{ url: string; fileName: string; fileSize: number; fileType: string } | null> {
  if (file.size > MAX_FILE_SIZE) throw new Error(`File size cannot exceed ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${folder}/${userId}/${Date.now()}-${sanitized}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseServer.storage.from(BUCKET_NAME).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('does not exist'))
      throw new Error(`Storage bucket '${BUCKET_NAME}' does not exist. Create it in Supabase Storage.`);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }
  const { data: urlData } = supabaseServer.storage.from(BUCKET_NAME).getPublicUrl(path);
  return { url: urlData.publicUrl, fileName: file.name, fileSize: file.size, fileType: file.type };
}

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const toolId = searchParams.get('toolId');
  const resource = searchParams.get('resource');
  const headerId = searchParams.get('headerId');
  const recordId = searchParams.get('recordId');

  if (!toolId) return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });

  try {
    if (!resource || resource === 'headers') {
      let headers = await (async () => {
        const { data, error } = await supabaseServer
          .from('tools_hcah_headers')
          .select('*')
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .order('created_at', { ascending: true });
        if (error) throw new Error('Failed to fetch headers');
        return data || [];
      })();
      if (headers.length === 0) {
        await copyDefaultsToUser(user.id, toolId);
        const { data: reloaded, error: reloadErr } = await supabaseServer
          .from('tools_hcah_headers')
          .select('*')
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .order('created_at', { ascending: true });
        if (reloadErr) return NextResponse.json({ error: 'Failed to fetch headers' }, { status: 500 });
        headers = reloaded || [];
      }
      return NextResponse.json({ headers });
    }

    if (!resource || resource === 'records') {
      if (recordId) {
        const { data: record, error: recErr } = await supabaseServer
          .from('tools_hcah_records')
          .select('*')
          .eq('id', recordId)
          .eq('user_id', user.id)
          .single();
        if (recErr || !record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        const { data: docs } = await supabaseServer
          .from('tools_hcah_documents')
          .select('*')
          .eq('record_id', recordId)
          .order('display_order', { ascending: true });
        return NextResponse.json({
          record: {
            ...record,
            documents: (docs || []).map((d) => ({
              id: d.id,
              name: d.file_name ?? d.file_url,
              fileUrl: d.file_url,
              file_size: d.file_size,
            })),
          },
        });
      }

      let query = supabaseServer
        .from('tools_hcah_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (headerId) query = query.eq('header_id', headerId);
      const { data: records, error } = await query.order('appointment_date', { ascending: false });
      if (error) return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });

      const list = records || [];
      const ids = list.map((r) => r.id);
      const documentsByRecord: Record<string, { id: string; name: string; fileUrl: string; file_size: number | null }[]> = {};
      if (ids.length > 0) {
        const { data: docs } = await supabaseServer
          .from('tools_hcah_documents')
          .select('*')
          .in('record_id', ids)
          .order('display_order', { ascending: true });
        (docs || []).forEach((d) => {
          if (!documentsByRecord[d.record_id]) documentsByRecord[d.record_id] = [];
          documentsByRecord[d.record_id].push({
            id: d.id,
            name: d.file_name ?? d.file_url,
            fileUrl: d.file_url,
            file_size: d.file_size,
          });
        });
      }
      const recordsWithDocs = list.map((r) => ({
        ...r,
        documents: documentsByRecord[r.id] || [],
      }));
      if (resource === 'records') return NextResponse.json({ records: recordsWithDocs });
    }

    return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
  } catch (e) {
    console.error('GET healthcare-appts-history:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const toolId = formData.get('toolId') as string;
    const resource = formData.get('resource') as string;
    const action = formData.get('action') as string;

    if (!toolId) return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });

    if (resource === 'header') {
      const headerId = formData.get('headerId') as string | null;
      const name = (formData.get('name') as string)?.trim();
      const cardColor = (formData.get('cardColor') as string) || '#10b981';

      if (action === 'delete' && headerId) {
        const { error } = await supabaseServer
          .from('tools_hcah_headers')
          .delete()
          .eq('id', headerId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId);
        if (error) return NextResponse.json({ error: 'Failed to delete header' }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      if (action === 'update' && headerId) {
        const { data, error } = await supabaseServer
          .from('tools_hcah_headers')
          .update({ name, card_color: cardColor })
          .eq('id', headerId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .select()
          .single();
        if (error) return NextResponse.json({ error: 'Failed to update header' }, { status: 500 });
        return NextResponse.json({ success: true, header: data });
      }

      if (action === 'create') {
        const { data, error } = await supabaseServer
          .from('tools_hcah_headers')
          .insert({
            user_id: user.id,
            tool_id: toolId,
            name,
            card_color: cardColor,
          })
          .select()
          .single();
        if (error) return NextResponse.json({ error: 'Failed to create header' }, { status: 500 });
        return NextResponse.json({ success: true, header: data });
      }
    }

    if (resource === 'record') {
      const recordId = formData.get('recordId') as string | null;
      const headerId = formData.get('headerId') as string;
      const appointmentDate = formData.get('appointmentDate') as string;
      const isUpcoming = formData.get('isUpcoming') === 'true';
      const careFacility = (formData.get('careFacility') as string)?.trim() || null;
      const providerInfo = (formData.get('providerInfo') as string)?.trim() || null;
      const reasonForVisit = (formData.get('reasonForVisit') as string)?.trim() || null;
      const preVisitNotes = (formData.get('preVisitNotes') as string)?.trim() || null;
      const postVisitNotes = (formData.get('postVisitNotes') as string)?.trim() || null;
      const showOnDashboardCalendar = formData.get('showOnDashboardCalendar') === 'true';
      const totalBilled = (formData.get('totalBilled') as string)?.trim() || null;
      const insurancePaid = (formData.get('insurancePaid') as string)?.trim() || null;
      const currentAmountDue = (formData.get('currentAmountDue') as string)?.trim() || null;
      const documentFiles = formData.getAll('documents') as File[];

      if (action === 'delete' && recordId) {
        const dashboardItem = await findHealthcareDashboardItem(user.id, toolId, recordId);
        if (dashboardItem) {
          await supabaseServer.from('dashboard_items').delete().eq('id', dashboardItem.id);
        }
        const { error } = await supabaseServer
          .from('tools_hcah_records')
          .delete()
          .eq('id', recordId)
          .eq('user_id', user.id);
        if (error) return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      const recordPayload = {
        header_id: headerId,
        user_id: user.id,
        tool_id: toolId,
        appointment_date: appointmentDate,
        is_upcoming: isUpcoming,
        care_facility: careFacility,
        provider_info: providerInfo,
        reason_for_visit: reasonForVisit,
        pre_visit_notes: preVisitNotes,
        post_visit_notes: postVisitNotes,
        show_on_dashboard_calendar: showOnDashboardCalendar,
        total_billed: totalBilled,
        insurance_paid: insurancePaid,
        current_amount_due: currentAmountDue,
      };

      let finalRecordId = recordId;

      if (action === 'update' && recordId) {
        const { data, error } = await supabaseServer
          .from('tools_hcah_records')
          .update(recordPayload)
          .eq('id', recordId)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
        finalRecordId = data.id;
      } else if (action === 'create') {
        const { data, error } = await supabaseServer
          .from('tools_hcah_records')
          .insert(recordPayload)
          .select()
          .single();
        if (error) return NextResponse.json({ error: 'Failed to create record' }, { status: 500 });
        finalRecordId = data.id;
      }

      if (finalRecordId) {
        await syncHealthcareRecordToDashboard(user.id, toolId, finalRecordId, showOnDashboardCalendar, {
          appointment_date: appointmentDate,
          care_facility: careFacility,
          provider_info: providerInfo,
          reason_for_visit: reasonForVisit,
        });
      }

      if (finalRecordId && documentFiles?.length) {
        let nextOrder = 0;
        const { data: existingDocs } = await supabaseServer
          .from('tools_hcah_documents')
          .select('display_order')
          .eq('record_id', finalRecordId)
          .order('display_order', { ascending: false })
          .limit(1);
        if (existingDocs?.[0]?.display_order != null) nextOrder = (existingDocs[0].display_order ?? 0) + 1;
        for (let i = 0; i < documentFiles.length; i++) {
          const file = documentFiles[i];
          if (file?.size > 0) {
            try {
              const up = await uploadFile(file, user.id, 'documents');
              if (up)
                await supabaseServer.from('tools_hcah_documents').insert({
                  record_id: finalRecordId,
                  file_url: up.url,
                  file_name: up.fileName,
                  file_size: up.fileSize,
                  file_type: up.fileType,
                  display_order: nextOrder + i,
                });
            } catch (err: unknown) {
              console.error('Document upload failed:', err);
              return NextResponse.json(
                { error: err instanceof Error ? err.message : 'Document upload failed' },
                { status: 500 }
              );
            }
          }
        }
      }
      return NextResponse.json({ success: true, recordId: finalRecordId });
    }

    if (resource === 'document' && action === 'delete') {
      const documentId = formData.get('documentId') as string;
      if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 });
      const { data: doc } = await supabaseServer
        .from('tools_hcah_documents')
        .select('record_id')
        .eq('id', documentId)
        .single();
      if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      const { data: rec } = await supabaseServer
        .from('tools_hcah_records')
        .select('id')
        .eq('id', doc.record_id)
        .eq('user_id', user.id)
        .single();
      if (!rec) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const { error } = await supabaseServer.from('tools_hcah_documents').delete().eq('id', documentId);
      if (error) return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid resource or action' }, { status: 400 });
  } catch (e) {
    console.error('POST healthcare-appts-history:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const toolId = searchParams.get('toolId');
  const resource = searchParams.get('resource');
  const id = searchParams.get('id');
  if (!toolId || !resource || !id)
    return NextResponse.json({ error: 'Missing toolId, resource, or id' }, { status: 400 });

  try {
    if (resource === 'header') {
      const { error } = await supabaseServer
        .from('tools_hcah_headers')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (error) return NextResponse.json({ error: 'Failed to delete header' }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    if (resource === 'record') {
      const { error } = await supabaseServer
        .from('tools_hcah_records')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    if (resource === 'document') {
      const { data: doc } = await supabaseServer.from('tools_hcah_documents').select('record_id').eq('id', id).single();
      if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      const { data: rec } = await supabaseServer
        .from('tools_hcah_records')
        .select('id')
        .eq('id', doc.record_id)
        .eq('user_id', user.id)
        .single();
      if (!rec) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const { error } = await supabaseServer.from('tools_hcah_documents').delete().eq('id', id);
      if (error) return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
  } catch (e) {
    console.error('DELETE healthcare-appts-history:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
