import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { attachmentsByRecordIds, deleteHeaderRecordStorageFiles, deleteRecordStorageFiles, removeHealthcareStorageFiles } from '@/lib/healthcare-storage';
import { CALENDAR_SOURCE_HEALTHCARE_APPOINTMENT } from '@/lib/calendarPins';
import {
  deleteCalendarPinsForSources,
  getPinnedSourceIds,
  syncCalendarPin,
} from '@/lib/calendarPinsServer';

async function attachDashboardFlags<T extends { id: string }>(
  records: T[],
  userId: string,
  toolId?: string
): Promise<(T & { addToDashboard: boolean })[]> {
  const { ids } = await getPinnedSourceIds({
    userId,
    sourceType: CALENDAR_SOURCE_HEALTHCARE_APPOINTMENT,
    sourceIds: records.map((record) => record.id),
    toolId,
  });
  return records.map((record) => ({ ...record, addToDashboard: ids.has(record.id) }));
}

async function deletePinsForHeader(userId: string, headerId: string) {
  const { data } = await supabaseServer
    .from('tools_hcah_records')
    .select('id')
    .eq('header_id', headerId)
    .eq('user_id', userId);
  await deleteCalendarPinsForSources({
    userId,
    sourceType: CALENDAR_SOURCE_HEALTHCARE_APPOINTMENT,
    sourceIds: (data || []).map((row) => row.id),
  });
}

const STOCK_MEMBER_NAMES = ['Family1', 'Family2'];

async function removeEmptyStockHeaders(userId: string, toolId: string): Promise<void> {
  const { data: stockHeaders } = await supabaseServer
    .from('tools_hcah_headers')
    .select('id, name')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .in('name', STOCK_MEMBER_NAMES);
  if (!stockHeaders?.length) return;

  for (const header of stockHeaders) {
    const { count } = await supabaseServer
      .from('tools_hcah_records')
      .select('id', { count: 'exact', head: true })
      .eq('header_id', header.id)
      .eq('user_id', userId);
    if ((count ?? 0) > 0) continue;
    await supabaseServer
      .from('tools_hcah_headers')
      .delete()
      .eq('id', header.id)
      .eq('user_id', userId)
      .eq('tool_id', toolId);
  }
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
      if (headers.some((h) => STOCK_MEMBER_NAMES.includes(h.name))) {
        await removeEmptyStockHeaders(user.id, toolId);
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
        const attachmentMap = await attachmentsByRecordIds([recordId]);
        const [withPin] = await attachDashboardFlags(
          [{ ...record, documents: attachmentMap[recordId] || [] }],
          user.id,
          toolId
        );
        return NextResponse.json({ record: withPin });
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
      const attachmentMap = await attachmentsByRecordIds(list.map((r) => r.id));
      const recordsWithDocs = await attachDashboardFlags(
        list.map((r) => ({
          ...r,
          documents: attachmentMap[r.id] || [],
        })),
        user.id,
        toolId
      );
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
        await deletePinsForHeader(user.id, headerId);
        await deleteHeaderRecordStorageFiles(headerId, user.id);
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
      const totalBilled = (formData.get('totalBilled') as string)?.trim() || null;
      const insurancePaid = (formData.get('insurancePaid') as string)?.trim() || null;
      const currentAmountDue = (formData.get('currentAmountDue') as string)?.trim() || null;
      const addToDashboardRaw = formData.get('addToDashboard');
      const hasPinFlag = addToDashboardRaw !== null;
      const addToDashboard = addToDashboardRaw === 'true';

      if (action === 'delete' && recordId) {
        await deleteCalendarPinsForSources({
          userId: user.id,
          sourceType: CALENDAR_SOURCE_HEALTHCARE_APPOINTMENT,
          sourceIds: [recordId],
        });
        await deleteRecordStorageFiles(recordId, user.id);
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

      if (finalRecordId && (action === 'create' || (action === 'update' && hasPinFlag))) {
        const pinResult = await syncCalendarPin({
          userId: user.id,
          toolId,
          sourceType: CALENDAR_SOURCE_HEALTHCARE_APPOINTMENT,
          sourceId: finalRecordId,
          pinned: action === 'create' ? addToDashboard === true : addToDashboard,
        });
        if (pinResult.error) {
          return NextResponse.json(
            {
              error:
                action === 'create'
                  ? 'Appointment saved, but failed to add it to the dashboard calendar'
                  : 'Appointment saved, but failed to update the dashboard calendar',
            },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({ success: true, recordId: finalRecordId });
    }

    if (resource === 'document' && action === 'delete') {
      const documentId = formData.get('documentId') as string;
      if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 });
      const { data: doc } = await supabaseServer
        .from('tools_hcah_documents')
        .select('record_id, file_url')
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
      await removeHealthcareStorageFiles([doc.file_url], user.id);
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
      await deletePinsForHeader(user.id, id);
      await deleteHeaderRecordStorageFiles(id, user.id);
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
      await deleteCalendarPinsForSources({
        userId: user.id,
        sourceType: CALENDAR_SOURCE_HEALTHCARE_APPOINTMENT,
        sourceIds: [id],
      });
      await deleteRecordStorageFiles(id, user.id);
      const { error } = await supabaseServer
        .from('tools_hcah_records')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    if (resource === 'document') {
      const { data: doc } = await supabaseServer.from('tools_hcah_documents').select('record_id, file_url').eq('id', id).single();
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
      await removeHealthcareStorageFiles([doc.file_url], user.id);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
  } catch (e) {
    console.error('DELETE healthcare-appts-history:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
