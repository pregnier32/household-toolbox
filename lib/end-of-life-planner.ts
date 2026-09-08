/**
 * End of Life Planner — client types, seed data, completion math, and draft persist.
 *
 * Future API: /api/tools/end-of-life-planner
 * Future tables: tools_eol_*
 *
 * Temporary until API/DB pass — easy to rip out:
 * localStorage key ht-eol-planner-ui-draft is a stand-in so auto-save and
 * “resume later” can be demonstrated. Replace loadEolDraft / saveEolDraft
 * with the API without rewriting screens.
 */

export const EOL_UI_DRAFT_STORAGE_KEY = 'ht-eol-planner-ui-draft';

export const EOL_TOOL_TITLE = 'End of Life Planner';
export const EOL_TOOL_DESCRIPTION =
  'Create a plan for each person in the household and record the information loved ones may need.';

/** Fields marked sensitivity: 'secret' are candidates for extra encryption later. */
export type EolSecretString = {
  value: string;
  sensitivity: 'secret';
};

export function emptySecret(value = ''): EolSecretString {
  return { value, sensitivity: 'secret' };
}

export function secretText(field: EolSecretString | string | null | undefined): string {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  return field.value ?? '';
}

export function withSecret(value: string): EolSecretString {
  return { value, sensitivity: 'secret' };
}

export type EolPlanStatus = 'Active' | 'Archived';

export type EolRelationship = 'Spouse/partner' | 'Self' | 'Parent' | 'Child' | 'Other';

export const EOL_RELATIONSHIPS: EolRelationship[] = [
  'Spouse/partner',
  'Self',
  'Parent',
  'Child',
  'Other',
];

export type EolSectionStatus = 'Not started' | 'In progress' | 'Complete';

export type EolBuiltInSectionId =
  | 'personal'
  | 'contacts'
  | 'devices'
  | 'online'
  | 'documents'
  | 'insurance'
  | 'financial'
  | 'home'
  | 'nextSteps'
  | 'eolWishes'
  | 'myWishes'
  | 'letters'
  | 'other';

export type EolCustomTemplate =
  | 'contacts'
  | 'devices'
  | 'online'
  | 'documents'
  | 'insurance'
  | 'letters'
  | 'other';

export const EOL_CUSTOM_TEMPLATES: { id: EolCustomTemplate; label: string }[] = [
  { id: 'contacts', label: 'Important Contacts' },
  { id: 'devices', label: 'Device Login' },
  { id: 'online', label: 'Online Login' },
  { id: 'documents', label: 'Important Document Notes' },
  { id: 'insurance', label: 'Insurance Information' },
  { id: 'letters', label: 'Letters' },
  { id: 'other', label: 'Other / Custom Record' },
];

export const EOL_BUILT_IN_TABS: { id: EolBuiltInSectionId; label: string }[] = [
  { id: 'personal', label: 'Personal Record' },
  { id: 'contacts', label: 'Important Contacts' },
  { id: 'devices', label: 'Device Login' },
  { id: 'online', label: 'Online Login' },
  { id: 'documents', label: 'Important Document Notes' },
  { id: 'insurance', label: 'Insurance Information' },
  { id: 'financial', label: 'Financial Info' },
  { id: 'home', label: 'Home Info' },
  { id: 'nextSteps', label: 'Next Steps' },
  { id: 'eolWishes', label: 'End of Life Wishes' },
  { id: 'myWishes', label: 'My Wishes' },
  { id: 'letters', label: 'Letters' },
  { id: 'other', label: 'Other' },
];

export type EolFamilyPerson = {
  id: string;
  name: string;
  notes: string;
};

export type EolPersonalRecord = {
  fullLegalName: string;
  preferredName: string;
  previousNames: string;
  dateOfBirth: string;
  placeOfBirth: string;
  ssn: EolSecretString;
  maritalStatus: string;
  spousePartner: string;
  homeAddress: string;
  phone: string;
  personalEmail: string;
  driversLicenseNumber: EolSecretString;
  driversLicenseState: string;
  passportNumber: EolSecretString;
  passportExpiration: string;
  otherIdentification: string;
  employer: string;
  jobTitle: string;
  employerContact: string;
  hrContact: string;
  workPhone: string;
  workEmail: string;
  veteranStatus: string;
  militaryBranch: string;
  serviceDates: string;
  militaryId: string;
  dischargeRecordsLocation: string;
  familySpouse: string;
  children: EolFamilyPerson[];
  parents: EolFamilyPerson[];
  dependents: EolFamilyPerson[];
  emergencyFamilyContact: string;
};

export const CONTACT_TYPES = [
  'Spouse/partner',
  'Child',
  'Family member',
  'Close friend',
  'Attorney',
  'Estate attorney',
  'Executor/personal representative',
  'Financial advisor',
  'Accountant/CPA',
  'Insurance agent',
  'Banker',
  'Employer/HR',
  'Business partner',
  'Clergy/religious contact',
  'Funeral home',
  'Doctor',
  'Other',
] as const;

export type EolContact = {
  id: string;
  name: string;
  relationship: string;
  contactType: string;
  company: string;
  phone: string;
  alternatePhone: string;
  email: string;
  address: string;
  whyContact: string;
  priority: number;
};

export const DEVICE_TYPES = ['Phone', 'Tablet', 'Laptop', 'Desktop', 'Safe', 'Security system', 'Other'] as const;

export type EolDevice = {
  id: string;
  name: string;
  deviceType: string;
  manufacturer: string;
  model: string;
  location: string;
  username: string;
  pin: EolSecretString;
  password: EolSecretString;
  recoveryKey: EolSecretString;
  associatedAccount: string;
  accessInstructions: string;
  storedInformation: string;
};

export const ONLINE_CATEGORIES = [
  'Email',
  'Banking',
  'Investments',
  'Retirement',
  'Credit cards',
  'Utilities',
  'Social media',
  'Cloud storage',
  'Shopping',
  'Subscriptions',
  'Business',
  'Cryptocurrency',
  'Website/domain',
  'Other',
] as const;

export const ACCOUNT_DISPOSITIONS = [
  'Close',
  'Preserve',
  'Transfer',
  'Memorialize',
  'Let family decide',
] as const;

export const PASSWORD_MANAGERS = [
  '1Password',
  'Bitwarden',
  'Apple Passwords',
  'Google Password Manager',
  'Browser',
  'Physical document',
  'Other',
] as const;

export type EolOnlineAccount = {
  id: string;
  serviceName: string;
  website: string;
  category: string;
  username: string;
  password: EolSecretString;
  mfaEnabled: '' | 'yes' | 'no';
  mfaMethod: string;
  mfaLocation: EolSecretString;
  recoveryEmail: EolSecretString;
  recoveryPhone: EolSecretString;
  accountReference: string;
  disposition: string;
  specialInstructions: string;
  passwordStoredElsewhere: string;
  passwordStoredElsewhereDetail: string;
};

export const DOCUMENT_TYPES = [
  'Will',
  'Trust',
  'Power of Attorney',
  'Healthcare Directive',
  'Living Will',
  'Birth Certificate',
  'Marriage Certificate',
  'Divorce Records',
  'Social Security Card',
  'Passport',
  'Property Deed',
  'Vehicle Title',
  'Business Documents',
  'Tax Returns',
  'Military Records',
  'Funeral Documents',
  'Cemetery Documents',
  'Other',
] as const;

export type EolDocumentNote = {
  id: string;
  name: string;
  documentType: string;
  originalOrCopy: string;
  physicalLocation: string;
  digitalLocation: string;
  whoHasCopy: string;
  attorneyContact: string;
  dateCreated: string;
  lastUpdated: string;
  expirationDate: string;
  specialInstructions: string;
};

export const POLICY_TYPES = [
  'Life',
  'Health',
  'Dental',
  'Vision',
  'Homeowners',
  'Renters',
  'Auto',
  'Umbrella',
  'Long-term care',
  'Disability',
  'Business',
  'Accidental death',
  'Other',
] as const;

export type EolInsurancePolicy = {
  id: string;
  company: string;
  policyType: string;
  policyNumber: string;
  policyholder: string;
  insuredPerson: string;
  agent: string;
  agentContact: string;
  beneficiary: string;
  coverageAmount: string;
  premium: string;
  paymentFrequency: string;
  automaticPayment: '' | 'yes' | 'no';
  paymentAccount: string;
  expirationRenewal: string;
  website: string;
  claimContact: string;
  documentLocation: string;
  instructions: string;
};

export const BANK_ACCOUNT_TYPES = ['Checking', 'Savings', 'Money market', 'CD', 'Other'] as const;

export type EolBankAccount = {
  id: string;
  institution: string;
  accountType: string;
  owners: string;
  lastFour: string;
  jointOwner: string;
  beneficiary: string;
  bankContact: string;
  website: string;
  loginStorage: string;
  purpose: string;
};

export const INVESTMENT_TYPES = [
  'Brokerage',
  'Traditional IRA',
  'Roth IRA',
  '401(k)',
  '403(b)',
  'Pension',
  'HSA',
  'Annuity',
  'Other',
] as const;

export type EolInvestmentAccount = {
  id: string;
  institution: string;
  accountType: string;
  owner: string;
  accountReference: string;
  beneficiaries: string;
  advisor: string;
  websiteLogin: string;
};

export type EolCreditCard = {
  id: string;
  issuer: string;
  cardType: string;
  lastFour: string;
  primaryHolder: string;
  authorizedUsers: string;
  automaticPayments: string;
  balanceNotes: string;
  closingInstructions: string;
};

export const DEBT_TYPES = [
  'Mortgage',
  'Auto',
  'Personal',
  'Student',
  'Business',
  'Credit line',
  'Other',
] as const;

export type EolDebt = {
  id: string;
  creditor: string;
  debtType: string;
  accountReference: string;
  approximateBalance: string;
  monthlyPayment: string;
  automaticPayment: string;
  collateral: string;
  contact: string;
};

export const INCOME_TYPES = [
  'Employer',
  'Social Security',
  'Pension',
  'Rental property',
  'Business',
  'Investment',
  'Annuity',
  'Other',
] as const;

export type EolIncomeSource = {
  id: string;
  incomeType: string;
  amountFrequency: string;
  depositedWhere: string;
  contact: string;
  survivorBenefits: '' | 'yes' | 'no';
};

export type EolRecurringBill = {
  id: string;
  company: string;
  description: string;
  amount: string;
  frequency: string;
  dueDate: string;
  automaticPayment: '' | 'yes' | 'no';
  paymentAccount: string;
  cancelAfterDeath: '' | 'yes' | 'no';
};

export type EolFinancialInfo = {
  bankAccounts: EolBankAccount[];
  investments: EolInvestmentAccount[];
  creditCards: EolCreditCard[];
  debts: EolDebt[];
  incomeSources: EolIncomeSource[];
  recurringBills: EolRecurringBill[];
};

export type EolProperty = {
  address: string;
  ownershipType: string;
  otherOwners: string;
  mortgageCompany: string;
  mortgageReference: string;
  mortgageBalance: string;
  monthlyPayment: string;
  propertyTax: string;
  homeownersInsurance: string;
  deedLocation: string;
};

export const UTILITY_TYPES = [
  'Electricity',
  'Gas',
  'Water',
  'Sewer',
  'Garbage',
  'Internet',
  'Cable/streaming',
  'Phone',
  'Security system',
  'Propane',
  'Other',
] as const;

export type EolUtility = {
  id: string;
  utilityType: string;
  provider: string;
  accountReference: string;
  contact: string;
  automaticPayment: string;
  paymentSource: string;
  loginReference: string;
};

export type EolHomeAccess = {
  garageCode: EolSecretString;
  alarmInformation: EolSecretString;
  safeLocation: string;
  safeInstructions: EolSecretString;
  spareKeyLocation: string;
  mailboxInformation: string;
  cameraInformation: string;
};

export const HOME_PROVIDER_TYPES = [
  'HVAC',
  'Plumbing',
  'Electrical',
  'Lawn',
  'Snow removal',
  'Cleaning',
  'Pest control',
  'Pool',
  'Other',
] as const;

export type EolHomeProvider = {
  id: string;
  providerType: string;
  name: string;
  contact: string;
  accountReference: string;
  notes: string;
};

export type EolVehicle = {
  id: string;
  year: string;
  make: string;
  model: string;
  vin: string;
  loanInformation: string;
  titleLocation: string;
  insurance: string;
  spareKeyLocation: string;
};

export type EolHomeInfo = {
  property: EolProperty;
  utilities: EolUtility[];
  access: EolHomeAccess;
  providers: EolHomeProvider[];
  vehicles: EolVehicle[];
};

export type EolStepPriority = 'High' | 'Medium' | 'Low';
export type EolStepStatus = 'Not started' | 'Completed' | 'Not applicable';

export type EolNextStep = {
  id: string;
  seedKey?: string;
  isPredefined: boolean;
  hidden: boolean;
  title: string;
  priority: EolStepPriority;
  personResponsible: string;
  instructions: string;
  relatedContactId: string;
  relatedDocument: string;
  status: EolStepStatus;
};

export const NEXT_STEP_SEEDS: { seedKey: string; title: string; priority: EolStepPriority }[] = [
  { seedKey: 'contact-spouse', title: 'Contact my spouse/family', priority: 'High' },
  { seedKey: 'contact-executor', title: 'Contact executor/personal representative', priority: 'High' },
  { seedKey: 'contact-attorney', title: 'Contact attorney', priority: 'High' },
  { seedKey: 'locate-will', title: 'Locate my will', priority: 'High' },
  { seedKey: 'locate-directive', title: 'Locate healthcare directive', priority: 'High' },
  { seedKey: 'contact-life-insurance', title: 'Contact life insurance companies', priority: 'High' },
  { seedKey: 'notify-employer', title: 'Notify employer', priority: 'Medium' },
  { seedKey: 'contact-advisor', title: 'Contact financial advisor', priority: 'Medium' },
  { seedKey: 'contact-ssa', title: 'Contact Social Security if applicable', priority: 'Medium' },
  { seedKey: 'contact-pension', title: 'Contact pension/retirement administrator', priority: 'Medium' },
  { seedKey: 'secure-devices', title: 'Secure my phone/computers', priority: 'High' },
  { seedKey: 'secure-home', title: 'Secure my home', priority: 'High' },
  { seedKey: 'care-pets', title: 'Take care of pets', priority: 'High' },
  { seedKey: 'review-autopay', title: 'Review automatic payments', priority: 'Medium' },
  { seedKey: 'review-bills', title: 'Review upcoming bills', priority: 'Medium' },
  { seedKey: 'cancel-subs', title: 'Cancel unnecessary subscriptions', priority: 'Low' },
  { seedKey: 'secure-valuables', title: 'Secure physical valuables', priority: 'Medium' },
  { seedKey: 'contact-funeral', title: 'Contact funeral home', priority: 'High' },
  { seedKey: 'follow-funeral', title: 'Follow funeral/memorial instructions', priority: 'High' },
  { seedKey: 'review-online', title: 'Review online accounts', priority: 'Medium' },
  { seedKey: 'review-business', title: 'Review business responsibilities', priority: 'Medium' },
];

export type EolEndOfLifeWishes = {
  dispositionPreference: string;
  funeralHome: string;
  funeralHomeContact: string;
  cemetery: string;
  cemeteryPlot: string;
  paperworkLocation: string;
  funeralServiceDesired: '' | 'yes' | 'no';
  memorialServiceDesired: '' | 'yes' | 'no';
  religiousService: '' | 'yes' | 'no';
  clergy: string;
  viewing: '' | 'yes' | 'no';
  casketPreference: string;
  preferredLocation: string;
  preferredMusic: string;
  preferredReadings: string;
  preferredSpeakers: string;
  obituaryWishes: string;
  peopleToNotify: string;
  organizationsToNotify: string;
  flowersPreference: string;
  memorialDonation: string;
  pallbearerPreferences: string;
  clothingPreference: string;
  militaryHonors: string;
  headstoneWishes: string;
  ashesInstructions: string;
  organDonationWishes: string;
  prepaidArrangements: string;
  funeralContractLocation: string;
};

export const MY_WISHES_QUESTIONS: { key: keyof EolMyWishesQuestions; label: string }[] = [
  { key: 'mostImportant', label: 'What is most important to me?' },
  { key: 'familyToKnow', label: 'Things I want my family to know' },
  { key: 'traditions', label: 'Family traditions I hope continue' },
  { key: 'specialBelongings', label: 'Personal belongings with special meaning' },
  { key: 'specificGifts', label: 'Items I would like specific people to receive' },
  { key: 'charitableWishes', label: 'Charitable wishes' },
  { key: 'importantOrganizations', label: 'Organizations important to me' },
  { key: 'petsCare', label: 'Pets and how I would like them cared for' },
  { key: 'socialMedia', label: 'Social media wishes' },
  { key: 'digitalMedia', label: 'Digital photo/video wishes' },
  { key: 'collections', label: 'What should happen to personal collections?' },
  { key: 'personalFiles', label: 'What should happen to my personal files?' },
  { key: 'phoneComputer', label: 'What should happen to my phone/computer?' },
  { key: 'onlinePresence', label: 'What should happen to my online presence?' },
  { key: 'thankedRemembered', label: 'People I especially want thanked or remembered' },
  { key: 'doNotWant', label: 'Anything I do not want done' },
];

export type EolMyWishesQuestions = {
  mostImportant: string;
  familyToKnow: string;
  traditions: string;
  specialBelongings: string;
  specificGifts: string;
  charitableWishes: string;
  importantOrganizations: string;
  petsCare: string;
  socialMedia: string;
  digitalMedia: string;
  collections: string;
  personalFiles: string;
  phoneComputer: string;
  onlinePresence: string;
  thankedRemembered: string;
  doNotWant: string;
};

export type EolPersonalItem = {
  id: string;
  item: string;
  description: string;
  location: string;
  recipient: string;
  reason: string;
  photoReference: string;
  specialInstructions: string;
};

export type EolMyWishes = EolMyWishesQuestions & {
  personalItems: EolPersonalItem[];
};

export const LETTER_TYPES = [
  'Spouse/partner',
  'Child',
  'Grandchild',
  'Parent',
  'Sibling',
  'Friend',
  'Family',
  'Coworkers',
  'Business partner',
  'General family letter',
  'Other',
] as const;

export type EolLetter = {
  id: string;
  title: string;
  recipient: string;
  letterType: string;
  /** Letter body is sensitive so a later pass can lock / encrypt it. */
  body: EolSecretString;
  whenToShare: string;
  instructions: string;
  status: 'Draft' | 'Complete';
  visibility: 'Visible' | 'Private';
  lastUpdated: string;
};

export type EolCustomField = {
  id: string;
  label: string;
  value: string;
};

export type EolCustomRecord = {
  id: string;
  title: string;
  category: string;
  description: string;
  importantDate: string;
  contact: string;
  location: string;
  website: string;
  instructions: string;
  customNotes: string;
  customFields: EolCustomField[];
};

export type EolCustomSection = {
  id: string;
  name: string;
  modeledAfter: EolCustomTemplate;
  notes: string;
  contacts: EolContact[];
  devices: EolDevice[];
  onlineAccounts: EolOnlineAccount[];
  documents: EolDocumentNote[];
  insurance: EolInsurancePolicy[];
  letters: EolLetter[];
  otherRecords: EolCustomRecord[];
};

export type EolPlanData = {
  personal: EolPersonalRecord;
  personalNotes: string;
  contacts: EolContact[];
  contactsNotes: string;
  devices: EolDevice[];
  devicesNotes: string;
  onlineAccounts: EolOnlineAccount[];
  onlineNotes: string;
  documents: EolDocumentNote[];
  documentsNotes: string;
  insurance: EolInsurancePolicy[];
  insuranceNotes: string;
  financial: EolFinancialInfo;
  financialNotes: string;
  home: EolHomeInfo;
  homeNotes: string;
  nextSteps: EolNextStep[];
  nextStepsNotes: string;
  eolWishes: EolEndOfLifeWishes;
  eolWishesNotes: string;
  myWishes: EolMyWishes;
  myWishesNotes: string;
  letters: EolLetter[];
  lettersNotes: string;
  otherRecords: EolCustomRecord[];
  otherNotes: string;
  customSections: EolCustomSection[];
};

export type EolPlan = {
  id: string;
  name: string;
  personFullName: string;
  relationship: EolRelationship | '';
  relationshipCustom: string;
  dateOfBirth: string;
  dateCreated: string;
  lastUpdated: string;
  card_color: string;
  status: EolPlanStatus;
  data: EolPlanData;
};

export type EolDraftStore = {
  version: 1;
  plans: EolPlan[];
  selectedPlanId: string | null;
};

export function createEolId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Display dates as M/D/YYYY. Inputs stay type="date" / ISO internally. */
export function formatDateDisplay(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.split('T')[0].split('-');
  if (!year || !month || !day) return isoDate;
  return `${Number(month)}/${Number(day)}/${year}`;
}

export function formatDateTimeDisplay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return formatDateDisplay(iso);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
}

export function maskSecret(value: string, last4 = false): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (last4 && trimmed.length > 4) {
    return `••••${trimmed.slice(-4)}`;
  }
  return '••••••••';
}

export function emptyFamilyPerson(): EolFamilyPerson {
  return { id: createEolId('fam'), name: '', notes: '' };
}

export function emptyPersonalRecord(): EolPersonalRecord {
  return {
    fullLegalName: '',
    preferredName: '',
    previousNames: '',
    dateOfBirth: '',
    placeOfBirth: '',
    ssn: emptySecret(),
    maritalStatus: '',
    spousePartner: '',
    homeAddress: '',
    phone: '',
    personalEmail: '',
    driversLicenseNumber: emptySecret(),
    driversLicenseState: '',
    passportNumber: emptySecret(),
    passportExpiration: '',
    otherIdentification: '',
    employer: '',
    jobTitle: '',
    employerContact: '',
    hrContact: '',
    workPhone: '',
    workEmail: '',
    veteranStatus: '',
    militaryBranch: '',
    serviceDates: '',
    militaryId: '',
    dischargeRecordsLocation: '',
    familySpouse: '',
    children: [],
    parents: [],
    dependents: [],
    emergencyFamilyContact: '',
  };
}

export function emptyContact(): EolContact {
  return {
    id: createEolId('contact'),
    name: '',
    relationship: '',
    contactType: '',
    company: '',
    phone: '',
    alternatePhone: '',
    email: '',
    address: '',
    whyContact: '',
    priority: 1,
  };
}

export function emptyDevice(): EolDevice {
  return {
    id: createEolId('device'),
    name: '',
    deviceType: '',
    manufacturer: '',
    model: '',
    location: '',
    username: '',
    pin: emptySecret(),
    password: emptySecret(),
    recoveryKey: emptySecret(),
    associatedAccount: '',
    accessInstructions: '',
    storedInformation: '',
  };
}

export function emptyOnlineAccount(): EolOnlineAccount {
  return {
    id: createEolId('online'),
    serviceName: '',
    website: '',
    category: '',
    username: '',
    password: emptySecret(),
    mfaEnabled: '',
    mfaMethod: '',
    mfaLocation: emptySecret(),
    recoveryEmail: emptySecret(),
    recoveryPhone: emptySecret(),
    accountReference: '',
    disposition: '',
    specialInstructions: '',
    passwordStoredElsewhere: '',
    passwordStoredElsewhereDetail: '',
  };
}

export function emptyDocumentNote(): EolDocumentNote {
  return {
    id: createEolId('doc'),
    name: '',
    documentType: '',
    originalOrCopy: '',
    physicalLocation: '',
    digitalLocation: '',
    whoHasCopy: '',
    attorneyContact: '',
    dateCreated: '',
    lastUpdated: '',
    expirationDate: '',
    specialInstructions: '',
  };
}

export function emptyInsurancePolicy(): EolInsurancePolicy {
  return {
    id: createEolId('ins'),
    company: '',
    policyType: '',
    policyNumber: '',
    policyholder: '',
    insuredPerson: '',
    agent: '',
    agentContact: '',
    beneficiary: '',
    coverageAmount: '',
    premium: '',
    paymentFrequency: '',
    automaticPayment: '',
    paymentAccount: '',
    expirationRenewal: '',
    website: '',
    claimContact: '',
    documentLocation: '',
    instructions: '',
  };
}

export function emptyBankAccount(): EolBankAccount {
  return {
    id: createEolId('bank'),
    institution: '',
    accountType: '',
    owners: '',
    lastFour: '',
    jointOwner: '',
    beneficiary: '',
    bankContact: '',
    website: '',
    loginStorage: '',
    purpose: '',
  };
}

export function emptyInvestmentAccount(): EolInvestmentAccount {
  return {
    id: createEolId('invest'),
    institution: '',
    accountType: '',
    owner: '',
    accountReference: '',
    beneficiaries: '',
    advisor: '',
    websiteLogin: '',
  };
}

export function emptyCreditCard(): EolCreditCard {
  return {
    id: createEolId('card'),
    issuer: '',
    cardType: '',
    lastFour: '',
    primaryHolder: '',
    authorizedUsers: '',
    automaticPayments: '',
    balanceNotes: '',
    closingInstructions: '',
  };
}

export function emptyDebt(): EolDebt {
  return {
    id: createEolId('debt'),
    creditor: '',
    debtType: '',
    accountReference: '',
    approximateBalance: '',
    monthlyPayment: '',
    automaticPayment: '',
    collateral: '',
    contact: '',
  };
}

export function emptyIncomeSource(): EolIncomeSource {
  return {
    id: createEolId('income'),
    incomeType: '',
    amountFrequency: '',
    depositedWhere: '',
    contact: '',
    survivorBenefits: '',
  };
}

export function emptyRecurringBill(): EolRecurringBill {
  return {
    id: createEolId('bill'),
    company: '',
    description: '',
    amount: '',
    frequency: '',
    dueDate: '',
    automaticPayment: '',
    paymentAccount: '',
    cancelAfterDeath: '',
  };
}

export function emptyFinancialInfo(): EolFinancialInfo {
  return {
    bankAccounts: [],
    investments: [],
    creditCards: [],
    debts: [],
    incomeSources: [],
    recurringBills: [],
  };
}

export function emptyProperty(): EolProperty {
  return {
    address: '',
    ownershipType: '',
    otherOwners: '',
    mortgageCompany: '',
    mortgageReference: '',
    mortgageBalance: '',
    monthlyPayment: '',
    propertyTax: '',
    homeownersInsurance: '',
    deedLocation: '',
  };
}

export function emptyUtility(): EolUtility {
  return {
    id: createEolId('util'),
    utilityType: '',
    provider: '',
    accountReference: '',
    contact: '',
    automaticPayment: '',
    paymentSource: '',
    loginReference: '',
  };
}

export function emptyHomeAccess(): EolHomeAccess {
  return {
    garageCode: emptySecret(),
    alarmInformation: emptySecret(),
    safeLocation: '',
    safeInstructions: emptySecret(),
    spareKeyLocation: '',
    mailboxInformation: '',
    cameraInformation: '',
  };
}

export function emptyHomeProvider(): EolHomeProvider {
  return {
    id: createEolId('hprov'),
    providerType: '',
    name: '',
    contact: '',
    accountReference: '',
    notes: '',
  };
}

export function emptyVehicle(): EolVehicle {
  return {
    id: createEolId('veh'),
    year: '',
    make: '',
    model: '',
    vin: '',
    loanInformation: '',
    titleLocation: '',
    insurance: '',
    spareKeyLocation: '',
  };
}

export function emptyHomeInfo(): EolHomeInfo {
  return {
    property: emptyProperty(),
    utilities: [],
    access: emptyHomeAccess(),
    providers: [],
    vehicles: [],
  };
}

export function emptyNextStep(partial?: Partial<EolNextStep>): EolNextStep {
  return {
    id: createEolId('step'),
    isPredefined: false,
    hidden: false,
    title: '',
    priority: 'Medium',
    personResponsible: '',
    instructions: '',
    relatedContactId: '',
    relatedDocument: '',
    status: 'Not started',
    ...partial,
  };
}

export function seedNextSteps(): EolNextStep[] {
  return NEXT_STEP_SEEDS.map((seed) =>
    emptyNextStep({
      seedKey: seed.seedKey,
      isPredefined: true,
      title: seed.title,
      priority: seed.priority,
    })
  );
}

export function emptyEolWishes(): EolEndOfLifeWishes {
  return {
    dispositionPreference: '',
    funeralHome: '',
    funeralHomeContact: '',
    cemetery: '',
    cemeteryPlot: '',
    paperworkLocation: '',
    funeralServiceDesired: '',
    memorialServiceDesired: '',
    religiousService: '',
    clergy: '',
    viewing: '',
    casketPreference: '',
    preferredLocation: '',
    preferredMusic: '',
    preferredReadings: '',
    preferredSpeakers: '',
    obituaryWishes: '',
    peopleToNotify: '',
    organizationsToNotify: '',
    flowersPreference: '',
    memorialDonation: '',
    pallbearerPreferences: '',
    clothingPreference: '',
    militaryHonors: '',
    headstoneWishes: '',
    ashesInstructions: '',
    organDonationWishes: '',
    prepaidArrangements: '',
    funeralContractLocation: '',
  };
}

export function emptyMyWishesQuestions(): EolMyWishesQuestions {
  return {
    mostImportant: '',
    familyToKnow: '',
    traditions: '',
    specialBelongings: '',
    specificGifts: '',
    charitableWishes: '',
    importantOrganizations: '',
    petsCare: '',
    socialMedia: '',
    digitalMedia: '',
    collections: '',
    personalFiles: '',
    phoneComputer: '',
    onlinePresence: '',
    thankedRemembered: '',
    doNotWant: '',
  };
}

export function emptyPersonalItem(): EolPersonalItem {
  return {
    id: createEolId('item'),
    item: '',
    description: '',
    location: '',
    recipient: '',
    reason: '',
    photoReference: '',
    specialInstructions: '',
  };
}

export function emptyMyWishes(): EolMyWishes {
  return {
    ...emptyMyWishesQuestions(),
    personalItems: [],
  };
}

export function emptyLetter(): EolLetter {
  return {
    id: createEolId('letter'),
    title: '',
    recipient: '',
    letterType: '',
    body: emptySecret(),
    whenToShare: '',
    instructions: '',
    status: 'Draft',
    visibility: 'Visible',
    lastUpdated: nowIso(),
  };
}

export function emptyCustomField(): EolCustomField {
  return { id: createEolId('cfield'), label: '', value: '' };
}

export function emptyCustomRecord(): EolCustomRecord {
  return {
    id: createEolId('other'),
    title: '',
    category: '',
    description: '',
    importantDate: '',
    contact: '',
    location: '',
    website: '',
    instructions: '',
    customNotes: '',
    customFields: [],
  };
}

export function emptyCustomSection(name: string, modeledAfter: EolCustomTemplate): EolCustomSection {
  return {
    id: createEolId('csec'),
    name,
    modeledAfter,
    notes: '',
    contacts: [],
    devices: [],
    onlineAccounts: [],
    documents: [],
    insurance: [],
    letters: [],
    otherRecords: [],
  };
}

export function emptyPlanData(): EolPlanData {
  return {
    personal: emptyPersonalRecord(),
    personalNotes: '',
    contacts: [],
    contactsNotes: '',
    devices: [],
    devicesNotes: '',
    onlineAccounts: [],
    onlineNotes: '',
    documents: [],
    documentsNotes: '',
    insurance: [],
    insuranceNotes: '',
    financial: emptyFinancialInfo(),
    financialNotes: '',
    home: emptyHomeInfo(),
    homeNotes: '',
    nextSteps: seedNextSteps(),
    nextStepsNotes: '',
    eolWishes: emptyEolWishes(),
    eolWishesNotes: '',
    myWishes: emptyMyWishes(),
    myWishesNotes: '',
    letters: [],
    lettersNotes: '',
    otherRecords: [],
    otherNotes: '',
    customSections: [],
  };
}

export function createPlan(input: {
  name: string;
  personFullName: string;
  relationship?: EolRelationship | '';
  relationshipCustom?: string;
  dateOfBirth?: string;
  card_color?: string;
}): EolPlan {
  const stamp = nowIso();
  return {
    id: createEolId('plan'),
    name: input.name.trim(),
    personFullName: input.personFullName.trim(),
    relationship: input.relationship || '',
    relationshipCustom: input.relationshipCustom?.trim() || '',
    dateOfBirth: input.dateOfBirth || '',
    dateCreated: stamp,
    lastUpdated: stamp,
    card_color: input.card_color || '#10b981',
    status: 'Active',
    data: emptyPlanData(),
  };
}

export function touchPlan(plan: EolPlan): EolPlan {
  return { ...plan, lastUpdated: nowIso() };
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return true;
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) {
    return value.some((item) => {
      if (item && typeof item === 'object' && 'name' in item) {
        return String((item as { name?: string }).name || '').trim() !== '';
      }
      if (item && typeof item === 'object' && 'label' in item && 'value' in item) {
        return (
          String((item as EolCustomField).label || '').trim() !== '' ||
          String((item as EolCustomField).value || '').trim() !== ''
        );
      }
      return hasValue(item);
    });
  }
  if (typeof value === 'object' && value !== null && 'sensitivity' in value && 'value' in value) {
    return String((value as EolSecretString).value || '').trim() !== '';
  }
  return false;
}

export function filledPercent(values: unknown[]): number {
  if (values.length === 0) return 0;
  const filled = values.filter(hasValue).length;
  return Math.round((filled / values.length) * 100);
}

export function listSectionPercent<T>(records: T[], fieldsOf: (record: T) => unknown[]): number {
  if (records.length === 0) return 0;
  const total = records.reduce((sum, record) => sum + filledPercent(fieldsOf(record)), 0);
  return Math.round(total / records.length);
}

export function sectionStatus(percent: number): EolSectionStatus {
  if (percent <= 0) return 'Not started';
  if (percent >= 100) return 'Complete';
  return 'In progress';
}

function personalFieldValues(personal: EolPersonalRecord): unknown[] {
  return [
    personal.fullLegalName,
    personal.preferredName,
    personal.previousNames,
    personal.dateOfBirth,
    personal.placeOfBirth,
    personal.ssn,
    personal.maritalStatus,
    personal.spousePartner,
    personal.homeAddress,
    personal.phone,
    personal.personalEmail,
    personal.driversLicenseNumber,
    personal.driversLicenseState,
    personal.passportNumber,
    personal.passportExpiration,
    personal.otherIdentification,
    personal.employer,
    personal.jobTitle,
    personal.employerContact,
    personal.hrContact,
    personal.workPhone,
    personal.workEmail,
    personal.veteranStatus,
    personal.militaryBranch,
    personal.serviceDates,
    personal.militaryId,
    personal.dischargeRecordsLocation,
    personal.familySpouse,
    personal.children,
    personal.parents,
    personal.dependents,
    personal.emergencyFamilyContact,
  ];
}

function contactFields(record: EolContact): unknown[] {
  return [
    record.name,
    record.relationship,
    record.contactType,
    record.company,
    record.phone,
    record.alternatePhone,
    record.email,
    record.address,
    record.whyContact,
    record.priority > 0 ? String(record.priority) : '',
  ];
}

function deviceFields(record: EolDevice): unknown[] {
  return [
    record.name,
    record.deviceType,
    record.manufacturer,
    record.model,
    record.location,
    record.username,
    record.pin,
    record.password,
    record.recoveryKey,
    record.associatedAccount,
    record.accessInstructions,
    record.storedInformation,
  ];
}

function onlineFields(record: EolOnlineAccount): unknown[] {
  return [
    record.serviceName,
    record.website,
    record.category,
    record.username,
    record.password,
    record.mfaEnabled,
    record.mfaMethod,
    record.mfaLocation,
    record.recoveryEmail,
    record.recoveryPhone,
    record.accountReference,
    record.disposition,
    record.specialInstructions,
    record.passwordStoredElsewhere,
    record.passwordStoredElsewhereDetail,
  ];
}

function documentFields(record: EolDocumentNote): unknown[] {
  return [
    record.name,
    record.documentType,
    record.originalOrCopy,
    record.physicalLocation,
    record.digitalLocation,
    record.whoHasCopy,
    record.attorneyContact,
    record.dateCreated,
    record.lastUpdated,
    record.expirationDate,
    record.specialInstructions,
  ];
}

function insuranceFields(record: EolInsurancePolicy): unknown[] {
  return [
    record.company,
    record.policyType,
    record.policyNumber,
    record.policyholder,
    record.insuredPerson,
    record.agent,
    record.agentContact,
    record.beneficiary,
    record.coverageAmount,
    record.premium,
    record.paymentFrequency,
    record.automaticPayment,
    record.paymentAccount,
    record.expirationRenewal,
    record.website,
    record.claimContact,
    record.documentLocation,
    record.instructions,
  ];
}

function bankFields(record: EolBankAccount): unknown[] {
  return [
    record.institution,
    record.accountType,
    record.owners,
    record.lastFour,
    record.jointOwner,
    record.beneficiary,
    record.bankContact,
    record.website,
    record.loginStorage,
    record.purpose,
  ];
}

function investmentFields(record: EolInvestmentAccount): unknown[] {
  return [
    record.institution,
    record.accountType,
    record.owner,
    record.accountReference,
    record.beneficiaries,
    record.advisor,
    record.websiteLogin,
  ];
}

function cardFields(record: EolCreditCard): unknown[] {
  return [
    record.issuer,
    record.cardType,
    record.lastFour,
    record.primaryHolder,
    record.authorizedUsers,
    record.automaticPayments,
    record.balanceNotes,
    record.closingInstructions,
  ];
}

function debtFields(record: EolDebt): unknown[] {
  return [
    record.creditor,
    record.debtType,
    record.accountReference,
    record.approximateBalance,
    record.monthlyPayment,
    record.automaticPayment,
    record.collateral,
    record.contact,
  ];
}

function incomeFields(record: EolIncomeSource): unknown[] {
  return [record.incomeType, record.amountFrequency, record.depositedWhere, record.contact, record.survivorBenefits];
}

function billFields(record: EolRecurringBill): unknown[] {
  return [
    record.company,
    record.description,
    record.amount,
    record.frequency,
    record.dueDate,
    record.automaticPayment,
    record.paymentAccount,
    record.cancelAfterDeath,
  ];
}

function propertyFields(property: EolProperty): unknown[] {
  return [
    property.address,
    property.ownershipType,
    property.otherOwners,
    property.mortgageCompany,
    property.mortgageReference,
    property.mortgageBalance,
    property.monthlyPayment,
    property.propertyTax,
    property.homeownersInsurance,
    property.deedLocation,
  ];
}

function utilityFields(record: EolUtility): unknown[] {
  return [
    record.utilityType,
    record.provider,
    record.accountReference,
    record.contact,
    record.automaticPayment,
    record.paymentSource,
    record.loginReference,
  ];
}

function accessFields(access: EolHomeAccess): unknown[] {
  return [
    access.garageCode,
    access.alarmInformation,
    access.safeLocation,
    access.safeInstructions,
    access.spareKeyLocation,
    access.mailboxInformation,
    access.cameraInformation,
  ];
}

function providerFields(record: EolHomeProvider): unknown[] {
  return [record.providerType, record.name, record.contact, record.accountReference, record.notes];
}

function vehicleFields(record: EolVehicle): unknown[] {
  return [
    record.year,
    record.make,
    record.model,
    record.vin,
    record.loanInformation,
    record.titleLocation,
    record.insurance,
    record.spareKeyLocation,
  ];
}

function wishesFields(wishes: EolEndOfLifeWishes): unknown[] {
  return [
    wishes.dispositionPreference,
    wishes.funeralHome,
    wishes.funeralHomeContact,
    wishes.cemetery,
    wishes.cemeteryPlot,
    wishes.paperworkLocation,
    wishes.funeralServiceDesired,
    wishes.memorialServiceDesired,
    wishes.religiousService,
    wishes.clergy,
    wishes.viewing,
    wishes.casketPreference,
    wishes.preferredLocation,
    wishes.preferredMusic,
    wishes.preferredReadings,
    wishes.preferredSpeakers,
    wishes.obituaryWishes,
    wishes.peopleToNotify,
    wishes.organizationsToNotify,
    wishes.flowersPreference,
    wishes.memorialDonation,
    wishes.pallbearerPreferences,
    wishes.clothingPreference,
    wishes.militaryHonors,
    wishes.headstoneWishes,
    wishes.ashesInstructions,
    wishes.organDonationWishes,
    wishes.prepaidArrangements,
    wishes.funeralContractLocation,
  ];
}

function myWishesQuestionValues(wishes: EolMyWishesQuestions): unknown[] {
  return MY_WISHES_QUESTIONS.map((question) => wishes[question.key]);
}

function personalItemFields(record: EolPersonalItem): unknown[] {
  return [
    record.item,
    record.description,
    record.location,
    record.recipient,
    record.reason,
    record.photoReference,
    record.specialInstructions,
  ];
}

function letterFields(record: EolLetter): unknown[] {
  return [
    record.title,
    record.recipient,
    record.letterType,
    record.body,
    record.whenToShare,
    record.instructions,
    record.status,
    record.visibility,
  ];
}

function otherRecordFields(record: EolCustomRecord): unknown[] {
  return [
    record.title,
    record.category,
    record.description,
    record.importantDate,
    record.contact,
    record.location,
    record.website,
    record.instructions,
    record.customNotes,
    ...record.customFields.map((field) => field.value),
  ];
}

function financialPercent(financial: EolFinancialInfo): number {
  const parts = [
    listSectionPercent(financial.bankAccounts, bankFields),
    listSectionPercent(financial.investments, investmentFields),
    listSectionPercent(financial.creditCards, cardFields),
    listSectionPercent(financial.debts, debtFields),
    listSectionPercent(financial.incomeSources, incomeFields),
    listSectionPercent(financial.recurringBills, billFields),
  ];
  return Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length);
}

function homePercent(home: EolHomeInfo): number {
  const parts = [
    filledPercent(propertyFields(home.property)),
    listSectionPercent(home.utilities, utilityFields),
    filledPercent(accessFields(home.access)),
    listSectionPercent(home.providers, providerFields),
    listSectionPercent(home.vehicles, vehicleFields),
  ];
  return Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length);
}

function nextStepsPercent(steps: EolNextStep[]): number {
  const visible = steps.filter((step) => !step.hidden);
  if (visible.length === 0) return 0;
  const done = visible.filter((step) => step.status === 'Completed' || step.status === 'Not applicable').length;
  return Math.round((done / visible.length) * 100);
}

function myWishesPercent(wishes: EolMyWishes): number {
  const questions = filledPercent(myWishesQuestionValues(wishes));
  if (wishes.personalItems.length === 0) return questions;
  const items = listSectionPercent(wishes.personalItems, personalItemFields);
  return Math.round((questions + items) / 2);
}

export function builtInSectionPercent(data: EolPlanData, id: EolBuiltInSectionId): number {
  switch (id) {
    case 'personal':
      return filledPercent(personalFieldValues(data.personal));
    case 'contacts':
      return listSectionPercent(data.contacts, contactFields);
    case 'devices':
      return listSectionPercent(data.devices, deviceFields);
    case 'online':
      return listSectionPercent(data.onlineAccounts, onlineFields);
    case 'documents':
      return listSectionPercent(data.documents, documentFields);
    case 'insurance':
      return listSectionPercent(data.insurance, insuranceFields);
    case 'financial':
      return financialPercent(data.financial);
    case 'home':
      return homePercent(data.home);
    case 'nextSteps':
      return nextStepsPercent(data.nextSteps);
    case 'eolWishes':
      return filledPercent(wishesFields(data.eolWishes));
    case 'myWishes':
      return myWishesPercent(data.myWishes);
    case 'letters':
      return listSectionPercent(data.letters, letterFields);
    case 'other':
      return listSectionPercent(data.otherRecords, otherRecordFields);
    default:
      return 0;
  }
}

export function customSectionPercent(section: EolCustomSection): number {
  switch (section.modeledAfter) {
    case 'contacts':
      return listSectionPercent(section.contacts, contactFields);
    case 'devices':
      return listSectionPercent(section.devices, deviceFields);
    case 'online':
      return listSectionPercent(section.onlineAccounts, onlineFields);
    case 'documents':
      return listSectionPercent(section.documents, documentFields);
    case 'insurance':
      return listSectionPercent(section.insurance, insuranceFields);
    case 'letters':
      return listSectionPercent(section.letters, letterFields);
    case 'other':
      return listSectionPercent(section.otherRecords, otherRecordFields);
    default:
      return 0;
  }
}

export type EolSectionProgress = {
  id: string;
  label: string;
  percent: number;
  status: EolSectionStatus;
  custom: boolean;
};

export function planSectionProgress(plan: EolPlan): EolSectionProgress[] {
  const builtIn = EOL_BUILT_IN_TABS.map((tab) => {
    const percent = builtInSectionPercent(plan.data, tab.id);
    return {
      id: tab.id,
      label: tab.label,
      percent,
      status: sectionStatus(percent),
      custom: false,
    };
  });
  const custom = plan.data.customSections.map((section) => {
    const percent = customSectionPercent(section);
    return {
      id: section.id,
      label: section.name,
      percent,
      status: sectionStatus(percent),
      custom: true,
    };
  });
  return [...builtIn, ...custom];
}

export function overallPlanPercent(plan: EolPlan): number {
  const sections = planSectionProgress(plan);
  if (sections.length === 0) return 0;
  return Math.round(sections.reduce((sum, section) => sum + section.percent, 0) / sections.length);
}

function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const next = index + direction;
  if (next < 0 || next >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  return copy;
}

export function reorderList<T extends { id: string }>(list: T[], id: string, direction: -1 | 1): T[] {
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) return list;
  return moveItem(list, index, direction);
}

export function duplicateListItem<T extends { id: string }>(
  list: T[],
  id: string,
  clone: (item: T, newId: string) => T
): T[] {
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) return list;
  const original = list[index];
  const prefix = original.id.split('-')[0] || 'item';
  const copy = clone(original, createEolId(prefix));
  const next = [...list];
  next.splice(index + 1, 0, copy);
  return next;
}

export function removeListItem<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}

export function replaceListItem<T extends { id: string }>(list: T[], id: string, nextItem: T): T[] {
  return list.map((item) => (item.id === id ? nextItem : item));
}

function asSecret(value: unknown): EolSecretString {
  if (value && typeof value === 'object' && 'value' in (value as object)) {
    return emptySecret(String((value as EolSecretString).value ?? ''));
  }
  if (typeof value === 'string') return emptySecret(value);
  return emptySecret();
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asYesNo(value: unknown): '' | 'yes' | 'no' {
  return value === 'yes' || value === 'no' ? value : '';
}

function asArray<T>(value: unknown, mapItem: (item: unknown) => T): T[] {
  return Array.isArray(value) ? value.map(mapItem) : [];
}

function normalizeFamilyPerson(raw: unknown): EolFamilyPerson {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Partial<EolFamilyPerson>;
  return {
    id: asString(item.id) || createEolId('fam'),
    name: asString(item.name),
    notes: asString(item.notes),
  };
}

function normalizeContact(raw: unknown): EolContact {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Partial<EolContact>;
  return {
    ...emptyContact(),
    ...item,
    id: asString(item.id) || createEolId('contact'),
    name: asString(item.name),
    priority: typeof item.priority === 'number' && item.priority > 0 ? item.priority : 1,
  };
}

function normalizeDevice(raw: unknown): EolDevice {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Partial<EolDevice>;
  return {
    ...emptyDevice(),
    ...item,
    id: asString(item.id) || createEolId('device'),
    pin: asSecret(item.pin),
    password: asSecret(item.password),
    recoveryKey: asSecret(item.recoveryKey),
  };
}

function normalizeOnline(raw: unknown): EolOnlineAccount {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Partial<EolOnlineAccount>;
  return {
    ...emptyOnlineAccount(),
    ...item,
    id: asString(item.id) || createEolId('online'),
    password: asSecret(item.password),
    mfaEnabled: asYesNo(item.mfaEnabled),
    mfaLocation: asSecret(item.mfaLocation),
    recoveryEmail: asSecret(item.recoveryEmail),
    recoveryPhone: asSecret(item.recoveryPhone),
  };
}

function normalizeDocument(raw: unknown): EolDocumentNote {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Partial<EolDocumentNote>;
  return { ...emptyDocumentNote(), ...item, id: asString(item.id) || createEolId('doc') };
}

function normalizeInsurance(raw: unknown): EolInsurancePolicy {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Partial<EolInsurancePolicy>;
  return {
    ...emptyInsurancePolicy(),
    ...item,
    id: asString(item.id) || createEolId('ins'),
    automaticPayment: asYesNo(item.automaticPayment),
  };
}

function normalizeLetter(raw: unknown): EolLetter {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Partial<EolLetter>;
  return {
    ...emptyLetter(),
    ...item,
    id: asString(item.id) || createEolId('letter'),
    body: asSecret(item.body),
    status: item.status === 'Complete' ? 'Complete' : 'Draft',
    visibility: item.visibility === 'Private' ? 'Private' : 'Visible',
    lastUpdated: asString(item.lastUpdated) || nowIso(),
  };
}

function normalizeOther(raw: unknown): EolCustomRecord {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Partial<EolCustomRecord>;
  return {
    ...emptyCustomRecord(),
    ...item,
    id: asString(item.id) || createEolId('other'),
    customFields: asArray(item.customFields, (field) => {
      const value = (field && typeof field === 'object' ? field : {}) as Partial<EolCustomField>;
      return {
        id: asString(value.id) || createEolId('cfield'),
        label: asString(value.label),
        value: asString(value.value),
      };
    }),
  };
}

function normalizeCustomSection(raw: unknown): EolCustomSection {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Partial<EolCustomSection>;
  const modeledAfter = EOL_CUSTOM_TEMPLATES.some((template) => template.id === item.modeledAfter)
    ? (item.modeledAfter as EolCustomTemplate)
    : 'other';
  return {
    id: asString(item.id) || createEolId('csec'),
    name: asString(item.name) || 'Custom section',
    modeledAfter,
    notes: asString(item.notes),
    contacts: asArray(item.contacts, normalizeContact),
    devices: asArray(item.devices, normalizeDevice),
    onlineAccounts: asArray(item.onlineAccounts, normalizeOnline),
    documents: asArray(item.documents, normalizeDocument),
    insurance: asArray(item.insurance, normalizeInsurance),
    letters: asArray(item.letters, normalizeLetter),
    otherRecords: asArray(item.otherRecords, normalizeOther),
  };
}

function mergeSeededNextSteps(stored: unknown): EolNextStep[] {
  const existing = asArray(stored, (raw) => {
    const item = (raw && typeof raw === 'object' ? raw : {}) as Partial<EolNextStep>;
    return emptyNextStep({
      ...item,
      id: asString(item.id) || createEolId('step'),
      isPredefined: Boolean(item.isPredefined),
      hidden: Boolean(item.hidden),
      title: asString(item.title),
      priority: item.priority === 'High' || item.priority === 'Low' ? item.priority : 'Medium',
      status:
        item.status === 'Completed' || item.status === 'Not applicable' ? item.status : 'Not started',
    });
  });
  const bySeed = new Map(existing.filter((step) => step.seedKey).map((step) => [step.seedKey, step]));
  const seeded = NEXT_STEP_SEEDS.map((seed) => {
    const current = bySeed.get(seed.seedKey);
    if (current) {
      return { ...current, isPredefined: true, title: current.title || seed.title };
    }
    return emptyNextStep({
      seedKey: seed.seedKey,
      isPredefined: true,
      title: seed.title,
      priority: seed.priority,
    });
  });
  const custom = existing.filter((step) => !step.isPredefined);
  return [...seeded, ...custom];
}

function normalizePlan(raw: unknown): EolPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<EolPlan>;
  if (!asString(item.id) || !asString(item.name)) return null;
  const data = (item.data && typeof item.data === 'object' ? item.data : {}) as Partial<EolPlanData>;
  const personal = (data.personal && typeof data.personal === 'object' ? data.personal : {}) as Partial<EolPersonalRecord>;
  const financial = (data.financial && typeof data.financial === 'object' ? data.financial : {}) as Partial<EolFinancialInfo>;
  const home = (data.home && typeof data.home === 'object' ? data.home : {}) as Partial<EolHomeInfo>;
  const wishes = (data.eolWishes && typeof data.eolWishes === 'object' ? data.eolWishes : {}) as Partial<EolEndOfLifeWishes>;
  const myWishes = (data.myWishes && typeof data.myWishes === 'object' ? data.myWishes : {}) as Partial<EolMyWishes>;
  return {
    id: asString(item.id),
    name: asString(item.name),
    personFullName: asString(item.personFullName),
    relationship: EOL_RELATIONSHIPS.includes(item.relationship as EolRelationship)
      ? (item.relationship as EolRelationship)
      : '',
    relationshipCustom: asString(item.relationshipCustom),
    dateOfBirth: asString(item.dateOfBirth),
    dateCreated: asString(item.dateCreated) || nowIso(),
    lastUpdated: asString(item.lastUpdated) || nowIso(),
    card_color: asString(item.card_color) || '#10b981',
    status: item.status === 'Archived' ? 'Archived' : 'Active',
    data: {
      personal: {
        ...emptyPersonalRecord(),
        ...personal,
        ssn: asSecret(personal.ssn),
        driversLicenseNumber: asSecret(personal.driversLicenseNumber),
        passportNumber: asSecret(personal.passportNumber),
        children: asArray(personal.children, normalizeFamilyPerson),
        parents: asArray(personal.parents, normalizeFamilyPerson),
        dependents: asArray(personal.dependents, normalizeFamilyPerson),
      },
      personalNotes: asString(data.personalNotes),
      contacts: asArray(data.contacts, normalizeContact),
      contactsNotes: asString(data.contactsNotes),
      devices: asArray(data.devices, normalizeDevice),
      devicesNotes: asString(data.devicesNotes),
      onlineAccounts: asArray(data.onlineAccounts, normalizeOnline),
      onlineNotes: asString(data.onlineNotes),
      documents: asArray(data.documents, normalizeDocument),
      documentsNotes: asString(data.documentsNotes),
      insurance: asArray(data.insurance, normalizeInsurance),
      insuranceNotes: asString(data.insuranceNotes),
      financial: {
        bankAccounts: asArray(financial.bankAccounts, (row) => ({
          ...emptyBankAccount(),
          ...(row as Partial<EolBankAccount>),
          id: asString((row as Partial<EolBankAccount>)?.id) || createEolId('bank'),
        })),
        investments: asArray(financial.investments, (row) => ({
          ...emptyInvestmentAccount(),
          ...(row as Partial<EolInvestmentAccount>),
          id: asString((row as Partial<EolInvestmentAccount>)?.id) || createEolId('invest'),
        })),
        creditCards: asArray(financial.creditCards, (row) => ({
          ...emptyCreditCard(),
          ...(row as Partial<EolCreditCard>),
          id: asString((row as Partial<EolCreditCard>)?.id) || createEolId('card'),
        })),
        debts: asArray(financial.debts, (row) => ({
          ...emptyDebt(),
          ...(row as Partial<EolDebt>),
          id: asString((row as Partial<EolDebt>)?.id) || createEolId('debt'),
        })),
        incomeSources: asArray(financial.incomeSources, (row) => {
          const value = (row || {}) as Partial<EolIncomeSource>;
          return {
            ...emptyIncomeSource(),
            ...value,
            id: asString(value.id) || createEolId('income'),
            survivorBenefits: asYesNo(value.survivorBenefits),
          };
        }),
        recurringBills: asArray(financial.recurringBills, (row) => {
          const value = (row || {}) as Partial<EolRecurringBill>;
          return {
            ...emptyRecurringBill(),
            ...value,
            id: asString(value.id) || createEolId('bill'),
            automaticPayment: asYesNo(value.automaticPayment),
            cancelAfterDeath: asYesNo(value.cancelAfterDeath),
          };
        }),
      },
      financialNotes: asString(data.financialNotes),
      home: {
        property: { ...emptyProperty(), ...(home.property || {}) },
        utilities: asArray(home.utilities, (row) => ({
          ...emptyUtility(),
          ...(row as Partial<EolUtility>),
          id: asString((row as Partial<EolUtility>)?.id) || createEolId('util'),
        })),
        access: {
          ...emptyHomeAccess(),
          ...(home.access || {}),
          garageCode: asSecret(home.access?.garageCode),
          alarmInformation: asSecret(home.access?.alarmInformation),
          safeInstructions: asSecret(home.access?.safeInstructions),
        },
        providers: asArray(home.providers, (row) => ({
          ...emptyHomeProvider(),
          ...(row as Partial<EolHomeProvider>),
          id: asString((row as Partial<EolHomeProvider>)?.id) || createEolId('hprov'),
        })),
        vehicles: asArray(home.vehicles, (row) => ({
          ...emptyVehicle(),
          ...(row as Partial<EolVehicle>),
          id: asString((row as Partial<EolVehicle>)?.id) || createEolId('veh'),
        })),
      },
      homeNotes: asString(data.homeNotes),
      nextSteps: mergeSeededNextSteps(data.nextSteps),
      nextStepsNotes: asString(data.nextStepsNotes),
      eolWishes: { ...emptyEolWishes(), ...wishes },
      eolWishesNotes: asString(data.eolWishesNotes),
      myWishes: {
        ...emptyMyWishes(),
        ...myWishes,
        personalItems: asArray(myWishes.personalItems, (row) => ({
          ...emptyPersonalItem(),
          ...(row as Partial<EolPersonalItem>),
          id: asString((row as Partial<EolPersonalItem>)?.id) || createEolId('item'),
        })),
      },
      myWishesNotes: asString(data.myWishesNotes),
      letters: asArray(data.letters, normalizeLetter),
      lettersNotes: asString(data.lettersNotes),
      otherRecords: asArray(data.otherRecords, normalizeOther),
      otherNotes: asString(data.otherNotes),
      customSections: asArray(data.customSections, normalizeCustomSection),
    },
  };
}

export function emptyDraftStore(): EolDraftStore {
  return { version: 1, plans: [], selectedPlanId: null };
}

/** Temporary until API/DB pass — easy to rip out */
export function loadEolDraft(): EolDraftStore {
  if (typeof window === 'undefined') return emptyDraftStore();
  try {
    const raw = window.localStorage.getItem(EOL_UI_DRAFT_STORAGE_KEY);
    if (!raw) return emptyDraftStore();
    const parsed = JSON.parse(raw) as Partial<EolDraftStore>;
    const plans = asArray(parsed.plans, normalizePlan).filter((plan): plan is EolPlan => Boolean(plan));
    const selectedPlanId =
      typeof parsed.selectedPlanId === 'string' && plans.some((plan) => plan.id === parsed.selectedPlanId)
        ? parsed.selectedPlanId
        : null;
    return { version: 1, plans, selectedPlanId };
  } catch {
    return emptyDraftStore();
  }
}

/** Temporary until API/DB pass — easy to rip out */
export function saveEolDraft(store: EolDraftStore): void {
  if (typeof window === 'undefined') return;
  const payload: EolDraftStore = {
    version: 1,
    plans: store.plans,
    selectedPlanId: store.selectedPlanId,
  };
  window.localStorage.setItem(EOL_UI_DRAFT_STORAGE_KEY, JSON.stringify(payload));
}

export function sortContacts(contacts: EolContact[]): EolContact[] {
  return [...contacts].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name);
  });
}

export function copyName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'Copy';
  if (trimmed.endsWith('(copy)')) return trimmed;
  return `${trimmed} (copy)`;
}
