import type { jsPDF } from 'jspdf';
import {
  EOL_BUILT_IN_TABS,
  MY_WISHES_QUESTIONS,
  formatDateDisplay,
  resolveSectionOrder,
  secretText,
  sortContacts,
  type EolAttachment,
  type EolBankAccount,
  type EolContact,
  type EolCreditCard,
  type EolCustomRecord,
  type EolCustomSection,
  type EolDebt,
  type EolDevice,
  type EolDocumentNote,
  type EolEmploymentFields,
  type EolFamilyPerson,
  type EolHomeProvider,
  type EolIdentificationFields,
  type EolIncomeSource,
  type EolInsurancePolicy,
  type EolInvestmentAccount,
  type EolLetter,
  type EolMilitaryFields,
  type EolNextStep,
  type EolOnlineAccount,
  type EolPersonalExtraSection,
  type EolPersonalItem,
  type EolPlan,
  type EolPlanData,
  type EolRecurringBill,
  type EolSecretString,
  type EolUtility,
  type EolVehicle,
} from '@/lib/end-of-life-planner';

const HIDDEN_SECRET = 'Saved in the app (not included in this report)';

function redactEmbeddedAccessCodes(value: string): string {
  return value.replace(
    /\b(pass\s*codes?|passcodes?|passwords?|pins?|access\s*codes?)\b(\s*(?:is\s+)?[:#-]?\s*)(\d{3,}(?:\s*[-/]\s*\d{2,})*|[A-Za-z]*\d[A-Za-z0-9._-]*)/gi,
    (_match, label: string, sep: string) => `${label}${sep}${HIDDEN_SECRET}`
  );
}
const HANDWRITE = '________________ (hand write on this form)';
const NEXT_STEPS_INTRO = 'If something happened to me today, start here.';

const EOL_WISHES_PDF_NOTICE =
  'Recording wishes here does not replace legally required estate, healthcare, or disposition documents. This is a guide for your family, not a legal instrument.';

const MY_WISHES_PDF_NOTICE =
  'Personal wishes entered here may not constitute a legally enforceable transfer of property. Use formal estate documents for legally binding gifts.';

type Chunk =
  | { t: 'section'; text: string }
  | { t: 'sub'; text: string }
  | { t: 'item'; text: string }
  | { t: 'line'; text: string; muted?: boolean; notice?: boolean };

export type EolPdfExportOptions = {
  exportAll: boolean;
  planId: string;
  includeArchived: boolean;
  includeSecrets: boolean;
  includePrivateLetters: boolean;
};

export function sortEolPlansByName(plans: EolPlan[]): EolPlan[] {
  return [...plans].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export function eolExportPlanChoices(plans: EolPlan[]): EolPlan[] {
  const active = sortEolPlansByName(plans.filter((plan) => plan.status !== 'Archived'));
  const archived = sortEolPlansByName(plans.filter((plan) => plan.status === 'Archived'));
  return [...active, ...archived];
}

export function pickDefaultEolPlanId(
  plans: EolPlan[],
  editingPlanId: string | null,
  selectedPlanId: string | null
): string {
  if (editingPlanId && plans.some((plan) => plan.id === editingPlanId)) return editingPlanId;
  if (selectedPlanId && plans.some((plan) => plan.id === selectedPlanId)) return selectedPlanId;
  return eolExportPlanChoices(plans)[0]?.id || '';
}

export function eolExportSubtitle(plan: EolPlan | null, exportAll: boolean, includeArchived: boolean): string {
  if (!exportAll) {
    const name = plan?.name?.trim() || 'Selected plan';
    return plan?.status === 'Archived'
      ? `Archived plan  ·  One plan  ·  ${name}`
      : `Active plans only  ·  One plan  ·  ${name}`;
  }
  return includeArchived ? 'Active and archived plans  ·  All plans' : 'Active plans only  ·  All plans';
}

function text(value: string | null | undefined): string {
  return (value || '').trim();
}

function shownDate(value: string | null | undefined): string {
  if (!text(value)) return '';
  const shown = formatDateDisplay(value);
  return shown === '—' ? '' : shown;
}

function attachmentFileName(file: EolAttachment): string {
  const record = file as EolAttachment & { fileName?: string; file_name?: string };
  return (record.name || record.fileName || record.file_name || '').trim();
}

function namedAttachments(files: EolAttachment[] | null | undefined): EolAttachment[] {
  return (files || []).filter((file) => attachmentFileName(file));
}

function fillRecordAttachments<T extends { id: string; attachments?: EolAttachment[] | null }>(
  server: T[] | null | undefined,
  local: T[] | null | undefined
): T[] {
  const localById = new Map((local || []).map((item) => [item.id, item]));
  return (server || []).map((item) => {
    if (namedAttachments(item.attachments).length > 0) return item;
    const localFiles = namedAttachments(localById.get(item.id)?.attachments);
    if (localFiles.length === 0) return item;
    return { ...item, attachments: localFiles };
  });
}

/** Server reloads can omit files the screen already has. Copy those filenames onto matching records. */
export function plansWithEolAttachmentFallback(serverPlans: EolPlan[], localPlans: EolPlan[]): EolPlan[] {
  const localById = new Map(localPlans.map((plan) => [plan.id, plan]));
  return serverPlans.map((plan) => {
    const local = localById.get(plan.id);
    if (!local) return plan;
    const serverData = plan.data;
    const localData = local.data;
    const localCustom = new Map((localData.customSections || []).map((section) => [section.id, section]));
    return {
      ...plan,
      data: {
        ...serverData,
        documents: fillRecordAttachments(serverData.documents, localData.documents),
        insurance: fillRecordAttachments(serverData.insurance, localData.insurance),
        letters: fillRecordAttachments(serverData.letters, localData.letters),
        otherRecords: fillRecordAttachments(serverData.otherRecords, localData.otherRecords),
        myWishes: {
          ...serverData.myWishes,
          personalItems: fillRecordAttachments(serverData.myWishes?.personalItems, localData.myWishes?.personalItems),
        },
        customSections: (serverData.customSections || []).map((section) => {
          const fromLocal = localCustom.get(section.id);
          if (!fromLocal) return section;
          return {
            ...section,
            documents: fillRecordAttachments(section.documents, fromLocal.documents),
            insurance: fillRecordAttachments(section.insurance, fromLocal.insurance),
            letters: fillRecordAttachments(section.letters, fromLocal.letters),
            otherRecords: fillRecordAttachments(section.otherRecords, fromLocal.otherRecords),
          };
        }),
      },
    };
  });
}

function stepIsHidden(step: EolNextStep): boolean {
  const record = step as EolNextStep & { is_hidden?: boolean; isHidden?: boolean };
  return Boolean(step.hidden || record.is_hidden || record.isHidden);
}

function nextStepMatchKey(step: EolNextStep): string {
  const seedKey = step.seedKey?.trim();
  return seedKey ? `seed:${seedKey}` : `id:${step.id}`;
}

/** A reload can still list a step the screen already inactivated. Keep that step hidden for this plan only. */
export function plansWithLocalNextStepVisibility(serverPlans: EolPlan[], localPlans: EolPlan[]): EolPlan[] {
  const localById = new Map(localPlans.map((plan) => [plan.id, plan]));
  return serverPlans.map((plan) => {
    const local = localById.get(plan.id);
    if (!local) return plan;
    const hiddenByKey = new Map((local.data.nextSteps || []).map((step) => [nextStepMatchKey(step), stepIsHidden(step)]));
    return {
      ...plan,
      data: {
        ...plan.data,
        nextSteps: (plan.data.nextSteps || []).map((step) => {
          const localHidden = hiddenByKey.get(nextStepMatchKey(step));
          const hidden = localHidden === true || stepIsHidden(step);
          return step.hidden === hidden ? step : { ...step, hidden };
        }),
      },
    };
  });
}

class ReportDoc {
  chunks: Chunk[] = [];
  attachments: string[] = [];
  private sectionStart = -1;
  private subStart = -1;

  beginSection(title: string) {
    this.endSub();
    this.sectionStart = this.chunks.length;
    this.chunks.push({ t: 'section', text: title });
  }

  finishSection(notice?: string) {
    this.endSub();
    if (this.sectionStart < 0) return;
    if (this.chunks.length === this.sectionStart + 1) {
      this.chunks.pop();
      this.sectionStart = -1;
      return;
    }
    if (notice) {
      this.chunks.splice(this.sectionStart + 1, 0, { t: 'line', text: notice, muted: true, notice: true });
    }
    this.sectionStart = -1;
  }

  beginSub(title: string) {
    this.endSub();
    this.subStart = this.chunks.length;
    this.chunks.push({ t: 'sub', text: title });
  }

  endSub() {
    if (this.subStart >= 0 && this.chunks.length === this.subStart + 1) {
      this.chunks.pop();
    }
    this.subStart = -1;
  }

  line(value: string, muted = false) {
    const next = value.trim();
    if (!next) return;
    this.chunks.push({ t: 'line', text: next, muted });
  }

  field(label: string, value: string | null | undefined) {
    const next = text(value);
    if (next) this.line(`${label}: ${next}`);
  }

  yesNo(label: string, value: string | null | undefined) {
    if (value === 'yes') this.field(label, 'Yes');
    else if (value === 'no') this.field(label, 'No');
  }

  date(label: string, value: string | null | undefined) {
    this.field(label, shownDate(value));
  }

  secret(label: string, field: EolSecretString | string | null | undefined, includeSecrets: boolean) {
    if (!secretText(field).trim()) return;
    this.field(label, includeSecrets ? secretText(field).trim() : HIDDEN_SECRET);
  }

  gatedField(label: string, value: string | null | undefined, includeSecrets: boolean) {
    const next = text(value);
    if (!next) return;
    this.field(label, includeSecrets ? next : redactEmbeddedAccessCodes(next));
  }

  handwrite(label: string) {
    this.line(`${label}: ${HANDWRITE}`);
  }

  withItem(title: string, body: () => void) {
    const start = this.chunks.length;
    const filesBefore = this.attachments.length;
    body();
    if (this.chunks.length > start || this.attachments.length > filesBefore) {
      this.chunks.splice(start, 0, { t: 'item', text: title.trim() || 'Record' });
    }
  }

  files(planName: string, section: string, record: string, files: EolAttachment[] | null | undefined) {
    for (const file of namedAttachments(files)) {
      this.attachments.push(`${planName} — ${section} — ${record.trim() || 'Record'} — ${attachmentFileName(file)}`);
    }
  }
}

function labelOf(data: EolPlanData, key: string, fallback: string): string {
  return text(data.sectionLabels?.[key]) || fallback;
}

function sectionName(data: EolPlanData, id: string): string {
  const builtIn = EOL_BUILT_IN_TABS.find((tab) => tab.id === id);
  return text(data.sectionLabels?.[id]) || builtIn?.label || id;
}

function on(data: EolPlanData, key: string): boolean {
  return !(data.inactiveSubsectionIds || []).includes(key);
}

function printFamily(doc: ReportDoc, people: EolFamilyPerson[]) {
  for (const person of people || []) {
    doc.withItem(text(person.name) || 'Family member', () => {
      doc.field('Name', person.name);
      doc.field('Relationship', person.relationship);
      doc.field('Contact', person.contactInfo);
    });
  }
}

function printIdentification(doc: ReportDoc, fields: EolIdentificationFields) {
  doc.handwrite("Driver's license number");
  doc.handwrite('Passport number');
  doc.field("Driver's license state", fields.driversLicenseState);
  doc.date('Passport expiration', fields.passportExpiration);
  doc.field('Other identification', fields.otherIdentification);
}

function printEmployment(doc: ReportDoc, fields: EolEmploymentFields) {
  doc.field('Employer', fields.employer);
  doc.field('Job title', fields.jobTitle);
  doc.field('Employer contact', fields.employerContact);
  doc.field('HR contact', fields.hrContact);
  doc.field('Work phone', fields.workPhone);
  doc.field('Work email', fields.workEmail);
}

function printMilitary(doc: ReportDoc, fields: EolMilitaryFields) {
  doc.field('Veteran status', fields.veteranStatus);
  doc.field('Branch', fields.militaryBranch);
  doc.field('Service dates', fields.serviceDates);
  doc.field('Military ID/service number', fields.militaryId);
  doc.field('Location of discharge/service records', fields.dischargeRecordsLocation);
}

function printContacts(doc: ReportDoc, contacts: EolContact[]) {
  for (const contact of sortContacts(contacts || [])) {
    doc.withItem(text(contact.name) || 'Contact', () => {
      doc.field('Name', contact.name);
      doc.field('Relationship', contact.relationship);
      doc.field('Contact type', contact.contactType);
      doc.field('Company/organization', contact.company);
      doc.field('Phone', contact.phone);
      doc.field('Alternate phone', contact.alternatePhone);
      doc.field('Email', contact.email);
      doc.field('Address', contact.address);
      doc.field('Why this person should be contacted', contact.whyContact);
      if (contact.priority > 0) doc.field('Priority/order to contact', String(contact.priority));
    });
  }
}

function printDevices(doc: ReportDoc, devices: EolDevice[], includeSecrets: boolean) {
  for (const device of devices || []) {
    doc.withItem(text(device.name) || 'Device', () => {
      doc.field('Device name', device.name);
      doc.field('Device type', device.deviceType);
      doc.field('Manufacturer', device.manufacturer);
      doc.field('Model', device.model);
      doc.field('Device location', device.location);
      doc.field('Username', device.username);
      doc.secret('PIN/passcode', device.pin, includeSecrets);
      doc.secret('Password or password reference', device.password, includeSecrets);
      doc.secret('Encryption/recovery key location', device.recoveryKey, includeSecrets);
      doc.field('Apple ID / Google account associated with device', device.associatedAccount);
      doc.gatedField('Instructions for accessing device', device.accessInstructions, includeSecrets);
      doc.gatedField('What important information is stored on it', device.storedInformation, includeSecrets);
    });
  }
}

function printOnline(doc: ReportDoc, accounts: EolOnlineAccount[], includeSecrets: boolean) {
  for (const account of accounts || []) {
    doc.withItem(text(account.serviceName) || 'Account', () => {
      doc.field('Account/service name', account.serviceName);
      doc.field('Website', account.website);
      doc.field('Category', account.category);
      doc.field('Username/email', account.username);
      doc.secret('Password', account.password, includeSecrets);
      doc.yesNo('MFA enabled', account.mfaEnabled);
      doc.field('MFA method', account.mfaMethod);
      doc.secret('Where MFA device/code can be found', account.mfaLocation, includeSecrets);
      doc.secret('Recovery email', account.recoveryEmail, includeSecrets);
      doc.secret('Recovery phone', account.recoveryPhone, includeSecrets);
      doc.field('Account number/reference', account.accountReference);
      doc.field('What should happen to account', account.disposition);
      doc.gatedField('Special instructions', account.specialInstructions, includeSecrets);
      doc.gatedField('Password stored elsewhere', account.passwordStoredElsewhere, includeSecrets);
      doc.gatedField('Password manager detail', account.passwordStoredElsewhereDetail, includeSecrets);
    });
  }
}

function printDocuments(
  doc: ReportDoc,
  planName: string,
  section: string,
  documents: EolDocumentNote[]
) {
  for (const document of documents || []) {
    const record = text(document.name) || 'Document';
    doc.withItem(record, () => {
      doc.field('Document name', document.name);
      doc.field('Document type', document.documentType);
      doc.field('Original/copy', document.originalOrCopy);
      doc.field('Physical location', document.physicalLocation);
      doc.field('Digital location', document.digitalLocation);
      doc.field('Who has a copy', document.whoHasCopy);
      doc.field('Attorney/contact associated with document', document.attorneyContact);
      doc.date('Date document was created', document.dateCreated);
      doc.date('Last updated', document.lastUpdated);
      doc.date('Expiration date if applicable', document.expirationDate);
      doc.field('Special instructions', document.specialInstructions);
      doc.files(planName, section, record, document.attachments);
    });
  }
}

function printInsurance(
  doc: ReportDoc,
  planName: string,
  section: string,
  policies: EolInsurancePolicy[]
) {
  for (const policy of policies || []) {
    const record = text(policy.company) || text(policy.policyType) || 'Policy';
    doc.withItem(record, () => {
      doc.field('Insurance company', policy.company);
      doc.field('Policy type', policy.policyType);
      doc.field('Policy number', policy.policyNumber);
      doc.field('Policyholder', policy.policyholder);
      doc.field('Insured person', policy.insuredPerson);
      doc.field('Agent', policy.agent);
      doc.field('Agent phone/email', policy.agentContact);
      doc.field('Beneficiary', policy.beneficiary);
      doc.field('Coverage amount', policy.coverageAmount);
      doc.field('Premium', policy.premium);
      doc.field('Payment frequency', policy.paymentFrequency);
      doc.yesNo('Automatic payment?', policy.automaticPayment);
      doc.field('Account used for payment', policy.paymentAccount);
      doc.field('Policy expiration/renewal', policy.expirationRenewal);
      doc.field('Website', policy.website);
      doc.field('Claim contact information', policy.claimContact);
      doc.field('Location of policy documents', policy.documentLocation);
      doc.field('Instructions', policy.instructions);
      doc.files(planName, section, record, policy.attachments);
    });
  }
}

function printBanks(doc: ReportDoc, accounts: EolBankAccount[]) {
  for (const account of accounts || []) {
    doc.withItem(text(account.institution) || 'Bank account', () => {
      doc.field('Financial institution', account.institution);
      doc.field('Account type', account.accountType);
      doc.field('Account owner(s)', account.owners);
      doc.field('Last four digits/account reference', account.lastFour);
      doc.field('Joint owner', account.jointOwner);
      doc.field('Beneficiary/POD', account.beneficiary);
      doc.field('Bank contact', account.bankContact);
      doc.field('Website', account.website);
      doc.field('Where login information is stored', account.loginStorage);
      doc.field('Approximate purpose of account', account.purpose);
    });
  }
}

function printInvestments(doc: ReportDoc, accounts: EolInvestmentAccount[]) {
  for (const account of accounts || []) {
    doc.withItem(text(account.institution) || 'Investment account', () => {
      doc.field('Institution', account.institution);
      doc.field('Account type', account.accountType);
      doc.field('Account owner', account.owner);
      doc.field('Account reference', account.accountReference);
      doc.field('Beneficiaries', account.beneficiaries);
      doc.field('Financial advisor', account.advisor);
      doc.field('Website/login reference', account.websiteLogin);
    });
  }
}

function printCards(doc: ReportDoc, cards: EolCreditCard[]) {
  for (const card of cards || []) {
    doc.withItem(text(card.issuer) || 'Credit card', () => {
      doc.field('Issuer', card.issuer);
      doc.field('Card type', card.cardType);
      doc.field('Last four digits', card.lastFour);
      doc.field('Primary cardholder', card.primaryHolder);
      doc.field('Joint/authorized users', card.authorizedUsers);
      doc.field('Automatic payments charged to this card', card.automaticPayments);
      doc.field('Balance notes', card.balanceNotes);
      doc.field('Instructions for closing', card.closingInstructions);
    });
  }
}

function printDebts(doc: ReportDoc, debts: EolDebt[]) {
  for (const debt of debts || []) {
    doc.withItem(text(debt.creditor) || 'Debt', () => {
      doc.field('Creditor', debt.creditor);
      doc.field('Debt type', debt.debtType);
      doc.field('Account reference', debt.accountReference);
      doc.field('Approximate balance', debt.approximateBalance);
      doc.field('Monthly payment', debt.monthlyPayment);
      doc.field('Automatic payment', debt.automaticPayment);
      doc.field('Collateral', debt.collateral);
      doc.field('Contact information', debt.contact);
    });
  }
}

function printIncome(doc: ReportDoc, sources: EolIncomeSource[]) {
  for (const source of sources || []) {
    doc.withItem(text(source.incomeType) || 'Income', () => {
      doc.field('Type', source.incomeType);
      doc.field('Amount/frequency', source.amountFrequency);
      doc.field('Where deposited', source.depositedWhere);
      doc.field('Contact information', source.contact);
      doc.yesNo('Survivor benefits?', source.survivorBenefits);
    });
  }
}

function printBills(doc: ReportDoc, bills: EolRecurringBill[]) {
  for (const bill of bills || []) {
    doc.withItem(text(bill.company) || 'Bill', () => {
      doc.field('Company', bill.company);
      doc.field('Description', bill.description);
      doc.field('Amount', bill.amount);
      doc.field('Frequency', bill.frequency);
      doc.field('Due date', bill.dueDate);
      doc.yesNo('Automatic payment?', bill.automaticPayment);
      doc.field('Payment account/card', bill.paymentAccount);
      doc.yesNo('Should it be canceled after death?', bill.cancelAfterDeath);
    });
  }
}

function printUtilities(doc: ReportDoc, utilities: EolUtility[]) {
  for (const utility of utilities || []) {
    doc.withItem(text(utility.provider) || text(utility.utilityType) || 'Utility', () => {
      doc.field('Type', utility.utilityType);
      doc.field('Provider', utility.provider);
      doc.field('Account reference', utility.accountReference);
      doc.field('Contact', utility.contact);
      doc.field('Automatic payment', utility.automaticPayment);
      doc.field('Payment source', utility.paymentSource);
      doc.field('Login reference', utility.loginReference);
    });
  }
}

function printProviders(doc: ReportDoc, providers: EolHomeProvider[]) {
  for (const provider of providers || []) {
    doc.withItem(text(provider.name) || 'Provider', () => {
      doc.field('Type', provider.providerType);
      doc.field('Provider name', provider.name);
      doc.field('Contact', provider.contact);
      doc.field('Account/reference', provider.accountReference);
      doc.field('Notes', provider.notes);
    });
  }
}

function printVehicles(doc: ReportDoc, vehicles: EolVehicle[]) {
  for (const vehicle of vehicles || []) {
    const record = [vehicle.year, vehicle.make, vehicle.model].map((part) => text(part)).filter(Boolean).join(' ');
    doc.withItem(record || 'Vehicle', () => {
      doc.field('Year', vehicle.year);
      doc.field('Make', vehicle.make);
      doc.field('Model', vehicle.model);
      doc.field('VIN', vehicle.vin);
      doc.field('Loan information', vehicle.loanInformation);
      doc.field('Title location', vehicle.titleLocation);
      doc.field('Insurance', vehicle.insurance);
      doc.field('Spare key location', vehicle.spareKeyLocation);
    });
  }
}

function printPersonalItems(doc: ReportDoc, planName: string, section: string, items: EolPersonalItem[]) {
  for (const item of items || []) {
    const record = text(item.item) || 'Personal item';
    doc.withItem(record, () => {
      doc.field('Item', item.item);
      doc.field('Description', item.description);
      doc.field('Location', item.location);
      doc.field('Intended recipient', item.recipient);
      doc.field('Reason/message', item.reason);
      doc.field('Photo/document reference', item.photoReference);
      doc.field('Special instructions', item.specialInstructions);
      doc.files(planName, section, record, item.attachments);
    });
  }
}

function printLetters(
  doc: ReportDoc,
  planName: string,
  section: string,
  letters: EolLetter[],
  includePrivateLetters: boolean
) {
  for (const letter of letters || []) {
    const record = text(letter.title) || 'Letter';
    const withheld = letter.visibility === 'Private' && !includePrivateLetters;
    doc.withItem(record, () => {
      doc.field('Letter title', letter.title);
      doc.field('Recipient', letter.recipient);
      doc.field('Relationship / letter type', letter.letterType);
      if (withheld) {
        doc.line('Private — letter text not included');
        return;
      }
      doc.field('When it should be shared', letter.whenToShare);
      if (letter.status) doc.field('Status', letter.status);
      if (letter.visibility === 'Private') doc.field('Visibility', 'Private');
      doc.field('Optional instructions', letter.instructions);
      doc.field('Letter/message', secretText(letter.body));
      doc.files(planName, section, record, letter.attachments);
    });
  }
}

function printOther(doc: ReportDoc, planName: string, section: string, records: EolCustomRecord[]) {
  for (const record of records || []) {
    const name = text(record.title) || 'Record';
    doc.withItem(name, () => {
      doc.field('Title', record.title);
      doc.field('Category', record.category);
      doc.field('Description', record.description);
      doc.date('Important date', record.importantDate);
      doc.field('Contact', record.contact);
      doc.field('Location', record.location);
      doc.field('Website', record.website);
      doc.field('Instructions', record.instructions);
      doc.field('Custom notes', record.customNotes);
      for (const field of record.customFields || []) {
        const label = text(field.label);
        const value = text(field.value);
        if (label && value) doc.field(label, value);
        else if (value) doc.line(value);
      }
      doc.files(planName, section, name, record.attachments);
    });
  }
}

function printSteps(doc: ReportDoc, data: EolPlanData, steps: EolNextStep[]) {
  const visible = (steps || []).filter((step) => !stepIsHidden(step));
  if (visible.length === 0) return;
  doc.line(NEXT_STEPS_INTRO);
  for (const step of visible) {
    doc.withItem(text(step.title) || 'Step', () => {
      doc.field('Title', step.title);
      doc.field('Priority', step.priority);
      doc.field('Person responsible', step.personResponsible);
      doc.field('Status', step.status);
      doc.field('Instructions', step.instructions);
      const contact = data.contacts.find((item) => item.id === step.relatedContactId);
      doc.field('Related contact', contact?.name);
      doc.field('Related document', step.relatedDocument);
    });
  }
}

function extras(data: EolPlanData, kind: EolPersonalExtraSection['kind']): EolPersonalExtraSection[] {
  return (data.personalExtraSections || []).filter((extra) => extra.kind === kind && on(data, extra.id));
}

function printPersonal(doc: ReportDoc, data: EolPlanData) {
  const personal = data.personal;
  doc.beginSub(labelOf(data, 'personal-info', 'Personal Information'));
  doc.field('Full legal name', personal.fullLegalName);
  doc.field('Preferred name', personal.preferredName);
  doc.field('Previous/maiden names', personal.previousNames);
  doc.date('Date of birth', personal.dateOfBirth);
  doc.field('Place of birth', personal.placeOfBirth);
  doc.handwrite('Social Security number');
  if (!on(data, 'personal-id')) {
    doc.handwrite("Driver's license number");
    doc.handwrite('Passport number');
  }
  doc.field('Marital status', personal.maritalStatus);
  doc.field('Spouse/partner', personal.spousePartner);
  doc.field('Home address', personal.homeAddress);
  doc.field('Phone', personal.phone);
  doc.field('Personal email', personal.personalEmail);
  doc.endSub();

  if (on(data, 'personal-id')) {
    doc.beginSub(labelOf(data, 'personal-id', 'Identification'));
    printIdentification(doc, personal);
    doc.endSub();
  }
  for (const extra of extras(data, 'identification')) {
    doc.beginSub(extra.name || 'Identification');
    printIdentification(doc, extra.identification);
    doc.endSub();
  }

  if (on(data, 'personal-work')) {
    doc.beginSub(labelOf(data, 'personal-work', 'Employment'));
    printEmployment(doc, personal);
    doc.endSub();
  }
  for (const extra of extras(data, 'employment')) {
    doc.beginSub(extra.name || 'Employment');
    printEmployment(doc, extra.employment);
    doc.endSub();
  }

  if (on(data, 'personal-military')) {
    doc.beginSub(labelOf(data, 'personal-military', 'Military Information'));
    printMilitary(doc, personal);
    doc.endSub();
  }
  for (const extra of extras(data, 'military')) {
    doc.beginSub(extra.name || 'Military Information');
    printMilitary(doc, extra.military);
    doc.endSub();
  }

  if (on(data, 'personal-family')) {
    doc.beginSub(labelOf(data, 'personal-family', 'Family Information'));
    printFamily(doc, personal.familyMembers);
    doc.endSub();
  }
  for (const extra of extras(data, 'family')) {
    doc.beginSub(extra.name || 'Family Information');
    printFamily(doc, extra.family.members);
    doc.endSub();
  }

  if (on(data, 'personal-notes')) {
    doc.beginSub(labelOf(data, 'personal-notes', 'Notes'));
    doc.field('Notes', data.personalNotes);
    doc.endSub();
  }
  for (const extra of extras(data, 'notes')) {
    doc.beginSub(extra.name || 'Notes');
    doc.field('Notes', extra.notes);
    doc.endSub();
  }
}

function printPlanSections(
  doc: ReportDoc,
  plan: EolPlan,
  includeSecrets: boolean,
  includePrivateLetters: boolean
) {
  const data = plan.data;
  const planName = text(plan.name) || 'Plan';
  const inactive = new Set(data.inactiveSectionIds || []);

  for (const id of resolveSectionOrder(data)) {
    if (inactive.has(id)) continue;
    const title = sectionName(data, id);
    if (id === 'personal') {
      doc.beginSection(title);
      printPersonal(doc, data);
      doc.finishSection();
      continue;
    }
    if (id === 'contacts') {
      doc.beginSection(title);
      if (on(data, 'contacts-list')) {
        doc.beginSub(labelOf(data, 'contacts-list', 'Contacts'));
        printContacts(doc, data.contacts);
        doc.endSub();
      }
      if (on(data, 'contacts-notes')) {
        doc.beginSub(labelOf(data, 'contacts-notes', 'Notes'));
        doc.field('Notes', data.contactsNotes);
        doc.endSub();
      }
      doc.finishSection();
      continue;
    }
    if (id === 'devices') {
      doc.beginSection(title);
      if (on(data, 'devices-list')) {
        doc.beginSub(labelOf(data, 'devices-list', 'Devices'));
        printDevices(doc, data.devices, includeSecrets);
        doc.endSub();
      }
      if (on(data, 'devices-notes')) {
        doc.beginSub(labelOf(data, 'devices-notes', 'Notes'));
        doc.gatedField('Notes', data.devicesNotes, includeSecrets);
        doc.endSub();
      }
      doc.finishSection();
      continue;
    }
    if (id === 'online') {
      doc.beginSection(title);
      if (on(data, 'online-list')) {
        doc.beginSub(labelOf(data, 'online-list', 'Accounts'));
        printOnline(doc, data.onlineAccounts, includeSecrets);
        doc.endSub();
      }
      if (on(data, 'online-notes')) {
        doc.beginSub(labelOf(data, 'online-notes', 'Notes'));
        doc.gatedField('Notes', data.onlineNotes, includeSecrets);
        doc.endSub();
      }
      doc.finishSection();
      continue;
    }
    if (id === 'documents') {
      doc.beginSection(title);
      if (on(data, 'documents-list')) {
        doc.beginSub(labelOf(data, 'documents-list', 'Documents'));
        printDocuments(doc, planName, title, data.documents);
        doc.endSub();
      }
      if (on(data, 'documents-notes')) {
        doc.beginSub(labelOf(data, 'documents-notes', 'Notes'));
        doc.field('Notes', data.documentsNotes);
        doc.endSub();
      }
      doc.finishSection();
      continue;
    }
    if (id === 'insurance') {
      doc.beginSection(title);
      if (on(data, 'insurance-list')) {
        doc.beginSub(labelOf(data, 'insurance-list', 'Policies'));
        printInsurance(doc, planName, title, data.insurance);
        doc.endSub();
      }
      if (on(data, 'insurance-notes')) {
        doc.beginSub(labelOf(data, 'insurance-notes', 'Notes'));
        doc.field('Notes', data.insuranceNotes);
        doc.endSub();
      }
      doc.finishSection();
      continue;
    }
    if (id === 'financial') {
      doc.beginSection(title);
      if (on(data, 'financial-bank')) {
        doc.beginSub(labelOf(data, 'financial-bank', 'Bank Accounts'));
        printBanks(doc, data.financial.bankAccounts);
        doc.endSub();
      }
      if (on(data, 'financial-invest')) {
        doc.beginSub(labelOf(data, 'financial-invest', 'Investment & Retirement Accounts'));
        printInvestments(doc, data.financial.investments);
        doc.endSub();
      }
      if (on(data, 'financial-cards')) {
        doc.beginSub(labelOf(data, 'financial-cards', 'Credit Cards'));
        printCards(doc, data.financial.creditCards);
        doc.endSub();
      }
      if (on(data, 'financial-debts')) {
        doc.beginSub(labelOf(data, 'financial-debts', 'Loans & Debts'));
        printDebts(doc, data.financial.debts);
        doc.endSub();
      }
      if (on(data, 'financial-income')) {
        doc.beginSub(labelOf(data, 'financial-income', 'Income Sources'));
        printIncome(doc, data.financial.incomeSources);
        doc.endSub();
      }
      if (on(data, 'financial-bills')) {
        doc.beginSub(labelOf(data, 'financial-bills', 'Recurring Bills'));
        printBills(doc, data.financial.recurringBills);
        doc.endSub();
      }
      if (on(data, 'financial-notes')) {
        doc.beginSub(labelOf(data, 'financial-notes', 'Notes'));
        doc.field('Notes', data.financialNotes);
        doc.endSub();
      }
      doc.finishSection();
      continue;
    }
    if (id === 'home') {
      doc.beginSection(title);
      if (on(data, 'home-property')) {
        doc.beginSub(labelOf(data, 'home-property', 'Property'));
        const property = data.home.property;
        doc.field('Property address', property.address);
        doc.field('Ownership type', property.ownershipType);
        doc.field('Other owners', property.otherOwners);
        doc.field('Mortgage company', property.mortgageCompany);
        doc.field('Mortgage account reference', property.mortgageReference);
        doc.field('Approximate mortgage balance', property.mortgageBalance);
        doc.field('Monthly payment', property.monthlyPayment);
        doc.field('Property tax information', property.propertyTax);
        doc.field('Homeowners insurance reference', property.homeownersInsurance);
        doc.field('Deed location', property.deedLocation);
        doc.endSub();
      }
      if (on(data, 'home-utilities')) {
        doc.beginSub(labelOf(data, 'home-utilities', 'Utilities'));
        printUtilities(doc, data.home.utilities);
        doc.endSub();
      }
      if (on(data, 'home-access')) {
        doc.beginSub(labelOf(data, 'home-access', 'Home Access'));
        const access = data.home.access;
        doc.secret('Garage code', access.garageCode, includeSecrets);
        doc.secret('Alarm information', access.alarmInformation, includeSecrets);
        doc.field('Safe location', access.safeLocation);
        doc.secret('Safe instructions', access.safeInstructions, includeSecrets);
        doc.field('Spare key location', access.spareKeyLocation);
        doc.field('Mailbox information', access.mailboxInformation);
        doc.field('Security camera information', access.cameraInformation);
        doc.endSub();
      }
      if (on(data, 'home-providers')) {
        doc.beginSub(labelOf(data, 'home-providers', 'Home Service Providers'));
        printProviders(doc, data.home.providers);
        doc.endSub();
      }
      if (on(data, 'home-vehicles')) {
        doc.beginSub(labelOf(data, 'home-vehicles', 'Vehicles'));
        printVehicles(doc, data.home.vehicles);
        doc.endSub();
      }
      if (on(data, 'home-notes')) {
        doc.beginSub(labelOf(data, 'home-notes', 'Notes'));
        doc.field('Notes', data.homeNotes);
        doc.endSub();
      }
      doc.finishSection();
      continue;
    }
    if (id === 'nextSteps') {
      doc.beginSection(title);
      if (on(data, 'next-steps-list')) {
        doc.beginSub(labelOf(data, 'next-steps-list', 'Steps'));
        printSteps(doc, data, data.nextSteps);
        doc.endSub();
      }
      if (on(data, 'next-steps-notes')) {
        doc.beginSub(labelOf(data, 'next-steps-notes', 'Notes'));
        doc.field('Notes', data.nextStepsNotes);
        doc.endSub();
      }
      doc.finishSection();
      continue;
    }
    if (id === 'eolWishes') {
      doc.beginSection(title);
      const wishes = data.eolWishes;
      if (on(data, 'eol-disposition')) {
        doc.beginSub(labelOf(data, 'eol-disposition', 'Disposition'));
        doc.field('Burial / Cremation / Donation / Other preference', wishes.dispositionPreference);
        doc.field('Preferred funeral home', wishes.funeralHome);
        doc.field('Funeral home contact', wishes.funeralHomeContact);
        doc.field('Cemetery', wishes.cemetery);
        doc.field('Cemetery plot information', wishes.cemeteryPlot);
        doc.field('Location of ownership paperwork', wishes.paperworkLocation);
        doc.endSub();
      }
      if (on(data, 'eol-service')) {
        doc.beginSub(labelOf(data, 'eol-service', 'Service Preferences'));
        doc.yesNo('Funeral service desired?', wishes.funeralServiceDesired);
        doc.yesNo('Memorial service desired?', wishes.memorialServiceDesired);
        doc.yesNo('Religious service?', wishes.religiousService);
        doc.field('Preferred clergy/officiant', wishes.clergy);
        doc.yesNo('Viewing?', wishes.viewing);
        doc.field('Open/closed casket preference', wishes.casketPreference);
        doc.field('Preferred location', wishes.preferredLocation);
        doc.field('Preferred music', wishes.preferredMusic);
        doc.field('Preferred readings', wishes.preferredReadings);
        doc.field('Preferred speakers', wishes.preferredSpeakers);
        doc.endSub();
      }
      if (on(data, 'eol-notify')) {
        doc.beginSub(labelOf(data, 'eol-notify', 'Notifications & Remembrance'));
        doc.field('Obituary wishes', wishes.obituaryWishes);
        doc.field('People who should be notified', wishes.peopleToNotify);
        doc.field('Organizations to notify', wishes.organizationsToNotify);
        doc.field('Flowers preference', wishes.flowersPreference);
        doc.field('Memorial donation preference', wishes.memorialDonation);
        doc.field('Pallbearer preferences', wishes.pallbearerPreferences);
        doc.endSub();
      }
      if (on(data, 'eol-arrangements')) {
        doc.beginSub(labelOf(data, 'eol-arrangements', 'Final Arrangements'));
        doc.field('Clothing preference', wishes.clothingPreference);
        doc.field('Military honors', wishes.militaryHonors);
        doc.field('Headstone/marker wishes', wishes.headstoneWishes);
        doc.field('Ashes instructions', wishes.ashesInstructions);
        doc.field('Organ/tissue donation wishes', wishes.organDonationWishes);
        doc.field('Prepaid funeral arrangements', wishes.prepaidArrangements);
        doc.field('Location of funeral contracts', wishes.funeralContractLocation);
        doc.endSub();
      }
      if (on(data, 'eol-wishes-notes')) {
        doc.beginSub(labelOf(data, 'eol-wishes-notes', 'Notes'));
        doc.field('Notes', data.eolWishesNotes);
        doc.endSub();
      }
      doc.finishSection(EOL_WISHES_PDF_NOTICE);
      continue;
    }
    if (id === 'myWishes') {
      doc.beginSection(title);
      const groups: { key: string; fallback: string; keys: Array<(typeof MY_WISHES_QUESTIONS)[number]['key']> }[] = [
        {
          key: 'my-wishes-matter',
          fallback: 'What Matters',
          keys: ['mostImportant', 'familyToKnow', 'traditions', 'thankedRemembered', 'doNotWant'],
        },
        {
          key: 'my-wishes-giving',
          fallback: 'Belongings & Giving',
          keys: ['specialBelongings', 'specificGifts', 'charitableWishes', 'importantOrganizations', 'collections'],
        },
        {
          key: 'my-wishes-digital',
          fallback: 'Care & Digital Life',
          keys: ['petsCare', 'socialMedia', 'digitalMedia', 'personalFiles', 'phoneComputer', 'onlinePresence'],
        },
      ];
      for (const group of groups) {
        if (!on(data, group.key)) continue;
        doc.beginSub(labelOf(data, group.key, group.fallback));
        for (const key of group.keys) {
          const question = MY_WISHES_QUESTIONS.find((item) => item.key === key);
          doc.field(question?.label || key, data.myWishes[key]);
        }
        doc.endSub();
      }
      if (on(data, 'my-wishes-items')) {
        doc.beginSub(labelOf(data, 'my-wishes-items', 'Personal Property'));
        printPersonalItems(doc, planName, title, data.myWishes.personalItems);
        doc.endSub();
      }
      if (on(data, 'my-wishes-notes')) {
        doc.beginSub(labelOf(data, 'my-wishes-notes', 'Notes'));
        doc.field('Notes', data.myWishesNotes);
        doc.endSub();
      }
      doc.finishSection(MY_WISHES_PDF_NOTICE);
      continue;
    }
    if (id === 'letters') {
      doc.beginSection(title);
      if (on(data, 'letters-list')) {
        doc.beginSub(labelOf(data, 'letters-list', 'Letters'));
        printLetters(doc, planName, title, data.letters, includePrivateLetters);
        doc.endSub();
      }
      if (on(data, 'letters-notes')) {
        doc.beginSub(labelOf(data, 'letters-notes', 'Notes'));
        doc.field('Notes', data.lettersNotes);
        doc.endSub();
      }
      doc.finishSection();
      continue;
    }
    if (id === 'other') {
      doc.beginSection(title);
      if (on(data, 'other-list')) {
        doc.beginSub(labelOf(data, 'other-list', 'Records'));
        printOther(doc, planName, title, data.otherRecords);
        doc.endSub();
      }
      if (on(data, 'other-notes')) {
        doc.beginSub(labelOf(data, 'other-notes', 'Notes'));
        doc.field('Notes', data.otherNotes);
        doc.endSub();
      }
      doc.finishSection();
      continue;
    }

    const custom = (data.customSections || []).find((section) => section.id === id);
    if (custom) printCustomSection(doc, planName, custom, includeSecrets, includePrivateLetters);
  }
}

function printCustomSection(
  doc: ReportDoc,
  planName: string,
  section: EolCustomSection,
  includeSecrets: boolean,
  includePrivateLetters: boolean
) {
  const title = text(section.name) || 'Custom section';
  doc.beginSection(title);
  if (section.modeledAfter === 'contacts') printContacts(doc, section.contacts);
  if (section.modeledAfter === 'devices') printDevices(doc, section.devices, includeSecrets);
  if (section.modeledAfter === 'online') printOnline(doc, section.onlineAccounts, includeSecrets);
  if (section.modeledAfter === 'documents') printDocuments(doc, planName, title, section.documents);
  if (section.modeledAfter === 'insurance') printInsurance(doc, planName, title, section.insurance);
  if (section.modeledAfter === 'letters') printLetters(doc, planName, title, section.letters, includePrivateLetters);
  if (section.modeledAfter === 'other') printOther(doc, planName, title, section.otherRecords);
  doc.gatedField('Notes', section.notes, includeSecrets);
  doc.finishSection();
}

function relationshipText(plan: EolPlan): string {
  if (plan.relationship === 'Other') return text(plan.relationshipCustom) || 'Other';
  return text(plan.relationship);
}

function printPlan(doc: ReportDoc, plan: EolPlan, includeSecrets: boolean, includePrivateLetters: boolean) {
  const headerAt = doc.chunks.length;
  doc.chunks.push({ t: 'section', text: text(plan.name) || 'Plan' });
  doc.field("Person's full name", plan.personFullName);
  doc.field('Relationship', relationshipText(plan));
  doc.date('Date of birth', plan.dateOfBirth);
  if (plan.status === 'Archived') doc.field('Status', 'Archived');
  printPlanSections(doc, plan, includeSecrets, includePrivateLetters);
  if (doc.chunks.length === headerAt + 1) {
    doc.chunks.push({ t: 'line', text: 'No saved details to include.', muted: true });
  }
}

function plansForExport(plans: EolPlan[], options: EolPdfExportOptions): EolPlan[] {
  if (!options.exportAll) {
    const chosen = plans.find((plan) => plan.id === options.planId);
    return chosen ? [chosen] : [];
  }
  const active = sortEolPlansByName(plans.filter((plan) => plan.status !== 'Archived'));
  if (!options.includeArchived) return active;
  const archived = sortEolPlansByName(plans.filter((plan) => plan.status === 'Archived'));
  return [...active, ...archived];
}

function localCalendarDayStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const FOOTER_LOGO_SRC = '/images/logo/Logo_Side_Black.png';
const FOOTER_LOGO_WIDTH = 699;
const FOOTER_LOGO_HEIGHT = 306;

async function loadFooterLogo(): Promise<string | null> {
  try {
    const response = await fetch(FOOTER_LOGO_SRC);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return dataUrl.startsWith('data:image/') ? dataUrl : null;
  } catch {
    return null;
  }
}

function renderPdf(
  pdf: jsPDF,
  chunks: Chunk[],
  attachments: string[],
  subtitle: string,
  generatedAt: Date,
  logoDataUrl: string | null,
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const footerY = pageHeight - 10;
  const logoHeight = 8;
  const logoWidth = logoHeight * (FOOTER_LOGO_WIDTH / FOOTER_LOGO_HEIGHT);
  const logoY = footerY - logoHeight + 1.5;
  const contentBottom = (logoDataUrl ? logoY : footerY) - 4;
  let yPos = margin;
  let holdBodyLines = 0;
  let repeatingSection: string | null = null;
  let repeatingSectionHeight = 0;
  let repeatingSub: string | null = null;
  let repeatingSubHeight = 0;
  const colors = {
    background: [255, 255, 255] as const,
    text: [15, 23, 42] as const,
    title: [15, 23, 42] as const,
    header: [241, 245, 249] as const,
    muted: [71, 85, 105] as const,
  };

  const fillPage = () => {
    pdf.setFillColor(colors.background[0], colors.background[1], colors.background[2]);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const sectionHeaderMetrics = (title: string) => {
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    const lines = pdf.splitTextToSize(title, contentWidth - 10) as string[];
    const barHeight = Math.max(10, lines.length * 6 + 4);
    return { lines, barHeight, height: barHeight + 5 };
  };

  const paintSectionHeader = (title: string) => {
    const { lines, barHeight } = sectionHeaderMetrics(title);
    pdf.setFillColor(colors.header[0], colors.header[1], colors.header[2]);
    pdf.rect(margin, yPos, contentWidth, barHeight, 'F');
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.title[0], colors.title[1], colors.title[2]);
    lines.forEach((line, index) => {
      pdf.text(line, margin + 5, yPos + 7 + index * 6);
    });
    yPos += barHeight + 5;
  };

  const paintSub = (title: string) => {
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    const lines = pdf.splitTextToSize(title, contentWidth - 5 - 5) as string[];
    const lineHeight = 11 * 0.42;
    lines.forEach((line) => {
      pdf.text(line, margin + 5, yPos);
      yPos += lineHeight;
    });
    yPos += 2;
  };

  const checkNewPage = (requiredHeight: number) => {
    if (holdBodyLines > 0) return false;
    if (yPos + requiredHeight <= contentBottom) return false;
    const continuationTop =
      margin + (repeatingSection ? repeatingSectionHeight : 0) + (repeatingSub ? repeatingSubHeight : 0);
    if (yPos <= continuationTop + 0.5) return false;
    pdf.addPage();
    fillPage();
    yPos = margin;
    if (repeatingSection) paintSectionHeader(repeatingSection);
    if (repeatingSub) paintSub(repeatingSub);
    return true;
  };

  const addSectionHeader = (title: string) => {
    checkNewPage(sectionHeaderMetrics(title).height);
    paintSectionHeader(title);
  };

  const addText = (value: string, fontSize = 10, isBold = false, indent = 0, muted = false) => {
    const applyStyle = () => {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      const color = muted ? colors.muted : colors.text;
      pdf.setTextColor(color[0], color[1], color[2]);
    };
    applyStyle();
    const lines = pdf.splitTextToSize(value, contentWidth - indent - 5) as string[];
    const lineHeight = fontSize * 0.42;
    checkNewPage(lines.length * lineHeight + 2);
    applyStyle();
    lines.forEach((line) => {
      pdf.text(line, margin + indent, yPos);
      yPos += lineHeight;
    });
    yPos += 2;
  };

  const textBlockHeight = (value: string, fontSize: number, isBold: boolean, indent: number) => {
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
    const lines = pdf.splitTextToSize(value, contentWidth - indent - 5) as string[];
    return lines.length * fontSize * 0.42 + 2;
  };

  const chunkHeight = (chunk: Chunk) => {
    if (chunk.t === 'section') return sectionHeaderMetrics(chunk.text).height;
    if (chunk.t === 'sub') return textBlockHeight(chunk.text, 11, true, 5);
    if (chunk.t === 'item') return textBlockHeight(chunk.text, 10, true, 8);
    return textBlockHeight(chunk.text, 9, false, chunk.notice ? 5 : 10);
  };

  const headerAllowance = () =>
    (repeatingSection ? repeatingSectionHeight : 0) + (repeatingSub ? repeatingSubHeight : 0);

  const linesAfter = (index: number) => {
    let height = 0;
    let first = 0;
    let count = 0;
    for (let cursor = index + 1; cursor < chunks.length && chunks[cursor].t === 'line'; cursor += 1) {
      const lineHeight = chunkHeight(chunks[cursor]);
      if (count === 0) first = lineHeight;
      height += lineHeight;
      count += 1;
    }
    return { height, first, count };
  };

  const itemKeepHeight = (index: number, pendingHeader = 0) => {
    if (chunks[index]?.t !== 'item') return 0;
    const title = chunkHeight(chunks[index]);
    const lines = linesAfter(index);
    if (lines.first === 0) return title;
    const room = contentBottom - margin - headerAllowance() - pendingHeader;
    if (room > 0 && title + lines.height <= room) return title + lines.height;
    return title + lines.first;
  };

  const followingStartHeight = (index: number) => {
    const next = chunks[index + 1];
    if (!next || next.t === 'section') return 0;
    if (next.t === 'sub') {
      const afterSub = chunks[index + 2];
      const subHeight = chunkHeight(next);
      if (afterSub?.t === 'item') return subHeight + itemKeepHeight(index + 2, chunkHeight(chunks[index]) + subHeight);
      if (afterSub && afterSub.t !== 'section' && afterSub.t !== 'sub') return subHeight + chunkHeight(afterSub);
      return subHeight;
    }
    if (next.t === 'item') return itemKeepHeight(index + 1, chunkHeight(chunks[index]));
    return chunkHeight(next);
  };

  const openPage = (reprintSection: boolean) => {
    pdf.addPage();
    fillPage();
    yPos = margin;
    if (reprintSection && repeatingSection) paintSectionHeader(repeatingSection);
  };

  fillPage();
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.title[0], colors.title[1], colors.title[2]);
  const title = 'End of Life Planner Report';
  pdf.text(title, (pageWidth - pdf.getTextWidth(title)) / 2, yPos);
  yPos += 10;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
  const generated = generatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  pdf.text(`Generated on: ${generated}`, margin, yPos);
  yPos += 6;
  for (const line of pdf.splitTextToSize(subtitle, contentWidth) as string[]) {
    pdf.text(line, margin, yPos);
    yPos += 5;
  }
  yPos += 5;

  if (chunks.length === 0) {
    addText('No plans match the selected options.', 10, false, 5, true);
  }

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    if (chunk.t === 'section') {
      repeatingSection = null;
      repeatingSub = null;
      repeatingSectionHeight = 0;
      repeatingSubHeight = 0;
      const together = chunkHeight(chunk) + followingStartHeight(index);
      if (yPos > margin && yPos + together > contentBottom) openPage(false);
      addSectionHeader(chunk.text);
      repeatingSection = chunk.text;
      repeatingSectionHeight = sectionHeaderMetrics(chunk.text).height;
      continue;
    }
    if (chunk.t === 'sub') {
      repeatingSub = null;
      repeatingSubHeight = 0;
      const subHeight = chunkHeight(chunk);
      const body = chunks[index + 1];
      const bodyHeight = body?.t === 'item'
        ? itemKeepHeight(index + 1, subHeight)
        : body && body.t !== 'section' && body.t !== 'sub'
          ? chunkHeight(body)
          : 0;
      if (yPos > margin && yPos + subHeight + bodyHeight > contentBottom) openPage(true);
      addText(chunk.text, 11, true, 5);
      repeatingSub = chunk.text;
      repeatingSubHeight = subHeight;
      continue;
    }
    if (chunk.t === 'item') {
      const lines = linesAfter(index);
      const titleHeight = chunkHeight(chunk);
      const room = contentBottom - margin - headerAllowance();
      const fitsOnOnePage = lines.count === 0 || titleHeight + lines.height <= room;
      checkNewPage(itemKeepHeight(index));
      addText(chunk.text, 10, true, 8);
      holdBodyLines = fitsOnOnePage ? lines.count : 0;
      continue;
    }
    addText(chunk.text, 9, false, chunk.notice ? 5 : 10, Boolean(chunk.muted));
    if (holdBodyLines > 0) holdBodyLines -= 1;
  }

  repeatingSection = null;
  repeatingSub = null;
  repeatingSectionHeight = 0;
  repeatingSubHeight = 0;

  if (attachments.length > 0) {
    addSectionHeader('Attachments');
    addText('File names only. Files themselves are not included in this report.', 8, false, 5, true);
    attachments.forEach((line) => addText(line, 9, false, 8));
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
    if (logoDataUrl) pdf.addImage(logoDataUrl, 'PNG', margin, logoY, logoWidth, logoHeight);
    pdf.text('Household Toolbox', pageWidth / 2, footerY, { align: 'center' });
  }
}

export async function downloadEolPlannerPdf(plans: EolPlan[], options: EolPdfExportOptions): Promise<void> {
  const chosen = plans.find((plan) => plan.id === options.planId) || null;
  if (!options.exportAll && !chosen) {
    throw new Error('Select a plan, or choose All plans.');
  }
  const included = plansForExport(plans, options);
  const doc = new ReportDoc();
  for (const plan of included) {
    printPlan(doc, plan, options.includeSecrets, options.includePrivateLetters);
  }
  const generatedAt = new Date();
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoDataUrl = await loadFooterLogo();
  renderPdf(
    pdf,
    doc.chunks,
    doc.attachments,
    eolExportSubtitle(chosen, options.exportAll, options.includeArchived),
    generatedAt,
    logoDataUrl,
  );
  pdf.save(`End_of_Life_Planner_Report_${localCalendarDayStamp(generatedAt)}.pdf`);
}
