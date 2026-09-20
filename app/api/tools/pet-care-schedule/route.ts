import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  attachmentsByAppointmentIds,
  attachmentsByDocumentIds,
  attachmentsByPetIds,
  attachmentsByVaccinationIds,
  attachmentsByVeterinaryIds,
  deleteAllPetStorageFiles,
  deleteAppointmentFileRows,
  deleteDocumentFileRows,
  deleteVaccinationFileRows,
  deleteVeterinaryFileRows,
} from '@/lib/pet-care-storage';
import { CALENDAR_SOURCE_PET_APPOINTMENT } from '@/lib/calendarPins';
import {
  deleteCalendarPinsForSources,
  getPinnedSourceIds,
  syncCalendarPin,
} from '@/lib/calendarPinsServer';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

async function upsertPetChildren(
  table: string,
  petId: string,
  rows: Array<{ id?: unknown; payload: Record<string, unknown> }>,
  onDeleteIds?: (ids: string[]) => Promise<void>
) {
  const { data: existing, error: existingError } = await supabaseServer.from(table).select('id').eq('pet_id', petId);
  if (existingError) throw existingError;
  const existingIds = new Set((existing || []).map((row) => row.id as string));
  const keepIds = new Set<string>();

  for (const row of rows) {
    const id = isUuid(row.id) ? row.id : null;
    if (id && existingIds.has(id)) {
      const { error } = await supabaseServer.from(table).update(row.payload).eq('id', id).eq('pet_id', petId);
      if (error) throw error;
      keepIds.add(id);
    } else {
      const insertRow = id ? { id, pet_id: petId, ...row.payload } : { pet_id: petId, ...row.payload };
      const { data, error } = await supabaseServer.from(table).insert(insertRow).select('id').single();
      if (error || !data) throw error || new Error(`Failed to insert ${table} row`);
      keepIds.add(data.id);
    }
  }

  const stale = [...existingIds].filter((id) => !keepIds.has(id));
  if (stale.length > 0) {
    if (onDeleteIds) await onDeleteIds(stale);
    const { error } = await supabaseServer.from(table).delete().eq('pet_id', petId).in('id', stale);
    if (error) throw error;
  }
}

// GET - Fetch all pets for the current user
export async function GET(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const petId = searchParams.get('petId');
    const toolId = searchParams.get('toolId'); // Get tool_id from query params

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    // If petId is provided, fetch that specific pet with all related data
    if (petId) {
      // Fetch pet
      const { data: pet, error: petError } = await supabaseServer
        .from('tools_pcs_pets')
        .select('*')
        .eq('id', petId)
        .eq('user_id', user.id)
        .single();

      if (petError) {
        console.error('Error fetching pet:', petError);
        // Check if it's a table doesn't exist error
        if (petError.message?.includes('does not exist') || 
            petError.message?.includes('schema cache') ||
            petError.code === '42P01' ||
            petError.code === 'PGRST116') {
          return NextResponse.json({ 
            error: 'Database tables not set up. Please run the migration SQL file (create-pet-care-schedule-tables.sql) in your Supabase SQL Editor to create the required tables.'
          }, { status: 500 });
        }
        return NextResponse.json({ error: petError.message || 'Failed to fetch pet' }, { status: 500 });
      }
      
      if (!pet) {
        return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
      }

      // Fetch all related data (handle errors gracefully)
      const [foodsResult, vetRecordsResult, careItemsResult, vaccinationsResult, appointmentsResult, documentsResult, notesResult] = await Promise.all([
        supabaseServer.from('tools_pcs_food_entries').select('*').eq('pet_id', petId).order('start_date', { ascending: false }),
        supabaseServer.from('tools_pcs_veterinary_records').select('*').eq('pet_id', petId).order('date_added', { ascending: false }),
        supabaseServer.from('tools_pcs_care_plan_items').select('*').eq('pet_id', petId).order('start_date', { ascending: false }),
        supabaseServer.from('tools_pcs_vaccinations').select('*').eq('pet_id', petId).order('date', { ascending: false }),
        supabaseServer.from('tools_pcs_appointments').select('*').eq('pet_id', petId).order('date', { ascending: false }),
        supabaseServer.from('tools_pcs_documents').select('*').eq('pet_id', petId).order('date', { ascending: false }),
        supabaseServer.from('tools_pcs_notes').select('*').eq('pet_id', petId).order('date', { ascending: false })
      ]);

      // Extract data from results, defaulting to empty array on error
      const foods = foodsResult.data || [];
      const vetRecords = vetRecordsResult.data || [];
      const careItems = careItemsResult.data || [];
      const vaccinations = vaccinationsResult.data || [];
      const appointments = appointmentsResult.data || [];
      const documents = documentsResult.data || [];
      const notes = notesResult.data || [];

      const [petFiles, documentFiles, veterinaryFiles, vaccinationFiles, appointmentFiles, pinned] = await Promise.all([
        attachmentsByPetIds([petId], user.id),
        attachmentsByDocumentIds(documents.map((row) => row.id), user.id),
        attachmentsByVeterinaryIds(vetRecords.map((row) => row.id), user.id),
        attachmentsByVaccinationIds(vaccinations.map((row) => row.id), user.id),
        attachmentsByAppointmentIds(appointments.map((row) => row.id), user.id),
        getPinnedSourceIds({
          userId: user.id,
          sourceType: CALENDAR_SOURCE_PET_APPOINTMENT,
          sourceIds: appointments.map((row) => row.id),
          toolId,
        }),
      ]);

      return NextResponse.json({
        pet: {
          ...pet,
          attachments: petFiles[petId] || [],
          foods: foods,
          veterinaryRecords: vetRecords.map((row) => ({ ...row, attachments: veterinaryFiles[row.id] || [] })),
          carePlanItems: careItems,
          vaccinations: vaccinations.map((row) => ({ ...row, attachments: vaccinationFiles[row.id] || [] })),
          appointments: appointments.map((row) => ({
            ...row,
            attachments: appointmentFiles[row.id] || [],
            addToDashboard: pinned.ids.has(row.id),
          })),
          documents: documents.map((row) => ({ ...row, attachments: documentFiles[row.id] || [] })),
          notes: notes
        }
      });
    }

    // Otherwise, fetch all pets for the user
    const { data: pets, error: petsError } = await supabaseServer
      .from('tools_pcs_pets')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('created_at', { ascending: false });

    if (petsError) {
      console.error('Error fetching pets:', petsError);
      // Check if it's a table doesn't exist error
      if (petsError.message?.includes('does not exist') || 
          petsError.message?.includes('schema cache') ||
          petsError.code === '42P01' ||
          petsError.code === 'PGRST116') {
        return NextResponse.json({ 
          error: 'Database tables not set up. Please run the migration SQL file (create-pet-care-schedule-tables.sql) in your Supabase SQL Editor to create the required tables.',
          pets: [] 
        }, { status: 500 });
      }
      return NextResponse.json({ 
        error: petsError.message || 'Failed to fetch pets',
        pets: [] 
      }, { status: 500 });
    }

    const list = pets || [];
    const petFiles = await attachmentsByPetIds(list.map((row) => row.id), user.id);
    return NextResponse.json({
      pets: list.map((row) => ({ ...row, attachments: petFiles[row.id] || [] })),
    });
  } catch (error) {
    console.error('Error in pet care schedule API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create or update pet and related data
export async function POST(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { petId, toolId, petData, foods, veterinaryRecords, carePlanItems, vaccinations, appointments, documents, notes } = body;

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    // Debug logging
    console.log('Pet Care Schedule POST - Received data:');
    console.log(`- petId: ${petId}`);
    console.log(`- toolId: ${toolId}`);
    console.log(`- appointments: ${appointments?.length || 0} items`);
    console.log(`- carePlanItems: ${carePlanItems?.length || 0} items`);
    if (appointments && appointments.length > 0) {
      console.log('Appointments:', JSON.stringify(appointments, null, 2));
    }
    if (carePlanItems && carePlanItems.length > 0) {
      console.log('Care Plan Items:', JSON.stringify(carePlanItems, null, 2));
    }

    let finalPetId = petId;

    // Create or update pet
    if (petId) {
      // Update existing pet
      const updateData: any = {
        name: petData.name,
        pet_type: petData.pet_type,
        custom_pet_type: petData.custom_pet_type,
        birthdate: petData.birthdate || null,
        breed: petData.breed || null,
        where_got_pet: petData.where_got_pet || null,
        weight: petData.weight || null,
        color: petData.color || null,
        microchip_number: petData.microchip_number || null,
      };
      
      // Only update card_color if provided (for edit mode)
      if (petData.card_color !== undefined) {
        updateData.card_color = petData.card_color || null;
      }
      
      const { data: updatedPet, error: updateError } = await supabaseServer
        .from('tools_pcs_pets')
        .update(updateData)
        .eq('id', petId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating pet:', updateError);
        return NextResponse.json({ error: 'Failed to update pet' }, { status: 500 });
      }
      finalPetId = updatedPet.id;
    } else {
      // Create new pet
      const insertData: any = {
        user_id: user.id,
        tool_id: toolId,
        name: petData.name,
        pet_type: petData.pet_type || null,
        custom_pet_type: petData.custom_pet_type || null,
        birthdate: petData.birthdate || null,
        breed: petData.breed || null,
        where_got_pet: petData.where_got_pet || null,
        weight: petData.weight || null,
        color: petData.color || null,
        microchip_number: petData.microchip_number || null,
      };
      
      // Only set card_color if provided
      if (petData.card_color !== undefined) {
        insertData.card_color = petData.card_color || null;
      }
      
      const { data: newPet, error: createError } = await supabaseServer
        .from('tools_pcs_pets')
        .insert(insertData)
        .select()
        .single();

      if (createError) {
        console.error('Error creating pet:', createError);
        return NextResponse.json({ error: 'Failed to create pet' }, { status: 500 });
      }
      finalPetId = newPet.id;
    }

    // Save related data (foods, vet records, etc.)
    // Note: This is a simplified version - you may want to handle updates/deletes more granularly
    if (foods && Array.isArray(foods)) {
      // Delete existing and insert new (or use upsert for better performance)
      await supabaseServer.from('tools_pcs_food_entries').delete().eq('pet_id', finalPetId);
      if (foods.length > 0) {
        await supabaseServer.from('tools_pcs_food_entries').insert(
          foods.map((f: any) => ({
            pet_id: finalPetId,
            name: f.name,
            rating: f.rating,
            start_date: f.startDate,
            end_date: f.endDate || null,
            is_current: f.isCurrent || false,
            notes: f.notes || null,
          }))
        );
      }
    }

    if (veterinaryRecords && Array.isArray(veterinaryRecords)) {
      await upsertPetChildren(
        'tools_pcs_veterinary_records',
        finalPetId,
        veterinaryRecords.map((v: any) => ({
          id: v.id,
          payload: {
            veterinarian_name: v.veterinarianName || null,
            clinic_name: v.clinicName || null,
            phone: v.phone || null,
            email: v.email || null,
            address: v.address || null,
            status: v.status || 'Active',
            date_added: v.dateAdded || new Date().toISOString().split('T')[0],
            notes: v.notes || null,
          },
        })),
        (ids) => deleteVeterinaryFileRows(ids, user.id)
      );
    }

    if (carePlanItems && Array.isArray(carePlanItems)) {
      console.log(`[API] Deleting all care plan items for pet ${finalPetId} before inserting ${carePlanItems.length} items`);
      const { error: deleteError } = await supabaseServer.from('tools_pcs_care_plan_items').delete().eq('pet_id', finalPetId);
      if (deleteError) {
        console.error('Error deleting care plan items:', deleteError);
        return NextResponse.json({ error: 'Failed to delete existing care plan items' }, { status: 500 });
      }
      console.log(`[API] Successfully deleted existing care plan items for pet ${finalPetId}`);
      
      if (carePlanItems.length > 0) {
        const carePlanData = carePlanItems.map((c: any) => {
          const isActive = c.isActive !== undefined ? c.isActive : true;
          // Handle notes: preserve non-empty strings, convert empty strings to null
          let notesValue = null;
          if (c.notes !== undefined && c.notes !== null) {
            if (typeof c.notes === 'string') {
              const trimmed = c.notes.trim();
              notesValue = trimmed.length > 0 ? trimmed : null;
            } else {
              notesValue = c.notes;
            }
          }
          console.log(`Mapping care plan item: ${c.name}, frequency: ${c.frequency}, isActive: ${isActive}`);
          console.log(`  - Raw notes value: ${JSON.stringify(c.notes)}, type: ${typeof c.notes}`);
          console.log(`  - Processed notes value: ${JSON.stringify(notesValue)}`);
          
          const priorityValue = (c.priority && ['low', 'medium', 'high'].includes(c.priority)) ? c.priority : 'medium';
          
          return {
            pet_id: finalPetId,
            name: c.name,
            frequency: c.frequency,
            is_active: isActive,
            start_date: c.startDate || new Date().toISOString().split('T')[0],
            end_date: c.endDate || null,
            notes: notesValue,
            priority: priorityValue,
          };
        });
        
        console.log('Inserting care plan items:', JSON.stringify(carePlanData, null, 2));
        
        const insertedCareItems = await supabaseServer.from('tools_pcs_care_plan_items').insert(carePlanData).select();
        
        if (insertedCareItems.error) {
          console.error('Error inserting care plan items:', insertedCareItems.error);
        }
        
        if (insertedCareItems.data) {
          console.log('Inserted care plan items with notes:', insertedCareItems.data.map((item: any) => ({
            id: item.id,
            name: item.name,
            notes: item.notes,
            notesType: typeof item.notes
          })));
        } else {
          console.log('No data returned from insert operation');
        }
        
        if (insertedCareItems.error) {
          console.error('Error inserting care plan items:', insertedCareItems.error);
        } else {
          console.log(`Successfully inserted ${insertedCareItems.data?.length || 0} care plan items`);
        }
      }
    }

    if (vaccinations && Array.isArray(vaccinations)) {
      await upsertPetChildren(
        'tools_pcs_vaccinations',
        finalPetId,
        vaccinations.map((v: any) => ({
          id: v.id,
          payload: {
            name: v.name,
            date: v.date,
            veterinarian: v.veterinarian || null,
            notes: v.notes || null,
          },
        })),
        (ids) => deleteVaccinationFileRows(ids, user.id)
      );
    }

    if (appointments && Array.isArray(appointments)) {
      await upsertPetChildren(
        'tools_pcs_appointments',
        finalPetId,
        appointments.map((a: any) => {
          const appointmentDate = new Date(a.date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          appointmentDate.setHours(0, 0, 0, 0);
          const isUpcoming = a.isUpcoming !== undefined ? a.isUpcoming : appointmentDate >= today;
          return {
            id: a.id,
            payload: {
              date: a.date,
              time: a.time || null,
              type: a.type,
              veterinarian: a.veterinarian || null,
              notes: a.notes || null,
              is_upcoming: isUpcoming,
            },
          };
        }),
        async (ids) => {
          await deleteCalendarPinsForSources({
            userId: user.id,
            sourceType: CALENDAR_SOURCE_PET_APPOINTMENT,
            sourceIds: ids,
          });
          await deleteAppointmentFileRows(ids, user.id);
        }
      );

      for (const appointment of appointments) {
        if (typeof appointment?.addToDashboard !== 'boolean' || !isUuid(appointment.id)) continue;
        const pinResult = await syncCalendarPin({
          userId: user.id,
          toolId,
          sourceType: CALENDAR_SOURCE_PET_APPOINTMENT,
          sourceId: appointment.id,
          pinned: appointment.addToDashboard,
        });
        if (pinResult.error) {
          return NextResponse.json(
            { error: 'Appointment saved, but failed to update the dashboard calendar' },
            { status: 500 }
          );
        }
      }
    }

    if (documents && Array.isArray(documents)) {
      await upsertPetChildren(
        'tools_pcs_documents',
        finalPetId,
        documents.map((d: any) => ({
          id: d.id,
          payload: {
            name: d.name,
            date: d.date,
            description: d.description || null,
          },
        })),
        (ids) => deleteDocumentFileRows(ids, user.id)
      );
    }

    if (notes && Array.isArray(notes)) {
      await supabaseServer.from('tools_pcs_notes').delete().eq('pet_id', finalPetId);
      if (notes.length > 0) {
        await supabaseServer.from('tools_pcs_notes').insert(
          notes.map((n: any) => ({
            pet_id: finalPetId,
            content: n.content,
            date: n.date || new Date().toISOString().split('T')[0],
            is_current: n.isCurrent !== undefined ? n.isCurrent : true,
          }))
        );
      }
    }

    return NextResponse.json({ success: true, petId: finalPetId });
  } catch (error) {
    console.error('Error saving pet care schedule data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a pet
export async function DELETE(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const petId = searchParams.get('petId');

    if (!petId) {
      return NextResponse.json({ error: 'Pet ID is required' }, { status: 400 });
    }

    const { data: pet, error: petError } = await supabaseServer
      .from('tools_pcs_pets')
      .select('id')
      .eq('id', petId)
      .eq('user_id', user.id)
      .single();

    if (petError || !pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    const { data: petAppointments } = await supabaseServer
      .from('tools_pcs_appointments')
      .select('id')
      .eq('pet_id', petId);

    await deleteCalendarPinsForSources({
      userId: user.id,
      sourceType: CALENDAR_SOURCE_PET_APPOINTMENT,
      sourceIds: (petAppointments || []).map((row) => row.id),
    });

    await deleteAllPetStorageFiles(petId, user.id);

    const childTables = [
      'tools_pcs_food_entries',
      'tools_pcs_veterinary_records',
      'tools_pcs_care_plan_items',
      'tools_pcs_vaccinations',
      'tools_pcs_appointments',
      'tools_pcs_documents',
      'tools_pcs_notes',
    ] as const;

    for (const table of childTables) {
      const { error: childError } = await supabaseServer.from(table).delete().eq('pet_id', petId);
      if (childError) {
        console.error(`Error deleting ${table} for pet ${petId}:`, childError);
        return NextResponse.json({ error: 'Failed to delete pet data' }, { status: 500 });
      }
    }

    const { error } = await supabaseServer
      .from('tools_pcs_pets')
      .delete()
      .eq('id', petId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting pet:', error);
      return NextResponse.json({ error: 'Failed to delete pet' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pet:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
