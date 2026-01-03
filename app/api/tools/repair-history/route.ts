import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Helper function to create dashboard item (calendar event for warranty)
async function createDashboardItem(
  userId: string,
  toolId: string,
  item: {
    title: string;
    description?: string;
    type: 'calendar_event' | 'action_item' | 'both';
    scheduled_date?: string;
    metadata?: Record<string, any>;
  }
) {
  try {
    const insertData = {
      user_id: userId,
      tool_id: toolId,
      title: item.title,
      description: item.description || null,
      type: item.type,
      scheduled_date: item.scheduled_date || null,
      priority: null,
      status: 'pending',
      metadata: item.metadata || {},
    };
    
    const { data, error } = await supabaseServer
      .from('dashboard_items')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating dashboard item:', error);
      return null;
    }
    
    return data;
  } catch (error: any) {
    console.error('Exception creating dashboard item:', error);
    return null;
  }
}

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
      return null;
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
    return null;
  }
}

// GET - Fetch headers, records, and items
export async function GET(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');
    const resource = searchParams.get('resource'); // 'headers', 'records', 'items', or null for all
    const headerId = searchParams.get('headerId');
    const recordId = searchParams.get('recordId');
    const itemId = searchParams.get('itemId');

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    // Fetch headers
    if (!resource || resource === 'headers') {
      const { data: headers, error: headersError } = await supabaseServer
        .from('tools_rh_headers')
        .select('*')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .order('created_at', { ascending: true });

      if (headersError) {
        console.error('Error fetching headers:', headersError);
        return NextResponse.json({ error: 'Failed to fetch headers' }, { status: 500 });
      }

      if (resource === 'headers') {
        return NextResponse.json({ headers: headers || [] });
      }
    }

    // Fetch records
    if (!resource || resource === 'records') {
      if (recordId) {
        // Fetch single record
        let singleRecordQuery = supabaseServer
          .from('tools_rh_records')
          .select('*')
          .eq('id', recordId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId);

        if (headerId) {
          singleRecordQuery = singleRecordQuery.eq('header_id', headerId);
        }

        const { data: record, error: recordError } = await singleRecordQuery.single();

        if (recordError) {
          console.error('Error fetching record:', recordError);
          return NextResponse.json({ error: 'Failed to fetch record' }, { status: 500 });
        }

        // Fetch repair pictures for single record
        const { data: pictures } = await supabaseServer
          .from('tools_rh_repair_pictures')
          .select('*')
          .eq('record_id', recordId)
          .order('display_order', { ascending: true });

        const recordWithPictures = {
          ...record,
          repairPictures: pictures?.map(pic => ({
            id: pic.id,
            fileUrl: pic.file_url,
            fileName: pic.file_name,
            fileSize: pic.file_size,
            fileType: pic.file_type,
            displayOrder: pic.display_order
          })) || []
        };

        if (resource === 'records') {
          return NextResponse.json({ record: recordWithPictures });
        }
      } else {
        // Fetch multiple records
        let recordsQuery = supabaseServer
          .from('tools_rh_records')
          .select('*')
          .eq('user_id', user.id)
          .eq('tool_id', toolId);

        if (headerId) {
          recordsQuery = recordsQuery.eq('header_id', headerId);
        }

        recordsQuery = recordsQuery.order('date', { ascending: false });

        const { data: records, error: recordsError } = await recordsQuery;

        if (recordsError) {
          console.error('Error fetching records:', recordsError);
          return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
        }

        // Fetch repair pictures for records
        if (records && Array.isArray(records)) {
          const recordIds = records.map(r => r.id);
          const { data: pictures } = await supabaseServer
            .from('tools_rh_repair_pictures')
            .select('*')
            .in('record_id', recordIds)
            .order('display_order', { ascending: true });

          const picturesMap: Record<string, any[]> = {};
          pictures?.forEach(pic => {
            if (!picturesMap[pic.record_id]) {
              picturesMap[pic.record_id] = [];
            }
            picturesMap[pic.record_id].push({
              id: pic.id,
              fileUrl: pic.file_url,
              fileName: pic.file_name,
              fileSize: pic.file_size,
              fileType: pic.file_type,
              displayOrder: pic.display_order
            });
          });

          const recordsWithPictures = records.map(record => ({
            ...record,
            repairPictures: picturesMap[record.id] || []
          }));

          if (resource === 'records') {
            return NextResponse.json({ records: recordsWithPictures });
          }
        }
      }
    }

    // Fetch items
    if (!resource || resource === 'items') {
      const categoryType = searchParams.get('categoryType'); // 'Home' or 'Auto'
      
      if (itemId) {
        // Fetch single item
        let singleItemQuery = supabaseServer
          .from('tools_rh_items')
          .select('*')
          .eq('id', itemId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId);

        if (categoryType) {
          singleItemQuery = singleItemQuery.eq('category_type', categoryType);
        }

        const { data: item, error: itemError } = await singleItemQuery.single();

        if (itemError) {
          console.error('Error fetching item:', itemError);
          return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 });
        }

        if (resource === 'items') {
          return NextResponse.json({ items: item ? [item] : [] });
        }
      } else {
        // Fetch multiple items
        let itemsQuery = supabaseServer
          .from('tools_rh_items')
          .select('*')
          .eq('user_id', user.id)
          .eq('tool_id', toolId);

        if (categoryType) {
          itemsQuery = itemsQuery.eq('category_type', categoryType);
        }

        itemsQuery = itemsQuery.order('area', { ascending: true }).order('name', { ascending: true });

        const { data: items, error: itemsError } = await itemsQuery;

        if (itemsError) {
          console.error('Error fetching items:', itemsError);
          return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
        }

        if (resource === 'items') {
          return NextResponse.json({ items: items || [] });
        }
      }
    }

    // Return all data if no specific resource requested
    const { data: headers } = await supabaseServer
      .from('tools_rh_headers')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('created_at', { ascending: true });

    const { data: records } = await supabaseServer
      .from('tools_rh_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('date', { ascending: false });

    const { data: items } = await supabaseServer
      .from('tools_rh_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('area', { ascending: true })
      .order('name', { ascending: true });

    return NextResponse.json({
      headers: headers || [],
      records: records || [],
      items: items || []
    });
  } catch (error: any) {
    console.error('Error in GET /api/tools/repair-history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create or update headers, records, or items
export async function POST(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const toolId = formData.get('toolId') as string;
    const resource = formData.get('resource') as string; // 'header', 'record', 'item'
    const action = formData.get('action') as string; // 'create', 'update', 'delete'

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    // Handle header operations
    if (resource === 'header') {
      const headerId = formData.get('headerId') as string | null;
      const name = formData.get('name') as string;
      const cardColor = formData.get('cardColor') as string;
      const categoryType = formData.get('categoryType') as 'Home' | 'Auto';

      if (action === 'delete' && headerId) {
        const { error } = await supabaseServer
          .from('tools_rh_headers')
          .delete()
          .eq('id', headerId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId);

        if (error) {
          console.error('Error deleting header:', error);
          return NextResponse.json({ error: 'Failed to delete header' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      if (action === 'update' && headerId) {
        const { data, error } = await supabaseServer
          .from('tools_rh_headers')
          .update({
            name: name.trim(),
            card_color: cardColor || '#10b981',
            category_type: categoryType
          })
          .eq('id', headerId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .select()
          .single();

        if (error) {
          console.error('Error updating header:', error);
          return NextResponse.json({ error: 'Failed to update header' }, { status: 500 });
        }

        return NextResponse.json({ success: true, header: data });
      }

      if (action === 'create') {
        const { data, error } = await supabaseServer
          .from('tools_rh_headers')
          .insert({
            user_id: user.id,
            tool_id: toolId,
            name: name.trim(),
            card_color: cardColor || '#10b981',
            category_type: categoryType,
            is_default: false
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating header:', error);
          return NextResponse.json({ error: 'Failed to create header' }, { status: 500 });
        }

        return NextResponse.json({ success: true, header: data });
      }
    }

    // Handle record operations
    if (resource === 'record') {
      const recordId = formData.get('recordId') as string | null;
      const headerId = formData.get('headerId') as string;
      const date = formData.get('date') as string;
      const itemName = formData.get('itemName') as string;
      const type = formData.get('type') as 'repair' | 'replace';
      const description = formData.get('description') as string;
      const cost = formData.get('cost') as string;
      const serviceProvider = formData.get('serviceProvider') as string;
      const warrantyEndDate = formData.get('warrantyEndDate') as string;
      const addWarrantyToDashboard = formData.get('addWarrantyToDashboard') === 'true';
      const submittedToInsurance = formData.get('submittedToInsurance') === 'true';
      const insuranceCarrier = formData.get('insuranceCarrier') as string;
      const claimNumber = formData.get('claimNumber') as string;
      const amountInsurancePaid = formData.get('amountInsurancePaid') as string;
      const agentContactInfo = formData.get('agentContactInfo') as string;
      const claimNotes = formData.get('claimNotes') as string;
      const odometerReading = formData.get('odometerReading') as string;
      const manualLink = formData.get('manualLink') as string;
      const notes = formData.get('notes') as string;

      // Handle file uploads
      const receiptFile = formData.get('receiptFile') as File | null;
      const warrantyFile = formData.get('warrantyFile') as File | null;
      const repairPictures = formData.getAll('repairPictures') as File[];

      let receiptFileUrl: string | null = null;
      let receiptFileName: string | null = null;
      let warrantyFileUrl: string | null = null;
      let warrantyFileName: string | null = null;

      // Upload receipt if provided
      if (receiptFile && receiptFile.size > 0) {
        const uploadResult = await uploadFile(receiptFile, user.id, 'repair-history', 'receipts');
        if (uploadResult) {
          receiptFileUrl = uploadResult.url;
          receiptFileName = uploadResult.fileName;
        }
      }

      // Upload warranty if provided
      if (warrantyFile && warrantyFile.size > 0) {
        const uploadResult = await uploadFile(warrantyFile, user.id, 'repair-history', 'warranties');
        if (uploadResult) {
          warrantyFileUrl = uploadResult.url;
          warrantyFileName = uploadResult.fileName;
        }
      }

      if (action === 'delete' && recordId) {
        // Get record to check for warranty dashboard item
        const { data: record } = await supabaseServer
          .from('tools_rh_records')
          .select('warranty_dashboard_item_id')
          .eq('id', recordId)
          .eq('user_id', user.id)
          .single();

        // Delete warranty dashboard item if exists
        if (record?.warranty_dashboard_item_id) {
          await supabaseServer
            .from('dashboard_items')
            .delete()
            .eq('id', record.warranty_dashboard_item_id);
        }

        const { error } = await supabaseServer
          .from('tools_rh_records')
          .delete()
          .eq('id', recordId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error deleting record:', error);
          return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      const recordData: any = {
        header_id: headerId,
        user_id: user.id,
        tool_id: toolId,
        date,
        item_name: itemName.trim(),
        type,
        description: description?.trim() || null,
        cost: cost?.trim() || null,
        service_provider: serviceProvider?.trim() || null,
        warranty_end_date: warrantyEndDate || null,
        submitted_to_insurance: submittedToInsurance || false,
        insurance_carrier: insuranceCarrier?.trim() || null,
        claim_number: claimNumber?.trim() || null,
        amount_insurance_paid: amountInsurancePaid?.trim() || null,
        agent_contact_info: agentContactInfo?.trim() || null,
        claim_notes: claimNotes?.trim() || null,
        odometer_reading: odometerReading?.trim() || null,
        manual_link: manualLink?.trim() || null,
        notes: notes?.trim() || null,
      };

      // Only update file URLs if new files were uploaded
      if (receiptFileUrl) {
        recordData.receipt_file_url = receiptFileUrl;
        recordData.receipt_file_name = receiptFileName;
      }
      if (warrantyFileUrl) {
        recordData.warranty_file_url = warrantyFileUrl;
        recordData.warranty_file_name = warrantyFileName;
      }

      let finalRecordId = recordId;
      let oldWarrantyDashboardItemId: string | null = null;

      if (action === 'update' && recordId) {
        // Get current record to check for warranty dashboard item
        const { data: currentRecord } = await supabaseServer
          .from('tools_rh_records')
          .select('warranty_dashboard_item_id')
          .eq('id', recordId)
          .eq('user_id', user.id)
          .single();

        oldWarrantyDashboardItemId = currentRecord?.warranty_dashboard_item_id || null;

        const { data, error } = await supabaseServer
          .from('tools_rh_records')
          .update(recordData)
          .eq('id', recordId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating record:', error);
          return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
        }

        finalRecordId = data.id;
      } else if (action === 'create') {
        const { data, error } = await supabaseServer
          .from('tools_rh_records')
          .insert(recordData)
          .select()
          .single();

        if (error) {
          console.error('Error creating record:', error);
          return NextResponse.json({ error: 'Failed to create record' }, { status: 500 });
        }

        finalRecordId = data.id;
      }

      // Handle warranty dashboard item
      if (warrantyEndDate && addWarrantyToDashboard && finalRecordId) {
        // Delete old dashboard item if exists
        if (oldWarrantyDashboardItemId) {
          await supabaseServer
            .from('dashboard_items')
            .delete()
            .eq('id', oldWarrantyDashboardItemId);
        }

        // Create new dashboard item
        const dashboardItem = await createDashboardItem(user.id, toolId, {
          title: `Warranty Expires: ${itemName}`,
          description: `Warranty for ${itemName} expires on ${new Date(warrantyEndDate).toLocaleDateString()}.${serviceProvider ? ` Service Provider: ${serviceProvider}` : ''}`,
          type: 'calendar_event',
          scheduled_date: warrantyEndDate,
          metadata: {
            recordId: finalRecordId,
            itemName: itemName,
            serviceProvider: serviceProvider || null,
            headerId: headerId
          }
        });

        if (dashboardItem) {
          await supabaseServer
            .from('tools_rh_records')
            .update({ warranty_dashboard_item_id: dashboardItem.id })
            .eq('id', finalRecordId);
        }
      } else if (oldWarrantyDashboardItemId) {
        // Delete dashboard item if warranty is removed or checkbox unchecked
        await supabaseServer
          .from('dashboard_items')
          .delete()
          .eq('id', oldWarrantyDashboardItemId);
        
        await supabaseServer
          .from('tools_rh_records')
          .update({ warranty_dashboard_item_id: null })
          .eq('id', finalRecordId);
      }

      // Handle repair pictures upload
      if (repairPictures && repairPictures.length > 0 && finalRecordId) {
        // Delete existing pictures if updating
        if (action === 'update') {
          await supabaseServer
            .from('tools_rh_repair_pictures')
            .delete()
            .eq('record_id', finalRecordId);
        }

        // Upload new pictures
        for (let i = 0; i < repairPictures.length; i++) {
          const picture = repairPictures[i];
          if (picture && picture.size > 0) {
            const uploadResult = await uploadFile(picture, user.id, 'repair-history', 'pictures');
            if (uploadResult) {
              await supabaseServer
                .from('tools_rh_repair_pictures')
                .insert({
                  record_id: finalRecordId,
                  file_url: uploadResult.url,
                  file_name: uploadResult.fileName,
                  file_size: uploadResult.fileSize,
                  file_type: uploadResult.fileType,
                  display_order: i
                });
            }
          }
        }
      }

      return NextResponse.json({ success: true, recordId: finalRecordId });
    }

    // Handle item operations
    if (resource === 'item') {
      const itemId = formData.get('itemId') as string | null;
      const categoryType = formData.get('categoryType') as 'Home' | 'Auto';
      const name = formData.get('name') as string;
      const area = formData.get('area') as string;

      if (action === 'delete' && itemId) {
        const { error } = await supabaseServer
          .from('tools_rh_items')
          .delete()
          .eq('id', itemId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .eq('is_default', false); // Only allow deletion of user-created items

        if (error) {
          console.error('Error deleting item:', error);
          return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      if (action === 'update' && itemId) {
        const { data, error } = await supabaseServer
          .from('tools_rh_items')
          .update({
            name: name.trim(),
            area: area.trim(),
            category_type: categoryType
          })
          .eq('id', itemId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .eq('is_default', false) // Only allow updating user-created items
          .select()
          .single();

        if (error) {
          console.error('Error updating item:', error);
          return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
        }

        return NextResponse.json({ success: true, item: data });
      }

      if (action === 'create') {
        const { data, error } = await supabaseServer
          .from('tools_rh_items')
          .insert({
            user_id: user.id,
            tool_id: toolId,
            category_type: categoryType,
            name: name.trim(),
            area: area.trim(),
            is_default: false
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating item:', error);
          return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
        }

        return NextResponse.json({ success: true, item: data });
      }
    }

    return NextResponse.json({ error: 'Invalid resource or action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in POST /api/tools/repair-history:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

// DELETE - Delete headers, records, or items
export async function DELETE(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');
    const resource = searchParams.get('resource'); // 'header', 'record', 'item'
    const id = searchParams.get('id');

    if (!toolId || !resource || !id) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (resource === 'header') {
      const { error } = await supabaseServer
        .from('tools_rh_headers')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error deleting header:', error);
        return NextResponse.json({ error: 'Failed to delete header' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (resource === 'record') {
      // Get record to check for warranty dashboard item
      const { data: record } = await supabaseServer
        .from('tools_rh_records')
        .select('warranty_dashboard_item_id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      // Delete warranty dashboard item if exists
      if (record?.warranty_dashboard_item_id) {
        await supabaseServer
          .from('dashboard_items')
          .delete()
          .eq('id', record.warranty_dashboard_item_id);
      }

      const { error } = await supabaseServer
        .from('tools_rh_records')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting record:', error);
        return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (resource === 'item') {
      const { error } = await supabaseServer
        .from('tools_rh_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .eq('is_default', false); // Only allow deletion of user-created items

      if (error) {
        console.error('Error deleting item:', error);
        return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in DELETE /api/tools/repair-history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
