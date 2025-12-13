'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type CalendarCategory = {
  id: string;
  name: string;
  isDefault: boolean;
  card_color: string | null;
};

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  time?: string | null; // Optional time in HH:MM format (24-hour)
  frequency: 'One Time' | 'Weekly' | 'Monthly' | 'Annual';
  notes: string;
  isActive: boolean;
  addToDashboard: boolean;
  categoryId: string;
  endDate?: string | null;
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dayOfMonth?: number; // 1-31
  dateInactivated?: string | null;
};

const DEFAULT_CATEGORIES = [
  { name: 'Holiday', color: '#ef4444' }, // red
  { name: 'Birthday', color: '#f59e0b' }, // amber
  { name: 'Anniversary', color: '#8b5cf6' }, // purple
];

const FREQUENCY_OPTIONS: ('One Time' | 'Weekly' | 'Monthly' | 'Annual')[] = [
  'One Time',
  'Weekly',
  'Monthly',
  'Annual'
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' }
];

type CommonHoliday = {
  name: string;
  getDate: (year: number) => string; // Returns date in YYYY-MM-DD format
};

// Helper functions to calculate holiday dates
const getNthWeekdayOfMonth = (year: number, month: number, weekday: number, nth: number): Date => {
  // weekday: 0 = Sunday, 1 = Monday, etc.
  // nth: 1 = first, 2 = second, etc.
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  let date = 1 + (weekday - firstWeekday + 7) % 7;
  date += (nth - 1) * 7;
  return new Date(year, month, date);
};

const getLastWeekdayOfMonth = (year: number, month: number, weekday: number): Date => {
  const lastDay = new Date(year, month + 1, 0);
  const lastWeekday = lastDay.getDay();
  let date = lastDay.getDate() - (lastWeekday - weekday + 7) % 7;
  return new Date(year, month, date);
};

const COMMON_US_HOLIDAYS: CommonHoliday[] = [
  {
    name: "New Year's Day",
    getDate: (year) => `${year}-01-01`
  },
  {
    name: "Martin Luther King Jr. Day",
    getDate: (year) => {
      const date = getNthWeekdayOfMonth(year, 0, 1, 3); // Third Monday of January
      return date.toISOString().split('T')[0];
    }
  },
  {
    name: "Presidents' Day",
    getDate: (year) => {
      const date = getNthWeekdayOfMonth(year, 1, 1, 3); // Third Monday of February
      return date.toISOString().split('T')[0];
    }
  },
  {
    name: "Memorial Day",
    getDate: (year) => {
      const date = getLastWeekdayOfMonth(year, 4, 1); // Last Monday of May
      return date.toISOString().split('T')[0];
    }
  },
  {
    name: "Independence Day",
    getDate: (year) => `${year}-07-04`
  },
  {
    name: "Labor Day",
    getDate: (year) => {
      const date = getNthWeekdayOfMonth(year, 8, 1, 1); // First Monday of September
      return date.toISOString().split('T')[0];
    }
  },
  {
    name: "Columbus Day",
    getDate: (year) => {
      const date = getNthWeekdayOfMonth(year, 9, 1, 2); // Second Monday of October
      return date.toISOString().split('T')[0];
    }
  },
  {
    name: "Veterans Day",
    getDate: (year) => `${year}-11-11`
  },
  {
    name: "Thanksgiving",
    getDate: (year) => {
      const date = getNthWeekdayOfMonth(year, 10, 4, 4); // Fourth Thursday of November
      return date.toISOString().split('T')[0];
    }
  },
  {
    name: "Christmas",
    getDate: (year) => `${year}-12-25`
  }
];

type CalendarEventsToolProps = {
  toolId?: string;
};

export function CalendarEventsTool({ toolId }: CalendarEventsToolProps) {
  // Category management
  const [categories, setCategories] = useState<CalendarCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Category editing
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryColor, setEditingCategoryColor] = useState('#10b981'); // Default emerald
  
  // Category menu (ellipsis popup)
  const [menuOpenCategoryId, setMenuOpenCategoryId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // Delete confirmation
  const [deleteConfirmCategoryId, setDeleteConfirmCategoryId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Calendar Events
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time: '' as string | null,
    frequency: 'One Time' as 'One Time' | 'Weekly' | 'Monthly' | 'Annual',
    notes: '',
    addToDashboard: true,
    endDate: '' as string | null,
    daysOfWeek: [] as number[],
    dayOfMonth: undefined as number | undefined
  });
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState({
    title: '',
    date: '',
    time: '' as string | null,
    frequency: 'One Time' as 'One Time' | 'Weekly' | 'Monthly' | 'Annual',
    notes: '',
    addToDashboard: true,
    endDate: '' as string | null,
    daysOfWeek: [] as number[],
    dayOfMonth: undefined as number | undefined
  });

  // Holiday selection modal
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  
  // History state
  const [showHistory, setShowHistory] = useState(false);
  
  // Export state
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(false);

  // Initialize default categories on mount
  useEffect(() => {
    if (toolId) {
      loadCategories();
    } else {
      setIsLoading(false);
      setSaveMessage({ type: 'error', text: 'Tool ID is missing. Please refresh the page.' });
    }
  }, [toolId]);

  // Load all events when categories are loaded
  useEffect(() => {
    if (categories.length > 0 && toolId) {
      // Load events for all categories
      const loadAllEvents = async () => {
        try {
          const response = await fetch(`/api/tools/calendar-events?toolId=${toolId}`);
          const data = await response.json();
          
          if (response.ok) {
            if (data.events && Array.isArray(data.events)) {
              const mappedEvents: CalendarEvent[] = data.events.map((e: any) => ({
                id: e.id,
                title: e.title,
                date: e.date,
                time: e.time || null,
                frequency: e.frequency as 'One Time' | 'Weekly' | 'Monthly' | 'Annual',
                notes: e.notes || '',
                isActive: e.is_active !== false,
                addToDashboard: e.add_to_dashboard !== undefined ? e.add_to_dashboard : true,
                categoryId: e.category_id,
                endDate: e.end_date || null,
                daysOfWeek: e.days_of_week ? (Array.isArray(e.days_of_week) ? e.days_of_week : (typeof e.days_of_week === 'string' ? JSON.parse(e.days_of_week) : e.days_of_week)) : undefined,
                dayOfMonth: e.day_of_month || undefined,
                dateInactivated: e.date_inactivated || null
              }));
              setCalendarEvents(mappedEvents);
            }
          }
        } catch (error) {
          console.error('Error loading all events:', error);
        }
      };
      loadAllEvents();
    }
  }, [categories.length, toolId]);

  const loadCategories = async () => {
    if (!toolId) {
      setSaveMessage({ type: 'error', text: 'Tool ID is missing. Please refresh the page.' });
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tools/calendar-events?toolId=${toolId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load categories');
      }
      
      if (data.categories && data.categories.length > 0) {
        // Map database categories to component format
        const mappedCategories: CalendarCategory[] = data.categories.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          isDefault: cat.is_default || false,
          card_color: cat.card_color
        }));
        setCategories(mappedCategories);
      } else {
        // No categories exist - create default categories
        const defaultCats: CalendarCategory[] = [];
        for (const defaultCat of DEFAULT_CATEGORIES) {
          try {
            const createResponse = await fetch('/api/tools/calendar-events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                toolId,
                action: 'create_category',
                category: {
                  name: defaultCat.name,
                  isDefault: true,
                  card_color: defaultCat.color
                }
              })
            });
            const createData = await createResponse.json();
            if (createData.category) {
              defaultCats.push({
                id: createData.category.id,
                name: createData.category.name,
                isDefault: createData.category.is_default || false,
                card_color: createData.category.card_color
              });
            }
          } catch (err) {
            console.error(`Error creating default category ${defaultCat.name}:`, err);
          }
        }
        setCategories(defaultCats);
      }
      
      setSaveMessage(null);
    } catch (error) {
      console.error('Error loading categories:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load categories';
      setSaveMessage({ type: 'error', text: errorMessage });
      // Set empty array so UI can still function
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategoryEvents = async (categoryId: string) => {
    if (!toolId) return;
    
    try {
      const response = await fetch(`/api/tools/calendar-events?toolId=${toolId}&categoryId=${categoryId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load events');
      }
      
      // Map database events to component format
      const mappedEvents: CalendarEvent[] = (data.events || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        time: e.time || null,
        frequency: e.frequency as 'One Time' | 'Weekly' | 'Monthly' | 'Annual',
        notes: e.notes || '',
        isActive: e.is_active !== false,
        addToDashboard: e.add_to_dashboard !== undefined ? e.add_to_dashboard : true,
        categoryId: e.category_id,
        endDate: e.end_date || null,
        daysOfWeek: e.days_of_week ? (Array.isArray(e.days_of_week) ? e.days_of_week : JSON.parse(e.days_of_week)) : undefined,
        dayOfMonth: e.day_of_month || undefined,
        dateInactivated: e.date_inactivated || null
      }));
      
      // Update calendar events - merge with existing to preserve events from other categories
      setCalendarEvents(prev => {
        // Remove events from this category and add the loaded ones
        const otherEvents = prev.filter(e => e.categoryId !== categoryId);
        return [...otherEvents, ...mappedEvents];
      });
    } catch (error) {
      console.error('Error loading category events:', error);
      setSaveMessage({ type: 'error', text: 'Failed to load calendar events' });
    }
  };

  const selectCategory = async (categoryId: string) => {
    // Ensure the category exists before selecting
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      setSelectedCategoryId(categoryId);
      await loadCategoryEvents(categoryId);
    }
  };

  const createNewCategory = async () => {
    if (!newCategoryName.trim() || !toolId) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/tools/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          action: 'create_category',
          category: {
            name: newCategoryName.trim(),
            isDefault: false,
            card_color: '#10b981'
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create category');
      }

      if (data.category) {
        const newCategory: CalendarCategory = {
          id: data.category.id,
          name: data.category.name,
          isDefault: data.category.is_default || false,
          card_color: data.category.card_color
        };
        
        setCategories(prev => [...prev, newCategory]);
        setSelectedCategoryId(newCategory.id);
        await loadCategoryEvents(newCategory.id);
      }
      
      setIsCreatingNewCategory(false);
      setNewCategoryName('');
      setSaveMessage({ type: 'success', text: 'Category created successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error creating category:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create category' });
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingCategory = (category: CalendarCategory) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setEditingCategoryColor(category.card_color || '#10b981');
  };

  const cancelEditingCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
    setEditingCategoryColor('#10b981');
    setMenuOpenCategoryId(null);
    setShowColorPicker(false);
  };

  const handleChangeColor = (category: CalendarCategory) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setEditingCategoryColor(category.card_color || '#10b981');
    setMenuOpenCategoryId(null);
    setShowColorPicker(true);
  };

  const handleSaveColorOnly = async () => {
    if (!editingCategoryId || !toolId) return;

    setIsSaving(true);
    try {
      const category = categories.find(c => c.id === editingCategoryId);
      if (!category) return;

      const response = await fetch('/api/tools/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          action: 'update_category',
          category: {
            id: editingCategoryId,
            name: category.name,
            card_color: editingCategoryColor
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update category color');
      }

      if (data.category) {
        setCategories(prev => prev.map(cat =>
          cat.id === editingCategoryId
            ? { ...cat, card_color: data.category.card_color }
            : cat
        ));
      }
      
      setEditingCategoryId(null);
      setShowColorPicker(false);
      setSaveMessage({ type: 'success', text: 'Category color updated successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error updating category color:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update category color' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveCategoryEdit = async () => {
    if (!editingCategoryId || !toolId) return;
    
    if (!editingCategoryName.trim()) {
      setSaveMessage({ type: 'error', text: 'Category name cannot be empty' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/tools/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          action: 'update_category',
          category: {
            id: editingCategoryId,
            name: editingCategoryName.trim(),
            card_color: editingCategoryColor
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update category');
      }

      if (data.category) {
        setCategories(prev => prev.map(cat =>
          cat.id === editingCategoryId
            ? { ...cat, name: data.category.name, card_color: data.category.card_color }
            : cat
        ));
      }
      
      setEditingCategoryId(null);
      setSaveMessage({ type: 'success', text: 'Category updated successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error updating category:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update category' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCategory = async () => {
    if (!deleteConfirmCategoryId || !toolId) return;

    if (deleteConfirmText.toLowerCase() !== 'delete') {
      setSaveMessage({ type: 'error', text: 'Please type "delete" to confirm' });
      return;
    }

    setIsSaving(true);
    try {
      const categoryToDelete = categories.find(c => c.id === deleteConfirmCategoryId);
      if (categoryToDelete?.isDefault) {
        setSaveMessage({ type: 'error', text: 'Default categories cannot be deleted' });
        setIsSaving(false);
        return;
      }

      const response = await fetch('/api/tools/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          action: 'delete_category',
          category: { id: deleteConfirmCategoryId }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete category');
      }

      // Remove category and its events from local state
      setCategories(prev => prev.filter(cat => cat.id !== deleteConfirmCategoryId));
      setCalendarEvents(prev => prev.filter(event => event.categoryId !== deleteConfirmCategoryId));
      
      // If the deleted category was selected, clear selection
      if (selectedCategoryId === deleteConfirmCategoryId) {
        setSelectedCategoryId(null);
      }
      
      setDeleteConfirmCategoryId(null);
      setDeleteConfirmText('');
      setSaveMessage({ type: 'success', text: 'Category deleted successfully' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting category:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete category' });
    } finally {
      setIsSaving(false);
    }
  };

  const addCalendarEvent = async () => {
    if (!selectedCategoryId || !newEvent.title.trim() || !newEvent.date || !toolId) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/tools/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          action: 'create_event',
          event: {
            categoryId: selectedCategoryId,
            title: newEvent.title.trim(),
            date: newEvent.date,
            time: newEvent.time || null,
            frequency: newEvent.frequency,
            notes: newEvent.notes || '',
            isActive: true,
            addToDashboard: newEvent.addToDashboard,
            endDate: newEvent.endDate || null,
            daysOfWeek: newEvent.frequency === 'Weekly' && newEvent.daysOfWeek && newEvent.daysOfWeek.length > 0
              ? newEvent.daysOfWeek
              : undefined,
            dayOfMonth: newEvent.frequency === 'Monthly' ? newEvent.dayOfMonth : undefined
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create calendar event');
      }

      if (data.event) {
        const newEvent: CalendarEvent = {
          id: data.event.id,
          title: data.event.title,
          date: data.event.date,
          time: data.event.time || null,
          frequency: data.event.frequency as 'One Time' | 'Weekly' | 'Monthly' | 'Annual',
          notes: data.event.notes || '',
          isActive: data.event.is_active !== false,
          addToDashboard: data.event.add_to_dashboard !== undefined ? data.event.add_to_dashboard : true,
          categoryId: data.event.category_id,
          endDate: data.event.end_date || null,
          daysOfWeek: data.event.days_of_week ? (Array.isArray(data.event.days_of_week) ? data.event.days_of_week : JSON.parse(data.event.days_of_week)) : undefined,
          dayOfMonth: data.event.day_of_month || undefined,
          dateInactivated: data.event.date_inactivated || null
        };
        
        setCalendarEvents(prev => [...prev, newEvent]);
      }
      
      setNewEvent({
        title: '',
        date: '',
        time: null,
        frequency: 'One Time',
        notes: '',
        addToDashboard: true,
        endDate: null,
        daysOfWeek: [],
        dayOfMonth: undefined
      });
      setSaveMessage({ type: 'success', text: 'Calendar event added successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error creating calendar event:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create calendar event' });
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingEvent = (event: CalendarEvent) => {
    setEditingEventId(event.id);
    setEditingEvent({
      title: event.title,
      date: event.date,
      frequency: event.frequency,
      notes: event.notes || '',
      addToDashboard: event.addToDashboard,
      endDate: event.endDate || null,
      daysOfWeek: event.daysOfWeek || [],
      dayOfMonth: event.dayOfMonth
    });
  };

  const cancelEditingEvent = () => {
    setEditingEventId(null);
    setEditingEvent({
      title: '',
      date: '',
      time: null,
      frequency: 'One Time',
      notes: '',
      addToDashboard: true,
      endDate: null,
      daysOfWeek: [],
      dayOfMonth: undefined
    });
  };

  const saveEventEdit = async () => {
    if (!editingEventId || !editingEvent.title.trim() || !editingEvent.date || !toolId) return;
    
    setIsSaving(true);
    try {
      const eventToUpdate = calendarEvents.find(e => e.id === editingEventId);
      if (!eventToUpdate) return;

      const response = await fetch('/api/tools/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          action: 'update_event',
          event: {
            id: editingEventId,
            title: editingEvent.title.trim(),
            date: editingEvent.date,
            time: editingEvent.time || null,
            frequency: editingEvent.frequency,
            notes: editingEvent.notes || '',
            isActive: eventToUpdate.isActive,
            addToDashboard: editingEvent.addToDashboard,
            endDate: editingEvent.endDate || null,
            daysOfWeek: editingEvent.frequency === 'Weekly' && editingEvent.daysOfWeek && editingEvent.daysOfWeek.length > 0
              ? editingEvent.daysOfWeek
              : undefined,
            dayOfMonth: editingEvent.frequency === 'Monthly' ? editingEvent.dayOfMonth : undefined
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update calendar event');
      }

      if (data.event) {
        const updatedEvent: CalendarEvent = {
          id: data.event.id,
          title: data.event.title,
          date: data.event.date,
          time: data.event.time || null,
          frequency: data.event.frequency as 'One Time' | 'Weekly' | 'Monthly' | 'Annual',
          notes: data.event.notes || '',
          isActive: data.event.is_active !== false,
          addToDashboard: data.event.add_to_dashboard !== undefined ? data.event.add_to_dashboard : true,
          categoryId: data.event.category_id,
          endDate: data.event.end_date || null,
          daysOfWeek: data.event.days_of_week ? (Array.isArray(data.event.days_of_week) ? data.event.days_of_week : JSON.parse(data.event.days_of_week)) : undefined,
          dayOfMonth: data.event.day_of_month || undefined,
          dateInactivated: data.event.date_inactivated || null
        };
        
        setCalendarEvents(prev => prev.map(event =>
          event.id === editingEventId ? updatedEvent : event
        ));
      }
      
      setEditingEventId(null);
      setEditingEvent({
        title: '',
        date: '',
        frequency: 'One Time',
        notes: '',
        addToDashboard: true,
        endDate: null,
        daysOfWeek: [],
        dayOfMonth: undefined
      });
      setSaveMessage({ type: 'success', text: 'Calendar event updated successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error updating calendar event:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update calendar event' });
    } finally {
      setIsSaving(false);
    }
  };

  const inactivateEvent = async (eventId: string) => {
    if (!toolId) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/tools/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          action: 'inactivate_event',
          event: { id: eventId }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to inactivate event');
      }

      if (data.event) {
        setCalendarEvents(prev => prev.map(event =>
          event.id === eventId
            ? { ...event, isActive: false, dateInactivated: data.event.date_inactivated }
            : event
        ));
      }
      
      setSaveMessage({ type: 'success', text: 'Calendar event moved to history' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error inactivating event:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to inactivate event' });
    } finally {
      setIsSaving(false);
    }
  };

  const reactivateEvent = async (eventId: string) => {
    if (!toolId) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/tools/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          action: 'reactivate_event',
          event: { id: eventId }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reactivate event');
      }

      if (data.event) {
        setCalendarEvents(prev => prev.map(event =>
          event.id === eventId
            ? { ...event, isActive: true, dateInactivated: null }
            : event
        ));
      }
      
      setSaveMessage({ type: 'success', text: 'Calendar event reactivated' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error reactivating event:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to reactivate event' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!toolId) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/tools/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          action: 'delete_event',
          event: { id: eventId }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete event');
      }

      setCalendarEvents(prev => prev.filter(event => event.id !== eventId));
      setSaveMessage({ type: 'success', text: 'Calendar event deleted' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting event:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete event' });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to parse YYYY-MM-DD string as local date (not UTC)
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed in Date constructor
  };

  // Helper function to format date as YYYY-MM-DD for input fields
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const exportToPDF = async () => {
    // Group all events by category
    const eventsByCategory = categories.map(category => {
      const categoryEvents = calendarEvents.filter(e => e.categoryId === category.id);
      const activeEvents = categoryEvents.filter(e => e.isActive);
      const historyEvents = categoryEvents.filter(e => !e.isActive);
      return {
        category,
        activeEvents,
        historyEvents,
        allEvents: includeHistory ? [...activeEvents, ...historyEvents] : activeEvents
      };
    });

    // Load jsPDF from CDN
    let jsPDF: any;
    if ((window as any).jspdf?.jsPDF) {
      jsPDF = (window as any).jspdf.jsPDF;
    } else {
      await new Promise<void>((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => {
          jsPDF = (window as any).jspdf.jsPDF;
          resolve();
        };
        document.head.appendChild(script);
      });
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = margin;

    // Light mode colors
    const colors = {
      background: [255, 255, 255],
      text: [0, 0, 0],
      title: [0, 0, 0],
      header: [240, 240, 240],
      border: [200, 200, 200],
      accent: [16, 185, 129] // emerald-500
    };

    // Helper function to add a new page if needed
    const checkNewPage = (requiredHeight: number) => {
      if (yPos + requiredHeight > pageHeight - margin) {
        pdf.addPage();
        yPos = margin;
        return true;
      }
      return false;
    };

    // Helper function to add a section header
    const addSectionHeader = (title: string) => {
      checkNewPage(15);
      pdf.setFillColor(...colors.header);
      pdf.rect(margin, yPos, contentWidth, 10, 'F');
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...colors.title);
      pdf.text(title, margin + 5, yPos + 7);
      yPos += 15;
    };

    // Helper function to add text with wrapping
    const addText = (text: string, fontSize: number = 10, isBold: boolean = false, indent: number = 0) => {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      pdf.setTextColor(...colors.text);
      
      const maxWidth = contentWidth - indent - 5;
      const lines = pdf.splitTextToSize(text, maxWidth);
      
      checkNewPage(lines.length * (fontSize * 0.4) + 2);
      
      lines.forEach((line: string) => {
        pdf.text(line, margin + indent, yPos);
        yPos += fontSize * 0.4;
      });
      yPos += 2;
    };

    // Title
    pdf.setFillColor(...colors.background);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...colors.title);
    const title = 'Calendar Events - Complete Report';
    const titleWidth = pdf.getTextWidth(title);
    pdf.text(title, (pageWidth - titleWidth) / 2, yPos);
    yPos += 15;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...colors.text);
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    pdf.text(`Generated on: ${dateStr}`, margin, yPos);
    yPos += 10;

    // Summary Section
    const totalActiveEvents = eventsByCategory.reduce((sum, cat) => sum + cat.activeEvents.length, 0);
    const totalHistoryEvents = eventsByCategory.reduce((sum, cat) => sum + cat.historyEvents.length, 0);
    const totalEvents = includeHistory 
      ? totalActiveEvents + totalHistoryEvents 
      : totalActiveEvents;

    addSectionHeader('Summary');
    addText(`Total Events: ${totalEvents}`, 12, true, 5);
    addText(`Active Events: ${totalActiveEvents}`, 10, false, 5);
    if (includeHistory) {
      addText(`Inactive Events: ${totalHistoryEvents}`, 10, false, 5);
    }
    addText(`Categories: ${categories.length}`, 10, false, 5);
    yPos += 5;

    // Events by Category
    eventsByCategory.forEach(({ category, allEvents }) => {
      if (allEvents.length === 0) return;

      addSectionHeader(category.name);
      
      // Sort events by date
      const sortedEvents = [...allEvents].sort((a, b) => {
        const dateA = parseLocalDate(a.date);
        const dateB = parseLocalDate(b.date);
        return dateA.getTime() - dateB.getTime();
      });
      
      sortedEvents.forEach((event) => {
        checkNewPage(25);
        
        addText(event.title, 11, true, 10);
        addText(`Date: ${parseLocalDate(event.date).toLocaleDateString()}`, 9, false, 10);
        addText(`Frequency: ${event.frequency}`, 9, false, 10);
        
        if (event.time) {
          addText(`Time: ${event.time}`, 9, false, 10);
        }
        
        if (event.endDate) {
          addText(`End Date: ${parseLocalDate(event.endDate).toLocaleDateString()}`, 9, false, 10);
        }
        
        if (event.frequency === 'Weekly' && event.daysOfWeek && event.daysOfWeek.length > 0) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const days = event.daysOfWeek.map(d => dayNames[d]).join(', ');
          addText(`Days of Week: ${days}`, 9, false, 10);
        }
        
        if (event.frequency === 'Monthly' && event.dayOfMonth) {
          addText(`Day of Month: ${event.dayOfMonth}`, 9, false, 10);
        }
        
        if (!event.isActive && event.dateInactivated) {
          addText(`Date Inactivated: ${parseLocalDate(event.dateInactivated).toLocaleDateString()}`, 9, false, 10);
        }
        
        if (event.notes) {
          addText(`Notes: ${event.notes}`, 9, false, 10);
        }
        
        if (event.addToDashboard) {
          addText('On Dashboard Calendar: Yes', 9, false, 10);
        }
        
        yPos += 3;
      });
      
      yPos += 5; // Extra space between categories
    });

    // Save PDF
    const fileName = `Calendar_Events_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    setShowExportPopup(false);
  };

  const handleHolidaySelect = (holiday: CommonHoliday) => {
    const currentYear = new Date().getFullYear();
    const holidayDate = holiday.getDate(currentYear);
    
    // Check if the date has passed this year, if so use next year
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to compare dates only
    const holidayDateObj = parseLocalDate(holidayDate);
    holidayDateObj.setHours(0, 0, 0, 0);
    const yearToUse = holidayDateObj < today ? currentYear + 1 : currentYear;
    const finalDate = holiday.getDate(yearToUse);
    
    setNewEvent({
      title: holiday.name,
      date: finalDate,
      time: null,
      frequency: 'Annual',
      notes: '',
      addToDashboard: true,
      endDate: null,
      daysOfWeek: [],
      dayOfMonth: undefined
    });
    
    setShowHolidayModal(false);
  };

  const selectedCategory = selectedCategoryId ? categories.find(c => c.id === selectedCategoryId) : null;
  const activeEvents = selectedCategoryId ? calendarEvents.filter(e => e.categoryId === selectedCategoryId && e.isActive) : [];
  const historyEvents = selectedCategoryId ? calendarEvents.filter(e => e.categoryId === selectedCategoryId && !e.isActive) : [];

  return (
    <div className="space-y-6">
      {/* Save Message */}
      {saveMessage && (
        <div className={`rounded-lg p-4 ${
          saveMessage.type === 'success' 
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' 
            : 'bg-red-500/20 text-red-300 border border-red-500/50'
        }`}>
          {saveMessage.text}
        </div>
      )}

      {/* Categories List */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-50">Calendar Categories</h2>
          <button
            onClick={() => setShowExportPopup(true)}
            className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors"
            title="Export all calendar events to PDF"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>
        {!isCreatingNewCategory ? (
          <div className="flex items-end gap-2 flex-wrap">
            {categories.map((category) => (
              editingCategoryId === category.id && showColorPicker ? (
                // Color picker mode
                <div
                  key={category.id}
                  className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 min-w-[180px]"
                >
                  <div className="mb-3">
                    <div className="font-medium text-slate-200 mb-2 text-sm">{category.name}</div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400">Card Color:</label>
                      <input
                        type="color"
                        value={editingCategoryColor}
                        onChange={(e) => setEditingCategoryColor(e.target.value)}
                        className="h-8 w-16 rounded border border-slate-600 cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveColorOnly}
                      disabled={isSaving}
                      className="flex-1 px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingCategoryId(null);
                        setShowColorPicker(false);
                      }}
                      className="px-2 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : editingCategoryId === category.id ? (
                // Edit mode
                <div
                  key={category.id}
                  className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 min-w-[180px]"
                >
                  <input
                    type="text"
                    value={editingCategoryName}
                    onChange={(e) => setEditingCategoryName(e.target.value)}
                    className="w-full px-2 py-1 rounded border border-slate-600 bg-slate-900 text-slate-100 text-sm mb-2 focus:border-emerald-500/50 focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveCategoryEdit();
                      } else if (e.key === 'Escape') {
                        cancelEditingCategory();
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveCategoryEdit}
                      disabled={isSaving || !editingCategoryName.trim()}
                      className="flex-1 px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEditingCategory}
                      className="px-2 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // Display mode
                <div
                  key={category.id}
                  className="relative"
                >
                  <button
                    onClick={() => selectCategory(category.id)}
                    className={`px-4 py-3 rounded-lg border transition-all duration-200 min-w-[120px] relative ${
                      selectedCategoryId === category.id
                        ? 'shadow-lg'
                        : 'hover:border-slate-600'
                    }`}
                    style={{
                      borderColor: category.card_color || '#10b981',
                      backgroundColor: selectedCategoryId === category.id 
                        ? `${category.card_color || '#10b981'}15` 
                        : `${category.card_color || '#10b981'}08`,
                      color: category.card_color || '#10b981',
                    }}
                  >
                    <div className="font-medium text-center">{category.name}</div>
                  </button>
                  {/* Ellipsis Menu Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenCategoryId(menuOpenCategoryId === category.id ? null : category.id);
                    }}
                    className="absolute top-1 right-1 p-1 rounded hover:bg-slate-700/50 transition-colors"
                    title="Category options"
                  >
                    <svg className="h-4 w-4 text-slate-400 hover:text-slate-200" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>
                  {/* Menu Popup */}
                  {menuOpenCategoryId === category.id && (
                    <div className="absolute top-10 right-0 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-lg min-w-[160px] py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingCategory(category);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Name
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChangeColor(category);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        Change Color
                      </button>
                      {!category.isDefault && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenCategoryId(null);
                            setDeleteConfirmCategoryId(category.id);
                            setDeleteConfirmText('');
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            ))}
            
            {/* Add New Category Button */}
            <button
              onClick={() => {
                setIsCreatingNewCategory(true);
                setSelectedCategoryId(null);
                setEditingCategoryId(null);
              }}
              className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all duration-200 flex items-center justify-center min-w-[60px]"
              title="Add New Category"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                New Category Name
              </label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name"
                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    createNewCategory();
                  } else if (e.key === 'Escape') {
                    setIsCreatingNewCategory(false);
                    setNewCategoryName('');
                  }
                }}
                autoFocus
              />
            </div>
            <button
              onClick={createNewCategory}
              disabled={!newCategoryName.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreatingNewCategory(false);
                setNewCategoryName('');
              }}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-slate-400">Loading categories...</p>
        </div>
      )}

      {/* Click outside to close menu */}
      {menuOpenCategoryId && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuOpenCategoryId(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmCategoryId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete Category</h3>
            <p className="text-slate-300 mb-4">
              <strong className="text-red-400">Warning:</strong> This action cannot be undone. All calendar events in this category will be permanently deleted.
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
                  setDeleteConfirmCategoryId(null);
                  setDeleteConfirmText('');
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={deleteCategory}
                disabled={deleteConfirmText.toLowerCase() !== 'delete' || isSaving}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Deleting...' : 'Delete Category'}
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmCategoryId(null);
                  setDeleteConfirmText('');
                }}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !selectedCategoryId && !isCreatingNewCategory && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-slate-400 mb-4">Please select a category or create a new one to get started.</p>
        </div>
      )}

      {selectedCategoryId && selectedCategory && (
        <>
          {/* Category Header */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">
                {selectedCategory.name} Calendar Events
              </h3>
            </div>

            {/* Add New Event Form */}
            <div className="space-y-4 mb-6">
              {/* Add Common Holiday Button - Only show for Holiday category */}
              {selectedCategory.name === 'Holiday' && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowHolidayModal(true)}
                    className="px-4 py-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors flex items-center gap-2"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Common Holiday
                  </button>
                </div>
              )}
              {/* Title - Full width */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Enter event title"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>

              {/* Date and Time - Side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Time (Optional)
                  </label>
                  <input
                    type="time"
                    value={newEvent.time || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value || null })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                  <p className="text-xs text-slate-400 mt-1">Leave empty for all-day event (defaults to 9:00 AM)</p>
                </div>
              </div>

              {/* Row 2: Frequency and conditional inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Frequency <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={newEvent.frequency}
                    onChange={(e) => {
                      const newFreq = e.target.value as typeof newEvent.frequency;
                      setNewEvent({ 
                        ...newEvent, 
                        frequency: newFreq,
                        // Reset conditional fields when frequency changes
                        daysOfWeek: newFreq === 'Weekly' ? newEvent.daysOfWeek : [],
                        dayOfMonth: newFreq === 'Monthly' ? newEvent.dayOfMonth : undefined
                      });
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  >
                    {FREQUENCY_OPTIONS.map(freq => (
                      <option key={freq} value={freq}>{freq}</option>
                    ))}
                  </select>
                </div>
                
                {/* Days of Week - Only for Weekly frequency */}
                {newEvent.frequency === 'Weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Days of Week
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map(day => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            const isSelected = newEvent.daysOfWeek?.includes(day.value);
                            setNewEvent({
                              ...newEvent,
                              daysOfWeek: isSelected
                                ? newEvent.daysOfWeek?.filter(d => d !== day.value) || []
                                : [...(newEvent.daysOfWeek || []), day.value]
                            });
                          }}
                          className={`px-3 py-2 rounded-lg border transition-colors ${
                            newEvent.daysOfWeek?.includes(day.value)
                              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                              : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {day.short}
                        </button>
                      ))}
                    </div>
                    {newEvent.daysOfWeek && newEvent.daysOfWeek.length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">Select at least one day</p>
                    )}
                  </div>
                )}

                {/* Day of Month - Only for Monthly frequency */}
                {newEvent.frequency === 'Monthly' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Day of Month
                    </label>
                    <select
                      value={newEvent.dayOfMonth || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, dayOfMonth: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    >
                      <option value="">Select day of month</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Checkbox below frequency */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="addToDashboardNew"
                  checked={newEvent.addToDashboard}
                  onChange={(e) => setNewEvent({ ...newEvent, addToDashboard: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                />
                <label htmlFor="addToDashboardNew" className="text-sm text-slate-300 cursor-pointer">
                  Show on Dashboard Calendar
                </label>
              </div>
              
              {/* End Date - Optional for all frequencies */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={newEvent.endDate || ''}
                  onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value || null })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
                <p className="text-xs text-slate-400 mt-1">Leave empty for no end date</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes (Optional)</label>
                <textarea
                  value={newEvent.notes}
                  onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })}
                  placeholder="Add any additional notes..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                />
              </div>
              <button
                onClick={addCalendarEvent}
                disabled={!newEvent.title.trim() || !newEvent.date || isSaving}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Add Calendar Event'}
              </button>
            </div>

            {/* Active Events List */}
            {activeEvents.length > 0 && (
              <div className="mt-6">
                <h4 className="text-md font-semibold text-slate-50 mb-4">Active Events</h4>
                <div className="space-y-4">
                  {activeEvents.map(event => (
                    <div key={event.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
                      {editingEventId === event.id ? (
                        <div className="space-y-4">
                          {/* Title - Full width */}
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                            <input
                              type="text"
                              value={editingEvent.title}
                              onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>

                          {/* Date and Time - Side by side */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                              <input
                                type="date"
                                value={editingEvent.date}
                                onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">
                                Time (Optional)
                              </label>
                              <input
                                type="time"
                                value={editingEvent.time || ''}
                                onChange={(e) => setEditingEvent({ ...editingEvent, time: e.target.value || null })}
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                              <p className="text-xs text-slate-400 mt-1">Leave empty for all-day event (defaults to 9:00 AM)</p>
                            </div>
                          </div>

                          {/* Row 2: Frequency and conditional inputs */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Frequency</label>
                              <select
                                value={editingEvent.frequency}
                                onChange={(e) => {
                                  const newFreq = e.target.value as typeof editingEvent.frequency;
                                  setEditingEvent({ 
                                    ...editingEvent, 
                                    frequency: newFreq,
                                    // Reset conditional fields when frequency changes
                                    daysOfWeek: newFreq === 'Weekly' ? editingEvent.daysOfWeek : [],
                                    dayOfMonth: newFreq === 'Monthly' ? editingEvent.dayOfMonth : undefined
                                  });
                                }}
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              >
                                {FREQUENCY_OPTIONS.map(freq => (
                                  <option key={freq} value={freq}>{freq}</option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Days of Week - Only for Weekly frequency */}
                            {editingEvent.frequency === 'Weekly' && (
                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Days of Week
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  {DAYS_OF_WEEK.map(day => (
                                    <button
                                      key={day.value}
                                      type="button"
                                      onClick={() => {
                                        const isSelected = editingEvent.daysOfWeek?.includes(day.value);
                                        setEditingEvent({
                                          ...editingEvent,
                                          daysOfWeek: isSelected
                                            ? editingEvent.daysOfWeek?.filter(d => d !== day.value) || []
                                            : [...(editingEvent.daysOfWeek || []), day.value]
                                        });
                                      }}
                                      className={`px-3 py-2 rounded-lg border transition-colors ${
                                        editingEvent.daysOfWeek?.includes(day.value)
                                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                                          : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                                      }`}
                                    >
                                      {day.short}
                                    </button>
                                  ))}
                                </div>
                                {editingEvent.daysOfWeek && editingEvent.daysOfWeek.length === 0 && (
                                  <p className="text-xs text-slate-400 mt-1">Select at least one day</p>
                                )}
                              </div>
                            )}

                            {/* Day of Month - Only for Monthly frequency */}
                            {editingEvent.frequency === 'Monthly' && (
                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Day of Month
                                </label>
                                <select
                                  value={editingEvent.dayOfMonth || ''}
                                  onChange={(e) => setEditingEvent({ ...editingEvent, dayOfMonth: e.target.value ? parseInt(e.target.value) : undefined })}
                                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                >
                                  <option value="">Select day of month</option>
                                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                    <option key={day} value={day}>{day}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Checkbox below frequency */}
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editingEvent.addToDashboard}
                              onChange={(e) => setEditingEvent({ ...editingEvent, addToDashboard: e.target.checked })}
                              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                            />
                            <label className="text-sm text-slate-300 cursor-pointer">
                              Show on Dashboard Calendar
                            </label>
                          </div>
                          
                          {/* End Date - Optional for all frequencies */}
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              End Date (Optional)
                            </label>
                            <input
                              type="date"
                              value={editingEvent.endDate || ''}
                              onChange={(e) => setEditingEvent({ ...editingEvent, endDate: e.target.value || null })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                            <p className="text-xs text-slate-400 mt-1">Leave empty for no end date</p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                            <textarea
                              value={editingEvent.notes}
                              onChange={(e) => setEditingEvent({ ...editingEvent, notes: e.target.value })}
                              rows={3}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={saveEventEdit}
                              disabled={!editingEvent.title.trim() || !editingEvent.date}
                              className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditingEvent}
                              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-slate-100 font-medium">{event.title}</h4>
                            <p className="text-sm text-slate-400 mt-1">
                              Date: {parseLocalDate(event.date).toLocaleDateString()} | Frequency: {event.frequency}
                            </p>
                            {event.endDate && (
                              <p className="text-sm text-slate-400 mt-1">
                                End Date: {parseLocalDate(event.endDate).toLocaleDateString()}
                              </p>
                            )}
                            {event.frequency === 'Weekly' && event.daysOfWeek && event.daysOfWeek.length > 0 && (
                              <p className="text-sm text-slate-400 mt-1">
                                Days: {event.daysOfWeek
                                  .sort((a, b) => a - b)
                                  .map(d => DAYS_OF_WEEK.find(day => day.value === d)?.short)
                                  .join(', ')}
                              </p>
                            )}
                            {event.frequency === 'Monthly' && event.dayOfMonth && (
                              <p className="text-sm text-slate-400 mt-1">
                                Day of Month: {event.dayOfMonth}
                              </p>
                            )}
                            {event.addToDashboard && (
                              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300 mt-2">
                                On Dashboard
                              </span>
                            )}
                            {event.notes && (
                              <p className="text-sm text-slate-300 mt-2 italic">"{event.notes}"</p>
                            )}
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => startEditingEvent(event)}
                              className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => inactivateEvent(event.id)}
                              className="px-3 py-1 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors text-sm"
                            >
                              Move to History
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History Events List */}
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-50">History</h3>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
                >
                  <span>{showHistory ? 'Hide' : 'Show'}</span>
                  <span> ({historyEvents?.length || 0})</span>
                </button>
              </div>
              {showHistory && (
                historyEvents.length > 0 ? (
                  <div className="space-y-4">
                    {historyEvents.map(event => (
                      <div key={event.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 opacity-75">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-semibold text-slate-300">{event.title}</h4>
                              <span className="px-2 py-1 rounded text-xs font-medium bg-slate-600/50 text-slate-400">
                                {selectedCategory?.name || 'Event'}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-slate-500">Date:</span>
                                <span className="ml-2 text-slate-400">{parseLocalDate(event.date).toLocaleDateString()}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Frequency:</span>
                                <span className="ml-2 text-slate-400 capitalize">{event.frequency}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Inactivated:</span>
                                <span className="ml-2 text-slate-400">
                                  {event.dateInactivated ? parseLocalDate(event.dateInactivated).toLocaleDateString() : 'N/A'}
                                </span>
                              </div>
                            </div>
                            {event.endDate && (
                              <div className="mt-2 text-sm">
                                <span className="text-slate-500">End Date:</span>
                                <span className="ml-2 text-slate-400">{parseLocalDate(event.endDate).toLocaleDateString()}</span>
                              </div>
                            )}
                            {event.frequency === 'Weekly' && event.daysOfWeek && event.daysOfWeek.length > 0 && (
                              <div className="mt-2 text-sm">
                                <span className="text-slate-500">Days:</span>
                                <span className="ml-2 text-slate-400">
                                  {event.daysOfWeek
                                    .sort((a, b) => a - b)
                                    .map(d => DAYS_OF_WEEK.find(day => day.value === d)?.short)
                                    .join(', ')}
                                </span>
                              </div>
                            )}
                            {event.frequency === 'Monthly' && event.dayOfMonth && (
                              <div className="mt-2 text-sm">
                                <span className="text-slate-500">Day of Month:</span>
                                <span className="ml-2 text-slate-400">{event.dayOfMonth}</span>
                              </div>
                            )}
                            {event.notes && (
                              <div className="mt-3">
                                <span className="text-sm text-slate-500">Notes:</span>
                                <p className="text-sm text-slate-400 mt-1 italic">"{event.notes}"</p>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => reactivateEvent(event.id)}
                              className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors text-sm"
                            >
                              Reactivate
                            </button>
                            <button
                              onClick={() => deleteEvent(event.id)}
                              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-8">No inactive events in history.</p>
                )
              )}
            </div>

            {activeEvents.length === 0 && !showHistory && (
              <div className="text-center py-8">
                <p className="text-slate-400">No calendar events yet. Add your first event above.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Holiday Selection Modal */}
      {showHolidayModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-slate-50">Select a Common US Holiday</h3>
              <button
                onClick={() => setShowHolidayModal(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Select a holiday to pre-fill the form. You can edit the details before saving.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {COMMON_US_HOLIDAYS.map((holiday, index) => {
                const currentYear = new Date().getFullYear();
                const holidayDate = holiday.getDate(currentYear);
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Reset time to compare dates only
                const holidayDateObj = parseLocalDate(holidayDate);
                holidayDateObj.setHours(0, 0, 0, 0);
                const yearToUse = holidayDateObj < today ? currentYear + 1 : currentYear;
                const finalDate = holiday.getDate(yearToUse);
                const finalDateObj = parseLocalDate(finalDate);
                const displayDate = finalDateObj.toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                });
                
                return (
                  <button
                    key={index}
                    onClick={() => handleHolidaySelect(holiday)}
                    className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 text-left hover:border-emerald-500/50 hover:bg-slate-800 transition-colors"
                  >
                    <div className="font-medium text-slate-100 mb-1">{holiday.name}</div>
                    <div className="text-sm text-slate-400">{displayDate}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowHolidayModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Popup */}
      {showExportPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">Export Options</h3>
              <button
                onClick={() => setShowExportPopup(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-slate-300 text-sm mb-4">
                Generate a comprehensive PDF report of all your calendar events grouped by category. The report will include all event details and summary statistics.
              </p>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="includeHistoryExport"
                  checked={includeHistory}
                  onChange={(e) => setIncludeHistory(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                />
                <label htmlFor="includeHistoryExport" className="text-slate-300 cursor-pointer">
                  Include inactive events in the report
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={exportToPDF}
                  className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors"
                >
                  Export to PDF
                </button>
                <button
                  onClick={() => setShowExportPopup(false)}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
