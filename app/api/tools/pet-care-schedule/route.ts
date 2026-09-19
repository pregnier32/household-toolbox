import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { assertCanStoreBytes, refreshUserStorageUsage } from '@/lib/user-storage';

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Helper function to upload file to Supabase Storage
async function uploadFile(
  file: File,
  userId: string,
  bucketName: string,
  folder: string
): Promise<{ url: string; fileName: string; fileSize: number; fileType: string } | null> {
  try {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size cannot exceed ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    await assertCanStoreBytes(userId, file.size);

    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageFileName = `${folder}/${userId}/${Date.now()}-${sanitizedFileName}`;
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const { data: uploadData, error: uploadError } = await supabaseServer
      .storage
      .from(bucketName)
      .upload(storageFileName, buffer, {
        contentType: file.type,
        upsert: false
      });
    
    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      // Check if bucket doesn't exist
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('does not exist')) {
        throw new Error(`Storage bucket '${bucketName}' does not exist. Please create it in Supabase Storage.`);
      }
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }
    
    const { data: urlData } = supabaseServer
      .storage
      .from(bucketName)
      .getPublicUrl(storageFileName);
    
    await refreshUserStorageUsage(userId);

    return {
      url: urlData.publicUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    };
  } catch (error: any) {
    console.error('Error in uploadFile:', error);
    throw error; // Re-throw to be caught by the caller
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

      return NextResponse.json({
        pet: {
          ...pet,
          foods: foods,
          veterinaryRecords: vetRecords,
          carePlanItems: careItems,
          vaccinations: vaccinations,
          appointments: appointments,
          documents: documents,
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

    return NextResponse.json({ pets: pets || [] });
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
      await supabaseServer.from('tools_pcs_veterinary_records').delete().eq('pet_id', finalPetId);
      if (veterinaryRecords.length > 0) {
        await supabaseServer.from('tools_pcs_veterinary_records').insert(
          veterinaryRecords.map((v: any) => ({
            pet_id: finalPetId,
            veterinarian_name: v.veterinarianName || null,
            clinic_name: v.clinicName || null,
            phone: v.phone || null,
            email: v.email || null,
            address: v.address || null,
            status: v.status || 'Active',
            date_added: v.dateAdded || new Date().toISOString().split('T')[0],
            notes: v.notes || null,
          }))
        );
      }
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
      await supabaseServer.from('tools_pcs_vaccinations').delete().eq('pet_id', finalPetId);
      if (vaccinations.length > 0) {
        await supabaseServer.from('tools_pcs_vaccinations').insert(
          vaccinations.map((v: any) => ({
            pet_id: finalPetId,
            name: v.name,
            date: v.date,
            veterinarian: v.veterinarian || null,
            notes: v.notes || null,
          }))
        );
      }
    }

    if (appointments && Array.isArray(appointments)) {
      await supabaseServer.from('tools_pcs_appointments').delete().eq('pet_id', finalPetId);
      if (appointments.length > 0) {
        const appointmentData = appointments.map((a: any) => {
          const appointmentDate = new Date(a.date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          appointmentDate.setHours(0, 0, 0, 0);
          const isUpcoming = a.isUpcoming !== undefined ? a.isUpcoming : (appointmentDate >= today);

          return {
            pet_id: finalPetId,
            date: a.date,
            time: a.time || null,
            type: a.type,
            veterinarian: a.veterinarian || null,
            notes: a.notes || null,
            is_upcoming: isUpcoming,
          };
        });

        const insertedAppointments = await supabaseServer.from('tools_pcs_appointments').insert(appointmentData).select();

        if (insertedAppointments.error) {
          console.error('Error inserting appointments:', insertedAppointments.error);
        }
      }
    }

    if (documents && Array.isArray(documents)) {
      await supabaseServer.from('tools_pcs_documents').delete().eq('pet_id', finalPetId);
      if (documents.length > 0) {
        // Upload files and prepare document data
        const documentsToInsert = documents.map((d: any) => ({
              pet_id: finalPetId,
              name: d.name,
              date: d.date,
              description: d.description || null,
              file_url: d.file_url || null,
              file_name: d.file_name || null,
              file_size: d.file_size ?? null,
              file_type: d.file_type || null,
            }));

        await supabaseServer.from('tools_pcs_documents').insert(documentsToInsert);
      }
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
    const toolId = searchParams.get('toolId');

    if (!petId) {
      return NextResponse.json({ error: 'Pet ID is required' }, { status: 400 });
    }

    const { data: pet, error: petError } = await supabaseServer
      .from('tools_pcs_pets')
      .select('id, tool_id')
      .eq('id', petId)
      .eq('user_id', user.id)
      .single();

    if (petError || !pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    const finalToolId = toolId || pet.tool_id;

    const { data: petDocs } = await supabaseServer
      .from('tools_pcs_documents')
      .select('file_url')
      .eq('pet_id', petId);
    const storagePaths = (petDocs || [])
      .map((row: { file_url: string | null }) => {
        if (!row.file_url) return null;
        const marker = 'pet-care-schedule/';
        const markerIndex = row.file_url.indexOf(marker);
        if (markerIndex === -1) return null;
        return row.file_url.slice(markerIndex + marker.length);
      })
      .filter((path: string | null): path is string => Boolean(path));
    if (storagePaths.length > 0) {
      await supabaseServer.storage.from('pet-care-schedule').remove(storagePaths);
      await refreshUserStorageUsage(user.id);
    }

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
