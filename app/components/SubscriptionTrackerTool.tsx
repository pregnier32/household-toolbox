'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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
  'Media',
  'IT',
  'Home',
  'Food',
  'Auto',
  'Health',
  'Education',
  'Retail',
  'Finance',
  'Software',
  'Other'
];

type SubscriptionTrackerToolProps = {
  toolId?: string;
};

export function SubscriptionTrackerTool({ toolId }: SubscriptionTrackerToolProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'kpis' | 'export'>('subscriptions');
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

    // Subscriptions Section
    const subscriptionsToExport = includeHistory ? subscriptions : activeSubs;
    if (subscriptionsToExport.length > 0) {
      addSectionHeader(includeHistory ? 'All Subscriptions' : 'Active Subscriptions');
      
      subscriptionsToExport.forEach((subscription) => {
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

    // Save PDF
    const fileName = `Subscription_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    setShowExportPopup(false);
  };

  const activeSubscriptions = subscriptions.filter(sub => sub.isActive);
  const inactiveSubscriptions = subscriptions.filter(sub => !sub.isActive);
  const categoryData = calculateCategoryBreakdown();

  // Colors for pie chart
  const COLORS = [
    '#10b981', // emerald
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#f59e0b', // amber
    '#ef4444', // red
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
    '#f97316', // orange
    '#6366f1', // indigo
    '#14b8a6', // teal
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-50 mb-2">Subscription Tracker</h2>
          <p className="text-slate-400 text-sm">
            Track and manage all your subscriptions in one place
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-2">
          {[
            { id: 'subscriptions', label: 'Subscriptions' },
            { id: 'kpis', label: 'KPIs' },
            { id: 'export', label: 'Export' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'subscriptions' | 'kpis' | 'export')}
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

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-6">
          {/* Add New Subscription Form */}
          {!isAdding ? (
            <div className="flex justify-start">
              <button
                onClick={() => setIsAdding(true)}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors"
              >
                + Add New Subscription
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Add New Subscription</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Subscription Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newSubscription.name}
                      onChange={(e) => setNewSubscription({ ...newSubscription, name: e.target.value })}
                      placeholder="e.g., Netflix, Spotify"
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Category <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={showCustomCategory ? 'Other' : newSubscription.category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                        className="w-full mt-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
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
                      value={newSubscription.amount}
                      onChange={(e) => setNewSubscription({ ...newSubscription, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  {newSubscription.frequency === 'annual' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
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
                          className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Renewal Date
                        </label>
                        <input
                          type="date"
                          value={newSubscription.renewalDate}
                          onChange={(e) => setNewSubscription({ ...newSubscription, renewalDate: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="addReminderToCalendar"
                            checked={newSubscription.addReminderToCalendar}
                            onChange={(e) => setNewSubscription({ ...newSubscription, addReminderToCalendar: e.target.checked })}
                            className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                          />
                          <label htmlFor="addReminderToCalendar" className="text-sm text-slate-300 cursor-pointer">
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
                        value={newSubscription.dayOfMonth}
                        onChange={(e) => setNewSubscription({ ...newSubscription, dayOfMonth: e.target.value })}
                        placeholder="1-31"
                        className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={newSubscription.notes}
                    onChange={(e) => setNewSubscription({ ...newSubscription, notes: e.target.value })}
                    placeholder="Add any additional notes..."
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
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
                    className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                        notes: ''
                      });
                      setShowCustomCategory(false);
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active Subscriptions */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">Active Subscriptions</h3>
              <span className="text-sm text-slate-400">
                {activeSubscriptions.length} {activeSubscriptions.length === 1 ? 'subscription' : 'subscriptions'}
              </span>
            </div>
            {activeSubscriptions.length > 0 ? (
              <div className="space-y-4">
                {activeSubscriptions.map(subscription => (
                  <div key={subscription.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
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
                                className="w-full mt-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                            className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
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
                            className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                            <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300">
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
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => startEditing(subscription)}
                            className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => inactivateSubscription(subscription.id)}
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
              <p className="text-slate-400 text-center py-8">No active subscriptions. Add one to get started!</p>
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
                {showHistory ? 'Hide' : 'Show'} ({inactiveSubscriptions.length})
              </button>
            </div>
            {showHistory && (
              inactiveSubscriptions.length > 0 ? (
                <div className="space-y-4">
                  {inactiveSubscriptions.map(subscription => (
                    <div key={subscription.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 opacity-75">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-semibold text-slate-300">{subscription.name}</h4>
                            <span className="px-2 py-1 rounded text-xs font-medium bg-slate-600/50 text-slate-400">
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
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => reactivateSubscription(subscription.id)}
                            className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors text-sm"
                          >
                            Reactivate
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(subscription.id)}
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
                <p className="text-slate-400 text-center py-8">No inactive subscriptions in history.</p>
              )
            )}
          </div>
        </div>
      )}

      {/* KPIs Tab */}
      {activeTab === 'kpis' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Total Monthly Spend KPI */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Total Monthly Spend</h3>
            <div className="text-4xl font-bold text-emerald-400">
              ${calculateMonthlySpend().toFixed(2)}
            </div>
            <p className="text-sm text-slate-400 mt-2 mb-4">
              Based on {activeSubscriptions.length} active {activeSubscriptions.length === 1 ? 'subscription' : 'subscriptions'}
            </p>
            
            {/* Horizontal line */}
            <hr className="border-slate-700 my-4" />
            
            {/* Category breakdown list */}
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">By Category</h4>
              {categoryData.length > 0 ? (
                <div className="space-y-2">
                  {[...categoryData]
                    .sort((a, b) => b.value - a.value)
                    .map((category, index) => (
                      <div key={category.name} className="flex items-center justify-between py-1">
                        <span className="text-slate-300 text-sm">{category.name}</span>
                        <span className="text-emerald-400 font-medium">${category.value.toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">No categories to display.</p>
              )}
            </div>
          </div>

          {/* Category Breakdown Pie Chart */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Monthly Spend by Category</h3>
            {categoryData.length > 0 ? (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `$${value.toFixed(2)}`}
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#e2e8f0'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">No active subscriptions to display.</p>
            )}
          </div>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Export Subscription Report</h3>
            <p className="text-slate-300 mb-4">
              Generate a comprehensive PDF report of all your subscriptions. The report will include all subscription details, summary statistics, and category breakdown.
            </p>
            <button
              onClick={() => setShowExportPopup(true)}
              className="px-6 py-3 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors"
            >
              Generate PDF Report
            </button>
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
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="includeHistory"
                  checked={includeHistory}
                  onChange={(e) => setIncludeHistory(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                />
                <label htmlFor="includeHistory" className="text-slate-300 cursor-pointer">
                  Include inactive subscriptions in the report
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete Subscription</h3>
            <p className="text-slate-300 mb-4">
              <strong className="text-red-400">Warning:</strong> This action cannot be undone. This subscription will be permanently deleted.
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

