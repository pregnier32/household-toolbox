'use client';

import { useState, useEffect } from 'react';
import { useTheme } from './AppThemeProvider';

type SubscriptionFrequency = 'monthly' | 'quarterly' | 'annual';

type Subscription = {
  id: string;
  name: string;
  category: string;
  frequency: SubscriptionFrequency;
  amount: number;
  dayOfMonth: number | null; // null for annual subscriptions
  billedDate: string | null; // only for annual subscriptions
  renewalDate: string | null; // only for annual subscriptions
  addReminderToCalendar: boolean; // only for annual subscriptions
  calendarReminderId: string | null; // ID of the dashboard item if created
  notes: string;
  isActive: boolean;
  dateAdded: string;
  dateInactivated?: string;
};

const DEFAULT_CATEGORIES = [
  'Auto',
  'Education',
  'Finance',
  'Food',
  'Health',
  'Home',
  'IT',
  'Media',
  'Retail',
  'Software',
  'Other'
];

type SubscriptionTrackerToolProps = {
  toolId?: string;
};

export function SubscriptionTrackerTool({ toolId }: SubscriptionTrackerToolProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const titleClass = isLight ? 'text-2xl font-semibold text-slate-900 mb-2' : 'text-2xl font-semibold text-slate-50 mb-2';
  const descClass = isLight ? 'text-slate-600 text-sm' : 'text-slate-400 text-sm';
  const cardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-6';
  const nestedCardClass = isLight
    ? 'p-4 rounded-lg border border-slate-300 bg-slate-50'
    : 'p-4 rounded-lg border border-slate-700 bg-slate-800/50';
  const labelClass = isLight ? 'block text-sm font-medium text-slate-700 mb-2' : 'block text-sm font-medium text-slate-300 mb-2';
  const inputClass = isLight
    ? 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const selectClass = isLight
    ? 'w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const textareaClass = isLight
    ? 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none'
    : 'w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none';
  const primaryButtonClass = isLight
    ? 'px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
    : 'px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
  const secondaryButtonClass = isLight
    ? 'px-4 py-2 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors'
    : 'px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors';
  const tabStripClass = isLight ? 'border-b border-slate-200' : 'border-b border-slate-800';
  const tabActiveClass = isLight ? 'border-b-2 border-emerald-600 text-emerald-900' : 'border-b-2 border-emerald-500 text-emerald-300';
  const tabInactiveClass = isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-300';
  const rowIconEmeraldClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-700 bg-white p-2 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 p-2 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20';
  const rowIconSecondaryClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-slate-400 bg-slate-100 p-2 text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-slate-600 bg-slate-800 p-2 text-slate-200 transition-colors hover:bg-slate-700';
  const rowIconDangerClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-red-300 bg-white p-2 text-red-700 transition-colors hover:bg-red-50 hover:border-red-400'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-800/50 p-2 text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20';
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'export'>('subscriptions');
  const [isLoading, setIsLoading] = useState(false);
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(false);
  
  // Form state
  const [newSubscription, setNewSubscription] = useState({
    name: '',
    category: '',
    customCategory: '',
    frequency: 'monthly' as SubscriptionFrequency,
    amount: '',
    dayOfMonth: '',
    billedDate: '',
    renewalDate: '',
    addReminderToCalendar: false,
    notes: ''
  });
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSubscription, setEditingSubscription] = useState({
    name: '',
    category: '',
    customCategory: '',
    frequency: 'monthly' as SubscriptionFrequency,
    amount: '',
    dayOfMonth: '',
    billedDate: '',
    renewalDate: '',
    addReminderToCalendar: false,
    notes: ''
  });
  const [showCustomCategoryEdit, setShowCustomCategoryEdit] = useState(false);
  
  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Load subscriptions from API
  useEffect(() => {
    const loadSubscriptions = async () => {
      if (!toolId) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/tools/subscription-tracker?toolId=${toolId}`);
        if (response.ok) {
          const data = await response.json();
          // Transform database format to component format
          const transformedSubscriptions: Subscription[] = (data.subscriptions || []).map((sub: any) => ({
            id: sub.id,
            name: sub.name,
            category: sub.category,
            frequency: sub.frequency,
            amount: parseFloat(sub.amount),
            dayOfMonth: sub.day_of_month,
            billedDate: sub.billed_date,
            renewalDate: sub.renewal_date,
            addReminderToCalendar: sub.add_reminder_to_calendar || false,
            calendarReminderId: sub.calendar_reminder_id,
            notes: sub.notes || '',
            isActive: sub.is_active !== false,
            dateAdded: sub.date_added,
            dateInactivated: sub.date_inactivated
          }));
          setSubscriptions(transformedSubscriptions);
        } else {
          console.error('Failed to load subscriptions');
        }
      } catch (error) {
        console.error('Error loading subscriptions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSubscriptions();
  }, [toolId]);

  // Calculate monthly spend
  const calculateMonthlySpend = () => {
    return subscriptions
      .filter(sub => sub.isActive)
      .reduce((total, sub) => {
        let monthlyAmount = sub.amount;
        if (sub.frequency === 'annual') {
          monthlyAmount = sub.amount / 12;
        } else if (sub.frequency === 'quarterly') {
          monthlyAmount = sub.amount / 3;
        }
        return total + monthlyAmount;
      }, 0);
  };

  // Calculate category breakdown for pie chart
  const calculateCategoryBreakdown = () => {
    const categoryTotals: { [key: string]: number } = {};
    
    subscriptions
      .filter(sub => sub.isActive)
      .forEach(sub => {
        let monthlyAmount = sub.amount;
        if (sub.frequency === 'annual') {
          monthlyAmount = sub.amount / 12;
        } else if (sub.frequency === 'quarterly') {
          monthlyAmount = sub.amount / 3;
        }
        
        const category = sub.category;
        categoryTotals[category] = (categoryTotals[category] || 0) + monthlyAmount;
      });
    
    return Object.entries(categoryTotals).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100
    }));
  };

  const handleCategoryChange = (value: string) => {
    if (value === 'Other') {
      setShowCustomCategory(true);
      setNewSubscription({ ...newSubscription, category: '', customCategory: '' });
    } else {
      setShowCustomCategory(false);
      setNewSubscription({ ...newSubscription, category: value, customCategory: '' });
    }
  };

  const handleCategoryChangeEdit = (value: string) => {
    if (value === 'Other') {
      setShowCustomCategoryEdit(true);
      setEditingSubscription({ ...editingSubscription, category: '', customCategory: '' });
    } else {
      setShowCustomCategoryEdit(false);
      setEditingSubscription({ ...editingSubscription, category: value, customCategory: '' });
    }
  };

  const addSubscription = async () => {
    // Validation based on frequency
    if (!newSubscription.name.trim() || !newSubscription.amount) {
      return;
    }

    if (newSubscription.frequency === 'annual') {
      if (!newSubscription.billedDate) {
        return;
      }
    } else {
      if (!newSubscription.dayOfMonth) {
        return;
      }
    }

    const category = showCustomCategory && newSubscription.customCategory.trim()
      ? newSubscription.customCategory.trim()
      : newSubscription.category;

    if (!category) {
      return;
    }

    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    setIsLoading(true);
    try {
      const subscriptionData = {
        name: newSubscription.name.trim(),
        category,
        frequency: newSubscription.frequency,
        amount: parseFloat(newSubscription.amount),
        day_of_month: newSubscription.frequency === 'annual' ? null : parseInt(newSubscription.dayOfMonth),
        billed_date: newSubscription.frequency === 'annual' ? newSubscription.billedDate : null,
        renewal_date: newSubscription.frequency === 'annual' ? newSubscription.renewalDate : null,
        add_reminder_to_calendar: newSubscription.frequency === 'annual' ? (newSubscription.addReminderToCalendar || false) : false,
        notes: newSubscription.notes.trim() || null,
        is_active: true
      };

      const response = await fetch('/api/tools/subscription-tracker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolId,
          subscriptionData
        }),
      });

      if (response.ok) {
        // Reload subscriptions from API
        const loadResponse = await fetch(`/api/tools/subscription-tracker?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedSubscriptions: Subscription[] = (data.subscriptions || []).map((sub: any) => ({
            id: sub.id,
            name: sub.name,
            category: sub.category,
            frequency: sub.frequency,
            amount: parseFloat(sub.amount),
            dayOfMonth: sub.day_of_month,
            billedDate: sub.billed_date,
            renewalDate: sub.renewal_date,
            addReminderToCalendar: sub.add_reminder_to_calendar || false,
            calendarReminderId: sub.calendar_reminder_id,
            notes: sub.notes || '',
            isActive: sub.is_active !== false,
            dateAdded: sub.date_added,
            dateInactivated: sub.date_inactivated
          }));
          setSubscriptions(transformedSubscriptions);
        }
        
        // Reset form
        setNewSubscription({
          name: '',
          category: '',
          customCategory: '',
          frequency: 'monthly',
          amount: '',
          dayOfMonth: '',
          billedDate: '',
          renewalDate: '',
          addReminderToCalendar: false,
          notes: ''
        });
        setShowCustomCategory(false);
        setIsAdding(false);
      } else {
        const errorData = await response.json();
        console.error('Failed to add subscription:', errorData.error);
        alert('Failed to add subscription: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding subscription:', error);
      alert('Error adding subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate renewal date from billed date (1 year later)
  const calculateRenewalDate = (billedDate: string): string => {
    if (!billedDate) return '';
    const date = new Date(billedDate);
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().split('T')[0];
  };

  const startEditing = (subscription: Subscription) => {
    setEditingId(subscription.id);
    const isCustomCategory = !DEFAULT_CATEGORIES.includes(subscription.category);
    setEditingSubscription({
      name: subscription.name,
      category: isCustomCategory ? 'Other' : subscription.category,
      customCategory: isCustomCategory ? subscription.category : '',
      frequency: subscription.frequency,
      amount: subscription.amount.toString(),
      dayOfMonth: subscription.dayOfMonth?.toString() || '',
      billedDate: subscription.billedDate || '',
      renewalDate: subscription.renewalDate || '',
      addReminderToCalendar: subscription.addReminderToCalendar || false,
      notes: subscription.notes
    });
    setShowCustomCategoryEdit(isCustomCategory);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingSubscription({
      name: '',
      category: '',
      customCategory: '',
      frequency: 'monthly',
      amount: '',
      dayOfMonth: '',
      billedDate: '',
      renewalDate: '',
      addReminderToCalendar: false,
      notes: ''
    });
    setShowCustomCategoryEdit(false);
  };

  const saveEdit = async () => {
    if (!editingId || !editingSubscription.name.trim() || !editingSubscription.amount) {
      return;
    }

    // Validation based on frequency
    if (editingSubscription.frequency === 'annual') {
      if (!editingSubscription.billedDate) {
        return;
      }
    } else {
      if (!editingSubscription.dayOfMonth) {
        return;
      }
    }

    const category = showCustomCategoryEdit && editingSubscription.customCategory.trim()
      ? editingSubscription.customCategory.trim()
      : editingSubscription.category;

    if (!category) {
      return;
    }

    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    setIsLoading(true);
    try {
      const subscriptionData = {
        name: editingSubscription.name.trim(),
        category,
        frequency: editingSubscription.frequency,
        amount: parseFloat(editingSubscription.amount),
        day_of_month: editingSubscription.frequency === 'annual' ? null : parseInt(editingSubscription.dayOfMonth),
        billed_date: editingSubscription.frequency === 'annual' ? editingSubscription.billedDate : null,
        renewal_date: editingSubscription.frequency === 'annual' ? editingSubscription.renewalDate : null,
        add_reminder_to_calendar: editingSubscription.frequency === 'annual' ? (editingSubscription.addReminderToCalendar || false) : false,
        notes: editingSubscription.notes.trim() || null,
        is_active: subscriptions.find(sub => sub.id === editingId)?.isActive !== false
      };

      const response = await fetch('/api/tools/subscription-tracker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: editingId,
          toolId,
          subscriptionData
        }),
      });

      if (response.ok) {
        // Reload subscriptions from API
        const loadResponse = await fetch(`/api/tools/subscription-tracker?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedSubscriptions: Subscription[] = (data.subscriptions || []).map((sub: any) => ({
            id: sub.id,
            name: sub.name,
            category: sub.category,
            frequency: sub.frequency,
            amount: parseFloat(sub.amount),
            dayOfMonth: sub.day_of_month,
            billedDate: sub.billed_date,
            renewalDate: sub.renewal_date,
            addReminderToCalendar: sub.add_reminder_to_calendar || false,
            calendarReminderId: sub.calendar_reminder_id,
            notes: sub.notes || '',
            isActive: sub.is_active !== false,
            dateAdded: sub.date_added,
            dateInactivated: sub.date_inactivated
          }));
          setSubscriptions(transformedSubscriptions);
        }
        cancelEditing();
      } else {
        const errorData = await response.json();
        console.error('Failed to update subscription:', errorData.error);
        alert('Failed to update subscription: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert('Error updating subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inactivateSubscription = async (id: string) => {
    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    setIsLoading(true);
    try {
      const subscription = subscriptions.find(sub => sub.id === id);
      if (!subscription) {
        console.error('Subscription not found');
        return;
      }

      const subscriptionData = {
        name: subscription.name,
        category: subscription.category,
        frequency: subscription.frequency,
        amount: subscription.amount,
        day_of_month: subscription.dayOfMonth,
        billed_date: subscription.billedDate,
        renewal_date: subscription.renewalDate,
        add_reminder_to_calendar: subscription.addReminderToCalendar || false,
        notes: subscription.notes || null,
        is_active: false,
        date_inactivated: new Date().toISOString().split('T')[0]
      };

      const response = await fetch('/api/tools/subscription-tracker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: id,
          toolId,
          subscriptionData
        }),
      });

      if (response.ok) {
        // Reload subscriptions from API
        const loadResponse = await fetch(`/api/tools/subscription-tracker?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedSubscriptions: Subscription[] = (data.subscriptions || []).map((sub: any) => ({
            id: sub.id,
            name: sub.name,
            category: sub.category,
            frequency: sub.frequency,
            amount: parseFloat(sub.amount),
            dayOfMonth: sub.day_of_month,
            billedDate: sub.billed_date,
            renewalDate: sub.renewal_date,
            addReminderToCalendar: sub.add_reminder_to_calendar || false,
            calendarReminderId: sub.calendar_reminder_id,
            notes: sub.notes || '',
            isActive: sub.is_active !== false,
            dateAdded: sub.date_added,
            dateInactivated: sub.date_inactivated
          }));
          setSubscriptions(transformedSubscriptions);
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to inactivate subscription:', errorData.error);
        alert('Failed to inactivate subscription: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error inactivating subscription:', error);
      alert('Error inactivating subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const reactivateSubscription = async (id: string) => {
    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    setIsLoading(true);
    try {
      const subscription = subscriptions.find(sub => sub.id === id);
      if (!subscription) {
        console.error('Subscription not found');
        return;
      }

      const subscriptionData = {
        name: subscription.name,
        category: subscription.category,
        frequency: subscription.frequency,
        amount: subscription.amount,
        day_of_month: subscription.dayOfMonth,
        billed_date: subscription.billedDate,
        renewal_date: subscription.renewalDate,
        add_reminder_to_calendar: subscription.addReminderToCalendar || false,
        notes: subscription.notes || null,
        is_active: true,
        date_inactivated: null
      };

      const response = await fetch('/api/tools/subscription-tracker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: id,
          toolId,
          subscriptionData
        }),
      });

      if (response.ok) {
        // Reload subscriptions from API
        const loadResponse = await fetch(`/api/tools/subscription-tracker?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedSubscriptions: Subscription[] = (data.subscriptions || []).map((sub: any) => ({
            id: sub.id,
            name: sub.name,
            category: sub.category,
            frequency: sub.frequency,
            amount: parseFloat(sub.amount),
            dayOfMonth: sub.day_of_month,
            billedDate: sub.billed_date,
            renewalDate: sub.renewal_date,
            addReminderToCalendar: sub.add_reminder_to_calendar || false,
            calendarReminderId: sub.calendar_reminder_id,
            notes: sub.notes || '',
            isActive: sub.is_active !== false,
            dateAdded: sub.date_added,
            dateInactivated: sub.date_inactivated
          }));
          setSubscriptions(transformedSubscriptions);
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to reactivate subscription:', errorData.error);
        alert('Failed to reactivate subscription: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      alert('Error reactivating subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSubscription = async () => {
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
      const response = await fetch(`/api/tools/subscription-tracker?subscriptionId=${deleteConfirmId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Reload subscriptions from API
        const loadResponse = await fetch(`/api/tools/subscription-tracker?toolId=${toolId}`);
        if (loadResponse.ok) {
          const data = await loadResponse.json();
          const transformedSubscriptions: Subscription[] = (data.subscriptions || []).map((sub: any) => ({
            id: sub.id,
            name: sub.name,
            category: sub.category,
            frequency: sub.frequency,
            amount: parseFloat(sub.amount),
            dayOfMonth: sub.day_of_month,
            billedDate: sub.billed_date,
            renewalDate: sub.renewal_date,
            addReminderToCalendar: sub.add_reminder_to_calendar || false,
            calendarReminderId: sub.calendar_reminder_id,
            notes: sub.notes || '',
            isActive: sub.is_active !== false,
            dateAdded: sub.date_added,
            dateInactivated: sub.date_inactivated
          }));
          setSubscriptions(transformedSubscriptions);
        }
        setDeleteConfirmId(null);
        setDeleteConfirmText('');
      } else {
        const errorData = await response.json();
        console.error('Failed to delete subscription:', errorData.error);
        alert('Failed to delete subscription: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting subscription:', error);
      alert('Error deleting subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const exportToPDF = async () => {
    // Calculate active and inactive subscriptions for export
    const activeSubs = subscriptions.filter(sub => sub.isActive);
    const inactiveSubs = subscriptions.filter(sub => !sub.isActive);

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
    const title = 'Subscription Tracker - Complete Report';
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
    addSectionHeader('Summary');
    const totalMonthlySpend = calculateMonthlySpend();
    addText(`Total Monthly Spend: $${totalMonthlySpend.toFixed(2)}`, 12, true, 5);
    addText(`Active Subscriptions: ${activeSubs.length}`, 10, false, 5);
    if (includeHistory) {
      addText(`Inactive Subscriptions: ${inactiveSubs.length}`, 10, false, 5);
    }
    yPos += 5;

    // Category Breakdown Section
    const categoryData = calculateCategoryBreakdown();
    if (categoryData.length > 0) {
      addSectionHeader('Monthly Spend by Category');
      categoryData.forEach((category) => {
        checkNewPage(8);
        addText(`${category.name}: $${category.value.toFixed(2)}`, 10, false, 10);
        yPos += 1;
      });
    }

    // Subscriptions Section
    const subscriptionsToExport = includeHistory ? subscriptions : activeSubs;
    // Sort subscriptions alphabetically by name
    const sortedSubscriptions = [...subscriptionsToExport].sort((a, b) => a.name.localeCompare(b.name));
    if (sortedSubscriptions.length > 0) {
      addSectionHeader(includeHistory ? 'All Subscriptions' : 'Active Subscriptions');
      
      sortedSubscriptions.forEach((subscription) => {
        checkNewPage(20);
        
        addText(subscription.name, 11, true, 10);
        addText(`Category: ${subscription.category}`, 9, false, 10);
        addText(`Frequency: ${subscription.frequency.charAt(0).toUpperCase() + subscription.frequency.slice(1)}`, 9, false, 10);
        addText(`Amount: $${subscription.amount.toFixed(2)}`, 9, false, 10);
        
        // Calculate monthly equivalent
        let monthlyAmount = subscription.amount;
        if (subscription.frequency === 'annual') {
          monthlyAmount = subscription.amount / 12;
        } else if (subscription.frequency === 'quarterly') {
          monthlyAmount = subscription.amount / 3;
        }
        addText(`Monthly Equivalent: $${monthlyAmount.toFixed(2)}`, 9, false, 10);
        
        if (subscription.frequency === 'annual') {
          if (subscription.billedDate) {
            addText(`Billed Date: ${new Date(subscription.billedDate).toLocaleDateString()}`, 9, false, 10);
          }
          if (subscription.renewalDate) {
            addText(`Renewal Date: ${new Date(subscription.renewalDate).toLocaleDateString()}`, 9, false, 10);
          }
        } else {
          if (subscription.dayOfMonth) {
            addText(`Day of Month: ${subscription.dayOfMonth}`, 9, false, 10);
          }
        }
        
        if (subscription.dateAdded) {
          addText(`Date Added: ${new Date(subscription.dateAdded).toLocaleDateString()}`, 9, false, 10);
        }
        
        if (!subscription.isActive && subscription.dateInactivated) {
          addText(`Date Inactivated: ${new Date(subscription.dateInactivated).toLocaleDateString()}`, 9, false, 10);
        }
        
        if (subscription.notes) {
          addText(`Notes: ${subscription.notes}`, 9, false, 10);
        }
        
        yPos += 3;
      });
    }

    // Save PDF
    const fileName = `Subscription_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    setShowExportPopup(false);
  };

  const activeSubscriptions = subscriptions.filter(sub => sub.isActive).sort((a, b) => a.name.localeCompare(b.name));
  const inactiveSubscriptions = subscriptions.filter(sub => !sub.isActive).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={titleClass}>Subscription Tracker</h2>
          <p className={descClass}>
            Track and manage all your subscriptions in one place
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className={tabStripClass}>
        <div className="flex gap-2">
          {[
            { id: 'subscriptions', label: 'Subscriptions' },
            { id: 'export', label: 'Export' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'subscriptions' | 'export')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id ? tabActiveClass : tabInactiveClass
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-6">
          {/* Add New Subscription Form */}
          {!isAdding ? (
            <div className="flex justify-start">
              <button
                onClick={() => setIsAdding(true)}
                className={primaryButtonClass}
              >
                + Add New Subscription
              </button>
            </div>
          ) : (
            <div className={cardClass}>
              <h3 className={isLight ? 'text-lg font-semibold text-slate-900 mb-4' : 'text-lg font-semibold text-slate-50 mb-4'}>Add New Subscription</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>
                      Subscription Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newSubscription.name}
                      onChange={(e) => setNewSubscription({ ...newSubscription, name: e.target.value })}
                      placeholder="e.g., Netflix, Spotify"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Category <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={showCustomCategory ? 'Other' : newSubscription.category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Select category</option>
                      {DEFAULT_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    {showCustomCategory && (
                      <input
                        type="text"
                        value={newSubscription.customCategory}
                        onChange={(e) => setNewSubscription({ ...newSubscription, customCategory: e.target.value })}
                        placeholder="Enter custom category"
                        className={`${inputClass} mt-2`}
                      />
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>
                      Frequency <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={newSubscription.frequency}
                      onChange={(e) => {
                        const newFrequency = e.target.value as SubscriptionFrequency;
                        if (newFrequency === 'annual') {
                          setNewSubscription({ 
                            ...newSubscription, 
                            frequency: newFrequency,
                            dayOfMonth: '',
                            billedDate: newSubscription.billedDate || '',
                            renewalDate: newSubscription.renewalDate || ''
                          });
                        } else {
                          setNewSubscription({ 
                            ...newSubscription, 
                            frequency: newFrequency,
                            dayOfMonth: newSubscription.dayOfMonth || '',
                            billedDate: '',
                            renewalDate: ''
                          });
                        }
                      }}
                      className={selectClass}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>
                      Amount ($) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newSubscription.amount}
                      onChange={(e) => setNewSubscription({ ...newSubscription, amount: e.target.value })}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                  {newSubscription.frequency === 'annual' ? (
                    <>
                      <div>
                        <label className={labelClass}>
                          Billed Date <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="date"
                          value={newSubscription.billedDate}
                          onChange={(e) => {
                            const billedDate = e.target.value;
                            const renewalDate = calculateRenewalDate(billedDate);
                            setNewSubscription({ ...newSubscription, billedDate, renewalDate });
                          }}
                          className={selectClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          Renewal Date
                        </label>
                        <input
                          type="date"
                          value={newSubscription.renewalDate}
                          onChange={(e) => setNewSubscription({ ...newSubscription, renewalDate: e.target.value })}
                          className={selectClass}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="addReminderToCalendar"
                            checked={newSubscription.addReminderToCalendar}
                            onChange={(e) => setNewSubscription({ ...newSubscription, addReminderToCalendar: e.target.checked })}
                            className={isLight ? 'w-5 h-5 rounded border-slate-400 bg-white text-emerald-600 focus:ring-emerald-500 focus:ring-offset-white' : 'w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800'}
                          />
                          <label htmlFor="addReminderToCalendar" className={isLight ? 'text-sm text-slate-700 cursor-pointer' : 'text-sm text-slate-300 cursor-pointer'}>
                            Add reminder to calendar 30 days before renewal
                          </label>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className={labelClass}>
                        Day of Month <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={newSubscription.dayOfMonth}
                        onChange={(e) => setNewSubscription({ ...newSubscription, dayOfMonth: e.target.value })}
                        placeholder="1-31"
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelClass}>
                    Notes (Optional)
                  </label>
                  <textarea
                    value={newSubscription.notes}
                    onChange={(e) => setNewSubscription({ ...newSubscription, notes: e.target.value })}
                    placeholder="Add any additional notes..."
                    rows={3}
                    className={textareaClass}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addSubscription}
                    disabled={
                      !newSubscription.name.trim() || 
                      !newSubscription.amount || 
                      (!showCustomCategory && !newSubscription.category) || 
                      (showCustomCategory && !newSubscription.customCategory.trim()) ||
                      (newSubscription.frequency === 'annual' ? !newSubscription.billedDate : !newSubscription.dayOfMonth)
                    }
                    className={primaryButtonClass}
                  >
                    Add Subscription
                  </button>
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setNewSubscription({
                        name: '',
                        category: '',
                        customCategory: '',
                        frequency: 'monthly',
                        amount: '',
                        dayOfMonth: '',
                        billedDate: '',
                        renewalDate: '',
                        addReminderToCalendar: false,
                        notes: ''
                      });
                      setShowCustomCategory(false);
                    }}
                    className={secondaryButtonClass}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active Subscriptions */}
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>Active Subscriptions</h3>
              <span className={isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400'}>
                {activeSubscriptions.length} {activeSubscriptions.length === 1 ? 'subscription' : 'subscriptions'}
              </span>
            </div>
            {activeSubscriptions.length > 0 ? (
              <div className="space-y-4">
                {activeSubscriptions.map(subscription => (
                  <div key={subscription.id} className={nestedCardClass}>
                    {editingId === subscription.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Subscription Name <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={editingSubscription.name}
                              onChange={(e) => setEditingSubscription({ ...editingSubscription, name: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Category <span className="text-red-400">*</span>
                            </label>
                            <select
                              value={showCustomCategoryEdit ? 'Other' : editingSubscription.category}
                              onChange={(e) => handleCategoryChangeEdit(e.target.value)}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            >
                              <option value="">Select category</option>
                              {DEFAULT_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                            {showCustomCategoryEdit && (
                              <input
                                type="text"
                                value={editingSubscription.customCategory}
                                onChange={(e) => setEditingSubscription({ ...editingSubscription, customCategory: e.target.value })}
                                placeholder="Enter custom category"
                                className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Frequency <span className="text-red-400">*</span>
                            </label>
                            <select
                              value={editingSubscription.frequency}
                              onChange={(e) => {
                                const newFrequency = e.target.value as SubscriptionFrequency;
                                if (newFrequency === 'annual') {
                                  setEditingSubscription({ 
                                    ...editingSubscription, 
                                    frequency: newFrequency,
                                    dayOfMonth: '',
                                    billedDate: editingSubscription.billedDate || '',
                                    renewalDate: editingSubscription.renewalDate || ''
                                  });
                                } else {
                                  setEditingSubscription({ 
                                    ...editingSubscription, 
                                    frequency: newFrequency,
                                    dayOfMonth: editingSubscription.dayOfMonth || '',
                                    billedDate: '',
                                    renewalDate: ''
                                  });
                                }
                              }}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            >
                              <option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly</option>
                              <option value="annual">Annual</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Amount ($) <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editingSubscription.amount}
                              onChange={(e) => setEditingSubscription({ ...editingSubscription, amount: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          {editingSubscription.frequency === 'annual' ? (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Billed Date <span className="text-red-400">*</span>
                                </label>
                                <input
                                  type="date"
                                  value={editingSubscription.billedDate}
                                  onChange={(e) => {
                                    const billedDate = e.target.value;
                                    const renewalDate = calculateRenewalDate(billedDate);
                                    setEditingSubscription({ ...editingSubscription, billedDate, renewalDate });
                                  }}
                                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Renewal Date
                                </label>
                                <input
                                  type="date"
                                  value={editingSubscription.renewalDate}
                                  onChange={(e) => setEditingSubscription({ ...editingSubscription, renewalDate: e.target.value })}
                                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    id="editAddReminderToCalendar"
                                    checked={editingSubscription.addReminderToCalendar}
                                    onChange={(e) => setEditingSubscription({ ...editingSubscription, addReminderToCalendar: e.target.checked })}
                                    className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                                  />
                                  <label htmlFor="editAddReminderToCalendar" className="text-sm text-slate-300 cursor-pointer">
                                    Add reminder to calendar 30 days before renewal
                                  </label>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">
                                Day of Month <span className="text-red-400">*</span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="31"
                                value={editingSubscription.dayOfMonth}
                                onChange={(e) => setEditingSubscription({ ...editingSubscription, dayOfMonth: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Notes (Optional)
                          </label>
                          <textarea
                            value={editingSubscription.notes}
                            onChange={(e) => setEditingSubscription({ ...editingSubscription, notes: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveEdit}
                            disabled={
                              !editingSubscription.name.trim() || 
                              !editingSubscription.amount || 
                              (!showCustomCategoryEdit && !editingSubscription.category) || 
                              (showCustomCategoryEdit && !editingSubscription.customCategory.trim()) ||
                              (editingSubscription.frequency === 'annual' ? !editingSubscription.billedDate : !editingSubscription.dayOfMonth)
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
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-semibold text-slate-100">{subscription.name}</h4>
                            <span className={isLight ? 'px-2 py-1 rounded text-xs font-medium border border-emerald-300 bg-emerald-50 text-emerald-800' : 'px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300'}>
                              {subscription.category}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-slate-400">Frequency:</span>
                              <span className="ml-2 text-slate-200 capitalize">{subscription.frequency}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Amount:</span>
                              <span className="ml-2 text-slate-200">${subscription.amount.toFixed(2)}</span>
                            </div>
                            {subscription.frequency === 'annual' ? (
                              <div>
                                <div>
                                  <span className="text-slate-400">Billed Date:</span>
                                  <span className="ml-2 text-slate-200">
                                    {subscription.billedDate ? new Date(subscription.billedDate).toLocaleDateString() : 'N/A'}
                                  </span>
                                </div>
                                <div className="mt-1">
                                  <span className="text-slate-400">Renewal Date:</span>
                                  <span className="ml-2 text-slate-200">
                                    {subscription.renewalDate ? new Date(subscription.renewalDate).toLocaleDateString() : 'N/A'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="text-slate-400">Day of Month:</span>
                                <span className="ml-2 text-slate-200">{subscription.dayOfMonth}</span>
                              </div>
                            )}
                            <div className="md:col-start-4">
                              <span className="text-slate-400">Monthly:</span>
                              <span className="ml-2 text-slate-200">
                                ${subscription.frequency === 'annual' 
                                  ? (subscription.amount / 12).toFixed(2)
                                  : subscription.frequency === 'quarterly'
                                  ? (subscription.amount / 3).toFixed(2)
                                  : subscription.amount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          {subscription.notes && (
                            <div className="mt-3">
                              <span className="text-sm text-slate-400">Notes:</span>
                              <p className="text-sm text-slate-300 mt-1 italic">"{subscription.notes}"</p>
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 ml-4">
                          <button
                            type="button"
                            onClick={() => startEditing(subscription)}
                            aria-label="Edit subscription"
                            title="Edit subscription"
                            className={rowIconEmeraldClass}
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => inactivateSubscription(subscription.id)}
                            aria-label="Move to history"
                            title="Move to history"
                            className={rowIconSecondaryClass}
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">No active subscriptions. Add one to get started!</p>
            )}
          </div>

          {/* History Section */}
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>History</h3>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={isLight ? 'text-sm text-slate-600 hover:text-slate-900 transition-colors' : 'text-sm text-slate-400 hover:text-slate-300 transition-colors'}
              >
                {showHistory ? 'Hide' : 'Show'} ({inactiveSubscriptions.length})
              </button>
            </div>
            {showHistory && (
              inactiveSubscriptions.length > 0 ? (
                <div className="space-y-4">
                  {inactiveSubscriptions.map(subscription => (
                    <div key={subscription.id} className={`${nestedCardClass} ${isLight ? '' : 'opacity-75'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-semibold text-slate-300">{subscription.name}</h4>
                            <span className={isLight ? 'px-2 py-1 rounded text-xs font-medium border border-slate-300 bg-slate-100 text-slate-700' : 'px-2 py-1 rounded text-xs font-medium bg-slate-600/50 text-slate-400'}>
                              {subscription.category}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-slate-500">Frequency:</span>
                              <span className="ml-2 text-slate-400 capitalize">{subscription.frequency}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Amount:</span>
                              <span className="ml-2 text-slate-400">${subscription.amount.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Inactivated:</span>
                              <span className="ml-2 text-slate-400">
                                {subscription.dateInactivated ? new Date(subscription.dateInactivated).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                          </div>
                          {subscription.notes && (
                            <div className="mt-3">
                              <span className="text-sm text-slate-500">Notes:</span>
                              <p className="text-sm text-slate-400 mt-1 italic">"{subscription.notes}"</p>
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 ml-4">
                          <button
                            type="button"
                            onClick={() => reactivateSubscription(subscription.id)}
                            aria-label="Reactivate subscription"
                            title="Reactivate subscription"
                            className={rowIconEmeraldClass}
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(subscription.id)}
                            aria-label="Delete subscription"
                            title="Delete subscription"
                            className={rowIconDangerClass}
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">No inactive subscriptions in history.</p>
              )
            )}
          </div>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className={cardClass}>
            <h3 className={isLight ? 'text-lg font-semibold text-slate-900 mb-4' : 'text-lg font-semibold text-slate-50 mb-4'}>Export Subscription Report</h3>
            <p className={isLight ? 'text-slate-700 mb-4' : 'text-slate-300 mb-4'}>
              Generate a comprehensive PDF report of all your subscriptions. The report will include all subscription details, summary statistics, and category breakdown.
            </p>
            <button
              onClick={() => setShowExportPopup(true)}
              className={primaryButtonClass}
            >
              Generate PDF Report
            </button>
          </div>
        </div>
      )}

      {/* Export Popup */}
      {showExportPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={isLight ? 'bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full mx-4 shadow-2xl' : 'bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full mx-4'}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>Export Options</h3>
              <button
                onClick={() => setShowExportPopup(false)}
                className={isLight ? 'text-slate-600 hover:text-slate-900 transition-colors' : 'text-slate-400 hover:text-slate-200 transition-colors'}
                aria-label="Close modal"
                title="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="includeHistory"
                  checked={includeHistory}
                  onChange={(e) => setIncludeHistory(e.target.checked)}
                  className={isLight ? 'w-5 h-5 rounded border-slate-400 bg-white text-emerald-600 focus:ring-emerald-500 focus:ring-offset-white' : 'w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800'}
                />
                <label htmlFor="includeHistory" className={isLight ? 'text-slate-700 cursor-pointer' : 'text-slate-300 cursor-pointer'}>
                  Include inactive subscriptions in the report
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={exportToPDF}
                  className={`flex-1 ${primaryButtonClass}`}
                >
                  Export to PDF
                </button>
                <button
                  onClick={() => setShowExportPopup(false)}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={isLight ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-2xl' : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4'}>
            <h3 className={isLight ? 'text-xl font-semibold text-slate-900 mb-2' : 'text-xl font-semibold text-slate-50 mb-2'}>Delete Subscription</h3>
            <div className={isLight ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 mb-4' : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4'}>
              <p className={isLight ? 'text-red-700 font-semibold mb-2' : 'text-red-300 font-semibold mb-2'}>
                ⚠️ Warning: This action cannot be undone!
              </p>
              <p className={isLight ? 'text-red-600 text-sm' : 'text-red-200 text-sm'}>
                This subscription will be permanently deleted.
              </p>
            </div>
            <p className={isLight ? 'text-slate-600 text-sm mb-4' : 'text-slate-400 text-sm mb-4'}>
              To confirm, please type <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>delete</strong> in the box below:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className={isLight ? 'w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4' : 'w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4'}
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
                onClick={deleteSubscription}
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Subscription
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteConfirmText('');
                }}
                className={secondaryButtonClass}
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

