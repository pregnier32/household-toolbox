import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { ATTACHMENT_MAX_FILE_BYTES, isAllowedAttachmentType } from '@/lib/attachments';
import { assertCanStoreBytes, isStorageLimitError, refreshUserStorageUsage } from '@/lib/user-storage';
import {
  HEALTHCARE_BUCKET,
  isMissingColumnError,
  isMissingRelationError,
  loadOwnedRecord,
  mapHealthcareAttachment,
  removeHealthcareStorageFiles,
} from '@/lib/healthcare-storage';

function missingTableMessage() {
  return 'Healthcare documents table is missing.';
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const toolId = (formData.get('toolId') as string | null)?.trim() || '';
    const recordId = (formData.get('recordId') as string | null)?.trim() || '';
    const file = formData.get('file') as File | null;

    if (!toolId || !recordId) {
      return NextResponse.json({ error: 'Tool ID and Record ID are required' }, { status: 400 });
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

    const record = await loadOwnedRecord(recordId, user.id, toolId);
    if (!record) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    await assertCanStoreBytes(user.id, file.size);

    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${user.id}/${recordId}/${Date.now()}-${sanitized}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseServer.storage.from(HEALTHCARE_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabaseServer.storage.from(HEALTHCARE_BUCKET).getPublicUrl(storagePath);
    const { data: existingDocs } = await supabaseServer
      .from('tools_hcah_documents')
      .select('display_order')
      .eq('record_id', recordId)
      .order('display_order', { ascending: false })
      .limit(1);
    const displayOrder = (existingDocs?.[0]?.display_order ?? -1) + 1;

    const withUser = {
      record_id: recordId,
      user_id: user.id,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      display_order: displayOrder,
    };
    const withoutUser = {
      record_id: recordId,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      display_order: displayOrder,
    };

    let attachment: { id: string; file_name: string | null; file_size: number | null; file_type: string | null } | null = null;
    let insertError: { code?: string; message?: string } | null = null;
    const first = await supabaseServer
      .from('tools_hcah_documents')
      .insert(withUser)
      .select('id, file_name, file_size, file_type')
      .single();
    if (!first.error && first.data) {
      attachment = first.data;
    } else if (first.error && isMissingColumnError(first.error)) {
      const retry = await supabaseServer
        .from('tools_hcah_documents')
        .insert(withoutUser)
        .select('id, file_name, file_size, file_type')
        .single();
      attachment = retry.data;
      insertError = retry.error;
    } else {
      insertError = first.error;
    }

    if (insertError || !attachment) {
      await supabaseServer.storage.from(HEALTHCARE_BUCKET).remove([storagePath]);
      if (isMissingRelationError(insertError)) {
        return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to save attachment' }, { status: 500 });
    }

    await refreshUserStorageUsage(user.id);
    return NextResponse.json({ attachment: mapHealthcareAttachment(attachment) });
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

    const { data: attachment, error: attachmentError } = await supabaseServer
      .from('tools_hcah_documents')
      .select('id, record_id, file_url')
      .eq('id', attachmentId)
      .single();

    if (attachmentError || !attachment) {
      if (isMissingRelationError(attachmentError)) {
        return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
      }
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const record = await loadOwnedRecord(attachment.record_id, user.id, toolId);
    if (!record) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

    const { error: deleteError } = await supabaseServer
      .from('tools_hcah_documents')
      .delete()
      .eq('id', attachmentId);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to remove attachment' }, { status: 500 });
    }

    await removeHealthcareStorageFiles([attachment.file_url], user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
