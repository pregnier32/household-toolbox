import { supabaseServer } from '@/lib/supabaseServer';
import { CALENDAR_PIN_KIND_DEFAULT } from '@/lib/calendarPins';

function isMissingRelationError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.message?.includes('does not exist') === true ||
    error.message?.includes('schema cache') === true
  );
}

export async function syncCalendarPin({
  userId,
  toolId,
  sourceType,
  sourceId,
  pinKind = CALENDAR_PIN_KIND_DEFAULT,
  pinned,
}: {
  userId: string;
  toolId: string;
  sourceType: string;
  sourceId: string;
  pinKind?: string;
  pinned: boolean;
}): Promise<{ error: string | null }> {
  if (pinned) {
    const { error } = await supabaseServer.from('calendar_pins').upsert(
      {
        user_id: userId,
        tool_id: toolId,
        source_type: sourceType,
        source_id: sourceId,
        pin_kind: pinKind,
      },
      { onConflict: 'user_id,source_type,source_id,pin_kind' }
    );

    if (error) {
      if (isMissingRelationError(error)) return { error: null };
      console.error('Error upserting calendar pin:', error);
      return { error: error.message };
    }

    return { error: null };
  }

  const { error } = await supabaseServer
    .from('calendar_pins')
    .delete()
    .eq('user_id', userId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .eq('pin_kind', pinKind);

  if (error) {
    if (isMissingRelationError(error)) return { error: null };
    console.error('Error deleting calendar pin:', error);
    return { error: error.message };
  }

  return { error: null };
}

export async function deleteCalendarPinsForSources({
  userId,
  sourceType,
  sourceIds,
}: {
  userId: string;
  sourceType: string;
  sourceIds: string[];
}): Promise<{ error: string | null }> {
  if (sourceIds.length === 0) return { error: null };

  const { error } = await supabaseServer
    .from('calendar_pins')
    .delete()
    .eq('user_id', userId)
    .eq('source_type', sourceType)
    .in('source_id', sourceIds);

  if (error) {
    if (isMissingRelationError(error)) return { error: null };
    console.error('Error deleting calendar pins:', error);
    return { error: error.message };
  }

  return { error: null };
}

export async function getPinnedSourceIds({
  userId,
  sourceType,
  sourceIds,
  toolId,
}: {
  userId: string;
  sourceType: string;
  sourceIds?: string[];
  toolId?: string;
}): Promise<{ ids: Set<string>; error: string | null }> {
  if (sourceIds && sourceIds.length === 0) {
    return { ids: new Set(), error: null };
  }

  let query = supabaseServer
    .from('calendar_pins')
    .select('source_id')
    .eq('user_id', userId)
    .eq('source_type', sourceType);

  if (toolId) {
    query = query.eq('tool_id', toolId);
  }
  if (sourceIds && sourceIds.length > 0) {
    query = query.in('source_id', sourceIds);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return { ids: new Set(), error: null };
    console.error('Error fetching calendar pins:', error);
    return { ids: new Set(), error: error.message };
  }

  return { ids: new Set((data || []).map((row) => row.source_id)), error: null };
}
