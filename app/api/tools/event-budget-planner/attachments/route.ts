import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { ATTACHMENT_MAX_FILE_BYTES, isAllowedAttachmentType } from '@/lib/attachments';
import { assertCanStoreBytes, isStorageLimitError, refreshUserStorageUsage } from '@/lib/user-storage';
import {
  EBP_BUCKET,
  isMissingRelationError,
  loadOwnedEvent,
  loadOwnedExpense,
  mapEbpAttachment,
  removeEbpStorageFiles,
} from '@/lib/ebp-storage';

function missingTableMessage() {
  return 'Event Budget Planner attachments table is missing. Run supabase/ADD_event_budget_planner_attachments.sql.';
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const toolId = (formData.get('toolId') as string | null)?.trim() || '';
    const eventId = (formData.get('eventId') as string | null)?.trim() || '';
    const expenseId = (formData.get('expenseId') as string | null)?.trim() || '';
    const file = formData.get('file') as File | null;

    if (!toolId || (!eventId && !expenseId) || (eventId && expenseId)) {
      return NextResponse.json({ error: 'Tool ID and either Event ID or Expense ID are required' }, { status: 400 });
    }
    if (!file || file.size <= 0) {
      return NextResponse.json({ error: 'A file is required' }, { status: 400 });
    }
    if (file.size > ATTACHMENT_MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File size cannot exceed 10MB' }, { status: 400 });
    }
    if (!isAllowedAttachmentType(file.type, file.name)) {
      return NextResponse.json({ error: 'That file type is not allowed' }, { status: 400 });
    }

    const ownerKind = eventId ? 'event' : 'expense';
    const ownerId = eventId || expenseId;
    if (ownerKind === 'event') {
      const event = await loadOwnedEvent(ownerId, user.id, toolId);
      if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      if (!event.is_active) {
        return NextResponse.json({ error: 'History events are view-only. Reactivate to add files.' }, { status: 403 });
      }
    } else {
      const expense = await loadOwnedExpense(ownerId, user.id, toolId);
      if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
      if (!expense.is_active) {
        return NextResponse.json({ error: 'History events are view-only. Reactivate to add files.' }, { status: 403 });
      }
    }

    await assertCanStoreBytes(user.id, file.size);

    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folder = ownerKind === 'event' ? 'events' : 'expenses';
    const storagePath = `${user.id}/${folder}/${ownerId}/${Date.now()}-${sanitized}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseServer.storage.from(EBP_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabaseServer.storage.from(EBP_BUCKET).getPublicUrl(storagePath);
    const table = ownerKind === 'event' ? 'tools_ebp_event_attachments' : 'tools_ebp_expense_attachments';
    const ownerColumn = ownerKind === 'event' ? 'event_id' : 'expense_id';
    const { data: attachment, error: insertError } = await supabaseServer
      .from(table)
      .insert({
        [ownerColumn]: ownerId,
        user_id: user.id,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      })
      .select('id, file_name, file_size, file_type')
      .single();

    if (insertError || !attachment) {
      await supabaseServer.storage.from(EBP_BUCKET).remove([storagePath]);
      if (isMissingRelationError(insertError)) {
        return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to save attachment' }, { status: 500 });
    }

    await refreshUserStorageUsage(user.id);
    return NextResponse.json({ attachment: mapEbpAttachment(attachment) });
  } catch (error) {
    if (isStorageLimitError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 413 });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const toolId = typeof body.toolId === 'string' ? body.toolId : '';
    const attachmentId = typeof body.attachmentId === 'string' ? body.attachmentId : '';

    if (!toolId || !attachmentId) {
      return NextResponse.json({ error: 'Tool ID and attachment ID are required' }, { status: 400 });
    }

    const { data: eventAttachment, error: eventError } = await supabaseServer
      .from('tools_ebp_event_attachments')
      .select('id, event_id, file_url')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (eventError && !isMissingRelationError(eventError)) {
      return NextResponse.json({ error: 'Failed to look up attachment' }, { status: 500 });
    }

    if (eventAttachment) {
      const event = await loadOwnedEvent(eventAttachment.event_id, user.id, toolId);
      if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      if (!event.is_active) {
        return NextResponse.json({ error: 'History events are view-only. Reactivate to remove files.' }, { status: 403 });
      }
      const { error: deleteError } = await supabaseServer
        .from('tools_ebp_event_attachments')
        .delete()
        .eq('id', attachmentId)
        .eq('user_id', user.id);
      if (deleteError) return NextResponse.json({ error: 'Failed to remove attachment' }, { status: 500 });
      await removeEbpStorageFiles([eventAttachment.file_url], user.id);
      return NextResponse.json({ success: true });
    }

    const { data: expenseAttachment, error: expenseError } = await supabaseServer
      .from('tools_ebp_expense_attachments')
      .select('id, expense_id, file_url')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (expenseError) {
      if (isMissingRelationError(eventError) && isMissingRelationError(expenseError)) {
        return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to look up attachment' }, { status: 500 });
    }
    if (!expenseAttachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });

    const expense = await loadOwnedExpense(expenseAttachment.expense_id, user.id, toolId);
    if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    if (!expense.is_active) {
      return NextResponse.json({ error: 'History events are view-only. Reactivate to remove files.' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseServer
      .from('tools_ebp_expense_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('user_id', user.id);
    if (deleteError) return NextResponse.json({ error: 'Failed to remove attachment' }, { status: 500 });
    await removeEbpStorageFiles([expenseAttachment.file_url], user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
