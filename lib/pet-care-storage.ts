import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';

export const PET_CARE_BUCKET = 'pet-care-schedule';

export type PetCareStore = 'pet' | 'document' | 'veterinary' | 'vaccination' | 'appointment';

export type PetCareAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

const STORE = {
  pet: {
    table: 'tools_pcs_pet_attachments',
    ownerColumn: 'pet_id',
    folder: 'pets',
  },
  document: {
    table: 'tools_pcs_document_attachments',
    ownerColumn: 'document_id',
    folder: 'documents',
  },
  veterinary: {
    table: 'tools_pcs_veterinary_attachments',
    ownerColumn: 'veterinary_id',
    folder: 'veterinary',
  },
  vaccination: {
    table: 'tools_pcs_vaccination_attachments',
    ownerColumn: 'vaccination_id',
    folder: 'vaccinations',
  },
  appointment: {
    table: 'tools_pcs_appointment_attachments',
    ownerColumn: 'appointment_id',
    folder: 'appointments',
  },
} as const;

export function storeConfig(store: PetCareStore) {
  return STORE[store];
}

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function extractPetCareStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${PET_CARE_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removePetCareStorageFiles(
  fileUrls: Array<string | null | undefined>,
  userId: string
): Promise<void> {
  const paths = [
    ...new Set(fileUrls.map(extractPetCareStoragePath).filter((path): path is string => Boolean(path))),
  ];
  if (paths.length === 0) return;
  await supabaseServer.storage.from(PET_CARE_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

function ownerIdFromRow(row: object, ownerColumn: string): string {
  const value = (row as Record<string, unknown>)[ownerColumn];
  return typeof value === 'string' ? value : String(value ?? '');
}

export function mapPetCareAttachment(row: {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
}): PetCareAttachment {
  return {
    id: row.id,
    name: row.file_name,
    size: row.file_size,
    type: row.file_type,
  };
}

async function attachmentsByOwnerIds(
  store: PetCareStore,
  ownerIds: string[],
  userId: string
): Promise<Record<string, PetCareAttachment[]>> {
  const map: Record<string, PetCareAttachment[]> = {};
  if (ownerIds.length === 0) return map;
  const { table, ownerColumn } = STORE[store];
  const { data, error } = await supabaseServer
    .from(table)
    .select(`id, ${ownerColumn}, file_name, file_size, file_type`)
    .eq('user_id', userId)
    .in(ownerColumn, ownerIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error(`Error fetching Pet Care ${store} attachments:`, error);
    return map;
  }

  (data || []).forEach((row) => {
    const ownerId = ownerIdFromRow(row, ownerColumn);
    if (!ownerId) return;
    if (!map[ownerId]) map[ownerId] = [];
    map[ownerId].push(mapPetCareAttachment(row));
  });
  return map;
}

export const attachmentsByPetIds = (ids: string[], userId: string) => attachmentsByOwnerIds('pet', ids, userId);
export const attachmentsByDocumentIds = (ids: string[], userId: string) => attachmentsByOwnerIds('document', ids, userId);
export const attachmentsByVeterinaryIds = (ids: string[], userId: string) => attachmentsByOwnerIds('veterinary', ids, userId);
export const attachmentsByVaccinationIds = (ids: string[], userId: string) => attachmentsByOwnerIds('vaccination', ids, userId);
export const attachmentsByAppointmentIds = (ids: string[], userId: string) =>
  attachmentsByOwnerIds('appointment', ids, userId);

export async function loadOwnedPet(petId: string, userId: string, toolId?: string | null) {
  let query = supabaseServer.from('tools_pcs_pets').select('id').eq('id', petId).eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

async function loadChildOfOwnedPet(
  table: string,
  childId: string,
  userId: string,
  toolId?: string | null
) {
  const { data: child, error } = await supabaseServer.from(table).select('id, pet_id').eq('id', childId).single();
  if (error || !child) return null;
  const pet = await loadOwnedPet(child.pet_id, userId, toolId);
  if (!pet) return null;
  return child;
}

export const loadOwnedDocument = (id: string, userId: string, toolId?: string | null) =>
  loadChildOfOwnedPet('tools_pcs_documents', id, userId, toolId);
export const loadOwnedVeterinary = (id: string, userId: string, toolId?: string | null) =>
  loadChildOfOwnedPet('tools_pcs_veterinary_records', id, userId, toolId);
export const loadOwnedVaccination = (id: string, userId: string, toolId?: string | null) =>
  loadChildOfOwnedPet('tools_pcs_vaccinations', id, userId, toolId);
export const loadOwnedAppointment = (id: string, userId: string, toolId?: string | null) =>
  loadChildOfOwnedPet('tools_pcs_appointments', id, userId, toolId);

export async function loadOwnedStoreRecord(
  store: PetCareStore,
  ownerId: string,
  userId: string,
  toolId?: string | null
) {
  if (store === 'pet') return loadOwnedPet(ownerId, userId, toolId);
  if (store === 'document') return loadOwnedDocument(ownerId, userId, toolId);
  if (store === 'veterinary') return loadOwnedVeterinary(ownerId, userId, toolId);
  if (store === 'vaccination') return loadOwnedVaccination(ownerId, userId, toolId);
  return loadOwnedAppointment(ownerId, userId, toolId);
}

async function deleteStoreFilesForOwners(store: PetCareStore, ownerIds: string[], userId: string) {
  if (ownerIds.length === 0) return;
  const { table, ownerColumn } = STORE[store];
  const { data, error } = await supabaseServer
    .from(table)
    .select('file_url')
    .eq('user_id', userId)
    .in(ownerColumn, ownerIds);
  if (error) {
    if (!isMissingRelationError(error)) console.error(`Error loading Pet Care ${store} files for delete:`, error);
    return;
  }
  await removePetCareStorageFiles((data || []).map((row) => row.file_url), userId);
}

export const deletePetFileRows = (ids: string[], userId: string) => deleteStoreFilesForOwners('pet', ids, userId);
export const deleteDocumentFileRows = (ids: string[], userId: string) =>
  deleteStoreFilesForOwners('document', ids, userId);
export const deleteVeterinaryFileRows = (ids: string[], userId: string) =>
  deleteStoreFilesForOwners('veterinary', ids, userId);
export const deleteVaccinationFileRows = (ids: string[], userId: string) =>
  deleteStoreFilesForOwners('vaccination', ids, userId);
export const deleteAppointmentFileRows = (ids: string[], userId: string) =>
  deleteStoreFilesForOwners('appointment', ids, userId);

export async function deleteAllPetStorageFiles(petId: string, userId: string): Promise<void> {
  const urls: Array<string | null> = [];

  const { data: petFiles, error: petError } = await supabaseServer
    .from('tools_pcs_pet_attachments')
    .select('file_url')
    .eq('pet_id', petId)
    .eq('user_id', userId);
  if (petError) {
    if (!isMissingRelationError(petError)) console.error('Error loading Pet Care pet files for delete:', petError);
  } else {
    urls.push(...(petFiles || []).map((row) => row.file_url));
  }

  const childLoads = await Promise.all([
    supabaseServer.from('tools_pcs_documents').select('id, file_url').eq('pet_id', petId),
    supabaseServer.from('tools_pcs_veterinary_records').select('id').eq('pet_id', petId),
    supabaseServer.from('tools_pcs_vaccinations').select('id').eq('pet_id', petId),
    supabaseServer.from('tools_pcs_appointments').select('id').eq('pet_id', petId),
  ]);

  const documents = childLoads[0].data || [];
  urls.push(...documents.map((row) => row.file_url));
  const documentIds = documents.map((row) => row.id);
  const veterinaryIds = (childLoads[1].data || []).map((row) => row.id);
  const vaccinationIds = (childLoads[2].data || []).map((row) => row.id);
  const appointmentIds = (childLoads[3].data || []).map((row) => row.id);

  const fileLoads = await Promise.all([
    documentIds.length
      ? supabaseServer.from('tools_pcs_document_attachments').select('file_url').eq('user_id', userId).in('document_id', documentIds)
      : Promise.resolve({ data: [] as Array<{ file_url: string }>, error: null }),
    veterinaryIds.length
      ? supabaseServer
          .from('tools_pcs_veterinary_attachments')
          .select('file_url')
          .eq('user_id', userId)
          .in('veterinary_id', veterinaryIds)
      : Promise.resolve({ data: [] as Array<{ file_url: string }>, error: null }),
    vaccinationIds.length
      ? supabaseServer
          .from('tools_pcs_vaccination_attachments')
          .select('file_url')
          .eq('user_id', userId)
          .in('vaccination_id', vaccinationIds)
      : Promise.resolve({ data: [] as Array<{ file_url: string }>, error: null }),
    appointmentIds.length
      ? supabaseServer
          .from('tools_pcs_appointment_attachments')
          .select('file_url')
          .eq('user_id', userId)
          .in('appointment_id', appointmentIds)
      : Promise.resolve({ data: [] as Array<{ file_url: string }>, error: null }),
  ]);

  for (const result of fileLoads) {
    if (result.error && !isMissingRelationError(result.error)) {
      console.error('Error loading Pet Care child files for delete:', result.error);
    }
    urls.push(...(result.data || []).map((row) => row.file_url));
  }

  await removePetCareStorageFiles(urls, userId);
}

export async function lookupAttachmentById(attachmentId: string, userId: string) {
  const stores: PetCareStore[] = ['pet', 'document', 'veterinary', 'vaccination', 'appointment'];
  let missingCount = 0;

  for (const store of stores) {
    const { table, ownerColumn } = STORE[store];
    const { data, error } = await supabaseServer
      .from(table)
      .select(`id, ${ownerColumn}, file_url, file_name, file_type`)
      .eq('id', attachmentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        missingCount += 1;
        continue;
      }
      return { error: 'lookup' as const };
    }
    if (data) {
      return {
        store,
        ownerId: ownerIdFromRow(data, ownerColumn),
        attachment: data as { id: string; file_url: string; file_name: string; file_type: string },
      };
    }
  }

  if (missingCount === stores.length) return { error: 'missing-table' as const };
  return { error: 'not-found' as const };
}
