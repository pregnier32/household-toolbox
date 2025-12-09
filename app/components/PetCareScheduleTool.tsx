'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
  addToDashboard: boolean;
  priority: 'low' | 'medium' | 'high';
};

type Vaccination = {
  id: string;
  name: string;
  date: string;
  veterinarian: string;
  notes: string;
};

type Appointment = {
  id: string;
  date: string;
  time: string;
  type: string;
  veterinarian: string;
  notes: string;
  isUpcoming: boolean;
  addToDashboard: boolean;
};

type Document = {
  id: string;
  name: string;
  date: string;
  description: string;
  file: File | null;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null;
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

type Pet = {
  id: string;
  name: string;
  pet_type: string | null;
  custom_pet_type: string | null;
  card_color: string | null;
};

type PetCareScheduleToolProps = {
  toolId?: string;
};

export function PetCareScheduleTool({ toolId }: PetCareScheduleToolProps) {
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
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastSavedData, setLastSavedData] = useState<string>('');
  
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
  const [newCareItem, setNewCareItem] = useState({ name: '', frequency: 'Daily', notes: '', addToDashboard: true, priority: 'medium' as 'low' | 'medium' | 'high' });
  const [editingCareItemId, setEditingCareItemId] = useState<string | null>(null);
  const [editingCareItem, setEditingCareItem] = useState({ name: '', frequency: 'Daily', notes: '', addToDashboard: true, priority: 'medium' as 'low' | 'medium' | 'high' });
  
  // Vaccinations
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [newVaccination, setNewVaccination] = useState({ name: '', date: '', veterinarian: '', notes: '' });
  const [editingVaccinationId, setEditingVaccinationId] = useState<string | null>(null);
  const [editingVaccination, setEditingVaccination] = useState({ name: '', date: '', veterinarian: '', notes: '' });
  
  // Appointments
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [newAppointment, setNewAppointment] = useState({ date: '', time: '', type: '', veterinarian: '', notes: '', addToDashboard: true });
  
  // Documents
  const [documents, setDocuments] = useState<Document[]>([]);
  const [newDocument, setNewDocument] = useState({ name: '', date: '', description: '', file: null as File | null });
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState({ name: '', date: '', description: '', file: null as File | null });
  
  // Notes
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState({ content: '' });
  const [activeSection, setActiveSection] = useState<string>('info');
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
        addToDashboard: c.addToDashboard !== undefined ? c.addToDashboard : true,
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
        addToDashboard: a.addToDashboard !== undefined ? a.addToDashboard : true,
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      documents: documents.map(d => {
        const doc: any = {
          name: d.name.trim(),
          date: d.date,
          description: (d.description || '').trim(),
          file_url: d.file_url || null,
          file_name: d.file_name || (d.file ? d.file.name : null),
          file_size: d.file_size || (d.file ? d.file.size : null),
          file_type: d.file_type || (d.file ? d.file.type : null),
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
            addToDashboard: c.add_to_dashboard !== undefined ? c.add_to_dashboard : true,
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
        })));
        
        setAppointments((pet.appointments || []).map((a: any) => ({
          id: a.id,
          date: a.date,
          time: a.time || '',
          type: a.type,
          veterinarian: a.veterinarian || '',
          notes: a.notes || '',
          isUpcoming: a.is_upcoming,
          addToDashboard: a.add_to_dashboard !== undefined ? a.add_to_dashboard : true,
        })));
        
        setDocuments((pet.documents || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          date: d.date,
          description: d.description || '',
          file: null, // Files would need separate handling
          file_url: d.file_url || null,
          file_name: d.file_name || null,
          file_size: d.file_size || null,
          file_type: d.file_type || null,
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
              addToDashboard: c.addToDashboard !== undefined ? c.addToDashboard : true,
              priority: (c.priority && ['low', 'medium', 'high'].includes(c.priority)) ? c.priority : 'medium',
            };
          }),
          vaccinations: vaccinationsToUse.map(v => ({
            name: v.name,
            date: v.date,
            veterinarian: v.veterinarian,
            notes: v.notes || '',
          })),
          appointments: appointments.map(a => ({
            date: a.date,
            time: a.time,
            type: a.type,
            veterinarian: a.veterinarian,
            notes: a.notes || '',
            isUpcoming: a.isUpcoming,
            addToDashboard: a.addToDashboard !== undefined ? a.addToDashboard : true,
          })),
          documents: documents.map(d => {
            const doc: any = {
              name: d.name,
              date: d.date,
              description: d.description,
              file_url: d.file_url || null,
              file_name: d.file_name || (d.file ? d.file.name : null),
              file_size: d.file_size || (d.file ? d.file.size : null),
              file_type: d.file_type || (d.file ? d.file.type : null),
            };
            return doc;
          }),
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
            addToDashboard: c.add_to_dashboard !== undefined ? c.add_to_dashboard : true,
          })),
          vaccinations: (currentPet.vaccinations || []).map((v: any) => ({
            name: v.name,
            date: v.date,
            veterinarian: v.veterinarian || '',
            notes: v.notes || '',
          })),
          appointments: (currentPet.appointments || []).map((a: any) => ({
            date: a.date,
            time: a.time || '',
            type: a.type,
            veterinarian: a.veterinarian || '',
            notes: a.notes || '',
            isUpcoming: a.is_upcoming,
            addToDashboard: a.add_to_dashboard !== undefined ? a.add_to_dashboard : true,
          })),
          documents: (currentPet.documents || []).map((d: any) => ({
            name: d.name,
            date: d.date,
            description: d.description || '',
            file_url: d.file_url || null,
            file_name: d.file_name || null,
            file_size: d.file_size || null,
            file_type: d.file_type || null,
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
            addToDashboard: c.add_to_dashboard !== undefined ? c.add_to_dashboard : true,
          })),
          vaccinations: (currentPet.vaccinations || []).map((v: any) => ({
            name: v.name,
            date: v.date,
            veterinarian: v.veterinarian || '',
            notes: v.notes || '',
          })),
          appointments: (currentPet.appointments || []).map((a: any) => ({
            date: a.date,
            time: a.time || '',
            type: a.type,
            veterinarian: a.veterinarian || '',
            notes: a.notes || '',
            isUpcoming: a.is_upcoming,
            addToDashboard: a.add_to_dashboard !== undefined ? a.add_to_dashboard : true,
          })),
          documents: (currentPet.documents || []).map((d: any) => ({
            name: d.name,
            date: d.date,
            description: d.description || '',
            file_url: d.file_url || null,
            file_name: d.file_name || null,
            file_size: d.file_size || null,
            file_type: d.file_type || null,
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
    setCurrentFood({ name: '', rating: null });
    setVeterinaryRecords([]);
    setCarePlanItems([]);
    setVaccinations([]);
    setAppointments([]);
    setDocuments([]);
    setNotes([]);
    setCurrentNote('');
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
        startDate: new Date().toISOString().split('T')[0],
        endDate: null,
        isCurrent: true,
        notes: currentFood.notes || ''
      };
      // Mark all other foods as not current
      setFoods(prev => prev.map(f => ({ ...f, isCurrent: false })));
      setFoods(prev => [...prev, newFood]);
      setCurrentFood({ name: '', rating: null, notes: '' });
      // Save to database immediately
      setTimeout(() => savePetData(), 100);
    }
  };

  const moveFoodToHistory = (foodId: string) => {
    setFoods(prev => prev.map(f => 
      f.id === foodId 
        ? { ...f, isCurrent: false, endDate: new Date().toISOString().split('T')[0] }
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
        startDate: new Date().toISOString().split('T')[0],
        endDate: null,
        notes: newCareItem.notes || '',
        addToDashboard: newCareItem.addToDashboard !== undefined ? newCareItem.addToDashboard : true,
        priority: newCareItem.priority || 'medium'
      };
      setCarePlanItems(prev => [...prev, newItem]);
      setNewCareItem({ name: '', frequency: 'Daily', notes: '', addToDashboard: true, priority: 'medium' });
      // Save to database immediately
      setTimeout(() => savePetData(), 100);
    }
  };

  const toggleCarePlanItem = (itemId: string) => {
    setCarePlanItems(prev => prev.map(item => 
      item.id === itemId 
        ? { 
            ...item, 
            isActive: !item.isActive,
            endDate: item.isActive ? new Date().toISOString().split('T')[0] : null
          }
        : item
    ));
    // Save to database immediately
    setTimeout(() => savePetData(), 100);
  };

  const startEditingCareItem = (item: CarePlanItem) => {
    console.log(`Starting to edit care plan item: ${item.name}, current notes: "${item.notes}"`);
    setEditingCareItemId(item.id);
    setEditingCareItem({ 
      name: item.name, 
      frequency: item.frequency, 
      notes: item.notes || '',
      addToDashboard: item.addToDashboard !== undefined ? item.addToDashboard : true,
      priority: item.priority || 'medium'
    });
  };

  const cancelEditingCareItem = () => {
    setEditingCareItemId(null);
    setEditingCareItem({ name: '', frequency: 'Daily', notes: '', addToDashboard: true, priority: 'medium' });
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
            addToDashboard: editingCareItem.addToDashboard !== undefined ? editingCareItem.addToDashboard : true,
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
    setEditingCareItem({ name: '', frequency: 'Daily', notes: '', addToDashboard: true });
    
    // Save to database using the updated items (after state update)
    setTimeout(() => {
      console.log(`Saving with updated items, care plan item notes: ${updatedItem?.notes}`);
      savePetData(updatedItems);
    }, 100);
  };

  const addVaccination = async () => {
    if (newVaccination.name.trim() && newVaccination.date) {
      const vaccination: Vaccination = {
        id: Date.now().toString(),
        ...newVaccination
      };
      setVaccinations(prev => [...prev, vaccination]);
      setNewVaccination({ name: '', date: '', veterinarian: '', notes: '' });
      // Save to database immediately
      setTimeout(() => savePetData(), 100);
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
    if (newAppointment.date && newAppointment.type.trim()) {
      const appointment: Appointment = {
        id: Date.now().toString(),
        ...newAppointment,
        isUpcoming: new Date(newAppointment.date) >= new Date(),
        addToDashboard: newAppointment.addToDashboard !== undefined ? newAppointment.addToDashboard : true
      };
      setAppointments(prev => [...prev, appointment]);
      setNewAppointment({ date: '', time: '', type: '', veterinarian: '', notes: '', addToDashboard: true });
      // Save to database immediately
      setTimeout(() => savePetData(), 100);
    }
  };

  const addVeterinaryRecord = async () => {
    if (newVetRecord.veterinarianName.trim() || newVetRecord.clinicName.trim()) {
      const record: VeterinaryRecord = {
        id: Date.now().toString(),
        ...newVetRecord,
        dateAdded: new Date().toISOString().split('T')[0],
        notes: newVetRecord.notes || ''
      };
      setVeterinaryRecords(prev => [...prev, record]);
      setNewVetRecord({
        veterinarianName: '',
        clinicName: '',
        phone: '',
        email: '',
        address: '',
        status: 'Active',
        notes: ''
      });
      // Save to database immediately
      setTimeout(() => savePetData(), 100);
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
        id: Date.now().toString(),
        ...newDocument
      };
      setDocuments(prev => [...prev, document]);
      setNewDocument({ name: '', date: '', description: '', file: null });
      // Save to database immediately
      setTimeout(() => savePetData(), 100);
    }
  };

  const startEditingDocument = (document: Document) => {
    setEditingDocumentId(document.id);
    setEditingDocument({
      name: document.name,
      date: document.date,
      description: document.description || '',
      file: null // File editing is not allowed
    });
  };

  const cancelEditingDocument = () => {
    setEditingDocumentId(null);
    setEditingDocument({ name: '', date: '', description: '', file: null });
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
    setEditingDocument({ name: '', date: '', description: '', file: null });
    
    // Save to database immediately using the updated items
    setTimeout(() => {
      console.log(`Saving with updated documents`);
      savePetData(undefined, undefined, undefined, undefined, undefined, updatedDocuments);
    }, 100);
  };

  const handleDocumentClick = (doc: Document) => {
    if (doc.file_url) {
      // Open the file URL in a new tab
      window.open(doc.file_url, '_blank');
    } else if (doc.file) {
      // Create a blob URL for the file and download it
      const url = URL.createObjectURL(doc.file);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name || doc.file.name || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const addNote = async () => {
    if (currentNote.trim()) {
      const note: Note = {
        id: Date.now().toString(),
        content: currentNote,
        date: new Date().toISOString().split('T')[0],
        isCurrent: true
      };
      setNotes(prev => [...prev, note]);
      setCurrentNote('');
      // Save to database immediately
      setTimeout(() => savePetData(), 100);
    }
  };

  const archiveNote = (noteId: string) => {
    setNotes(prev => prev.map(n => 
      n.id === noteId ? { ...n, isCurrent: false } : n
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
        if (doc.file_name) {
          addText(`File: ${doc.file_name}`, 9, false, 10);
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
                : 'text-slate-600 hover:text-slate-400'
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-50 mb-2">Pet Care Schedule</h2>
          <p className="text-slate-400 text-sm">
            Manage all aspects of your pet's care, from basic information to veterinary records.
          </p>
        </div>
        {selectedPetId && (
          <div className="flex items-center gap-3">
            <button
              onClick={savePetData}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            >
              {isSaving ? 'Saving...' : 'Save All'}
            </button>
          </div>
        )}
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
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <label className="block text-sm font-medium text-slate-300 mb-3">
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
                    <button
                      onClick={savePetEdit}
                      disabled={isSaving || !editingPetName.trim()}
                      className="flex-1 px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditingPet}
                      className="px-2 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600 transition-colors"
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
                      className="flex-1 px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingPetId(null);
                        setShowColorPicker(false);
                      }}
                      className="px-2 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600 transition-colors"
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
                  </button>
                  {/* Ellipsis Menu Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenPetId(menuOpenPetId === pet.id ? null : pet.id);
                    }}
                    className="absolute top-1 right-1 p-1 rounded hover:bg-slate-700/50 transition-colors"
                    title="Pet options"
                  >
                    <svg className="h-4 w-4 text-slate-400 hover:text-slate-200" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>
                  {/* Menu Popup */}
                  {menuOpenPetId === pet.id && (
                    <div className="absolute top-10 right-0 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-lg min-w-[160px] py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChangeColor(pet);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        Change Color
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenPetId(null);
                          setDeleteConfirmPetId(pet.id);
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
            ))}
            
            {/* Add New Pet Button */}
            <button
              onClick={() => {
                setIsCreatingNewPet(true);
                setSelectedPetId(null);
                setEditingPetId(null);
              }}
              className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all duration-200 flex items-center justify-center min-w-[60px]"
              title="Add New Pet"
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
                New Pet Name
              </label>
              <input
                type="text"
                value={newPetName}
                onChange={(e) => setNewPetName(e.target.value)}
                placeholder="Enter pet name"
                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
            <button
              onClick={createNewPet}
              disabled={!newPetName.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreatingNewPet(false);
                setNewPetName('');
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
          <p className="text-slate-400">Loading pets...</p>
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete Pet</h3>
            <p className="text-slate-300 mb-4">
              <strong className="text-red-400">Warning:</strong> This action cannot be undone. All entered history for this pet will be permanently deleted and cannot be retrieved.
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
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !selectedPetId && !isCreatingNewPet && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-slate-400 mb-4">Please select a pet or create a new one to get started.</p>
        </div>
      )}

      {selectedPetId && (
        <>

          {/* Navigation Tabs */}
          <div className="border-b border-slate-800">
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
                    activeSection === tab.id
                      ? 'border-b-2 border-emerald-500 text-emerald-300'
                      : 'text-slate-400 hover:text-slate-300'
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">Basic Information</h3>
              {selectedPet && (
                <span className="text-sm text-slate-400">
                  Editing: <span className="text-emerald-400 font-medium">{selectedPet.name}</span>
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Pet Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  placeholder="Enter pet's name"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Pet Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={petType?.name || ''}
                  onChange={(e) => handlePetTypeChange(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                    className="w-full mt-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Birthdate</label>
                <input
                  type="date"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Breed</label>
                <input
                  type="text"
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  placeholder="Enter breed"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Where did you get your pet?</label>
                <input
                  type="text"
                  value={whereGotPet}
                  onChange={(e) => setWhereGotPet(e.target.value)}
                  placeholder="e.g., Animal shelter, breeder, pet store"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Weight</label>
                <input
                  type="text"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g., 25 lbs or 11 kg"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Color/Markings</label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Enter color or markings"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Microchip Number</label>
                <input
                  type="text"
                  value={microchipNumber}
                  onChange={(e) => setMicrochipNumber(e.target.value)}
                  placeholder="Enter microchip number"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
            </div>
            
            {/* Save Button for Pet Info */}
            <div className="flex justify-start mt-6">
              <button
                onClick={savePetData}
                disabled={isSaving}
                className="px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-500 text-slate-950 hover:bg-emerald-400"
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
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                />
              </div>
              <button
                onClick={addCurrentFood}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors"
              >
                Add Current Food
              </button>
            </div>
          </div>

          {foods.filter(f => f.isCurrent).length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Active Foods</h3>
              <div className="space-y-4">
                {foods.filter(f => f.isCurrent).map(food => (
                  <div key={food.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
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
                            className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
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
                          <p className="text-sm text-slate-400">Started: {new Date(food.startDate).toLocaleDateString()}</p>
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
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditingFood(food)}
                            className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => moveFoodToHistory(food.id)}
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

          {foods.filter(f => !f.isCurrent).length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Food History</h3>
              <div className="space-y-4">
                {foods.filter(f => !f.isCurrent).map(food => (
                  <div key={food.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
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
                            className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
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
                            {new Date(food.startDate).toLocaleDateString()} - {food.endDate ? new Date(food.endDate).toLocaleDateString() : 'Present'}
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
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditingFood(food)}
                            className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteItem(foods, setFoods, food.id)}
                            className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                          >
                            Delete
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Add Veterinary Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Veterinarian Name</label>
                <input
                  type="text"
                  value={newVetRecord.veterinarianName}
                  onChange={(e) => setNewVetRecord({ ...newVetRecord, veterinarianName: e.target.value })}
                  placeholder="Dr. Smith"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Clinic Name</label>
                <input
                  type="text"
                  value={newVetRecord.clinicName}
                  onChange={(e) => setNewVetRecord({ ...newVetRecord, clinicName: e.target.value })}
                  placeholder="Animal Hospital"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                <input
                  type="tel"
                  value={newVetRecord.phone}
                  onChange={(e) => setNewVetRecord({ ...newVetRecord, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={newVetRecord.email}
                  onChange={(e) => setNewVetRecord({ ...newVetRecord, email: e.target.value })}
                  placeholder="vet@example.com"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Address</label>
                <input
                  type="text"
                  value={newVetRecord.address}
                  onChange={(e) => setNewVetRecord({ ...newVetRecord, address: e.target.value })}
                  placeholder="123 Main St, City, State ZIP"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                <select
                  value={newVetRecord.status}
                  onChange={(e) => setNewVetRecord({ ...newVetRecord, status: e.target.value as 'Active' | 'History' })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                >
                  <option value="Active">Active</option>
                  <option value="History">History</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes (Optional)</label>
                <textarea
                  value={newVetRecord.notes}
                  onChange={(e) => setNewVetRecord({ ...newVetRecord, notes: e.target.value })}
                  placeholder="Add any additional notes about this veterinary contact..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                />
              </div>
            </div>
            <button
              onClick={addVeterinaryRecord}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors"
            >
              Add Veterinary Contact
            </button>
          </div>

          {veterinaryRecords.filter(r => r.status === 'Active').length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Active Veterinary Contacts</h3>
              <div className="space-y-4">
                {veterinaryRecords
                  .filter(r => r.status === 'Active')
                  .map(record => (
                    <div key={record.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
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
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Clinic Name</label>
                              <input
                                type="text"
                                value={editingVetRecord.clinicName}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, clinicName: e.target.value })}
                                placeholder="Animal Hospital"
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                              <input
                                type="tel"
                                value={editingVetRecord.phone}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, phone: e.target.value })}
                                placeholder="(555) 123-4567"
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                              <input
                                type="email"
                                value={editingVetRecord.email}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, email: e.target.value })}
                                placeholder="vet@example.com"
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-slate-300 mb-2">Address</label>
                              <input
                                type="text"
                                value={editingVetRecord.address}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, address: e.target.value })}
                                placeholder="123 Main St, City, State ZIP"
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
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
                              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
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
                            <p className="text-xs text-slate-500 mt-2">Added: {new Date(record.dateAdded).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => startEditingVetRecord(record)}
                              className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggleVetRecordStatus(record.id)}
                              className="px-3 py-1 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors text-sm"
                            >
                              Move to History
                            </button>
                            <button
                              onClick={() => deleteItem(veterinaryRecords, setVeterinaryRecords, record.id)}
                              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                            >
                              Delete
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
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Veterinary Contact History</h3>
              <div className="space-y-4">
                {veterinaryRecords
                  .filter(r => r.status === 'History')
                  .map(record => (
                    <div key={record.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
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
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Clinic Name</label>
                              <input
                                type="text"
                                value={editingVetRecord.clinicName}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, clinicName: e.target.value })}
                                placeholder="Animal Hospital"
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                              <input
                                type="tel"
                                value={editingVetRecord.phone}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, phone: e.target.value })}
                                placeholder="(555) 123-4567"
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                              <input
                                type="email"
                                value={editingVetRecord.email}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, email: e.target.value })}
                                placeholder="vet@example.com"
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-slate-300 mb-2">Address</label>
                              <input
                                type="text"
                                value={editingVetRecord.address}
                                onChange={(e) => setEditingVetRecord({ ...editingVetRecord, address: e.target.value })}
                                placeholder="123 Main St, City, State ZIP"
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
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
                              <span className="inline-flex items-center rounded-full bg-slate-500/20 px-2 py-0.5 text-xs font-medium text-slate-400">
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
                            <p className="text-xs text-slate-500 mt-2">Added: {new Date(record.dateAdded).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => startEditingVetRecord(record)}
                              className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggleVetRecordStatus(record.id)}
                              className="px-3 py-1 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors text-sm"
                            >
                              Move to Active
                            </button>
                            <button
                              onClick={() => deleteItem(veterinaryRecords, setVeterinaryRecords, record.id)}
                              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                            >
                              Delete
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Add Care Plan Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Care Item Name</label>
                <input
                  type="text"
                  value={newCareItem.name}
                  onChange={(e) => setNewCareItem({ ...newCareItem, name: e.target.value })}
                  placeholder="e.g., Nail trimming, Grooming, Exercise"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Frequency</label>
                <select
                  value={newCareItem.frequency}
                  onChange={(e) => setNewCareItem({ ...newCareItem, frequency: e.target.value })}
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
                  value={newCareItem.priority}
                  onChange={(e) => setNewCareItem({ ...newCareItem, priority: e.target.value as 'low' | 'medium' | 'high' })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Notes (Optional)</label>
              <textarea
                value={newCareItem.notes}
                onChange={(e) => setNewCareItem({ ...newCareItem, notes: e.target.value })}
                placeholder="Add any additional notes about this care item..."
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
              />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="addToDashboard"
                checked={newCareItem.addToDashboard}
                onChange={(e) => setNewCareItem({ ...newCareItem, addToDashboard: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
              />
              <label htmlFor="addToDashboard" className="text-sm text-slate-300 cursor-pointer">
                Add to Dashboard Action Items
              </label>
            </div>
            <button
              onClick={addCarePlanItem}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors"
            >
              Add Care Item
            </button>
          </div>

          {carePlanItems.filter(item => item.isActive).length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Active Care Plan</h3>
              <div className="space-y-3">
                {carePlanItems.filter(item => item.isActive).map(item => (
                  <div key={item.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
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
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                            className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`editAddToDashboard-${item.id}`}
                            checked={editingCareItem.addToDashboard}
                            onChange={(e) => setEditingCareItem({ ...editingCareItem, addToDashboard: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                          />
                          <label htmlFor={`editAddToDashboard-${item.id}`} className="text-sm text-slate-300 cursor-pointer">
                            Add to Dashboard Action Items
                          </label>
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
                              <p className="text-sm text-slate-200">{new Date(item.startDate).toLocaleDateString()}</p>
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
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => startEditingCareItem(item)}
                            className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleCarePlanItem(item.id)}
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

          {carePlanItems.filter(item => !item.isActive).length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Care Plan History</h3>
              <div className="space-y-3">
                {carePlanItems.filter(item => !item.isActive).map(item => (
                  <div key={item.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
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
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                            className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`editAddToDashboard-${item.id}`}
                            checked={editingCareItem.addToDashboard}
                            onChange={(e) => setEditingCareItem({ ...editingCareItem, addToDashboard: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                          />
                          <label htmlFor={`editAddToDashboard-${item.id}`} className="text-sm text-slate-300 cursor-pointer">
                            Add to Dashboard Action Items
                          </label>
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
                                {new Date(item.startDate).toLocaleDateString()} - {item.endDate ? new Date(item.endDate).toLocaleDateString() : 'Present'}
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
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => startEditingCareItem(item)}
                            className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteItem(carePlanItems, setCarePlanItems, item.id)}
                            className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                          >
                            Delete
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Add Vaccination</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Vaccination Name</label>
                <input
                  type="text"
                  value={newVaccination.name}
                  onChange={(e) => setNewVaccination({ ...newVaccination, name: e.target.value })}
                  placeholder="e.g., Rabies, DHPP, FVRCP"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                <input
                  type="text"
                  value={newVaccination.notes}
                  onChange={(e) => setNewVaccination({ ...newVaccination, notes: e.target.value })}
                  placeholder="Additional notes"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
            </div>
            <button
              onClick={addVaccination}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors"
            >
              Add Vaccination
            </button>
          </div>

          {vaccinations.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Vaccination History</h3>
              <div className="space-y-3">
                {vaccinations
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(vaccination => (
                    <div key={vaccination.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
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
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                              <input
                                type="text"
                                value={editingVaccination.notes}
                                onChange={(e) => setEditingVaccination({ ...editingVaccination, notes: e.target.value })}
                                placeholder="Additional notes"
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                            <p className="text-sm text-slate-400">Date: {new Date(vaccination.date).toLocaleDateString()}</p>
                            {vaccination.veterinarian && (
                              <p className="text-sm text-slate-400">Veterinarian: {vaccination.veterinarian}</p>
                            )}
                            {vaccination.notes && (
                              <p className="text-sm text-slate-400 mt-1">Notes: {vaccination.notes}</p>
                            )}
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => startEditingVaccination(vaccination)}
                              className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteItem(vaccinations, setVaccinations, vaccination.id)}
                              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                            >
                              Delete
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Add Appointment</h3>
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
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Veterinarian</label>
                <input
                  type="text"
                  value={newAppointment.veterinarian}
                  onChange={(e) => setNewAppointment({ ...newAppointment, veterinarian: e.target.value })}
                  placeholder="Veterinarian name"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                <textarea
                  value={newAppointment.notes}
                  onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                  placeholder="Additional notes about the appointment"
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="addAppointmentToDashboard"
                checked={newAppointment.addToDashboard}
                onChange={(e) => setNewAppointment({ ...newAppointment, addToDashboard: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
              />
              <label htmlFor="addAppointmentToDashboard" className="text-sm text-slate-300 cursor-pointer">
                Add to Dashboard Calendar
              </label>
            </div>
            <button
              onClick={addAppointment}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors"
            >
              Add Appointment
            </button>
          </div>

          {appointments.filter(a => a.isUpcoming).length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Upcoming Appointments</h3>
              <div className="space-y-3">
                {appointments
                  .filter(a => a.isUpcoming)
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map(appointment => (
                    <div key={appointment.id} className="p-4 rounded-lg border border-emerald-500/30 bg-slate-800/50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-slate-100 font-medium">{appointment.type}</h4>
                          <p className="text-sm text-slate-400">
                            {new Date(appointment.date).toLocaleDateString()} {appointment.time && `at ${appointment.time}`}
                          </p>
                          {appointment.veterinarian && (
                            <p className="text-sm text-slate-400">Veterinarian: {appointment.veterinarian}</p>
                          )}
                          {appointment.notes && (
                            <p className="text-sm text-slate-400 mt-1">Notes: {appointment.notes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteItem(appointments, setAppointments, appointment.id)}
                          className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {appointments.filter(a => !a.isUpcoming).length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Appointment History</h3>
              <div className="space-y-3">
                {appointments
                  .filter(a => !a.isUpcoming)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(appointment => (
                    <div key={appointment.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-slate-100 font-medium">{appointment.type}</h4>
                          <p className="text-sm text-slate-400">
                            {new Date(appointment.date).toLocaleDateString()} {appointment.time && `at ${appointment.time}`}
                          </p>
                          {appointment.veterinarian && (
                            <p className="text-sm text-slate-400">Veterinarian: {appointment.veterinarian}</p>
                          )}
                          {appointment.notes && (
                            <p className="text-sm text-slate-400 mt-1">Notes: {appointment.notes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteItem(appointments, setAppointments, appointment.id)}
                          className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Documents Section */}
      {activeSection === 'documents' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Upload Document</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Document Name</label>
                <input
                  type="text"
                  value={newDocument.name}
                  onChange={(e) => setNewDocument({ ...newDocument, name: e.target.value })}
                  placeholder="e.g., Vaccination Record, Medical Report"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                <input
                  type="date"
                  value={newDocument.date}
                  onChange={(e) => setNewDocument({ ...newDocument, date: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={newDocument.description}
                  onChange={(e) => setNewDocument({ ...newDocument, description: e.target.value })}
                  placeholder="Describe the document"
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">File</label>
                <input
                  type="file"
                  onChange={(e) => setNewDocument({ ...newDocument, file: e.target.files?.[0] || null })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-500 file:text-slate-950 hover:file:bg-emerald-400"
                />
              </div>
            </div>
            <button
              onClick={addDocument}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors"
            >
              Add Document
            </button>
          </div>

          {documents.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Documents</h3>
              <div className="space-y-3">
                {documents
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(document => (
                    <div key={document.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
                      {editingDocumentId === document.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Document Name</label>
                              <input
                                type="text"
                                value={editingDocument.name}
                                onChange={(e) => setEditingDocument({ ...editingDocument, name: e.target.value })}
                                placeholder="e.g., Vaccination Record, Medical Report"
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                              <input
                                type="date"
                                value={editingDocument.date}
                                onChange={(e) => setEditingDocument({ ...editingDocument, date: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                              <textarea
                                value={editingDocument.description}
                                onChange={(e) => setEditingDocument({ ...editingDocument, description: e.target.value })}
                                placeholder="Describe the document"
                                rows={3}
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
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
                            <p className="text-sm text-slate-400">Date: {new Date(document.date).toLocaleDateString()}</p>
                            {document.description && (
                              <p className="text-sm text-slate-400 mt-1">Description: {document.description}</p>
                            )}
                            {(document.file || document.file_name) && (
                              <p className="text-sm text-emerald-400 mt-1 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                File: {document.file_name || (document.file ? document.file.name : 'No file')}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2 ml-4">
                            {(document.file_url || document.file) && (
                              <button
                                onClick={() => handleDocumentClick(document)}
                                className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors text-sm flex items-center gap-1"
                                title="Download file"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Download
                              </button>
                            )}
                            <button
                              onClick={() => startEditingDocument(document)}
                              className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteItem(documents, setDocuments, document.id)}
                              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                            >
                              Delete
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Add Note</h3>
            <textarea
              value={currentNote}
              onChange={(e) => setCurrentNote(e.target.value)}
              placeholder="Enter a note about your pet..."
              rows={4}
              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
            <button
              onClick={addNote}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors"
            >
              Add Note
            </button>
          </div>

          {notes.filter(n => n.isCurrent).length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Current Notes</h3>
              <div className="space-y-3">
                {notes
                  .filter(n => n.isCurrent)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(note => (
                    <div key={note.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
                      {editingNoteId === note.id ? (
                        <div className="space-y-4">
                          <textarea
                            value={editingNote.content}
                            onChange={(e) => setEditingNote({ content: e.target.value })}
                            placeholder="Enter a note about your pet..."
                            rows={4}
                            className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
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
                            <p className="text-sm text-slate-400 mt-2">Date: {new Date(note.date).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => startEditingNote(note)}
                              className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => archiveNote(note.id)}
                              className="px-3 py-1 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors text-sm"
                            >
                              Archive
                            </button>
                            <button
                              onClick={() => deleteItem(notes, setNotes, note.id)}
                              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                            >
                              Delete
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
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Note History</h3>
              <div className="space-y-3">
                {notes
                  .filter(n => !n.isCurrent)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(note => (
                    <div key={note.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
                      {editingNoteId === note.id ? (
                        <div className="space-y-4">
                          <textarea
                            value={editingNote.content}
                            onChange={(e) => setEditingNote({ content: e.target.value })}
                            placeholder="Enter a note about your pet..."
                            rows={4}
                            className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
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
                            <p className="text-sm text-slate-400 mt-2">Date: {new Date(note.date).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => startEditingNote(note)}
                              className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteItem(notes, setNotes, note.id)}
                              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                            >
                              Delete
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Export Pet Report</h3>
            <p className="text-slate-300 mb-4">
              Generate a comprehensive PDF report of all your pet's information. The report will include all sections: Pet Info, Food, Veterinary Contacts, Care Plan, Vaccinations, Appointments, Documents, and Notes.
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
                  Include history items (archived food, veterinary contacts, care plan items, and notes)
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
        </>
      )}
    </div>
  );
}
