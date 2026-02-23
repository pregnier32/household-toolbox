'use client';

import { useState, useEffect, useRef } from 'react';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

type HeaderRecord = {
  id: string;
  name: string;
  card_color: string | null;
};

type AppointmentDocument = {
  id: string;
  name: string;
  file?: File | null;
  fileUrl?: string | null;
  file_size?: number | null;
};

type AppointmentRecord = {
  id: string;
  headerId: string;
  isUpcoming: boolean;
  appointmentDate: string;
  careFacility: string;
  providerInfo: string;
  reasonForVisit: string;
  preVisitNotes: string;
  postVisitNotes: string;
  showOnDashboardCalendar: boolean;
  totalBilled: string;
  insurancePaid: string;
  currentAmountDue: string;
  documents: AppointmentDocument[];
};

type HealthcareApptsHistoryToolProps = {
  toolId?: string;
};

const API_BASE = '/api/tools/healthcare-appts-history';

function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function mapApiRecordToRecord(r: {
  id: string;
  header_id: string;
  appointment_date: string;
  is_upcoming: boolean;
  care_facility: string | null;
  provider_info: string | null;
  reason_for_visit: string | null;
  pre_visit_notes: string | null;
  post_visit_notes: string | null;
  show_on_dashboard_calendar: boolean | null;
  total_billed: string | null;
  insurance_paid: string | null;
  current_amount_due: string | null;
  documents?: { id: string; name: string; fileUrl: string; file_size: number | null }[];
}): AppointmentRecord {
  return {
    id: r.id,
    headerId: r.header_id,
    appointmentDate: r.appointment_date,
    isUpcoming: r.is_upcoming,
    careFacility: r.care_facility ?? '',
    providerInfo: r.provider_info ?? '',
    reasonForVisit: r.reason_for_visit ?? '',
    preVisitNotes: r.pre_visit_notes ?? '',
    postVisitNotes: r.post_visit_notes ?? '',
    showOnDashboardCalendar: r.show_on_dashboard_calendar ?? false,
    totalBilled: r.total_billed ?? '',
    insurancePaid: r.insurance_paid ?? '',
    currentAmountDue: r.current_amount_due ?? '',
    documents: (r.documents || []).map((d) => ({
      id: d.id,
      name: d.name,
      fileUrl: d.fileUrl,
      file_size: d.file_size,
    })),
  };
}

function formatCurrency(value: string): string {
  const numericValue = value.replace(/[^0-9.]/g, '');
  const parts = numericValue.split('.');
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('');
  if (parts[1] && parts[1].length > 2) return parts[0] + '.' + parts[1].substring(0, 2);
  return numericValue;
}

function formatCurrencyDisplay(value: string): string {
  if (!value) return '';
  const numericValue = value.replace(/[^0-9.]/g, '');
  if (!numericValue) return '';
  const numValue = parseFloat(numericValue);
  if (isNaN(numValue)) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${m}/${d}/${y}`;
}

function parseCurrency(value: string): number {
  if (!value) return 0;
  const numericValue = value.replace(/[^0-9.]/g, '');
  if (!numericValue) return 0;
  const num = parseFloat(numericValue);
  return isNaN(num) ? 0 : num;
}

function getPatientResponsibilityDisplay(totalBilled: string, insurancePaid: string): string {
  const total = parseCurrency(totalBilled);
  const insurance = parseCurrency(insurancePaid);
  const responsibility = Math.max(0, total - insurance);
  return formatCurrencyDisplay(String(responsibility));
}

const defaultRecord = (headerId: string): Omit<AppointmentRecord, 'id'> => ({
  headerId,
  isUpcoming: true,
  appointmentDate: new Date().toISOString().split('T')[0],
  careFacility: '',
  providerInfo: '',
  reasonForVisit: '',
  preVisitNotes: '',
  postVisitNotes: '',
  showOnDashboardCalendar: false,
  totalBilled: '',
  insurancePaid: '',
  currentAmountDue: '',
  documents: [],
});

export function HealthcareApptsHistoryTool({ toolId }: HealthcareApptsHistoryToolProps) {
  const [headers, setHeaders] = useState<HeaderRecord[]>([]);
  const [selectedHeaderId, setSelectedHeaderId] = useState<string | null>(null);
  const [isCreatingNewHeader, setIsCreatingNewHeader] = useState(false);
  const [newHeaderName, setNewHeaderName] = useState('');
  const [newHeaderColor, setNewHeaderColor] = useState('#10b981');

  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const [editingHeaderName, setEditingHeaderName] = useState('');
  const [editingHeaderColor, setEditingHeaderColor] = useState('#10b981');
  const [menuOpenHeaderId, setMenuOpenHeaderId] = useState<string | null>(null);

  const [deleteConfirmHeaderId, setDeleteConfirmHeaderId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [records, setRecords] = useState<AppointmentRecord[]>([]);
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [recordTypeStep, setRecordTypeStep] = useState<'choose' | 'form'>('choose');
  const [newRecordIsUpcoming, setNewRecordIsUpcoming] = useState(true);
  const [newRecord, setNewRecord] = useState<Omit<AppointmentRecord, 'id'>>(() => defaultRecord(''));

  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<AppointmentRecord | null>(null);

  const [deleteConfirmRecordId, setDeleteConfirmRecordId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'upcoming' | 'history'>('all');

  const [activeTab, setActiveTab] = useState<'history' | 'kpi' | 'report'>('history');
  const [kpiYearFilter, setKpiYearFilter] = useState<string>('all');
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [exportIncludeUpcoming, setExportIncludeUpcoming] = useState(true);
  const [exportHistoryScope, setExportHistoryScope] = useState<string>('all');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [isLoadingHeaders, setIsLoadingHeaders] = useState(false);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const docFileInputRef = useRef<HTMLInputElement>(null);
  const editDocFileInputRef = useRef<HTMLInputElement>(null);

  const selectedHeader = headers.find((h) => h.id === selectedHeaderId);
  const recordsForHeader = selectedHeaderId
    ? records.filter((r) => r.headerId === selectedHeaderId)
    : [];

  // Filter and search
  const filteredRecords = recordsForHeader.filter((r) => {
    const matchType =
      filterType === 'all' ||
      (filterType === 'upcoming' && r.isUpcoming) ||
      (filterType === 'history' && !r.isUpcoming);
    if (!matchType) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.careFacility.toLowerCase().includes(q) ||
      r.providerInfo.toLowerCase().includes(q) ||
      r.reasonForVisit.toLowerCase().includes(q) ||
      r.preVisitNotes.toLowerCase().includes(q) ||
      r.postVisitNotes.toLowerCase().includes(q)
    );
  });

  const loadHeaders = async () => {
    if (!toolId) return;
    setIsLoadingHeaders(true);
    try {
      const response = await fetch(`${API_BASE}?toolId=${encodeURIComponent(toolId)}&resource=headers`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to load headers');
      }
      const data = await response.json();
      const list = (data.headers || []).map((h: { id: string; name: string; card_color: string | null }) => ({
        id: h.id,
        name: h.name,
        card_color: h.card_color ?? '#10b981',
      }));
      setHeaders(list);
      if (list.length > 0 && !selectedHeaderId) setSelectedHeaderId(list[0].id);
    } catch (e) {
      console.error('Load headers:', e);
      setSaveMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to load headers' });
    } finally {
      setIsLoadingHeaders(false);
    }
  };

  const loadRecords = async (headerId: string) => {
    if (!toolId) return;
    setIsLoadingRecords(true);
    try {
      const response = await fetch(
        `${API_BASE}?toolId=${encodeURIComponent(toolId)}&resource=records&headerId=${encodeURIComponent(headerId)}`
      );
      if (!response.ok) {
        setRecords([]);
        return;
      }
      const data = await response.json();
      const list = (data.records || []).map((r: unknown) => mapApiRecordToRecord(r as Parameters<typeof mapApiRecordToRecord>[0]));
      setRecords(list);
    } catch (e) {
      console.error('Load records:', e);
      setRecords([]);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  useEffect(() => {
    if (toolId) loadHeaders();
  }, [toolId]);

  useEffect(() => {
    if (toolId && selectedHeaderId) loadRecords(selectedHeaderId);
    else setRecords([]);
  }, [toolId, selectedHeaderId]);

  useEffect(() => {
    if (selectedHeaderId) {
      setNewRecord(defaultRecord(selectedHeaderId));
      setRecordTypeStep('choose');
    }
  }, [selectedHeaderId]);

  const selectHeader = (headerId: string) => {
    setSelectedHeaderId(headerId);
    setEditingHeaderId(null);
    setMenuOpenHeaderId(null);
  };

  const createNewHeader = async () => {
    if (!newHeaderName.trim() || !toolId) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('resource', 'header');
      formData.append('action', 'create');
      formData.append('name', newHeaderName.trim());
      formData.append('cardColor', newHeaderColor);
      const response = await fetch(API_BASE, { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to create header');
      }
      const data = await response.json();
      const newHeader: HeaderRecord = {
        id: data.header.id,
        name: data.header.name,
        card_color: data.header.card_color ?? newHeaderColor,
      };
      setHeaders((prev) => [...prev, newHeader]);
      setSelectedHeaderId(newHeader.id);
      setIsCreatingNewHeader(false);
      setNewHeaderName('');
      setNewHeaderColor('#10b981');
      setSaveMessage({ type: 'success', text: 'Family member created.' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e) {
      setSaveMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to create header' });
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingHeader = (header: HeaderRecord) => {
    setEditingHeaderId(header.id);
    setEditingHeaderName(header.name);
    setEditingHeaderColor(header.card_color || '#10b981');
    setMenuOpenHeaderId(null);
  };

  const cancelEditingHeader = () => {
    setEditingHeaderId(null);
    setEditingHeaderName('');
    setEditingHeaderColor('#10b981');
    setMenuOpenHeaderId(null);
  };

  const saveHeaderEdit = async () => {
    if (!editingHeaderId || !editingHeaderName.trim() || !toolId) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('resource', 'header');
      formData.append('action', 'update');
      formData.append('headerId', editingHeaderId);
      formData.append('name', editingHeaderName.trim());
      formData.append('cardColor', editingHeaderColor);
      const response = await fetch(API_BASE, { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to update header');
      }
      setHeaders((prev) =>
        prev.map((h) =>
          h.id === editingHeaderId ? { ...h, name: editingHeaderName.trim(), card_color: editingHeaderColor } : h
        )
      );
      cancelEditingHeader();
      setSaveMessage({ type: 'success', text: 'Saved.' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e) {
      setSaveMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to update header' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteHeader = async () => {
    if (!deleteConfirmHeaderId || deleteConfirmText.toLowerCase() !== 'delete' || !toolId) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('resource', 'header');
      formData.append('action', 'delete');
      formData.append('headerId', deleteConfirmHeaderId);
      const response = await fetch(API_BASE, { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to delete header');
      }
      setHeaders((prev) => prev.filter((h) => h.id !== deleteConfirmHeaderId));
      setRecords((prev) => prev.filter((r) => r.headerId !== deleteConfirmHeaderId));
      if (selectedHeaderId === deleteConfirmHeaderId) {
        const remaining = headers.filter((h) => h.id !== deleteConfirmHeaderId);
        setSelectedHeaderId(remaining[0]?.id ?? null);
      }
      setDeleteConfirmHeaderId(null);
      setDeleteConfirmText('');
      setSaveMessage({ type: 'success', text: 'Deleted.' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e) {
      setSaveMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to delete' });
    } finally {
      setIsSaving(false);
    }
  };

  const startAddingRecord = () => {
    setNewRecord(defaultRecord(selectedHeaderId!));
    setRecordTypeStep('choose');
    setIsAddingRecord(true);
  };

  const confirmRecordTypeAndShowForm = () => {
    setNewRecord((prev) => ({ ...prev, isUpcoming: newRecordIsUpcoming }));
    setRecordTypeStep('form');
  };

  const cancelAddingRecord = () => {
    setIsAddingRecord(false);
    setRecordTypeStep('choose');
  };

  const addRecord = async () => {
    if (!selectedHeaderId || !toolId) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('resource', 'record');
      formData.append('action', 'create');
      formData.append('headerId', selectedHeaderId);
      formData.append('appointmentDate', newRecord.appointmentDate);
      formData.append('isUpcoming', String(newRecord.isUpcoming));
      formData.append('careFacility', newRecord.careFacility);
      formData.append('providerInfo', newRecord.providerInfo);
      formData.append('reasonForVisit', newRecord.reasonForVisit);
      formData.append('preVisitNotes', newRecord.preVisitNotes);
      formData.append('postVisitNotes', newRecord.postVisitNotes);
      formData.append('showOnDashboardCalendar', String(newRecord.showOnDashboardCalendar));
      formData.append('totalBilled', newRecord.totalBilled);
      formData.append('insurancePaid', newRecord.insurancePaid);
      formData.append('currentAmountDue', newRecord.currentAmountDue);
      newRecord.documents.forEach((d) => {
        if (d.file) formData.append('documents', d.file);
      });
      const response = await fetch(API_BASE, { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to add appointment');
      }
      setIsAddingRecord(false);
      setRecordTypeStep('choose');
      setNewRecord(defaultRecord(selectedHeaderId));
      await loadRecords(selectedHeaderId);
      setSaveMessage({ type: 'success', text: 'Appointment added.' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e) {
      setSaveMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to add appointment' });
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingRecord = (record: AppointmentRecord) => {
    setEditingRecordId(record.id);
    setEditingRecord({ ...record });
  };

  const cancelEditingRecord = () => {
    setEditingRecordId(null);
    setEditingRecord(null);
  };

  const saveEditingRecord = async () => {
    if (!editingRecord || !selectedHeaderId || !toolId) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('resource', 'record');
      formData.append('action', 'update');
      formData.append('recordId', editingRecord.id);
      formData.append('headerId', editingRecord.headerId);
      formData.append('appointmentDate', editingRecord.appointmentDate);
      formData.append('isUpcoming', String(editingRecord.isUpcoming));
      formData.append('careFacility', editingRecord.careFacility);
      formData.append('providerInfo', editingRecord.providerInfo);
      formData.append('reasonForVisit', editingRecord.reasonForVisit);
      formData.append('preVisitNotes', editingRecord.preVisitNotes);
      formData.append('postVisitNotes', editingRecord.postVisitNotes);
      formData.append('showOnDashboardCalendar', String(editingRecord.showOnDashboardCalendar));
      formData.append('totalBilled', editingRecord.totalBilled);
      formData.append('insurancePaid', editingRecord.insurancePaid);
      formData.append('currentAmountDue', editingRecord.currentAmountDue);
      editingRecord.documents.forEach((d) => {
        if (d.file) formData.append('documents', d.file);
      });
      const response = await fetch(API_BASE, { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to save appointment');
      }
      cancelEditingRecord();
      await loadRecords(selectedHeaderId);
      setSaveMessage({ type: 'success', text: 'Saved.' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e) {
      setSaveMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to save' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRecord = async () => {
    if (!deleteConfirmRecordId || !toolId) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch(
        `${API_BASE}?toolId=${encodeURIComponent(toolId)}&resource=record&id=${encodeURIComponent(deleteConfirmRecordId)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to delete');
      }
      setDeleteConfirmRecordId(null);
      if (editingRecordId === deleteConfirmRecordId) cancelEditingRecord();
      if (selectedHeaderId) await loadRecords(selectedHeaderId);
      setSaveMessage({ type: 'success', text: 'Deleted.' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e) {
      setSaveMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to delete' });
    } finally {
      setIsSaving(false);
    }
  };

  const validateFileSize = (file: File): boolean => {
    return file.size <= MAX_FILE_SIZE_BYTES;
  };

  const addDocumentToNewRecord = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const valid = files.filter((f) => validateFileSize(f));
    const invalidCount = files.length - valid.length;
    if (invalidCount > 0) {
      alert(`Some files exceed the 10MB limit and were not added.`);
    }
    const newDocs: AppointmentDocument[] = valid.map((f) => ({
      id: generateId(),
      name: f.name,
      file: f,
      fileUrl: URL.createObjectURL(f),
      file_size: f.size,
    }));
    setNewRecord((prev) => ({
      ...prev,
      documents: [...prev.documents, ...newDocs],
    }));
    e.target.value = '';
  };

  const removeDocumentFromNewRecord = (docId: string) => {
    setNewRecord((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== docId),
    }));
  };

  const addDocumentToEditingRecord = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingRecord) return;
    const files = e.target.files ? Array.from(e.target.files) : [];
    const valid = files.filter((f) => validateFileSize(f));
    const newDocs: AppointmentDocument[] = valid.map((f) => ({
      id: generateId(),
      name: f.name,
      file: f,
      fileUrl: URL.createObjectURL(f),
      file_size: f.size,
    }));
    setEditingRecord({
      ...editingRecord,
      documents: [...editingRecord.documents, ...newDocs],
    });
    e.target.value = '';
  };

  const removeDocumentFromEditingRecord = async (docId: string) => {
    if (!editingRecord) return;
    const doc = editingRecord.documents.find((d) => d.id === docId);
    if (doc?.file) {
      setEditingRecord({
        ...editingRecord,
        documents: editingRecord.documents.filter((d) => d.id !== docId),
      });
      return;
    }
    if (!toolId) return;
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('resource', 'document');
      formData.append('action', 'delete');
      formData.append('documentId', docId);
      const response = await fetch(API_BASE, { method: 'POST', body: formData });
      if (response.ok) {
        setEditingRecord({
          ...editingRecord,
          documents: editingRecord.documents.filter((d) => d.id !== docId),
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const viewDocument = (doc: AppointmentDocument) => {
    if (doc.fileUrl) {
      window.open(doc.fileUrl, '_blank');
    } else if (doc.file) {
      window.open(URL.createObjectURL(doc.file), '_blank');
    }
  };

  const removeDocumentFromRecord = async (recordId: string, docId: string) => {
    if (!toolId || !selectedHeaderId) return;
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('resource', 'document');
      formData.append('action', 'delete');
      formData.append('documentId', docId);
      const response = await fetch(API_BASE, { method: 'POST', body: formData });
      if (response.ok) await loadRecords(selectedHeaderId);
    } finally {
      setIsSaving(false);
    }
  };

  const exportHealthcareReportToPdf = async () => {
    if (typeof window === 'undefined' || !selectedHeader) return;
    setIsExportingPdf(true);
    try {
      const filtered: AppointmentRecord[] = recordsForHeader.filter((r) => {
        const includeByType = exportIncludeUpcoming ? true : !r.isUpcoming;
        const includeByYear =
          exportHistoryScope === 'all' || !r.appointmentDate
            ? true
            : r.appointmentDate.startsWith(exportHistoryScope);
        return includeByType && includeByYear;
      });
      const visitCount = filtered.length;
      const totalBilledSum = filtered.reduce((sum, r) => sum + parseCurrency(r.totalBilled), 0);
      const insurancePaidSum = filtered.reduce((sum, r) => sum + parseCurrency(r.insurancePaid), 0);
      const patientResponsibilitySum = Math.max(0, totalBilledSum - insurancePaidSum);
      const currentAmountDueSum = filtered.reduce((sum, r) => sum + parseCurrency(r.currentAmountDue), 0);

      let jsPDF: any;
      if ((window as any).jspdf?.jsPDF) {
        jsPDF = (window as any).jspdf.jsPDF;
      } else {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          script.onload = () => {
            jsPDF = (window as any).jspdf.jsPDF;
            resolve();
          };
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const margin = 18;
      const contentW = pageW - margin * 2;
      let y = 20;

      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Healthcare Report', margin, y);
      y += 8;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${selectedHeader.name}  •  Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
      y += 14;

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Summary (KPIs)', margin, y);
      y += 8;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const kpiLabels = ['Number of visits', 'Total Billed', 'Insurance Paid', 'Patient Responsibility', 'Current Amount Due'];
      const kpiValues = [
        String(visitCount),
        formatCurrencyDisplay(String(totalBilledSum)),
        formatCurrencyDisplay(String(insurancePaidSum)),
        formatCurrencyDisplay(String(patientResponsibilitySum)),
        formatCurrencyDisplay(String(currentAmountDueSum)),
      ];
      const colW = contentW / 5;
      for (let i = 0; i < 5; i++) {
        pdf.setFont('helvetica', 'bold');
        pdf.text(kpiLabels[i], margin + i * colW, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(kpiValues[i], margin + i * colW, y + 6);
      }
      y += 20;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Appointments', margin, y);
      y += 10;

      const lineHeight = 6;
      const maxY = pdf.internal.pageSize.getHeight() - 25;

      for (const r of filtered) {
        if (y > maxY) {
          pdf.addPage();
          y = 20;
        }
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text(`${formatDateDisplay(r.appointmentDate)}  ${r.isUpcoming ? '(Upcoming)' : '(History)'}`, margin, y);
        y += lineHeight;
        pdf.setFont('helvetica', 'normal');
        const textOpt = { maxWidth: contentW };
        if (r.careFacility) {
          const lines = pdf.splitTextToSize(`Facility: ${r.careFacility}`, contentW);
          lines.forEach((line: string) => {
            pdf.text(line, margin, y);
            y += lineHeight;
          });
        }
        if (r.providerInfo) {
          const lines = pdf.splitTextToSize(`Provider: ${r.providerInfo}`, contentW);
          lines.forEach((line: string) => {
            pdf.text(line, margin, y);
            y += lineHeight;
          });
        }
        if (r.reasonForVisit) {
          const lines = pdf.splitTextToSize(`Reason: ${r.reasonForVisit}`, contentW);
          lines.forEach((line: string) => {
            pdf.text(line, margin, y);
            y += lineHeight;
          });
        }
        if (r.totalBilled || r.insurancePaid || r.currentAmountDue) {
          pdf.text(
            `Billed: ${formatCurrencyDisplay(r.totalBilled) || '—'}  |  Insurance: ${formatCurrencyDisplay(r.insurancePaid) || '—'}  |  Due: ${formatCurrencyDisplay(r.currentAmountDue) || '—'}`,
            margin,
            y
          );
          y += lineHeight;
        }
        y += 4;
      }

      pdf.save(`Healthcare_Report_${selectedHeader.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
      setShowExportPopup(false);
    } catch (e) {
      console.error('PDF export failed:', e);
      setSaveMessage({ type: 'error', text: 'Failed to generate PDF. Try again.' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-50 mb-2">Healthcare Appts &amp; History</h2>
        <p className="text-slate-400 text-sm">
          Track upcoming appointments and healthcare history for each family member.
        </p>
        {saveMessage && (
          <p
            className={`mt-2 text-sm ${saveMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {saveMessage.text}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Select family member
        </label>
        {isLoadingHeaders ? (
          <p className="text-slate-400 text-sm">Loading family members…</p>
        ) : !isCreatingNewHeader ? (
          <div className="flex items-center gap-3 flex-wrap">
            {/* Family member cards */}
            {headers.map((header) =>
              editingHeaderId === header.id ? (
                <div
                  key={header.id}
                  className="px-4 py-3 rounded-lg border border-slate-600 bg-slate-800 min-w-[200px]"
                  style={{
                    borderColor: editingHeaderColor,
                    backgroundColor: `${editingHeaderColor}15`,
                  }}
                >
                  <input
                    type="text"
                    value={editingHeaderName}
                    onChange={(e) => setEditingHeaderName(e.target.value)}
                    className="w-full px-2 py-1 rounded border border-slate-600 bg-slate-900 text-slate-100 text-sm mb-2 focus:border-emerald-500/50 focus:outline-none"
                    placeholder="Name"
                    autoFocus
                  />
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs text-slate-400">Color:</label>
                    <input
                      type="color"
                      value={editingHeaderColor}
                      onChange={(e) => setEditingHeaderColor(e.target.value)}
                      className="h-6 w-12 rounded border border-slate-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveHeaderEdit}
                      disabled={!editingHeaderName.trim() || isSaving}
                      className="flex-1 px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditingHeader}
                      disabled={isSaving}
                      className="px-2 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div key={header.id} className="relative">
                  <button
                    onClick={() => selectHeader(header.id)}
                    className={`px-4 py-3 rounded-lg border transition-all duration-200 min-w-[120px] relative ${
                      selectedHeaderId === header.id ? 'shadow-lg' : 'hover:border-slate-600'
                    }`}
                    style={{
                      borderColor: header.card_color || '#10b981',
                      backgroundColor:
                        selectedHeaderId === header.id
                          ? `${header.card_color || '#10b981'}15`
                          : `${header.card_color || '#10b981'}08`,
                      color: header.card_color || '#10b981',
                    }}
                  >
                    <div className="font-medium text-center">{header.name}</div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenHeaderId(menuOpenHeaderId === header.id ? null : header.id);
                    }}
                    className="absolute top-1 right-1 p-1 rounded hover:bg-slate-700/50 transition-colors"
                    aria-label="Options"
                  >
                    <svg className="h-4 w-4 text-slate-400 hover:text-slate-200" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>
                  {menuOpenHeaderId === header.id && (
                    <div className="absolute top-10 right-0 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-lg min-w-[160px] py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingHeader(header);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenHeaderId(null);
                          setDeleteConfirmHeaderId(header.id);
                          setDeleteConfirmText('');
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 transition-colors flex items-center gap-2"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            {/* Add new family member button */}
            <button
              onClick={() => {
                setIsCreatingNewHeader(true);
                setNewHeaderName('');
                setNewHeaderColor('#10b981');
              }}
              className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all duration-200 flex items-center justify-center min-w-[60px]"
              title="Add new family member"
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
                New family member name
              </label>
              <input
                type="text"
                value={newHeaderName}
                onChange={(e) => setNewHeaderName(e.target.value)}
                placeholder="e.g. Family3"
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createNewHeader();
                  if (e.key === 'Escape') setIsCreatingNewHeader(false);
                }}
                autoFocus
              />
            </div>
            <div className="min-w-[200px]">
              <label className="block text-sm font-medium text-slate-300 mb-2">Color</label>
              <input
                type="color"
                value={newHeaderColor}
                onChange={(e) => setNewHeaderColor(e.target.value)}
                className="h-9 w-14 rounded border border-slate-600 cursor-pointer"
              />
            </div>
            <button
              onClick={createNewHeader}
              disabled={!newHeaderName.trim() || isSaving}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create
            </button>
            <button
              onClick={() => setIsCreatingNewHeader(false)}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) }
      </div>

      {menuOpenHeaderId && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpenHeaderId(null)} />
      )}

      {/* Delete header confirmation */}
      {deleteConfirmHeaderId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete group</h3>
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4">
              <p className="text-red-300 font-semibold mb-2">⚠️ This action cannot be undone.</p>
              <p className="text-red-200 text-sm">
                All appointment records and documents in this group will be permanently deleted.
              </p>
            </div>
            <p className="text-slate-300 mb-4">
              Type <strong className="text-slate-200">delete</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4"
              onKeyDown={(e) => e.key === 'Escape' && (setDeleteConfirmHeaderId(null), setDeleteConfirmText(''))}
            />
            <div className="flex gap-3">
              <button
                onClick={deleteHeader}
                disabled={deleteConfirmText.toLowerCase() !== 'delete' || isSaving}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
              <button
                onClick={() => { setDeleteConfirmHeaderId(null); setDeleteConfirmText(''); }}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!selectedHeaderId && !isCreatingNewHeader && headers.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-slate-400">Select a group above to view or add appointments.</p>
        </div>
      )}

      {selectedHeaderId && selectedHeader && (
        <>
          <div className="border-b border-slate-800">
            <div className="flex gap-2 overflow-x-auto">
              <div className="px-4 py-2 text-[18px] font-medium text-slate-200 whitespace-nowrap border-b-2 border-transparent">
                {selectedHeader.name}:
              </div>
              {[
                { id: 'history', label: 'Appointments' },
                { id: 'kpi', label: 'KPI' },
                { id: 'report', label: 'Report' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'history' | 'kpi' | 'report')}
                  className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
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

          {activeTab === 'history' && (
            <div className="space-y-6">
              {!isAddingRecord && (
                <div className="flex justify-start">
                  <button
                    onClick={startAddingRecord}
                    disabled={isSaving || isLoadingRecords}
                    className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    + Add New Record
                  </button>
                </div>
              )}

              {isLoadingRecords && selectedHeaderId ? (
                <p className="text-slate-400 text-sm">Loading appointments…</p>
              ) : null}

              {!isAddingRecord && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Search</label>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by facility, provider, reason..."
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Filter</label>
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as 'all' | 'upcoming' | 'history')}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      >
                        <option value="all">All</option>
                        <option value="upcoming">Upcoming</option>
                        <option value="history">History</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Add record: step 1 choose type */}
              {isAddingRecord && recordTypeStep === 'choose' && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <h3 className="text-lg font-semibold text-slate-50 mb-4">Is this an upcoming visit or history?</h3>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="recordType"
                        checked={newRecordIsUpcoming}
                        onChange={() => setNewRecordIsUpcoming(true)}
                        className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                      />
                      <span className="text-slate-200">Upcoming visit</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="recordType"
                        checked={!newRecordIsUpcoming}
                        onChange={() => setNewRecordIsUpcoming(false)}
                        className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                      />
                      <span className="text-slate-200">History</span>
                    </label>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={confirmRecordTypeAndShowForm}
                      className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400"
                    >
                      Continue
                    </button>
                    <button
                      onClick={cancelAddingRecord}
                      className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Add record: step 2 form */}
              {isAddingRecord && recordTypeStep === 'form' && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-50">
                    {newRecord.isUpcoming ? 'New upcoming appointment' : 'New history record'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Appointment date <span className="text-red-400">*</span></label>
                      <input
                        type="date"
                        value={newRecord.appointmentDate}
                        onChange={(e) => setNewRecord({ ...newRecord, appointmentDate: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Care facility</label>
                      <input
                        type="text"
                        value={newRecord.careFacility}
                        onChange={(e) => setNewRecord({ ...newRecord, careFacility: e.target.value })}
                        placeholder="e.g. City Medical Center"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Provider info</label>
                    <input
                      type="text"
                      value={newRecord.providerInfo}
                      onChange={(e) => setNewRecord({ ...newRecord, providerInfo: e.target.value })}
                      placeholder="e.g. Dr. Smith, Cardiology"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Reason for visit</label>
                    <input
                      type="text"
                      value={newRecord.reasonForVisit}
                      onChange={(e) => setNewRecord({ ...newRecord, reasonForVisit: e.target.value })}
                      placeholder="e.g. Annual checkup"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Pre-visit notes</label>
                    <textarea
                      value={newRecord.preVisitNotes}
                      onChange={(e) => setNewRecord({ ...newRecord, preVisitNotes: e.target.value })}
                      placeholder="Notes before the visit..."
                      rows={2}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Post-visit notes</label>
                    <textarea
                      value={newRecord.postVisitNotes}
                      onChange={(e) => setNewRecord({ ...newRecord, postVisitNotes: e.target.value })}
                      placeholder="Notes after the visit..."
                      rows={2}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                    />
                  </div>
                  {newRecord.isUpcoming && (
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={newRecord.showOnDashboardCalendar}
                        onChange={(e) => setNewRecord({ ...newRecord, showOnDashboardCalendar: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                      />
                      <span className="text-sm text-slate-300">Show on dashboard calendar</span>
                    </label>
                  )}
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
                    <h4 className="text-sm font-medium text-slate-200">Financial (optional)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Total Billed</label>
                        <input
                          type="text"
                          value={newRecord.totalBilled}
                          onChange={(e) => setNewRecord({ ...newRecord, totalBilled: formatCurrency(e.target.value) })}
                          onBlur={(e) => {
                            if (e.target.value) {
                              setNewRecord((prev) => ({ ...prev, totalBilled: formatCurrencyDisplay(prev.totalBilled) }));
                            }
                          }}
                          onFocus={(e) => {
                            const numericValue = e.target.value.replace(/[^0-9.]/g, '');
                            setNewRecord((prev) => ({ ...prev, totalBilled: numericValue }));
                          }}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Insurance Paid</label>
                        <input
                          type="text"
                          value={newRecord.insurancePaid}
                          onChange={(e) => setNewRecord({ ...newRecord, insurancePaid: formatCurrency(e.target.value) })}
                          onBlur={(e) => {
                            if (e.target.value) {
                              setNewRecord((prev) => ({ ...prev, insurancePaid: formatCurrencyDisplay(prev.insurancePaid) }));
                            }
                          }}
                          onFocus={(e) => {
                            const numericValue = e.target.value.replace(/[^0-9.]/g, '');
                            setNewRecord((prev) => ({ ...prev, insurancePaid: numericValue }));
                          }}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Patient Responsibility</label>
                        <input
                          type="text"
                          readOnly
                          value={getPatientResponsibilityDisplay(newRecord.totalBilled, newRecord.insurancePaid)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 cursor-not-allowed"
                          tabIndex={-1}
                          aria-label="Patient Responsibility (calculated)"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Current Amount Due</label>
                        <input
                          type="text"
                          value={newRecord.currentAmountDue}
                          onChange={(e) => setNewRecord({ ...newRecord, currentAmountDue: formatCurrency(e.target.value) })}
                          onBlur={(e) => {
                            if (e.target.value) {
                              setNewRecord((prev) => ({ ...prev, currentAmountDue: formatCurrencyDisplay(prev.currentAmountDue) }));
                            }
                          }}
                          onFocus={(e) => {
                            const numericValue = e.target.value.replace(/[^0-9.]/g, '');
                            setNewRecord((prev) => ({ ...prev, currentAmountDue: numericValue }));
                          }}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Documents (max 10MB per file)</label>
                    <div className="relative">
                      <input
                        ref={docFileInputRef}
                        type="file"
                        id="new-record-docs"
                        multiple
                        accept="image/*,.pdf"
                        onChange={addDocumentToNewRecord}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <label
                        htmlFor="new-record-docs"
                        className="flex items-center gap-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-slate-300">
                          {newRecord.documents.length > 0
                            ? `${newRecord.documents.length} file(s) selected`
                            : 'Select files'}
                        </span>
                      </label>
                    </div>
                    {newRecord.documents.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {newRecord.documents.map((d) => (
                          <li key={d.id} className="flex items-center justify-between text-sm text-slate-300">
                            <span>{d.name}</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => viewDocument(d)}
                                className="text-emerald-400 hover:text-emerald-300"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => removeDocumentFromNewRecord(d.id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                Delete
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={cancelAddingRecord}
                      disabled={isSaving}
                      className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addRecord}
                      disabled={isSaving}
                      className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save record
                    </button>
                  </div>
                </div>
              )}

              {/* Edit record form */}
              {editingRecordId && editingRecord && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-50">Edit appointment</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Appointment date <span className="text-red-400">*</span></label>
                      <input
                        type="date"
                        value={editingRecord.appointmentDate}
                        onChange={(e) => setEditingRecord({ ...editingRecord, appointmentDate: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Care facility</label>
                      <input
                        type="text"
                        value={editingRecord.careFacility}
                        onChange={(e) => setEditingRecord({ ...editingRecord, careFacility: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Provider info</label>
                    <input
                      type="text"
                      value={editingRecord.providerInfo}
                      onChange={(e) => setEditingRecord({ ...editingRecord, providerInfo: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Reason for visit</label>
                    <input
                      type="text"
                      value={editingRecord.reasonForVisit}
                      onChange={(e) => setEditingRecord({ ...editingRecord, reasonForVisit: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Pre-visit notes</label>
                    <textarea
                      value={editingRecord.preVisitNotes}
                      onChange={(e) => setEditingRecord({ ...editingRecord, preVisitNotes: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Post-visit notes</label>
                    <textarea
                      value={editingRecord.postVisitNotes}
                      onChange={(e) => setEditingRecord({ ...editingRecord, postVisitNotes: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                    />
                  </div>
                  {editingRecord.isUpcoming && (
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={editingRecord.showOnDashboardCalendar}
                        onChange={(e) => setEditingRecord({ ...editingRecord, showOnDashboardCalendar: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                      />
                      <span className="text-sm text-slate-300">Show on dashboard calendar</span>
                    </label>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Total Billed</label>
                      <input
                        type="text"
                        value={editingRecord.totalBilled}
                        onChange={(e) => setEditingRecord({ ...editingRecord, totalBilled: formatCurrency(e.target.value) })}
                        onBlur={(e) => {
                          if (e.target.value) {
                            setEditingRecord((prev) => prev ? { ...prev, totalBilled: formatCurrencyDisplay(prev.totalBilled) } : prev);
                          }
                        }}
                        onFocus={(e) => {
                          const numericValue = e.target.value.replace(/[^0-9.]/g, '');
                          setEditingRecord((prev) => prev ? { ...prev, totalBilled: numericValue } : prev);
                        }}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Insurance Paid</label>
                      <input
                        type="text"
                        value={editingRecord.insurancePaid}
                        onChange={(e) => setEditingRecord({ ...editingRecord, insurancePaid: formatCurrency(e.target.value) })}
                        onBlur={(e) => {
                          if (e.target.value) {
                            setEditingRecord((prev) => prev ? { ...prev, insurancePaid: formatCurrencyDisplay(prev.insurancePaid) } : prev);
                          }
                        }}
                        onFocus={(e) => {
                          const numericValue = e.target.value.replace(/[^0-9.]/g, '');
                          setEditingRecord((prev) => prev ? { ...prev, insurancePaid: numericValue } : prev);
                        }}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Patient Responsibility</label>
                      <input
                        type="text"
                        readOnly
                        value={editingRecord ? getPatientResponsibilityDisplay(editingRecord.totalBilled, editingRecord.insurancePaid) : ''}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 cursor-not-allowed"
                        tabIndex={-1}
                        aria-label="Patient Responsibility (calculated)"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Current Amount Due</label>
                      <input
                        type="text"
                        value={editingRecord.currentAmountDue}
                        onChange={(e) => setEditingRecord({ ...editingRecord, currentAmountDue: formatCurrency(e.target.value) })}
                        onBlur={(e) => {
                          if (e.target.value) {
                            setEditingRecord((prev) => prev ? { ...prev, currentAmountDue: formatCurrencyDisplay(prev.currentAmountDue) } : prev);
                          }
                        }}
                        onFocus={(e) => {
                          const numericValue = e.target.value.replace(/[^0-9.]/g, '');
                          setEditingRecord((prev) => prev ? { ...prev, currentAmountDue: numericValue } : prev);
                        }}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Documents (max 10MB per file)</label>
                    <div className="relative">
                      <input
                        ref={editDocFileInputRef}
                        type="file"
                        id="edit-record-docs"
                        multiple
                        accept="image/*,.pdf"
                        onChange={addDocumentToEditingRecord}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <label
                        htmlFor="edit-record-docs"
                        className="flex items-center gap-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <span className="text-slate-300">Add more files</span>
                      </label>
                    </div>
                    {editingRecord.documents.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {editingRecord.documents.map((d) => (
                          <li key={d.id} className="flex items-center justify-between text-sm text-slate-300">
                            <span>{d.name}</span>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => viewDocument(d)} className="text-emerald-400 hover:text-emerald-300">View</button>
                              <button type="button" onClick={() => removeDocumentFromEditingRecord(d.id)} className="text-red-400 hover:text-red-300">Delete</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={cancelEditingRecord}
                      disabled={isSaving}
                      className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEditingRecord}
                      disabled={isSaving}
                      className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save changes
                    </button>
                  </div>
                </div>
              )}

              {/* Record list */}
              {!isAddingRecord && !editingRecordId && (
                <div className="space-y-4">
                  {filteredRecords.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-400">
                      No records found. Add one to get started!
                    </div>
                  ) : (
                    filteredRecords.map((record) => (
                      <div
                        key={record.id}
                        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-slate-100">
                                {formatDateDisplay(record.appointmentDate)}
                                {record.careFacility && ` · ${record.careFacility}`}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded ${
                                  record.isUpcoming
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-slate-600 text-slate-300'
                                }`}
                              >
                                {record.isUpcoming ? 'Upcoming' : 'History'}
                              </span>
                            </div>
                            {record.reasonForVisit && (
                              <p className="text-sm text-slate-300 mt-1">{record.reasonForVisit}</p>
                            )}
                            {record.providerInfo && (
                              <p className="text-xs text-slate-400 mt-0.5">{record.providerInfo}</p>
                            )}
                            {record.documents.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {record.documents.map((d) => (
                                  <span key={d.id} className="text-xs text-slate-400">
                                    {d.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditingRecord(record)}
                              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm hover:bg-slate-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirmRecordId(record.id)}
                              className="px-3 py-1.5 rounded-lg border border-red-500/50 bg-red-500/10 text-red-300 text-sm hover:bg-red-500/20"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'kpi' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h3 className="text-lg font-semibold text-slate-50 mb-4">Financial KPIs</h3>
                <p className="text-slate-300 text-sm mb-4">
                  Totals for {selectedHeader.name}
                  {kpiYearFilter === 'all' ? ' (all visits)' : ` (${kpiYearFilter})`}.
                </p>
                <div className="mb-6">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Show</label>
                  <select
                    value={kpiYearFilter}
                    onChange={(e) => setKpiYearFilter(e.target.value)}
                    className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="all">All visits</option>
                    {Array.from(
                      new Set(
                        recordsForHeader
                          .map((r) => r.appointmentDate?.slice(0, 4))
                          .filter(Boolean)
                      )
                    )
                      .sort((a, b) => b.localeCompare(a))
                      .map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                  </select>
                </div>
                {(() => {
                  const kpiFilteredRecords =
                    kpiYearFilter === 'all'
                      ? recordsForHeader
                      : recordsForHeader.filter((r) => r.appointmentDate?.startsWith(kpiYearFilter) ?? false);
                  const visitCount = kpiFilteredRecords.length;
                  const totalBilledSum = kpiFilteredRecords.reduce((sum, r) => sum + parseCurrency(r.totalBilled), 0);
                  const insurancePaidSum = kpiFilteredRecords.reduce((sum, r) => sum + parseCurrency(r.insurancePaid), 0);
                  const patientResponsibilitySum = Math.max(0, totalBilledSum - insurancePaidSum);
                  const currentAmountDueSum = kpiFilteredRecords.reduce((sum, r) => sum + parseCurrency(r.currentAmountDue), 0);
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Number of visits</div>
                        <div className="text-xl font-semibold text-slate-50">{visitCount}</div>
                      </div>
                      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Total Billed</div>
                        <div className="text-xl font-semibold text-slate-50">{formatCurrencyDisplay(String(totalBilledSum))}</div>
                      </div>
                      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Insurance Paid</div>
                        <div className="text-xl font-semibold text-slate-50">{formatCurrencyDisplay(String(insurancePaidSum))}</div>
                      </div>
                      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Patient Responsibility</div>
                        <div className="text-xl font-semibold text-slate-50">{formatCurrencyDisplay(String(patientResponsibilitySum))}</div>
                      </div>
                      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Current Amount Due</div>
                        <div className="text-xl font-semibold text-slate-50">{formatCurrencyDisplay(String(currentAmountDueSum))}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {activeTab === 'report' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h3 className="text-lg font-semibold text-slate-50 mb-4">Export Healthcare Report</h3>
                <p className="text-slate-300 mb-4">
                  Generate a report of all appointment history records for {selectedHeader.name}. The report will include appointments, provider and facility details, and financial summary.
                </p>
                <button
                  onClick={() => setShowExportPopup(true)}
                  className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                >
                  Generate PDF Report
                </button>
              </div>
            </div>
          )}

          {/* Export popup */}
          {showExportPopup && selectedHeader && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-50">Export Options</h3>
                  <button
                    onClick={() => setShowExportPopup(false)}
                    disabled={isExportingPdf}
                    className="text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                    aria-label="Close"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Include upcoming appointments?</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="exportIncludeUpcoming"
                          checked={exportIncludeUpcoming}
                          onChange={() => setExportIncludeUpcoming(true)}
                          className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                        />
                        <span className="text-slate-200">Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="exportIncludeUpcoming"
                          checked={!exportIncludeUpcoming}
                          onChange={() => setExportIncludeUpcoming(false)}
                          className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                        />
                        <span className="text-slate-200">No (history only)</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">History scope</label>
                    <div className="flex gap-4 flex-wrap items-center">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="exportHistoryScope"
                          checked={exportHistoryScope === 'all'}
                          onChange={() => setExportHistoryScope('all')}
                          className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                        />
                        <span className="text-slate-200">All history</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="exportHistoryScope"
                          checked={exportHistoryScope !== 'all'}
                          onChange={() => {
                            const years = Array.from(
                              new Set(
                                recordsForHeader
                                  .filter((r) => !r.isUpcoming)
                                  .map((r) => r.appointmentDate?.slice(0, 4))
                                  .filter(Boolean)
                              )
                            ).sort((a, b) => (b ?? '').localeCompare(a ?? ''));
                            setExportHistoryScope(years[0] ?? new Date().getFullYear().toString());
                          }}
                          className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                        />
                        <span className="text-slate-200">Select year:</span>
                      </label>
                      <select
                        value={exportHistoryScope === 'all' ? '' : exportHistoryScope}
                        onChange={(e) => setExportHistoryScope(e.target.value || 'all')}
                        className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none"
                      >
                        <option value="">--</option>
                        {Array.from(
                          new Set(
                            recordsForHeader
                              .filter((r) => !r.isUpcoming)
                              .map((r) => r.appointmentDate?.slice(0, 4))
                              .filter(Boolean)
                          )
                        )
                          .sort((a, b) => (b ?? '').localeCompare(a ?? ''))
                          .map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => exportHealthcareReportToPdf()}
                      disabled={isExportingPdf}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isExportingPdf ? 'Generating…' : 'Export to PDF'}
                    </button>
                    <button
                      onClick={() => setShowExportPopup(false)}
                      disabled={isExportingPdf}
                      className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete record confirmation */}
      {deleteConfirmRecordId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete record</h3>
            <p className="text-slate-300 mb-4">
              Are you sure you want to delete this appointment record? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={deleteRecord}
                disabled={isSaving}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirmRecordId(null)}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
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
