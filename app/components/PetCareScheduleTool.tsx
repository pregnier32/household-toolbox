'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from './AppThemeProvider';
import { useAppNotice } from './AppNotice';
import { AttachmentButton } from './AttachmentButton';
import { AttachmentModal } from './AttachmentModal';
import {
  canPreviewAttachment,
  createPendingAttachment,
  isImageAttachment,
  isPdfAttachment,
  type AttachmentItem,
} from '@/lib/attachments';

const API_BASE = '/api/tools/pet-care-schedule';

type AttachmentTarget =
  | { kind: 'pet'; id: 'add' | string }
  | { kind: 'document'; id: 'add' | string }
  | { kind: 'veterinary'; id: 'add' | string }
  | { kind: 'vaccination'; id: 'add' | string }
  | { kind: 'appointment'; id: 'add' | string };

type StoredAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

type PetType = {
  id: string;
  name: string;
  isCustom: boolean;
};

type FoodEntry = {
  id: string;
  name: string;
  rating: number | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  notes: string;
};

type CarePlanItem = {
  id: string;
  name: string;
  frequency: string;
  isActive: boolean;
  startDate: string;
  endDate: string | null;
  notes: string;
  priority: 'low' | 'medium' | 'high';
};

type Vaccination = {
  id: string;
  name: string;
  date: string;
  veterinarian: string;
  notes: string;
  attachments?: StoredAttachment[];
};

type Appointment = {
  id: string;
  date: string;
  time: string;
  type: string;
  veterinarian: string;
  notes: string;
  isUpcoming: boolean;
  attachments?: StoredAttachment[];
  addToDashboard?: boolean;
};

type AppointmentForm = {
  date: string;
  time: string;
  type: string;
  veterinarian: string;
  notes: string;
  addToDashboard: boolean;
};

const emptyAppointmentForm = (): AppointmentForm => ({
  date: '',
  time: '',
  type: '',
  veterinarian: '',
  notes: '',
  addToDashboard: false,
});

function mapAppointment(row: {
  id: string;
  date: string;
  time?: string | null;
  type: string;
  veterinarian?: string | null;
  notes?: string | null;
  isUpcoming?: boolean;
  is_upcoming?: boolean;
  attachments?: StoredAttachment[];
  addToDashboard?: boolean;
}): Appointment {
  return {
    id: row.id,
    date: row.date,
    time: row.time || '',
    type: row.type,
    veterinarian: row.veterinarian || '',
    notes: row.notes || '',
    isUpcoming: row.isUpcoming ?? row.is_upcoming ?? false,
    attachments: row.attachments || [],
    addToDashboard: row.addToDashboard === true,
  };
}

type Document = {
  id: string;
  name: string;
  date: string;
  description: string;
  attachments?: StoredAttachment[];
};

type Note = {
  id: string;
  content: string;
  date: string;
  isCurrent: boolean;
};

type VeterinaryRecord = {
  id: string;
  veterinarianName: string;
  clinicName: string;
  phone: string;
  email: string;
  address: string;
  status: 'Active' | 'History';
  dateAdded: string;
  notes: string;
  attachments?: StoredAttachment[];
};

const COMMON_PET_TYPES = [
  'Dog',
  'Cat',
  'Bird',
  'Fish',
  'Rabbit',
  'Hamster',
  'Guinea Pig',
  'Turtle',
  'Snake',
  'Lizard',
  'Ferret',
  'Horse',
  'Other'
];

const FREQUENCY_OPTIONS = [
  'Daily',
  'Every 2 Days',
  'Every 3 Days',
  'Weekly',
  'Every 2 Weeks',
  'Monthly',
  'Every 3 Months',
  'Every 6 Months',
  'Yearly',
  'As Needed'
];

// Date-only YYYY-MM-DD as local calendar day (not UTC midnight).
function parseLocalDate(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatLocalDate(isoDate: string): string {
  const d = parseLocalDate(isoDate);
  return d ? d.toLocaleDateString() : isoDate;
}

function localToday(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function DashboardCalendarSwitch({
  isOn,
  onToggle,
  isLight,
}: {
  isOn: boolean;
  onToggle: () => void;
  isLight: boolean;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer" title="Add to dashboard calendar">
      <span className={`text-xs whitespace-nowrap ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
        Add to dashboard calendar
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label="Add to dashboard calendar"
        title="Add to dashboard calendar"
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 ${
          isLight ? 'focus:ring-offset-white' : 'focus:ring-offset-slate-900'
        } ${isOn ? 'bg-emerald-500' : isLight ? 'bg-slate-300' : 'bg-slate-700'}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
            isOn ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}

function OnCalendarChip({ isLight }: { isLight: boolean }) {
  return (
    <span
      className={
        isLight
          ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800'
          : 'inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300'
      }
    >
      On calendar
    </span>
  );
}

type Pet = {
  id: string;
  name: string;
  pet_type: string | null;
  custom_pet_type: string | null;
  card_color: string | null;
  attachments?: StoredAttachment[];
};

type PetCareScheduleToolProps = {
  toolId?: string;
};

export function PetCareScheduleTool({ toolId }: PetCareScheduleToolProps) {
  const { resolvedTheme } = useTheme();
  const { showError } = useAppNotice();
  const isLight = resolvedTheme === 'light';
  const titleClass = isLight ? 'text-2xl font-semibold text-slate-900 mb-2' : 'text-2xl font-semibold text-slate-50 mb-2';
  const descClass = isLight ? 'text-slate-600 text-sm' : 'text-slate-400 text-sm';
  const cardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-6';
  const cardCompactClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-4';
  const labelClass = isLight ? 'block text-sm font-medium text-slate-700 mb-2' : 'block text-sm font-medium text-slate-300 mb-2';
  const inputClass = isLight
    ? 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const selectClass = isLight
    ? 'w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const primaryButtonClass = isLight
    ? 'px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
    : 'px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const secondaryButtonClass = isLight
    ? 'px-4 py-2 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
    : 'px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const tabStripClass = isLight ? 'border-b-2 border-slate-300' : 'border-b border-slate-800';
  const tabActiveClass = isLight
    ? 'border-b-2 border-emerald-600 text-emerald-900'
    : 'border-b-2 border-emerald-500 text-emerald-300';
  const tabInactiveClass = isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-300';
  const popupMenuClass = isLight
    ? 'absolute top-10 right-0 z-50 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5 min-w-[160px] py-1'
    : 'absolute top-10 right-0 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-lg min-w-[160px] py-1';
  const popupMenuItemClass = isLight
    ? 'w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2'
    : 'w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2';
  const popupMenuDangerItemClass = isLight
    ? 'w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 flex items-center gap-2'
    : 'w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 transition-colors flex items-center gap-2';
  const modalCardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-xl'
    : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4';
  const nestedCardClass = isLight
    ? 'p-4 rounded-lg border border-slate-200 bg-slate-50'
    : 'p-4 rounded-lg border border-slate-700 bg-slate-800/50';
  const sectionTitleClass = isLight ? 'text-lg font-semibold text-slate-900 mb-4' : 'text-lg font-semibold text-slate-50 mb-4';
  const rowIconEmeraldClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-700 bg-white p-2 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 p-2 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20';
  const rowIconSecondaryClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-slate-400 bg-slate-100 p-2 text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-slate-600 bg-slate-800 p-2 text-slate-200 transition-colors hover:bg-slate-700';
  const rowIconDangerClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-red-300 bg-white p-2 text-red-700 transition-colors hover:bg-red-50 hover:border-red-400'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-800/50 p-2 text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20';
  // Pet management
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [isCreatingNewPet, setIsCreatingNewPet] = useState(false);
  const [newPetName, setNewPetName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Pet editing
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const [editingPetName, setEditingPetName] = useState('');
  const [editingPetColor, setEditingPetColor] = useState('#10b981'); // Default emerald
  
  // Pet menu (ellipsis popup)
  const [menuOpenPetId, setMenuOpenPetId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // Delete confirmation
  const [deleteConfirmPetId, setDeleteConfirmPetId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteEntryConfirm, setDeleteEntryConfirm] = useState<{ label: string; onConfirm: () => void } | null>(null);
  const [deleteEntryConfirmText, setDeleteEntryConfirmText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastSavedData, setLastSavedData] = useState<string>('');
  const [pendingPetAttachments, setPendingPetAttachments] = useState<AttachmentItem[]>([]);
  const [pendingDocumentAttachments, setPendingDocumentAttachments] = useState<AttachmentItem[]>([]);
  const [pendingVeterinaryAttachments, setPendingVeterinaryAttachments] = useState<AttachmentItem[]>([]);
  const [pendingVaccinationAttachments, setPendingVaccinationAttachments] = useState<AttachmentItem[]>([]);
  const [pendingAppointmentAttachments, setPendingAppointmentAttachments] = useState<AttachmentItem[]>([]);
  const [attachmentModal, setAttachmentModal] = useState<AttachmentTarget | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [viewPreview, setViewPreview] = useState<AttachmentItem | null>(null);
  
  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState<PetType | null>(null);
  const [customPetType, setCustomPetType] = useState('');
  const [showCustomPetType, setShowCustomPetType] = useState(false);
  
  // Pet Info
  const [birthdate, setBirthdate] = useState('');
  const [breed, setBreed] = useState('');
  const [whereGotPet, setWhereGotPet] = useState('');
  const [weight, setWeight] = useState('');
  const [color, setColor] = useState('');
  const [microchipNumber, setMicrochipNumber] = useState('');
  
  // Food
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [currentFood, setCurrentFood] = useState({ name: '', rating: null as number | null, notes: '' });
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [editingFood, setEditingFood] = useState({ startDate: '', endDate: '', rating: null as number | null, notes: '' });
  
  // Veterinary Contact
  const [veterinaryRecords, setVeterinaryRecords] = useState<VeterinaryRecord[]>([]);
  const [newVetRecord, setNewVetRecord] = useState({
    veterinarianName: '',
    clinicName: '',
    phone: '',
    email: '',
    address: '',
    status: 'Active' as 'Active' | 'History',
    notes: ''
  });
  const [editingVetRecordId, setEditingVetRecordId] = useState<string | null>(null);
  const [editingVetRecord, setEditingVetRecord] = useState({
    veterinarianName: '',
    clinicName: '',
    phone: '',
    email: '',
    address: '',
    status: 'Active' as 'Active' | 'History',
    notes: ''
  });
  
  // Care Plan
  const [carePlanItems, setCarePlanItems] = useState<CarePlanItem[]>([]);
  const [newCareItem, setNewCareItem] = useState({ name: '', frequency: 'Daily', notes: '', priority: 'medium' as 'low' | 'medium' | 'high' });
  const [editingCareItemId, setEditingCareItemId] = useState<string | null>(null);
  const [editingCareItem, setEditingCareItem] = useState({ name: '', frequency: 'Daily', notes: '', priority: 'medium' as 'low' | 'medium' | 'high' });
  
  // Vaccinations
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [newVaccination, setNewVaccination] = useState({ name: '', date: '', veterinarian: '', notes: '' });
  const [editingVaccinationId, setEditingVaccinationId] = useState<string | null>(null);
  const [editingVaccination, setEditingVaccination] = useState({ name: '', date: '', veterinarian: '', notes: '' });
  
  // Appointments
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [newAppointment, setNewAppointment] = useState<AppointmentForm>(emptyAppointmentForm);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentForm>(emptyAppointmentForm);
  
  // Documents
  const [documents, setDocuments] = useState<Document[]>([]);
  const [newDocument, setNewDocument] = useState({ name: '', date: '', description: '' });
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState({ name: '', date: '', description: '' });
  
  // Notes
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState({ content: '' });
  const [activeSection, setActiveSection] = useState<string>('info');
  const [addingSection, setAddingSection] = useState<string | null>(null);
  const [appointmentSearch, setAppointmentSearch] = useState('');
  const [documentSearch, setDocumentSearch] = useState('');
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(false);

  // Load pets on mount
  useEffect(() => {
    if (toolId) {
      loadPets();
    } else {
      setIsLoading(false);
      setSaveMessage({ type: 'error', text: 'Tool ID is missing. Please refresh the page.' });
    }
  }, [toolId]);

  // Helper function to create a normalized snapshot for comparison
  // This must be defined after all state variables
  const createDataSnapshot = useCallback(() => {
    // Normalize petType for comparison
    const normalizedPetType = petType ? (petType.isCustom ? customPetType : petType.name) : null;
    
    return JSON.stringify({
      petName: petName.trim(),
      petType: normalizedPetType,
      customPetType: petType?.isCustom ? customPetType.trim() : null,
      birthdate,
      breed: breed.trim(),
      whereGotPet: whereGotPet.trim(),
      weight: weight.trim(),
      color: color.trim(),
      microchipNumber: microchipNumber.trim(),
      foods: foods.map(f => ({
        name: f.name.trim(),
        rating: f.rating,
        startDate: f.startDate,
        endDate: f.endDate,
        isCurrent: f.isCurrent,
        notes: f.notes || '',
      })).sort((a, b) => a.name.localeCompare(b.name)),
      veterinaryRecords: veterinaryRecords.map(v => ({
        veterinarianName: (v.veterinarianName || '').trim(),
        clinicName: (v.clinicName || '').trim(),
        phone: (v.phone || '').trim(),
        email: (v.email || '').trim(),
        address: (v.address || '').trim(),
        status: v.status,
        dateAdded: v.dateAdded,
        notes: v.notes || '',
      })).sort((a, b) => (a.clinicName || a.veterinarianName || '').localeCompare(b.clinicName || b.veterinarianName || '')),
      carePlanItems: carePlanItems.map(c => ({
        name: c.name.trim(),
        frequency: c.frequency,
        isActive: c.isActive,
        startDate: c.startDate,
        endDate: c.endDate,
        notes: c.notes || '',
      })).sort((a, b) => a.name.localeCompare(b.name)),
      vaccinations: vaccinations.map(v => ({
        name: v.name.trim(),
        date: v.date,
        veterinarian: (v.veterinarian || '').trim(),
        notes: (v.notes || '').trim(),
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      appointments: appointments.map(a => ({
        date: a.date,
        time: a.time || '',
        type: a.type.trim(),
        veterinarian: (a.veterinarian || '').trim(),
        notes: (a.notes || '').trim(),
        isUpcoming: a.isUpcoming,
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      documents: documents.map(d => {
        const doc: any = {
          name: d.name.trim(),
          date: d.date,
          description: (d.description || '').trim(),
          attachments: (d.attachments || []).map((item) => item.id),
        };
        return doc;
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      notes: notes.map(n => ({
        content: n.content.trim(),
        date: n.date,
        isCurrent: n.isCurrent,
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    });
  }, [petName, petType, customPetType, birthdate, breed, whereGotPet, weight, color, microchipNumber, foods, veterinaryRecords, carePlanItems, vaccinations, appointments, documents, notes]);


  const loadPets = async () => {
    if (!toolId) {
      setSaveMessage({ type: 'error', text: 'Tool ID is missing. Please refresh the page.' });
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tools/pet-care-schedule?toolId=${toolId}`);
      const data = await response.json();
      
      if (!response.ok) {
        // Even if there's an error, try to set empty pets array if provided
        if (data.pets) {
          setPets(data.pets);
        }
        throw new Error(data.error || 'Failed to load pets');
      }
      
      setPets(data.pets || []);
      setSaveMessage(null); // Clear any previous errors
    } catch (error) {
      console.error('Error loading pets:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load pets';
      setSaveMessage({ type: 'error', text: errorMessage });
      // Set empty array so UI can still function
      setPets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPetData = async (petId: string) => {
    if (!toolId) return;
    
    try {
      const response = await fetch(`/api/tools/pet-care-schedule?toolId=${toolId}&petId=${petId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load pet data');
      }
      
      const pet = data.pet;
      if (pet) {
        // Load pet's basic info
        setPetName(pet.name);
        setPetType(pet.pet_type ? { id: pet.pet_type.toLowerCase(), name: pet.pet_type, isCustom: false } : null);
        setCustomPetType(pet.custom_pet_type || '');
        setShowCustomPetType(!!pet.custom_pet_type);
        setBirthdate(pet.birthdate || '');
        setBreed(pet.breed || '');
        setWhereGotPet(pet.where_got_pet || '');
        setWeight(pet.weight || '');
        setColor(pet.color || '');
        setMicrochipNumber(pet.microchip_number || '');
        
        // Load related data
        setFoods((pet.foods || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          rating: f.rating,
          startDate: f.start_date,
          endDate: f.end_date,
          isCurrent: f.is_current,
          notes: f.notes || '',
        })));
        
        setVeterinaryRecords((pet.veterinaryRecords || []).map((v: any) => ({
          id: v.id,
          veterinarianName: v.veterinarian_name || '',
          clinicName: v.clinic_name || '',
          phone: v.phone || '',
          email: v.email || '',
          address: v.address || '',
          status: v.status,
          dateAdded: v.date_added,
          notes: v.notes || '',
          attachments: v.attachments || [],
        })));
        
        setCarePlanItems((pet.carePlanItems || []).map((c: any) => {
          const mappedItem = {
            id: c.id,
            name: c.name,
            frequency: c.frequency,
            isActive: c.is_active,
            startDate: c.start_date,
            endDate: c.end_date,
            notes: (c.notes && c.notes.trim()) ? c.notes.trim() : '',
            priority: (c.priority && ['low', 'medium', 'high'].includes(c.priority)) ? c.priority : 'medium' as 'low' | 'medium' | 'high',
          };
          console.log(`Loading care plan item: ${mappedItem.name}, notes: "${mappedItem.notes}"`);
          return mappedItem;
        }));
        
        setVaccinations((pet.vaccinations || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          date: v.date,
          veterinarian: v.veterinarian || '',
          notes: v.notes || '',
          attachments: v.attachments || [],
        })));
        
        setAppointments((pet.appointments || []).map((a: any) => mapAppointment(a)));
        
        setDocuments((pet.documents || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          date: d.date,
          description: d.description || '',
          attachments: d.attachments || [],
        })));
        
        setNotes((pet.notes || []).map((n: any) => ({
          id: n.id,
          content: n.content,
          date: n.date,
          isCurrent: n.is_current,
        })));
        
        // Set last saved data snapshot after loading - wait for state to update first
        // Use setTimeout to ensure all state updates have completed
        setTimeout(() => {
          const loadedDataSnapshot = createDataSnapshot();
          setLastSavedData(loadedDataSnapshot);
        }, 300);
      }
    } catch (error) {
      console.error('Error loading pet data:', error);
      setSaveMessage({ type: 'error', text: 'Failed to load pet data' });
    }
  };

  const savePetData = async (
    carePlanItemsToSave?: typeof carePlanItems,
    foodsToSave?: typeof foods,
    veterinaryRecordsToSave?: typeof veterinaryRecords,
    vaccinationsToSave?: typeof vaccinations,
    appointmentsToSave?: typeof appointments,
    documentsToSave?: typeof documents,
    notesToSave?: typeof notes
  ) => {
    if (!selectedPetId || !toolId) {
      setSaveMessage({ type: 'error', text: 'Please select a pet first' });
      return;
    }

    // Prevent multiple simultaneous saves using ref (synchronous check)
    if (isSavingRef.current) {
      console.log('Save already in progress, skipping...');
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveMessage(null);

    // Use provided items or fall back to state
    const itemsToUse = carePlanItemsToSave || carePlanItems;
    const foodsToUse = foodsToSave || foods;
    const vetRecordsToUse = veterinaryRecordsToSave || veterinaryRecords;
    const vaccinationsToUse = vaccinationsToSave || vaccinations;
    const appointmentsToUse = appointmentsToSave || appointments;
    const documentsToUse = documentsToSave || documents;
    const notesToUse = notesToSave || notes;
    
    console.log(`[savePetData] Starting save for pet ${selectedPetId}, care plan items count: ${itemsToUse.length}`);
    console.log(`[savePetData] Care plan items:`, itemsToUse.map(c => ({ name: c.name, notes: c.notes })));

    try {
      const petData = {
        name: petName,
        pet_type: petType?.isCustom ? null : petType?.name || null,
        custom_pet_type: petType?.isCustom ? customPetType : null,
        birthdate: birthdate || null,
        breed: breed || null,
        where_got_pet: whereGotPet || null,
        weight: weight || null,
        color: color || null,
        microchip_number: microchipNumber || null,
        card_color: null, // Keep existing card_color when saving pet data
      };

      const response = await fetch('/api/tools/pet-care-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          petId: selectedPetId,
          toolId: toolId,
          petData,
          foods: foodsToUse.map(f => ({
            name: f.name,
            rating: f.rating,
            startDate: f.startDate,
            endDate: f.endDate,
            isCurrent: f.isCurrent,
            notes: f.notes || '',
          })),
          veterinaryRecords: vetRecordsToUse.map(v => ({
            id: v.id,
            veterinarianName: v.veterinarianName,
            clinicName: v.clinicName,
            phone: v.phone,
            email: v.email,
            address: v.address,
            status: v.status,
            dateAdded: v.dateAdded,
            notes: v.notes || '',
          })),
          carePlanItems: itemsToUse.map(c => {
            const notesValue = (c.notes && typeof c.notes === 'string' && c.notes.trim()) ? c.notes.trim() : '';
            console.log(`Saving care plan item: ${c.name}, notes: "${notesValue}", priority: "${c.priority || 'medium'}"`);
            return {
              name: c.name,
              frequency: c.frequency,
              isActive: c.isActive,
              startDate: c.startDate,
              endDate: c.endDate,
              notes: notesValue,
              priority: (c.priority && ['low', 'medium', 'high'].includes(c.priority)) ? c.priority : 'medium',
            };
          }),
          vaccinations: vaccinationsToUse.map(v => ({
            id: v.id,
            name: v.name,
            date: v.date,
            veterinarian: v.veterinarian,
            notes: v.notes || '',
          })),
          appointments: appointmentsToUse.map(a => ({
            id: a.id,
            date: a.date,
            time: a.time,
            type: a.type,
            veterinarian: a.veterinarian,
            notes: a.notes || '',
            isUpcoming: a.isUpcoming,
            addToDashboard: a.addToDashboard === true,
          })),
          documents: documentsToUse.map(d => ({
            id: d.id,
            name: d.name,
            date: d.date,
            description: d.description,
          })),
          notes: notesToUse.map(n => ({
            content: n.content,
            date: n.date,
            isCurrent: n.isCurrent,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save pet data');
      }

      // Update last saved data snapshot immediately after successful save
      // Use the same function to ensure exact match - do this BEFORE reloading
      const savedDataSnapshot = createDataSnapshot();
      setLastSavedData(savedDataSnapshot);

      setSaveMessage({ type: 'success', text: 'Pet data saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
      
      // Reload pets to get updated data (this will also update the snapshot after load)
      await loadPets();
      if (selectedPetId) await loadPetData(selectedPetId);
      
      // After reload, update snapshot again to ensure it matches loaded data
      setTimeout(() => {
        const updatedSnapshot = createDataSnapshot();
        setLastSavedData(updatedSnapshot);
      }, 100);
    } catch (error) {
      console.error('Error saving pet data:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save pet data' });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const revokePending = (items: AttachmentItem[]) => {
    items.forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
  };

  const closeAttachmentModal = () => {
    setAttachmentModal(null);
    setViewPreview(null);
  };

  const ownerFieldForKind = (kind: AttachmentTarget['kind']) => {
    if (kind === 'pet') return 'petId';
    if (kind === 'document') return 'documentId';
    if (kind === 'veterinary') return 'veterinaryId';
    if (kind === 'vaccination') return 'vaccinationId';
    return 'appointmentId';
  };

  const uploadOwnerFile = async (kind: AttachmentTarget['kind'], ownerId: string, file: File) => {
    if (!toolId) throw new Error('Tool ID is required');
    const formData = new FormData();
    formData.append('toolId', toolId);
    formData.append(ownerFieldForKind(kind), ownerId);
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/attachments`, { method: 'POST', body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to add file');
  };

  const persistPendingFiles = async (kind: AttachmentTarget['kind'], ownerId: string, items: AttachmentItem[]) => {
    const files = items.map((item) => item.file).filter((file): file is File => Boolean(file));
    for (const file of files) {
      await uploadOwnerFile(kind, ownerId, file);
    }
    revokePending(items);
  };

  const fetchAttachmentBlob = async (attachmentId: string, inline = false) => {
    const query = inline ? '?inline=1' : '';
    const response = await fetch(`${API_BASE}/attachments/${attachmentId}${query}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to open file' }));
      throw new Error(errorData.error || 'Failed to open file');
    }
    return response.blob();
  };

  const handleViewAttachment = async (item: AttachmentItem) => {
    if (item.file && item.url) {
      if (isImageAttachment(item.type)) {
        setViewPreview(item);
        return;
      }
      if (isPdfAttachment(item.type, item.name)) {
        window.open(item.url, '_blank', 'noopener,noreferrer');
        return;
      }
      showError('This file type can’t be previewed in the browser. Use Download to save it.');
      return;
    }
    try {
      const blob = await fetchAttachmentBlob(item.id, true);
      const type = blob.type || item.type || '';
      if (!canPreviewAttachment(type, item.name)) {
        showError('This file type can’t be previewed in the browser. Use Download to save it.');
        return;
      }
      const url = window.URL.createObjectURL(blob);
      if (isImageAttachment(type)) {
        setViewPreview({ ...item, type, url, size: item.size || blob.size });
        return;
      }
      if (isPdfAttachment(type, item.name)) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to open file');
    }
  };

  const handleDownloadAttachment = async (item: AttachmentItem): Promise<boolean> => {
    if (item.file) return false;
    try {
      const blob = await fetchAttachmentBlob(item.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.name || 'attachment';
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to download file');
      return false;
    }
  };

  const addSavedFiles = async (kind: AttachmentTarget['kind'], ownerId: string, files: File[]) => {
    setAttachmentBusy(true);
    try {
      for (const file of files) {
        await uploadOwnerFile(kind, ownerId, file);
      }
      if (kind === 'pet') {
        await loadPets();
        if (selectedPetId === ownerId) await loadPetData(ownerId);
      } else if (selectedPetId) {
        await loadPetData(selectedPetId);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to add file');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const removeSavedFile = async (attachmentId: string) => {
    if (!toolId) return;
    setAttachmentBusy(true);
    try {
      const response = await fetch(`${API_BASE}/attachments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, attachmentId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to remove file');
      await loadPets();
      if (selectedPetId) await loadPetData(selectedPetId);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to remove file');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const pendingForKind = (kind: AttachmentTarget['kind']) => {
    if (kind === 'pet') return pendingPetAttachments;
    if (kind === 'document') return pendingDocumentAttachments;
    if (kind === 'veterinary') return pendingVeterinaryAttachments;
    if (kind === 'vaccination') return pendingVaccinationAttachments;
    return pendingAppointmentAttachments;
  };

  const setPendingForKind = (kind: AttachmentTarget['kind'], items: AttachmentItem[]) => {
    if (kind === 'pet') setPendingPetAttachments(items);
    else if (kind === 'document') setPendingDocumentAttachments(items);
    else if (kind === 'veterinary') setPendingVeterinaryAttachments(items);
    else if (kind === 'vaccination') setPendingVaccinationAttachments(items);
    else setPendingAppointmentAttachments(items);
  };

  // Pet management functions
  const createNewPet = async () => {
    if (!newPetName.trim() || !toolId) return;


    setIsSaving(true);
    try {
      const response = await fetch('/api/tools/pet-care-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolId: toolId,
          petData: {
            name: newPetName.trim(),
            pet_type: null,
            custom_pet_type: null,
            card_color: '#10b981', // Default emerald color for new pets
          },
          foods: [],
          veterinaryRecords: [],
          carePlanItems: [],
          vaccinations: [],
          appointments: [],
          documents: [],
          notes: [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create pet');
      }

      // Reload pets and select the new one
      await loadPets();
      if (data.petId) {
        if (pendingPetAttachments.length > 0) {
          await persistPendingFiles('pet', data.petId, pendingPetAttachments);
          setPendingPetAttachments([]);
        }
        setSelectedPetId(data.petId);
        await loadPetData(data.petId);
      }
      
      setIsCreatingNewPet(false);
      setNewPetName('');
      setSaveMessage({ type: 'success', text: 'Pet created successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
      
      // Reset saved data tracking for new pet
      setLastSavedData('');
    } catch (error) {
      console.error('Error creating pet:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create pet' });
    } finally {
      setIsSaving(false);
    }
  };

  const selectPet = async (petId: string) => {
    setSelectedPetId(petId);
    setEditingPetId(null); // Close any open edit mode
    // Load pet data from API
    await loadPetData(petId);
  };

  const startEditingPet = (pet: Pet) => {
    setEditingPetId(pet.id);
    setEditingPetName(pet.name);
    setEditingPetColor(pet.card_color || '#10b981');
  };

  const cancelEditingPet = () => {
    setEditingPetId(null);
    setEditingPetName('');
    setEditingPetColor('#10b981');
    setMenuOpenPetId(null);
    setShowColorPicker(false);
  };

  const handleChangeColor = (pet: Pet) => {
    setEditingPetId(pet.id);
    setEditingPetName(pet.name);
    setEditingPetColor(pet.card_color || '#10b981');
    setMenuOpenPetId(null);
    setShowColorPicker(true);
  };

  const handleSaveColorOnly = async () => {
    if (!editingPetId || !toolId) return;

    setIsSaving(true);
    try {
      // First, fetch current pet data to preserve it
      const fetchResponse = await fetch(`/api/tools/pet-care-schedule?petId=${editingPetId}&toolId=${toolId}`);
      const fetchData = await fetchResponse.json();
      
      if (!fetchResponse.ok || !fetchData.pet) {
        throw new Error('Failed to fetch current pet data');
      }

      const currentPet = fetchData.pet;

      // Update only the card color, preserving all other data
      const response = await fetch('/api/tools/pet-care-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          petId: editingPetId,
          toolId: toolId,
          petData: {
            name: currentPet.name,
            pet_type: currentPet.pet_type,
            custom_pet_type: currentPet.custom_pet_type,
            birthdate: currentPet.birthdate,
            breed: currentPet.breed,
            where_got_pet: currentPet.where_got_pet,
            weight: currentPet.weight,
            color: currentPet.color,
            microchip_number: currentPet.microchip_number,
            card_color: editingPetColor,
          },
          foods: (currentPet.foods || []).map((f: any) => ({
            name: f.name,
            rating: f.rating,
            startDate: f.start_date,
            endDate: f.end_date,
            isCurrent: f.is_current,
            notes: f.notes || '',
          })),
          veterinaryRecords: (currentPet.veterinaryRecords || []).map((v: any) => ({
            id: v.id,
            veterinarianName: v.veterinarian_name || '',
            clinicName: v.clinic_name || '',
            phone: v.phone || '',
            email: v.email || '',
            address: v.address || '',
            status: v.status,
            dateAdded: v.date_added,
            notes: v.notes || '',
          })),
          carePlanItems: (currentPet.carePlanItems || []).map((c: any) => ({
            name: c.name,
            frequency: c.frequency,
            isActive: c.is_active,
            startDate: c.start_date,
            endDate: c.end_date,
            notes: c.notes || '',
          })),
          vaccinations: (currentPet.vaccinations || []).map((v: any) => ({
            id: v.id,
            name: v.name,
            date: v.date,
            veterinarian: v.veterinarian || '',
            notes: v.notes || '',
          })),
          appointments: (currentPet.appointments || []).map((a: any) => mapAppointment(a)),
          documents: (currentPet.documents || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            date: d.date,
            description: d.description || '',
          })),
          notes: (currentPet.notes || []).map((n: any) => ({
            content: n.content,
            date: n.date,
            isCurrent: n.is_current,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update pet color');
      }

      // Reload pets to get updated data
      await loadPets();
      
      // If this was the selected pet, reload its data too
      if (selectedPetId === editingPetId) {
        await loadPetData(editingPetId);
      }
      
      setEditingPetId(null);
      setShowColorPicker(false);
      setSaveMessage({ type: 'success', text: 'Card color updated successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error updating pet color:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update pet color' });
    } finally {
      setIsSaving(false);
    }
  };

  const savePetEdit = async () => {
    if (!editingPetId || !toolId) return;
    
    if (!editingPetName.trim()) {
      setSaveMessage({ type: 'error', text: 'Pet name cannot be empty' });
      return;
    }

    setIsSaving(true);
    try {
      // First, fetch current pet data to preserve it
      const fetchResponse = await fetch(`/api/tools/pet-care-schedule?petId=${editingPetId}&toolId=${toolId}`);
      const fetchData = await fetchResponse.json();
      
      if (!fetchResponse.ok || !fetchData.pet) {
        throw new Error('Failed to fetch current pet data');
      }

      const currentPet = fetchData.pet;

      // Update pet name and color via API, preserving all other data
      const response = await fetch('/api/tools/pet-care-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          petId: editingPetId,
          toolId: toolId,
          petData: {
            name: editingPetName.trim(),
            pet_type: currentPet.pet_type,
            custom_pet_type: currentPet.custom_pet_type,
            birthdate: currentPet.birthdate,
            breed: currentPet.breed,
            where_got_pet: currentPet.where_got_pet,
            weight: currentPet.weight,
            color: currentPet.color,
            microchip_number: currentPet.microchip_number,
            card_color: editingPetColor,
          },
          foods: (currentPet.foods || []).map((f: any) => ({
            name: f.name,
            rating: f.rating,
            startDate: f.start_date,
            endDate: f.end_date,
            isCurrent: f.is_current,
            notes: f.notes || '',
          })),
          veterinaryRecords: (currentPet.veterinaryRecords || []).map((v: any) => ({
            id: v.id,
            veterinarianName: v.veterinarian_name || '',
            clinicName: v.clinic_name || '',
            phone: v.phone || '',
            email: v.email || '',
            address: v.address || '',
            status: v.status,
            dateAdded: v.date_added,
            notes: v.notes || '',
          })),
          carePlanItems: (currentPet.carePlanItems || []).map((c: any) => ({
            name: c.name,
            frequency: c.frequency,
            isActive: c.is_active,
            startDate: c.start_date,
            endDate: c.end_date,
            notes: c.notes || '',
          })),
          vaccinations: (currentPet.vaccinations || []).map((v: any) => ({
            id: v.id,
            name: v.name,
            date: v.date,
            veterinarian: v.veterinarian || '',
            notes: v.notes || '',
          })),
          appointments: (currentPet.appointments || []).map((a: any) => mapAppointment(a)),
          documents: (currentPet.documents || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            date: d.date,
            description: d.description || '',
          })),
          notes: (currentPet.notes || []).map((n: any) => ({
            content: n.content,
            date: n.date,
            isCurrent: n.is_current,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update pet');
      }

      // Reload pets to get updated data
      await loadPets();
      
      // If this was the selected pet, reload its data too
      if (selectedPetId === editingPetId) {
        await loadPetData(editingPetId);
      }
      
      setEditingPetId(null);
      setSaveMessage({ type: 'success', text: 'Pet updated successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error updating pet:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update pet' });
    } finally {
      setIsSaving(false);
    }
  };

  const deletePet = async () => {
    if (!deleteConfirmPetId || !toolId) return;

    if (deleteConfirmText.toLowerCase() !== 'delete') {
      setSaveMessage({ type: 'error', text: 'Please type "delete" to confirm' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/tools/pet-care-schedule?petId=${deleteConfirmPetId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete pet');
      }

      // If the deleted pet was selected, clear selection
      if (selectedPetId === deleteConfirmPetId) {
        setSelectedPetId(null);
        resetFormData();
      }

      // Reload pets
      await loadPets();
      setDeleteConfirmPetId(null);
      setDeleteConfirmText('');
      setSaveMessage({ type: 'success', text: 'Pet deleted successfully' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting pet:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete pet' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetFormData = () => {
    setPetName('');
    setPetType(null);
    setCustomPetType('');
    setShowCustomPetType(false);
    setBirthdate('');
    setBreed('');
    setWhereGotPet('');
    setWeight('');
    setColor('');
    setMicrochipNumber('');
    setFoods([]);
    setCurrentFood({ name: '', rating: null, notes: '' });
    setVeterinaryRecords([]);
    setCarePlanItems([]);
    setVaccinations([]);
    setAppointments([]);
    setDocuments([]);
    setNotes([]);
    setCurrentNote('');
    setAddingSection(null);
    setAppointmentSearch('');
    setDocumentSearch('');
  };

  const handlePetTypeChange = (value: string) => {
    if (value === 'Other') {
      setShowCustomPetType(true);
      setPetType({ id: 'custom', name: '', isCustom: true });
    } else {
      setShowCustomPetType(false);
      setPetType({ id: value.toLowerCase(), name: value, isCustom: false });
      setCustomPetType('');
    }
  };

  const handleCustomPetTypeBlur = () => {
    if (customPetType.trim()) {
      setPetType({ id: 'custom', name: customPetType.trim(), isCustom: true });
    }
  };

  const addCurrentFood = async () => {
    if (currentFood.name.trim()) {
      const newFood: FoodEntry = {
        id: Date.now().toString(),
        name: currentFood.name,
        rating: currentFood.rating,
        startDate: localToday(),
        endDate: null,
        isCurrent: true,
        notes: currentFood.notes || ''
      };
      // Mark all other foods as not current
      setFoods(prev => prev.map(f => ({ ...f, isCurrent: false })));
      setFoods(prev => [...prev, newFood]);
      setCurrentFood({ name: '', rating: null, notes: '' });
      setAddingSection(null);
      // Save to database immediately
      setTimeout(() => savePetData(), 100);
    }
  };

  const moveFoodToHistory = (foodId: string) => {
    setFoods(prev => prev.map(f => 
      f.id === foodId 
        ? { ...f, isCurrent: false, endDate: localToday() }
        : f
    ));
    // Save to database immediately
    setTimeout(() => savePetData(), 100);
  };

  const returnFoodToActive = (foodId: string) => {
    setFoods(prev => prev.map(f =>
      f.id === foodId
        ? { ...f, isCurrent: true, endDate: '' }
        : f
    ));
    // Save to database immediately
    setTimeout(() => savePetData(), 100);
  };

  const startEditingFood = (food: FoodEntry) => {
    setEditingFoodId(food.id);
    setEditingFood({ 
      startDate: food.startDate, 
      endDate: food.endDate || '', 
      rating: food.rating,
      notes: food.notes || ''
    });
  };

  const cancelEditingFood = () => {
    setEditingFoodId(null);
    setEditingFood({ startDate: '', endDate: '', rating: null, notes: '' });
  };

  const saveFoodEdit = async () => {
    if (!editingFoodId) return;
    
    // Calculate updated items first (outside of setState)
    const updatedFoods = foods.map(f => 
      f.id === editingFoodId 
        ? { 
            ...f, 
            startDate: editingFood.startDate,
            endDate: editingFood.endDate || null,
            rating: editingFood.rating,
            notes: editingFood.notes || ''
          }
        : f
    );
    
    // Update state
    setFoods(updatedFoods);
    
    setEditingFoodId(null);
    setEditingFood({ startDate: '', endDate: '', rating: null, notes: '' });
    
    // Save to database immediately using the updated items
    setTimeout(() => {
      console.log(`Saving with updated foods, food notes: ${updatedFoods.find(f => f.id === editingFoodId)?.notes}`);
      savePetData(undefined, updatedFoods);
    }, 100);
  };

  const addCarePlanItem = async () => {
    if (newCareItem.name.trim()) {
      const newItem: CarePlanItem = {
        id: Date.now().toString(),
        name: newCareItem.name,
        frequency: newCareItem.frequency,
        isActive: true,
        startDate: localToday(),
        endDate: null,
        notes: newCareItem.notes || '',
        priority: newCareItem.priority || 'medium'
      };
      const updatedItems = [...carePlanItems, newItem];
      setCarePlanItems(updatedItems);
      setNewCareItem({ name: '', frequency: 'Daily', notes: '', priority: 'medium' });
      setAddingSection(null);
      setTimeout(() => savePetData(updatedItems), 100);
    }
  };

  const toggleCarePlanItem = (itemId: string) => {
    const updatedItems = carePlanItems.map(item =>
      item.id === itemId
        ? {
            ...item,
            isActive: !item.isActive,
            endDate: item.isActive ? localToday() : null
          }
        : item
    );
    setCarePlanItems(updatedItems);
    setTimeout(() => savePetData(updatedItems), 100);
  };

  const startEditingCareItem = (item: CarePlanItem) => {
    console.log(`Starting to edit care plan item: ${item.name}, current notes: "${item.notes}"`);
    setEditingCareItemId(item.id);
    setEditingCareItem({ 
      name: item.name, 
      frequency: item.frequency, 
      notes: item.notes || '',
      priority: item.priority || 'medium'
    });
  };

  const cancelEditingCareItem = () => {
    setEditingCareItemId(null);
    setEditingCareItem({ name: '', frequency: 'Daily', notes: '', priority: 'medium' });
  };

  const saveCareItemEdit = async () => {
    if (!editingCareItemId || !editingCareItem.name.trim()) return;
    
    const notesValue = (editingCareItem.notes && editingCareItem.notes.trim()) ? editingCareItem.notes.trim() : '';
    console.log(`Saving care plan item edit: ${editingCareItem.name}, notes: "${notesValue}"`);
    
    // Calculate updated items first (outside of setState)
            const updatedItems = carePlanItems.map(item => 
      item.id === editingCareItemId 
        ? { 
            ...item, 
            name: editingCareItem.name.trim(),
            frequency: editingCareItem.frequency,
            notes: notesValue,
            priority: editingCareItem.priority || 'medium'
          }
        : item
    );
    
    // Log the updated item to verify notes are included
    const updatedItem = updatedItems.find(item => item.id === editingCareItemId);
    console.log(`Updated care plan item: ${updatedItem?.name}, notes: "${updatedItem?.notes}"`);
    
    // Update state
    setCarePlanItems(updatedItems);
    
    setEditingCareItemId(null);
    setEditingCareItem({ name: '', frequency: 'Daily', notes: '', priority: 'medium' });
    
    // Save to database using the updated items (after state update)
    setTimeout(() => {
      console.log(`Saving with updated items, care plan item notes: ${updatedItem?.notes}`);
      savePetData(updatedItems);
    }, 100);
  };

  const addVaccination = async () => {
    if (newVaccination.name.trim() && newVaccination.date) {
      const vaccination: Vaccination = {
        id: crypto.randomUUID(),
        ...newVaccination,
        attachments: [],
      };
      const next = [...vaccinations, vaccination];
      const queued = pendingVaccinationAttachments;
      setVaccinations(next);
      setNewVaccination({ name: '', date: '', veterinarian: '', notes: '' });
      setAddingSection(null);
      setPendingVaccinationAttachments([]);
      await savePetData(undefined, undefined, undefined, next);
      if (queued.length > 0) {
        try {
          await persistPendingFiles('vaccination', vaccination.id, queued);
          if (selectedPetId) await loadPetData(selectedPetId);
        } catch (error) {
          showError(error instanceof Error ? error.message : 'Failed to add file');
        }
      }
    }
  };

  const startEditingVaccination = (vaccination: Vaccination) => {
    setEditingVaccinationId(vaccination.id);
    setEditingVaccination({
      name: vaccination.name,
      date: vaccination.date,
      veterinarian: vaccination.veterinarian || '',
      notes: vaccination.notes || ''
    });
  };

  const cancelEditingVaccination = () => {
    setEditingVaccinationId(null);
    setEditingVaccination({ name: '', date: '', veterinarian: '', notes: '' });
  };

  const saveVaccinationEdit = async () => {
    if (!editingVaccinationId || !editingVaccination.name.trim() || !editingVaccination.date) return;
    
    // Calculate updated items first (outside of setState)
    const updatedVaccinations = vaccinations.map(vaccination =>
      vaccination.id === editingVaccinationId
        ? {
            ...vaccination,
            name: editingVaccination.name.trim(),
            date: editingVaccination.date,
            veterinarian: editingVaccination.veterinarian || '',
            notes: editingVaccination.notes || ''
          }
        : vaccination
    );
    
    // Update state
    setVaccinations(updatedVaccinations);
    
    setEditingVaccinationId(null);
    setEditingVaccination({ name: '', date: '', veterinarian: '', notes: '' });
    
    // Save to database immediately using the updated items
    setTimeout(() => {
      console.log(`Saving with updated vaccinations, vaccination notes: ${updatedVaccinations.find(v => v.id === editingVaccinationId)?.notes}`);
      savePetData(undefined, undefined, undefined, updatedVaccinations);
    }, 100);
  };

  const addAppointment = async () => {
    const todayKey = localToday();
    if (newAppointment.date && newAppointment.type.trim()) {
      const appointment: Appointment = {
        id: crypto.randomUUID(),
        date: newAppointment.date,
        time: newAppointment.time,
        type: newAppointment.type,
        veterinarian: newAppointment.veterinarian,
        notes: newAppointment.notes,
        isUpcoming: newAppointment.date >= todayKey,
        attachments: [],
        addToDashboard: newAppointment.addToDashboard,
      };
      const next = [...appointments, appointment];
      const queued = pendingAppointmentAttachments;
      setAppointments(next);
      setNewAppointment(emptyAppointmentForm());
      setAddingSection(null);
      setPendingAppointmentAttachments([]);
      await savePetData(undefined, undefined, undefined, undefined, next);
      if (queued.length > 0) {
        try {
          await persistPendingFiles('appointment', appointment.id, queued);
          if (selectedPetId) await loadPetData(selectedPetId);
        } catch (error) {
          showError(error instanceof Error ? error.message : 'Failed to add file');
        }
      }
    }
  };

  const startEditingAppointment = (appointment: Appointment) => {
    setEditingAppointmentId(appointment.id);
    setEditingAppointment({
      date: appointment.date,
      time: appointment.time || '',
      type: appointment.type,
      veterinarian: appointment.veterinarian || '',
      notes: appointment.notes || '',
      addToDashboard: appointment.addToDashboard === true,
    });
  };

  const cancelEditingAppointment = () => {
    setEditingAppointmentId(null);
    setEditingAppointment(emptyAppointmentForm());
  };

  const saveAppointmentEdit = async () => {
    if (!editingAppointmentId || !editingAppointment.date || !editingAppointment.type.trim()) return;
    const todayKey = localToday();
    const updatedAppointments = appointments.map((appointment) =>
      appointment.id === editingAppointmentId
        ? {
            ...appointment,
            date: editingAppointment.date,
            time: editingAppointment.time || '',
            type: editingAppointment.type.trim(),
            veterinarian: editingAppointment.veterinarian || '',
            notes: editingAppointment.notes || '',
            isUpcoming: editingAppointment.date >= todayKey,
            addToDashboard: editingAppointment.addToDashboard,
          }
        : appointment
    );

    setAppointments(updatedAppointments);
    setEditingAppointmentId(null);
    setEditingAppointment(emptyAppointmentForm());

    setTimeout(() => {
      savePetData(undefined, undefined, undefined, undefined, updatedAppointments);
    }, 100);
  };

  const deleteAppointment = (appointmentId: string) => {
    const next = appointments.filter((appointment) => appointment.id !== appointmentId);
    setAppointments(next);
    savePetData(undefined, undefined, undefined, undefined, next);
  };

  const addVeterinaryRecord = async () => {
    if (newVetRecord.veterinarianName.trim() || newVetRecord.clinicName.trim()) {
      const record: VeterinaryRecord = {
        id: crypto.randomUUID(),
        ...newVetRecord,
        dateAdded: localToday(),
        notes: newVetRecord.notes || '',
        attachments: [],
      };
      const next = [...veterinaryRecords, record];
      const queued = pendingVeterinaryAttachments;
      setVeterinaryRecords(next);
      setNewVetRecord({
        veterinarianName: '',
        clinicName: '',
        phone: '',
        email: '',
        address: '',
        status: 'Active',
        notes: ''
      });
      setAddingSection(null);
      setPendingVeterinaryAttachments([]);
      await savePetData(undefined, undefined, next);
      if (queued.length > 0) {
        try {
          await persistPendingFiles('veterinary', record.id, queued);
          if (selectedPetId) await loadPetData(selectedPetId);
        } catch (error) {
          showError(error instanceof Error ? error.message : 'Failed to add file');
        }
      }
    }
  };

  const startEditingVetRecord = (record: VeterinaryRecord) => {
    setEditingVetRecordId(record.id);
    setEditingVetRecord({
      veterinarianName: record.veterinarianName,
      clinicName: record.clinicName,
      phone: record.phone,
      email: record.email,
      address: record.address,
      status: record.status,
      notes: record.notes || ''
    });
  };

  const cancelEditingVetRecord = () => {
    setEditingVetRecordId(null);
    setEditingVetRecord({
      veterinarianName: '',
      clinicName: '',
      phone: '',
      email: '',
      address: '',
      status: 'Active',
      notes: ''
    });
  };

  const saveVetRecordEdit = async () => {
    if (!editingVetRecordId) return;
    
    // Calculate updated items first (outside of setState)
    const updatedVetRecords = veterinaryRecords.map(record =>
      record.id === editingVetRecordId
        ? {
            ...record,
            veterinarianName: editingVetRecord.veterinarianName,
            clinicName: editingVetRecord.clinicName,
            phone: editingVetRecord.phone,
            email: editingVetRecord.email,
            address: editingVetRecord.address,
            status: editingVetRecord.status,
            notes: editingVetRecord.notes || ''
          }
        : record
    );
    
    // Update state
    setVeterinaryRecords(updatedVetRecords);
    
    setEditingVetRecordId(null);
    setEditingVetRecord({
      veterinarianName: '',
      clinicName: '',
      phone: '',
      email: '',
      address: '',
      status: 'Active',
      notes: ''
    });
    
    // Save to database immediately using the updated items
    setTimeout(() => {
      console.log(`Saving with updated vet records, vet record notes: ${updatedVetRecords.find(v => v.id === editingVetRecordId)?.notes}`);
      savePetData(undefined, undefined, updatedVetRecords);
    }, 100);
  };

  const toggleVetRecordStatus = (recordId: string) => {
    setVeterinaryRecords(prev => prev.map(record =>
      record.id === recordId
        ? { ...record, status: record.status === 'Active' ? 'History' : 'Active' }
        : record
    ));
  };

  const addDocument = async () => {
    if (newDocument.name.trim() && newDocument.date) {
      const document: Document = {
        id: crypto.randomUUID(),
        ...newDocument,
        attachments: [],
      };
      const next = [...documents, document];
      const queued = pendingDocumentAttachments;
      setDocuments(next);
      setNewDocument({ name: '', date: '', description: '' });
      setAddingSection(null);
      setPendingDocumentAttachments([]);
      await savePetData(undefined, undefined, undefined, undefined, undefined, next);
      if (queued.length > 0) {
        try {
          await persistPendingFiles('document', document.id, queued);
          if (selectedPetId) await loadPetData(selectedPetId);
        } catch (error) {
          showError(error instanceof Error ? error.message : 'Failed to add file');
        }
      }
    }
  };

  const startEditingDocument = (document: Document) => {
    setEditingDocumentId(document.id);
    setEditingDocument({
      name: document.name,
      date: document.date,
      description: document.description || '',
    });
  };

  const cancelEditingDocument = () => {
    setEditingDocumentId(null);
    setEditingDocument({ name: '', date: '', description: '' });
  };

  const saveDocumentEdit = async () => {
    if (!editingDocumentId || !editingDocument.name.trim() || !editingDocument.date) return;
    
    // Calculate updated items first (outside of setState)
    const updatedDocuments = documents.map(document => {
      if (document.id === editingDocumentId) {
        const updated: Document = {
          ...document,
          name: editingDocument.name.trim(),
          date: editingDocument.date,
          description: editingDocument.description || ''
          // File is not updated during edit
        };
        return updated;
      }
      return document;
    });
    
    // Update state
    setDocuments(updatedDocuments);
    
    setEditingDocumentId(null);
    setEditingDocument({ name: '', date: '', description: '' });
    
    // Save to database immediately using the updated items
    setTimeout(() => {
      console.log(`Saving with updated documents`);
      savePetData(undefined, undefined, undefined, undefined, undefined, updatedDocuments);
    }, 100);
  };

  const addNote = async () => {
    if (currentNote.trim()) {
      const note: Note = {
        id: Date.now().toString(),
        content: currentNote,
        date: localToday(),
        isCurrent: true
      };
      setNotes(prev => [...prev, note]);
      setCurrentNote('');
      setAddingSection(null);
      // Save to database immediately
      setTimeout(() => savePetData(), 100);
    }
  };

  const archiveNote = (noteId: string) => {
    setNotes(prev => prev.map(n => 
      n.id === noteId ? { ...n, isCurrent: false } : n
    ));
  };

  const reactivateNote = (noteId: string) => {
    setNotes(prev => prev.map(n =>
      n.id === noteId ? { ...n, isCurrent: true } : n
    ));
  };

  const startEditingNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingNote({ content: note.content });
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditingNote({ content: '' });
  };

  const saveNoteEdit = async () => {
    if (!editingNoteId || !editingNote.content.trim()) return;
    
    // Calculate updated items first (outside of setState)
    const updatedNotes = notes.map(note =>
      note.id === editingNoteId
        ? {
            ...note,
            content: editingNote.content.trim()
          }
        : note
    );
    
    // Update state
    setNotes(updatedNotes);
    
    setEditingNoteId(null);
    setEditingNote({ content: '' });
    
    // Save to database immediately using the updated items
    setTimeout(() => {
      console.log(`Saving with updated notes, note content: ${updatedNotes.find(n => n.id === editingNoteId)?.content}`);
      savePetData(undefined, undefined, undefined, undefined, undefined, undefined, updatedNotes);
    }, 100);
  };

  const exportToPDF = async () => {
    if (!selectedPetId) return;

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
    const title = `${petName || 'Pet'} - Complete Report`;
    const titleWidth = pdf.getTextWidth(title);
    pdf.text(title, (pageWidth - titleWidth) / 2, yPos);
    yPos += 15;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...colors.text);
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    pdf.text(`Generated on: ${dateStr}`, margin, yPos);
    yPos += 10;

    // Pet Info Section
    addSectionHeader('Pet Information');
    if (petType) {
      addText(`Type: ${petType.name}`, 10, false, 5);
    }
    if (birthdate) {
      addText(`Birthdate: ${new Date(birthdate).toLocaleDateString()}`, 10, false, 5);
    }
    if (breed) {
      addText(`Breed: ${breed}`, 10, false, 5);
    }
    if (weight) {
      addText(`Weight: ${weight}`, 10, false, 5);
    }
    if (color) {
      addText(`Color: ${color}`, 10, false, 5);
    }
    if (microchipNumber) {
      addText(`Microchip Number: ${microchipNumber}`, 10, false, 5);
    }
    if (whereGotPet) {
      addText(`Where Got Pet: ${whereGotPet}`, 10, false, 5);
    }
    yPos += 5;

    // Food Section
    const foodItems = includeHistory ? foods : foods.filter(f => f.isCurrent);
    if (foodItems.length > 0) {
      addSectionHeader('Food');
      foodItems.forEach((food) => {
        checkNewPage(15);
        
        addText(food.name, 11, true, 10);
        if (food.startDate) {
          addText(`Started: ${new Date(food.startDate).toLocaleDateString()}`, 9, false, 10);
        }
        if (food.endDate) {
          addText(`Ended: ${new Date(food.endDate).toLocaleDateString()}`, 9, false, 10);
        }
        if (food.rating) {
          addText(`Rating: ${'★'.repeat(food.rating)}${'☆'.repeat(5 - food.rating)}`, 9, false, 10);
        }
        if (food.notes) {
          addText(`Notes: ${food.notes}`, 9, false, 10);
        }
        yPos += 3;
      });
    }

    // Veterinary Section
    const vetItems = includeHistory ? veterinaryRecords : veterinaryRecords.filter(v => v.status === 'Active');
    if (vetItems.length > 0) {
      addSectionHeader('Veterinary Contacts');
      vetItems.forEach((vet) => {
        checkNewPage(15);
        
        const vetName = vet.veterinarianName || vet.clinicName || 'Unnamed Contact';
        addText(vetName, 11, true, 10);
        if (vet.veterinarianName && vet.clinicName) {
          addText(`${vet.veterinarianName} - ${vet.clinicName}`, 9, false, 10);
        }
        if (vet.phone) {
          addText(`Phone: ${vet.phone}`, 9, false, 10);
        }
        if (vet.email) {
          addText(`Email: ${vet.email}`, 9, false, 10);
        }
        if (vet.address) {
          addText(`Address: ${vet.address}`, 9, false, 10);
        }
        if (vet.notes) {
          addText(`Notes: ${vet.notes}`, 9, false, 10);
        }
        yPos += 3;
      });
    }

    // Care Plan Section
    const careItems = includeHistory ? carePlanItems : carePlanItems.filter(c => c.isActive);
    if (careItems.length > 0) {
      addSectionHeader('Care Plan');
      careItems.forEach((item) => {
        checkNewPage(15);
        
        addText(item.name, 11, true, 10);
        addText(`Frequency: ${item.frequency}`, 9, false, 10);
        if (item.startDate) {
          addText(`Start Date: ${new Date(item.startDate).toLocaleDateString()}`, 9, false, 10);
        }
        if (item.endDate) {
          addText(`End Date: ${new Date(item.endDate).toLocaleDateString()}`, 9, false, 10);
        }
        if (item.notes) {
          addText(`Notes: ${item.notes}`, 9, false, 10);
        }
        yPos += 3;
      });
    }

    // Vaccinations Section
    if (vaccinations.length > 0) {
      addSectionHeader('Vaccinations');
      vaccinations.forEach((vaccination) => {
        checkNewPage(15);
        
        addText(vaccination.name, 11, true, 10);
        if (vaccination.date) {
          addText(`Date: ${new Date(vaccination.date).toLocaleDateString()}`, 9, false, 10);
        }
        if (vaccination.veterinarian) {
          addText(`Veterinarian: ${vaccination.veterinarian}`, 9, false, 10);
        }
        if (vaccination.notes) {
          addText(`Notes: ${vaccination.notes}`, 9, false, 10);
        }
        yPos += 3;
      });
    }

    // Appointments Section
    if (appointments.length > 0) {
      addSectionHeader('Appointments');
      appointments.forEach((appointment) => {
        checkNewPage(15);
        
        addText(appointment.type, 11, true, 10);
        if (appointment.date) {
          addText(`Date: ${new Date(appointment.date).toLocaleDateString()}`, 9, false, 10);
        }
        if (appointment.time) {
          addText(`Time: ${appointment.time}`, 9, false, 10);
        }
        if (appointment.veterinarian) {
          addText(`Veterinarian: ${appointment.veterinarian}`, 9, false, 10);
        }
        if (appointment.notes) {
          addText(`Notes: ${appointment.notes}`, 9, false, 10);
        }
        yPos += 3;
      });
    }

    // Documents Section
    if (documents.length > 0) {
      addSectionHeader('Documents');
      documents.forEach((doc) => {
        checkNewPage(12);
        
        addText(doc.name, 11, true, 10);
        if (doc.date) {
          addText(`Date: ${new Date(doc.date).toLocaleDateString()}`, 9, false, 10);
        }
        if (doc.description) {
          addText(`Description: ${doc.description}`, 9, false, 10);
        }
        if ((doc.attachments || []).length > 0) {
          addText(`Files: ${(doc.attachments || []).length}`, 9, false, 10);
        }
        yPos += 3;
      });
    }

    // Notes Section
    const noteItems = includeHistory ? notes : notes.filter(n => n.isCurrent);
    if (noteItems.length > 0) {
      addSectionHeader('Notes');
      noteItems.forEach((note) => {
        checkNewPage(15);
        
        if (note.date) {
          addText(`Date: ${new Date(note.date).toLocaleDateString()}`, 9, false, 10);
        }
        if (note.content) {
          addText(note.content, 10, false, 10);
        }
        yPos += 3;
      });
    }

    // Save PDF
    const fileName = `${petName || 'Pet'}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    setShowExportPopup(false);
  };

  const deleteItem = (array: any[], setter: any, id: string) => {
    setter(array.filter(item => item.id !== id));
  };

  const requestDeleteEntry = (label: string, onConfirm: () => void) => {
    setDeleteEntryConfirm({ label, onConfirm });
    setDeleteEntryConfirmText('');
  };

  const confirmDeleteEntry = () => {
    if (!deleteEntryConfirm || deleteEntryConfirmText.toLowerCase() !== 'delete') return;
    deleteEntryConfirm.onConfirm();
    setDeleteEntryConfirm(null);
    setDeleteEntryConfirmText('');
  };

  const renderStars = (rating: number | null, onChange?: (rating: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange && onChange(star)}
            className={`text-2xl transition-colors ${
              rating && star <= rating
                ? 'text-yellow-400'
                : isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-600 hover:text-slate-400'
            }`}
            disabled={!onChange}
          >
            ★
          </button>
        ))}
      </div>
    );
  };

  const selectedPet = pets.find(p => p.id === selectedPetId);
  const selectedPetAttachments = selectedPetId
    ? (pets.find((pet) => pet.id === selectedPetId)?.attachments || [])
    : [];
  const savedModalRecord =
    attachmentModal && attachmentModal.id !== 'add'
      ? attachmentModal.kind === 'pet'
        ? { name: pets.find((pet) => pet.id === attachmentModal.id)?.name || 'Pet', attachments: pets.find((pet) => pet.id === attachmentModal.id)?.attachments || selectedPetAttachments }
        : attachmentModal.kind === 'document'
          ? documents.find((item) => item.id === attachmentModal.id)
          : attachmentModal.kind === 'veterinary'
            ? veterinaryRecords.find((item) => item.id === attachmentModal.id)
            : attachmentModal.kind === 'vaccination'
              ? vaccinations.find((item) => item.id === attachmentModal.id)
              : appointments.find((item) => item.id === attachmentModal.id)
      : null;
  const modalFiles: AttachmentItem[] =
    attachmentModal?.id === 'add'
      ? pendingForKind(attachmentModal.kind)
      : ((savedModalRecord && 'attachments' in savedModalRecord ? savedModalRecord.attachments : []) || []).map((item) => ({
          id: item.id,
          name: item.name,
          size: item.size,
          type: item.type,
        }));
  const modalTitle =
    attachmentModal?.id === 'add'
      ? attachmentModal.kind === 'pet'
        ? newPetName.trim() || 'New pet'
        : attachmentModal.kind === 'document'
          ? newDocument.name.trim() || 'New document'
          : attachmentModal.kind === 'veterinary'
            ? newVetRecord.clinicName.trim() || newVetRecord.veterinarianName.trim() || 'New veterinary contact'
            : attachmentModal.kind === 'vaccination'
              ? newVaccination.name.trim() || 'New vaccination'
              : newAppointment.type.trim() || 'New appointment'
      : savedModalRecord && 'name' in savedModalRecord
        ? savedModalRecord.name || 'Attachments'
        : savedModalRecord && 'veterinarianName' in savedModalRecord
          ? savedModalRecord.veterinarianName || savedModalRecord.clinicName || 'Veterinary contact'
          : savedModalRecord && 'type' in savedModalRecord
            ? savedModalRecord.type || 'Appointment'
            : 'Attachments';
  const documentNeedle = documentSearch.trim().toLowerCase();
  const filteredDocuments = documents.filter((doc) =>
    documentNeedle === '' || doc.name.toLowerCase().includes(documentNeedle)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={titleClass}>Pet Care Schedule</h2>
          <p className={descClass}>
            Manage all aspects of your pet's care, from basic information to veterinary records.
          </p>
        </div>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          saveMessage.type === 'success'
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
            : 'border-red-500/50 bg-red-500/10 text-red-300'
        }`}>
          {saveMessage.text}
        </div>
      )}

      {/* Pet Selector */}
      <div className={cardCompactClass}>
        <label className={isLight ? 'block text-sm font-medium text-slate-700 mb-3' : 'block text-sm font-medium text-slate-300 mb-3'}>
          Select your Pet
        </label>
        
        {!isCreatingNewPet ? (
          <div className="flex items-center gap-3 flex-wrap">
            {/* Pet Cards */}
            {pets.map(pet => (
              editingPetId === pet.id ? (
                // Edit mode
                <div
                  key={pet.id}
                  className="px-4 py-3 rounded-lg border border-slate-600 bg-slate-800 min-w-[200px]"
                  style={{
                    borderColor: editingPetColor,
                    backgroundColor: `${editingPetColor}15`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={editingPetName}
                      onChange={(e) => setEditingPetName(e.target.value)}
                      className="flex-1 px-2 py-1 rounded border border-slate-600 bg-slate-900 text-slate-100 text-sm focus:border-emerald-500/50 focus:outline-none"
                      placeholder="Pet name"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs text-slate-400">Color:</label>
                    <input
                      type="color"
                      value={editingPetColor}
                      onChange={(e) => setEditingPetColor(e.target.value)}
                      className="h-6 w-12 rounded border border-slate-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <AttachmentButton
                      count={(pets.find((item) => item.id === pet.id)?.attachments || []).length}
                      onClick={() => setAttachmentModal({ kind: 'pet', id: pet.id })}
                    />
                    <button
                      onClick={savePetEdit}
                      disabled={isSaving || !editingPetName.trim()}
                      className={isLight ? 'flex-1 px-2 py-1 rounded text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50' : 'flex-1 px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'}
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditingPet}
                      className={isLight ? 'px-2 py-1 rounded border-2 border-slate-400 bg-slate-100 text-slate-800 text-xs hover:bg-slate-200 transition-colors' : 'px-2 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600 transition-colors'}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : showColorPicker && editingPetId === pet.id ? (
                // Color picker mode
                <div
                  key={pet.id}
                  className="px-4 py-3 rounded-lg border border-slate-600 bg-slate-800 min-w-[200px]"
                  style={{
                    borderColor: editingPetColor,
                    backgroundColor: `${editingPetColor}15`,
                  }}
                >
                  <div className="mb-3">
                    <div className="font-medium text-slate-200 mb-2 text-sm">{pet.name}</div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400">Card Color:</label>
                      <input
                        type="color"
                        value={editingPetColor}
                        onChange={(e) => setEditingPetColor(e.target.value)}
                        className="h-8 w-16 rounded border border-slate-600 cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveColorOnly}
                      disabled={isSaving}
                      className={isLight ? 'flex-1 px-2 py-1 rounded text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50' : 'flex-1 px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingPetId(null);
                        setShowColorPicker(false);
                      }}
                      className={isLight ? 'px-2 py-1 rounded border-2 border-slate-400 bg-slate-100 text-slate-800 text-xs hover:bg-slate-200 transition-colors' : 'px-2 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600 transition-colors'}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // Display mode
                <div
                  key={pet.id}
                  className="relative"
                >
                  <button
                    onClick={() => selectPet(pet.id)}
                    className={`px-4 py-3 rounded-lg border transition-all duration-200 min-w-[120px] relative ${
                      selectedPetId === pet.id
                        ? 'shadow-lg'
                        : 'hover:border-slate-600'
                    }`}
                    style={{
                      borderColor: pet.card_color || '#10b981',
                      backgroundColor: selectedPetId === pet.id 
                        ? `${pet.card_color || '#10b981'}15` 
                        : `${pet.card_color || '#10b981'}08`,
                      color: pet.card_color || '#10b981',
                    }}
                  >
                    <div className="font-medium text-center">{pet.name}</div>
                    <div className={isLight ? 'text-xs text-center text-slate-600 mt-0.5' : 'text-xs text-center text-slate-300 mt-0.5 opacity-80'}>
                      {pet.custom_pet_type || pet.pet_type || '—'}
                    </div>
                  </button>
                  <div className="absolute top-1 left-1" onClick={(e) => e.stopPropagation()}>
                    <AttachmentButton
                      count={(pet.attachments || []).length}
                      onClick={() => setAttachmentModal({ kind: 'pet', id: pet.id })}
                    />
                  </div>
                  {/* Ellipsis Menu Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenPetId(menuOpenPetId === pet.id ? null : pet.id);
                    }}
                    className={isLight ? 'absolute top-1 right-1 p-1 rounded hover:bg-slate-100 transition-colors' : 'absolute top-1 right-1 p-1 rounded hover:bg-slate-700/50 transition-colors'}
                    title="Pet options"
                    aria-label="Pet options"
                  >
                    <svg className={isLight ? 'h-4 w-4 text-slate-600 hover:text-slate-900' : 'h-4 w-4 text-slate-400 hover:text-slate-200'} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>
                  {/* Menu Popup */}
                  {menuOpenPetId === pet.id && (
                    <div className={popupMenuClass}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChangeColor(pet);
                        }}
                        className={popupMenuItemClass}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenPetId(null);
                          setDeleteConfirmPetId(pet.id);
                          setDeleteConfirmText('');
                        }}
                        className={popupMenuDangerItemClass}
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
            ))}
            
            {/* Add New Pet Button */}
            <button
              onClick={() => {
                setIsCreatingNewPet(true);
                setSelectedPetId(null);
                setEditingPetId(null);
              }}
              className={isLight ? 'px-4 py-3 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition-all duration-200 flex items-center justify-center min-w-[60px]' : 'px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all duration-200 flex items-center justify-center min-w-[60px]'}
              title="Add New Pet"
              aria-label="Add New Pet"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className={labelClass}>
                New Pet Name
              </label>
              <input
                type="text"
                value={newPetName}
                onChange={(e) => setNewPetName(e.target.value)}
                placeholder="Enter pet name"
                className={inputClass}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    createNewPet();
                  } else if (e.key === 'Escape') {
                    setIsCreatingNewPet(false);
                    setNewPetName('');
                  }
                }}
                autoFocus
              />
            </div>
            <AttachmentButton
              count={pendingPetAttachments.length}
              onClick={() => setAttachmentModal({ kind: 'pet', id: 'add' })}
            />
            <button
              onClick={createNewPet}
              disabled={!newPetName.trim()}
              className={primaryButtonClass}
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreatingNewPet(false);
                setNewPetName('');
                revokePending(pendingPetAttachments);
                setPendingPetAttachments([]);
                if (attachmentModal?.kind === 'pet' && attachmentModal.id === 'add') closeAttachmentModal();
              }}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className={isLight ? 'rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm' : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center'}>
          <p className={isLight ? 'text-slate-600' : 'text-slate-400'}>Loading pets...</p>
        </div>
      )}

      {/* Click outside to close menu */}
      {menuOpenPetId && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuOpenPetId(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmPetId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={isLight ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-2xl' : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4'}>
            <h3 className={isLight ? 'text-xl font-semibold text-slate-900 mb-2' : 'text-xl font-semibold text-slate-50 mb-2'}>Delete Pet</h3>
            <div className={isLight ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 mb-4' : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4'}>
              <p className={isLight ? 'text-red-700 font-semibold mb-2' : 'text-red-300 font-semibold mb-2'}>
                ⚠️ Warning: This action cannot be undone!
              </p>
              <p className={isLight ? 'text-red-600 text-sm' : 'text-red-200 text-sm'}>
                All entered history for this pet will be permanently deleted and cannot be retrieved.
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
                  setDeleteConfirmPetId(null);
                  setDeleteConfirmText('');
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={deletePet}
                disabled={deleteConfirmText.toLowerCase() !== 'delete' || isSaving}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Deleting...' : 'Delete Pet'}
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmPetId(null);
                  setDeleteConfirmText('');
                }}
                disabled={isSaving}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteEntryConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={isLight ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-2xl' : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4'}>
            <h3 className={isLight ? 'text-xl font-semibold text-slate-900 mb-2' : 'text-xl font-semibold text-slate-50 mb-2'}>Delete Record</h3>
            <div className={isLight ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 mb-4' : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4'}>
              <p className={isLight ? 'text-red-700 font-semibold mb-2' : 'text-red-300 font-semibold mb-2'}>
                Warning: This action cannot be undone.
              </p>
              <p className={isLight ? 'text-red-600 text-sm' : 'text-red-200 text-sm'}>
                This {deleteEntryConfirm.label} will be permanently deleted.
              </p>
            </div>
            <p className={isLight ? 'text-slate-700 mb-4' : 'text-slate-300 mb-4'}>
              To confirm, type <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>delete</strong> below.
            </p>
            <input
              type="text"
              value={deleteEntryConfirmText}
              onChange={(e) => setDeleteEntryConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className={isLight ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4' : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4'}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDeleteEntryConfirm(null);
                  setDeleteEntryConfirmText('');
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={confirmDeleteEntry}
                disabled={deleteEntryConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Record
              </button>
              <button
                onClick={() => {
                  setDeleteEntryConfirm(null);
                  setDeleteEntryConfirmText('');
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !selectedPetId && !isCreatingNewPet && (
        <div className={isLight ? 'rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm' : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center'}>
          <p className={isLight ? 'text-slate-600 mb-4' : 'text-slate-400 mb-4'}>Please select a pet or create a new one to get started.</p>
        </div>
      )}

      {selectedPetId && (
        <>

          {/* Navigation Tabs */}
          <div className={tabStripClass}>
            <div className="flex gap-2 overflow-x-auto">
              {/* Pet Name as First Tab */}
              {selectedPet && (
                <div className="px-4 py-2 text-[18px] font-medium text-slate-200 whitespace-nowrap border-b-2 border-transparent">
                  {selectedPet.name}:
                </div>
              )}
              {/* Regular Tabs */}
              {[
                { id: 'info', label: 'Pet Info' },
                { id: 'food', label: 'Food' },
                { id: 'vet', label: 'Veterinary' },
                { id: 'care', label: 'Care Plan' },
                { id: 'vaccinations', label: 'Vaccinations' },
                { id: 'appointments', label: 'Appointments' },
                { id: 'documents', label: 'Documents' },
                { id: 'notes', label: 'Notes' },
                { id: 'export', label: 'Export' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeSection === tab.id ? tabActiveClass : tabInactiveClass
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pet Info Section */}
      {activeSection === 'info' && (
        <div className="space-y-6">
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>Basic Information</h3>
              <div className="flex items-center gap-3">
                {selectedPet && (
                  <span className="text-sm text-slate-400">
                    Editing: <span className="text-emerald-400 font-medium">{selectedPet.name}</span>
                  </span>
                )}
                {selectedPetId && (
                  <AttachmentButton
                    count={selectedPetAttachments.length}
                    onClick={() => setAttachmentModal({ kind: 'pet', id: selectedPetId })}
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  Pet Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  placeholder="Enter pet's name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Pet Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={petType?.name || ''}
                  onChange={(e) => handlePetTypeChange(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select pet type</option>
                  {COMMON_PET_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                {showCustomPetType && (
                  <input
                    type="text"
                    value={customPetType}
                    onChange={(e) => setCustomPetType(e.target.value)}
                    onBlur={handleCustomPetTypeBlur}
                    placeholder="Enter custom pet type"
                    className={`${inputClass} mt-2`}
                  />
                )}
              </div>
              <div>
                <label className={labelClass}>Birthdate</label>
                <input
                  type="date"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                  className={selectClass}
                />
              </div>
              <div>
                <label className={labelClass}>Breed</label>
                <input
                  type="text"
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  placeholder="Enter breed"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Where did you get your pet?</label>
                <input
                  type="text"
                  value={whereGotPet}
                  onChange={(e) => setWhereGotPet(e.target.value)}
                  placeholder="e.g., Animal shelter, breeder, pet store"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Weight</label>
                <input
                  type="text"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g., 25 lbs or 11 kg"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Color/Markings</label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Enter color or markings"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Microchip Number</label>
                <input
                  type="text"
                  value={microchipNumber}
                  onChange={(e) => setMicrochipNumber(e.target.value)}
                  placeholder="Enter microchip number"
                  className={inputClass}
                />
              </div>
            </div>
            
            {/* Save Button for Pet Info */}
            <div className="flex justify-start mt-6">
              <button
                onClick={() => savePetData()}
                disabled={isSaving}
                className={isLight ? 'px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 text-white hover:bg-emerald-500' : 'px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-500 text-slate-950 hover:bg-emerald-400'}
              >
                {isSaving ? 'Saving...' : 'Save Pet Info'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Food Section */}
      {activeSection === 'food' && (
        <div className="space-y-6">
          {addingSection !== 'food' ? (
            <div className="flex justify-start">
              <button type="button" onClick={() => setAddingSection('food')} className={primaryButtonClass}>
                + Add Food
              </button>
            </div>
          ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Enter New Food Item</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Food Name</label>
                  <input
                    type="text"
                    value={currentFood.name}
                    onChange={(e) => setCurrentFood({ ...currentFood, name: e.target.value })}
                    placeholder="Enter food name/brand"
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Rating</label>
                  {renderStars(currentFood.rating, (rating) => setCurrentFood({ ...currentFood, rating }))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes (Optional)</label>
                <textarea
                  value={currentFood.notes}
                  onChange={(e) => setCurrentFood({ ...currentFood, notes: e.target.value })}
                  placeholder="Add any additional notes about this food..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addCurrentFood}
                  className={primaryButtonClass}
                >
                  Add Current Food
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingSection(null);
                    setCurrentFood({ name: '', rating: null, notes: '' });
                  }}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
          )}

          {foods.filter(f => f.isCurrent).length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Active Foods</h3>
              <div className="space-y-4">
                {foods.filter(f => f.isCurrent).map(food => (
                  <div key={food.id} className={nestedCardClass}>
                    {editingFoodId === food.id ? (
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-slate-100 font-medium mb-4">{food.name}</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Started Date</label>
                            <input
                              type="date"
                              value={editingFood.startDate}
                              onChange={(e) => setEditingFood({ ...editingFood, startDate: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Rating</label>
                            {renderStars(editingFood.rating, (rating) => setEditingFood({ ...editingFood, rating }))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Notes (Optional)</label>
                          <textarea
                            value={editingFood.notes}
                            onChange={(e) => setEditingFood({ ...editingFood, notes: e.target.value })}
                            placeholder="Add any additional notes about this food..."
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveFoodEdit}
                            disabled={!editingFood.startDate || isSaving}
                            className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEditingFood}
                            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="text-slate-100 font-medium">{food.name}</h4>
                          <p className="text-sm text-slate-400">Started: {formatLocalDate(food.startDate)}</p>
                          {food.rating && (
                            <div className="mt-2">
                              <span className="text-sm text-slate-300">Rating: </span>
                              {renderStars(food.rating)}
                            </div>
                          )}
                          {food.notes && (
                            <p className="text-sm text-slate-300 mt-2 italic">"{food.notes}"</p>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => startEditingFood(food)}
                            className={rowIconEmeraldClass}
                            title="Edit food"
                            aria-label="Edit food"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            onClick={() => moveFoodToHistory(food.id)}
                            className={rowIconSecondaryClass}
                            title="Move to history"
                            aria-label="Move to history"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                          </button>
                          <button
                            onClick={() => requestDeleteEntry('active food item', () => deleteItem(foods, setFoods, food.id))}
                            className={rowIconDangerClass}
                            title="Delete food"
                            aria-label="Delete food"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {foods.filter(f => !f.isCurrent).length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Food History</h3>
              <div className="space-y-4">
                {foods.filter(f => !f.isCurrent).map(food => (
                  <div key={food.id} className={nestedCardClass}>
                    {editingFoodId === food.id ? (
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-slate-100 font-medium mb-4">{food.name}</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Started Date</label>
                            <input
                              type="date"
                              value={editingFood.startDate}
                              onChange={(e) => setEditingFood({ ...editingFood, startDate: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Ended Date</label>
                            <input
                              type="date"
                              value={editingFood.endDate}
                              onChange={(e) => setEditingFood({ ...editingFood, endDate: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Rating</label>
                            {renderStars(editingFood.rating, (rating) => setEditingFood({ ...editingFood, rating }))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Notes (Optional)</label>
                          <textarea
                            value={editingFood.notes}
                            onChange={(e) => setEditingFood({ ...editingFood, notes: e.target.value })}
                            placeholder="Add any additional notes about this food..."
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveFoodEdit}
                            disabled={!editingFood.startDate || isSaving}
                            className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEditingFood}
                            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="text-slate-100 font-medium">{food.name}</h4>
                          <p className="text-sm text-slate-400">
                            {formatLocalDate(food.startDate)} - {food.endDate ? formatLocalDate(food.endDate) : 'Present'}
                          </p>
                          {food.rating && (
                            <div className="mt-2">
                              <span className="text-sm text-slate-300">Rating: </span>
                              {renderStars(food.rating)}
                            </div>
                          )}
                          {food.notes && (
                            <p className="text-sm text-slate-300 mt-2 italic">"{food.notes}"</p>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => startEditingFood(food)}
                            className={rowIconEmeraldClass}
                            title="Edit food"
                            aria-label="Edit food"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            onClick={() => returnFoodToActive(food.id)}
                            className={rowIconSecondaryClass}
                            title="Return to active"
                            aria-label="Return food to active"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                            </svg>
                          </button>
                          <button
                            onClick={() => requestDeleteEntry('food history item', () => deleteItem(foods, setFoods, food.id))}
                            className={rowIconDangerClass}
                            title="Delete food"
                            aria-label="Delete food"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Veterinary Contact Section */}
      {activeSection === 'vet' && (
        <div className="space-y-6">
          {addingSection !== 'vet' ? (
            <div className="flex justify-start">
              <button type="button" onClick={() => setAddingSection('vet')} className={primaryButtonClass}>
                + Add Veterinary Contact
              </button>
            </div>
          ) : (
          <div className={cardClass}>
            <div className="flex items-start justify-between gap-4">
              <h3 className={sectionTitleClass}>Add Veterinary Contact</h3>
              <AttachmentButton
                count={pendingVeterinaryAttachments.length}
                onClick={() => setAttachmentModal({ kind: 'veterinary', id: 'add' })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Veterinarian Name</label>
                <input
                  type="text"
                  value={newVetRecord.veterinarianName}
                  onChange={(e) => setNewVetRecord({ ...newVetRecord, veterinarianName: e.target.value })}
                  placeholder="Dr. Smith"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Clinic Name</label>
                <input
                  type="text"
                  value={newVetRecord.clinicName}
                  onChange={(e) => setNewVetRecord({ ...newVetRecord, clinicName: e.target.value })}
                  placeholder="Animal Hospital"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  type="tel"
                  value={newVetRecord.phone}
                  onChange={(e) => setNewVetRecord({ ...newVetRecord, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={newVetRecord.email}
                  onChange={(e) => setNewVetRecord({ ...newVetRecord, email: e.target.value })}
                  placeholder="vet@example.com"
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Address</label>
                <input
                  type="text"
                  value={newVetRecord.address}
                  onChange={(e) => setNewVetRecord({ ...newVetRecord, address: e.target.value })}
                  placeholder="123 Main St, City, State ZIP"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={newVetRecord.status}
                  onChange={(e) => setNewVetRecord({ ...newVetRecord, status: e.target.value as 'Active' | 'History' })}
                  className={selectClass}
                >
                  <option value="Active">Active</option>
                  <option value="History">History</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Notes (Optional)</label>
                <textarea
                  value={newVetRecord.notes}
                  onChange={(e) => setNewVetRecord({ ...newVetRecord, notes: e.target.value })}
                  placeholder="Add any additional notes about this veterinary contact..."
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={addVeterinaryRecord}
                className={primaryButtonClass}
              >
                Add Veterinary Contact
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingSection(null);
                  setNewVetRecord({
                    veterinarianName: '',
                    clinicName: '',
                    phone: '',
                    email: '',
                    address: '',
                    status: 'Active',
                    notes: ''
                  });
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
          )}

          {veterinaryRecords.filter(r => r.status === 'Active').length > 0 && (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Active Veterinary Contacts</h3>
              <div className="space-y-4">
                {veterinaryRecords
                  .filter(r => r.status === 'Active')
                  .map(record => (
                    <div key={record.id} className={nestedCardClass}>
                      {editingVetRecordId === record.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Veterinarian Name</label>
                              <input
                                type="text"
                                value={editingVetRecord.veterinarianName}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, veterinarianName: e.target.value })}
                                placeholder="Dr. Smith"
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Clinic Name</label>
                              <input
                                type="text"
                                value={editingVetRecord.clinicName}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, clinicName: e.target.value })}
                                placeholder="Animal Hospital"
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                              <input
                                type="tel"
                                value={editingVetRecord.phone}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, phone: e.target.value })}
                                placeholder="(555) 123-4567"
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                              <input
                                type="email"
                                value={editingVetRecord.email}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, email: e.target.value })}
                                placeholder="vet@example.com"
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-slate-300 mb-2">Address</label>
                              <input
                                type="text"
                                value={editingVetRecord.address}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, address: e.target.value })}
                                placeholder="123 Main St, City, State ZIP"
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                              <select
                                value={editingVetRecord.status}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, status: e.target.value as 'Active' | 'History' })}
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              >
                                <option value="Active">Active</option>
                                <option value="History">History</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-slate-300 mb-2">Notes (Optional)</label>
                              <textarea
                                value={editingVetRecord.notes}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, notes: e.target.value })}
                                placeholder="Add any additional notes about this veterinary contact..."
                                rows={3}
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={saveVetRecordEdit}
                              disabled={isSaving}
                              className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEditingVetRecord}
                              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="text-slate-100 font-medium">
                                {record.veterinarianName || record.clinicName || 'Unnamed Contact'}
                              </h4>
                              <span className={isLight ? 'inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800' : 'inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300'}>
                                Active
                              </span>
                            </div>
                            {record.veterinarianName && record.clinicName && (
                              <p className="text-sm text-slate-400">{record.veterinarianName} - {record.clinicName}</p>
                            )}
                            {record.veterinarianName && !record.clinicName && (
                              <p className="text-sm text-slate-400">{record.veterinarianName}</p>
                            )}
                            {!record.veterinarianName && record.clinicName && (
                              <p className="text-sm text-slate-400">{record.clinicName}</p>
                            )}
                            {record.phone && (
                              <p className="text-sm text-slate-400">Phone: {record.phone}</p>
                            )}
                            {record.email && (
                              <p className="text-sm text-slate-400">Email: {record.email}</p>
                            )}
                            {record.address && (
                              <p className="text-sm text-slate-400">Address: {record.address}</p>
                            )}
                            {record.notes && (
                              <p className="text-sm text-slate-300 mt-2 italic">"{record.notes}"</p>
                            )}
                            <p className="text-xs text-slate-500 mt-2">Added: {formatLocalDate(record.dateAdded)}</p>
                          </div>
                          <div className="flex gap-1.5 ml-4">
                            <AttachmentButton
                              count={(record.attachments || []).length}
                              onClick={() => setAttachmentModal({ kind: 'veterinary', id: record.id })}
                            />
                            <button
                              onClick={() => startEditingVetRecord(record)}
                              className={rowIconEmeraldClass}
                              title="Edit contact"
                              aria-label="Edit contact"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => toggleVetRecordStatus(record.id)}
                              className={rowIconSecondaryClass}
                              title="Move to history"
                              aria-label="Move to history"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                            </button>
                            <button
                              onClick={() => requestDeleteEntry('veterinary contact', () => deleteItem(veterinaryRecords, setVeterinaryRecords, record.id))}
                              className={rowIconDangerClass}
                              title="Delete contact"
                              aria-label="Delete contact"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {veterinaryRecords.filter(r => r.status === 'History').length > 0 && (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Veterinary Contact History</h3>
              <div className="space-y-4">
                {veterinaryRecords
                  .filter(r => r.status === 'History')
                  .map(record => (
                    <div key={record.id} className={nestedCardClass}>
                      {editingVetRecordId === record.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Veterinarian Name</label>
                              <input
                                type="text"
                                value={editingVetRecord.veterinarianName}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, veterinarianName: e.target.value })}
                                placeholder="Dr. Smith"
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Clinic Name</label>
                              <input
                                type="text"
                                value={editingVetRecord.clinicName}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, clinicName: e.target.value })}
                                placeholder="Animal Hospital"
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                              <input
                                type="tel"
                                value={editingVetRecord.phone}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, phone: e.target.value })}
                                placeholder="(555) 123-4567"
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                              <input
                                type="email"
                                value={editingVetRecord.email}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, email: e.target.value })}
                                placeholder="vet@example.com"
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-slate-300 mb-2">Address</label>
                              <input
                                type="text"
                                value={editingVetRecord.address}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, address: e.target.value })}
                                placeholder="123 Main St, City, State ZIP"
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                              <select
                                value={editingVetRecord.status}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, status: e.target.value as 'Active' | 'History' })}
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              >
                                <option value="Active">Active</option>
                                <option value="History">History</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-slate-300 mb-2">Notes (Optional)</label>
                              <textarea
                                value={editingVetRecord.notes}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, notes: e.target.value })}
                                placeholder="Add any additional notes about this veterinary contact..."
                                rows={3}
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={saveVetRecordEdit}
                              disabled={isSaving}
                              className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEditingVetRecord}
                              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="text-slate-100 font-medium">
                                {record.veterinarianName || record.clinicName || 'Unnamed Contact'}
                              </h4>
                              <span className={isLight ? 'inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700' : 'inline-flex items-center rounded-full bg-slate-500/20 px-2 py-0.5 text-xs font-medium text-slate-400'}>
                                History
                              </span>
                            </div>
                            {record.veterinarianName && record.clinicName && (
                              <p className="text-sm text-slate-400">{record.veterinarianName} - {record.clinicName}</p>
                            )}
                            {record.veterinarianName && !record.clinicName && (
                              <p className="text-sm text-slate-400">{record.veterinarianName}</p>
                            )}
                            {!record.veterinarianName && record.clinicName && (
                              <p className="text-sm text-slate-400">{record.clinicName}</p>
                            )}
                            {record.phone && (
                              <p className="text-sm text-slate-400">Phone: {record.phone}</p>
                            )}
                            {record.email && (
                              <p className="text-sm text-slate-400">Email: {record.email}</p>
                            )}
                            {record.address && (
                              <p className="text-sm text-slate-400">Address: {record.address}</p>
                            )}
                            {record.notes && (
                              <p className="text-sm text-slate-300 mt-2 italic">"{record.notes}"</p>
                            )}
                            <p className="text-xs text-slate-500 mt-2">Added: {formatLocalDate(record.dateAdded)}</p>
                          </div>
                          <div className="flex gap-1.5 ml-4">
                            <AttachmentButton
                              count={(record.attachments || []).length}
                              onClick={() => setAttachmentModal({ kind: 'veterinary', id: record.id })}
                            />
                            <button
                              onClick={() => startEditingVetRecord(record)}
                              className={rowIconEmeraldClass}
                              title="Edit contact"
                              aria-label="Edit contact"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => toggleVetRecordStatus(record.id)}
                              className={rowIconSecondaryClass}
                              title="Return to active"
                              aria-label="Return to active"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
                            </button>
                            <button
                              onClick={() => requestDeleteEntry('veterinary contact history record', () => deleteItem(veterinaryRecords, setVeterinaryRecords, record.id))}
                              className={rowIconDangerClass}
                              title="Delete contact"
                              aria-label="Delete contact"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Care Plan Section */}
      {activeSection === 'care' && (
        <div className="space-y-6">
          {addingSection !== 'care' ? (
            <div className="flex justify-start">
              <button type="button" onClick={() => setAddingSection('care')} className={primaryButtonClass}>
                + Add Care Item
              </button>
            </div>
          ) : (
          <div className={cardClass}>
            <h3 className={sectionTitleClass}>Add Care Plan Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className={labelClass}>Care Item Name</label>
                <input
                  type="text"
                  value={newCareItem.name}
                  onChange={(e) => setNewCareItem({ ...newCareItem, name: e.target.value })}
                  placeholder="e.g., Nail trimming, Grooming, Exercise"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Frequency</label>
                <select
                  value={newCareItem.frequency}
                  onChange={(e) => setNewCareItem({ ...newCareItem, frequency: e.target.value })}
                  className={selectClass}
                >
                  {FREQUENCY_OPTIONS.map(freq => (
                    <option key={freq} value={freq}>{freq}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Priority</label>
                <select
                  value={newCareItem.priority}
                  onChange={(e) => setNewCareItem({ ...newCareItem, priority: e.target.value as 'low' | 'medium' | 'high' })}
                  className={selectClass}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className={labelClass}>Notes (Optional)</label>
              <textarea
                value={newCareItem.notes}
                onChange={(e) => setNewCareItem({ ...newCareItem, notes: e.target.value })}
                placeholder="Add any additional notes about this care item..."
                rows={3}
                className={`${selectClass} placeholder-slate-500 resize-none`}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={addCarePlanItem}
                className={primaryButtonClass}
              >
                Add Care Item
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingSection(null);
                  setNewCareItem({ name: '', frequency: 'Daily', notes: '', priority: 'medium' });
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
          )}

          {carePlanItems.filter(item => item.isActive).length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Active Care Plan</h3>
              <div className="space-y-3">
                {carePlanItems.filter(item => item.isActive).map(item => (
                  <div key={item.id} className={nestedCardClass}>
                    {editingCareItemId === item.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Care Item Name</label>
                            <input
                              type="text"
                              value={editingCareItem.name}
                              onChange={(e) => setEditingCareItem({ ...editingCareItem, name: e.target.value })}
                              placeholder="e.g., Nail trimming, Grooming, Exercise"
                              className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Frequency</label>
                            <select
                              value={editingCareItem.frequency}
                              onChange={(e) => setEditingCareItem({ ...editingCareItem, frequency: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            >
                              {FREQUENCY_OPTIONS.map(freq => (
                                <option key={freq} value={freq}>{freq}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Priority</label>
                            <select
                              value={editingCareItem.priority}
                              onChange={(e) => setEditingCareItem({ ...editingCareItem, priority: e.target.value as 'low' | 'medium' | 'high' })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Notes (Optional)</label>
                          <textarea
                            value={editingCareItem.notes}
                            onChange={(e) => setEditingCareItem({ ...editingCareItem, notes: e.target.value })}
                            placeholder="Add any additional notes about this care item..."
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveCareItemEdit}
                            disabled={!editingCareItem.name.trim() || isSaving}
                            className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEditingCareItem}
                            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="text-slate-100 font-medium mb-3">{item.name}</h4>
                          <div className="grid grid-cols-3 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-slate-400 uppercase mb-1">Frequency</p>
                              <p className="text-sm text-slate-200">{item.frequency}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 uppercase mb-1">Started</p>
                              <p className="text-sm text-slate-200">{formatLocalDate(item.startDate)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 uppercase mb-1">Priority</p>
                              <p className="text-sm text-slate-200 capitalize">{item.priority || 'Medium'}</p>
                            </div>
                          </div>
                          {item.notes && (
                            <p className="text-sm text-slate-300 mt-2 italic">"{item.notes}"</p>
                          )}
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => startEditingCareItem(item)}
                            className={rowIconEmeraldClass}
                            title="Edit care item"
                            aria-label="Edit care item"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            onClick={() => toggleCarePlanItem(item.id)}
                            className={rowIconSecondaryClass}
                            title="Move to history"
                            aria-label="Move to history"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                          </button>
                          <button
                            onClick={() => requestDeleteEntry('active care plan item', () => deleteItem(carePlanItems, setCarePlanItems, item.id))}
                            className={rowIconDangerClass}
                            title="Delete care item"
                            aria-label="Delete care item"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {carePlanItems.filter(item => !item.isActive).length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Care Plan History</h3>
              <div className="space-y-3">
                {carePlanItems.filter(item => !item.isActive).map(item => (
                  <div key={item.id} className={nestedCardClass}>
                    {editingCareItemId === item.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Care Item Name</label>
                            <input
                              type="text"
                              value={editingCareItem.name}
                              onChange={(e) => setEditingCareItem({ ...editingCareItem, name: e.target.value })}
                              placeholder="e.g., Nail trimming, Grooming, Exercise"
                              className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Frequency</label>
                            <select
                              value={editingCareItem.frequency}
                              onChange={(e) => setEditingCareItem({ ...editingCareItem, frequency: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            >
                              {FREQUENCY_OPTIONS.map(freq => (
                                <option key={freq} value={freq}>{freq}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Priority</label>
                            <select
                              value={editingCareItem.priority}
                              onChange={(e) => setEditingCareItem({ ...editingCareItem, priority: e.target.value as 'low' | 'medium' | 'high' })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Notes (Optional)</label>
                          <textarea
                            value={editingCareItem.notes}
                            onChange={(e) => setEditingCareItem({ ...editingCareItem, notes: e.target.value })}
                            placeholder="Add any additional notes about this care item..."
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveCareItemEdit}
                            disabled={!editingCareItem.name.trim() || isSaving}
                            className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEditingCareItem}
                            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="text-slate-100 font-medium mb-3">{item.name}</h4>
                          <div className="grid grid-cols-3 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-slate-400 uppercase mb-1">Frequency</p>
                              <p className="text-sm text-slate-200">{item.frequency}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 uppercase mb-1">Started</p>
                              <p className="text-sm text-slate-200">
                                {formatLocalDate(item.startDate)} - {item.endDate ? formatLocalDate(item.endDate) : 'Present'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 uppercase mb-1">Priority</p>
                              <p className="text-sm text-slate-200 capitalize">{item.priority || 'Medium'}</p>
                            </div>
                          </div>
                          {item.notes && (
                            <p className="text-sm text-slate-300 mt-2 italic">"{item.notes}"</p>
                          )}
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => startEditingCareItem(item)}
                            className={rowIconEmeraldClass}
                            title="Edit care item"
                            aria-label="Edit care item"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            onClick={() => toggleCarePlanItem(item.id)}
                            className={rowIconSecondaryClass}
                            title="Return to active"
                            aria-label="Return care item to active"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                            </svg>
                          </button>
                          <button
                            onClick={() => requestDeleteEntry('care plan history item', () => deleteItem(carePlanItems, setCarePlanItems, item.id))}
                            className={rowIconDangerClass}
                            title="Delete care item"
                            aria-label="Delete care item"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vaccinations Section */}
      {activeSection === 'vaccinations' && (
        <div className="space-y-6">
          {addingSection !== 'vaccinations' ? (
            <div className="flex justify-start">
              <button type="button" onClick={() => setAddingSection('vaccinations')} className={primaryButtonClass}>
                + Add Vaccination
              </button>
            </div>
          ) : (
          <div className={cardClass}>
            <div className="flex items-start justify-between gap-4">
              <h3 className={sectionTitleClass}>Add Vaccination</h3>
              <AttachmentButton
                count={pendingVaccinationAttachments.length}
                onClick={() => setAttachmentModal({ kind: 'vaccination', id: 'add' })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Vaccination Name</label>
                <input
                  type="text"
                  value={newVaccination.name}
                  onChange={(e) => setNewVaccination({ ...newVaccination, name: e.target.value })}
                  placeholder="e.g., Rabies, DHPP, FVRCP"
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                <input
                  type="date"
                  value={newVaccination.date}
                  onChange={(e) => setNewVaccination({ ...newVaccination, date: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Veterinarian</label>
                <input
                  type="text"
                  value={newVaccination.veterinarian}
                  onChange={(e) => setNewVaccination({ ...newVaccination, veterinarian: e.target.value })}
                  placeholder="Veterinarian name"
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                <input
                  type="text"
                  value={newVaccination.notes}
                  onChange={(e) => setNewVaccination({ ...newVaccination, notes: e.target.value })}
                  placeholder="Additional notes"
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={addVaccination}
                className={primaryButtonClass}
              >
                Add Vaccination
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingSection(null);
                  setNewVaccination({ name: '', date: '', veterinarian: '', notes: '' });
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
          )}

          {vaccinations.length > 0 && (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Vaccination History</h3>
              <div className="space-y-3">
                {vaccinations
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(vaccination => (
                    <div key={vaccination.id} className={nestedCardClass}>
                      {editingVaccinationId === vaccination.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Vaccination Name</label>
                              <input
                                type="text"
                                value={editingVaccination.name}
                                onChange={(e) => setEditingVaccination({ ...editingVaccination, name: e.target.value })}
                                placeholder="e.g., Rabies, DHPP, FVRCP"
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                              <input
                                type="date"
                                value={editingVaccination.date}
                                onChange={(e) => setEditingVaccination({ ...editingVaccination, date: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Veterinarian</label>
                              <input
                                type="text"
                                value={editingVaccination.veterinarian}
                                onChange={(e) => setEditingVaccination({ ...editingVaccination, veterinarian: e.target.value })}
                                placeholder="Veterinarian name"
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                              <input
                                type="text"
                                value={editingVaccination.notes}
                                onChange={(e) => setEditingVaccination({ ...editingVaccination, notes: e.target.value })}
                                placeholder="Additional notes"
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={saveVaccinationEdit}
                              disabled={!editingVaccination.name.trim() || !editingVaccination.date || isSaving}
                              className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEditingVaccination}
                              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-slate-100 font-medium">{vaccination.name}</h4>
                            <p className="text-sm text-slate-400">Date: {formatLocalDate(vaccination.date)}</p>
                            {vaccination.veterinarian && (
                              <p className="text-sm text-slate-400">Veterinarian: {vaccination.veterinarian}</p>
                            )}
                            {vaccination.notes && (
                              <p className="text-sm text-slate-400 mt-1">Notes: {vaccination.notes}</p>
                            )}
                          </div>
                          <div className="flex gap-1.5 ml-4">
                            <AttachmentButton
                              count={(vaccination.attachments || []).length}
                              onClick={() => setAttachmentModal({ kind: 'vaccination', id: vaccination.id })}
                            />
                            <button
                              onClick={() => startEditingVaccination(vaccination)}
                              className={rowIconEmeraldClass}
                              title="Edit vaccination"
                              aria-label="Edit vaccination"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => requestDeleteEntry('vaccination record', () => deleteItem(vaccinations, setVaccinations, vaccination.id))}
                              className={rowIconDangerClass}
                              title="Delete vaccination"
                              aria-label="Delete vaccination"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Appointments Section */}
      {activeSection === 'appointments' && (
        <div className="space-y-6">
          {(() => {
            const todayKey = localToday();
            const appointmentNeedle = appointmentSearch.trim().toLowerCase();
            const matchesAppointmentName = (a: Appointment) =>
              appointmentNeedle === '' || a.type.toLowerCase().includes(appointmentNeedle);
            const upcomingAppointments = appointments
              .filter((a) => a.date >= todayKey)
              .filter(matchesAppointmentName)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const historyAppointments = appointments
              .filter((a) => a.date < todayKey)
              .filter(matchesAppointmentName)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            return (
              <>
          {addingSection !== 'appointments' ? (
            <div className="flex justify-start">
              <button type="button" onClick={() => setAddingSection('appointments')} className={primaryButtonClass}>
                + Add Appointment
              </button>
            </div>
          ) : (
          <div className={cardClass}>
            <div className="flex items-start justify-between gap-4">
              <h3 className={sectionTitleClass}>Add Appointment</h3>
              <AttachmentButton
                count={pendingAppointmentAttachments.length}
                onClick={() => setAttachmentModal({ kind: 'appointment', id: 'add' })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                <input
                  type="date"
                  value={newAppointment.date}
                  onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Time</label>
                <input
                  type="time"
                  value={newAppointment.time}
                  onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Appointment Type</label>
                <input
                  type="text"
                  value={newAppointment.type}
                  onChange={(e) => setNewAppointment({ ...newAppointment, type: e.target.value })}
                  placeholder="e.g., Annual checkup, Vaccination, Surgery"
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Veterinarian</label>
                <input
                  type="text"
                  value={newAppointment.veterinarian}
                  onChange={(e) => setNewAppointment({ ...newAppointment, veterinarian: e.target.value })}
                  placeholder="Veterinarian name"
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                <textarea
                  value={newAppointment.notes}
                  onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                  placeholder="Additional notes about the appointment"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div className="md:col-span-2">
                <DashboardCalendarSwitch
                  isOn={newAppointment.addToDashboard}
                  isLight={isLight}
                  onToggle={() =>
                    setNewAppointment({ ...newAppointment, addToDashboard: !newAppointment.addToDashboard })
                  }
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={addAppointment}
                className={primaryButtonClass}
              >
                Add Appointment
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingSection(null);
                  setNewAppointment(emptyAppointmentForm());
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
          )}

          <div className={cardClass}>
            <label className={labelClass}>Search Appointments</label>
            <input
              type="text"
              value={appointmentSearch}
              onChange={(e) => setAppointmentSearch(e.target.value)}
              placeholder="Search by name..."
              className={inputClass}
            />
          </div>

          {upcomingAppointments.length > 0 && (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Upcoming Appointments</h3>
              <div className="space-y-3">
                {upcomingAppointments.map(appointment => (
                    <div key={appointment.id} className={nestedCardClass}>
                      {editingAppointmentId === appointment.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className={labelClass}>Date</label>
                              <input
                                type="date"
                                value={editingAppointment.date}
                                onChange={(e) => setEditingAppointment({ ...editingAppointment, date: e.target.value })}
                                className={selectClass}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Time</label>
                              <input
                                type="time"
                                value={editingAppointment.time}
                                onChange={(e) => setEditingAppointment({ ...editingAppointment, time: e.target.value })}
                                className={selectClass}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Appointment Type</label>
                              <input
                                type="text"
                                value={editingAppointment.type}
                                onChange={(e) => setEditingAppointment({ ...editingAppointment, type: e.target.value })}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Veterinarian</label>
                              <input
                                type="text"
                                value={editingAppointment.veterinarian}
                                onChange={(e) => setEditingAppointment({ ...editingAppointment, veterinarian: e.target.value })}
                                className={inputClass}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className={labelClass}>Notes</label>
                              <textarea
                                rows={3}
                                value={editingAppointment.notes}
                                onChange={(e) => setEditingAppointment({ ...editingAppointment, notes: e.target.value })}
                                className={`${inputClass} resize-none`}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <DashboardCalendarSwitch
                                isOn={editingAppointment.addToDashboard}
                                isLight={isLight}
                                onToggle={() =>
                                  setEditingAppointment({
                                    ...editingAppointment,
                                    addToDashboard: !editingAppointment.addToDashboard,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={saveAppointmentEdit}
                              disabled={!editingAppointment.date || !editingAppointment.type.trim() || isSaving}
                              className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEditingAppointment}
                              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-slate-100 font-medium">{appointment.type}</h4>
                              {appointment.addToDashboard && <OnCalendarChip isLight={isLight} />}
                            </div>
                            <p className="text-sm text-slate-400">
                              {formatLocalDate(appointment.date)} {appointment.time && `at ${appointment.time}`}
                            </p>
                            {appointment.veterinarian && (
                              <p className="text-sm text-slate-400">Veterinarian: {appointment.veterinarian}</p>
                            )}
                            {appointment.notes && (
                              <p className="text-sm text-slate-400 mt-1">Notes: {appointment.notes}</p>
                            )}
                          </div>
                          <div className="flex gap-1.5 ml-4">
                            <AttachmentButton
                              count={(appointment.attachments || []).length}
                              onClick={() => setAttachmentModal({ kind: 'appointment', id: appointment.id })}
                            />
                            <button
                              onClick={() => startEditingAppointment(appointment)}
                              className={rowIconEmeraldClass}
                              title="Edit appointment"
                              aria-label="Edit appointment"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => requestDeleteEntry('upcoming appointment', () => deleteAppointment(appointment.id))}
                              className={rowIconDangerClass}
                              title="Delete appointment"
                              aria-label="Delete appointment"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {historyAppointments.length > 0 && (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Appointment History</h3>
              <div className="space-y-3">
                {historyAppointments.map(appointment => (
                    <div key={appointment.id} className={nestedCardClass}>
                      {editingAppointmentId === appointment.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className={labelClass}>Date</label>
                              <input
                                type="date"
                                value={editingAppointment.date}
                                onChange={(e) => setEditingAppointment({ ...editingAppointment, date: e.target.value })}
                                className={selectClass}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Time</label>
                              <input
                                type="time"
                                value={editingAppointment.time}
                                onChange={(e) => setEditingAppointment({ ...editingAppointment, time: e.target.value })}
                                className={selectClass}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Appointment Type</label>
                              <input
                                type="text"
                                value={editingAppointment.type}
                                onChange={(e) => setEditingAppointment({ ...editingAppointment, type: e.target.value })}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Veterinarian</label>
                              <input
                                type="text"
                                value={editingAppointment.veterinarian}
                                onChange={(e) => setEditingAppointment({ ...editingAppointment, veterinarian: e.target.value })}
                                className={inputClass}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className={labelClass}>Notes</label>
                              <textarea
                                rows={3}
                                value={editingAppointment.notes}
                                onChange={(e) => setEditingAppointment({ ...editingAppointment, notes: e.target.value })}
                                className={`${inputClass} resize-none`}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <DashboardCalendarSwitch
                                isOn={editingAppointment.addToDashboard}
                                isLight={isLight}
                                onToggle={() =>
                                  setEditingAppointment({
                                    ...editingAppointment,
                                    addToDashboard: !editingAppointment.addToDashboard,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={saveAppointmentEdit}
                              disabled={!editingAppointment.date || !editingAppointment.type.trim() || isSaving}
                              className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEditingAppointment}
                              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-slate-100 font-medium">{appointment.type}</h4>
                              {appointment.addToDashboard && <OnCalendarChip isLight={isLight} />}
                            </div>
                            <p className="text-sm text-slate-400">
                              {formatLocalDate(appointment.date)} {appointment.time && `at ${appointment.time}`}
                            </p>
                            {appointment.veterinarian && (
                              <p className="text-sm text-slate-400">Veterinarian: {appointment.veterinarian}</p>
                            )}
                            {appointment.notes && (
                              <p className="text-sm text-slate-400 mt-1">Notes: {appointment.notes}</p>
                            )}
                          </div>
                          <div className="flex gap-1.5 ml-4">
                            <AttachmentButton
                              count={(appointment.attachments || []).length}
                              onClick={() => setAttachmentModal({ kind: 'appointment', id: appointment.id })}
                            />
                            <button
                              onClick={() => startEditingAppointment(appointment)}
                              className={rowIconEmeraldClass}
                              title="Edit appointment"
                              aria-label="Edit appointment"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => requestDeleteEntry('appointment history record', () => deleteAppointment(appointment.id))}
                              className={rowIconDangerClass}
                              title="Delete appointment"
                              aria-label="Delete appointment"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
              </>
            );
          })()}
        </div>
      )}

      {/* Documents Section */}
      {activeSection === 'documents' && (
        <div className="space-y-6">
          {addingSection !== 'documents' ? (
            <div className="flex justify-start">
              <button type="button" onClick={() => setAddingSection('documents')} className={primaryButtonClass}>
                + Add Document
              </button>
            </div>
          ) : (
          <div className={cardClass}>
            <div className="flex items-start justify-between gap-4">
              <h3 className={sectionTitleClass}>Add Document</h3>
              <AttachmentButton
                count={pendingDocumentAttachments.length}
                onClick={() => setAttachmentModal({ kind: 'document', id: 'add' })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Document Name</label>
                <input
                  type="text"
                  value={newDocument.name}
                  onChange={(e) => setNewDocument({ ...newDocument, name: e.target.value })}
                  placeholder="e.g., Vaccination Record, Medical Report"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Date</label>
                <input
                  type="date"
                  value={newDocument.date}
                  onChange={(e) => setNewDocument({ ...newDocument, date: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Description</label>
                <textarea
                  value={newDocument.description}
                  onChange={(e) => setNewDocument({ ...newDocument, description: e.target.value })}
                  placeholder="Describe the document"
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={addDocument}
                className={primaryButtonClass}
              >
                Add Document
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingSection(null);
                  setNewDocument({ name: '', date: '', description: '' });
                  revokePending(pendingDocumentAttachments);
                  setPendingDocumentAttachments([]);
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
          )}

          <div className={cardClass}>
            <label className={labelClass}>Search Documents</label>
            <input
              type="text"
              value={documentSearch}
              onChange={(e) => setDocumentSearch(e.target.value)}
              placeholder="Search by name..."
              className={inputClass}
            />
          </div>

          {filteredDocuments.length > 0 && (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Documents</h3>
              <div className="space-y-3">
                {filteredDocuments
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(document => (
                    <div key={document.id} className={nestedCardClass}>
                      {editingDocumentId === document.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">Document Name</label>
                              <input
                                type="text"
                                value={editingDocument.name}
                                onChange={(e) => setEditingDocument({ ...editingDocument, name: e.target.value })}
                                placeholder="e.g., Vaccination Record, Medical Report"
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">Date</label>
                              <input
                                type="date"
                                value={editingDocument.date}
                                onChange={(e) => setEditingDocument({ ...editingDocument, date: e.target.value })}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">Description</label>
                              <textarea
                                value={editingDocument.description}
                                onChange={(e) => setEditingDocument({ ...editingDocument, description: e.target.value })}
                                placeholder="Describe the document"
                                rows={3}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 items-center">
                            <AttachmentButton
                              count={(document.attachments || []).length}
                              onClick={() => setAttachmentModal({ kind: 'document', id: document.id })}
                            />
                            <button
                              onClick={saveDocumentEdit}
                              disabled={!editingDocument.name.trim() || !editingDocument.date || isSaving}
                              className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEditingDocument}
                              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-slate-100 font-medium">{document.name}</h4>
                            <p className="text-sm text-slate-400">Date: {formatLocalDate(document.date)}</p>
                            {document.description && (
                              <p className="text-sm text-slate-400 mt-1">Description: {document.description}</p>
                            )}
                          </div>
                          <div className="flex gap-1.5 ml-4">
                            <AttachmentButton
                              count={(document.attachments || []).length}
                              onClick={() => setAttachmentModal({ kind: 'document', id: document.id })}
                            />
                            <button
                              onClick={() => startEditingDocument(document)}
                              className={rowIconEmeraldClass}
                              title="Edit document"
                              aria-label="Edit document"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => requestDeleteEntry('document', () => deleteItem(documents, setDocuments, document.id))}
                              className={rowIconDangerClass}
                              title="Delete document"
                              aria-label="Delete document"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notes Section */}
      {activeSection === 'notes' && (
        <div className="space-y-6">
          {addingSection !== 'notes' ? (
            <div className="flex justify-start">
              <button type="button" onClick={() => setAddingSection('notes')} className={primaryButtonClass}>
                + Add Note
              </button>
            </div>
          ) : (
          <div className={cardClass}>
            <h3 className={sectionTitleClass}>Add Note</h3>
            <textarea
              value={currentNote}
              onChange={(e) => setCurrentNote(e.target.value)}
              placeholder="Enter a note about your pet..."
              rows={4}
              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={addNote}
                className={primaryButtonClass}
              >
                Add Note
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingSection(null);
                  setCurrentNote('');
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
          )}

          {notes.filter(n => n.isCurrent).length > 0 && (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Current Notes</h3>
              <div className="space-y-3">
                {notes
                  .filter(n => n.isCurrent)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(note => (
                    <div key={note.id} className={nestedCardClass}>
                      {editingNoteId === note.id ? (
                        <div className="space-y-4">
                          <textarea
                            value={editingNote.content}
                            onChange={(e) => setEditingNote({ content: e.target.value })}
                            placeholder="Enter a note about your pet..."
                            rows={4}
                            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={saveNoteEdit}
                              disabled={!editingNote.content.trim() || isSaving}
                              className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEditingNote}
                              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-slate-100 whitespace-pre-wrap">{note.content}</p>
                            <p className="text-sm text-slate-400 mt-2">Date: {formatLocalDate(note.date)}</p>
                          </div>
                          <div className="flex gap-1.5 ml-4">
                            <button
                              onClick={() => startEditingNote(note)}
                              className={rowIconEmeraldClass}
                              title="Edit note"
                              aria-label="Edit note"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => archiveNote(note.id)}
                              className={rowIconSecondaryClass}
                              title="Move to history"
                              aria-label="Move to history"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                            </button>
                            <button
                              onClick={() => requestDeleteEntry('current note', () => deleteItem(notes, setNotes, note.id))}
                              className={rowIconDangerClass}
                              title="Delete note"
                              aria-label="Delete note"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {notes.filter(n => !n.isCurrent).length > 0 && (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Note History</h3>
              <div className="space-y-3">
                {notes
                  .filter(n => !n.isCurrent)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(note => (
                    <div key={note.id} className={nestedCardClass}>
                      {editingNoteId === note.id ? (
                        <div className="space-y-4">
                          <textarea
                            value={editingNote.content}
                            onChange={(e) => setEditingNote({ content: e.target.value })}
                            placeholder="Enter a note about your pet..."
                            rows={4}
                            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={saveNoteEdit}
                              disabled={!editingNote.content.trim() || isSaving}
                              className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEditingNote}
                              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-slate-100 whitespace-pre-wrap">{note.content}</p>
                            <p className="text-sm text-slate-400 mt-2">Date: {formatLocalDate(note.date)}</p>
                          </div>
                          <div className="flex gap-1.5 ml-4">
                            <button
                              onClick={() => startEditingNote(note)}
                              className={rowIconEmeraldClass}
                              title="Edit note"
                              aria-label="Edit note"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => reactivateNote(note.id)}
                              className={rowIconSecondaryClass}
                              title="Return to active"
                              aria-label="Return note to active"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                              </svg>
                            </button>
                            <button
                              onClick={() => requestDeleteEntry('note history record', () => deleteItem(notes, setNotes, note.id))}
                              className={rowIconDangerClass}
                              title="Delete note"
                              aria-label="Delete note"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export Section */}
      {activeSection === 'export' && (
        <div className="space-y-6">
          <div className={cardClass}>
            <h3 className={sectionTitleClass}>Export Pet Report</h3>
            <p className="text-slate-300 mb-4">
              Generate a comprehensive PDF report of all your pet's information. The report will include all sections: Pet Info, Food, Veterinary Contacts, Care Plan, Vaccinations, Appointments, Documents, and Notes.
            </p>
            <button
              onClick={() => setShowExportPopup(true)}
              className={isLight ? 'px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors' : 'px-6 py-3 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors'}
            >
              Generate PDF Report
            </button>
          </div>
        </div>
      )}

      {/* Export Popup */}
      {showExportPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={modalCardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>Export Options</h3>
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
                <label htmlFor="includeHistory" className={isLight ? 'text-slate-700 cursor-pointer' : 'text-slate-300 cursor-pointer'}>
                  Include history items (archived food, veterinary contacts, care plan items, and notes)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={exportToPDF}
                  className={isLight ? 'flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors' : 'flex-1 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors'}
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
        </>
      )}

      <AttachmentModal
        open={attachmentModal !== null}
        onClose={closeAttachmentModal}
        previewItem={viewPreview}
        title={modalTitle}
        files={modalFiles}
        busy={attachmentBusy}
        onAdd={(incoming) => {
          if (!attachmentModal) return;
          if (attachmentModal.id === 'add') {
            setPendingForKind(attachmentModal.kind, [
              ...pendingForKind(attachmentModal.kind),
              ...incoming.map(createPendingAttachment),
            ]);
            return;
          }
          void addSavedFiles(attachmentModal.kind, attachmentModal.id, incoming);
        }}
        onRemove={(id) => {
          if (!attachmentModal) return;
          if (attachmentModal.id === 'add') {
            const prev = pendingForKind(attachmentModal.kind);
            const next = prev.filter((item) => item.id !== id);
            const removed = prev.find((item) => item.id === id);
            if (removed?.url) URL.revokeObjectURL(removed.url);
            setPendingForKind(attachmentModal.kind, next);
            return;
          }
          void removeSavedFile(id);
        }}
        onView={handleViewAttachment}
        onDownload={attachmentModal?.id === 'add' ? undefined : handleDownloadAttachment}
      />
    </div>
  );
}
