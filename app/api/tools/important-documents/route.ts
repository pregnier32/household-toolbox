import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import bcrypt from 'bcryptjs';

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const SALT_ROUNDS = 10; // For password hashing

// GET - Fetch all documents and tags for the current user
export async function GET(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');
    const documentId = searchParams.get('documentId');

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    if (documentId) {
      // Fetch single document with tags and security questions
      const { data: document, error: docError } = await supabaseServer
        .from('tools_id_documents')
        .select('*')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .single();

      if (docError || !document) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }

      // Fetch tags for this document
      const { data: documentTags } = await supabaseServer
        .from('tools_id_document_tags')
        .select('tag_id')
        .eq('document_id', documentId);

      const tagIds = documentTags?.map(dt => dt.tag_id) || [];

      // Fetch security questions (without answer hashes for security)
      const { data: securityQuestions } = await supabaseServer
        .from('tools_id_security_questions')
        .select('question_id')
        .eq('document_id', documentId);

      return NextResponse.json({
        document: {
          ...document,
          tags: tagIds,
          securityQuestions: securityQuestions?.map(sq => ({ questionId: sq.question_id })) || []
        }
      });
    }

    // Fetch all documents for the user
    const { data: documents, error: documentsError } = await supabaseServer
      .from('tools_id_documents')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('date_added', { ascending: false });

    if (documentsError) {
      console.error('Error fetching documents:', documentsError);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    // Fetch all tags for the user
    const { data: tags, error: tagsError } = await supabaseServer
      .from('tools_id_tags')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('name', { ascending: true });

    if (tagsError) {
      console.error('Error fetching tags:', tagsError);
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }

    // Fetch document tags relationships
    const documentIds = documents?.map(doc => doc.id) || [];
    let documentTagsMap: Record<string, string[]> = {};
    
    if (documentIds.length > 0) {
      const { data: documentTags } = await supabaseServer
        .from('tools_id_document_tags')
        .select('document_id, tag_id')
        .in('document_id', documentIds);

      documentTags?.forEach(dt => {
        if (!documentTagsMap[dt.document_id]) {
          documentTagsMap[dt.document_id] = [];
        }
        documentTagsMap[dt.document_id].push(dt.tag_id);
      });
    }

    // Transform documents to include tags
    const documentsWithTags = documents?.map(doc => ({
      ...doc,
      tags: documentTagsMap[doc.id] || []
    })) || [];

    return NextResponse.json({
      documents: documentsWithTags,
      tags: tags || []
    });
  } catch (error: any) {
    console.error('Error in GET /api/tools/important-documents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create or update a document
export async function POST(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const toolId = formData.get('toolId') as string;
    const documentId = formData.get('documentId') as string | null;
    const action = formData.get('action') as string; // 'create', 'update', 'inactivate', 'activate', 'delete'

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    // Handle delete action
    if (action === 'delete' && documentId) {
      const { error } = await supabaseServer
        .from('tools_id_documents')
        .delete()
        .eq('id', documentId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error deleting document:', error);
        return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Handle inactivate action
    if (action === 'inactivate' && documentId) {
      const { error } = await supabaseServer
        .from('tools_id_documents')
        .update({
          is_active: false,
          date_inactivated: new Date().toISOString().split('T')[0]
        })
        .eq('id', documentId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error inactivating document:', error);
        return NextResponse.json({ error: 'Failed to inactivate document' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Handle activate action
    if (action === 'activate' && documentId) {
      const { error } = await supabaseServer
        .from('tools_id_documents')
        .update({
          is_active: true,
          date_inactivated: null
        })
        .eq('id', documentId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error activating document:', error);
        return NextResponse.json({ error: 'Failed to activate document' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Handle create or update
    const documentName = formData.get('documentName') as string;
    const uploadedDate = formData.get('uploadedDate') as string;
    const effectiveDate = formData.get('effectiveDate') as string | null;
    const note = formData.get('note') as string | null;
    const requiresPasswordForDownload = formData.get('requiresPasswordForDownload') === 'true';
    const downloadPassword = formData.get('downloadPassword') as string | null;
    const selectedTags = JSON.parse(formData.get('selectedTags') as string || '[]') as string[];
    const securityQuestions = JSON.parse(formData.get('securityQuestions') as string || '[]') as Array<{ questionId: string; answer: string }>;

    // Validation
    if (!documentName || !uploadedDate) {
      return NextResponse.json({ error: 'Document name and uploaded date are required' }, { status: 400 });
    }

    if (selectedTags.length === 0) {
      return NextResponse.json({ error: 'At least one tag is required' }, { status: 400 });
    }

    // Handle file upload
    const file = formData.get('file') as File | null;
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;
    let fileType: string | null = null;

    if (file && file.size > 0) {
      // Server-side file size validation
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File size cannot exceed ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 400 }
        );
      }

      // Upload file to Supabase Storage
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storageFileName = `${user.id}/${Date.now()}-${sanitizedFileName}`;
      
      // Convert File to ArrayBuffer for Supabase Storage
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const { data: uploadData, error: uploadError } = await supabaseServer
        .storage
        .from('important-documents')
        .upload(storageFileName, buffer, {
          contentType: file.type,
          upsert: false
        });
      
      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 });
      }
      
      // Get public URL for the uploaded file (or signed URL if bucket is private)
      // For private buckets, we'll use getPublicUrl which works if RLS policies allow
      // If that doesn't work, we may need to generate signed URLs
      const { data: urlData } = supabaseServer
        .storage
        .from('important-documents')
        .getPublicUrl(storageFileName);
      
      fileUrl = urlData.publicUrl;
      fileName = file.name;
      fileSize = file.size;
      fileType = file.type;
    }

    // Hash password if provided
    let downloadPasswordHash: string | null = null;
    if (requiresPasswordForDownload && downloadPassword) {
      downloadPasswordHash = await bcrypt.hash(downloadPassword, SALT_ROUNDS);
    }

    // Validate security questions if password protection is enabled
    if (requiresPasswordForDownload && action === 'create') {
      if (securityQuestions.length !== 3) {
        return NextResponse.json(
          { error: 'Exactly 3 security questions are required when password protection is enabled' },
          { status: 400 }
        );
      }

      // Check for duplicate questions
      const questionIds = securityQuestions.map(sq => sq.questionId);
      if (new Set(questionIds).size !== questionIds.length) {
        return NextResponse.json(
          { error: 'Security questions must be unique' },
          { status: 400 }
        );
      }

      // Validate all questions have answers
      if (securityQuestions.some(sq => !sq.questionId || !sq.answer.trim())) {
        return NextResponse.json(
          { error: 'All security questions must have answers' },
          { status: 400 }
        );
      }
    }

    if (action === 'create' || !documentId) {
      // Create new document
      const { data: newDocument, error: docError } = await supabaseServer
        .from('tools_id_documents')
        .insert({
          user_id: user.id,
          tool_id: toolId,
          document_name: documentName.trim(),
          uploaded_date: uploadedDate,
          effective_date: effectiveDate || null,
          note: note?.trim() || null,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
          file_type: fileType,
          requires_password_for_download: requiresPasswordForDownload,
          download_password_hash: downloadPasswordHash,
          is_active: true
        })
        .select()
        .single();

      if (docError) {
        console.error('Error creating document:', docError);
        return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
      }

      // Create document-tag relationships
      if (selectedTags.length > 0) {
        const documentTagInserts = selectedTags.map(tagId => ({
          document_id: newDocument.id,
          tag_id: tagId
        }));

        const { error: tagError } = await supabaseServer
          .from('tools_id_document_tags')
          .insert(documentTagInserts);

        if (tagError) {
          console.error('Error creating document tags:', tagError);
          // Continue even if tag creation fails - document is already created
        }
      }

      // Create security questions if password protection is enabled
      if (requiresPasswordForDownload && securityQuestions.length === 3) {
        const securityQuestionInserts = await Promise.all(
          securityQuestions.map(async (sq) => ({
            document_id: newDocument.id,
            question_id: sq.questionId,
            answer_hash: await bcrypt.hash(sq.answer.trim().toLowerCase(), SALT_ROUNDS)
          }))
        );

        const { error: sqError } = await supabaseServer
          .from('tools_id_security_questions')
          .insert(securityQuestionInserts);

        if (sqError) {
          console.error('Error creating security questions:', sqError);
          // Continue even if security question creation fails
        }
      }

      return NextResponse.json({ document: newDocument });
    } else {
      // Update existing document
      const updateData: any = {
        document_name: documentName.trim(),
        uploaded_date: uploadedDate,
        effective_date: effectiveDate || null,
        note: note?.trim() || null,
        requires_password_for_download: requiresPasswordForDownload
      };

      // Only update file if a new file was uploaded
      if (file && file.size > 0) {
        updateData.file_url = fileUrl;
        updateData.file_name = fileName;
        updateData.file_size = fileSize;
        updateData.file_type = fileType;
      }

      // Update password if provided
      if (requiresPasswordForDownload && downloadPassword) {
        updateData.download_password_hash = await bcrypt.hash(downloadPassword, SALT_ROUNDS);
      } else if (!requiresPasswordForDownload) {
        updateData.download_password_hash = null;
      }

      const { data: updatedDocument, error: updateError } = await supabaseServer
        .from('tools_id_documents')
        .update(updateData)
        .eq('id', documentId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating document:', updateError);
        return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
      }

      // Update tags - delete old ones and insert new ones
      await supabaseServer
        .from('tools_id_document_tags')
        .delete()
        .eq('document_id', documentId);

      if (selectedTags.length > 0) {
        const documentTagInserts = selectedTags.map(tagId => ({
          document_id: documentId,
          tag_id: tagId
        }));

        await supabaseServer
          .from('tools_id_document_tags')
          .insert(documentTagInserts);
      }

      // Update security questions if password is being changed
      if (requiresPasswordForDownload && downloadPassword && securityQuestions.length === 3) {
        // Delete old security questions
        await supabaseServer
          .from('tools_id_security_questions')
          .delete()
          .eq('document_id', documentId);

        // Insert new ones
        const securityQuestionInserts = await Promise.all(
          securityQuestions.map(async (sq) => ({
            document_id: documentId,
            question_id: sq.questionId,
            answer_hash: await bcrypt.hash(sq.answer.trim().toLowerCase(), SALT_ROUNDS)
          }))
        );

        await supabaseServer
          .from('tools_id_security_questions')
          .insert(securityQuestionInserts);
      }

      return NextResponse.json({ document: updatedDocument });
    }
  } catch (error: any) {
    console.error('Error in POST /api/tools/important-documents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a document
export async function DELETE(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const toolId = searchParams.get('toolId');

    if (!documentId || !toolId) {
      return NextResponse.json({ error: 'Document ID and Tool ID are required' }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from('tools_id_documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', user.id)
      .eq('tool_id', toolId);

    if (error) {
      console.error('Error deleting document:', error);
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/tools/important-documents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
