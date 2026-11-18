import { denyLockedToolAccess, denyRemovedTool } from '@/lib/billing-access';
import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import bcrypt from 'bcryptjs';
import { adjustUserStorageUsage, assertCanStoreBytes, isStorageLimitError, removeStoredObjects } from '@/lib/user-storage';
import { findOwnedRow, requireOwnedIds } from '@/lib/owned-record';
import { withoutSecrets } from '@/lib/protected-content';
import { objectPathForOwner } from '@/lib/storage-owner';
import { placeAttachmentFile, readAttachmentRequest } from '@/lib/stored-file-transfer';
import { clearSecretAttempts, registerSecretFailure, rejectLockedSecret } from '@/lib/secret-attempt-lock';

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const SALT_ROUNDS = 10; // For password hashing
const DOCUMENT_BUCKET = 'important-documents';

function publicFileFields(fileUrl: string | null | undefined) {
  const hasFile = Boolean(fileUrl);
  return {
    has_file: hasFile,
    file_group: hasFile && fileUrl ? createHash('sha256').update(fileUrl).digest('hex').slice(0, 16) : null,
  };
}

function withoutStorageUrl<T extends { file_url?: string | null }>(doc: T) {
  const { file_url, ...rest } = doc;
  return { ...withoutSecrets(rest), ...publicFileFields(file_url) };
}

function extractStoragePath(fileUrl: string | null | undefined, ownerId: string): string | null {
  return objectPathForOwner(fileUrl, DOCUMENT_BUCKET, ownerId);
}

async function removeStoredDocumentFile(fileUrl: string | null | undefined, userId: string): Promise<void> {
  const path = extractStoragePath(fileUrl, userId);
  if (!path) return;
  await removeStoredObjects(userId, DOCUMENT_BUCKET, [path]);
}

// GET - Fetch all documents and tags for the current user
export async function GET(request: NextRequest) {
  const user = await getHouseholdDataSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const toolLock = await denyLockedToolAccess(user.id, user.householdRole);
  if (toolLock) return toolLock;
  const removedTool = await denyRemovedTool(user.id, 'Important Documents');
  if (removedTool) return removedTool;

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
          ...withoutStorageUrl(document),
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

    // A document owns a file only when a stored URL is present. A leftover filename
    // without that URL is not an attachment.
    const documentsWithTags = documents?.map(doc => {
      const publicDoc = withoutStorageUrl(doc);
      return {
        ...publicDoc,
        file_name: doc.file_url ? doc.file_name : null,
        file_size: doc.file_url ? doc.file_size : null,
        file_type: doc.file_url ? doc.file_type : null,
        tags: documentTagsMap[doc.id] || [],
      };
    }) || [];

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
  const user = await getHouseholdDataSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const toolLock = await denyLockedToolAccess(user.id, user.householdRole);
  if (toolLock) return toolLock;
  const removedTool = await denyRemovedTool(user.id, 'Important Documents');
  if (removedTool) return removedTool;

  try {
    const incoming = await readAttachmentRequest(request);
    if (incoming instanceof NextResponse) return incoming;
    const toolId = incoming.get('toolId');
    const documentId = incoming.get('documentId');
    const action = incoming.get('action'); // 'create', 'update', 'inactivate', 'activate', 'delete'

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

    if ((action === 'replaceFile' || action === 'removeFile') && documentId) {
      const { data: existing, error: existingError } = await supabaseServer
        .from('tools_id_documents')
        .select('id, file_url, file_size, requires_password_for_download, download_password_hash, is_active')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .single();

      if (existingError || !existing) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }

      if (existing.is_active === false) {
        return NextResponse.json({ error: 'Restore this document to add or change files.' }, { status: 403 });
      }

      if (existing.requires_password_for_download) {
        const attempt = { ownerId: user.id, kind: 'document' as const, recordId: documentId };
        const locked = await rejectLockedSecret(attempt);
        if (locked) return locked;
        const password = incoming.get('password');
        if (!password) {
          return NextResponse.json({ error: 'Password required' }, { status: 403 });
        }
        if (!existing.download_password_hash) {
          return NextResponse.json({ error: 'Password not set for this document' }, { status: 500 });
        }
        const isValid = await bcrypt.compare(password, existing.download_password_hash);
        if (!isValid) {
          return registerSecretFailure(
            attempt,
            NextResponse.json({ error: 'Incorrect password' }, { status: 403 })
          );
        }
        await clearSecretAttempts(attempt);
      }

      if (action === 'removeFile') {
        const { error } = await supabaseServer
          .from('tools_id_documents')
          .update({
            file_url: null,
            file_name: null,
            file_size: null,
            file_type: null,
          })
          .eq('id', documentId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId);

        if (error) {
          console.error('Error removing document file:', error);
          return NextResponse.json({ error: 'Failed to remove file' }, { status: 500 });
        }

        await removeStoredDocumentFile(existing.file_url, user.id);
        return NextResponse.json({ success: true });
      }

      const file = incoming.fileMetadata();
      if (!file || file.size <= 0) {
        return NextResponse.json({ error: 'A file is required' }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File size cannot exceed ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 400 });
      }

      try {
        await assertCanStoreBytes(user.id, Math.max(0, file.size - (existing.file_size || 0)));
      } catch (error) {
        if (isStorageLimitError(error)) {
          return NextResponse.json({ error: error.message, code: error.code }, { status: 413 });
        }
        throw error;
      }

      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      let storageFileName = `${user.id}/${Date.now()}-${sanitizedFileName}`;
      if (!objectPathForOwner(storageFileName, DOCUMENT_BUCKET, user.id)) {
        return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
      }
      const placed = await placeAttachmentFile({
        bucket: DOCUMENT_BUCKET,
        ownerId: user.id,
        storagePath: storageFileName,
        upload: incoming,
      });
      if (placed instanceof NextResponse) return placed;
      storageFileName = placed.path;
      const { error: updateError } = await supabaseServer
        .from('tools_id_documents')
        .update({
          file_url: placed.path,
          file_name: placed.fileName,
          file_size: placed.fileSize,
          file_type: placed.fileType,
        })
        .eq('id', documentId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (updateError) {
        await supabaseServer.storage.from(DOCUMENT_BUCKET).remove([storageFileName]);
        return NextResponse.json({ error: 'Failed to update document file' }, { status: 500 });
      }

      const oldPath = extractStoragePath(existing.file_url, user.id);
      if (oldPath) {
        await removeStoredObjects(user.id, DOCUMENT_BUCKET, [oldPath]);
      }
      await adjustUserStorageUsage(user.id, placed.fileSize);
      return NextResponse.json({ success: true });
    }

    // Handle create or update
    const documentName = incoming.get('documentName');
    const uploadedDate = incoming.get('uploadedDate');
    const effectiveDate = incoming.get('effectiveDate');
    const note = incoming.get('note');
    const requiresPasswordForDownload = incoming.get('requiresPasswordForDownload') === 'true';
    const downloadPassword = incoming.get('downloadPassword', { trim: false });
    const selectedTags = JSON.parse(incoming.get('selectedTags') || '[]') as string[];
    const securityQuestions = JSON.parse(incoming.get('securityQuestions') || '[]') as Array<{ questionId: string; answer: string }>;

    // Validation
    if (!documentName || !uploadedDate) {
      return NextResponse.json({ error: 'Document name and uploaded date are required' }, { status: 400 });
    }

    if (selectedTags.length === 0) {
      return NextResponse.json({ error: 'At least one tag is required' }, { status: 400 });
    }
    if (documentId && action !== 'create') {
      const ownedDocument = await findOwnedRow('tools_id_documents', documentId, user.id, { toolId, columns: 'id' });
      if (!ownedDocument) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    if (!(await requireOwnedIds('tools_id_tags', selectedTags, user.id, { toolId }))) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    if (requiresPasswordForDownload && action === 'create') {
      if (securityQuestions.length !== 3) {
        return NextResponse.json(
          { error: 'Exactly 3 security questions are required when password protection is enabled' },
          { status: 400 }
        );
      }
      const questionIds = securityQuestions.map(sq => sq.questionId);
      if (new Set(questionIds).size !== questionIds.length) {
        return NextResponse.json(
          { error: 'Security questions must be unique' },
          { status: 400 }
        );
      }
      if (securityQuestions.some(sq => !sq.questionId || !sq.answer.trim())) {
        return NextResponse.json(
          { error: 'All security questions must have answers' },
          { status: 400 }
        );
      }
    }

    // Handle file upload
    const file = incoming.fileMetadata();
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;
    let fileType: string | null = null;
    let uploadedPath: string | null = null;

    if (file && file.size > 0) {
      // Server-side file size validation
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File size cannot exceed ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 400 }
        );
      }

      try {
        await assertCanStoreBytes(user.id, file.size);
      } catch (error) {
        if (isStorageLimitError(error)) {
          return NextResponse.json({ error: error.message, code: error.code }, { status: 413 });
        }
        throw error;
      }

      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storageFileName = `${user.id}/${Date.now()}-${sanitizedFileName}`;
      if (!objectPathForOwner(storageFileName, DOCUMENT_BUCKET, user.id)) {
        return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
      }
      const placed = await placeAttachmentFile({
        bucket: DOCUMENT_BUCKET,
        ownerId: user.id,
        storagePath: storageFileName,
        upload: incoming,
      });
      if (placed instanceof NextResponse) return placed;
      uploadedPath = placed.path;
      fileUrl = placed.path;
      fileName = placed.fileName;
      fileSize = placed.fileSize;
      fileType = placed.fileType;
    }

    // Hash password if provided
    let downloadPasswordHash: string | null = null;
    if (requiresPasswordForDownload && downloadPassword) {
      downloadPasswordHash = await bcrypt.hash(downloadPassword, SALT_ROUNDS);
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
        if (uploadedPath) {
          await supabaseServer.storage.from(DOCUMENT_BUCKET).remove([uploadedPath]);
        }
        return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
      }

      if (uploadedPath && fileSize) {
        await adjustUserStorageUsage(user.id, fileSize);
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

      return NextResponse.json({ document: { ...withoutStorageUrl(newDocument), tags: selectedTags } });
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
        if (uploadedPath) {
          await supabaseServer.storage.from(DOCUMENT_BUCKET).remove([uploadedPath]);
        }
        return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
      }

      if (uploadedPath && fileSize) {
        await adjustUserStorageUsage(user.id, fileSize);
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

      return NextResponse.json({ document: { ...withoutStorageUrl(updatedDocument), tags: selectedTags } });
    }
  } catch (error: any) {
    console.error('Error in POST /api/tools/important-documents:', error);
    if (isStorageLimitError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 413 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a document
export async function DELETE(request: NextRequest) {
  const user = await getHouseholdDataSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const toolLock = await denyLockedToolAccess(user.id, user.householdRole);
  if (toolLock) return toolLock;
  const removedTool = await denyRemovedTool(user.id, 'Important Documents');
  if (removedTool) return removedTool;

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
