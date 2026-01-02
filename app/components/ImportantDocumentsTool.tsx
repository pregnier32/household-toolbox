'use client';

import { useState, useEffect } from 'react';

type DocumentTag = {
  id: string;
  name: string;
  isActive: boolean;
  dateAdded: string;
  dateInactivated?: string;
};

type SecurityQuestion = {
  questionId: string;
  answer: string;
};

type Document = {
  id: string;
  documentName: string;
  uploadedDate: string;
  effectiveDate: string | null;
  note: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  tags: string[]; // Array of tag IDs
  isActive: boolean;
  dateAdded: string;
  dateInactivated?: string;
  requiresPasswordForDownload: boolean;
  downloadPassword: string | null;
  securityQuestions: SecurityQuestion[] | null;
};

const DEFAULT_TAGS = [
  'Receipts',
  'Warranties',
  'Insurance',
  'Legal',
  'Medical',
  'Home',
  'Vehicle',
  'Taxes',
  'Kids',
  '2026'
];

// Security questions
const SECURITY_QUESTIONS = [
  { id: 'q1', question: 'What city were you born in?' },
  { id: 'q2', question: 'What is the name of your first pet?' },
  { id: 'q3', question: 'What was the name of your elementary school?' },
  { id: 'q4', question: 'What is your mother\'s maiden name?' },
  { id: 'q5', question: 'What was the make of your first car?' },
  { id: 'q6', question: 'What street did you live on as a child?' },
  { id: 'q7', question: 'What is the name of your childhood best friend?' },
  { id: 'q8', question: 'What was your childhood nickname?' },
  { id: 'q9', question: 'What city did your parents meet in?' },
  { id: 'q10', question: 'What was your favorite teacher\'s last name?' },
  { id: 'q11', question: 'What is your favorite movie?' },
  { id: 'q12', question: 'What is your favorite book?' },
  { id: 'q13', question: 'What is your favorite food?' },
  { id: 'q14', question: 'What is your favorite sports team?' },
  { id: 'q15', question: 'What is your favorite vacation destination?' },
  { id: 'q16', question: 'What year did you graduate high school?' },
  { id: 'q17', question: 'What was the name of your first employer?' },
  { id: 'q18', question: 'What was the name of your first apartment complex?' },
  { id: 'q19', question: 'What was the model of your first phone?' },
  { id: 'q20', question: 'What was the name of your favorite childhood toy?' }
];

type ImportantDocumentsToolProps = {
  toolId?: string;
};

export function ImportantDocumentsTool({ toolId }: ImportantDocumentsToolProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tags, setTags] = useState<DocumentTag[]>([]);
  const [activeTab, setActiveTab] = useState<'documents' | 'tags'>('documents');
  const [isLoading, setIsLoading] = useState(false);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  
  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [newDocument, setNewDocument] = useState({
    documentName: '',
    uploadedDate: new Date().toISOString().split('T')[0],
    effectiveDate: '',
    note: '',
    file: null as File | null,
    selectedTags: [] as string[],
    requiresPasswordForDownload: false,
    downloadPassword: '',
    confirmPassword: '',
    securityQuestions: [
      { questionId: '', answer: '' },
      { questionId: '', answer: '' },
      { questionId: '', answer: '' }
    ] as SecurityQuestion[]
  });
  
  // Password visibility state
  const [showPassword, setShowPassword] = useState({
    new: false,
    newConfirm: false,
    edit: false,
    editConfirm: false
  });
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState({
    documentName: '',
    uploadedDate: '',
    effectiveDate: '',
    note: '',
    file: null as File | null,
    selectedTags: [] as string[],
    requiresPasswordForDownload: false,
    downloadPassword: '',
    confirmPassword: ''
  });
  
  // Tag management state
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  
  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteTagConfirmId, setDeleteTagConfirmId] = useState<string | null>(null);
  const [deleteTagConfirmText, setDeleteTagConfirmText] = useState('');
  const [downloadPasswordModalId, setDownloadPasswordModalId] = useState<string | null>(null);
  const [downloadPasswordInput, setDownloadPasswordInput] = useState('');
  const [showDownloadPassword, setShowDownloadPassword] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [securityQuestions, setSecurityQuestions] = useState<Array<{ questionId: string; question: string }>>([]);
  const [securityAnswers, setSecurityAnswers] = useState<Array<{ questionId: string; answer: string }>>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordResetStep, setPasswordResetStep] = useState<'questions' | 'reset'>('questions');

  // Load documents and tags from API
  useEffect(() => {
    const loadData = async () => {
      if (!toolId) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/tools/important-documents?toolId=${toolId}`);
        if (response.ok) {
          const data = await response.json();
          
          // Transform database format to component format
          const transformedDocuments: Document[] = (data.documents || []).map((doc: any) => ({
            id: doc.id,
            documentName: doc.document_name,
            uploadedDate: doc.uploaded_date,
            effectiveDate: doc.effective_date,
            note: doc.note,
            fileUrl: doc.file_url,
            fileName: doc.file_name,
            fileSize: doc.file_size,
            fileType: doc.file_type,
            tags: doc.tags || [],
            isActive: doc.is_active !== false,
            dateAdded: doc.date_added,
            dateInactivated: doc.date_inactivated,
            requiresPasswordForDownload: doc.requires_password_for_download || false,
            downloadPassword: null, // Never expose password hash
            securityQuestions: null // Security questions are not returned for security
          }));
          
          setDocuments(transformedDocuments);
          
          // Load tags separately
          const tagsResponse = await fetch(`/api/tools/important-documents/tags?toolId=${toolId}`);
          if (tagsResponse.ok) {
            const tagsData = await tagsResponse.json();
            const transformedTags: DocumentTag[] = (tagsData.tags || []).map((tag: any) => ({
              id: tag.id,
              name: tag.name,
              isActive: tag.is_active !== false,
              dateAdded: tag.date_added,
              dateInactivated: tag.date_inactivated
            }));
            
            // If no tags exist, initialize with default tags
            if (transformedTags.length === 0) {
              // Create default tags
              const defaultTagsPromises = DEFAULT_TAGS.map(tagName =>
                fetch('/api/tools/important-documents/tags', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    toolId,
                    name: tagName
                  }),
                })
              );
              
              await Promise.all(defaultTagsPromises);
              
              // Reload tags after creating defaults
              const reloadTagsResponse = await fetch(`/api/tools/important-documents/tags?toolId=${toolId}`);
              if (reloadTagsResponse.ok) {
                const reloadTagsData = await reloadTagsResponse.json();
                const reloadedTags: DocumentTag[] = (reloadTagsData.tags || []).map((tag: any) => ({
                  id: tag.id,
                  name: tag.name,
                  isActive: tag.is_active !== false,
                  dateAdded: tag.date_added,
                  dateInactivated: tag.date_inactivated
                }));
                setTags(reloadedTags);
              }
            } else {
              setTags(transformedTags);
            }
          }
        } else {
          console.error('Failed to load documents and tags');
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [toolId]);

  // Filter documents based on search and tag filter
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = searchQuery === '' || 
      doc.documentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.note && doc.note.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTag = selectedTagFilter === 'all' || 
      doc.tags.includes(selectedTagFilter);
    
    return matchesSearch && matchesTag;
  });

  const activeDocuments = filteredDocuments.filter(doc => doc.isActive).sort((a, b) => a.documentName.localeCompare(b.documentName));
  const inactiveDocuments = filteredDocuments.filter(doc => !doc.isActive);
  const activeTags = tags.filter(tag => tag.isActive).sort((a, b) => a.name.localeCompare(b.name));
  const inactiveTags = tags.filter(tag => !tag.isActive).sort((a, b) => a.name.localeCompare(b.name));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        alert('File size cannot exceed 10MB. Please choose a smaller file.');
        e.target.value = ''; // Reset input
        return;
      }
      
      if (isEdit) {
        setEditingDocument({ ...editingDocument, file });
      } else {
        setNewDocument({ ...newDocument, file });
      }
    }
  };

  const addDocument = async () => {
    if (!newDocument.documentName.trim() || !newDocument.uploadedDate) {
      alert('Please fill in all required fields.');
      return;
    }

    if (newDocument.selectedTags.length === 0) {
      alert('Please select at least one tag.');
      return;
    }

    if (!newDocument.file) {
      alert('Please upload a document file.');
      return;
    }

    if (newDocument.requiresPasswordForDownload) {
      if (!newDocument.downloadPassword.trim()) {
        alert('Please enter a password for download protection.');
        return;
      }
      if (newDocument.downloadPassword !== newDocument.confirmPassword) {
        alert('Passwords do not match. Please confirm your password.');
        return;
      }
      // Validate security questions
      const validQuestions = newDocument.securityQuestions.filter(q => q.questionId && q.answer.trim());
      if (validQuestions.length !== 3) {
        alert('Please select and answer 3 security questions for password recovery.');
        return;
      }
      // Check for duplicate questions
      const questionIds = validQuestions.map(q => q.questionId);
      if (new Set(questionIds).size !== questionIds.length) {
        alert('Please select 3 different security questions.');
        return;
      }
    }

    if (!toolId) {
      alert('Tool ID is required.');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('action', 'create');
      formData.append('documentName', newDocument.documentName.trim());
      formData.append('uploadedDate', newDocument.uploadedDate);
      formData.append('effectiveDate', newDocument.effectiveDate || '');
      formData.append('note', newDocument.note.trim() || '');
      formData.append('file', newDocument.file);
      formData.append('requiresPasswordForDownload', newDocument.requiresPasswordForDownload.toString());
      if (newDocument.requiresPasswordForDownload && newDocument.downloadPassword) {
        formData.append('downloadPassword', newDocument.downloadPassword.trim());
      }
      formData.append('selectedTags', JSON.stringify(newDocument.selectedTags));
      if (newDocument.requiresPasswordForDownload) {
        formData.append('securityQuestions', JSON.stringify(
          newDocument.securityQuestions.filter(q => q.questionId && q.answer.trim())
        ));
      }

      const response = await fetch('/api/tools/important-documents', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Reload documents from API
        const loadResponse = await fetch(`/api/tools/important-documents?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedDocuments: Document[] = (data.documents || []).map((doc: any) => ({
            id: doc.id,
            documentName: doc.document_name,
            uploadedDate: doc.uploaded_date,
            effectiveDate: doc.effective_date,
            note: doc.note,
            fileUrl: doc.file_url,
            fileName: doc.file_name,
            fileSize: doc.file_size,
            fileType: doc.file_type,
            tags: doc.tags || [],
            isActive: doc.is_active !== false,
            dateAdded: doc.date_added,
            dateInactivated: doc.date_inactivated,
            requiresPasswordForDownload: doc.requires_password_for_download || false,
            downloadPassword: null,
            securityQuestions: null
          }));
          setDocuments(transformedDocuments);
        }
        
        // Reset form
        setNewDocument({
          documentName: '',
          uploadedDate: new Date().toISOString().split('T')[0],
          effectiveDate: '',
          note: '',
          file: null,
          selectedTags: [],
          requiresPasswordForDownload: false,
          downloadPassword: '',
          confirmPassword: '',
          securityQuestions: [
            { questionId: '', answer: '' },
            { questionId: '', answer: '' },
            { questionId: '', answer: '' }
          ]
        });
        setShowPassword({ ...showPassword, new: false, newConfirm: false });
        setIsAdding(false);
      } else {
        const errorData = await response.json();
        console.error('Failed to add document:', errorData.error);
        alert('Failed to add document: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding document:', error);
      alert('Error adding document. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (document: Document) => {
    setEditingId(document.id);
    setEditingDocument({
      documentName: document.documentName,
      uploadedDate: document.uploadedDate,
      effectiveDate: document.effectiveDate || '',
      note: document.note || '',
      file: null,
      selectedTags: document.tags,
      requiresPasswordForDownload: document.requiresPasswordForDownload || false,
      downloadPassword: '', // Don't show existing password for security
      confirmPassword: ''
    });
    setShowPassword({ ...showPassword, edit: false, editConfirm: false });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingDocument({
      documentName: '',
      uploadedDate: '',
      effectiveDate: '',
      note: '',
      file: null,
      selectedTags: [],
      requiresPasswordForDownload: false,
      downloadPassword: '',
      confirmPassword: ''
    });
    setShowPassword({ ...showPassword, edit: false, editConfirm: false });
  };

  const saveEdit = async () => {
    if (!editingId || !editingDocument.documentName.trim() || !editingDocument.uploadedDate) {
      return;
    }

    if (editingDocument.selectedTags.length === 0) {
      alert('Please select at least one tag.');
      return;
    }

    const existingDoc = documents.find(doc => doc.id === editingId);
    if (editingDocument.requiresPasswordForDownload) {
      // If password protection is newly enabled or password is being changed
      if (editingDocument.downloadPassword.trim()) {
        if (editingDocument.downloadPassword !== editingDocument.confirmPassword) {
          alert('Passwords do not match. Please confirm your password.');
          return;
        }
      } else if (!existingDoc?.requiresPasswordForDownload || !existingDoc?.downloadPassword) {
        // Only require password if it's newly enabled
        alert('Please enter a password for download protection.');
        return;
      }
    }

    if (!toolId) {
      alert('Tool ID is required.');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('documentId', editingId);
      formData.append('action', 'update');
      formData.append('documentName', editingDocument.documentName.trim());
      formData.append('uploadedDate', editingDocument.uploadedDate);
      formData.append('effectiveDate', editingDocument.effectiveDate || '');
      formData.append('note', editingDocument.note.trim() || '');
      if (editingDocument.file) {
        formData.append('file', editingDocument.file);
      }
      formData.append('requiresPasswordForDownload', editingDocument.requiresPasswordForDownload.toString());
      if (editingDocument.requiresPasswordForDownload && editingDocument.downloadPassword.trim()) {
        formData.append('downloadPassword', editingDocument.downloadPassword.trim());
      }
      formData.append('selectedTags', JSON.stringify(editingDocument.selectedTags));
      // Note: Security questions are only set on create, not on update unless password is being changed

      const response = await fetch('/api/tools/important-documents', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Reload documents from API
        const loadResponse = await fetch(`/api/tools/important-documents?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedDocuments: Document[] = (data.documents || []).map((doc: any) => ({
            id: doc.id,
            documentName: doc.document_name,
            uploadedDate: doc.uploaded_date,
            effectiveDate: doc.effective_date,
            note: doc.note,
            fileUrl: doc.file_url,
            fileName: doc.file_name,
            fileSize: doc.file_size,
            fileType: doc.file_type,
            tags: doc.tags || [],
            isActive: doc.is_active !== false,
            dateAdded: doc.date_added,
            dateInactivated: doc.date_inactivated,
            requiresPasswordForDownload: doc.requires_password_for_download || false,
            downloadPassword: null,
            securityQuestions: null
          }));
          setDocuments(transformedDocuments);
        }
        cancelEditing();
      } else {
        const errorData = await response.json();
        console.error('Failed to update document:', errorData.error);
        alert('Failed to update document: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating document:', error);
      alert('Error updating document. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inactivateDocument = async (id: string) => {
    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('documentId', id);
      formData.append('action', 'inactivate');

      const response = await fetch('/api/tools/important-documents', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Reload documents from API
        const loadResponse = await fetch(`/api/tools/important-documents?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedDocuments: Document[] = (data.documents || []).map((doc: any) => ({
            id: doc.id,
            documentName: doc.document_name,
            uploadedDate: doc.uploaded_date,
            effectiveDate: doc.effective_date,
            note: doc.note,
            fileUrl: doc.file_url,
            fileName: doc.file_name,
            fileSize: doc.file_size,
            fileType: doc.file_type,
            tags: doc.tags || [],
            isActive: doc.is_active !== false,
            dateAdded: doc.date_added,
            dateInactivated: doc.date_inactivated,
            requiresPasswordForDownload: doc.requires_password_for_download || false,
            downloadPassword: null,
            securityQuestions: null
          }));
          setDocuments(transformedDocuments);
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to inactivate document:', errorData.error);
        alert('Failed to inactivate document: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error inactivating document:', error);
      alert('Error inactivating document. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const activateDocument = async (id: string) => {
    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('documentId', id);
      formData.append('action', 'activate');

      const response = await fetch('/api/tools/important-documents', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Reload documents from API
        const loadResponse = await fetch(`/api/tools/important-documents?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedDocuments: Document[] = (data.documents || []).map((doc: any) => ({
            id: doc.id,
            documentName: doc.document_name,
            uploadedDate: doc.uploaded_date,
            effectiveDate: doc.effective_date,
            note: doc.note,
            fileUrl: doc.file_url,
            fileName: doc.file_name,
            fileSize: doc.file_size,
            fileType: doc.file_type,
            tags: doc.tags || [],
            isActive: doc.is_active !== false,
            dateAdded: doc.date_added,
            dateInactivated: doc.date_inactivated,
            requiresPasswordForDownload: doc.requires_password_for_download || false,
            downloadPassword: null,
            securityQuestions: null
          }));
          setDocuments(transformedDocuments);
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to activate document:', errorData.error);
        alert('Failed to activate document: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error activating document:', error);
      alert('Error activating document. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDocument = async () => {
    if (!deleteConfirmId) return;

    if (deleteConfirmText.toLowerCase() !== 'delete') {
      return;
    }

    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/tools/important-documents?documentId=${deleteConfirmId}&toolId=${toolId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Reload documents from API
        const loadResponse = await fetch(`/api/tools/important-documents?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedDocuments: Document[] = (data.documents || []).map((doc: any) => ({
            id: doc.id,
            documentName: doc.document_name,
            uploadedDate: doc.uploaded_date,
            effectiveDate: doc.effective_date,
            note: doc.note,
            fileUrl: doc.file_url,
            fileName: doc.file_name,
            fileSize: doc.file_size,
            fileType: doc.file_type,
            tags: doc.tags || [],
            isActive: doc.is_active !== false,
            dateAdded: doc.date_added,
            dateInactivated: doc.date_inactivated,
            requiresPasswordForDownload: doc.requires_password_for_download || false,
            downloadPassword: null,
            securityQuestions: null
          }));
          setDocuments(transformedDocuments);
        }
        setDeleteConfirmId(null);
        setDeleteConfirmText('');
      } else {
        const errorData = await response.json();
        console.error('Failed to delete document:', errorData.error);
        alert('Failed to delete document: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Error deleting document. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const addTag = async () => {
    if (!newTagName.trim()) {
      alert('Please enter a tag name.');
      return;
    }

    if (!toolId) {
      alert('Tool ID is required.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/important-documents/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolId,
          name: newTagName.trim()
        }),
      });

      if (response.ok) {
        // Reload tags from API
        const loadResponse = await fetch(`/api/tools/important-documents/tags?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedTags: DocumentTag[] = (data.tags || []).map((tag: any) => ({
            id: tag.id,
            name: tag.name,
            isActive: tag.is_active !== false,
            dateAdded: tag.date_added,
            dateInactivated: tag.date_inactivated
          }));
          setTags(transformedTags);
        }
        setNewTagName('');
        setIsAddingTag(false);
      } else {
        const errorData = await response.json();
        console.error('Failed to add tag:', errorData.error);
        alert('Failed to add tag: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding tag:', error);
      alert('Error adding tag. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditingTag = (tag: DocumentTag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
  };

  const cancelEditingTag = () => {
    setEditingTagId(null);
    setEditingTagName('');
  };

  const saveTagEdit = async () => {
    if (!editingTagId || !editingTagName.trim()) {
      return;
    }

    if (!toolId) {
      alert('Tool ID is required.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/important-documents/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tagId: editingTagId,
          toolId,
          name: editingTagName.trim()
        }),
      });

      if (response.ok) {
        // Reload tags from API
        const loadResponse = await fetch(`/api/tools/important-documents/tags?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedTags: DocumentTag[] = (data.tags || []).map((tag: any) => ({
            id: tag.id,
            name: tag.name,
            isActive: tag.is_active !== false,
            dateAdded: tag.date_added,
            dateInactivated: tag.date_inactivated
          }));
          setTags(transformedTags);
        }
        cancelEditingTag();
      } else {
        const errorData = await response.json();
        console.error('Failed to update tag:', errorData.error);
        alert('Failed to update tag: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating tag:', error);
      alert('Error updating tag. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inactivateTag = async (id: string) => {
    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/important-documents/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tagId: id,
          toolId,
          action: 'inactivate'
        }),
      });

      if (response.ok) {
        // Reload tags from API
        const loadResponse = await fetch(`/api/tools/important-documents/tags?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedTags: DocumentTag[] = (data.tags || []).map((tag: any) => ({
            id: tag.id,
            name: tag.name,
            isActive: tag.is_active !== false,
            dateAdded: tag.date_added,
            dateInactivated: tag.date_inactivated
          }));
          setTags(transformedTags);
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to inactivate tag:', errorData.error);
        alert('Failed to inactivate tag: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error inactivating tag:', error);
      alert('Error inactivating tag. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const activateTag = async (id: string) => {
    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/important-documents/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tagId: id,
          toolId,
          action: 'activate'
        }),
      });

      if (response.ok) {
        // Reload tags from API
        const loadResponse = await fetch(`/api/tools/important-documents/tags?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedTags: DocumentTag[] = (data.tags || []).map((tag: any) => ({
            id: tag.id,
            name: tag.name,
            isActive: tag.is_active !== false,
            dateAdded: tag.date_added,
            dateInactivated: tag.date_inactivated
          }));
          setTags(transformedTags);
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to activate tag:', errorData.error);
        alert('Failed to activate tag: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error activating tag:', error);
      alert('Error activating tag. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTag = async () => {
    if (!deleteTagConfirmId) return;

    if (deleteTagConfirmText.toLowerCase() !== 'delete') {
      return;
    }

    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/tools/important-documents/tags?tagId=${deleteTagConfirmId}&toolId=${toolId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Reload tags from API
        const loadResponse = await fetch(`/api/tools/important-documents/tags?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedTags: DocumentTag[] = (data.tags || []).map((tag: any) => ({
            id: tag.id,
            name: tag.name,
            isActive: tag.is_active !== false,
            dateAdded: tag.date_added,
            dateInactivated: tag.date_inactivated
          }));
          setTags(transformedTags);
        }
        setDeleteTagConfirmId(null);
        setDeleteTagConfirmText('');
      } else {
        const errorData = await response.json();
        console.error('Failed to delete tag:', errorData.error);
        alert('Failed to delete tag: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
      alert('Error deleting tag. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTagSelection = (tagId: string, isEdit: boolean = false) => {
    if (isEdit) {
      const isSelected = editingDocument.selectedTags.includes(tagId);
      setEditingDocument({
        ...editingDocument,
        selectedTags: isSelected
          ? editingDocument.selectedTags.filter(id => id !== tagId)
          : [...editingDocument.selectedTags, tagId]
      });
    } else {
      const isSelected = newDocument.selectedTags.includes(tagId);
      setNewDocument({
        ...newDocument,
        selectedTags: isSelected
          ? newDocument.selectedTags.filter(id => id !== tagId)
          : [...newDocument.selectedTags, tagId]
      });
    }
  };

  const getTagName = (tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    return tag ? tag.name : 'Unknown';
  };

  const getTagUsageCount = (tagId: string) => {
    return documents.filter(doc => doc.tags.includes(tagId)).length;
  };

  const handleSecurityQuestionChange = (index: number, questionId: string) => {
    const updatedQuestions = [...newDocument.securityQuestions];
    updatedQuestions[index] = { ...updatedQuestions[index], questionId, answer: '' };
    setNewDocument({ ...newDocument, securityQuestions: updatedQuestions });
  };

  const handleSecurityAnswerChange = (index: number, answer: string) => {
    const updatedQuestions = [...newDocument.securityQuestions];
    updatedQuestions[index] = { ...updatedQuestions[index], answer };
    setNewDocument({ ...newDocument, securityQuestions: updatedQuestions });
  };

  const getAvailableQuestions = (currentIndex: number) => {
    const selectedQuestionIds = newDocument.securityQuestions
      .map((q, idx) => idx !== currentIndex ? q.questionId : '')
      .filter(id => id);
    return SECURITY_QUESTIONS.filter(q => !selectedQuestionIds.includes(q.id));
  };

  const handleDownload = async (doc: Document) => {
    if (!doc.fileUrl) {
      alert('No file available for download.');
      return;
    }

    if (doc.requiresPasswordForDownload) {
      // Show password modal
      setDownloadPasswordModalId(doc.id);
      setDownloadPasswordInput('');
      return;
    }

    // Download via API endpoint (handles authentication and private storage)
    try {
      const response = await fetch(`/api/tools/important-documents/download/${doc.id}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to download file' }));
        throw new Error(errorData.error || 'Failed to download file');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || 'document';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  const handleForgotPassword = async () => {
    if (!downloadPasswordModalId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/tools/important-documents/reset-password?documentId=${downloadPasswordModalId}`);
      if (!response.ok) {
        const errorData = await response.json();
        alert('Failed to load security questions: ' + (errorData.error || 'Unknown error'));
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      setSecurityQuestions(data.questions || []);
      setSecurityAnswers(data.questions?.map((q: { questionId: string }) => ({ questionId: q.questionId, answer: '' })) || []);
      setPasswordResetStep('questions');
    } catch (error) {
      console.error('Error loading security questions:', error);
      alert('Error loading security questions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySecurityAnswers = async () => {
    if (!downloadPasswordModalId) return;

    // Check all answers are filled
    if (securityAnswers.some(a => !a.answer.trim())) {
      alert('Please answer all security questions.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/important-documents/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: downloadPasswordModalId,
          answers: securityAnswers,
          newPassword: '' // Verify only - no password provided
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.verified) {
          // Answers verified - move to password reset step
          setPasswordResetStep('reset');
          setNewPassword('');
          setConfirmNewPassword('');
        }
      } else {
        const errorData = await response.json();
        alert('One or more answers are incorrect. Please try again.');
        setSecurityAnswers(securityAnswers.map(a => ({ ...a, answer: '' })));
      }
    } catch (error) {
      console.error('Error verifying answers:', error);
      alert('Error verifying answers. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!downloadPasswordModalId) return;

    if (!newPassword.trim()) {
      alert('Please enter a new password.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      alert('Passwords do not match. Please try again.');
      return;
    }

    if (newPassword.trim().length < 4) {
      alert('Password must be at least 4 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/important-documents/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: downloadPasswordModalId,
          answers: securityAnswers,
          newPassword: newPassword.trim()
        }),
      });

      if (response.ok) {
        alert('Password reset successfully! You can now download the document.');
        setShowForgotPasswordModal(false);
        setDownloadPasswordModalId(null);
        setDownloadPasswordInput('');
        setShowDownloadPassword(false);
        setSecurityQuestions([]);
        setSecurityAnswers([]);
        setNewPassword('');
        setConfirmNewPassword('');
        setPasswordResetStep('questions');
      } else {
        const errorData = await response.json();
        alert('Failed to reset password: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Error resetting password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDownloadWithPassword = async () => {
    if (!downloadPasswordModalId || !downloadPasswordInput.trim()) {
      return;
    }

    const doc = documents.find(d => d.id === downloadPasswordModalId);
    if (!doc || !doc.fileUrl) {
      alert('Document not found.');
      setDownloadPasswordModalId(null);
      setDownloadPasswordInput('');
      return;
    }

    setIsLoading(true);
    try {
      // Verify password with API
      const response = await fetch('/api/tools/important-documents/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: doc.id,
          password: downloadPasswordInput.trim()
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          // Password correct, download file via API endpoint with password
          const fileResponse = await fetch(`/api/tools/important-documents/download/${doc.id}?password=${encodeURIComponent(downloadPasswordInput.trim())}`);
          if (!fileResponse.ok) {
            const errorData = await fileResponse.json().catch(() => ({ error: 'Failed to download file' }));
            throw new Error(errorData.error || 'Failed to download file');
          }
          const blob = await fileResponse.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = doc.fileName || 'document';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          setDownloadPasswordModalId(null);
          setDownloadPasswordInput('');
          setShowDownloadPassword(false);
        } else {
          alert('Incorrect password. Please try again.');
          setDownloadPasswordInput('');
        }
      } else {
        const errorData = await response.json();
        alert('Failed to verify password: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      alert('Error verifying password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-50 mb-2">Important Documents</h2>
          <p className="text-slate-400 text-sm">
            Upload, tag, and manage your important documents
          </p>
        </div>
        {isLoading && (
          <div className="text-sm text-slate-400">
            Loading...
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-2">
          {[
            { id: 'documents', label: 'Documents' },
            { id: 'tags', label: 'Tags' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'documents' | 'tags')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-emerald-500 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Search and Filter */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Search Documents
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by document name or note..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Filter by Tag
                </label>
                <select
                  value={selectedTagFilter}
                  onChange={(e) => setSelectedTagFilter(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                >
                  <option value="all">All Tags</option>
                  {activeTags.map(tag => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Add New Document Form */}
          {!isAdding ? (
            <div className="flex justify-start">
              <button
                onClick={() => setIsAdding(true)}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                + Add New Document
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Add New Document</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Document Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newDocument.documentName}
                      onChange={(e) => setNewDocument({ ...newDocument, documentName: e.target.value })}
                      placeholder="e.g., Home Insurance Policy 2024"
                      className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Uploaded Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={newDocument.uploadedDate}
                      onChange={(e) => setNewDocument({ ...newDocument, uploadedDate: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Effective Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={newDocument.effectiveDate}
                      onChange={(e) => setNewDocument({ ...newDocument, effectiveDate: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      File Upload <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="file"
                      onChange={(e) => handleFileChange(e, false)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-500 file:text-slate-950 hover:file:bg-emerald-400"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Maximum file size: 10MB
                    </p>
                    {newDocument.file && (
                      <p className="text-xs text-slate-300 mt-1">
                        Selected: {newDocument.file.name} ({(newDocument.file.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Tags <span className="text-red-400">*</span> (Select one or more)
                  </label>
                  <div className="flex flex-wrap gap-2 p-4 rounded-lg border border-slate-700 bg-slate-900/70 min-h-[60px]">
                    {activeTags.length > 0 ? (
                      activeTags.map(tag => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTagSelection(tag.id, false)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            newDocument.selectedTags.includes(tag.id)
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {tag.name}
                        </button>
                      ))
                    ) : (
                      <p className="text-slate-400 text-sm">No active tags available. Add tags in the Tags tab.</p>
                    )}
                  </div>
                  {newDocument.selectedTags.length > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      Selected: {newDocument.selectedTags.map(id => getTagName(id)).join(', ')}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Note (Optional)
                  </label>
                  <textarea
                    value={newDocument.note}
                    onChange={(e) => setNewDocument({ ...newDocument, note: e.target.value })}
                    placeholder="Add any additional notes..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      id="requiresPasswordForDownload"
                      checked={newDocument.requiresPasswordForDownload}
                      onChange={(e) => setNewDocument({ 
                        ...newDocument, 
                        requiresPasswordForDownload: e.target.checked, 
                        downloadPassword: e.target.checked ? newDocument.downloadPassword : '', 
                        confirmPassword: e.target.checked ? newDocument.confirmPassword : '',
                        securityQuestions: e.target.checked 
                          ? newDocument.securityQuestions 
                          : [
                              { questionId: '', answer: '' },
                              { questionId: '', answer: '' },
                              { questionId: '', answer: '' }
                            ]
                      })}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                    />
                    <label htmlFor="requiresPasswordForDownload" className="text-sm text-slate-300 cursor-pointer">
                      Require password for download (prevents other account users from downloading)
                    </label>
                  </div>
                  {newDocument.requiresPasswordForDownload && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Download Password <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword.new ? "text" : "password"}
                            value={newDocument.downloadPassword}
                            onChange={(e) => setNewDocument({ ...newDocument, downloadPassword: e.target.value })}
                            placeholder="Enter password for download"
                            className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            {showPassword.new ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a9.953 9.953 0 015.77-2.21M6.29 6.29L12 12m6.71 6.71A9.953 9.953 0 0112 21.75c-2.676 0-5.216-.99-7.11-2.625M17.71 17.71L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Confirm Password <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword.newConfirm ? "text" : "password"}
                            value={newDocument.confirmPassword}
                            onChange={(e) => setNewDocument({ ...newDocument, confirmPassword: e.target.value })}
                            placeholder="Confirm password"
                            className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword({ ...showPassword, newConfirm: !showPassword.newConfirm })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            {showPassword.newConfirm ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a9.953 9.953 0 015.77-2.21M6.29 6.29L12 12m6.71 6.71A9.953 9.953 0 0112 21.75c-2.676 0-5.216-.99-7.11-2.625M17.71 17.71L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                        {newDocument.downloadPassword && newDocument.confirmPassword && newDocument.downloadPassword !== newDocument.confirmPassword && (
                          <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                        )}
                      </div>
                    </div>
                  )}
                  {newDocument.requiresPasswordForDownload && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <h4 className="text-sm font-semibold text-slate-300 mb-3">Password Recovery Security Questions</h4>
                      <p className="text-xs text-slate-400 mb-4">
                        Please select and answer 3 security questions. These will be used to recover your password if you forget it.
                      </p>
                      <div className="space-y-4">
                        {newDocument.securityQuestions.map((sq, index) => (
                          <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">
                                Security Question {index + 1} <span className="text-red-400">*</span>
                              </label>
                              <select
                                value={sq.questionId}
                                onChange={(e) => handleSecurityQuestionChange(index, e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              >
                                <option value="">Select a question</option>
                                {getAvailableQuestions(index).map(question => (
                                  <option key={question.id} value={question.id}>
                                    {question.question}
                                  </option>
                                ))}
                                {sq.questionId && SECURITY_QUESTIONS.find(q => q.id === sq.questionId) && (
                                  <option value={sq.questionId}>
                                    {SECURITY_QUESTIONS.find(q => q.id === sq.questionId)?.question}
                                  </option>
                                )}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">
                                Answer <span className="text-red-400">*</span>
                              </label>
                              <input
                                type="text"
                                value={sq.answer}
                                onChange={(e) => handleSecurityAnswerChange(index, e.target.value)}
                                placeholder="Enter your answer"
                                disabled={!sq.questionId}
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addDocument}
                    disabled={
                      !newDocument.documentName.trim() || 
                      !newDocument.uploadedDate ||
                      !newDocument.file ||
                      newDocument.selectedTags.length === 0 ||
                      (newDocument.requiresPasswordForDownload && (!newDocument.downloadPassword.trim() || newDocument.downloadPassword !== newDocument.confirmPassword)) ||
                      (newDocument.requiresPasswordForDownload && newDocument.securityQuestions.filter(q => q.questionId && q.answer.trim()).length !== 3)
                    }
                    className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add Document
                  </button>
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setNewDocument({
                        documentName: '',
                        uploadedDate: new Date().toISOString().split('T')[0],
                        effectiveDate: '',
                        note: '',
                        file: null,
                        selectedTags: [],
                        requiresPasswordForDownload: false,
                        downloadPassword: '',
                        confirmPassword: '',
                        securityQuestions: [
                          { questionId: '', answer: '' },
                          { questionId: '', answer: '' },
                          { questionId: '', answer: '' }
                        ]
                      });
                      setShowPassword({ ...showPassword, new: false, newConfirm: false });
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active Documents */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">Active Documents</h3>
              <span className="text-sm text-slate-400">
                {activeDocuments.length} {activeDocuments.length === 1 ? 'document' : 'documents'}
              </span>
            </div>
            {activeDocuments.length > 0 ? (
              <div className="space-y-4">
                {activeDocuments.map(document => (
                    <div key={document.id} className="p-3 rounded-lg border border-slate-700 bg-slate-800/50">
                    {editingId === document.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Document Name <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={editingDocument.documentName}
                              onChange={(e) => setEditingDocument({ ...editingDocument, documentName: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Uploaded Date <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="date"
                              value={editingDocument.uploadedDate}
                              onChange={(e) => setEditingDocument({ ...editingDocument, uploadedDate: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Effective Date (Optional)
                            </label>
                            <input
                              type="date"
                              value={editingDocument.effectiveDate}
                              onChange={(e) => setEditingDocument({ ...editingDocument, effectiveDate: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              File Upload (Optional - leave empty to keep current file)
                            </label>
                            <input
                              type="file"
                              onChange={(e) => handleFileChange(e, true)}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-500 file:text-slate-950 hover:file:bg-emerald-400"
                            />
                            <p className="text-xs text-slate-400 mt-1">
                              Maximum file size: 10MB
                            </p>
                            {editingDocument.file && (
                              <p className="text-xs text-slate-300 mt-1">
                                New file: {editingDocument.file.name} ({(editingDocument.file.size / 1024 / 1024).toFixed(2)} MB)
                              </p>
                            )}
                            {document.fileName && !editingDocument.file && (
                              <p className="text-xs text-slate-400 mt-1">
                                Current file: {document.fileName}
                              </p>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Tags <span className="text-red-400">*</span> (Select one or more)
                          </label>
                          <div className="flex flex-wrap gap-2 p-4 rounded-lg border border-slate-700 bg-slate-900/70 min-h-[60px]">
                            {activeTags.map(tag => (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => toggleTagSelection(tag.id, true)}
                                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                  editingDocument.selectedTags.includes(tag.id)
                                    ? 'bg-emerald-500 text-slate-950'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                {tag.name}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Note (Optional)
                          </label>
                          <textarea
                            value={editingDocument.note}
                            onChange={(e) => setEditingDocument({ ...editingDocument, note: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <div className="flex items-center gap-3 mb-3">
                            <input
                              type="checkbox"
                              id="editRequiresPasswordForDownload"
                              checked={editingDocument.requiresPasswordForDownload}
                              onChange={(e) => setEditingDocument({ ...editingDocument, requiresPasswordForDownload: e.target.checked, downloadPassword: e.target.checked ? editingDocument.downloadPassword : '', confirmPassword: e.target.checked ? editingDocument.confirmPassword : '' })}
                              className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                            />
                            <label htmlFor="editRequiresPasswordForDownload" className="text-sm text-slate-300 cursor-pointer">
                              Require password for download (prevents other account users from downloading)
                            </label>
                          </div>
                          {editingDocument.requiresPasswordForDownload && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Download Password <span className="text-red-400">*</span>
                                  {document.requiresPasswordForDownload && document.downloadPassword && (
                                    <span className="text-xs text-slate-400 ml-2">(Leave empty to keep current)</span>
                                  )}
                                </label>
                                <div className="relative">
                                  <input
                                    type={showPassword.edit ? "text" : "password"}
                                    value={editingDocument.downloadPassword}
                                    onChange={(e) => setEditingDocument({ ...editingDocument, downloadPassword: e.target.value })}
                                    placeholder={document.requiresPasswordForDownload && document.downloadPassword ? "Enter new password or leave empty" : "Enter password for download"}
                                    className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword({ ...showPassword, edit: !showPassword.edit })}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                                  >
                                    {showPassword.edit ? (
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a9.953 9.953 0 015.77-2.21M6.29 6.29L12 12m6.71 6.71A9.953 9.953 0 0112 21.75c-2.676 0-5.216-.99-7.11-2.625M17.71 17.71L21 21" />
                                      </svg>
                                    ) : (
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Confirm Password <span className="text-red-400">*</span>
                                  {document.requiresPasswordForDownload && document.downloadPassword && editingDocument.downloadPassword && (
                                    <span className="text-xs text-slate-400 ml-2">(Required if changing)</span>
                                  )}
                                </label>
                                <div className="relative">
                                  <input
                                    type={showPassword.editConfirm ? "text" : "password"}
                                    value={editingDocument.confirmPassword}
                                    onChange={(e) => setEditingDocument({ ...editingDocument, confirmPassword: e.target.value })}
                                    placeholder="Confirm password"
                                    className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword({ ...showPassword, editConfirm: !showPassword.editConfirm })}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                                  >
                                    {showPassword.editConfirm ? (
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a9.953 9.953 0 015.77-2.21M6.29 6.29L12 12m6.71 6.71A9.953 9.953 0 0112 21.75c-2.676 0-5.216-.99-7.11-2.625M17.71 17.71L21 21" />
                                      </svg>
                                    ) : (
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                                {editingDocument.downloadPassword && editingDocument.confirmPassword && editingDocument.downloadPassword !== editingDocument.confirmPassword && (
                                  <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveEdit}
                            disabled={
                              !editingDocument.documentName.trim() || 
                              !editingDocument.uploadedDate ||
                              editingDocument.selectedTags.length === 0 ||
                              (editingDocument.requiresPasswordForDownload && editingDocument.downloadPassword.trim() && editingDocument.downloadPassword !== editingDocument.confirmPassword) ||
                              (editingDocument.requiresPasswordForDownload && !editingDocument.downloadPassword.trim() && (!document.requiresPasswordForDownload || !document.downloadPassword))
                            }
                            className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h4 className="text-base font-semibold text-slate-100">{document.documentName}</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {document.tags.map(tagId => {
                                const tag = tags.find(t => t.id === tagId);
                                return tag ? (
                                  <span key={tagId} className="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300">
                                    {tag.name}
                                  </span>
                                ) : null;
                              })}
                            </div>
                            {document.requiresPasswordForDownload && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-300">
                                🔒
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
                            <span>
                              <span className="text-slate-400">Uploaded:</span> {new Date(document.uploadedDate).toLocaleDateString()}
                            </span>
                            {document.effectiveDate && (
                              <span>
                                <span className="text-slate-400">Effective:</span> {new Date(document.effectiveDate).toLocaleDateString()}
                              </span>
                            )}
                            {document.fileName && (
                              <span className="truncate max-w-xs">
                                <span className="text-slate-400">File:</span> {document.fileName}
                              </span>
                            )}
                            {document.fileSize && (
                              <span>
                                <span className="text-slate-400">Size:</span> {(document.fileSize / 1024 / 1024).toFixed(2)} MB
                              </span>
                            )}
                          </div>
                          {document.note && (
                            <div className="mt-1.5">
                              <span className="text-xs text-slate-400">Note: </span>
                              <span className="text-xs text-slate-300 italic">"{document.note}"</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleDownload(document)}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors text-xs whitespace-nowrap"
                            title="Download document"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => startEditing(document)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-xs whitespace-nowrap"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => inactivateDocument(document.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors text-xs whitespace-nowrap"
                          >
                            Inactivate
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">No active documents. Add one to get started!</p>
            )}
          </div>

          {/* History Section */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">History</h3>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                {showHistory ? 'Hide' : 'Show'} ({inactiveDocuments.length})
              </button>
            </div>
            {showHistory && (
              inactiveDocuments.length > 0 ? (
                <div className="space-y-4">
                  {inactiveDocuments.map(document => (
                    <div key={document.id} className="p-3 rounded-lg border border-slate-700 bg-slate-800/50 opacity-75">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h4 className="text-base font-semibold text-slate-300">{document.documentName}</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {document.tags.map(tagId => {
                                const tag = tags.find(t => t.id === tagId);
                                return tag ? (
                                  <span key={tagId} className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-600/50 text-slate-400">
                                    {tag.name}
                                  </span>
                                ) : null;
                              })}
                            </div>
                            {document.requiresPasswordForDownload && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
                                🔒
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                            <span>
                              <span className="text-slate-500">Uploaded:</span> {new Date(document.uploadedDate).toLocaleDateString()}
                            </span>
                            <span>
                              <span className="text-slate-500">Inactivated:</span> {document.dateInactivated ? new Date(document.dateInactivated).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          {document.note && (
                            <div className="mt-1.5">
                              <span className="text-xs text-slate-500">Note: </span>
                              <span className="text-xs text-slate-400 italic">"{document.note}"</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleDownload(document)}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors text-xs whitespace-nowrap"
                            title="Download document"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => activateDocument(document.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors text-xs whitespace-nowrap"
                          >
                            Activate
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(document.id)}
                            className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-xs whitespace-nowrap"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">No inactive documents in history.</p>
              )
            )}
          </div>
        </div>
      )}

      {/* Tags Tab */}
      {activeTab === 'tags' && (
        <div className="space-y-6">
          {/* Add New Tag Form */}
          {!isAddingTag ? (
            <div className="flex justify-start">
              <button
                onClick={() => setIsAddingTag(true)}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                + Add New Tag
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Add New Tag</h3>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Enter tag name"
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addTag();
                    }
                  }}
                />
                <button
                  onClick={addTag}
                  disabled={!newTagName.trim()}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Tag
                </button>
                <button
                  onClick={() => {
                    setIsAddingTag(false);
                    setNewTagName('');
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Active Tags */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">Active Tags</h3>
              <span className="text-sm text-slate-400">
                {activeTags.length} {activeTags.length === 1 ? 'tag' : 'tags'}
              </span>
            </div>
            {activeTags.length > 0 ? (
              <div className="space-y-3">
                {activeTags.map(tag => (
                  <div key={tag.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
                    {editingTagId === tag.id ? (
                      <div className="flex gap-4 items-center">
                        <input
                          type="text"
                          value={editingTagName}
                          onChange={(e) => setEditingTagName(e.target.value)}
                          className="flex-1 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              saveTagEdit();
                            } else if (e.key === 'Escape') {
                              cancelEditingTag();
                            }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={saveTagEdit}
                          disabled={!editingTagName.trim()}
                          className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEditingTag}
                          className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-medium text-slate-100">{tag.name}</span>
                          <span className="px-2 py-1 rounded text-xs font-medium bg-slate-700 text-slate-300">
                            Used {getTagUsageCount(tag.id)} {getTagUsageCount(tag.id) === 1 ? 'time' : 'times'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditingTag(tag)}
                            className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => inactivateTag(tag.id)}
                            className="px-3 py-1 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors text-sm"
                          >
                            Inactivate
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">No active tags. Add one to get started!</p>
            )}
          </div>

          {/* Inactive Tags */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">Inactive Tags</h3>
              <span className="text-sm text-slate-400">
                {inactiveTags.length} {inactiveTags.length === 1 ? 'tag' : 'tags'}
              </span>
            </div>
            {inactiveTags.length > 0 ? (
              <div className="space-y-3">
                {inactiveTags.map(tag => {
                  const usageCount = getTagUsageCount(tag.id);
                  return (
                    <div key={tag.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 opacity-75">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-medium text-slate-300">{tag.name}</span>
                          <span className="px-2 py-1 rounded text-xs font-medium bg-slate-700 text-slate-400">
                            Used {usageCount} {usageCount === 1 ? 'time' : 'times'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => activateTag(tag.id)}
                            className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors text-sm"
                          >
                            Activate
                          </button>
                          {usageCount === 0 && (
                            <button
                              onClick={() => setDeleteTagConfirmId(tag.id)}
                              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">No inactive tags.</p>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete Document</h3>
            <p className="text-slate-300 mb-4">
              <strong className="text-red-400">Warning:</strong> This action cannot be undone. This document will be permanently deleted.
            </p>
            <p className="text-slate-400 text-sm mb-4">
              To confirm, please type <strong className="text-slate-200">delete</strong> in the box below:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDeleteConfirmId(null);
                  setDeleteConfirmText('');
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={deleteDocument}
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Document
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Password Modal */}
      {downloadPasswordModalId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">Enter Download Password</h3>
              <button
                onClick={() => {
                  setDownloadPasswordModalId(null);
                  setDownloadPasswordInput('');
                  setShowDownloadPassword(false);
                }}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              This document is password protected. Please enter the password to download.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showDownloadPassword ? "text" : "password"}
                    value={downloadPasswordInput}
                    onChange={(e) => setDownloadPasswordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        confirmDownloadWithPassword();
                      } else if (e.key === 'Escape') {
                        setDownloadPasswordModalId(null);
                        setDownloadPasswordInput('');
                        setShowDownloadPassword(false);
                      }
                    }}
                    className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    placeholder="Enter password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowDownloadPassword(!showDownloadPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label={showDownloadPassword ? "Hide password" : "Show password"}
                  >
                    {showDownloadPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPasswordModal(true);
                      handleForgotPassword();
                    }}
                    className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={confirmDownloadWithPassword}
                  disabled={!downloadPasswordInput.trim() || isLoading}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Download
                </button>
                <button
                  onClick={() => {
                    setDownloadPasswordModalId(null);
                    setDownloadPasswordInput('');
                    setShowDownloadPassword(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">
                {passwordResetStep === 'questions' ? 'Answer Security Questions' : 'Reset Password'}
              </h3>
              <button
                onClick={() => {
                  setShowForgotPasswordModal(false);
                  setPasswordResetStep('questions');
                  setSecurityQuestions([]);
                  setSecurityAnswers([]);
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            {passwordResetStep === 'questions' ? (
              <>
                <p className="text-sm text-slate-400 mb-4">
                  Please answer all 3 security questions to reset your password.
                </p>
                <div className="space-y-4">
                  {securityQuestions.map((sq, index) => (
                    <div key={sq.questionId}>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        {index + 1}. {sq.question}
                      </label>
                      <input
                        type="text"
                        value={securityAnswers.find(a => a.questionId === sq.questionId)?.answer || ''}
                        onChange={(e) => {
                          const updated = securityAnswers.map(a =>
                            a.questionId === sq.questionId
                              ? { ...a, answer: e.target.value }
                              : a
                          );
                          setSecurityAnswers(updated);
                        }}
                        className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        placeholder="Enter your answer"
                        autoFocus={index === 0}
                      />
                    </div>
                  ))}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleVerifySecurityAnswers}
                      disabled={securityAnswers.some(a => !a.answer.trim()) || isLoading}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Verify Answers
                    </button>
                    <button
                      onClick={() => {
                        setShowForgotPasswordModal(false);
                        setPasswordResetStep('questions');
                        setSecurityQuestions([]);
                        setSecurityAnswers([]);
                      }}
                      className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-400 mb-4">
                  Answers verified! Please enter your new password.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        placeholder="Enter new password"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                      >
                        {showNewPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmNewPassword ? "text" : "password"}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleResetPassword();
                          }
                        }}
                        className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                        aria-label={showConfirmNewPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmNewPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleResetPassword}
                      disabled={!newPassword.trim() || newPassword !== confirmNewPassword || isLoading}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reset Password
                    </button>
                    <button
                      onClick={() => {
                        setShowForgotPasswordModal(false);
                        setPasswordResetStep('questions');
                        setSecurityQuestions([]);
                        setSecurityAnswers([]);
                        setNewPassword('');
                        setConfirmNewPassword('');
                      }}
                      className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Tag Confirmation Modal */}
      {deleteTagConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete Tag</h3>
            <p className="text-slate-300 mb-4">
              <strong className="text-red-400">Warning:</strong> This action cannot be undone. This tag will be permanently deleted.
            </p>
            <p className="text-slate-400 text-sm mb-4">
              To confirm, please type <strong className="text-slate-200">delete</strong> in the box below:
            </p>
            <input
              type="text"
              value={deleteTagConfirmText}
              onChange={(e) => setDeleteTagConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDeleteTagConfirmId(null);
                  setDeleteTagConfirmText('');
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={deleteTag}
                disabled={deleteTagConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Tag
              </button>
              <button
                onClick={() => {
                  setDeleteTagConfirmId(null);
                  setDeleteTagConfirmText('');
                }}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
