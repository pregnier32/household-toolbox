'use client';

import { useState, useEffect, useRef } from 'react';

type HeaderRecord = {
  id: string;
  name: string;
  isDefault: boolean;
  card_color: string | null;
  categoryType: 'Home' | 'Auto';
};

type HistoryRecord = {
  id: string;
  headerId: string;
  date: string;
  itemName: string;
  type: 'repair' | 'replace';
  description: string;
  cost: string;
  serviceProvider: string;
  receiptFile: File | null;
  receiptFileUrl?: string | null;
  receiptFileName?: string | null;
  warrantyFile: File | null;
  warrantyFileUrl?: string | null;
  warrantyFileName?: string | null;
  warrantyEndDate: string;
  addWarrantyToDashboard?: boolean;
  submittedToInsurance: boolean;
  insuranceCarrier: string;
  claimNumber: string;
  amountInsurancePaid: string;
  agentContactInfo: string;
  claimNotes: string;
  repairPictures: File[];
  repairPictureUrls?: string[];
  odometerReading: string;
  manualLink: string;
  notes: string;
};

type Item = {
  id: string;
  name: string;
  area: string;
  isDefault: boolean;
};

type RepairHistoryToolProps = {
  toolId?: string;
};

const DEFAULT_HEADERS = ['Home', 'Auto1', 'Auto2'];

const DEFAULT_ITEMS: Omit<Item, 'id'>[] = [
  // Interior – Major Systems
  { name: 'Furnace / Heating System', area: 'Interior – Major Systems', isDefault: true },
  { name: 'Air Conditioner (AC)', area: 'Interior – Major Systems', isDefault: true },
  { name: 'Heat Pump', area: 'Interior – Major Systems', isDefault: true },
  { name: 'Thermostat', area: 'Interior – Major Systems', isDefault: true },
  { name: 'Water Heater (Tank / Tankless)', area: 'Interior – Major Systems', isDefault: true },
  { name: 'Electrical Panel / Breaker Box', area: 'Interior – Major Systems', isDefault: true },
  { name: 'Main Water Shutoff Valve', area: 'Interior – Major Systems', isDefault: true },
  { name: 'Plumbing Pipes (Supply / Drain)', area: 'Interior – Major Systems', isDefault: true },
  { name: 'Sump Pump', area: 'Interior – Major Systems', isDefault: true },
  { name: 'Radon Mitigation System', area: 'Interior – Major Systems', isDefault: true },
  // Plumbing Fixtures
  { name: 'Kitchen Sink', area: 'Plumbing Fixtures', isDefault: true },
  { name: 'Bathroom Sink', area: 'Plumbing Fixtures', isDefault: true },
  { name: 'Toilet', area: 'Plumbing Fixtures', isDefault: true },
  { name: 'Shower', area: 'Plumbing Fixtures', isDefault: true },
  { name: 'Bathtub', area: 'Plumbing Fixtures', isDefault: true },
  { name: 'Faucets', area: 'Plumbing Fixtures', isDefault: true },
  { name: 'Garbage Disposal', area: 'Plumbing Fixtures', isDefault: true },
  { name: 'Dishwasher Plumbing Connections', area: 'Plumbing Fixtures', isDefault: true },
  { name: 'Water Softener', area: 'Plumbing Fixtures', isDefault: true },
  { name: 'Well Pump (if applicable)', area: 'Plumbing Fixtures', isDefault: true },
  // Electrical & Lighting
  { name: 'Electrical Outlets', area: 'Electrical & Lighting', isDefault: true },
  { name: 'Light Switches', area: 'Electrical & Lighting', isDefault: true },
  { name: 'Light Fixtures', area: 'Electrical & Lighting', isDefault: true },
  { name: 'Ceiling Fans', area: 'Electrical & Lighting', isDefault: true },
  { name: 'Smoke Detectors', area: 'Electrical & Lighting', isDefault: true },
  { name: 'Carbon Monoxide Detectors', area: 'Electrical & Lighting', isDefault: true },
  { name: 'GFCI Outlets', area: 'Electrical & Lighting', isDefault: true },
  { name: 'Wiring (Specific Room)', area: 'Electrical & Lighting', isDefault: true },
  { name: 'Doorbell / Doorbell Camera Wiring', area: 'Electrical & Lighting', isDefault: true },
  // Appliances
  { name: 'Refrigerator', area: 'Appliances', isDefault: true },
  { name: 'Oven / Range', area: 'Appliances', isDefault: true },
  { name: 'Microwave', area: 'Appliances', isDefault: true },
  { name: 'Dishwasher', area: 'Appliances', isDefault: true },
  { name: 'Washer', area: 'Appliances', isDefault: true },
  { name: 'Dryer', area: 'Appliances', isDefault: true },
  { name: 'Freezer', area: 'Appliances', isDefault: true },
  { name: 'Trash Compactor', area: 'Appliances', isDefault: true },
  { name: 'Ice Maker', area: 'Appliances', isDefault: true },
  { name: 'Vent Hood / Range Hood', area: 'Appliances', isDefault: true },
  // Doors, Windows & Insulation
  { name: 'Exterior Doors', area: 'Doors, Windows & Insulation', isDefault: true },
  { name: 'Interior Doors', area: 'Doors, Windows & Insulation', isDefault: true },
  { name: 'Windows', area: 'Doors, Windows & Insulation', isDefault: true },
  { name: 'Window Screens', area: 'Doors, Windows & Insulation', isDefault: true },
  { name: 'Window Seals', area: 'Doors, Windows & Insulation', isDefault: true },
  { name: 'Weather Stripping', area: 'Doors, Windows & Insulation', isDefault: true },
  { name: 'Door Locks', area: 'Doors, Windows & Insulation', isDefault: true },
  { name: 'Garage Entry Door', area: 'Doors, Windows & Insulation', isDefault: true },
  { name: 'Attic Insulation', area: 'Doors, Windows & Insulation', isDefault: true },
  { name: 'Wall Insulation', area: 'Doors, Windows & Insulation', isDefault: true },
  // Structural & Exterior
  { name: 'Roof', area: 'Structural & Exterior', isDefault: true },
  { name: 'Gutters', area: 'Structural & Exterior', isDefault: true },
  { name: 'Downspouts', area: 'Structural & Exterior', isDefault: true },
  { name: 'Siding', area: 'Structural & Exterior', isDefault: true },
  { name: 'Foundation', area: 'Structural & Exterior', isDefault: true },
  { name: 'Deck / Porch', area: 'Structural & Exterior', isDefault: true },
  { name: 'Fence', area: 'Structural & Exterior', isDefault: true },
  { name: 'Chimney', area: 'Structural & Exterior', isDefault: true },
  { name: 'Exterior Paint', area: 'Structural & Exterior', isDefault: true },
  { name: 'Driveway / Walkway', area: 'Structural & Exterior', isDefault: true },
  // Garage & Storage
  { name: 'Garage Door', area: 'Garage & Storage', isDefault: true },
  { name: 'Garage Door Opener', area: 'Garage & Storage', isDefault: true },
  { name: 'Garage Door Springs', area: 'Garage & Storage', isDefault: true },
  { name: 'Garage Lighting', area: 'Garage & Storage', isDefault: true },
  { name: 'Storage Shelving', area: 'Garage & Storage', isDefault: true },
  { name: 'Workbench', area: 'Garage & Storage', isDefault: true },
  { name: 'Utility Sink', area: 'Garage & Storage', isDefault: true },
  // Yard & Outdoor
  { name: 'Lawn Sprinkler System', area: 'Yard & Outdoor', isDefault: true },
  { name: 'Outdoor Faucets (Hose Bibs)', area: 'Yard & Outdoor', isDefault: true },
  { name: 'Drainage System', area: 'Yard & Outdoor', isDefault: true },
  { name: 'Retaining Wall', area: 'Yard & Outdoor', isDefault: true },
  { name: 'Landscaping Features', area: 'Yard & Outdoor', isDefault: true },
  { name: 'Exterior Lighting', area: 'Yard & Outdoor', isDefault: true },
  { name: 'Patio / Pavers', area: 'Yard & Outdoor', isDefault: true },
  { name: 'Pool Equipment (Pump, Heater, Filter)', area: 'Yard & Outdoor', isDefault: true },
  { name: 'Hot Tub / Spa', area: 'Yard & Outdoor', isDefault: true },
  // Safety & Security
  { name: 'Home Security System', area: 'Safety & Security', isDefault: true },
  { name: 'Cameras', area: 'Safety & Security', isDefault: true },
  { name: 'Motion Sensors', area: 'Safety & Security', isDefault: true },
  { name: 'Smart Locks', area: 'Safety & Security', isDefault: true },
  { name: 'Alarm Panel', area: 'Safety & Security', isDefault: true },
  { name: 'Fire Extinguishers', area: 'Safety & Security', isDefault: true },
  { name: 'Safe / Lockbox', area: 'Safety & Security', isDefault: true },
  { name: 'Backup Generator', area: 'Safety & Security', isDefault: true },
];

const DEFAULT_AUTO_ITEMS: Omit<Item, 'id'>[] = [
  // Engine & Routine Maintenance
  { name: 'Oil Change (Oil & Filter)', area: 'Engine & Routine Maintenance', isDefault: true },
  { name: 'Air Filter', area: 'Engine & Routine Maintenance', isDefault: true },
  { name: 'Cabin Air Filter', area: 'Engine & Routine Maintenance', isDefault: true },
  { name: 'Spark Plugs', area: 'Engine & Routine Maintenance', isDefault: true },
  { name: 'Serpentine Belt', area: 'Engine & Routine Maintenance', isDefault: true },
  { name: 'Engine Coolant', area: 'Engine & Routine Maintenance', isDefault: true },
  { name: 'Engine Diagnostics / Check Engine Light', area: 'Engine & Routine Maintenance', isDefault: true },
  { name: 'Battery', area: 'Engine & Routine Maintenance', isDefault: true },
  { name: 'Alternator', area: 'Engine & Routine Maintenance', isDefault: true },
  { name: 'Starter', area: 'Engine & Routine Maintenance', isDefault: true },
  // Transmission & Drivetrain
  { name: 'Transmission Service (Fluid)', area: 'Transmission & Drivetrain', isDefault: true },
  { name: 'Transmission Repair', area: 'Transmission & Drivetrain', isDefault: true },
  { name: 'Clutch (Manual Vehicles)', area: 'Transmission & Drivetrain', isDefault: true },
  { name: 'CV Axles', area: 'Transmission & Drivetrain', isDefault: true },
  { name: 'Differential Service (AWD / 4WD)', area: 'Transmission & Drivetrain', isDefault: true },
  // Brakes, Suspension & Steering
  { name: 'Brake Pads', area: 'Brakes, Suspension & Steering', isDefault: true },
  { name: 'Brake Rotors', area: 'Brakes, Suspension & Steering', isDefault: true },
  { name: 'Brake Fluid', area: 'Brakes, Suspension & Steering', isDefault: true },
  { name: 'Shocks / Struts', area: 'Brakes, Suspension & Steering', isDefault: true },
  { name: 'Wheel Bearings', area: 'Brakes, Suspension & Steering', isDefault: true },
  { name: 'Power Steering Service', area: 'Brakes, Suspension & Steering', isDefault: true },
  { name: 'Alignment', area: 'Brakes, Suspension & Steering', isDefault: true },
  // Fluids & Scheduled Services
  { name: 'Oil Change', area: 'Fluids & Scheduled Services', isDefault: true },
  { name: 'Coolant Flush', area: 'Fluids & Scheduled Services', isDefault: true },
  { name: 'Brake Fluid Flush', area: 'Fluids & Scheduled Services', isDefault: true },
  { name: 'Transmission Fluid', area: 'Fluids & Scheduled Services', isDefault: true },
  { name: 'Power Steering Fluid', area: 'Fluids & Scheduled Services', isDefault: true },
  { name: 'Fuel System Cleaning', area: 'Fluids & Scheduled Services', isDefault: true },
  // Tires & Wheels (Extremely Common)
  { name: 'Tires', area: 'Tires & Wheels (Extremely Common)', isDefault: true },
  { name: 'Tire Rotation', area: 'Tires & Wheels (Extremely Common)', isDefault: true },
  { name: 'Wheel Alignment', area: 'Tires & Wheels (Extremely Common)', isDefault: true },
  { name: 'Tire Pressure Sensors (TPMS)', area: 'Tires & Wheels (Extremely Common)', isDefault: true },
  { name: 'Spare Tire', area: 'Tires & Wheels (Extremely Common)', isDefault: true },
  // Cooling & Climate (Common Failures)
  { name: 'Radiator', area: 'Cooling & Climate (Common Failures)', isDefault: true },
  { name: 'Thermostat', area: 'Cooling & Climate (Common Failures)', isDefault: true },
  { name: 'AC Service', area: 'Cooling & Climate (Common Failures)', isDefault: true },
  { name: 'AC Compressor', area: 'Cooling & Climate (Common Failures)', isDefault: true },
  { name: 'Heater / Blower Motor', area: 'Cooling & Climate (Common Failures)', isDefault: true },
  // Glass & Exterior
  { name: 'Windshield', area: 'Glass & Exterior', isDefault: true },
  { name: 'Mirrors', area: 'Glass & Exterior', isDefault: true },
  { name: 'Door Locks', area: 'Glass & Exterior', isDefault: true },
  { name: 'Wiper Blades', area: 'Glass & Exterior', isDefault: true },
  { name: 'Exterior Lights (Headlights / Taillights)', area: 'Glass & Exterior', isDefault: true },
  // Safety & Inspection Items
  { name: 'Brake Inspection', area: 'Safety & Inspection Items', isDefault: true },
  { name: 'Safety Inspection', area: 'Safety & Inspection Items', isDefault: true },
  { name: 'Emissions Test', area: 'Safety & Inspection Items', isDefault: true },
  { name: 'Airbags (Service / Recall)', area: 'Safety & Inspection Items', isDefault: true },
];

export function RepairHistoryTool({ toolId }: RepairHistoryToolProps) {
  // Helper function to format currency
  const formatCurrency = (value: string): string => {
    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    
    // Handle multiple decimal points
    const parts = numericValue.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    return numericValue;
  };

  const formatCurrencyDisplay = (value: string): string => {
    if (!value) return '';
    // Remove currency symbols and formatting for parsing
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
  };

  // Header management
  const [headers, setHeaders] = useState<HeaderRecord[]>([]);
  const [selectedHeaderId, setSelectedHeaderId] = useState<string | null>(null);
  const [isCreatingNewHeader, setIsCreatingNewHeader] = useState(false);
  const [newHeaderName, setNewHeaderName] = useState('');
  const [newHeaderCategoryType, setNewHeaderCategoryType] = useState<'Home' | 'Auto'>('Home');
  const [isLoading, setIsLoading] = useState(true);
  
  // Header editing
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const [editingHeaderName, setEditingHeaderName] = useState('');
  const [editingHeaderColor, setEditingHeaderColor] = useState('#10b981'); // Default emerald
  const [editingHeaderCategoryType, setEditingHeaderCategoryType] = useState<'Home' | 'Auto'>('Home');
  const [menuOpenHeaderId, setMenuOpenHeaderId] = useState<string | null>(null);
  
  // Delete confirmation
  const [deleteConfirmHeaderId, setDeleteConfirmHeaderId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // History records
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [newRecord, setNewRecord] = useState<Omit<HistoryRecord, 'id' | 'headerId'>>({
    date: new Date().toISOString().split('T')[0],
    itemName: '',
    type: 'repair',
    description: '',
    cost: '',
    serviceProvider: '',
    receiptFile: null,
    warrantyFile: null,
    warrantyEndDate: '',
    addWarrantyToDashboard: false,
    submittedToInsurance: false,
    insuranceCarrier: '',
    claimNumber: '',
    amountInsurancePaid: '',
    agentContactInfo: '',
    claimNotes: '',
    repairPictures: [],
    odometerReading: '',
    manualLink: '',
    notes: '',
  });
  
  // Edit record
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<HistoryRecord | null>(null);
  
  // Delete record confirmation
  const [deleteConfirmRecordId, setDeleteConfirmRecordId] = useState<string | null>(null);
  
  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterItem, setFilterItem] = useState<string>('all');
  
  // Active tab
  const [activeTab, setActiveTab] = useState<'history' | 'items' | 'export'>('history');
  
  // Items management
  const [items, setItems] = useState<Item[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemArea, setNewItemArea] = useState('');
  const [isCreatingNewArea, setIsCreatingNewArea] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState('');
  const [editingItemArea, setEditingItemArea] = useState('');
  const [deleteConfirmItemId, setDeleteConfirmItemId] = useState<string | null>(null);
  const [deleteConfirmItemText, setDeleteConfirmItemText] = useState('');
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  
  // Export
  const [showExportPopup, setShowExportPopup] = useState(false);
  
  // File input refs
  const receiptFileInputRef = useRef<HTMLInputElement>(null);
  const warrantyFileInputRef = useRef<HTMLInputElement>(null);
  const repairPicturesInputRef = useRef<HTMLInputElement>(null);
  const editReceiptFileInputRef = useRef<HTMLInputElement>(null);
  const editWarrantyFileInputRef = useRef<HTMLInputElement>(null);
  const editRepairPicturesInputRef = useRef<HTMLInputElement>(null);

  // Load items when selected header changes
  useEffect(() => {
    if (selectedHeaderId && headers.length > 0 && toolId) {
      const header = headers.find(h => h.id === selectedHeaderId);
      if (header) {
        loadItems(header.categoryType);
      }
    }
  }, [selectedHeaderId, headers, toolId]);

  // Load headers from API
  const loadHeaders = async () => {
    if (!toolId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tools/repair-history?toolId=${toolId}&resource=headers`);
      if (response.ok) {
        const data = await response.json();
        const transformedHeaders: HeaderRecord[] = (data.headers || []).map((h: any) => ({
          id: h.id,
          name: h.name,
          isDefault: h.is_default || false,
          card_color: h.card_color || '#10b981',
          categoryType: h.category_type as 'Home' | 'Auto',
        }));
        
        // Deduplicate headers: keep only the first occurrence of each name/categoryType combination
        const seen = new Map<string, boolean>();
        const uniqueHeaders: HeaderRecord[] = [];
        for (const header of transformedHeaders) {
          const key = `${header.name}-${header.categoryType}`;
          if (!seen.has(key)) {
            seen.set(key, true);
            uniqueHeaders.push(header);
          }
        }
        
        // Headers are now copied from defaults table automatically by the API
        // No need to create defaults here
        setHeaders(uniqueHeaders);
        if (uniqueHeaders.length > 0 && !selectedHeaderId) {
          setSelectedHeaderId(uniqueHeaders[0].id);
        }
      } else {
        console.error('Failed to load headers');
        setSaveMessage({ type: 'error', text: 'Failed to load headers' });
      }
    } catch (error) {
      console.error('Error loading headers:', error);
      setSaveMessage({ type: 'error', text: 'Failed to load headers' });
    } finally {
      setIsLoading(false);
    }
  };

  // Load history records for selected header from API
  const loadHistoryRecords = async (headerId: string) => {
    if (!toolId) return;
    
    try {
      const response = await fetch(`/api/tools/repair-history?toolId=${toolId}&resource=records&headerId=${headerId}`);
      if (response.ok) {
        const data = await response.json();
        const transformedRecords: HistoryRecord[] = (data.records || []).map((r: any) => ({
          id: r.id,
          headerId: r.header_id,
          date: r.date,
          itemName: r.item_name,
          type: r.type as 'repair' | 'replace',
          description: r.description || '',
          cost: r.cost || '',
          serviceProvider: r.service_provider || '',
          receiptFile: null,
          receiptFileUrl: r.receipt_file_url,
          receiptFileName: r.receipt_file_name,
          warrantyFile: null,
          warrantyFileUrl: r.warranty_file_url,
          warrantyFileName: r.warranty_file_name,
          warrantyEndDate: r.warranty_end_date || '',
          addWarrantyToDashboard: !!r.warranty_dashboard_item_id,
          submittedToInsurance: r.submitted_to_insurance || false,
          insuranceCarrier: r.insurance_carrier || '',
          claimNumber: r.claim_number || '',
          amountInsurancePaid: r.amount_insurance_paid || '',
          agentContactInfo: r.agent_contact_info || '',
          claimNotes: r.claim_notes || '',
          repairPictures: [],
          repairPictureUrls: r.repairPictures?.map((p: any) => p.fileUrl) || [],
          odometerReading: r.odometer_reading || '',
          manualLink: r.manual_link || '',
          notes: r.notes || '',
        }));
        setHistoryRecords(transformedRecords);
      } else {
        console.error('Failed to load history records');
        setHistoryRecords([]);
      }
    } catch (error) {
      console.error('Error loading history records:', error);
      setHistoryRecords([]);
    }
  };

  // Load items from API
  const loadItems = async (categoryType: 'Home' | 'Auto') => {
    if (!toolId) return;
    
    try {
      const response = await fetch(`/api/tools/repair-history?toolId=${toolId}&resource=items&categoryType=${categoryType}`);
      if (response.ok) {
        const data = await response.json();
        const transformedItems: Item[] = (data.items || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          area: item.area,
          isDefault: item.is_default || false,
        }));
        
        setItems(transformedItems);
      } else {
        console.error('Failed to load items');
        setItems([]);
      }
    } catch (error) {
      console.error('Error loading items:', error);
      setItems([]);
    }
  };

  useEffect(() => {
    if (toolId) {
      loadHeaders();
    }
  }, [toolId]);

  useEffect(() => {
    if (selectedHeaderId && toolId) {
      loadHistoryRecords(selectedHeaderId);
    }
  }, [selectedHeaderId, toolId]);

  // Header management functions
  const createNewHeader = async () => {
    if (!newHeaderName.trim() || !toolId) return;

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('resource', 'header');
      formData.append('action', 'create');
      formData.append('name', newHeaderName.trim());
      formData.append('cardColor', '#10b981'); // Default emerald
      formData.append('categoryType', newHeaderCategoryType);

      const response = await fetch('/api/tools/repair-history', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const newHeader: HeaderRecord = {
          id: data.header.id,
          name: data.header.name,
          isDefault: data.header.is_default || false,
          card_color: data.header.card_color || '#10b981',
          categoryType: data.header.category_type as 'Home' | 'Auto',
        };
        
        setHeaders([...headers, newHeader]);
        setSelectedHeaderId(newHeader.id);
        setIsCreatingNewHeader(false);
        setNewHeaderName('');
        setNewHeaderCategoryType('Home');
        setSaveMessage({ type: 'success', text: 'Header created successfully!' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create header');
      }
    } catch (error) {
      console.error('Error creating header:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create header' });
    } finally {
      setIsSaving(false);
    }
  };

  const selectHeader = (headerId: string) => {
    setSelectedHeaderId(headerId);
    setEditingHeaderId(null);
    loadHistoryRecords(headerId);
  };

  const startEditingHeader = (header: HeaderRecord) => {
    setEditingHeaderId(header.id);
    setEditingHeaderName(header.name);
    setEditingHeaderColor(header.card_color || '#10b981');
    setEditingHeaderCategoryType(header.categoryType);
    setMenuOpenHeaderId(null);
  };

  const cancelEditingHeader = () => {
    setEditingHeaderId(null);
    setEditingHeaderName('');
    setEditingHeaderColor('#10b981');
    setEditingHeaderCategoryType('Home');
    setMenuOpenHeaderId(null);
  };


  const saveHeaderEdit = async () => {
    if (!editingHeaderId || !toolId) return;
    
    if (!editingHeaderName.trim()) {
      setSaveMessage({ type: 'error', text: 'Header name cannot be empty' });
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('resource', 'header');
      formData.append('action', 'update');
      formData.append('headerId', editingHeaderId);
      formData.append('name', editingHeaderName.trim());
      formData.append('cardColor', editingHeaderColor);
      formData.append('categoryType', editingHeaderCategoryType);

      const response = await fetch('/api/tools/repair-history', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setHeaders(headers.map(h => 
          h.id === editingHeaderId 
            ? { ...h, name: editingHeaderName.trim(), card_color: editingHeaderColor, categoryType: editingHeaderCategoryType }
            : h
        ));
        
        setEditingHeaderId(null);
        setSaveMessage({ type: 'success', text: 'Header updated successfully!' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update header');
      }
    } catch (error) {
      console.error('Error updating header:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update header' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteHeader = async () => {
    if (!deleteConfirmHeaderId || !toolId) return;

    if (deleteConfirmText.toLowerCase() !== 'delete') {
      setSaveMessage({ type: 'error', text: 'Please type "delete" to confirm' });
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('resource', 'header');
      formData.append('action', 'delete');
      formData.append('headerId', deleteConfirmHeaderId);

      const response = await fetch('/api/tools/repair-history', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // If the deleted header was selected, clear selection
        if (selectedHeaderId === deleteConfirmHeaderId) {
          const remainingHeaders = headers.filter(h => h.id !== deleteConfirmHeaderId);
          setSelectedHeaderId(remainingHeaders.length > 0 ? remainingHeaders[0].id : null);
        }

        setHeaders(headers.filter(h => h.id !== deleteConfirmHeaderId));
        setDeleteConfirmHeaderId(null);
        setDeleteConfirmText('');
        setSaveMessage({ type: 'success', text: 'Header deleted successfully' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete header');
      }
    } catch (error) {
      console.error('Error deleting header:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete header' });
    } finally {
      setIsSaving(false);
    }
  };

  // History record functions
  const startAddingRecord = () => {
    if (!selectedHeaderId) {
      setSaveMessage({ type: 'error', text: 'Please select a header first' });
      return;
    }
    setIsAddingRecord(true);
    setNewRecord({
      date: new Date().toISOString().split('T')[0],
      itemName: '',
      type: 'repair',
      description: '',
      cost: '',
      serviceProvider: '',
      receiptFile: null,
      warrantyFile: null,
      warrantyEndDate: '',
      addWarrantyToDashboard: false,
      submittedToInsurance: false,
      insuranceCarrier: '',
      claimNumber: '',
      amountInsurancePaid: '',
      agentContactInfo: '',
      claimNotes: '',
      repairPictures: [],
      odometerReading: '',
      manualLink: '',
      notes: '',
    });
  };

  const cancelAddingRecord = () => {
    setIsAddingRecord(false);
    setNewRecord({
      date: new Date().toISOString().split('T')[0],
      itemName: '',
      type: 'repair',
      description: '',
      cost: '',
      serviceProvider: '',
      receiptFile: null,
      warrantyFile: null,
      warrantyEndDate: '',
      addWarrantyToDashboard: false,
      submittedToInsurance: false,
      insuranceCarrier: '',
      claimNumber: '',
      amountInsurancePaid: '',
      agentContactInfo: '',
      claimNotes: '',
      repairPictures: [],
      odometerReading: '',
      manualLink: '',
      notes: '',
    });
    if (receiptFileInputRef.current) receiptFileInputRef.current.value = '';
    if (warrantyFileInputRef.current) warrantyFileInputRef.current.value = '';
    if (repairPicturesInputRef.current) repairPicturesInputRef.current.value = '';
  };

  const saveNewRecord = async () => {
    if (!selectedHeaderId || !toolId) return;

    if (!newRecord.itemName.trim() || !newRecord.date) {
      setSaveMessage({ type: 'error', text: 'Repaired item and date are required' });
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('resource', 'record');
      formData.append('action', 'create');
      formData.append('headerId', selectedHeaderId);
      formData.append('date', newRecord.date);
      formData.append('itemName', newRecord.itemName.trim());
      formData.append('type', newRecord.type);
      formData.append('description', newRecord.description || '');
      formData.append('cost', newRecord.cost || '');
      formData.append('serviceProvider', newRecord.serviceProvider || '');
      formData.append('warrantyEndDate', newRecord.warrantyEndDate || '');
      formData.append('addWarrantyToDashboard', newRecord.addWarrantyToDashboard ? 'true' : 'false');
      formData.append('submittedToInsurance', newRecord.submittedToInsurance ? 'true' : 'false');
      formData.append('insuranceCarrier', newRecord.insuranceCarrier || '');
      formData.append('claimNumber', newRecord.claimNumber || '');
      formData.append('amountInsurancePaid', newRecord.amountInsurancePaid || '');
      formData.append('agentContactInfo', newRecord.agentContactInfo || '');
      formData.append('claimNotes', newRecord.claimNotes || '');
      formData.append('odometerReading', newRecord.odometerReading || '');
      formData.append('manualLink', newRecord.manualLink || '');
      formData.append('notes', newRecord.notes || '');

      if (newRecord.receiptFile) {
        formData.append('receiptFile', newRecord.receiptFile);
      }
      if (newRecord.warrantyFile) {
        formData.append('warrantyFile', newRecord.warrantyFile);
      }
      if (newRecord.repairPictures && newRecord.repairPictures.length > 0) {
        newRecord.repairPictures.forEach(picture => {
          formData.append('repairPictures', picture);
        });
      }

      const response = await fetch('/api/tools/repair-history', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        // Reload records to get the new one with all data
        await loadHistoryRecords(selectedHeaderId);
        
        setIsAddingRecord(false);
        setNewRecord({
          date: new Date().toISOString().split('T')[0],
          itemName: '',
          type: 'repair',
          description: '',
          cost: '',
          serviceProvider: '',
          receiptFile: null,
          warrantyFile: null,
          warrantyEndDate: '',
          addWarrantyToDashboard: false,
          submittedToInsurance: false,
          insuranceCarrier: '',
          claimNumber: '',
          amountInsurancePaid: '',
          agentContactInfo: '',
          claimNotes: '',
          repairPictures: [],
          odometerReading: '',
          manualLink: '',
          notes: '',
        });
        if (receiptFileInputRef.current) receiptFileInputRef.current.value = '';
        if (warrantyFileInputRef.current) warrantyFileInputRef.current.value = '';
        if (repairPicturesInputRef.current) repairPicturesInputRef.current.value = '';
        setSaveMessage({ type: 'success', text: 'Record added successfully!' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save record');
      }
    } catch (error) {
      console.error('Error saving record:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save record' });
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingRecord = (record: HistoryRecord) => {
    setEditingRecordId(record.id);
    setEditingRecord({ ...record });
    setMenuOpenHeaderId(null);
  };

  const cancelEditingRecord = () => {
    setEditingRecordId(null);
    setEditingRecord(null);
    if (editReceiptFileInputRef.current) editReceiptFileInputRef.current.value = '';
    if (editWarrantyFileInputRef.current) editWarrantyFileInputRef.current.value = '';
    if (editRepairPicturesInputRef.current) editRepairPicturesInputRef.current.value = '';
  };

  const saveRecordEdit = async () => {
    if (!editingRecordId || !editingRecord || !toolId) return;

    if (!editingRecord.itemName.trim() || !editingRecord.date) {
      setSaveMessage({ type: 'error', text: 'Repaired item and date are required' });
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('resource', 'record');
      formData.append('action', 'update');
      formData.append('recordId', editingRecordId);
      formData.append('headerId', editingRecord.headerId);
      formData.append('date', editingRecord.date);
      formData.append('itemName', editingRecord.itemName.trim());
      formData.append('type', editingRecord.type);
      formData.append('description', editingRecord.description || '');
      formData.append('cost', editingRecord.cost || '');
      formData.append('serviceProvider', editingRecord.serviceProvider || '');
      formData.append('warrantyEndDate', editingRecord.warrantyEndDate || '');
      formData.append('addWarrantyToDashboard', editingRecord.addWarrantyToDashboard ? 'true' : 'false');
      formData.append('submittedToInsurance', editingRecord.submittedToInsurance ? 'true' : 'false');
      formData.append('insuranceCarrier', editingRecord.insuranceCarrier || '');
      formData.append('claimNumber', editingRecord.claimNumber || '');
      formData.append('amountInsurancePaid', editingRecord.amountInsurancePaid || '');
      formData.append('agentContactInfo', editingRecord.agentContactInfo || '');
      formData.append('claimNotes', editingRecord.claimNotes || '');
      formData.append('odometerReading', editingRecord.odometerReading || '');
      formData.append('manualLink', editingRecord.manualLink || '');
      formData.append('notes', editingRecord.notes || '');

      if (editingRecord.receiptFile) {
        formData.append('receiptFile', editingRecord.receiptFile);
      }
      if (editingRecord.warrantyFile) {
        formData.append('warrantyFile', editingRecord.warrantyFile);
      }
      if (editingRecord.repairPictures && editingRecord.repairPictures.length > 0) {
        editingRecord.repairPictures.forEach(picture => {
          formData.append('repairPictures', picture);
        });
      }

      const response = await fetch('/api/tools/repair-history', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Reload records to get updated data
        await loadHistoryRecords(editingRecord.headerId);
        
        setEditingRecordId(null);
        setEditingRecord(null);
        if (editReceiptFileInputRef.current) editReceiptFileInputRef.current.value = '';
        if (editWarrantyFileInputRef.current) editWarrantyFileInputRef.current.value = '';
        if (editRepairPicturesInputRef.current) editRepairPicturesInputRef.current.value = '';
        setSaveMessage({ type: 'success', text: 'Record updated successfully!' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update record');
      }
    } catch (error) {
      console.error('Error updating record:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update record' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRecord = async () => {
    if (!deleteConfirmRecordId || !toolId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/tools/repair-history?toolId=${toolId}&resource=record&id=${deleteConfirmRecordId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Reload records to reflect deletion
        if (selectedHeaderId) {
          await loadHistoryRecords(selectedHeaderId);
        }
        setDeleteConfirmRecordId(null);
        setSaveMessage({ type: 'success', text: 'Record deleted successfully' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete record');
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete record' });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter history records
  const filteredRecords = historyRecords.filter(record => {
    if (record.headerId !== selectedHeaderId) return false;
    
    const matchesSearch = searchQuery === '' || 
      record.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.serviceProvider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.notes.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterItem === 'all' || record.itemName === filterItem;
    
    return matchesSearch && matchesFilter;
  });


  // Item management functions
  const getUniqueAreas = () => {
    const areas = new Set(items.map(item => item.area));
    return Array.from(areas).sort();
  };

  const getItemsByArea = (area: string) => {
    return items.filter(item => item.area === area).sort((a, b) => a.name.localeCompare(b.name));
  };

  const toggleArea = (area: string) => {
    setExpandedAreas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(area)) {
        newSet.delete(area);
      } else {
        newSet.add(area);
      }
      return newSet;
    });
  };

  const isAreaExpanded = (area: string) => {
    return expandedAreas.has(area);
  };

  const startAddingItem = () => {
    setIsAddingItem(true);
    setNewItemName('');
    setNewItemArea('');
    setIsCreatingNewArea(false);
  };

  const cancelAddingItem = () => {
    setIsAddingItem(false);
    setNewItemName('');
    setNewItemArea('');
    setIsCreatingNewArea(false);
  };

  const saveNewItem = async () => {
    if (!newItemName.trim() || !newItemArea.trim() || !selectedHeaderId || !toolId) {
      setSaveMessage({ type: 'error', text: 'Item name and area are required' });
      return;
    }
    
    const selectedHeader = headers.find(h => h.id === selectedHeaderId);
    if (!selectedHeader) {
      setSaveMessage({ type: 'error', text: 'Please select a header first' });
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('resource', 'item');
      formData.append('action', 'create');
      formData.append('categoryType', selectedHeader.categoryType);
      formData.append('name', newItemName.trim());
      formData.append('area', newItemArea.trim());

      const response = await fetch('/api/tools/repair-history', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Reload items to get the new one
        await loadItems(selectedHeader.categoryType);
        setIsAddingItem(false);
        setNewItemName('');
        setNewItemArea('');
        setIsCreatingNewArea(false);
        setSaveMessage({ type: 'success', text: 'Item added successfully!' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save item');
      }
    } catch (error) {
      console.error('Error saving item:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save item' });
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingItem = (item: Item) => {
    setEditingItemId(item.id);
    setEditingItemName(item.name);
    setEditingItemArea(item.area);
  };

  const cancelEditingItem = () => {
    setEditingItemId(null);
    setEditingItemName('');
    setEditingItemArea('');
  };

  const saveItemEdit = async () => {
    if (!editingItemId || !selectedHeaderId || !toolId) return;
    
    const selectedHeader = headers.find(h => h.id === selectedHeaderId);
    if (!selectedHeader) {
      setSaveMessage({ type: 'error', text: 'Please select a header first' });
      return;
    }
    
    if (!editingItemName.trim() || !editingItemArea.trim()) {
      setSaveMessage({ type: 'error', text: 'Item name and area are required' });
      return;
    }

    setIsSaving(true);
    try {
      const editingItem = items.find(item => item.id === editingItemId);
      if (!editingItem) {
        throw new Error('Item not found');
      }


      const formData = new FormData();
      formData.append('toolId', toolId);
      formData.append('resource', 'item');
      formData.append('action', 'update');
      formData.append('itemId', editingItemId);
      formData.append('categoryType', selectedHeader.categoryType);
      formData.append('name', editingItemName.trim());
      formData.append('area', editingItemArea.trim());

      const response = await fetch('/api/tools/repair-history', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Reload items to get updated data
        await loadItems(selectedHeader.categoryType);
        setEditingItemId(null);
        setEditingItemName('');
        setEditingItemArea('');
        setSaveMessage({ type: 'success', text: 'Item updated successfully!' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        let errorMessage = 'Failed to update item';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error updating item:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update item' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async () => {
    if (!deleteConfirmItemId || !selectedHeaderId || !toolId) return;
    
    const selectedHeader = headers.find(h => h.id === selectedHeaderId);
    if (!selectedHeader) {
      setSaveMessage({ type: 'error', text: 'Please select a header first' });
      return;
    }

    if (deleteConfirmItemText.toLowerCase() !== 'delete') {
      setSaveMessage({ type: 'error', text: 'Please type "delete" to confirm' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/tools/repair-history?toolId=${toolId}&resource=item&id=${deleteConfirmItemId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Reload items to reflect deletion
        await loadItems(selectedHeader.categoryType);
        setDeleteConfirmItemId(null);
        setDeleteConfirmItemText('');
        setSaveMessage({ type: 'success', text: 'Item deleted successfully' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete item' });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedHeader = headers.find(h => h.id === selectedHeaderId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-50 mb-2">Repair History</h2>
          <p className="text-slate-400 text-sm">
            Track repairs and replacements for your home and vehicles
          </p>
        </div>
        {isLoading && (
          <div className="text-sm text-slate-400">
            Loading...
          </div>
        )}
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            saveMessage.type === 'success'
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/50 bg-red-500/10 text-red-300'
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Header Records */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Select a Category
        </label>
        
        {!isCreatingNewHeader ? (
          <div className="flex items-center gap-3 flex-wrap">
            {headers.map((header) => (
              editingHeaderId === header.id ? (
                // Edit mode
                <div
                  key={header.id}
                  className="px-4 py-3 rounded-lg border border-slate-600 bg-slate-800 min-w-[200px]"
                  style={{
                    borderColor: editingHeaderColor,
                    backgroundColor: `${editingHeaderColor}15`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={editingHeaderName}
                      onChange={(e) => setEditingHeaderName(e.target.value)}
                      className="flex-1 px-2 py-1 rounded border border-slate-600 bg-slate-900 text-slate-100 text-sm focus:border-emerald-500/50 focus:outline-none"
                      placeholder="Category name"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs text-slate-400">Color:</label>
                    <input
                      type="color"
                      value={editingHeaderColor}
                      onChange={(e) => setEditingHeaderColor(e.target.value)}
                      className="h-6 w-12 rounded border border-slate-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs text-slate-400">Type:</label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name={`categoryType-${header.id}`}
                          value="Home"
                          checked={editingHeaderCategoryType === 'Home'}
                          onChange={(e) => setEditingHeaderCategoryType(e.target.value as 'Home' | 'Auto')}
                          className="w-3 h-3 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                        />
                        <span className="text-xs text-slate-200">Home</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name={`categoryType-${header.id}`}
                          value="Auto"
                          checked={editingHeaderCategoryType === 'Auto'}
                          onChange={(e) => setEditingHeaderCategoryType(e.target.value as 'Home' | 'Auto')}
                          className="w-3 h-3 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                        />
                        <span className="text-xs text-slate-200">Auto</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveHeaderEdit}
                      disabled={isSaving || !editingHeaderName.trim()}
                      className="flex-1 px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditingHeader}
                      className="px-2 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // Display mode
                <div
                  key={header.id}
                  className="relative"
                >
                  <button
                    onClick={() => selectHeader(header.id)}
                    className={`px-4 py-3 rounded-lg border transition-all duration-200 min-w-[120px] relative ${
                      selectedHeaderId === header.id
                        ? 'shadow-lg'
                        : 'hover:border-slate-600'
                    }`}
                    style={{
                      borderColor: header.card_color || '#10b981',
                      backgroundColor: selectedHeaderId === header.id 
                        ? `${header.card_color || '#10b981'}15` 
                        : `${header.card_color || '#10b981'}08`,
                      color: header.card_color || '#10b981',
                    }}
                  >
                    <div className="font-medium text-center">{header.name}</div>
                  </button>
                  {/* Ellipsis Menu Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenHeaderId(menuOpenHeaderId === header.id ? null : header.id);
                    }}
                    className="absolute top-1 right-1 p-1 rounded hover:bg-slate-700/50 transition-colors"
                    title="Header options"
                  >
                    <svg className="h-4 w-4 text-slate-400 hover:text-slate-200" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>
                  {/* Menu Popup */}
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
            ))}
            
            {/* Add New Header Button */}
            <button
              onClick={() => {
                setIsCreatingNewHeader(true);
                setSelectedHeaderId(null);
                setEditingHeaderId(null);
                setNewHeaderCategoryType('Home');
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
                value={newHeaderName}
                onChange={(e) => setNewHeaderName(e.target.value)}
                placeholder="Enter category name"
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    createNewHeader();
                  } else if (e.key === 'Escape') {
                    setIsCreatingNewHeader(false);
                    setNewHeaderName('');
                  }
                }}
                autoFocus
              />
            </div>
            <div className="min-w-[200px]">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Category Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="newHeaderCategoryType"
                    value="Home"
                    checked={newHeaderCategoryType === 'Home'}
                    onChange={(e) => setNewHeaderCategoryType(e.target.value as 'Home' | 'Auto')}
                    className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">Home</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="newHeaderCategoryType"
                    value="Auto"
                    checked={newHeaderCategoryType === 'Auto'}
                    onChange={(e) => setNewHeaderCategoryType(e.target.value as 'Home' | 'Auto')}
                    className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-200">Auto</span>
                </label>
              </div>
            </div>
            <button
              onClick={createNewHeader}
              disabled={!newHeaderName.trim() || isSaving}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreatingNewHeader(false);
                setNewHeaderName('');
                setNewHeaderCategoryType('Home');
              }}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {menuOpenHeaderId && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuOpenHeaderId(null)}
        />
      )}

      {/* Delete Header Confirmation Modal */}
      {deleteConfirmHeaderId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete Category</h3>
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4">
              <p className="text-red-300 font-semibold mb-2">⚠️ Warning: This action cannot be undone!</p>
              <p className="text-red-200 text-sm">
                All repair history records, receipts, warranties, and any other data associated with this category will be <strong>permanently deleted</strong> and cannot be recovered.
              </p>
            </div>
            <p className="text-slate-300 mb-4">
              To confirm deletion, please type <strong className="text-slate-200">delete</strong> in the box below:
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
                  setDeleteConfirmHeaderId(null);
                  setDeleteConfirmText('');
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={deleteHeader}
                disabled={deleteConfirmText.toLowerCase() !== 'delete' || isSaving}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Deleting...' : 'Delete Category'}
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmHeaderId(null);
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

      {!isLoading && !selectedHeaderId && !isCreatingNewHeader && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-slate-400 mb-4">Please select a category or create a new one to get started.</p>
        </div>
      )}

      {selectedHeaderId && (
        <>
          {/* Navigation Tabs */}
          <div className="border-b border-slate-800">
            <div className="flex gap-2 overflow-x-auto">
              {selectedHeader && (
                <div className="px-4 py-2 text-[18px] font-medium text-slate-200 whitespace-nowrap border-b-2 border-transparent">
                  {selectedHeader.name}:
                </div>
              )}
              {[
                { id: 'history', label: 'History' },
                { id: 'items', label: 'Items' },
                { id: 'export', label: 'Export' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'history' | 'items' | 'export')}
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

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              {/* Add New Record Button */}
              {!isAddingRecord && (
                <div className="flex justify-start">
                  <button
                    onClick={startAddingRecord}
                    className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    + Add New Repair
                  </button>
                </div>
              )}

              {/* Search and Filter */}
              {!isAddingRecord && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Search
                    </label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by item, description, service provider..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Filter by Item
                    </label>
                    <select
                      value={filterItem}
                      onChange={(e) => setFilterItem(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    >
                      <option value="all">All Items</option>
                      {getUniqueAreas().map((area) => {
                        const areaItems = getItemsByArea(area);
                        return (
                          <optgroup key={area} label={area}>
                            {areaItems.map((item) => (
                              <option key={item.id} value={item.name}>
                                {item.name}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                </div>
                </div>
              )}

              {/* Add Record Form */}
              {isAddingRecord && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-50">Add New Repair History Item</h3>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="type"
                          value="repair"
                          checked={newRecord.type === 'repair'}
                          onChange={(e) => setNewRecord({ ...newRecord, type: e.target.value as 'repair' | 'replace' })}
                          className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                        />
                        <span className="text-sm text-slate-200">Repair</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="type"
                          value="replace"
                          checked={newRecord.type === 'replace'}
                          onChange={(e) => setNewRecord({ ...newRecord, type: e.target.value as 'repair' | 'replace' })}
                          className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                        />
                        <span className="text-sm text-slate-200">Replace</span>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Date <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="date"
                          value={newRecord.date}
                          onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Repaired Item <span className="text-red-400">*</span>
                        </label>
                        {selectedHeader?.categoryType === 'Home' ? (
                          <select
                            value={newRecord.itemName}
                            onChange={(e) => setNewRecord({ ...newRecord, itemName: e.target.value })}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          >
                            <option value="">Select an item...</option>
                            {getUniqueAreas().map((area) => {
                              const areaItems = getItemsByArea(area);
                              return (
                                <optgroup key={area} label={area}>
                                  {areaItems.map((item) => (
                                    <option key={item.id} value={item.name}>
                                      {item.name}
                                    </option>
                                  ))}
                                </optgroup>
                              );
                            })}
                          </select>
                        ) : (
                          <select
                            value={newRecord.itemName}
                            onChange={(e) => setNewRecord({ ...newRecord, itemName: e.target.value })}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          >
                            <option value="">Select an item...</option>
                            {getUniqueAreas().map((area) => {
                              const areaItems = getItemsByArea(area);
                              return (
                                <optgroup key={area} label={area}>
                                  {areaItems.map((item) => (
                                    <option key={item.id} value={item.name}>
                                      {item.name}
                                    </option>
                                  ))}
                                </optgroup>
                              );
                            })}
                          </select>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Description
                      </label>
                      <textarea
                        value={newRecord.description}
                        onChange={(e) => setNewRecord({ ...newRecord, description: e.target.value })}
                        placeholder="Describe what was done..."
                        rows={3}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Cost
                        </label>
                        <input
                          type="text"
                          value={newRecord.cost}
                          onChange={(e) => {
                            const formatted = formatCurrency(e.target.value);
                            setNewRecord({ ...newRecord, cost: formatted });
                          }}
                          onBlur={(e) => {
                            if (e.target.value) {
                              const formatted = formatCurrencyDisplay(e.target.value);
                              setNewRecord({ ...newRecord, cost: formatted });
                            }
                          }}
                          onFocus={(e) => {
                            // Remove formatting on focus for easier editing
                            const numericValue = e.target.value.replace(/[^0-9.]/g, '');
                            setNewRecord({ ...newRecord, cost: numericValue });
                          }}
                          placeholder="e.g., 150.00"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Service Provider
                        </label>
                        <input
                          type="text"
                          value={newRecord.serviceProvider}
                          onChange={(e) => setNewRecord({ ...newRecord, serviceProvider: e.target.value })}
                          placeholder="e.g., ABC Repair Service"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <input
                          type="checkbox"
                          id="submittedToInsurance"
                          checked={newRecord.submittedToInsurance || false}
                          onChange={(e) => setNewRecord({ ...newRecord, submittedToInsurance: e.target.checked })}
                          className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                        />
                        <label htmlFor="submittedToInsurance" className="text-sm text-slate-300 cursor-pointer">
                          Was this repair submitted to your insurance?
                        </label>
                      </div>
                      {newRecord.submittedToInsurance && (
                        <div className="space-y-4 mt-4 p-4 rounded-lg border border-slate-700 bg-slate-800/50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                Insurance Carrier
                              </label>
                              <input
                                type="text"
                                value={newRecord.insuranceCarrier}
                                onChange={(e) => setNewRecord({ ...newRecord, insuranceCarrier: e.target.value })}
                                placeholder="e.g., State Farm"
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                Claim Number
                              </label>
                              <input
                                type="text"
                                value={newRecord.claimNumber}
                                onChange={(e) => setNewRecord({ ...newRecord, claimNumber: e.target.value })}
                                placeholder="e.g., CL-123456"
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">
                              Amount Insurance Paid
                            </label>
                            <input
                              type="text"
                              value={newRecord.amountInsurancePaid}
                              onChange={(e) => setNewRecord({ ...newRecord, amountInsurancePaid: e.target.value })}
                              placeholder="e.g., $1,200.00"
                              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">
                              Agent Contact Info
                            </label>
                            <input
                              type="text"
                              value={newRecord.agentContactInfo}
                              onChange={(e) => setNewRecord({ ...newRecord, agentContactInfo: e.target.value })}
                              placeholder="e.g., John Doe - (555) 123-4567 - john@insurance.com"
                              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">
                              Claim Notes
                            </label>
                            <textarea
                              value={newRecord.claimNotes}
                              onChange={(e) => setNewRecord({ ...newRecord, claimNotes: e.target.value })}
                              placeholder="Additional notes about the insurance claim..."
                              rows={3}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    {selectedHeader?.categoryType === 'Auto' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Odometer Reading
                        </label>
                        <input
                          type="text"
                          value={newRecord.odometerReading}
                          onChange={(e) => setNewRecord({ ...newRecord, odometerReading: e.target.value })}
                          placeholder="e.g., 45,000"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Receipt
                      </label>
                      <div className="relative">
                        <input
                          ref={receiptFileInputRef}
                          type="file"
                          id="receipt-file-input"
                          onChange={(e) => setNewRecord({ ...newRecord, receiptFile: e.target.files?.[0] || null })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          accept="image/*,.pdf"
                        />
                        <label
                          htmlFor="receipt-file-input"
                          className="flex items-center gap-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-slate-300">
                            {newRecord.receiptFile ? newRecord.receiptFile.name : 'Select file'}
                          </span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Warranty
                      </label>
                      <div className="relative">
                        <input
                          ref={warrantyFileInputRef}
                          type="file"
                          id="warranty-file-input"
                          onChange={(e) => setNewRecord({ ...newRecord, warrantyFile: e.target.files?.[0] || null })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          accept="image/*,.pdf"
                        />
                        <label
                          htmlFor="warranty-file-input"
                          className="flex items-center gap-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-slate-300">
                            {newRecord.warrantyFile ? newRecord.warrantyFile.name : 'Select file'}
                          </span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Warranty End Date
                      </label>
                      <input
                        type="date"
                        value={newRecord.warrantyEndDate}
                        onChange={(e) => setNewRecord({ ...newRecord, warrantyEndDate: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>
                    {newRecord.warrantyEndDate && (
                      <div>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="addWarrantyToDashboard"
                            checked={newRecord.addWarrantyToDashboard || false}
                            onChange={(e) => setNewRecord({ ...newRecord, addWarrantyToDashboard: e.target.checked })}
                            className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                          />
                          <label htmlFor="addWarrantyToDashboard" className="text-sm text-slate-300 cursor-pointer">
                            Add warranty end date to dashboard calendar
                          </label>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Repair Pictures
                      </label>
                      <div className="relative">
                        <input
                          ref={repairPicturesInputRef}
                          type="file"
                          id="repair-pictures-input"
                          multiple
                          accept="image/*"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setNewRecord({ ...newRecord, repairPictures: [...newRecord.repairPictures, ...files] });
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <label
                          htmlFor="repair-pictures-input"
                          className="flex items-center gap-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-slate-300">
                            {newRecord.repairPictures.length > 0 
                              ? `${newRecord.repairPictures.length} image${newRecord.repairPictures.length > 1 ? 's' : ''} selected`
                              : 'Select images'}
                          </span>
                        </label>
                      </div>
                      {newRecord.repairPictures.length > 0 && (
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                          {newRecord.repairPictures.map((file, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`Repair picture ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg border border-slate-700"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newPictures = newRecord.repairPictures.filter((_, i) => i !== index);
                                  setNewRecord({ ...newRecord, repairPictures: newPictures });
                                }}
                                className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove picture"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedHeader?.categoryType === 'Home' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Online User Manual
                        </label>
                        <input
                          type="url"
                          value={newRecord.manualLink}
                          onChange={(e) => setNewRecord({ ...newRecord, manualLink: e.target.value })}
                          placeholder="https://example.com/manual"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Notes
                      </label>
                      <textarea
                        value={newRecord.notes}
                        onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                        placeholder="Additional notes..."
                        rows={3}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                      />
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={cancelAddingRecord}
                        className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveNewRecord}
                        disabled={isSaving}
                        className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? 'Saving...' : 'Save Repair'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* History Records List */}
              {!isAddingRecord && (
                <div className="space-y-4">
                  {filteredRecords.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
                      <p className="text-slate-400 mb-4">No records found. Add your first repair or replacement record!</p>
                    </div>
                  ) : (
                    filteredRecords.map((record) => (
                      editingRecordId === record.id && editingRecord ? (
                        // Edit mode
                        <div key={record.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                          <h3 className="text-lg font-semibold text-slate-50 mb-4">Edit Record</h3>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                  Date <span className="text-red-400">*</span>
                                </label>
                                <input
                                  type="date"
                                  value={editingRecord.date}
                                  onChange={(e) => setEditingRecord({ ...editingRecord, date: e.target.value })}
                                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                  Repaired Item <span className="text-red-400">*</span>
                                </label>
                                {selectedHeader?.categoryType === 'Home' && editingRecord ? (
                                  <select
                                    value={editingRecord.itemName}
                                    onChange={(e) => setEditingRecord({ ...editingRecord, itemName: e.target.value })}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                  >
                                    <option value="">Select an item...</option>
                                    {getUniqueAreas().map((area) => {
                                      const areaItems = getItemsByArea(area);
                                      return (
                                        <optgroup key={area} label={area}>
                                          {areaItems.map((item) => (
                                            <option key={item.id} value={item.name}>
                                              {item.name}
                                            </option>
                                          ))}
                                        </optgroup>
                                      );
                                    })}
                                  </select>
                                ) : editingRecord ? (
                                  <input
                                    type="text"
                                    value={editingRecord.itemName}
                                    onChange={(e) => setEditingRecord({ ...editingRecord, itemName: e.target.value })}
                                    placeholder="e.g., Washing Machine"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                  />
                                ) : null}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                Type <span className="text-red-400">*</span>
                              </label>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`edit-type-${record.id}`}
                                    value="repair"
                                    checked={editingRecord.type === 'repair'}
                                    onChange={(e) => setEditingRecord({ ...editingRecord, type: e.target.value as 'repair' | 'replace' })}
                                    className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                                  />
                                  <span className="text-sm text-slate-200">Repair</span>
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`edit-type-${record.id}`}
                                    value="replace"
                                    checked={editingRecord.type === 'replace'}
                                    onChange={(e) => setEditingRecord({ ...editingRecord, type: e.target.value as 'repair' | 'replace' })}
                                    className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                                  />
                                  <span className="text-sm text-slate-200">Replace</span>
                                </label>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                Description
                              </label>
                              <textarea
                                value={editingRecord.description}
                                onChange={(e) => setEditingRecord({ ...editingRecord, description: e.target.value })}
                                rows={3}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                  Cost
                                </label>
                                <input
                                  type="text"
                                  value={editingRecord.cost}
                                  onChange={(e) => setEditingRecord({ ...editingRecord, cost: e.target.value })}
                                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                  Service Provider
                                </label>
                                <input
                                  type="text"
                                  value={editingRecord.serviceProvider}
                                  onChange={(e) => setEditingRecord({ ...editingRecord, serviceProvider: e.target.value })}
                                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-3 mb-3">
                                <input
                                  type="checkbox"
                                  id="editSubmittedToInsurance"
                                  checked={editingRecord.submittedToInsurance || false}
                                  onChange={(e) => setEditingRecord({ ...editingRecord, submittedToInsurance: e.target.checked })}
                                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                                />
                                <label htmlFor="editSubmittedToInsurance" className="text-sm text-slate-300 cursor-pointer">
                                  Was this repair submitted to your insurance?
                                </label>
                              </div>
                              {editingRecord.submittedToInsurance && (
                                <div className="space-y-4 mt-4 p-4 rounded-lg border border-slate-700 bg-slate-800/50">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                        Insurance Carrier
                                      </label>
                                      <input
                                        type="text"
                                        value={editingRecord.insuranceCarrier || ''}
                                        onChange={(e) => setEditingRecord({ ...editingRecord, insuranceCarrier: e.target.value })}
                                        placeholder="e.g., State Farm"
                                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                        Claim Number
                                      </label>
                                      <input
                                        type="text"
                                        value={editingRecord.claimNumber || ''}
                                        onChange={(e) => setEditingRecord({ ...editingRecord, claimNumber: e.target.value })}
                                        placeholder="e.g., CL-123456"
                                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                      Amount Insurance Paid
                                    </label>
                                    <input
                                      type="text"
                                      value={editingRecord.amountInsurancePaid || ''}
                                      onChange={(e) => setEditingRecord({ ...editingRecord, amountInsurancePaid: e.target.value })}
                                      placeholder="e.g., $1,200.00"
                                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                      Agent Contact Info
                                    </label>
                                    <input
                                      type="text"
                                      value={editingRecord.agentContactInfo || ''}
                                      onChange={(e) => setEditingRecord({ ...editingRecord, agentContactInfo: e.target.value })}
                                      placeholder="e.g., John Doe - (555) 123-4567 - john@insurance.com"
                                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                      Claim Notes
                                    </label>
                                    <textarea
                                      value={editingRecord.claimNotes || ''}
                                      onChange={(e) => setEditingRecord({ ...editingRecord, claimNotes: e.target.value })}
                                      placeholder="Additional notes about the insurance claim..."
                                      rows={3}
                                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                Receipt
                              </label>
                              {editingRecord.receiptFileUrl && (
                                <div className="mb-2 text-sm text-slate-400">
                                  Current: {editingRecord.receiptFileName || 'Receipt file'}
                                </div>
                              )}
                              <div className="relative">
                                <input
                                  ref={editReceiptFileInputRef}
                                  type="file"
                                  id="edit-receipt-file-input"
                                  onChange={(e) => setEditingRecord({ ...editingRecord, receiptFile: e.target.files?.[0] || null })}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  accept="image/*,.pdf"
                                />
                                <label
                                  htmlFor="edit-receipt-file-input"
                                  className="flex items-center gap-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                  </svg>
                                  <span className="text-slate-300">
                                    {editingRecord.receiptFile ? editingRecord.receiptFile.name : 'Select file'}
                                  </span>
                                </label>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                Warranty
                              </label>
                              {editingRecord.warrantyFileUrl && (
                                <div className="mb-2 text-sm text-slate-400">
                                  Current: {editingRecord.warrantyFileName || 'Warranty file'}
                                </div>
                              )}
                              <div className="relative">
                                <input
                                  ref={editWarrantyFileInputRef}
                                  type="file"
                                  id="edit-warranty-file-input"
                                  onChange={(e) => setEditingRecord({ ...editingRecord, warrantyFile: e.target.files?.[0] || null })}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  accept="image/*,.pdf"
                                />
                                <label
                                  htmlFor="edit-warranty-file-input"
                                  className="flex items-center gap-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                  </svg>
                                  <span className="text-slate-300">
                                    {editingRecord.warrantyFile ? editingRecord.warrantyFile.name : 'Select file'}
                                  </span>
                                </label>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                Warranty End Date
                              </label>
                              <input
                                type="date"
                                value={editingRecord.warrantyEndDate || ''}
                                onChange={(e) => setEditingRecord({ ...editingRecord, warrantyEndDate: e.target.value })}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            {editingRecord.warrantyEndDate && (
                              <div>
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    id="editAddWarrantyToDashboard"
                                    checked={editingRecord.addWarrantyToDashboard || false}
                                    onChange={(e) => setEditingRecord({ ...editingRecord, addWarrantyToDashboard: e.target.checked })}
                                    className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                                  />
                                  <label htmlFor="editAddWarrantyToDashboard" className="text-sm text-slate-300 cursor-pointer">
                                    Add warranty end date to dashboard calendar
                                  </label>
                                </div>
                              </div>
                            )}
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                Repair Pictures
                              </label>
                              <div className="relative">
                                <input
                                  ref={editRepairPicturesInputRef}
                                  type="file"
                                  id="edit-repair-pictures-input"
                                  multiple
                                  accept="image/*"
                                  onChange={(e) => {
                                    if (!editingRecord) return;
                                    const files = Array.from(e.target.files || []);
                                    setEditingRecord({ ...editingRecord, repairPictures: [...(editingRecord.repairPictures || []), ...files] });
                                  }}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <label
                                  htmlFor="edit-repair-pictures-input"
                                  className="flex items-center gap-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-slate-300">
                                    {editingRecord && ((editingRecord.repairPictures?.length || 0) + (editingRecord.repairPictureUrls?.length || 0) > 0)
                                      ? `${(editingRecord.repairPictures?.length || 0) + (editingRecord.repairPictureUrls?.length || 0)} image${((editingRecord.repairPictures?.length || 0) + (editingRecord.repairPictureUrls?.length || 0)) > 1 ? 's' : ''} selected`
                                      : 'Select images'}
                                  </span>
                                </label>
                              </div>
                              {editingRecord && ((editingRecord.repairPictures?.length || 0) > 0 || (editingRecord.repairPictureUrls?.length || 0) > 0) && (
                                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                                  {editingRecord.repairPictureUrls?.map((url, index) => (
                                    <div key={`url-${index}`} className="relative group">
                                      <img
                                        src={url}
                                        alt={`Repair picture ${index + 1}`}
                                        className="w-full h-32 object-cover rounded-lg border border-slate-700"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!editingRecord) return;
                                          const newUrls = editingRecord.repairPictureUrls?.filter((_, i) => i !== index) || [];
                                          setEditingRecord({ ...editingRecord, repairPictureUrls: newUrls });
                                        }}
                                        className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Remove picture"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                  {editingRecord.repairPictures?.map((file, index) => (
                                    <div key={`file-${index}`} className="relative group">
                                      <img
                                        src={URL.createObjectURL(file)}
                                        alt={`Repair picture ${index + 1}`}
                                        className="w-full h-32 object-cover rounded-lg border border-slate-700"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!editingRecord) return;
                                          const newPictures = editingRecord.repairPictures?.filter((_, i) => i !== index) || [];
                                          setEditingRecord({ ...editingRecord, repairPictures: newPictures });
                                        }}
                                        className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Remove picture"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                Online User Manual
                              </label>
                              <input
                                type="url"
                                value={editingRecord.manualLink}
                                onChange={(e) => setEditingRecord({ ...editingRecord, manualLink: e.target.value })}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                Notes
                              </label>
                              <textarea
                                value={editingRecord.notes}
                                onChange={(e) => setEditingRecord({ ...editingRecord, notes: e.target.value })}
                                rows={3}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                              />
                            </div>
                            <div className="flex gap-3 justify-end">
                              <button
                                onClick={cancelEditingRecord}
                                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={saveRecordEdit}
                                disabled={isSaving}
                                className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isSaving ? 'Saving...' : 'Save Changes'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Display mode
                        <div key={record.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-slate-50">{record.itemName}</h3>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  record.type === 'repair'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
                                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                                }`}>
                                  {record.type === 'repair' ? 'Repair' : 'Replace'}
                                </span>
                              </div>
                              <p className="text-sm text-slate-400 mb-1">
                                Date: <span className="text-slate-200">{new Date(record.date).toLocaleDateString()}</span>
                              </p>
                              {record.cost && (
                                <p className="text-sm text-slate-400 mb-1">
                                  Cost: <span className="text-slate-200">{record.cost}</span>
                                </p>
                              )}
                              {record.serviceProvider && (
                                <p className="text-sm text-slate-400 mb-1">
                                  Service Provider: <span className="text-slate-200">{record.serviceProvider}</span>
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => startEditingRecord(record)}
                                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteConfirmRecordId(record.id)}
                                className="px-3 py-1.5 rounded-lg border border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          {record.description && (
                            <div className="mb-3">
                              <p className="text-sm text-slate-300 whitespace-pre-line">{record.description}</p>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-4 text-sm">
                            {record.receiptFileUrl && (
                              <a
                                href={record.receiptFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                Receipt
                              </a>
                            )}
                            {record.warrantyFileUrl && (
                              <a
                                href={record.warrantyFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Warranty
                              </a>
                            )}
                            {record.manualLink && (
                              <a
                                href={record.manualLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Manual
                              </a>
                            )}
                          </div>
                          {record.notes && (
                            <div className="mt-3 pt-3 border-t border-slate-700">
                              <p className="text-sm text-slate-400">
                                <span className="font-medium text-slate-300">Notes:</span> {record.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Items Tab */}
          {activeTab === 'items' && (
            <div className="space-y-6">
              {/* Add New Item Button */}
              {!isAddingItem && (
                <div className="flex justify-start">
                  <button
                    onClick={startAddingItem}
                    className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    + Add New Item
                  </button>
                </div>
              )}

              {/* Add Item Form */}
              {isAddingItem && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <h3 className="text-lg font-semibold text-slate-50 mb-4">Add New Item</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-slate-300">
                          Area <span className="text-red-400">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingNewArea(!isCreatingNewArea);
                            setNewItemArea('');
                          }}
                          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          {isCreatingNewArea ? 'Select existing area' : '+ Create new area'}
                        </button>
                      </div>
                      {isCreatingNewArea ? (
                        <input
                          type="text"
                          value={newItemArea}
                          onChange={(e) => setNewItemArea(e.target.value)}
                          placeholder="Enter new area name..."
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      ) : (
                        <select
                          value={newItemArea}
                          onChange={(e) => setNewItemArea(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        >
                          <option value="">Select an area...</option>
                          {getUniqueAreas().map(area => (
                            <option key={area} value={area}>
                              {area}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Item Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="e.g., Washing Machine"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={cancelAddingItem}
                        className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveNewItem}
                        disabled={isSaving}
                        className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? 'Saving...' : 'Save Item'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Items by Area */}
              {!isAddingItem && (
                <div className="space-y-6">
                  {getUniqueAreas().map((area) => {
                    const areaItems = getItemsByArea(area);
                    const isExpanded = isAreaExpanded(area);
                    return (
                      <div key={area} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                        <button
                          onClick={() => toggleArea(area)}
                          className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
                        >
                          <h3 className="text-lg font-semibold text-slate-50">{area}</h3>
                          <svg
                            className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isExpanded && (
                          <div className="space-y-2">
                            {areaItems.map((item) => (
                            editingItemId === item.id ? (
                              // Edit mode
                              <div key={item.id} className="space-y-2 p-3 rounded-lg border border-slate-700 bg-slate-800/50">
                                <div>
                                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Area <span className="text-red-400">*</span>
                                  </label>
                                  <select
                                    value={editingItemArea}
                                    onChange={(e) => setEditingItemArea(e.target.value)}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                  >
                                    <option value="">Select an area...</option>
                                    {getUniqueAreas().map(area => (
                                      <option key={area} value={area}>
                                        {area}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Item Name <span className="text-red-400">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={editingItemName}
                                    onChange={(e) => setEditingItemName(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        saveItemEdit();
                                      } else if (e.key === 'Escape') {
                                        cancelEditingItem();
                                      }
                                    }}
                                    autoFocus
                                  />
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={cancelEditingItem}
                                    className="px-3 py-1.5 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={saveItemEdit}
                                    disabled={isSaving || !editingItemName.trim() || !editingItemArea.trim()}
                                    className="px-3 py-1.5 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // Display mode
                              <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors">
                                <span className="text-sm text-slate-200">{item.name}</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => startEditingItem(item)}
                                    className="px-2 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors text-xs"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteConfirmItemId(item.id);
                                      setDeleteConfirmItemText('');
                                    }}
                                    className="px-2 py-1 rounded border border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors text-xs"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )
                          ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h3 className="text-lg font-semibold text-slate-50 mb-4">Export Repair History Report</h3>
                <p className="text-slate-300 mb-4">
                  Generate a comprehensive PDF report of all your repair history records. The report will include all repair and replacement details, summary statistics, and category breakdown.
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
        </>
      )}

      {/* Delete Record Confirmation Modal */}
      {deleteConfirmRecordId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete Record</h3>
            <p className="text-slate-300 mb-4">
              Are you sure you want to delete this record? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={deleteRecord}
                disabled={isSaving}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteConfirmRecordId(null)}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    // TODO: Implement PDF export functionality
                    setShowExportPopup(false);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
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

      {/* Delete Item Confirmation Modal */}
      {deleteConfirmItemId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete Item</h3>
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4">
              <p className="text-red-300 font-semibold mb-2">⚠️ Warning: This action cannot be undone!</p>
              <p className="text-red-200 text-sm">
                This item will be <strong>permanently deleted</strong> and cannot be recovered.
              </p>
            </div>
            <p className="text-slate-300 mb-4">
              To confirm deletion, please type <strong className="text-slate-200">delete</strong> in the box below:
            </p>
            <input
              type="text"
              value={deleteConfirmItemText}
              onChange={(e) => setDeleteConfirmItemText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDeleteConfirmItemId(null);
                  setDeleteConfirmItemText('');
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={deleteItem}
                disabled={deleteConfirmItemText.toLowerCase() !== 'delete' || isSaving}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Deleting...' : 'Delete Item'}
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmItemId(null);
                  setDeleteConfirmItemText('');
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
    </div>
  );
}
