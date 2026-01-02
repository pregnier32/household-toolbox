'use client';

import { useState, useEffect } from 'react';

type NoteTag = {
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

type Note = {
  id: string;
  noteName: string;
  createdDate: string;
  note: string;
  tags: string[]; // Array of tag IDs
  isActive: boolean;
  dateAdded: string;
  dateInactivated?: string;
  requiresPasswordForView: boolean;
  viewPassword: string | null;
  securityQuestions: SecurityQuestion[] | null;
};

const DEFAULT_TAGS = [
  'General',
  'Important',
  'To Review',
  'Temporary',
  'Home',
  'Projects',
  'Contractors',
  'Appliances',
  'Finance',
  'Bills',
  'Insurance',
  'Family',
  'Medical',
  'Pets',
  'Work',
  'Ideas',
  'Goals',
  'Travel',
  'Reservations'
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

type NotesToolProps = {
  toolId?: string;
};

export function NotesTool({ toolId }: NotesToolProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<NoteTag[]>([]);
  const [activeTab, setActiveTab] = useState<'notes' | 'tags'>('notes');
  const [isLoading, setIsLoading] = useState(false);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  
  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState({
    noteName: '',
    createdDate: new Date().toISOString().split('T')[0],
    note: '',
    selectedTags: [] as string[],
    requiresPasswordForView: false,
    viewPassword: '',
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
  const [editingNote, setEditingNote] = useState({
    noteName: '',
    createdDate: '',
    note: '',
    selectedTags: [] as string[],
    requiresPasswordForView: false,
    viewPassword: '',
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
  const [viewPasswordModalId, setViewPasswordModalId] = useState<string | null>(null);
  const [viewPasswordInput, setViewPasswordInput] = useState('');
  const [showViewPassword, setShowViewPassword] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [viewNoteModal, setViewNoteModal] = useState<Note | null>(null);
  const [passwordAction, setPasswordAction] = useState<'view' | 'edit' | 'inactivate' | null>(null);
  const [securityQuestions, setSecurityQuestions] = useState<Array<{ questionId: string; question: string }>>([]);
  const [securityAnswers, setSecurityAnswers] = useState<Array<{ questionId: string; answer: string }>>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordResetStep, setPasswordResetStep] = useState<'questions' | 'reset'>('questions');

  // Load notes and tags from API
  useEffect(() => {
    const loadData = async () => {
      if (!toolId) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/tools/notes?toolId=${toolId}`);
        if (response.ok) {
          const data = await response.json();
          
          // Transform database format to component format
          const transformedNotes: Note[] = (data.notes || []).map((note: any) => ({
            id: note.id,
            noteName: note.note_name,
            createdDate: note.created_date,
            note: note.note,
            tags: note.tags || [],
            isActive: note.is_active !== false,
            dateAdded: note.date_added,
            dateInactivated: note.date_inactivated,
            requiresPasswordForView: note.requires_password_for_view || false,
            viewPassword: null, // Never expose password hash
            securityQuestions: null // Security questions are not returned for security
          }));
          
          setNotes(transformedNotes);
          
          // Load tags separately
          const tagsResponse = await fetch(`/api/tools/notes/tags?toolId=${toolId}`);
          if (tagsResponse.ok) {
            const tagsData = await tagsResponse.json();
            const transformedTags: NoteTag[] = (tagsData.tags || []).map((tag: any) => ({
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
                fetch('/api/tools/notes/tags', {
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
              const reloadTagsResponse = await fetch(`/api/tools/notes/tags?toolId=${toolId}`);
              if (reloadTagsResponse.ok) {
                const reloadTagsData = await reloadTagsResponse.json();
                const reloadedTags: NoteTag[] = (reloadTagsData.tags || []).map((tag: any) => ({
                  id: tag.id,
                  name: tag.name,
                  isActive: tag.is_active !== false,
                  dateAdded: tag.date_added,
                  dateInactivated: tag.date_inactivated
                }));
                setTags(reloadedTags);
              } else {
                // If reload fails, use default tags for UI
                const defaultTagsForUI: NoteTag[] = DEFAULT_TAGS.map((tagName, index) => ({
                  id: `default-${index}`,
                  name: tagName,
                  isActive: true,
                  dateAdded: new Date().toISOString()
                }));
                setTags(defaultTagsForUI);
              }
            } else {
              setTags(transformedTags);
            }
          } else {
            // Tags API doesn't exist yet - initialize with default tags for UI
            const defaultTagsForUI: NoteTag[] = DEFAULT_TAGS.map((tagName, index) => ({
              id: `default-${index}`,
              name: tagName,
              isActive: true,
              dateAdded: new Date().toISOString()
            }));
            setTags(defaultTagsForUI);
          }
        } else {
          // API route doesn't exist yet - initialize with default tags for UI development
          setNotes([]);
          // Initialize tags with default tags so they appear in the UI
          const defaultTagsForUI: NoteTag[] = DEFAULT_TAGS.map((tagName, index) => ({
            id: `default-${index}`,
            name: tagName,
            isActive: true,
            dateAdded: new Date().toISOString()
          }));
          setTags(defaultTagsForUI);
        }
      } catch (error) {
        // API route doesn't exist yet - initialize with default tags for UI development
        setNotes([]);
        // Initialize tags with default tags so they appear in the UI
        const defaultTagsForUI: NoteTag[] = DEFAULT_TAGS.map((tagName, index) => ({
          id: `default-${index}`,
          name: tagName,
          isActive: true,
          dateAdded: new Date().toISOString()
        }));
        setTags(defaultTagsForUI);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [toolId]);

  // Filter notes based on search and tag filter
  const filteredNotes = notes.filter(note => {
    const matchesSearch = searchQuery === '' || 
      note.noteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.note.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTag = selectedTagFilter === 'all' || 
      note.tags.includes(selectedTagFilter);
    
    return matchesSearch && matchesTag;
  });

  const activeNotes = filteredNotes.filter(note => note.isActive).sort((a, b) => a.noteName.localeCompare(b.noteName));
  const inactiveNotes = filteredNotes.filter(note => !note.isActive);
  const activeTags = tags.filter(tag => tag.isActive).sort((a, b) => a.name.localeCompare(b.name));
  const inactiveTags = tags.filter(tag => !tag.isActive).sort((a, b) => a.name.localeCompare(b.name));

  const addNote = async () => {
    if (!newNote.noteName.trim() || !newNote.createdDate || !newNote.note.trim()) {
      alert('Please fill in all required fields (Note Name, Created Date, and Note content).');
      return;
    }

    if (newNote.selectedTags.length === 0) {
      alert('Please select at least one tag.');
      return;
    }

    if (newNote.requiresPasswordForView) {
      if (!newNote.viewPassword.trim()) {
        alert('Please enter a password for view protection.');
        return;
      }
      if (newNote.viewPassword !== newNote.confirmPassword) {
        alert('Passwords do not match. Please confirm your password.');
        return;
      }
      // Validate security questions
      const validQuestions = newNote.securityQuestions.filter(q => q.questionId && q.answer.trim());
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
      const response = await fetch('/api/tools/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolId,
          action: 'create',
          noteName: newNote.noteName.trim(),
          createdDate: newNote.createdDate,
          note: newNote.note.trim(),
          requiresPasswordForView: newNote.requiresPasswordForView,
          viewPassword: newNote.requiresPasswordForView ? newNote.viewPassword.trim() : undefined,
          selectedTags: newNote.selectedTags,
          securityQuestions: newNote.requiresPasswordForView
            ? newNote.securityQuestions.filter(q => q.questionId && q.answer.trim())
            : undefined
        }),
      });

      if (response.ok) {
        // Reload notes from API
        const loadResponse = await fetch(`/api/tools/notes?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedNotes: Note[] = (data.notes || []).map((note: any) => ({
            id: note.id,
            noteName: note.note_name,
            createdDate: note.created_date,
            note: note.note,
            tags: note.tags || [],
            isActive: note.is_active !== false,
            dateAdded: note.date_added,
            dateInactivated: note.date_inactivated,
            requiresPasswordForView: note.requires_password_for_view || false,
            viewPassword: null,
            securityQuestions: null
          }));
          setNotes(transformedNotes);
        }
        
        // Reset form
        setNewNote({
          noteName: '',
          createdDate: new Date().toISOString().split('T')[0],
          note: '',
          selectedTags: [],
          requiresPasswordForView: false,
          viewPassword: '',
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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || 'Unknown error';
        alert(errorMessage);
      }
    } catch (error) {
      alert('Error adding note. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (note: Note) => {
    // Check if password is required
    if (note.requiresPasswordForView) {
      setViewPasswordModalId(note.id);
      setViewPasswordInput('');
      setPasswordAction('edit');
      return;
    }

    // No password required, proceed with editing
    setEditingId(note.id);
    setEditingNote({
      noteName: note.noteName,
      createdDate: note.createdDate,
      note: note.note,
      selectedTags: note.tags,
      requiresPasswordForView: note.requiresPasswordForView || false,
      viewPassword: note.requiresPasswordForView ? '••••••••' : '', // Placeholder to indicate password exists
      confirmPassword: note.requiresPasswordForView ? '••••••••' : '' // Placeholder to indicate password exists
    });
    setShowPassword({ ...showPassword, edit: false, editConfirm: false });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingNote({
      noteName: '',
      createdDate: '',
      note: '',
      selectedTags: [],
      requiresPasswordForView: false,
      viewPassword: '',
      confirmPassword: ''
    });
    setShowPassword({ ...showPassword, edit: false, editConfirm: false });
  };

  const saveEdit = async () => {
    if (!editingId || !editingNote.noteName.trim() || !editingNote.createdDate || !editingNote.note.trim()) {
      return;
    }

    if (editingNote.selectedTags.length === 0) {
      alert('Please select at least one tag.');
      return;
    }

    const existingNote = notes.find(n => n.id === editingId);
    if (editingNote.requiresPasswordForView) {
      // If password protection is newly enabled or password is being changed
      if (editingNote.viewPassword.trim()) {
        if (editingNote.viewPassword !== editingNote.confirmPassword) {
          alert('Passwords do not match. Please confirm your password.');
          return;
        }
      } else if (!existingNote?.requiresPasswordForView || !existingNote?.viewPassword) {
        // Only require password if it's newly enabled
        alert('Please enter a password for view protection.');
        return;
      }
    }

    if (!toolId) {
      alert('Tool ID is required.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolId,
          noteId: editingId,
          action: 'update',
          noteName: editingNote.noteName.trim(),
          createdDate: editingNote.createdDate,
          note: editingNote.note.trim(),
          requiresPasswordForView: editingNote.requiresPasswordForView,
          viewPassword: editingNote.requiresPasswordForView && editingNote.viewPassword.trim() && editingNote.viewPassword !== '••••••••'
            ? editingNote.viewPassword.trim()
            : undefined,
          selectedTags: editingNote.selectedTags
        }),
      });

      if (response.ok) {
        // Reload notes from API
        const loadResponse = await fetch(`/api/tools/notes?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedNotes: Note[] = (data.notes || []).map((note: any) => ({
            id: note.id,
            noteName: note.note_name,
            createdDate: note.created_date,
            note: note.note,
            tags: note.tags || [],
            isActive: note.is_active !== false,
            dateAdded: note.date_added,
            dateInactivated: note.date_inactivated,
            requiresPasswordForView: note.requires_password_for_view || false,
            viewPassword: null,
            securityQuestions: null
          }));
          setNotes(transformedNotes);
        }
        cancelEditing();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || 'Unknown error';
        alert(errorMessage);
      }
    } catch (error) {
      alert('Error updating note. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inactivateNote = async (id: string) => {
    if (!toolId) {
      alert('Tool ID is required.');
      return;
    }

    // Check if password is required
    const note = notes.find(n => n.id === id);
    if (note && note.requiresPasswordForView) {
      setViewPasswordModalId(id);
      setViewPasswordInput('');
      setPasswordAction('inactivate');
      return;
    }

    // No password required, proceed with inactivating
    await performInactivate(id);
  };

  const performInactivate = async (id: string) => {
    if (!toolId) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolId,
          noteId: id,
          action: 'inactivate'
        }),
      });

      if (response.ok) {
        // Reload notes from API
        const loadResponse = await fetch(`/api/tools/notes?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedNotes: Note[] = (data.notes || []).map((note: any) => ({
            id: note.id,
            noteName: note.note_name,
            createdDate: note.created_date,
            note: note.note,
            tags: note.tags || [],
            isActive: note.is_active !== false,
            dateAdded: note.date_added,
            dateInactivated: note.date_inactivated,
            requiresPasswordForView: note.requires_password_for_view || false,
            viewPassword: null,
            securityQuestions: null
          }));
          setNotes(transformedNotes);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || 'Unknown error';
        alert(errorMessage);
      }
    } catch (error) {
      alert('Error inactivating note. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const activateNote = async (id: string) => {
    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolId,
          noteId: id,
          action: 'activate'
        }),
      });

      if (response.ok) {
        // Reload notes from API
        const loadResponse = await fetch(`/api/tools/notes?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedNotes: Note[] = (data.notes || []).map((note: any) => ({
            id: note.id,
            noteName: note.note_name,
            createdDate: note.created_date,
            note: note.note,
            tags: note.tags || [],
            isActive: note.is_active !== false,
            dateAdded: note.date_added,
            dateInactivated: note.date_inactivated,
            requiresPasswordForView: note.requires_password_for_view || false,
            viewPassword: null,
            securityQuestions: null
          }));
          setNotes(transformedNotes);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || 'Unknown error';
        alert(errorMessage);
      }
    } catch (error) {
      alert('Error activating note. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteNote = async () => {
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
      const response = await fetch(`/api/tools/notes?noteId=${deleteConfirmId}&toolId=${toolId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Reload notes from API
        const loadResponse = await fetch(`/api/tools/notes?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedNotes: Note[] = (data.notes || []).map((note: any) => ({
            id: note.id,
            noteName: note.note_name,
            createdDate: note.created_date,
            note: note.note,
            tags: note.tags || [],
            isActive: note.is_active !== false,
            dateAdded: note.date_added,
            dateInactivated: note.date_inactivated,
            requiresPasswordForView: note.requires_password_for_view || false,
            viewPassword: null,
            securityQuestions: null
          }));
          setNotes(transformedNotes);
        }
        setDeleteConfirmId(null);
        setDeleteConfirmText('');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || 'Unknown error';
        alert(errorMessage);
      }
    } catch (error) {
      alert('Error deleting note. Please try again.');
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

    // Check for duplicate tag name on client side
    const trimmedName = newTagName.trim();
    const existingTag = tags.find(tag => tag.name.toLowerCase() === trimmedName.toLowerCase());
    if (existingTag) {
      alert('A tag with this name already exists.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/notes/tags', {
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
        const loadResponse = await fetch(`/api/tools/notes/tags?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedTags: NoteTag[] = (data.tags || []).map((tag: any) => ({
            id: tag.id,
            name: tag.name,
            isActive: tag.is_active !== false,
            dateAdded: tag.date_added,
            dateInactivated: tag.date_inactivated || undefined
          }));
          setTags(transformedTags);
        }
        setNewTagName('');
        setIsAddingTag(false);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        // Show user-friendly error message without triggering error page
        const errorMessage = errorData.error || 'Unknown error';
        alert(errorMessage);
      }
    } catch (error) {
      alert('Error adding tag. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditingTag = (tag: NoteTag) => {
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

    // Check for duplicate tag name on client side (excluding current tag)
    const trimmedName = editingTagName.trim();
    const existingTag = tags.find(tag => 
      tag.id !== editingTagId && 
      tag.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existingTag) {
      alert('A tag with this name already exists.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/notes/tags', {
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
        const loadResponse = await fetch(`/api/tools/notes/tags?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedTags: NoteTag[] = (data.tags || []).map((tag: any) => ({
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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || 'Unknown error';
        alert(errorMessage);
      }
    } catch (error) {
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
      const response = await fetch('/api/tools/notes/tags', {
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
        const loadResponse = await fetch(`/api/tools/notes/tags?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedTags: NoteTag[] = (data.tags || []).map((tag: any) => ({
            id: tag.id,
            name: tag.name,
            isActive: tag.is_active !== false,
            dateAdded: tag.date_added,
            dateInactivated: tag.date_inactivated
          }));
          setTags(transformedTags);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || 'Unknown error';
        alert(errorMessage);
      }
    } catch (error) {
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
      const response = await fetch('/api/tools/notes/tags', {
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
        const loadResponse = await fetch(`/api/tools/notes/tags?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedTags: NoteTag[] = (data.tags || []).map((tag: any) => ({
            id: tag.id,
            name: tag.name,
            isActive: tag.is_active !== false,
            dateAdded: tag.date_added,
            dateInactivated: tag.date_inactivated
          }));
          setTags(transformedTags);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || 'Unknown error';
        alert(errorMessage);
      }
    } catch (error) {
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
      const response = await fetch(`/api/tools/notes/tags?tagId=${deleteTagConfirmId}&toolId=${toolId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Reload tags from API
        const loadResponse = await fetch(`/api/tools/notes/tags?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedTags: NoteTag[] = (data.tags || []).map((tag: any) => ({
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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || 'Unknown error';
        alert(errorMessage);
      }
    } catch (error) {
      alert('Error deleting tag. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTagSelection = (tagId: string, isEdit: boolean = false) => {
    if (isEdit) {
      const isSelected = editingNote.selectedTags.includes(tagId);
      setEditingNote({
        ...editingNote,
        selectedTags: isSelected
          ? editingNote.selectedTags.filter(id => id !== tagId)
          : [...editingNote.selectedTags, tagId]
      });
    } else {
      const isSelected = newNote.selectedTags.includes(tagId);
      setNewNote({
        ...newNote,
        selectedTags: isSelected
          ? newNote.selectedTags.filter(id => id !== tagId)
          : [...newNote.selectedTags, tagId]
      });
    }
  };

  const getTagName = (tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    return tag ? tag.name : 'Unknown';
  };

  const getTagUsageCount = (tagId: string) => {
    return notes.filter(note => note.tags.includes(tagId)).length;
  };

  const handleSecurityQuestionChange = (index: number, questionId: string) => {
    const updatedQuestions = [...newNote.securityQuestions];
    updatedQuestions[index] = { ...updatedQuestions[index], questionId, answer: '' };
    setNewNote({ ...newNote, securityQuestions: updatedQuestions });
  };

  const handleSecurityAnswerChange = (index: number, answer: string) => {
    const updatedQuestions = [...newNote.securityQuestions];
    updatedQuestions[index] = { ...updatedQuestions[index], answer };
    setNewNote({ ...newNote, securityQuestions: updatedQuestions });
  };

  const getAvailableQuestions = (currentIndex: number) => {
    const selectedQuestionIds = newNote.securityQuestions
      .map((q, idx) => idx !== currentIndex ? q.questionId : '')
      .filter(id => id);
    return SECURITY_QUESTIONS.filter(q => !selectedQuestionIds.includes(q.id));
  };

  const handleViewNote = async (note: Note) => {
    if (note.requiresPasswordForView) {
      // Show password modal
      setViewPasswordModalId(note.id);
      setViewPasswordInput('');
      setPasswordAction('view');
      return;
    }

    // Show note in modal (no password required)
    setViewNoteModal(note);
  };

  const handleForgotPassword = async () => {
    if (!viewPasswordModalId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/tools/notes/reset-password?noteId=${viewPasswordModalId}`);
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
    if (!viewPasswordModalId) return;

    // Check all answers are filled
    if (securityAnswers.some(a => !a.answer.trim())) {
      alert('Please answer all security questions.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/notes/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          noteId: viewPasswordModalId,
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
    if (!viewPasswordModalId) return;

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
      const response = await fetch('/api/tools/notes/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          noteId: viewPasswordModalId,
          answers: securityAnswers,
          newPassword: newPassword.trim()
        }),
      });

      if (response.ok) {
        alert('Password reset successfully! You can now view the note.');
        setShowForgotPasswordModal(false);
      setViewPasswordModalId(null);
      setViewPasswordInput('');
      setShowViewPassword(false);
      setPasswordAction(null);
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

  const confirmViewWithPassword = async () => {
    if (!viewPasswordModalId || !viewPasswordInput.trim()) {
      return;
    }

    const note = notes.find(n => n.id === viewPasswordModalId);
    if (!note) {
      alert('Note not found.');
      setViewPasswordModalId(null);
      setViewPasswordInput('');
      return;
    }

    setIsLoading(true);
    try {
      // Verify password with API
      const response = await fetch('/api/tools/notes/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          noteId: note.id,
          password: viewPasswordInput.trim()
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          // Password correct, proceed with the intended action
          const action = passwordAction || 'view';
          
          if (action === 'view') {
            setViewNoteModal(note);
          } else if (action === 'edit') {
            // Proceed with editing
            // Use a placeholder value to indicate password is already set
            setEditingId(note.id);
            setEditingNote({
              noteName: note.noteName,
              createdDate: note.createdDate,
              note: note.note,
              selectedTags: note.tags,
              requiresPasswordForView: note.requiresPasswordForView || false,
              viewPassword: note.requiresPasswordForView ? '••••••••' : '', // Placeholder to indicate password exists
              confirmPassword: note.requiresPasswordForView ? '••••••••' : '' // Placeholder to indicate password exists
            });
            setShowPassword({ ...showPassword, edit: false, editConfirm: false });
          } else if (action === 'inactivate') {
            // Proceed with inactivating
            await performInactivate(note.id);
          }
          
          setViewPasswordModalId(null);
          setViewPasswordInput('');
          setShowViewPassword(false);
          setPasswordAction(null);
        } else {
          alert('Incorrect password. Please try again.');
          setViewPasswordInput('');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert('Failed to verify password: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
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
          <h2 className="text-2xl font-semibold text-slate-50 mb-2">Notes</h2>
          <p className="text-slate-400 text-sm">
            Create, tag, and manage your notes
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
            { id: 'notes', label: 'Notes' },
            { id: 'tags', label: 'Tags' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'notes' | 'tags')}
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

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="space-y-6">
          {/* Search and Filter */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Search Notes
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by note name or content..."
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

          {/* Add New Note Form */}
          {!isAdding ? (
            <div className="flex justify-start">
              <button
                onClick={() => setIsAdding(true)}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                + Add New Note
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Add New Note</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Note Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newNote.noteName}
                      onChange={(e) => setNewNote({ ...newNote, noteName: e.target.value })}
                      placeholder="e.g., Meeting Notes - Jan 15"
                      className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Created Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={newNote.createdDate}
                      onChange={(e) => setNewNote({ ...newNote, createdDate: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Note <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={newNote.note}
                    onChange={(e) => setNewNote({ ...newNote, note: e.target.value })}
                    placeholder="Enter your note content..."
                    rows={6}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                  />
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
                            newNote.selectedTags.includes(tag.id)
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
                  {newNote.selectedTags.length > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      Selected: {newNote.selectedTags.map(id => getTagName(id)).join(', ')}
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      id="requiresPasswordForView"
                      checked={newNote.requiresPasswordForView}
                      onChange={(e) => setNewNote({ 
                        ...newNote, 
                        requiresPasswordForView: e.target.checked, 
                        viewPassword: e.target.checked ? newNote.viewPassword : '', 
                        confirmPassword: e.target.checked ? newNote.confirmPassword : '',
                        securityQuestions: e.target.checked 
                          ? newNote.securityQuestions 
                          : [
                              { questionId: '', answer: '' },
                              { questionId: '', answer: '' },
                              { questionId: '', answer: '' }
                            ]
                      })}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                    />
                    <label htmlFor="requiresPasswordForView" className="text-sm text-slate-300 cursor-pointer">
                      Require password for viewing (prevents other account users from viewing)
                    </label>
                  </div>
                  {newNote.requiresPasswordForView && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          View Password <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword.new ? "text" : "password"}
                            value={newNote.viewPassword}
                            onChange={(e) => setNewNote({ ...newNote, viewPassword: e.target.value })}
                            placeholder="Enter password for view protection"
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
                            value={newNote.confirmPassword}
                            onChange={(e) => setNewNote({ ...newNote, confirmPassword: e.target.value })}
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
                        {newNote.viewPassword && newNote.confirmPassword && newNote.viewPassword !== newNote.confirmPassword && (
                          <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                        )}
                      </div>
                    </div>
                  )}
                  {newNote.requiresPasswordForView && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <h4 className="text-sm font-semibold text-slate-300 mb-3">Password Recovery Security Questions</h4>
                      <p className="text-xs text-slate-400 mb-4">
                        Please select and answer 3 security questions. These will be used to recover your password if you forget it.
                      </p>
                      <div className="space-y-4">
                        {newNote.securityQuestions.map((sq, index) => (
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
                    onClick={addNote}
                    disabled={
                      !newNote.noteName.trim() || 
                      !newNote.createdDate ||
                      !newNote.note.trim() ||
                      newNote.selectedTags.length === 0 ||
                      (newNote.requiresPasswordForView && (!newNote.viewPassword.trim() || newNote.viewPassword !== newNote.confirmPassword)) ||
                      (newNote.requiresPasswordForView && newNote.securityQuestions.filter(q => q.questionId && q.answer.trim()).length !== 3)
                    }
                    className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add Note
                  </button>
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setNewNote({
                        noteName: '',
                        createdDate: new Date().toISOString().split('T')[0],
                        note: '',
                        selectedTags: [],
                        requiresPasswordForView: false,
                        viewPassword: '',
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

          {/* Active Notes */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">Active Notes</h3>
              <span className="text-sm text-slate-400">
                {activeNotes.length} {activeNotes.length === 1 ? 'note' : 'notes'}
              </span>
            </div>
            {activeNotes.length > 0 ? (
              <div className="space-y-4">
                {activeNotes.map(note => (
                    <div key={note.id} className="p-3 rounded-lg border border-slate-700 bg-slate-800/50">
                    {editingId === note.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Note Name <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={editingNote.noteName}
                              onChange={(e) => setEditingNote({ ...editingNote, noteName: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Created Date <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="date"
                              value={editingNote.createdDate}
                              onChange={(e) => setEditingNote({ ...editingNote, createdDate: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Note <span className="text-red-400">*</span>
                          </label>
                          <textarea
                            value={editingNote.note}
                            onChange={(e) => setEditingNote({ ...editingNote, note: e.target.value })}
                            rows={6}
                            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                          />
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
                                  editingNote.selectedTags.includes(tag.id)
                                    ? 'bg-emerald-500 text-slate-950'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                {tag.name}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <div className="flex items-center gap-3 mb-3">
                            <input
                              type="checkbox"
                              id="editRequiresPasswordForView"
                              checked={editingNote.requiresPasswordForView}
                              onChange={(e) => setEditingNote({ ...editingNote, requiresPasswordForView: e.target.checked, viewPassword: e.target.checked ? editingNote.viewPassword : '', confirmPassword: e.target.checked ? editingNote.confirmPassword : '' })}
                              className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                            />
                            <label htmlFor="editRequiresPasswordForView" className="text-sm text-slate-300 cursor-pointer">
                              Require password for viewing (prevents other account users from viewing)
                            </label>
                          </div>
                          {editingNote.requiresPasswordForView && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  View Password <span className="text-red-400">*</span>
                                  {note.requiresPasswordForView && note.viewPassword && (
                                    <span className="text-xs text-slate-400 ml-2">(Leave empty to keep current)</span>
                                  )}
                                </label>
                                <div className="relative">
                                  <input
                                    type={showPassword.edit ? "text" : "password"}
                                    value={editingNote.viewPassword === '••••••••' ? '' : editingNote.viewPassword}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setEditingNote({ 
                                        ...editingNote, 
                                        viewPassword: newValue,
                                        // Clear confirm password if user starts typing (changing password)
                                        confirmPassword: newValue === '' && note.requiresPasswordForView && note.viewPassword ? '••••••••' : (newValue === editingNote.confirmPassword ? editingNote.confirmPassword : editingNote.confirmPassword === '••••••••' ? '' : editingNote.confirmPassword)
                                      });
                                    }}
                                    placeholder={note.requiresPasswordForView && note.viewPassword ? "Enter new password or leave empty to keep existing" : "Enter password for view protection"}
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
                                  Confirm Password
                                  {note.requiresPasswordForView && note.viewPassword && editingNote.viewPassword && editingNote.viewPassword !== '••••••••' ? (
                                    <span className="text-red-400 ml-1">*</span>
                                  ) : !note.requiresPasswordForView || !note.viewPassword ? (
                                    <span className="text-red-400 ml-1">*</span>
                                  ) : null}
                                </label>
                                <div className="relative">
                                  <input
                                    type={showPassword.editConfirm ? "text" : "password"}
                                    value={editingNote.confirmPassword === '••••••••' ? '' : editingNote.confirmPassword}
                                    onChange={(e) => setEditingNote({ ...editingNote, confirmPassword: e.target.value })}
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
                                {editingNote.viewPassword && editingNote.confirmPassword && editingNote.viewPassword !== editingNote.confirmPassword && (
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
                              !editingNote.noteName.trim() ||
                              !editingNote.createdDate ||
                              !editingNote.note.trim() ||
                              editingNote.selectedTags.length === 0 ||
                              (editingNote.requiresPasswordForView && editingNote.viewPassword.trim() && editingNote.viewPassword !== '••••••••' && editingNote.viewPassword !== editingNote.confirmPassword) ||
                              (editingNote.requiresPasswordForView && !editingNote.viewPassword.trim() && (!note.requiresPasswordForView || !note.viewPassword))
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
                            <h4 className="text-base font-semibold text-slate-100">{note.noteName}</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {note.tags.map(tagId => {
                                const tag = tags.find(t => t.id === tagId);
                                return tag ? (
                                  <span key={tagId} className="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300">
                                    {tag.name}
                                  </span>
                                ) : null;
                              })}
                            </div>
                            {note.requiresPasswordForView && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-300">
                                🔒
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
                            <span>
                              <span className="text-slate-400">Created:</span> {new Date(note.createdDate).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="mt-2">
                            <span className="text-xs text-slate-400">Note: </span>
                            <span className="text-xs text-slate-300">
                              {note.requiresPasswordForView ? '*** Secured ***' : (note.note.length > 20 ? `${note.note.substring(0, 20)}...` : note.note)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleViewNote(note)}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors text-xs whitespace-nowrap"
                            title="View note"
                          >
                            View
                          </button>
                          <button
                            onClick={() => startEditing(note)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-xs whitespace-nowrap"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => inactivateNote(note.id)}
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
              <p className="text-slate-400 text-center py-8">No active notes. Add one to get started!</p>
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
                {showHistory ? 'Hide' : 'Show'} ({inactiveNotes.length})
              </button>
            </div>
            {showHistory && (
              inactiveNotes.length > 0 ? (
                <div className="space-y-4">
                  {inactiveNotes.map(note => (
                    <div key={note.id} className="p-3 rounded-lg border border-slate-700 bg-slate-800/50 opacity-75">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h4 className="text-base font-semibold text-slate-300">{note.noteName}</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {note.tags.map(tagId => {
                                const tag = tags.find(t => t.id === tagId);
                                return tag ? (
                                  <span key={tagId} className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-600/50 text-slate-400">
                                    {tag.name}
                                  </span>
                                ) : null;
                              })}
                            </div>
                            {note.requiresPasswordForView && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
                                🔒
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                            <span>
                              <span className="text-slate-500">Created:</span> {new Date(note.createdDate).toLocaleDateString()}
                            </span>
                            <span>
                              <span className="text-slate-500">Inactivated:</span> {note.dateInactivated ? new Date(note.dateInactivated).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          <div className="mt-2">
                            <span className="text-xs text-slate-500">Note: </span>
                            <span className="text-xs text-slate-400">
                              {note.requiresPasswordForView ? '*** Secured ***' : (note.note.length > 20 ? `${note.note.substring(0, 20)}...` : note.note)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleViewNote(note)}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors text-xs whitespace-nowrap"
                            title="View note"
                          >
                            View
                          </button>
                          <button
                            onClick={() => activateNote(note.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors text-xs whitespace-nowrap"
                          >
                            Activate
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(note.id)}
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
                <p className="text-slate-400 text-center py-8">No inactive notes in history.</p>
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
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete Note</h3>
            <p className="text-slate-300 mb-4">
              <strong className="text-red-400">Warning:</strong> This action cannot be undone. This note will be permanently deleted.
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
                onClick={deleteNote}
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Note
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

      {/* View Password Modal */}
      {viewPasswordModalId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">
                {passwordAction === 'edit' ? 'Enter Password to Edit' : 
                 passwordAction === 'inactivate' ? 'Enter Password to Inactivate' : 
                 'Enter View Password'}
              </h3>
              <button
                onClick={() => {
                  setViewPasswordModalId(null);
                  setViewPasswordInput('');
                  setShowViewPassword(false);
                  setPasswordAction(null);
                }}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              {passwordAction === 'edit' ? 'This note is password protected. Please enter the password to edit.' :
               passwordAction === 'inactivate' ? 'This note is password protected. Please enter the password to inactivate.' :
               'This note is password protected. Please enter the password to view.'}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showViewPassword ? "text" : "password"}
                    value={viewPasswordInput}
                    onChange={(e) => setViewPasswordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        confirmViewWithPassword();
                      } else if (e.key === 'Escape') {
                        setViewPasswordModalId(null);
                        setViewPasswordInput('');
                        setShowViewPassword(false);
                        setPasswordAction(null);
                      }
                    }}
                    className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    placeholder="Enter password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowViewPassword(!showViewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label={showViewPassword ? "Hide password" : "Show password"}
                  >
                    {showViewPassword ? (
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
                  onClick={confirmViewWithPassword}
                  disabled={!viewPasswordInput.trim() || isLoading}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {passwordAction === 'edit' ? 'Edit Note' :
                   passwordAction === 'inactivate' ? 'Inactivate Note' :
                   'View Note'}
                </button>
                <button
                  onClick={() => {
                    setViewPasswordModalId(null);
                    setViewPasswordInput('');
                    setShowViewPassword(false);
                    setPasswordAction(null);
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

      {/* View Note Modal */}
      {viewNoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">View Note</h3>
              <button
                onClick={() => setViewNoteModal(null)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <span className="text-sm font-medium text-slate-300">
                  Note Name:
                </span>
                <span className="text-slate-100 text-base ml-2">{viewNoteModal.noteName}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-300">
                  Created Date:
                </span>
                <span className="text-slate-100 text-base ml-2">
                  {new Date(viewNoteModal.createdDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Note
                </label>
                <div className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 whitespace-pre-wrap break-words">
                  {viewNoteModal.note}
                </div>
              </div>
              {viewNoteModal.tags && viewNoteModal.tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {viewNoteModal.tags.map((tagId) => {
                      const tag = tags.find(t => t.id === tagId);
                      return tag ? (
                        <span
                          key={tagId}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs"
                        >
                          {tag.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setViewNoteModal(null)}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
