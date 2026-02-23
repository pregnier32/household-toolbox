import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

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

// Helper function to calculate next due date based on frequency
function calculateNextDueDate(frequency: string, startDate: string): string {
  const start = new Date(startDate);
  const now = new Date();
  let nextDate = new Date(start);

  // If start date is in the future, use it
  if (start > now) {
    return start.toISOString().split('T')[0];
  }

  // Calculate next occurrence based on frequency
  switch (frequency) {
    case 'Daily':
      nextDate.setDate(now.getDate() + 1);
      break;
    case 'Every 2 Days':
      const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const nextOccurrence = Math.ceil((daysSinceStart + 1) / 2) * 2;
      nextDate = new Date(start);
      nextDate.setDate(start.getDate() + nextOccurrence);
      break;
    case 'Every 3 Days':
      const daysSinceStart3 = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const nextOccurrence3 = Math.ceil((daysSinceStart3 + 1) / 3) * 3;
      nextDate = new Date(start);
      nextDate.setDate(start.getDate() + nextOccurrence3);
      break;
    case 'Weekly':
      nextDate.setDate(now.getDate() + 7);
      break;
    case 'Every 2 Weeks':
      nextDate.setDate(now.getDate() + 14);
      break;
    case 'Monthly':
      nextDate.setMonth(now.getMonth() + 1);
      break;
    case 'Every 3 Months':
      nextDate.setMonth(now.getMonth() + 3);
      break;
    case 'Every 6 Months':
      nextDate.setMonth(now.getMonth() + 6);
      break;
    case 'Yearly':
      nextDate.setFullYear(now.getFullYear() + 1);
      break;
    case 'As Needed':
      // For "As Needed", set to 30 days from now as a reminder
      nextDate.setDate(now.getDate() + 30);
      break;
    default:
      nextDate.setDate(now.getDate() + 7); // Default to weekly
  }

  return nextDate.toISOString().split('T')[0];
}

// Helper function to create dashboard item
async function createDashboardItem(
  userId: string,
  toolId: string,
  item: {
    title: string;
    description?: string;
    type: 'calendar_event' | 'action_item' | 'both';
    due_date?: string;
    scheduled_date?: string;
    priority?: 'low' | 'medium' | 'high';
    metadata?: Record<string, any>;
  }
) {
  try {
    // First verify the tool exists
    const { data: toolData, error: toolError } = await supabaseServer
      .from('tools')
      .select('id')
      .eq('id', toolId)
      .single();
    
    if (toolError || !toolData) {
      console.error('Tool validation failed:', toolError);
      console.error(`Tool ID ${toolId} does not exist or cannot be accessed`);
      return null;
    }
    
    const insertData = {
      user_id: userId,
      tool_id: toolId,
      title: item.title,
      description: item.description || null,
      type: item.type,
      due_date: item.due_date || null,
      scheduled_date: item.scheduled_date || null,
      priority: item.priority || 'medium',
      status: 'pending',
      metadata: item.metadata || {},
    };
    
    console.log('createDashboardItem - Insert data:', JSON.stringify(insertData, null, 2));
    
    // Try without .single() first to see if that's the issue
    const { data, error } = await supabaseServer
      .from('dashboard_items')
      .insert(insertData)
      .select();

    if (error) {
      console.error('Error creating dashboard item:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
      console.error('Item data:', JSON.stringify(item, null, 2));
      console.error('Insert data:', JSON.stringify(insertData, null, 2));
      // Don't throw - dashboard items are optional
      return null;
    }
    
    if (!data || data.length === 0) {
      console.error('No data returned from dashboard_items insert');
      return null;
    }
    
    const createdItem = data[0];
    console.log('Successfully created dashboard item:', createdItem?.id);
    console.log('Created dashboard item data:', JSON.stringify(createdItem, null, 2));
    return createdItem;
  } catch (error: any) {
    console.error('Exception creating dashboard item:', error);
    console.error('Exception type:', error?.constructor?.name);
    console.error('Exception message:', error?.message);
    console.error('Exception stack:', error?.stack);
    console.error('Item data:', JSON.stringify(item, null, 2));
    // Don't throw - dashboard items are optional
    return null;
  }
}

// Helper function to delete dashboard items by metadata reference
async function deleteDashboardItemsByReference(
  userId: string,
  toolId: string,
  referenceType: 'appointment' | 'care_plan',
  referenceId: string
) {
  try {
    // First, get all dashboard items for this user and tool
    const { data: items, error: fetchError } = await supabaseServer
      .from('dashboard_items')
      .select('id, metadata')
      .eq('user_id', userId)
      .eq('tool_id', toolId);

    if (fetchError) {
      console.error('Error fetching dashboard items:', fetchError);
      return;
    }

    // Filter items by metadata and delete
    if (items) {
      const itemsToDelete = items.filter((item: any) => {
        const metadata = item.metadata || {};
        return metadata.referenceType === referenceType && metadata.referenceId === referenceId;
      });

      if (itemsToDelete.length > 0) {
        const idsToDelete = itemsToDelete.map((item: any) => item.id);
        const { error: deleteError } = await supabaseServer
          .from('dashboard_items')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.error('Error deleting dashboard items:', deleteError);
        }
      }
    }
  } catch (error) {
    console.error('Error deleting dashboard items:', error);
  }
}

// Helper function to delete all dashboard items for a pet
async function deleteDashboardItemsForPet(
  userId: string,
  toolId: string,
  petId: string
) {
  try {
    // Get all dashboard items for this user and tool
    const { data: items, error: fetchError } = await supabaseServer
      .from('dashboard_items')
      .select('id, metadata')
      .eq('user_id', userId)
      .eq('tool_id', toolId);

    if (fetchError) {
      console.error('Error fetching dashboard items:', fetchError);
      return;
    }

    // Filter items by petId in metadata and delete
    if (items) {
      const itemsToDelete = items.filter((item: any) => {
        const metadata = item.metadata || {};
        return metadata.petId === petId;
      });

      if (itemsToDelete.length > 0) {
        const idsToDelete = itemsToDelete.map((item: any) => item.id);
        const { error: deleteError } = await supabaseServer
          .from('dashboard_items')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.error('Error deleting dashboard items:', deleteError);
        }
      }
    }
  } catch (error) {
    console.error('Error deleting dashboard items:', error);
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
    let petName = petData.name;

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
      petName = updatedPet.name;
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
      petName = newPet.name;
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
      // Delete ALL old dashboard items for this pet's care plan items (to prevent duplicates)
      // First, get all dashboard items for this user and tool
      const { data: allDashboardItems, error: fetchError } = await supabaseServer
        .from('dashboard_items')
        .select('id, metadata')
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      
      if (!fetchError && allDashboardItems) {
        // Filter items by petId and referenceType='care_plan' in metadata
        const itemsToDelete = allDashboardItems.filter((item: any) => {
          const metadata = item.metadata || {};
          return metadata.referenceType === 'care_plan' && metadata.petId === finalPetId;
        });

        if (itemsToDelete.length > 0) {
          const idsToDelete = itemsToDelete.map((item: any) => item.id);
          const { error: deleteError } = await supabaseServer
            .from('dashboard_items')
            .delete()
            .in('id', idsToDelete);

          if (deleteError) {
            console.error('Error deleting dashboard items:', deleteError);
          } else {
            console.log(`Deleted ${idsToDelete.length} old dashboard items for pet ${finalPetId} care plan items`);
          }
        }
      }

      // Delete all care plan items for this pet first, and wait for it to complete
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
          const addToDashboard = c.addToDashboard !== undefined ? c.addToDashboard : true;
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
          console.log(`Mapping care plan item: ${c.name}, frequency: ${c.frequency}, isActive: ${isActive}, addToDashboard: ${addToDashboard}`);
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
            add_to_dashboard: addToDashboard,
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

        // Create dashboard items for active care plan items
        if (insertedCareItems.data && insertedCareItems.data.length > 0) {
          console.log(`Processing ${insertedCareItems.data.length} care plan items for dashboard items`);
          for (const careItem of insertedCareItems.data) {
            const isActive = careItem.is_active;
            const addToDashboard = careItem.add_to_dashboard !== undefined ? careItem.add_to_dashboard : true;
            const hasEndDate = careItem.end_date;
            const endDateValid = !hasEndDate || new Date(careItem.end_date) >= new Date();
            
            console.log(`Care Item: ${careItem.name}, is_active: ${isActive}, add_to_dashboard: ${addToDashboard}, end_date: ${careItem.end_date}, endDateValid: ${endDateValid}`);
            
            if (isActive && endDateValid && addToDashboard) {
              const nextDueDate = calculateNextDueDate(careItem.frequency, careItem.start_date);
              console.log(`Calculated next due date for ${careItem.name}: ${nextDueDate}`);
              
              // Use user-selected priority, default to 'medium' if not set
              const priority: 'low' | 'medium' | 'high' = (careItem.priority && ['low', 'medium', 'high'].includes(careItem.priority)) 
                ? careItem.priority 
                : 'medium';

              const dashboardItemData = {
                title: `${petName} - ${careItem.name}`,
                description: `Frequency: ${careItem.frequency}`,
                type: 'action_item' as const,
                due_date: nextDueDate,
                priority,
                metadata: {
                  referenceType: 'care_plan',
                  referenceId: careItem.id,
                  petId: finalPetId,
                  petName,
                  frequency: careItem.frequency,
                  startDate: careItem.start_date,
                  notes: careItem.notes || null,
                },
              };
              
              console.log(`Care item notes value: ${JSON.stringify(careItem.notes)}`);
              console.log(`Attempting to create dashboard item for care plan item ${careItem.id}:`, JSON.stringify(dashboardItemData, null, 2));
              console.log(`User ID: ${user.id}, Tool ID: ${toolId}`);
              
              const result = await createDashboardItem(user.id, toolId, dashboardItemData);
              
              if (!result) {
                console.error(`Failed to create dashboard item for care plan item ${careItem.id} (${careItem.name})`);
              } else {
                console.log(`Successfully created dashboard item ${result.id} for care plan item ${careItem.id}`);
              }
            }
          }
        } else {
          console.log('No care plan items data returned from insert');
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
      // Delete ALL old dashboard items for this pet's appointments (to prevent duplicates)
      // First, get all dashboard items for this user and tool
      const { data: allDashboardItems, error: fetchError } = await supabaseServer
        .from('dashboard_items')
        .select('id, metadata')
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      
      if (!fetchError && allDashboardItems) {
        // Filter items by petId and referenceType='appointment' in metadata
        const itemsToDelete = allDashboardItems.filter((item: any) => {
          const metadata = item.metadata || {};
          return metadata.referenceType === 'appointment' && metadata.petId === finalPetId;
        });

        if (itemsToDelete.length > 0) {
          const idsToDelete = itemsToDelete.map((item: any) => item.id);
          const { error: deleteError } = await supabaseServer
            .from('dashboard_items')
            .delete()
            .in('id', idsToDelete);

          if (deleteError) {
            console.error('Error deleting dashboard items:', deleteError);
          } else {
            console.log(`Deleted ${idsToDelete.length} old dashboard items for pet ${finalPetId} appointments`);
          }
        }
      }

      await supabaseServer.from('tools_pcs_appointments').delete().eq('pet_id', finalPetId);
      if (appointments.length > 0) {
        const appointmentData = appointments.map((a: any) => {
          const appointmentDate = new Date(a.date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          appointmentDate.setHours(0, 0, 0, 0);
          const isUpcoming = a.isUpcoming !== undefined ? a.isUpcoming : (appointmentDate >= today);
          const addToDashboard = a.addToDashboard !== undefined ? a.addToDashboard : true;
          
          console.log(`Mapping appointment: ${a.type}, date: ${a.date}, isUpcoming: ${isUpcoming}, addToDashboard: ${addToDashboard}`);
          
          return {
            pet_id: finalPetId,
            date: a.date,
            time: a.time || null,
            type: a.type,
            veterinarian: a.veterinarian || null,
            notes: a.notes || null,
            is_upcoming: isUpcoming,
            add_to_dashboard: addToDashboard,
          };
        });
        
        console.log('Inserting appointments:', JSON.stringify(appointmentData, null, 2));
        
        const insertedAppointments = await supabaseServer.from('tools_pcs_appointments').insert(appointmentData).select();
        
        if (insertedAppointments.error) {
          console.error('Error inserting appointments:', insertedAppointments.error);
        } else {
          console.log(`Successfully inserted ${insertedAppointments.data?.length || 0} appointments`);
        }

        // Create dashboard items for upcoming appointments
        if (insertedAppointments.data && insertedAppointments.data.length > 0) {
          console.log(`Processing ${insertedAppointments.data.length} appointments for dashboard items`);
          for (const appointment of insertedAppointments.data) {
            const appointmentDate = new Date(appointment.date + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            appointmentDate.setHours(0, 0, 0, 0);
            const addToDashboard = appointment.add_to_dashboard !== undefined ? appointment.add_to_dashboard : true;
            
            console.log(`Appointment: ${appointment.type}, Date: ${appointment.date}, is_upcoming: ${appointment.is_upcoming}, add_to_dashboard: ${addToDashboard}, Date >= Today: ${appointmentDate >= today}`);
            
            // Create calendar event if it's marked as upcoming OR if the date is today or in the future, AND addToDashboard is true
            if ((appointment.is_upcoming || appointmentDate >= today) && addToDashboard) {
              // Combine date and time for scheduled_date
              let scheduledDateTime: string;
              if (appointment.time) {
                const [hours, minutes] = appointment.time.split(':');
                const dateTime = new Date(appointment.date);
                dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                scheduledDateTime = dateTime.toISOString();
              } else {
                // Default to 9 AM if no time specified
                const dateTime = new Date(appointment.date);
                dateTime.setHours(9, 0, 0, 0);
                scheduledDateTime = dateTime.toISOString();
              }

              const description = [
                appointment.veterinarian ? `Vet: ${appointment.veterinarian}` : null,
                appointment.notes || null,
              ].filter(Boolean).join(' | ') || undefined;

              const dashboardItemData = {
                title: `${petName} - ${appointment.type}`,
                description,
                type: 'calendar_event' as const,
                scheduled_date: scheduledDateTime,
                priority: 'high' as const,
                metadata: {
                  referenceType: 'appointment',
                  referenceId: appointment.id,
                  petId: finalPetId,
                  petName,
                },
              };
              
              console.log(`Attempting to create dashboard item for appointment ${appointment.id}:`, JSON.stringify(dashboardItemData, null, 2));
              console.log(`User ID: ${user.id}, Tool ID: ${toolId}`);
              
              const result = await createDashboardItem(user.id, toolId, dashboardItemData);
              
              if (!result) {
                console.error(`Failed to create dashboard item for appointment ${appointment.id} (${appointment.type})`);
              } else {
                console.log(`Successfully created dashboard item ${result.id} for appointment ${appointment.id}`);
              }
            }
          }
        } else {
          console.log('No appointments data returned from insert');
        }
      }
    }

    if (documents && Array.isArray(documents)) {
      await supabaseServer.from('tools_pcs_documents').delete().eq('pet_id', finalPetId);
      if (documents.length > 0) {
        // Upload files and prepare document data
        const documentsToInsert = await Promise.all(
          documents.map(async (d: any, index: number) => {
            let fileUrl = d.file_url || null;
            let fileName = d.file_name || null;
            let fileSize = d.file_size || null;
            let fileType = d.file_type || null;

            // If there's a new file to upload
            const file = documentFiles.get(index.toString());
            if (file && file.size > 0) {
              try {
                const uploadResult = await uploadFile(file, user.id, 'pet-care-schedule', 'documents');
                if (uploadResult) {
                  fileUrl = uploadResult.url;
                  fileName = uploadResult.fileName;
                  fileSize = uploadResult.fileSize;
                  fileType = uploadResult.fileType;
                }
              } catch (error: any) {
                console.error(`Failed to upload document file for ${d.name}:`, error);
                // Continue without file URL if upload fails
              }
            }

            return {
              pet_id: finalPetId,
              name: d.name,
              date: d.date,
              description: d.description || null,
              file_url: fileUrl,
              file_name: fileName,
              file_size: fileSize,
              file_type: fileType,
            };
          })
        );

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

    // Fetch pet to get toolId if not provided
    let finalToolId = toolId;
    if (!finalToolId) {
      const { data: pet, error: petError } = await supabaseServer
        .from('tools_pcs_pets')
        .select('tool_id')
        .eq('id', petId)
        .eq('user_id', user.id)
        .single();

      if (petError || !pet) {
        return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
      }
      finalToolId = pet.tool_id;
    }

    // Delete dashboard items for this pet before deleting the pet
    if (finalToolId) {
      await deleteDashboardItemsForPet(user.id, finalToolId, petId);
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
