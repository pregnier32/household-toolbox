import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { ATTACHMENT_MAX_FILE_BYTES, isAllowedAttachmentType } from '@/lib/attachments';
import { assertCanStoreBytes, isStorageLimitError, refreshUserStorageUsage } from '@/lib/user-storage';
import {
  isMissingRelationError,
  loadOwnedMeal,
  mapMealPlannerAttachment,
  MEAL_PLANNER_BUCKET,
  removeMealPlannerStorageFiles,
} from '@/lib/meal-planner-storage';

function missingTableMessage() {
  return 'Meal Planner attachments table is missing. Run supabase/ADD_meal_planner_attachments.sql.';
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const toolId = (formData.get('toolId') as string | null)?.trim() || '';
    const mealId = (formData.get('mealId') as string | null)?.trim() || '';
    const file = formData.get('file') as File | null;

    if (!toolId || !mealId) {
      return NextResponse.json({ error: 'Tool ID and Meal ID are required' }, { status: 400 });
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

    const meal = await loadOwnedMeal(mealId, user.id, toolId);
    if (!meal) return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
    await assertCanStoreBytes(user.id, file.size);

    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${user.id}/${mealId}/${Date.now()}-${sanitized}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseServer.storage.from(MEAL_PLANNER_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabaseServer.storage.from(MEAL_PLANNER_BUCKET).getPublicUrl(storagePath);
    const { data: attachment, error: insertError } = await supabaseServer
      .from('tools_mp_meal_attachments')
      .insert({
        meal_id: mealId,
        user_id: user.id,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      })
      .select('id, file_name, file_size, file_type')
      .single();

    if (insertError || !attachment) {
      await supabaseServer.storage.from(MEAL_PLANNER_BUCKET).remove([storagePath]);
      if (isMissingRelationError(insertError)) {
        return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to save attachment' }, { status: 500 });
    }

    await refreshUserStorageUsage(user.id);
    return NextResponse.json({ attachment: mapMealPlannerAttachment(attachment) });
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
      .from('tools_mp_meal_attachments')
      .select('id, meal_id, file_url')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .single();

    if (attachmentError || !attachment) {
      if (isMissingRelationError(attachmentError)) {
        return NextResponse.json({ error: missingTableMessage() }, { status: 500 });
      }
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const meal = await loadOwnedMeal(attachment.meal_id, user.id, toolId);
    if (!meal) return NextResponse.json({ error: 'Meal not found' }, { status: 404 });

    const { error: deleteError } = await supabaseServer
      .from('tools_mp_meal_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to remove attachment' }, { status: 500 });
    }

    await removeMealPlannerStorageFiles([attachment.file_url], user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
