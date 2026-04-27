import { supabaseServer } from '@/lib/supabaseServer';

type SupabaseLikeError = { message?: string; code?: string } | null;

function isMissingRelationError(error: SupabaseLikeError): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

function extractStoragePath(fileUrl: string, bucket: string): string | null {
  if (!fileUrl) return null;

  // Already a relative storage path (e.g. userId/file.ext)
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
    return fileUrl;
  }

  try {
    const url = new URL(fileUrl);
    const marker = `${bucket}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return url.pathname.slice(markerIndex + marker.length);
  } catch {
    return null;
  }
}

async function removeStoragePaths(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  const chunkSize = 100;

  for (let i = 0; i < uniquePaths.length; i += chunkSize) {
    const chunk = uniquePaths.slice(i, i + chunkSize);
    const { error } = await supabaseServer.storage.from(bucket).remove(chunk);
    if (error && !isMissingRelationError(error)) {
      // Keep deleting user data even if storage cleanup partially fails.
      console.error(`Storage cleanup warning for bucket ${bucket}:`, error);
    }
  }
}

export async function deleteUserAndAssociatedData(userId: string): Promise<void> {
  const storageDeletes: Array<{ bucket: string; path: string }> = [];

  // Important Documents files
  const { data: idDocs, error: idDocsError } = await supabaseServer
    .from('tools_id_documents')
    .select('file_url')
    .eq('user_id', userId);

  if (idDocsError && !isMissingRelationError(idDocsError)) throw idDocsError;
  (idDocs || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'important-documents') : null;
    if (path) storageDeletes.push({ bucket: 'important-documents', path });
  });

  // Repair History files
  const { data: rhRecords, error: rhError } = await supabaseServer
    .from('tools_rh_records')
    .select('id, receipt_file_url, warranty_file_url')
    .eq('user_id', userId);
  if (rhError && !isMissingRelationError(rhError)) throw rhError;

  const rhRecordIds = (rhRecords || []).map((r: { id: string }) => r.id);
  (rhRecords || []).forEach((row: { receipt_file_url: string | null; warranty_file_url: string | null }) => {
    const receiptPath = row.receipt_file_url ? extractStoragePath(row.receipt_file_url, 'repair-history') : null;
    const warrantyPath = row.warranty_file_url ? extractStoragePath(row.warranty_file_url, 'repair-history') : null;
    if (receiptPath) storageDeletes.push({ bucket: 'repair-history', path: receiptPath });
    if (warrantyPath) storageDeletes.push({ bucket: 'repair-history', path: warrantyPath });
  });

  if (rhRecordIds.length > 0) {
    const { data: rhPictures, error: rhPicturesError } = await supabaseServer
      .from('tools_rh_record_pictures')
      .select('file_url')
      .in('record_id', rhRecordIds);
    if (rhPicturesError && !isMissingRelationError(rhPicturesError)) throw rhPicturesError;
    (rhPictures || []).forEach((row: { file_url: string | null }) => {
      const path = row.file_url ? extractStoragePath(row.file_url, 'repair-history') : null;
      if (path) storageDeletes.push({ bucket: 'repair-history', path });
    });
  }

  // Healthcare Appts & History files
  const { data: hcahHeaders, error: hcahHeadersError } = await supabaseServer
    .from('tools_hcah_headers')
    .select('id')
    .eq('user_id', userId);
  if (hcahHeadersError && !isMissingRelationError(hcahHeadersError)) throw hcahHeadersError;

  const hcahHeaderIds = (hcahHeaders || []).map((h: { id: string }) => h.id);
  if (hcahHeaderIds.length > 0) {
    const { data: hcahRecords, error: hcahRecordsError } = await supabaseServer
      .from('tools_hcah_records')
      .select('id')
      .in('header_id', hcahHeaderIds);
    if (hcahRecordsError && !isMissingRelationError(hcahRecordsError)) throw hcahRecordsError;

    const hcahRecordIds = (hcahRecords || []).map((r: { id: string }) => r.id);
    if (hcahRecordIds.length > 0) {
      const { data: hcahDocs, error: hcahDocsError } = await supabaseServer
        .from('tools_hcah_documents')
        .select('file_url')
        .in('record_id', hcahRecordIds);
      if (hcahDocsError && !isMissingRelationError(hcahDocsError)) throw hcahDocsError;
      (hcahDocs || []).forEach((row: { file_url: string | null }) => {
        const path = row.file_url ? extractStoragePath(row.file_url, 'heathcare-appt-history') : null;
        if (path) storageDeletes.push({ bucket: 'heathcare-appt-history', path });
      });
    }
  }

  // Pet Care Schedule document files (if stored in bucket and URL is bucket-backed)
  const { data: pets, error: petsError } = await supabaseServer
    .from('tools_pcs_pets')
    .select('id')
    .eq('user_id', userId);
  if (petsError && !isMissingRelationError(petsError)) throw petsError;
  const petIds = (pets || []).map((p: { id: string }) => p.id);

  if (petIds.length > 0) {
    const { data: petDocs, error: petDocsError } = await supabaseServer
      .from('tools_pcs_documents')
      .select('file_url')
      .in('pet_id', petIds);
    if (petDocsError && !isMissingRelationError(petDocsError)) throw petDocsError;
    (petDocs || []).forEach((row: { file_url: string | null }) => {
      const path = row.file_url ? extractStoragePath(row.file_url, 'pet-care-schedule') : null;
      if (path) storageDeletes.push({ bucket: 'pet-care-schedule', path });
    });
  }

  // Remove files first, then database row (which cascades to user-linked records)
  const grouped = storageDeletes.reduce<Record<string, string[]>>((acc, item) => {
    if (!acc[item.bucket]) acc[item.bucket] = [];
    acc[item.bucket].push(item.path);
    return acc;
  }, {});

  for (const [bucket, paths] of Object.entries(grouped)) {
    await removeStoragePaths(bucket, paths);
  }

  const { error: deleteUserError } = await supabaseServer
    .from('users')
    .delete()
    .eq('id', userId);

  if (deleteUserError) throw deleteUserError;
}
