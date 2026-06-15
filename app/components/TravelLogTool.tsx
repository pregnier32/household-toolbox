'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from './AppThemeProvider';

const TRIP_TYPES = ['Family', 'Couple', 'Solo', 'Business', 'Friends', 'Group Tour', 'Other'] as const;
const TRIP_GOALS = ['Relaxation', 'Adventure', 'Family Time', 'Business', 'Other'] as const;
const TRANSPORTATION_OPTIONS = ['Car', 'Plane', 'Train', 'Cruise', 'RV', 'Other'] as const;
const LODGING_TYPES = ['Hotel', 'Motel', 'Resort', 'Vacation Rental', 'Camping', 'RV Park', 'Friends/Family', 'Other'] as const;
const YES_NO_MAYBE = ['Yes', 'No', 'Maybe'] as const;
const YES_NO = ['Yes', 'No'] as const;

type TripType = (typeof TRIP_TYPES)[number];
type TripGoal = (typeof TRIP_GOALS)[number];
type Transportation = (typeof TRANSPORTATION_OPTIONS)[number];
type LodgingType = (typeof LODGING_TYPES)[number];
type YesNoMaybe = (typeof YES_NO_MAYBE)[number];
type YesNo = (typeof YES_NO)[number];

type LodgingRecord = {
  id: string;
  name: string;
  type: LodgingType | '';
  checkInDate: string;
  checkOutDate: string;
  notes: string;
  rating: number;
};

type JournalNote = {
  id: string;
  name: string;
  noteDate: string;
  text: string;
};

export type TripRecord = {
  id: string;
  tripName: string;
  destination: string;
  startDate: string;
  endDate: string;
  tripRating: number;
  tripType: TripType | '';
  tripGoal: TripGoal | '';
  tripGoalOther: string;
  transportationMethods: Transportation[];
  departureLocation: string;
  primaryDestination: string;
  travelCompanions: string;
  lodging: LodgingRecord[];
  plannedBudget: string;
  totalTripCost: string;
  budgetNotes: string;
  journalNotes: JournalNote[];
  bestMemory: string;
  biggestSurprise: string;
  highlightOfTrip: string;
  wouldReturn: YesNoMaybe | '';
  wouldRecommend: YesNoMaybe | '';
  includeInTravelCounts: YesNo | '';
  dateAdded: string;
};

type TripFormState = Omit<TripRecord, 'id' | 'dateAdded'>;

type LodgingDraft = {
  name: string;
  type: LodgingType | '';
  checkInDate: string;
  checkOutDate: string;
  notes: string;
  rating: number;
};

type JournalDraft = {
  name: string;
  noteDate: string;
  text: string;
};

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseLocalDate(isoDate: string): Date | null {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDateDisplay(isoDate: string): string {
  const d = parseLocalDate(isoDate);
  if (!d || Number.isNaN(d.getTime())) return isoDate || 'N/A';
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function calculateTripDays(startDate: string, endDate: string): number | null {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return null;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
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

function emptyLodgingDraft(): LodgingDraft {
  return {
    name: '',
    type: '',
    checkInDate: '',
    checkOutDate: '',
    notes: '',
    rating: 0,
  };
}

function emptyJournalDraft(): JournalDraft {
  return {
    name: '',
    noteDate: new Date().toISOString().split('T')[0],
    text: '',
  };
}

function emptyTripForm(): TripFormState {
  return {
    tripName: '',
    destination: '',
    startDate: '',
    endDate: '',
    tripRating: 0,
    tripType: '',
    tripGoal: '',
    tripGoalOther: '',
    transportationMethods: [],
    departureLocation: '',
    primaryDestination: '',
    travelCompanions: '',
    lodging: [],
    plannedBudget: '',
    totalTripCost: '',
    budgetNotes: '',
    journalNotes: [],
    bestMemory: '',
    biggestSurprise: '',
    highlightOfTrip: '',
    wouldReturn: '',
    wouldRecommend: '',
    includeInTravelCounts: '',
  };
}

function tripToForm(trip: TripRecord): TripFormState {
  return {
    tripName: trip.tripName,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    tripRating: trip.tripRating,
    tripType: trip.tripType,
    tripGoal: trip.tripGoal,
    tripGoalOther: trip.tripGoalOther,
    transportationMethods: [...trip.transportationMethods],
    departureLocation: trip.departureLocation,
    primaryDestination: trip.primaryDestination,
    travelCompanions: trip.travelCompanions,
    lodging: trip.lodging.map((l) => ({ ...l })),
    plannedBudget: trip.plannedBudget,
    totalTripCost: trip.totalTripCost,
    budgetNotes: trip.budgetNotes,
    journalNotes: trip.journalNotes.map((n) => ({ ...n })),
    bestMemory: trip.bestMemory,
    biggestSurprise: trip.biggestSurprise,
    highlightOfTrip: trip.highlightOfTrip,
    wouldReturn: trip.wouldReturn,
    wouldRecommend: trip.wouldRecommend,
    includeInTravelCounts: trip.includeInTravelCounts ?? '',
  };
}

function StarRating({
  value,
  onChange,
  label,
  size = 'md',
}: {
  value: number;
  onChange?: (rating: number) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  const iconClass = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  return (
    <div>
      <span className="sr-only">{label}</span>
      <div className="flex gap-0.5" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            disabled={!onChange}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            title={`${star} star${star > 1 ? 's' : ''}`}
            className={`rounded p-0.5 text-slate-400 transition-colors ${
              onChange ? 'hover:text-amber-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50' : 'cursor-default'
            }`}
          >
            <svg
              className={`${iconClass} ${value >= star ? 'text-amber-400' : ''}`}
              fill={value >= star ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

type DeleteRecordConfirmModalProps = {
  title: string;
  itemName: string;
  recordType: string;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

function DeleteRecordConfirmModal({
  title,
  itemName,
  recordType,
  confirmText,
  onConfirmTextChange,
  onConfirm,
  onCancel,
}: DeleteRecordConfirmModalProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const modalCardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-2xl'
    : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4';
  const secondaryButtonClass = isLight
    ? 'px-4 py-2 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors'
    : 'px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors';
  const deleteConfirmInputClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4'
    : 'w-full rounded-lg border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={modalCardClass} role="dialog" aria-modal="true" aria-labelledby="delete-record-modal-title">
        <div
          className={
            isLight
              ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 mb-4'
              : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4'
          }
        >
          <p className={isLight ? 'text-red-700 font-semibold' : 'text-red-300 font-semibold'}>
            ⚠️ This action cannot be undone
          </p>
          <p className={`text-sm mt-1 ${isLight ? 'text-red-600' : 'text-red-200'}`}>
            The {recordType} <strong>{itemName}</strong> will be permanently deleted.
          </p>
        </div>
        <h3
          id="delete-record-modal-title"
          className={`text-xl font-semibold mb-2 ${isLight ? 'text-slate-900' : 'text-slate-50'}`}
        >
          {title}
        </h3>
        <p className={`text-sm mb-4 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          Type <strong>delete</strong> to confirm.
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => onConfirmTextChange(e.target.value)}
          placeholder="Type 'delete' to confirm"
          className={deleteConfirmInputClass}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
          }}
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmText.toLowerCase() !== 'delete'}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete
          </button>
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

type LodgingSectionProps = {
  form: TripFormState;
  setForm: React.Dispatch<React.SetStateAction<TripFormState>>;
};

function LodgingSection({ form, setForm }: LodgingSectionProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const subsectionTitleClass = isLight ? 'text-sm font-semibold text-slate-800' : 'text-sm font-semibold text-slate-100';
  const nestedCardClass = isLight
    ? 'p-4 rounded-lg border border-slate-200 bg-slate-50'
    : 'p-4 rounded-lg border border-slate-700 bg-slate-800/50';
  const labelClass = isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5';
  const inputClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const selectClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const textareaClass = `${inputClass} resize-none`;
  const primaryButtonClass = isLight
    ? 'px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
    : 'px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
  const secondaryButtonClass = isLight
    ? 'px-4 py-2 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors'
    : 'px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors';
  const rowIconEmeraldClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-700 bg-white p-2 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 p-2 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const rowIconDangerClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-red-300 bg-white p-2 text-red-700 transition-colors hover:bg-red-50 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-800/50 p-2 text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const addIconButtonClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-700 bg-white p-1.5 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 p-1.5 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const tagChipNeutralClass = isLight
    ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-slate-300 bg-slate-100 text-slate-700'
    : 'px-1.5 py-0.5 rounded text-xs font-medium bg-slate-600/50 text-slate-400';
  const metaLabelClass = isLight ? 'text-slate-500' : 'text-slate-400';
  const metaValueClass = isLight ? 'text-slate-800' : 'text-slate-200';
  const modalCardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-lg w-full mx-4 shadow-xl'
    : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-lg w-full mx-4';
  const sectionTitleClass = isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50';
  const descClass = isLight ? 'text-slate-600 text-sm' : 'text-slate-400 text-sm';

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LodgingDraft>(emptyLodgingDraft());
  const [deleteConfirmLodging, setDeleteConfirmLodging] = useState<LodgingRecord | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const cancelDeleteConfirm = () => {
    setDeleteConfirmLodging(null);
    setDeleteConfirmText('');
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setDraft(emptyLodgingDraft());
  };

  useEffect(() => {
    if (!modalOpen && !deleteConfirmLodging) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteConfirmLodging) cancelDeleteConfirm();
        else closeModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen, deleteConfirmLodging]);

  const openAddModal = () => {
    setEditingId(null);
    setDraft(emptyLodgingDraft());
    setModalOpen(true);
  };

  const openEditModal = (lodging: LodgingRecord) => {
    setEditingId(lodging.id);
    setDraft({
      name: lodging.name,
      type: lodging.type,
      checkInDate: lodging.checkInDate,
      checkOutDate: lodging.checkOutDate,
      notes: lodging.notes,
      rating: lodging.rating,
    });
    setModalOpen(true);
  };

  const saveLodging = () => {
    if (!draft.name.trim()) {
      alert('Please enter a lodging name.');
      return;
    }
    const record: LodgingRecord = {
      id: editingId ?? generateId(),
      name: draft.name.trim(),
      type: draft.type,
      checkInDate: draft.checkInDate,
      checkOutDate: draft.checkOutDate,
      notes: draft.notes.trim(),
      rating: draft.rating,
    };
    setForm((prev) => {
      if (editingId) {
        return {
          ...prev,
          lodging: prev.lodging.map((l) => (l.id === editingId ? record : l)),
        };
      }
      return { ...prev, lodging: [...prev.lodging, record] };
    });
    closeModal();
  };

  const requestDeleteLodging = (lodging: LodgingRecord) => {
    setDeleteConfirmLodging(lodging);
    setDeleteConfirmText('');
  };

  const confirmDeleteLodging = () => {
    if (!deleteConfirmLodging || deleteConfirmText.toLowerCase() !== 'delete') return;
    setForm((prev) => ({
      ...prev,
      lodging: prev.lodging.filter((l) => l.id !== deleteConfirmLodging.id),
    }));
    if (editingId === deleteConfirmLodging.id) closeModal();
    cancelDeleteConfirm();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <h4 className={subsectionTitleClass}>Lodging</h4>
        <button
          type="button"
          onClick={openAddModal}
          aria-label="Add lodging"
          title="Add lodging"
          className={addIconButtonClass}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {form.lodging.length > 0 ? (
        <div className="space-y-3">
          {form.lodging.map((lodging) => (
            <div key={lodging.id} className={nestedCardClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={isLight ? 'font-semibold text-slate-900' : 'font-semibold text-slate-100'}>
                      {lodging.name}
                    </span>
                    {lodging.type && <span className={tagChipNeutralClass}>{lodging.type}</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-2">
                    {lodging.checkInDate && (
                      <div>
                        <span className={metaLabelClass}>Check in: </span>
                        <span className={metaValueClass}>{formatDateDisplay(lodging.checkInDate)}</span>
                      </div>
                    )}
                    {lodging.checkOutDate && (
                      <div>
                        <span className={metaLabelClass}>Check out: </span>
                        <span className={metaValueClass}>{formatDateDisplay(lodging.checkOutDate)}</span>
                      </div>
                    )}
                  </div>
                  {lodging.rating > 0 && (
                    <div className="mb-2">
                      <StarRating value={lodging.rating} label={`${lodging.name} rating`} size="sm" />
                    </div>
                  )}
                  {lodging.notes && (
                    <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{lodging.notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(lodging)}
                    aria-label="Edit lodging"
                    title="Edit lodging"
                    className={rowIconEmeraldClass}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDeleteLodging(lodging)}
                    aria-label="Delete lodging"
                    title="Delete lodging"
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
        <p className={descClass}>No lodging records yet. Use + to add one.</p>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className={modalCardClass}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lodging-modal-title"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="lodging-modal-title" className={sectionTitleClass}>
                {editingId ? 'Edit lodging' : 'Add lodging'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close modal"
                title="Close modal"
                className={isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Name</label>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    className={inputClass}
                    placeholder="Hotel or rental name"
                  />
                </div>
                <div>
                  <label className={labelClass}>Type</label>
                  <select
                    value={draft.type}
                    onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as LodgingType | '' }))}
                    className={selectClass}
                  >
                    <option value="">Select type...</option>
                    {LODGING_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Check in date</label>
                  <input
                    type="date"
                    value={draft.checkInDate}
                    onChange={(e) => setDraft((d) => ({ ...d, checkInDate: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Check out date</label>
                  <input
                    type="date"
                    value={draft.checkOutDate}
                    onChange={(e) => setDraft((d) => ({ ...d, checkOutDate: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Lodging rating</label>
                <StarRating
                  value={draft.rating}
                  onChange={(rating) => setDraft((d) => ({ ...d, rating }))}
                  label="Lodging rating"
                />
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  rows={3}
                  className={textareaClass}
                  placeholder="Room details, location, tips..."
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={saveLodging}
                  disabled={!draft.name.trim()}
                  className={primaryButtonClass}
                >
                  {editingId ? 'Save lodging' : 'Add lodging'}
                </button>
                <button type="button" onClick={closeModal} className={secondaryButtonClass}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmLodging && (
        <DeleteRecordConfirmModal
          title="Delete lodging record?"
          itemName={deleteConfirmLodging.name}
          recordType="lodging record"
          confirmText={deleteConfirmText}
          onConfirmTextChange={setDeleteConfirmText}
          onConfirm={confirmDeleteLodging}
          onCancel={cancelDeleteConfirm}
        />
      )}
    </div>
  );
}

type JournalSectionProps = {
  form: TripFormState;
  setForm: React.Dispatch<React.SetStateAction<TripFormState>>;
};

function JournalSection({ form, setForm }: JournalSectionProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const subsectionTitleClass = isLight ? 'text-sm font-semibold text-slate-800' : 'text-sm font-semibold text-slate-100';
  const nestedCardClass = isLight
    ? 'p-4 rounded-lg border border-slate-200 bg-slate-50'
    : 'p-4 rounded-lg border border-slate-700 bg-slate-800/50';
  const labelClass = isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5';
  const inputClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const textareaClass = `${inputClass} resize-none`;
  const primaryButtonClass = isLight
    ? 'px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
    : 'px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
  const secondaryButtonClass = isLight
    ? 'px-4 py-2 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors'
    : 'px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors';
  const rowIconEmeraldClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-700 bg-white p-2 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 p-2 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const rowIconDangerClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-red-300 bg-white p-2 text-red-700 transition-colors hover:bg-red-50 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-800/50 p-2 text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const addIconButtonClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-700 bg-white p-1.5 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 p-1.5 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const metaLabelClass = isLight ? 'text-slate-500' : 'text-slate-400';
  const modalCardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-lg w-full mx-4 shadow-xl'
    : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-lg w-full mx-4';
  const sectionTitleClass = isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50';
  const descClass = isLight ? 'text-slate-600 text-sm' : 'text-slate-400 text-sm';

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<JournalDraft>(emptyJournalDraft());
  const [deleteConfirmNote, setDeleteConfirmNote] = useState<JournalNote | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const cancelDeleteConfirm = () => {
    setDeleteConfirmNote(null);
    setDeleteConfirmText('');
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setDraft(emptyJournalDraft());
  };

  useEffect(() => {
    if (!modalOpen && !deleteConfirmNote) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteConfirmNote) cancelDeleteConfirm();
        else closeModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen, deleteConfirmNote]);

  const openAddModal = () => {
    setEditingId(null);
    setDraft(emptyJournalDraft());
    setModalOpen(true);
  };

  const openEditModal = (note: JournalNote) => {
    setEditingId(note.id);
    setDraft({ name: note.name ?? '', noteDate: note.noteDate, text: note.text });
    setModalOpen(true);
  };

  const saveJournal = () => {
    if (!draft.name.trim()) {
      alert('Please enter a journal note name.');
      return;
    }
    if (!draft.text.trim()) {
      alert('Please enter journal note text.');
      return;
    }
    const record: JournalNote = {
      id: editingId ?? generateId(),
      name: draft.name.trim(),
      noteDate: draft.noteDate || new Date().toISOString().split('T')[0],
      text: draft.text.trim(),
    };
    setForm((prev) => {
      if (editingId) {
        return {
          ...prev,
          journalNotes: prev.journalNotes.map((n) => (n.id === editingId ? record : n)),
        };
      }
      return { ...prev, journalNotes: [...prev.journalNotes, record] };
    });
    closeModal();
  };

  const requestDeleteJournal = (note: JournalNote) => {
    setDeleteConfirmNote(note);
    setDeleteConfirmText('');
  };

  const confirmDeleteJournal = () => {
    if (!deleteConfirmNote || deleteConfirmText.toLowerCase() !== 'delete') return;
    setForm((prev) => ({
      ...prev,
      journalNotes: prev.journalNotes.filter((n) => n.id !== deleteConfirmNote.id),
    }));
    if (editingId === deleteConfirmNote.id) closeModal();
    cancelDeleteConfirm();
  };

  const sortedNotes = [...form.journalNotes].sort((a, b) =>
    (b.noteDate || '').localeCompare(a.noteDate || '')
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <h4 className={subsectionTitleClass}>Journal</h4>
        <button
          type="button"
          onClick={openAddModal}
          aria-label="Add journal note"
          title="Add journal note"
          className={addIconButtonClass}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {sortedNotes.length > 0 ? (
        <div className="space-y-3">
          {sortedNotes.map((note) => (
            <div key={note.id} className={nestedCardClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  {note.name ? (
                    <p className={`font-semibold mb-1 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      {note.name}
                    </p>
                  ) : null}
                  <p className={`text-xs mb-1 ${metaLabelClass}`}>{formatDateDisplay(note.noteDate)}</p>
                  <p className={`text-sm whitespace-pre-line ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                    {note.text}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(note)}
                    aria-label="Edit journal note"
                    title="Edit journal note"
                    className={rowIconEmeraldClass}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDeleteJournal(note)}
                    aria-label="Delete journal note"
                    title="Delete journal note"
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
        <p className={descClass}>No journal notes yet. Use + to add one.</p>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className={modalCardClass}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="journal-modal-title"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="journal-modal-title" className={sectionTitleClass}>
                {editingId ? 'Edit journal note' : 'Add journal note'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close modal"
                title="Close modal"
                className={isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Name</label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. Day 1 in Rome"
                />
              </div>
              <div>
                <label className={labelClass}>Date</label>
                <input
                  type="date"
                  value={draft.noteDate}
                  onChange={(e) => setDraft((d) => ({ ...d, noteDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Note</label>
                <textarea
                  value={draft.text}
                  onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                  rows={4}
                  className={textareaClass}
                  placeholder="What happened today?"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={saveJournal}
                  disabled={!draft.name.trim() || !draft.text.trim()}
                  className={primaryButtonClass}
                >
                  {editingId ? 'Save note' : 'Add note'}
                </button>
                <button type="button" onClick={closeModal} className={secondaryButtonClass}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmNote && (
        <DeleteRecordConfirmModal
          title="Delete journal note?"
          itemName={deleteConfirmNote.name || 'Untitled note'}
          recordType="journal note"
          confirmText={deleteConfirmText}
          onConfirmTextChange={setDeleteConfirmText}
          onConfirm={confirmDeleteJournal}
          onCancel={cancelDeleteConfirm}
        />
      )}
    </div>
  );
}

type TravelLogToolProps = {
  toolId?: string;
};

export function TravelLogTool({ toolId }: TravelLogToolProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const titleClass = isLight ? 'text-2xl font-semibold text-slate-900 mb-2' : 'text-2xl font-semibold text-slate-50 mb-2';
  const descClass = isLight ? 'text-slate-600 text-sm' : 'text-slate-400 text-sm';
  const cardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-6';
  const nestedCardClass = isLight
    ? 'p-4 rounded-lg border border-slate-200 bg-slate-50'
    : 'p-4 rounded-lg border border-slate-700 bg-slate-800/50';
  const sectionTitleClass = isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50';
  const subsectionTitleClass = isLight ? 'text-sm font-semibold text-slate-800 mb-3' : 'text-sm font-semibold text-slate-100 mb-3';
  const labelClass = isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5';
  const labelClassSm = isLight ? 'block text-xs font-medium text-slate-600 mb-1' : 'block text-xs font-medium text-slate-400 mb-1';
  const inputClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const selectClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const textareaClass = `${inputClass} resize-none`;
  const primaryButtonClass = isLight
    ? 'px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
    : 'px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
  const primaryButtonSmClass = isLight
    ? 'px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed'
    : 'px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed';
  const secondaryButtonClass = isLight
    ? 'px-4 py-2 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors'
    : 'px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors';
  const secondaryButtonSmClass = isLight
    ? 'px-3 py-1.5 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 text-sm hover:bg-slate-200'
    : 'px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-700 text-slate-200 text-sm hover:bg-slate-600';
  const tabStripClass = isLight ? 'border-b border-slate-200' : 'border-b border-slate-800';
  const tabActiveClass = isLight
    ? 'border-b-2 border-emerald-600 text-emerald-900 font-semibold'
    : 'border-b-2 border-emerald-500 text-emerald-300';
  const tabInactiveClass = isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-300';
  const rowIconEmeraldClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-700 bg-white p-2 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 p-2 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const rowIconSecondaryClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-slate-400 bg-slate-100 p-2 text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-slate-600 bg-slate-800 p-2 text-slate-200 transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const rowIconDangerClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-red-300 bg-white p-2 text-red-700 transition-colors hover:bg-red-50 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-800/50 p-2 text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const tagChipClass = isLight
    ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-emerald-300 bg-emerald-50 text-emerald-800'
    : 'px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300';
  const tagChipNeutralClass = isLight
    ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-slate-300 bg-slate-100 text-slate-700'
    : 'px-1.5 py-0.5 rounded text-xs font-medium bg-slate-600/50 text-slate-400';
  const counterTextClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400';
  const metaLabelClass = isLight ? 'text-slate-500' : 'text-slate-400';
  const metaValueClass = isLight ? 'text-slate-800' : 'text-slate-200';
  const modalCardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-xl'
    : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4';
  const checkboxClass = isLight
    ? 'rounded border-slate-400 bg-white text-emerald-600 focus:ring-emerald-500 focus:ring-offset-white'
    : 'rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800';
  const loadingClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400';

  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'trips' | 'export'>('trips');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newTrip, setNewTrip] = useState<TripFormState>(emptyTripForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTrip, setEditingTrip] = useState<TripFormState>(emptyTripForm());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showExportPopup, setShowExportPopup] = useState(false);

  const loadTrips = useCallback(async () => {
    if (!toolId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tools/travel-log?toolId=${toolId}`);
      if (!response.ok) {
        setTrips([]);
        return;
      }
      const data = await response.json();
      setTrips(Array.isArray(data.trips) ? data.trips : []);
    } catch {
      setTrips([]);
    } finally {
      setIsLoading(false);
    }
  }, [toolId]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteConfirmId) {
          setDeleteConfirmId(null);
          setDeleteConfirmText('');
        }
        if (showExportPopup) setShowExportPopup(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteConfirmId, showExportPopup]);

  const tripSearchText = useCallback((trip: TripRecord) => {
    return [
      trip.tripName,
      trip.destination,
      trip.primaryDestination,
      trip.departureLocation,
      trip.travelCompanions,
      trip.tripType,
      trip.tripGoal,
      trip.tripGoalOther,
      trip.transportationMethods.join(' '),
      trip.budgetNotes,
      trip.bestMemory,
      trip.biggestSurprise,
      trip.highlightOfTrip,
      ...trip.lodging.map((l) => [l.name, l.type, l.notes].join(' ')),
      ...trip.journalNotes.map((n) => [n.name, n.text].join(' ')),
    ]
      .join(' ')
      .toLowerCase();
  }, []);

  const filteredTrips = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return trips.filter((trip) => q === '' || tripSearchText(trip).includes(q));
  }, [trips, searchQuery, tripSearchText]);

  const tripHistory = useMemo(
    () =>
      [...filteredTrips].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')),
    [filteredTrips]
  );

  const validateTripForm = (form: TripFormState): boolean => {
    if (!form.tripName.trim()) {
      alert('Please enter a trip name.');
      return false;
    }
    if (!form.startDate || !form.endDate) {
      alert('Please enter start and end dates.');
      return false;
    }
    if (calculateTripDays(form.startDate, form.endDate) === null) {
      alert('End date must be on or after the start date.');
      return false;
    }
    if (form.tripGoal === 'Other' && !form.tripGoalOther.trim()) {
      alert('Please describe your trip goal.');
      return false;
    }
    return true;
  };

  const formToTripPayload = (form: TripFormState): TripFormState => ({
    ...form,
    tripName: form.tripName.trim(),
    destination: form.destination.trim(),
    departureLocation: form.departureLocation.trim(),
    primaryDestination: form.primaryDestination.trim(),
    travelCompanions: form.travelCompanions.trim(),
    tripGoalOther: form.tripGoal === 'Other' ? form.tripGoalOther.trim() : '',
    plannedBudget: form.plannedBudget.trim() ? formatCurrencyDisplay(form.plannedBudget.trim()) : '',
    totalTripCost: form.totalTripCost.trim() ? formatCurrencyDisplay(form.totalTripCost.trim()) : '',
    budgetNotes: form.budgetNotes.trim(),
    bestMemory: form.bestMemory.trim(),
    biggestSurprise: form.biggestSurprise.trim(),
    highlightOfTrip: form.highlightOfTrip.trim(),
  });

  const addTrip = async () => {
    if (!validateTripForm(newTrip) || !toolId) return;
    const payload = formToTripPayload(newTrip);

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/travel-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          action: 'create',
          trip: payload,
        }),
      });

      if (!response.ok) {
        alert('Failed to save trip. Please try again.');
        return;
      }

      const data = await response.json();
      if (data.trip) {
        setTrips((prev) => [...prev, data.trip as TripRecord]);
      } else {
        await loadTrips();
      }
      setNewTrip(emptyTripForm());
      setIsAdding(false);
    } catch {
      alert('Failed to save trip. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (trip: TripRecord) => {
    setEditingId(trip.id);
    setEditingTrip(tripToForm(trip));
    setIsAdding(false);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingTrip(emptyTripForm());
  };

  const saveEdit = async () => {
    if (!editingId || !validateTripForm(editingTrip) || !toolId) return;
    const payload = formToTripPayload(editingTrip);

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/travel-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          tripId: editingId,
          action: 'update',
          trip: payload,
        }),
      });

      if (!response.ok) {
        alert('Failed to save changes. Please try again.');
        return;
      }

      const data = await response.json();
      if (data.trip) {
        setTrips((prev) =>
          prev.map((t) => (t.id === editingId ? (data.trip as TripRecord) : t))
        );
      } else {
        await loadTrips();
      }
      cancelEditing();
    } catch {
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTrip = async () => {
    if (!deleteConfirmId || deleteConfirmText.toLowerCase() !== 'delete' || !toolId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/travel-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          tripId: deleteConfirmId,
          action: 'delete',
        }),
      });

      if (!response.ok) {
        alert('Failed to delete trip. Please try again.');
        return;
      }

      setTrips((prev) => prev.filter((t) => t.id !== deleteConfirmId));
      if (editingId === deleteConfirmId) cancelEditing();
      setDeleteConfirmId(null);
      setDeleteConfirmText('');
    } catch {
      alert('Failed to delete trip. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const addTransportationMethod = (
    setForm: React.Dispatch<React.SetStateAction<TripFormState>>,
    method: Transportation
  ) => {
    setForm((prev) =>
      prev.transportationMethods.includes(method)
        ? prev
        : { ...prev, transportationMethods: [...prev.transportationMethods, method] }
    );
  };

  const removeTransportationMethod = (
    setForm: React.Dispatch<React.SetStateAction<TripFormState>>,
    method: Transportation
  ) => {
    setForm((prev) => ({
      ...prev,
      transportationMethods: prev.transportationMethods.filter((m) => m !== method),
    }));
  };

  const renderYesNoMaybe = (
    field: 'wouldReturn' | 'wouldRecommend',
    form: TripFormState,
    setForm: React.Dispatch<React.SetStateAction<TripFormState>>,
    label: string
  ) => (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex flex-wrap gap-3">
        {YES_NO_MAYBE.map((option) => (
          <label key={option} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`${field}-group`}
              checked={form[field] === option}
              onChange={() => setForm((prev) => ({ ...prev, [field]: option }))}
              className={checkboxClass}
            />
            <span className={isLight ? 'text-sm text-slate-800' : 'text-sm text-slate-200'}>{option}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const renderYesNo = (
    field: 'includeInTravelCounts',
    form: TripFormState,
    setForm: React.Dispatch<React.SetStateAction<TripFormState>>,
    label: string
  ) => (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex flex-wrap gap-3">
        {YES_NO.map((option) => (
          <label key={option} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`${field}-group`}
              checked={form[field] === option}
              onChange={() => setForm((prev) => ({ ...prev, [field]: option }))}
              className={checkboxClass}
            />
            <span className={isLight ? 'text-sm text-slate-800' : 'text-sm text-slate-200'}>{option}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const renderTripForm = (
    form: TripFormState,
    setForm: React.Dispatch<React.SetStateAction<TripFormState>>
  ) => {
    const dayCount = calculateTripDays(form.startDate, form.endDate);

    return (
      <div className="space-y-6">
        <div>
          <p className={isLight ? 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 mb-3' : 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-3'}>
            Trip overview
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Trip name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.tripName}
                onChange={(e) => setForm((f) => ({ ...f, tripName: e.target.value }))}
                className={inputClass}
                placeholder="Summer in Italy"
              />
            </div>
            <div>
              <label className={labelClass}>Destination</label>
              <input
                type="text"
                value={form.destination}
                onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                className={inputClass}
                placeholder="Rome, Italy"
              />
            </div>
            <div>
              <label className={labelClass}>
                Start date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                End date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Number of days</label>
              <input
                type="text"
                readOnly
                value={dayCount !== null ? String(dayCount) : '—'}
                className={`${inputClass} ${isLight ? 'bg-slate-100' : 'bg-slate-800/50'} cursor-not-allowed`}
                aria-readonly="true"
              />
            </div>
            <div>
              <label className={labelClass}>Trip rating</label>
              <StarRating
                value={form.tripRating}
                onChange={(rating) => setForm((f) => ({ ...f, tripRating: rating }))}
                label="Trip rating"
              />
            </div>
            <div>
              <label className={labelClass}>Trip type</label>
              <select
                value={form.tripType}
                onChange={(e) => setForm((f) => ({ ...f, tripType: e.target.value as TripType | '' }))}
                className={selectClass}
              >
                <option value="">Select type...</option>
                {TRIP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Trip goal</label>
              <select
                value={form.tripGoal}
                onChange={(e) => setForm((f) => ({ ...f, tripGoal: e.target.value as TripGoal | '' }))}
                className={selectClass}
              >
                <option value="">Select goal...</option>
                {TRIP_GOALS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              {form.tripGoal === 'Other' && (
                <input
                  type="text"
                  value={form.tripGoalOther}
                  onChange={(e) => setForm((f) => ({ ...f, tripGoalOther: e.target.value }))}
                  className={`${inputClass} mt-2`}
                  placeholder="Describe your trip goal"
                />
              )}
            </div>
          </div>
        </div>

        <div>
          <p className={isLight ? 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 mb-3' : 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-3'}>
            Travel details
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Departure location</label>
              <input
                type="text"
                value={form.departureLocation}
                onChange={(e) => setForm((f) => ({ ...f, departureLocation: e.target.value }))}
                className={inputClass}
                placeholder="Home city or airport"
              />
            </div>
            <div>
              <label className={labelClass}>Primary destination</label>
              <input
                type="text"
                value={form.primaryDestination}
                onChange={(e) => setForm((f) => ({ ...f, primaryDestination: e.target.value }))}
                className={inputClass}
                placeholder="Main place you visited"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Travel companions</label>
              <input
                type="text"
                value={form.travelCompanions}
                onChange={(e) => setForm((f) => ({ ...f, travelCompanions: e.target.value }))}
                className={inputClass}
                placeholder="Names of people who traveled with you"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Transportation methods</label>
              <select
                value=""
                onChange={(e) => {
                  const method = e.target.value as Transportation;
                  if (method) addTransportationMethod(setForm, method);
                }}
                className={selectClass}
                aria-label="Add transportation method"
              >
                <option value="">Select transportation...</option>
                {TRANSPORTATION_OPTIONS.map((method) => (
                  <option
                    key={method}
                    value={method}
                    disabled={form.transportationMethods.includes(method)}
                  >
                    {method}
                    {form.transportationMethods.includes(method) ? ' (selected)' : ''}
                  </option>
                ))}
              </select>
              {form.transportationMethods.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.transportationMethods.map((method) => (
                    <span
                      key={method}
                      className={`inline-flex items-center gap-1 ${tagChipClass}`}
                    >
                      {method}
                      <button
                        type="button"
                        onClick={() => removeTransportationMethod(setForm, method)}
                        aria-label={`Remove ${method}`}
                        title={`Remove ${method}`}
                        className={
                          isLight
                            ? 'rounded p-0.5 text-emerald-800 hover:bg-emerald-100'
                            : 'rounded p-0.5 text-emerald-300 hover:bg-emerald-500/30'
                        }
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <LodgingSection form={form} setForm={setForm} />
        <JournalSection form={form} setForm={setForm} />

        <div>
          <p className={isLight ? 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 mb-3' : 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-3'}>
            Budget
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Planned budget</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.plannedBudget}
                onChange={(e) =>
                  setForm((f) => ({ ...f, plannedBudget: formatCurrency(e.target.value) }))
                }
                onBlur={(e) => {
                  if (e.target.value) {
                    setForm((f) => ({
                      ...f,
                      plannedBudget: formatCurrencyDisplay(e.target.value),
                    }));
                  }
                }}
                onFocus={(e) => {
                  const numericValue = e.target.value.replace(/[^0-9.]/g, '');
                  setForm((f) => ({ ...f, plannedBudget: numericValue }));
                }}
                className={inputClass}
                placeholder="e.g. $2,500.00"
              />
            </div>
            <div>
              <label className={labelClass}>Total trip cost</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.totalTripCost}
                onChange={(e) =>
                  setForm((f) => ({ ...f, totalTripCost: formatCurrency(e.target.value) }))
                }
                onBlur={(e) => {
                  if (e.target.value) {
                    setForm((f) => ({
                      ...f,
                      totalTripCost: formatCurrencyDisplay(e.target.value),
                    }));
                  }
                }}
                onFocus={(e) => {
                  const numericValue = e.target.value.replace(/[^0-9.]/g, '');
                  setForm((f) => ({ ...f, totalTripCost: numericValue }));
                }}
                className={inputClass}
                placeholder="e.g. $6,000.00"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Budget notes</label>
              <textarea
                value={form.budgetNotes}
                onChange={(e) => setForm((f) => ({ ...f, budgetNotes: e.target.value }))}
                rows={2}
                className={textareaClass}
                placeholder="What was over or under budget?"
              />
            </div>
          </div>
        </div>

        <div>
          <p className={isLight ? 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 mb-3' : 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-3'}>
            Memories
          </p>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Best memory</label>
              <textarea
                value={form.bestMemory}
                onChange={(e) => setForm((f) => ({ ...f, bestMemory: e.target.value }))}
                rows={2}
                className={textareaClass}
              />
            </div>
            <div>
              <label className={labelClass}>Biggest surprise</label>
              <textarea
                value={form.biggestSurprise}
                onChange={(e) => setForm((f) => ({ ...f, biggestSurprise: e.target.value }))}
                rows={2}
                className={textareaClass}
              />
            </div>
            <div>
              <label className={labelClass}>Highlight of the trip</label>
              <textarea
                value={form.highlightOfTrip}
                onChange={(e) => setForm((f) => ({ ...f, highlightOfTrip: e.target.value }))}
                rows={2}
                className={textareaClass}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderYesNoMaybe('wouldReturn', form, setForm, 'Would you return?')}
          {renderYesNoMaybe('wouldRecommend', form, setForm, 'Would you recommend?')}
          {renderYesNo('includeInTravelCounts', form, setForm, 'Include this trip in your travel counts?')}
        </div>
      </div>
    );
  };

  const renderTripSummary = (trip: TripRecord) => {
    const days = calculateTripDays(trip.startDate, trip.endDate);
    const goalDisplay =
      trip.tripGoal === 'Other' && trip.tripGoalOther ? trip.tripGoalOther : trip.tripGoal;

    return (
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h4 className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-100'}>
            {trip.tripName}
          </h4>
          {trip.tripType && <span className={tagChipClass}>{trip.tripType}</span>}
          {goalDisplay && <span className={tagChipNeutralClass}>{goalDisplay}</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm mb-3">
          {(trip.destination || trip.primaryDestination) && (
            <div>
              <span className={metaLabelClass}>Destination: </span>
              <span className={metaValueClass}>
                {trip.destination || trip.primaryDestination}
              </span>
            </div>
          )}
          {trip.startDate && (
            <div>
              <span className={metaLabelClass}>Dates: </span>
              <span className={metaValueClass}>
                {formatDateDisplay(trip.startDate)}
                {trip.endDate ? ` – ${formatDateDisplay(trip.endDate)}` : ''}
                {days !== null ? ` (${days} day${days === 1 ? '' : 's'})` : ''}
              </span>
            </div>
          )}
          {trip.travelCompanions && (
            <div>
              <span className={metaLabelClass}>Companions: </span>
              <span className={metaValueClass}>{trip.travelCompanions}</span>
            </div>
          )}
          {trip.transportationMethods.length > 0 && (
            <div className="sm:col-span-2">
              <span className={metaLabelClass}>Transport: </span>
              <span className={metaValueClass}>{trip.transportationMethods.join(', ')}</span>
            </div>
          )}
        </div>
        {trip.tripRating > 0 && (
          <div className="mb-2">
            <StarRating value={trip.tripRating} label={`${trip.tripName} rating`} size="sm" />
          </div>
        )}
        {(trip.bestMemory || trip.biggestSurprise || trip.highlightOfTrip) && (
          <div className={`text-sm space-y-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            {trip.highlightOfTrip && (
              <p>
                <span className={metaLabelClass}>Highlight: </span>
                {trip.highlightOfTrip}
              </p>
            )}
          </div>
        )}
        <div className={`flex flex-wrap gap-3 text-xs mt-2 ${metaLabelClass}`}>
          {trip.lodging.length > 0 && (
            <span>
              {trip.lodging.length} lodging record{trip.lodging.length === 1 ? '' : 's'}
            </span>
          )}
          {trip.journalNotes.length > 0 && (
            <span>
              {trip.journalNotes.length} journal note{trip.journalNotes.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderTripRow = (trip: TripRecord) => {
    const isEditing = editingId === trip.id;

    return (
      <div key={trip.id} className={nestedCardClass}>
        {isEditing ? (
          <div className="space-y-4">
            <h4 className={subsectionTitleClass}>Edit trip</h4>
            {renderTripForm(editingTrip, setEditingTrip)}
            <div className="flex gap-2">
              <button type="button" onClick={saveEdit} className={primaryButtonClass}>
                Save
              </button>
              <button type="button" onClick={cancelEditing} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            {renderTripSummary(trip)}
            <div className="flex shrink-0 items-center gap-1.5 ml-4">
              <button
                type="button"
                onClick={() => startEditing(trip)}
                aria-label="Edit trip"
                title="Edit trip"
                className={rowIconEmeraldClass}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(trip.id)}
                aria-label="Delete trip"
                title="Delete trip"
                className={rowIconDangerClass}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const exportToPDF = () => {
    alert('PDF export will be available once the Travel Log database is connected.');
    setShowExportPopup(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className={titleClass}>Travel Log</h2>
        <p className={descClass}>
          Record trips and vacations — destinations, lodging, journal notes, and memories to look back on.
        </p>
        {isLoading && <div className={loadingClass}>Loading...</div>}
      </div>

      <div className={tabStripClass}>
        <div className="flex gap-2">
          {[
            { id: 'trips' as const, label: 'Trips' },
            { id: 'export' as const, label: 'Export' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id ? tabActiveClass : tabInactiveClass
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'trips' && (
        <div className="space-y-6">
          {!isAdding && !editingId && (
            <div className={cardClass}>
              <label className={labelClass}>Search trips</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, destination, companions, notes..."
                className={inputClass}
              />
            </div>
          )}

          {!isAdding && !editingId && (
            <div className="flex justify-start">
              <button type="button" onClick={() => setIsAdding(true)} className={primaryButtonClass}>
                + Add New Trip
              </button>
            </div>
          )}

          {isAdding && (
            <div className={cardClass}>
              <h3 className={`${sectionTitleClass} mb-4`}>Add New Trip</h3>
              {renderTripForm(newTrip, setNewTrip)}
              <div className="flex gap-2 mt-6">
                <button type="button" onClick={addTrip} className={primaryButtonClass}>
                  Add Trip
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setNewTrip(emptyTripForm());
                  }}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>Trip History</h3>
              <span className={counterTextClass}>
                {tripHistory.length} {tripHistory.length === 1 ? 'trip' : 'trips'}
              </span>
            </div>
            {tripHistory.length > 0 ? (
              <div className="space-y-4">
                {tripHistory.map((trip) => renderTripRow(trip))}
              </div>
            ) : (
              <p className={`${descClass} text-center py-8`}>No trips yet. Add one to get started!</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className={cardClass}>
            <h3 className={`${sectionTitleClass} mb-4`}>Export Travel Log Report</h3>
            <p className={`${descClass} mb-4`}>
              Generate a comprehensive PDF report of all your trips. The report will include trip details,
              lodging, journal notes, memories, and budget summaries.
            </p>
            <button type="button" onClick={() => setShowExportPopup(true)} className={primaryButtonClass}>
              Generate PDF Report
            </button>
          </div>
        </div>
      )}

      {showExportPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={modalCardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>Export Options</h3>
              <button
                type="button"
                onClick={() => setShowExportPopup(false)}
                aria-label="Close modal"
                title="Close modal"
                className={isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={exportToPDF} className={`flex-1 ${primaryButtonClass}`}>
                Export to PDF
              </button>
              <button type="button" onClick={() => setShowExportPopup(false)} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={modalCardClass}>
            <div className={`rounded-lg border px-4 py-3 mb-4 ${isLight ? 'border-red-300 bg-red-50' : 'border-red-500/50 bg-red-500/10'}`}>
              <p className={isLight ? 'text-red-700 font-semibold' : 'text-red-300 font-semibold'}>
                ⚠️ This action cannot be undone
              </p>
              <p className={`text-sm mt-1 ${isLight ? 'text-red-600' : 'text-red-200'}`}>
                The trip and all lodging and journal notes will be permanently deleted.
              </p>
            </div>
            <h3 className={`text-xl font-semibold mb-2 ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>
              Delete trip permanently?
            </h3>
            <p className={`text-sm mb-4 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Type <strong>delete</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className={
                isLight
                  ? 'w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4'
                  : 'w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4'
              }
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={deleteTrip}
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
              <button
                type="button"
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
