import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { ATTACHMENT_MAX_FILE_BYTES, isAllowedAttachmentType } from '@/lib/attachments';
import { assertCanStoreBytes, isStorageLimitError, refreshUserStorageUsage } from '@/lib/user-storage';
import {
  PET_CARE_BUCKET,
  isMissingRelationError,
  loadOwnedStoreRecord,
  lookupAttachmentById,
  mapPetCareAttachment,
  removePetCareStorageFiles,
  storeConfig,
  type PetCareStore,
} from '@/lib/pet-care-storage';

function missingTableMessage() {
  return 'Pet Care attachments table is missing. Run supabase/ADD_pet_care_attachments.sql.';
}

function ownerFromForm(formData: FormData): { store: PetCareStore; ownerId: string } | null {
  const pairs: Array<[PetCareStore, string]> = [
    ['pet', (formData.get('petId') as string | null)?.trim() || ''],
    ['document', (formData.get('documentId') as string | null)?.trim() || ''],
    ['veterinary', (formData.get('veterinaryId') as string | null)?.trim() || ''],
    ['vaccination', (formData.get('vaccinationId') as string | null)?.trim() || ''],
    ['appointment', (formData.get('appointmentId') as string | null)?.trim() || ''],
  ];
  const present = pairs.filter(([, id]) => id);
  if (present.length !== 1) return null;
  return { store: present[0][0], ownerId: present[0][1] };
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const toolId = (formData.get('toolId') as string | null)?.trim() || '';
    const owner = ownerFromForm(formData);
    const file = formData.get('file') as File | null;

    if (!toolId || !owner) {
      return NextResponse.json(
        { error: 'Tool ID and exactly one of Pet, Document, Veterinary, Vaccination, or Appointment ID are required' },
        { status: 400 }
      );
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

    const record = await loadOwnedStoreRecord(owner.store, owner.ownerId, user.id, toolId);
    if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

    await assertCanStoreBytes(user.id, file.size);

    const { table, ownerColumn, folder } = storeConfig(owner.store);
    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${user.id}/${folder}/${owner.ownerId}/${Date.now()}-${sanitized}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseServer.storage.from(PET_CARE_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabaseServer.storage.from(PET_CARE_BUCKET).getPublicUrl(storagePath);
    const { data: attachment, error: insertError } = await supabaseServer
      .from(table)
      .insert({
        [ownerColumn]: owner.ownerId,
        user_id: user.id,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      })
      .select('id, file_name, file_size, file_type')
      .single();

    if (insertError || !attachment) {
      await supabaseServer.storage.from(PET_CARE_BUCKET).remove([storagePath]);
      if (isMissingRelationError(insertError)) {
        return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to save attachment' }, { status: 500 });
    }

    await refreshUserStorageUsage(user.id);
    return NextResponse.json({ attachment: mapPetCareAttachment(attachment) });
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

    const found = await lookupAttachmentById(attachmentId, user.id);
    if ('error' in found && found.error === 'missing-table') {
      return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
    }
    if ('error' in found && found.error === 'lookup') {
      return NextResponse.json({ error: 'Failed to look up attachment' }, { status: 500 });
    }
    if ('error' in found) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const record = await loadOwnedStoreRecord(found.store, found.ownerId, user.id, toolId);
    if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

    const { error: deleteError } = await supabaseServer
      .from(storeConfig(found.store).table)
      .delete()
      .eq('id', attachmentId)
      .eq('user_id', user.id);
    if (deleteError) return NextResponse.json({ error: 'Failed to remove attachment' }, { status: 500 });

    await removePetCareStorageFiles([found.attachment.file_url], user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
