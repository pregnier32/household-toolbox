import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

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
          }))
        );
      }
    }

    if (carePlanItems && Array.isArray(carePlanItems)) {
      await supabaseServer.from('tools_pcs_care_plan_items').delete().eq('pet_id', finalPetId);
      if (carePlanItems.length > 0) {
        await supabaseServer.from('tools_pcs_care_plan_items').insert(
          carePlanItems.map((c: any) => ({
            pet_id: finalPetId,
            name: c.name,
            frequency: c.frequency,
            is_active: c.isActive !== undefined ? c.isActive : true,
            start_date: c.startDate || new Date().toISOString().split('T')[0],
            end_date: c.endDate || null,
          }))
        );
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
        await supabaseServer.from('tools_pcs_appointments').insert(
          appointments.map((a: any) => ({
            pet_id: finalPetId,
            date: a.date,
            time: a.time || null,
            type: a.type,
            veterinarian: a.veterinarian || null,
            notes: a.notes || null,
            is_upcoming: a.isUpcoming !== undefined ? a.isUpcoming : (new Date(a.date) >= new Date()),
          }))
        );
      }
    }

    if (documents && Array.isArray(documents)) {
      await supabaseServer.from('tools_pcs_documents').delete().eq('pet_id', finalPetId);
      if (documents.length > 0) {
        await supabaseServer.from('tools_pcs_documents').insert(
          documents.map((d: any) => ({
            pet_id: finalPetId,
            name: d.name,
            date: d.date,
            description: d.description || null,
            file_url: d.file_url || null,
            file_name: d.file_name || null,
            file_size: d.file_size || null,
            file_type: d.file_type || null,
          }))
        );
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

    if (!petId) {
      return NextResponse.json({ error: 'Pet ID is required' }, { status: 400 });
    }

    // Delete pet (cascade will delete all related records)
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
