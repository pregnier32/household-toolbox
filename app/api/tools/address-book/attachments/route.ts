import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { ATTACHMENT_MAX_FILE_BYTES, isAllowedAttachmentType } from '@/lib/attachments';
import { assertCanStoreBytes, isStorageLimitError, refreshUserStorageUsage } from '@/lib/user-storage';
import {
  ADDRESS_BOOK_BUCKET,
  isMissingRelationError,
  loadOwnedAddress,
  mapAddressBookAttachment,
  removeAddressBookStorageFiles,
} from '@/lib/address-book-storage';

function missingTableMessage() {
  return 'Address Book attachments table is missing. Run supabase/ADD_address_book_attachments.sql.';
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const toolId = (formData.get('toolId') as string | null)?.trim() || '';
    const addressId = (formData.get('addressId') as string | null)?.trim() || '';
    const file = formData.get('file') as File | null;

    if (!toolId || !addressId) {
      return NextResponse.json({ error: 'Tool ID and Address ID are required' }, { status: 400 });
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

    const address = await loadOwnedAddress(addressId, user.id, toolId);
    if (!address) return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    if (address.is_active === false) {
      return NextResponse.json({ error: 'History addresses are view-only. Restore to add files.' }, { status: 403 });
    }

    await assertCanStoreBytes(user.id, file.size);

    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${user.id}/${addressId}/${Date.now()}-${sanitized}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseServer.storage.from(ADDRESS_BOOK_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabaseServer.storage.from(ADDRESS_BOOK_BUCKET).getPublicUrl(storagePath);
    const { data: attachment, error: insertError } = await supabaseServer
      .from('tools_ab_address_attachments')
      .insert({
        address_id: addressId,
        user_id: user.id,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      })
      .select('id, file_name, file_size, file_type')
      .single();

    if (insertError || !attachment) {
      await supabaseServer.storage.from(ADDRESS_BOOK_BUCKET).remove([storagePath]);
      if (isMissingRelationError(insertError)) {
        return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to save attachment' }, { status: 500 });
    }

    await refreshUserStorageUsage(user.id);
    return NextResponse.json({ attachment: mapAddressBookAttachment(attachment) });
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
      .from('tools_ab_address_attachments')
      .select('id, address_id, file_url')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .single();

    if (attachmentError || !attachment) {
      if (isMissingRelationError(attachmentError)) {
        return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
      }
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const address = await loadOwnedAddress(attachment.address_id, user.id, toolId);
    if (!address) return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    if (address.is_active === false) {
      return NextResponse.json({ error: 'History addresses are view-only. Restore to remove files.' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseServer
      .from('tools_ab_address_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to remove attachment' }, { status: 500 });
    }

    await removeAddressBookStorageFiles([attachment.file_url], user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
