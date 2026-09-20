import { supabaseServer } from '@/lib/supabaseServer';
import {
  EOL_BUILT_IN_TABS,
  emptyCustomSection,
  emptyHomeAccess,
  emptyPlanData,
  emptyProperty,
  EolAttachment,
  EolBuiltInSectionId,
  EolCustomSection,
  EolCustomTemplate,
  EolPlan,
  EolPlanData,
  EolPlanStatus,
  EolRelationship,
  isEolUuid,
  normalizeHistoryEvents,
  secretText,
  seedPlanHistory,
  withSecret,
} from '@/lib/end-of-life-planner';
import {
  attachmentsByOwnerIds,
  deletePlanStorageFiles,
  deleteStorageForRemovedRows,
} from '@/lib/end-of-life-planner-storage';

type SectionRow = {
  id: string;
  kind: 'builtin' | 'custom';
  builtin_key: EolBuiltInSectionId | null;
  modeled_after: EolCustomTemplate | null;
  name: string;
  notes: string;
  is_complete: boolean;
  is_inactive: boolean;
  is_removed: boolean;
  display_order: number;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function dateOrNull(value: string | null | undefined): string | null {
  const raw = (value || '').trim();
  return raw ? raw : null;
}

function dateOrEmpty(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : '';
}

function secretDb(value: unknown): string {
  return secretText(value as never);
}

function yesNo(value: unknown): '' | 'yes' | 'no' {
  return value === 'yes' || value === 'no' ? value : '';
}

function rowId(id: string): string {
  return isEolUuid(id) ? id : crypto.randomUUID();
}

async function throwIfError(error: { message?: string } | null, context: string) {
  if (!error) return;
  console.error(context, error);
  throw new Error(error.message || context);
}

async function syncRows(options: {
  table: string;
  planId: string;
  rows: Record<string, unknown>[];
  scope?: { column: string; value: string | null };
}) {
  let query = supabaseServer.from(options.table).select('id').eq('plan_id', options.planId);
  if (options.scope) {
    query =
      options.scope.value === null
        ? query.is(options.scope.column, null)
        : query.eq(options.scope.column, options.scope.value);
  }
  const { data: existing, error: existingError } = await query;
  await throwIfError(existingError, `load ${options.table}`);
  const keep = new Set(options.rows.map((row) => String(row.id || '')).filter(Boolean));
  const remove = (existing || []).map((row) => row.id).filter((id) => !keep.has(id));
  if (remove.length) {
    const { data: owner } = await supabaseServer.from(options.table).select('user_id').eq('id', remove[0]).maybeSingle();
    if (owner?.user_id) {
      await deleteStorageForRemovedRows(options.table, remove, owner.user_id);
    }
    const { error } = await supabaseServer.from(options.table).delete().in('id', remove);
    await throwIfError(error, `delete ${options.table}`);
  }
  if (options.rows.length) {
    const { error } = await supabaseServer.from(options.table).upsert(options.rows, { onConflict: 'id' });
    await throwIfError(error, `upsert ${options.table}`);
  }
}

const NOTE_KEYS: Record<EolBuiltInSectionId, keyof EolPlanData> = {
  personal: 'personalNotes',
  contacts: 'contactsNotes',
  devices: 'devicesNotes',
  online: 'onlineNotes',
  documents: 'documentsNotes',
  insurance: 'insuranceNotes',
  financial: 'financialNotes',
  home: 'homeNotes',
  nextSteps: 'nextStepsNotes',
  eolWishes: 'eolWishesNotes',
  myWishes: 'myWishesNotes',
  letters: 'lettersNotes',
  other: 'otherNotes',
};

function ownerFields(userId: string, toolId: string, planId: string) {
  return { user_id: userId, tool_id: toolId, plan_id: planId };
}

export async function listEolPlans(userId: string, toolId: string): Promise<{ plans: EolPlan[]; selectedPlanId: string | null }> {
  const { data: rows, error } = await supabaseServer
    .from('tools_eolp_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .order('created_at', { ascending: true });
  await throwIfError(error, 'list plans');
  const plans = await Promise.all((rows || []).map((row) => hydratePlan(userId, toolId, row)));
  const selected = (rows || []).find((row) => row.is_selected)?.id || null;
  return { plans, selectedPlanId: selected };
}

export async function createEolPlan(
  userId: string,
  toolId: string,
  input: {
    name: string;
    personFullName: string;
    relationship?: EolRelationship | '';
    relationshipCustom?: string;
    dateOfBirth?: string;
    card_color?: string;
    select?: boolean;
  }
): Promise<EolPlan> {
  if (input.select !== false) {
    await supabaseServer.from('tools_eolp_plans').update({ is_selected: false }).eq('user_id', userId).eq('tool_id', toolId);
  }
  const { data, error } = await supabaseServer
    .from('tools_eolp_plans')
    .insert({
      user_id: userId,
      tool_id: toolId,
      name: input.name.trim(),
      person_full_name: input.personFullName.trim(),
      relationship: input.relationship || '',
      relationship_custom: input.relationshipCustom?.trim() || '',
      date_of_birth: dateOrNull(input.dateOfBirth),
      card_color: input.card_color || '#10b981',
      status: 'Active',
      is_selected: input.select !== false,
    })
    .select('*')
    .single();
  await throwIfError(error, 'create plan');
  return hydratePlan(userId, toolId, data);
}

export async function deleteEolPlan(userId: string, toolId: string, planId: string): Promise<void> {
  await deletePlanStorageFiles(planId, userId);
  const { error } = await supabaseServer
    .from('tools_eolp_plans')
    .delete()
    .eq('id', planId)
    .eq('user_id', userId)
    .eq('tool_id', toolId);
  await throwIfError(error, 'delete plan');
}

export async function setSelectedEolPlan(userId: string, toolId: string, planId: string | null): Promise<void> {
  await supabaseServer.from('tools_eolp_plans').update({ is_selected: false }).eq('user_id', userId).eq('tool_id', toolId);
  if (!planId) return;
  const { error } = await supabaseServer
    .from('tools_eolp_plans')
    .update({ is_selected: true })
    .eq('id', planId)
    .eq('user_id', userId)
    .eq('tool_id', toolId);
  await throwIfError(error, 'select plan');
}

export async function saveEolPlan(userId: string, toolId: string, plan: EolPlan): Promise<EolPlan> {
  const planId = rowId(plan.id);
  const { data: existing } = await supabaseServer
    .from('tools_eolp_plans')
    .select('id')
    .eq('id', planId)
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .maybeSingle();

  if (!existing) {
    const created = await createEolPlan(userId, toolId, {
      name: plan.name,
      personFullName: plan.personFullName,
      relationship: plan.relationship,
      relationshipCustom: plan.relationshipCustom,
      dateOfBirth: plan.dateOfBirth,
      card_color: plan.card_color,
      select: false,
    });
    return saveEolPlan(userId, toolId, { ...plan, id: created.id });
  }

  const headerFields = {
    name: plan.name.trim(),
    person_full_name: plan.personFullName.trim(),
    relationship: plan.relationship || '',
    relationship_custom: plan.relationshipCustom || '',
    date_of_birth: dateOrNull(plan.dateOfBirth),
    card_color: plan.card_color || '#10b981',
    status: plan.status === 'Archived' ? 'Archived' : 'Active',
    history_events: seedPlanHistory(plan),
  };
  const { error: headerError } = await supabaseServer
    .from('tools_eolp_plans')
    .update(headerFields)
    .eq('id', planId)
    .eq('user_id', userId)
    .eq('tool_id', toolId);
  if (headerError && /history_events/.test(headerError.message || '')) {
    const { history_events: _ignored, ...headerWithoutHistory } = headerFields;
    const { error: fallbackError } = await supabaseServer
      .from('tools_eolp_plans')
      .update(headerWithoutHistory)
      .eq('id', planId)
      .eq('user_id', userId)
      .eq('tool_id', toolId);
    await throwIfError(fallbackError, 'update plan header');
  } else {
    await throwIfError(headerError, 'update plan header');
  }

  await persistPlanData(userId, toolId, planId, plan);
  return hydratePlan(userId, toolId, {
    id: planId,
    name: plan.name,
    person_full_name: plan.personFullName,
    relationship: plan.relationship,
    relationship_custom: plan.relationshipCustom,
    date_of_birth: dateOrNull(plan.dateOfBirth),
    card_color: plan.card_color,
    status: plan.status,
    created_at: plan.dateCreated,
    updated_at: plan.lastUpdated,
    is_selected: false,
  });
}

async function persistPlanData(userId: string, toolId: string, planId: string, plan: EolPlan) {
  const data = plan.data;
  const own = ownerFields(userId, toolId, planId);
  const { data: sectionRows, error: sectionError } = await supabaseServer
    .from('tools_eolp_sections')
    .select('*')
    .eq('plan_id', planId);
  await throwIfError(sectionError, 'load sections for save');
  const sections = (sectionRows || []) as SectionRow[];
  const builtinByKey = new Map(sections.filter((row) => row.kind === 'builtin' && row.builtin_key).map((row) => [row.builtin_key as string, row]));

  for (const tab of EOL_BUILT_IN_TABS) {
    const current = builtinByKey.get(tab.id);
    if (!current) continue;
    const { error } = await supabaseServer
      .from('tools_eolp_sections')
      .update({
        name: data.sectionLabels?.[tab.id] || tab.label,
        notes: text(data[NOTE_KEYS[tab.id]]),
        is_complete: (data.completedSectionIds || []).includes(tab.id),
        is_inactive: (data.inactiveSectionIds || []).includes(tab.id),
        is_removed: (data.removedSectionIds || []).includes(tab.id),
        display_order: (() => {
          const ordered = (data.sectionOrder || []).indexOf(tab.id);
          return (ordered >= 0 ? ordered : EOL_BUILT_IN_TABS.findIndex((item) => item.id === tab.id)) * 10;
        })(),
      })
      .eq('id', current.id);
    await throwIfError(error, `update section ${tab.id}`);
  }

  const incomingCustom = (data.customSections || []).map((section) => ({
    ...section,
    originalId: section.id,
    id: rowId(section.id),
  }));
  const customRows = incomingCustom.map((section, index) => ({
    id: section.id,
    ...own,
    kind: 'custom',
    builtin_key: null,
    modeled_after: section.modeledAfter,
    name: section.name,
    notes: section.notes || '',
    is_complete:
      (data.completedSectionIds || []).includes(section.originalId) ||
      (data.completedSectionIds || []).includes(section.id),
    is_inactive:
      (data.inactiveSectionIds || []).includes(section.originalId) ||
      (data.inactiveSectionIds || []).includes(section.id),
    is_removed:
      (data.removedSectionIds || []).includes(section.originalId) ||
      (data.removedSectionIds || []).includes(section.id),
    display_order: (() => {
      const order = data.sectionOrder || [];
      const ordered = order.includes(section.originalId)
        ? order.indexOf(section.originalId)
        : order.indexOf(section.id);
      return (ordered >= 0 ? ordered : 20 + index) * 10;
    })(),
  }));
  await syncRows({
    table: 'tools_eolp_sections',
    planId,
    rows: customRows,
    scope: { column: 'kind', value: 'custom' },
  });

  const builtinIds = new Set(EOL_BUILT_IN_TABS.map((tab) => tab.id));
  const customIds = new Set(incomingCustom.map((section) => section.id));
  const { data: existingSubsections } = await supabaseServer
    .from('tools_eolp_subsections')
    .select('id, subsection_key')
    .eq('plan_id', planId);
  const subsectionIdByKey = new Map((existingSubsections || []).map((item) => [item.subsection_key, item.id]));
  const subsectionRows = Object.entries(data.sectionLabels || {})
    .filter(([key]) => !builtinIds.has(key as EolBuiltInSectionId) && !customIds.has(key))
    .map(([key, name], index) => ({
      id: subsectionIdByKey.get(key) || rowId(key),
      ...own,
      subsection_key: key,
      name,
      is_inactive: (data.inactiveSubsectionIds || []).includes(key),
      display_order: index * 10,
    }));
  (data.inactiveSubsectionIds || []).forEach((key, index) => {
    if (subsectionRows.some((row) => row.subsection_key === key)) return;
    if (builtinIds.has(key as EolBuiltInSectionId) || customIds.has(key)) return;
    subsectionRows.push({
      id: subsectionIdByKey.get(key) || rowId(key),
      ...own,
      subsection_key: key,
      name: key,
      is_inactive: true,
      display_order: 1000 + index,
    });
  });
  await syncRows({ table: 'tools_eolp_subsections', planId, rows: subsectionRows });

  const personal = data.personal;
  const { error: personalError } = await supabaseServer
    .from('tools_eolp_personal')
    .update({
      full_legal_name: personal.fullLegalName,
      preferred_name: personal.preferredName,
      previous_names: personal.previousNames,
      date_of_birth: dateOrNull(personal.dateOfBirth),
      place_of_birth: personal.placeOfBirth,
      ssn_secret: secretDb(personal.ssn),
      marital_status: personal.maritalStatus,
      spouse_partner: personal.spousePartner,
      home_address: personal.homeAddress,
      phone: personal.phone,
      personal_email: personal.personalEmail,
      drivers_license_number_secret: secretDb(personal.driversLicenseNumber),
      drivers_license_state: personal.driversLicenseState,
      passport_number_secret: secretDb(personal.passportNumber),
      passport_expiration: dateOrNull(personal.passportExpiration),
      other_identification: personal.otherIdentification,
      employer: personal.employer,
      job_title: personal.jobTitle,
      employer_contact: personal.employerContact,
      hr_contact: personal.hrContact,
      work_phone: personal.workPhone,
      work_email: personal.workEmail,
      veteran_status: personal.veteranStatus,
      military_branch: personal.militaryBranch,
      service_dates: personal.serviceDates,
      military_id: personal.militaryId,
      discharge_records_location: personal.dischargeRecordsLocation,
    })
    .eq('plan_id', planId);
  await throwIfError(personalError, 'update personal');

  const extraBlocks = (data.personalExtraSections || []).map((block, index) => ({
    id: rowId(block.id),
    source: block,
    display_order: index * 10,
  }));
  await syncRows({
    table: 'tools_eolp_personal_blocks',
    planId,
    rows: extraBlocks.map(({ id, source, display_order }) => ({
      id,
      ...own,
      kind: source.kind,
      name: source.name,
      display_order,
      drivers_license_number_secret: secretDb(source.identification.driversLicenseNumber),
      drivers_license_state: source.identification.driversLicenseState,
      passport_number_secret: secretDb(source.identification.passportNumber),
      passport_expiration: dateOrNull(source.identification.passportExpiration),
      other_identification: source.identification.otherIdentification,
      employer: source.employment.employer,
      job_title: source.employment.jobTitle,
      employer_contact: source.employment.employerContact,
      hr_contact: source.employment.hrContact,
      work_phone: source.employment.workPhone,
      work_email: source.employment.workEmail,
      veteran_status: source.military.veteranStatus,
      military_branch: source.military.militaryBranch,
      service_dates: source.military.serviceDates,
      military_id: source.military.militaryId,
      discharge_records_location: source.military.dischargeRecordsLocation,
      notes: source.notes,
    })),
  });

  const familyRows = [
    ...personal.familyMembers.map((member, index) => ({
      id: rowId(member.id),
      ...own,
      personal_block_id: null,
      name: member.name,
      contact_info: member.contactInfo,
      relationship: member.relationship,
      display_order: index * 10,
    })),
    ...extraBlocks.flatMap(({ id, source }) =>
      (source.family?.members || []).map((member, index) => ({
        id: rowId(member.id),
        ...own,
        personal_block_id: id,
        name: member.name,
        contact_info: member.contactInfo,
        relationship: member.relationship,
        display_order: index * 10,
      }))
    ),
  ];
  await syncRows({ table: 'tools_eolp_family_members', planId, rows: familyRows });

  const sectionId = (key: EolBuiltInSectionId) => builtinByKey.get(key)?.id || null;
  await syncScopedList('tools_eolp_contacts', planId, sectionId('contacts'), data.contacts.map((item, index) => ({
    id: rowId(item.id),
    ...own,
    section_id: sectionId('contacts'),
    name: item.name,
    relationship: item.relationship,
    contact_type: item.contactType,
    company: item.company,
    phone: item.phone,
    alternate_phone: item.alternatePhone,
    email: item.email,
    address: item.address,
    why_contact: item.whyContact,
    priority: item.priority || index + 1,
  })));
  for (const section of incomingCustom.filter((item) => item.modeledAfter === 'contacts')) {
    await syncScopedList('tools_eolp_contacts', planId, section.id, section.contacts.map((item, index) => ({
      id: rowId(item.id),
      ...own,
      section_id: section.id,
      name: item.name,
      relationship: item.relationship,
      contact_type: item.contactType,
      company: item.company,
      phone: item.phone,
      alternate_phone: item.alternatePhone,
      email: item.email,
      address: item.address,
      why_contact: item.whyContact,
      priority: item.priority || index + 1,
    })));
  }

  await syncScopedList('tools_eolp_devices', planId, sectionId('devices'), data.devices.map((item) => ({
    id: rowId(item.id),
    ...own,
    section_id: sectionId('devices'),
    name: item.name,
    device_type: item.deviceType,
    manufacturer: item.manufacturer,
    model: item.model,
    location: item.location,
    username: item.username,
    pin_secret: secretDb(item.pin),
    password_secret: secretDb(item.password),
    recovery_key_secret: secretDb(item.recoveryKey),
    associated_account: item.associatedAccount,
    access_instructions: item.accessInstructions,
    stored_information: item.storedInformation,
  })));
  for (const section of incomingCustom.filter((item) => item.modeledAfter === 'devices')) {
    await syncScopedList('tools_eolp_devices', planId, section.id, section.devices.map((item) => ({
      id: rowId(item.id),
      ...own,
      section_id: section.id,
      name: item.name,
      device_type: item.deviceType,
      manufacturer: item.manufacturer,
      model: item.model,
      location: item.location,
      username: item.username,
      pin_secret: secretDb(item.pin),
      password_secret: secretDb(item.password),
      recovery_key_secret: secretDb(item.recoveryKey),
      associated_account: item.associatedAccount,
      access_instructions: item.accessInstructions,
      stored_information: item.storedInformation,
    })));
  }

  await syncScopedList('tools_eolp_online_accounts', planId, sectionId('online'), data.onlineAccounts.map((item) => ({
    id: rowId(item.id),
    ...own,
    section_id: sectionId('online'),
    service_name: item.serviceName,
    website: item.website,
    category: item.category,
    username: item.username,
    password_secret: secretDb(item.password),
    mfa_enabled: yesNo(item.mfaEnabled),
    mfa_method: item.mfaMethod,
    mfa_location_secret: secretDb(item.mfaLocation),
    recovery_email_secret: secretDb(item.recoveryEmail),
    recovery_phone_secret: secretDb(item.recoveryPhone),
    account_reference: item.accountReference,
    disposition: item.disposition,
    special_instructions: item.specialInstructions,
    password_stored_elsewhere: item.passwordStoredElsewhere,
    password_stored_elsewhere_detail: item.passwordStoredElsewhereDetail,
  })));
  for (const section of incomingCustom.filter((item) => item.modeledAfter === 'online')) {
    await syncScopedList('tools_eolp_online_accounts', planId, section.id, section.onlineAccounts.map((item) => ({
      id: rowId(item.id),
      ...own,
      section_id: section.id,
      service_name: item.serviceName,
      website: item.website,
      category: item.category,
      username: item.username,
      password_secret: secretDb(item.password),
      mfa_enabled: yesNo(item.mfaEnabled),
      mfa_method: item.mfaMethod,
      mfa_location_secret: secretDb(item.mfaLocation),
      recovery_email_secret: secretDb(item.recoveryEmail),
      recovery_phone_secret: secretDb(item.recoveryPhone),
      account_reference: item.accountReference,
      disposition: item.disposition,
      special_instructions: item.specialInstructions,
      password_stored_elsewhere: item.passwordStoredElsewhere,
      password_stored_elsewhere_detail: item.passwordStoredElsewhereDetail,
    })));
  }

  await syncScopedList('tools_eolp_documents', planId, sectionId('documents'), data.documents.map((item) => ({
    id: rowId(item.id),
    ...own,
    section_id: sectionId('documents'),
    name: item.name,
    document_type: item.documentType,
    original_or_copy: item.originalOrCopy,
    physical_location: item.physicalLocation,
    digital_location: item.digitalLocation,
    who_has_copy: item.whoHasCopy,
    attorney_contact: item.attorneyContact,
    date_created: dateOrNull(item.dateCreated),
    last_updated: dateOrNull(item.lastUpdated),
    expiration_date: dateOrNull(item.expirationDate),
    special_instructions: item.specialInstructions,
  })));
  for (const section of incomingCustom.filter((item) => item.modeledAfter === 'documents')) {
    await syncScopedList('tools_eolp_documents', planId, section.id, section.documents.map((item) => ({
      id: rowId(item.id),
      ...own,
      section_id: section.id,
      name: item.name,
      document_type: item.documentType,
      original_or_copy: item.originalOrCopy,
      physical_location: item.physicalLocation,
      digital_location: item.digitalLocation,
      who_has_copy: item.whoHasCopy,
      attorney_contact: item.attorneyContact,
      date_created: dateOrNull(item.dateCreated),
      last_updated: dateOrNull(item.lastUpdated),
      expiration_date: dateOrNull(item.expirationDate),
      special_instructions: item.specialInstructions,
    })));
  }

  await syncScopedList('tools_eolp_insurance', planId, sectionId('insurance'), data.insurance.map((item) => ({
    id: rowId(item.id),
    ...own,
    section_id: sectionId('insurance'),
    company: item.company,
    policy_type: item.policyType,
    policy_number: item.policyNumber,
    policyholder: item.policyholder,
    insured_person: item.insuredPerson,
    agent: item.agent,
    agent_contact: item.agentContact,
    beneficiary: item.beneficiary,
    coverage_amount: item.coverageAmount,
    premium: item.premium,
    payment_frequency: item.paymentFrequency,
    automatic_payment: yesNo(item.automaticPayment),
    payment_account: item.paymentAccount,
    expiration_renewal: item.expirationRenewal,
    website: item.website,
    claim_contact: item.claimContact,
    document_location: item.documentLocation,
    instructions: item.instructions,
  })));
  for (const section of incomingCustom.filter((item) => item.modeledAfter === 'insurance')) {
    await syncScopedList('tools_eolp_insurance', planId, section.id, section.insurance.map((item) => ({
      id: rowId(item.id),
      ...own,
      section_id: section.id,
      company: item.company,
      policy_type: item.policyType,
      policy_number: item.policyNumber,
      policyholder: item.policyholder,
      insured_person: item.insuredPerson,
      agent: item.agent,
      agent_contact: item.agentContact,
      beneficiary: item.beneficiary,
      coverage_amount: item.coverageAmount,
      premium: item.premium,
      payment_frequency: item.paymentFrequency,
      automatic_payment: yesNo(item.automaticPayment),
      payment_account: item.paymentAccount,
      expiration_renewal: item.expirationRenewal,
      website: item.website,
      claim_contact: item.claimContact,
      document_location: item.documentLocation,
      instructions: item.instructions,
    })));
  }

  const financial = data.financial;
  await syncRows({
    table: 'tools_eolp_bank_accounts',
    planId,
    rows: financial.bankAccounts.map((item, index) => ({
      id: rowId(item.id),
      ...own,
      institution: item.institution,
      account_type: item.accountType,
      owners: item.owners,
      last_four: item.lastFour,
      joint_owner: item.jointOwner,
      beneficiary: item.beneficiary,
      bank_contact: item.bankContact,
      website: item.website,
      login_storage: item.loginStorage,
      purpose: item.purpose,
      display_order: index * 10,
    })),
  });
  await syncRows({
    table: 'tools_eolp_investments',
    planId,
    rows: financial.investments.map((item, index) => ({
      id: rowId(item.id),
      ...own,
      institution: item.institution,
      account_type: item.accountType,
      owner: item.owner,
      account_reference: item.accountReference,
      beneficiaries: item.beneficiaries,
      advisor: item.advisor,
      website_login: item.websiteLogin,
      display_order: index * 10,
    })),
  });
  await syncRows({
    table: 'tools_eolp_credit_cards',
    planId,
    rows: financial.creditCards.map((item, index) => ({
      id: rowId(item.id),
      ...own,
      issuer: item.issuer,
      card_type: item.cardType,
      last_four: item.lastFour,
      primary_holder: item.primaryHolder,
      authorized_users: item.authorizedUsers,
      automatic_payments: item.automaticPayments,
      balance_notes: item.balanceNotes,
      closing_instructions: item.closingInstructions,
      display_order: index * 10,
    })),
  });
  await syncRows({
    table: 'tools_eolp_debts',
    planId,
    rows: financial.debts.map((item, index) => ({
      id: rowId(item.id),
      ...own,
      creditor: item.creditor,
      debt_type: item.debtType,
      account_reference: item.accountReference,
      approximate_balance: item.approximateBalance,
      monthly_payment: item.monthlyPayment,
      automatic_payment: item.automaticPayment,
      collateral: item.collateral,
      contact: item.contact,
      display_order: index * 10,
    })),
  });
  await syncRows({
    table: 'tools_eolp_income_sources',
    planId,
    rows: financial.incomeSources.map((item, index) => ({
      id: rowId(item.id),
      ...own,
      income_type: item.incomeType,
      amount_frequency: item.amountFrequency,
      deposited_where: item.depositedWhere,
      contact: item.contact,
      survivor_benefits: yesNo(item.survivorBenefits),
      display_order: index * 10,
    })),
  });
  await syncRows({
    table: 'tools_eolp_recurring_bills',
    planId,
    rows: financial.recurringBills.map((item, index) => ({
      id: rowId(item.id),
      ...own,
      company: item.company,
      description: item.description,
      amount: item.amount,
      frequency: item.frequency,
      due_date: item.dueDate,
      automatic_payment: yesNo(item.automaticPayment),
      payment_account: item.paymentAccount,
      cancel_after_death: yesNo(item.cancelAfterDeath),
      display_order: index * 10,
    })),
  });

  const home = data.home;
  const { error: homeError } = await supabaseServer
    .from('tools_eolp_home')
    .update({
      address: home.property.address,
      ownership_type: home.property.ownershipType,
      other_owners: home.property.otherOwners,
      mortgage_company: home.property.mortgageCompany,
      mortgage_reference: home.property.mortgageReference,
      mortgage_balance: home.property.mortgageBalance,
      monthly_payment: home.property.monthlyPayment,
      property_tax: home.property.propertyTax,
      homeowners_insurance: home.property.homeownersInsurance,
      deed_location: home.property.deedLocation,
      garage_code_secret: secretDb(home.access.garageCode),
      alarm_information_secret: secretDb(home.access.alarmInformation),
      safe_location: home.access.safeLocation,
      safe_instructions_secret: secretDb(home.access.safeInstructions),
      spare_key_location: home.access.spareKeyLocation,
      mailbox_information: home.access.mailboxInformation,
      camera_information: home.access.cameraInformation,
    })
    .eq('plan_id', planId);
  await throwIfError(homeError, 'update home');

  await syncRows({
    table: 'tools_eolp_utilities',
    planId,
    rows: home.utilities.map((item, index) => ({
      id: rowId(item.id),
      ...own,
      utility_type: item.utilityType,
      provider: item.provider,
      account_reference: item.accountReference,
      contact: item.contact,
      automatic_payment: item.automaticPayment,
      payment_source: item.paymentSource,
      login_reference: item.loginReference,
      display_order: index * 10,
    })),
  });
  await syncRows({
    table: 'tools_eolp_providers',
    planId,
    rows: home.providers.map((item, index) => ({
      id: rowId(item.id),
      ...own,
      provider_type: item.providerType,
      name: item.name,
      contact: item.contact,
      account_reference: item.accountReference,
      notes: item.notes,
      display_order: index * 10,
    })),
  });
  await syncRows({
    table: 'tools_eolp_vehicles',
    planId,
    rows: home.vehicles.map((item, index) => ({
      id: rowId(item.id),
      ...own,
      year: item.year,
      make: item.make,
      model: item.model,
      vin: item.vin,
      loan_information: item.loanInformation,
      title_location: item.titleLocation,
      insurance: item.insurance,
      spare_key_location: item.spareKeyLocation,
      display_order: index * 10,
    })),
  });

  const contactIds = new Set([
    ...data.contacts.map((item) => rowId(item.id)),
    ...incomingCustom.flatMap((section) => section.contacts.map((item) => rowId(item.id))),
  ]);
  const { data: existingSteps } = await supabaseServer
    .from('tools_eolp_next_steps')
    .select('id, seed_key')
    .eq('plan_id', planId);
  const stepIdBySeed = new Map(
    (existingSteps || [])
      .filter((item) => item.seed_key)
      .map((item) => [String(item.seed_key), item.id])
  );
  await syncRows({
    table: 'tools_eolp_next_steps',
    planId,
    rows: data.nextSteps.map((item, index) => ({
      id: (item.seedKey && stepIdBySeed.get(item.seedKey)) || rowId(item.id),
      ...own,
      seed_key: item.seedKey || null,
      is_predefined: Boolean(item.isPredefined),
      is_hidden: Boolean(item.hidden),
      title: item.title,
      priority: item.priority || 'Medium',
      person_responsible: item.personResponsible,
      instructions: item.instructions,
      related_contact_id: isEolUuid(item.relatedContactId) && contactIds.has(item.relatedContactId) ? item.relatedContactId : null,
      related_document: item.relatedDocument,
      status: item.status || 'Not started',
      display_order: index * 10,
    })),
  });

  const wishes = data.eolWishes;
  const { error: wishesError } = await supabaseServer
    .from('tools_eolp_eol_wishes')
    .update({
      disposition_preference: wishes.dispositionPreference,
      funeral_home: wishes.funeralHome,
      funeral_home_contact: wishes.funeralHomeContact,
      cemetery: wishes.cemetery,
      cemetery_plot: wishes.cemeteryPlot,
      paperwork_location: wishes.paperworkLocation,
      funeral_service_desired: yesNo(wishes.funeralServiceDesired),
      memorial_service_desired: yesNo(wishes.memorialServiceDesired),
      religious_service: yesNo(wishes.religiousService),
      clergy: wishes.clergy,
      viewing: yesNo(wishes.viewing),
      casket_preference: wishes.casketPreference,
      preferred_location: wishes.preferredLocation,
      preferred_music: wishes.preferredMusic,
      preferred_readings: wishes.preferredReadings,
      preferred_speakers: wishes.preferredSpeakers,
      obituary_wishes: wishes.obituaryWishes,
      people_to_notify: wishes.peopleToNotify,
      organizations_to_notify: wishes.organizationsToNotify,
      flowers_preference: wishes.flowersPreference,
      memorial_donation: wishes.memorialDonation,
      pallbearer_preferences: wishes.pallbearerPreferences,
      clothing_preference: wishes.clothingPreference,
      military_honors: wishes.militaryHonors,
      headstone_wishes: wishes.headstoneWishes,
      ashes_instructions: wishes.ashesInstructions,
      organ_donation_wishes: wishes.organDonationWishes,
      prepaid_arrangements: wishes.prepaidArrangements,
      funeral_contract_location: wishes.funeralContractLocation,
    })
    .eq('plan_id', planId);
  await throwIfError(wishesError, 'update eol wishes');

  const myWishes = data.myWishes;
  const { error: myWishesError } = await supabaseServer
    .from('tools_eolp_my_wishes')
    .update({
      most_important: myWishes.mostImportant,
      family_to_know: myWishes.familyToKnow,
      traditions: myWishes.traditions,
      special_belongings: myWishes.specialBelongings,
      specific_gifts: myWishes.specificGifts,
      charitable_wishes: myWishes.charitableWishes,
      important_organizations: myWishes.importantOrganizations,
      pets_care: myWishes.petsCare,
      social_media: myWishes.socialMedia,
      digital_media: myWishes.digitalMedia,
      collections: myWishes.collections,
      personal_files: myWishes.personalFiles,
      phone_computer: myWishes.phoneComputer,
      online_presence: myWishes.onlinePresence,
      thanked_remembered: myWishes.thankedRemembered,
      do_not_want: myWishes.doNotWant,
    })
    .eq('plan_id', planId);
  await throwIfError(myWishesError, 'update my wishes');

  await syncRows({
    table: 'tools_eolp_personal_items',
    planId,
    rows: myWishes.personalItems.map((item, index) => ({
      id: rowId(item.id),
      ...own,
      item: item.item,
      description: item.description,
      location: item.location,
      recipient: item.recipient,
      reason: item.reason,
      photo_reference: item.photoReference,
      special_instructions: item.specialInstructions,
      display_order: index * 10,
    })),
  });

  await syncScopedList('tools_eolp_letters', planId, sectionId('letters'), data.letters.map((item) => ({
    id: rowId(item.id),
    ...own,
    section_id: sectionId('letters'),
    title: item.title,
    recipient: item.recipient,
    letter_type: item.letterType,
    body_secret: secretDb(item.body),
    when_to_share: item.whenToShare,
    instructions: item.instructions,
    status: item.status || 'Draft',
    visibility: item.visibility || 'Visible',
    last_updated: item.lastUpdated || new Date().toISOString(),
  })));
  for (const section of incomingCustom.filter((item) => item.modeledAfter === 'letters')) {
    await syncScopedList('tools_eolp_letters', planId, section.id, section.letters.map((item) => ({
      id: rowId(item.id),
      ...own,
      section_id: section.id,
      title: item.title,
      recipient: item.recipient,
      letter_type: item.letterType,
      body_secret: secretDb(item.body),
      when_to_share: item.whenToShare,
      instructions: item.instructions,
      status: item.status || 'Draft',
      visibility: item.visibility || 'Visible',
      last_updated: item.lastUpdated || new Date().toISOString(),
    })));
  }

  const otherRecords = [
    ...data.otherRecords.map((item) => ({ item, sectionId: sectionId('other') })),
    ...incomingCustom
      .filter((section) => section.modeledAfter === 'other')
      .flatMap((section) => section.otherRecords.map((item) => ({ item, sectionId: section.id }))),
  ];
  await syncRows({
    table: 'tools_eolp_other_records',
    planId,
    rows: otherRecords.map(({ item, sectionId: scoped }, index) => ({
      id: rowId(item.id),
      ...own,
      section_id: scoped,
      title: item.title,
      category: item.category,
      description: item.description,
      important_date: dateOrNull(item.importantDate),
      contact: item.contact,
      location: item.location,
      website: item.website,
      instructions: item.instructions,
      custom_notes: item.customNotes,
      display_order: index * 10,
    })),
  });
  const { data: existingFields, error: fieldsError } = await supabaseServer
    .from('tools_eolp_other_custom_fields')
    .select('id, record_id')
    .eq('user_id', userId)
    .eq('tool_id', toolId);
  await throwIfError(fieldsError, 'load custom fields');
  const recordIds = new Set(otherRecords.map(({ item }) => rowId(item.id)));
  const staleFields = (existingFields || []).filter((row) => recordIds.has(row.record_id)).map((row) => row.id);
  if (staleFields.length) {
    await supabaseServer.from('tools_eolp_other_custom_fields').delete().in('id', staleFields);
  }
  const fieldRows = otherRecords.flatMap(({ item }) =>
    (item.customFields || []).map((field, index) => ({
      id: rowId(field.id),
      user_id: userId,
      tool_id: toolId,
      record_id: rowId(item.id),
      label: field.label,
      value: field.value,
      display_order: index * 10,
    }))
  );
  if (fieldRows.length) {
    const { error } = await supabaseServer.from('tools_eolp_other_custom_fields').upsert(fieldRows, { onConflict: 'id' });
    await throwIfError(error, 'upsert custom fields');
  }
}

async function syncScopedList(table: string, planId: string, sectionId: string | null, rows: Record<string, unknown>[]) {
  if (!sectionId) {
    await syncRows({ table, planId, rows });
    return;
  }
  await syncRows({ table, planId, rows, scope: { column: 'section_id', value: sectionId } });
}

function withFiles<T extends { id: string }>(item: T, files: Record<string, EolAttachment[]>): T & { attachments: EolAttachment[] } {
  return { ...item, attachments: files[item.id] || [] };
}

async function hydratePlan(_userId: string, _toolId: string, row: Record<string, unknown>): Promise<EolPlan> {
  const planId = String(row.id);
  const [
    sectionsRes,
    subsectionsRes,
    personalRes,
    blocksRes,
    familyRes,
    contactsRes,
    devicesRes,
    onlineRes,
    documentsRes,
    insuranceRes,
    banksRes,
    investRes,
    cardsRes,
    debtsRes,
    incomeRes,
    billsRes,
    homeRes,
    utilitiesRes,
    providersRes,
    vehiclesRes,
    stepsRes,
    wishesRes,
    myWishesRes,
    itemsRes,
    lettersRes,
    otherRes,
  ] = await Promise.all([
    supabaseServer.from('tools_eolp_sections').select('*').eq('plan_id', planId).order('display_order'),
    supabaseServer.from('tools_eolp_subsections').select('*').eq('plan_id', planId),
    supabaseServer.from('tools_eolp_personal').select('*').eq('plan_id', planId).maybeSingle(),
    supabaseServer.from('tools_eolp_personal_blocks').select('*').eq('plan_id', planId).order('display_order'),
    supabaseServer.from('tools_eolp_family_members').select('*').eq('plan_id', planId).order('display_order'),
    supabaseServer.from('tools_eolp_contacts').select('*').eq('plan_id', planId).order('priority'),
    supabaseServer.from('tools_eolp_devices').select('*').eq('plan_id', planId),
    supabaseServer.from('tools_eolp_online_accounts').select('*').eq('plan_id', planId),
    supabaseServer.from('tools_eolp_documents').select('*').eq('plan_id', planId),
    supabaseServer.from('tools_eolp_insurance').select('*').eq('plan_id', planId),
    supabaseServer.from('tools_eolp_bank_accounts').select('*').eq('plan_id', planId).order('display_order'),
    supabaseServer.from('tools_eolp_investments').select('*').eq('plan_id', planId).order('display_order'),
    supabaseServer.from('tools_eolp_credit_cards').select('*').eq('plan_id', planId).order('display_order'),
    supabaseServer.from('tools_eolp_debts').select('*').eq('plan_id', planId).order('display_order'),
    supabaseServer.from('tools_eolp_income_sources').select('*').eq('plan_id', planId).order('display_order'),
    supabaseServer.from('tools_eolp_recurring_bills').select('*').eq('plan_id', planId).order('display_order'),
    supabaseServer.from('tools_eolp_home').select('*').eq('plan_id', planId).maybeSingle(),
    supabaseServer.from('tools_eolp_utilities').select('*').eq('plan_id', planId).order('display_order'),
    supabaseServer.from('tools_eolp_providers').select('*').eq('plan_id', planId).order('display_order'),
    supabaseServer.from('tools_eolp_vehicles').select('*').eq('plan_id', planId).order('display_order'),
    supabaseServer.from('tools_eolp_next_steps').select('*').eq('plan_id', planId).order('display_order'),
    supabaseServer.from('tools_eolp_eol_wishes').select('*').eq('plan_id', planId).maybeSingle(),
    supabaseServer.from('tools_eolp_my_wishes').select('*').eq('plan_id', planId).maybeSingle(),
    supabaseServer.from('tools_eolp_personal_items').select('*').eq('plan_id', planId).order('display_order'),
    supabaseServer.from('tools_eolp_letters').select('*').eq('plan_id', planId),
    supabaseServer.from('tools_eolp_other_records').select('*').eq('plan_id', planId).order('display_order'),
  ]);

  const sections = (sectionsRes.data || []) as SectionRow[];
  const builtin = new Map(sections.filter((item) => item.kind === 'builtin').map((item) => [item.builtin_key, item]));
  const customSections = sections.filter((item) => item.kind === 'custom');
  const otherIds = (otherRes.data || []).map((item) => item.id);
  const { data: customFields } = otherIds.length
    ? await supabaseServer.from('tools_eolp_other_custom_fields').select('*').in('record_id', otherIds)
    : { data: [] };

  const [documentFiles, insuranceFiles, letterFiles, personalItemFiles, otherFiles] = await Promise.all([
    attachmentsByOwnerIds('document', (documentsRes.data || []).map((item) => item.id), _userId),
    attachmentsByOwnerIds('insurance', (insuranceRes.data || []).map((item) => item.id), _userId),
    attachmentsByOwnerIds('letter', (lettersRes.data || []).map((item) => item.id), _userId),
    attachmentsByOwnerIds('personal-item', (itemsRes.data || []).map((item) => item.id), _userId),
    attachmentsByOwnerIds('other', otherIds, _userId),
  ]);

  const data = emptyPlanData();
  const personal = personalRes.data || {};
  data.personal = {
    ...data.personal,
    fullLegalName: text(personal.full_legal_name),
    preferredName: text(personal.preferred_name),
    previousNames: text(personal.previous_names),
    dateOfBirth: dateOrEmpty(personal.date_of_birth),
    placeOfBirth: text(personal.place_of_birth),
    ssn: withSecret(text(personal.ssn_secret)),
    maritalStatus: text(personal.marital_status),
    spousePartner: text(personal.spouse_partner),
    homeAddress: text(personal.home_address),
    phone: text(personal.phone),
    personalEmail: text(personal.personal_email),
    driversLicenseNumber: withSecret(text(personal.drivers_license_number_secret)),
    driversLicenseState: text(personal.drivers_license_state),
    passportNumber: withSecret(text(personal.passport_number_secret)),
    passportExpiration: dateOrEmpty(personal.passport_expiration),
    otherIdentification: text(personal.other_identification),
    employer: text(personal.employer),
    jobTitle: text(personal.job_title),
    employerContact: text(personal.employer_contact),
    hrContact: text(personal.hr_contact),
    workPhone: text(personal.work_phone),
    workEmail: text(personal.work_email),
    veteranStatus: text(personal.veteran_status),
    militaryBranch: text(personal.military_branch),
    serviceDates: text(personal.service_dates),
    militaryId: text(personal.military_id),
    dischargeRecordsLocation: text(personal.discharge_records_location),
    familyMembers: (familyRes.data || [])
      .filter((item) => !item.personal_block_id)
      .map((item) => ({
        id: item.id,
        name: text(item.name),
        contactInfo: text(item.contact_info),
        relationship: text(item.relationship),
      })),
  };

  data.personalExtraSections = (blocksRes.data || []).map((block) => ({
    id: block.id,
    kind: block.kind,
    name: text(block.name),
    identification: {
      driversLicenseNumber: withSecret(text(block.drivers_license_number_secret)),
      driversLicenseState: text(block.drivers_license_state),
      passportNumber: withSecret(text(block.passport_number_secret)),
      passportExpiration: dateOrEmpty(block.passport_expiration),
      otherIdentification: text(block.other_identification),
    },
    employment: {
      employer: text(block.employer),
      jobTitle: text(block.job_title),
      employerContact: text(block.employer_contact),
      hrContact: text(block.hr_contact),
      workPhone: text(block.work_phone),
      workEmail: text(block.work_email),
    },
    military: {
      veteranStatus: text(block.veteran_status),
      militaryBranch: text(block.military_branch),
      serviceDates: text(block.service_dates),
      militaryId: text(block.military_id),
      dischargeRecordsLocation: text(block.discharge_records_location),
    },
    family: {
      members: (familyRes.data || [])
        .filter((item) => item.personal_block_id === block.id)
        .map((item) => ({
          id: item.id,
          name: text(item.name),
          contactInfo: text(item.contact_info),
          relationship: text(item.relationship),
        })),
    },
    notes: text(block.notes),
  }));

  const contactsSection = builtin.get('contacts')?.id;
  data.contacts = (contactsRes.data || [])
    .filter((item) => !item.section_id || item.section_id === contactsSection)
    .map(mapContact);
  data.devices = (devicesRes.data || [])
    .filter((item) => !item.section_id || item.section_id === builtin.get('devices')?.id)
    .map(mapDevice);
  data.onlineAccounts = (onlineRes.data || [])
    .filter((item) => !item.section_id || item.section_id === builtin.get('online')?.id)
    .map(mapOnline);
  data.documents = (documentsRes.data || [])
    .filter((item) => !item.section_id || item.section_id === builtin.get('documents')?.id)
    .map((item) => withFiles(mapDocument(item), documentFiles));
  data.insurance = (insuranceRes.data || [])
    .filter((item) => !item.section_id || item.section_id === builtin.get('insurance')?.id)
    .map((item) => withFiles(mapInsurance(item), insuranceFiles));

  data.financial = {
    bankAccounts: (banksRes.data || []).map((item) => ({
      id: item.id,
      institution: text(item.institution),
      accountType: text(item.account_type),
      owners: text(item.owners),
      lastFour: text(item.last_four),
      jointOwner: text(item.joint_owner),
      beneficiary: text(item.beneficiary),
      bankContact: text(item.bank_contact),
      website: text(item.website),
      loginStorage: text(item.login_storage),
      purpose: text(item.purpose),
    })),
    investments: (investRes.data || []).map((item) => ({
      id: item.id,
      institution: text(item.institution),
      accountType: text(item.account_type),
      owner: text(item.owner),
      accountReference: text(item.account_reference),
      beneficiaries: text(item.beneficiaries),
      advisor: text(item.advisor),
      websiteLogin: text(item.website_login),
    })),
    creditCards: (cardsRes.data || []).map((item) => ({
      id: item.id,
      issuer: text(item.issuer),
      cardType: text(item.card_type),
      lastFour: text(item.last_four),
      primaryHolder: text(item.primary_holder),
      authorizedUsers: text(item.authorized_users),
      automaticPayments: text(item.automatic_payments),
      balanceNotes: text(item.balance_notes),
      closingInstructions: text(item.closing_instructions),
    })),
    debts: (debtsRes.data || []).map((item) => ({
      id: item.id,
      creditor: text(item.creditor),
      debtType: text(item.debt_type),
      accountReference: text(item.account_reference),
      approximateBalance: text(item.approximate_balance),
      monthlyPayment: text(item.monthly_payment),
      automaticPayment: text(item.automatic_payment),
      collateral: text(item.collateral),
      contact: text(item.contact),
    })),
    incomeSources: (incomeRes.data || []).map((item) => ({
      id: item.id,
      incomeType: text(item.income_type),
      amountFrequency: text(item.amount_frequency),
      depositedWhere: text(item.deposited_where),
      contact: text(item.contact),
      survivorBenefits: yesNo(item.survivor_benefits),
    })),
    recurringBills: (billsRes.data || []).map((item) => ({
      id: item.id,
      company: text(item.company),
      description: text(item.description),
      amount: text(item.amount),
      frequency: text(item.frequency),
      dueDate: text(item.due_date),
      automaticPayment: yesNo(item.automatic_payment),
      paymentAccount: text(item.payment_account),
      cancelAfterDeath: yesNo(item.cancel_after_death),
    })),
  };

  const home = homeRes.data || {};
  data.home = {
    property: {
      ...emptyProperty(),
      address: text(home.address),
      ownershipType: text(home.ownership_type),
      otherOwners: text(home.other_owners),
      mortgageCompany: text(home.mortgage_company),
      mortgageReference: text(home.mortgage_reference),
      mortgageBalance: text(home.mortgage_balance),
      monthlyPayment: text(home.monthly_payment),
      propertyTax: text(home.property_tax),
      homeownersInsurance: text(home.homeowners_insurance),
      deedLocation: text(home.deed_location),
    },
    access: {
      ...emptyHomeAccess(),
      garageCode: withSecret(text(home.garage_code_secret)),
      alarmInformation: withSecret(text(home.alarm_information_secret)),
      safeLocation: text(home.safe_location),
      safeInstructions: withSecret(text(home.safe_instructions_secret)),
      spareKeyLocation: text(home.spare_key_location),
      mailboxInformation: text(home.mailbox_information),
      cameraInformation: text(home.camera_information),
    },
    utilities: (utilitiesRes.data || []).map((item) => ({
      id: item.id,
      utilityType: text(item.utility_type),
      provider: text(item.provider),
      accountReference: text(item.account_reference),
      contact: text(item.contact),
      automaticPayment: text(item.automatic_payment),
      paymentSource: text(item.payment_source),
      loginReference: text(item.login_reference),
    })),
    providers: (providersRes.data || []).map((item) => ({
      id: item.id,
      providerType: text(item.provider_type),
      name: text(item.name),
      contact: text(item.contact),
      accountReference: text(item.account_reference),
      notes: text(item.notes),
    })),
    vehicles: (vehiclesRes.data || []).map((item) => ({
      id: item.id,
      year: text(item.year),
      make: text(item.make),
      model: text(item.model),
      vin: text(item.vin),
      loanInformation: text(item.loan_information),
      titleLocation: text(item.title_location),
      insurance: text(item.insurance),
      spareKeyLocation: text(item.spare_key_location),
    })),
  };

  data.nextSteps = (stepsRes.data || []).map((item) => ({
    id: item.id,
    seedKey: item.seed_key || undefined,
    isPredefined: Boolean(item.is_predefined),
    hidden: Boolean(item.is_hidden),
    title: text(item.title),
    priority: item.priority || 'Medium',
    personResponsible: text(item.person_responsible),
    instructions: text(item.instructions),
    relatedContactId: text(item.related_contact_id),
    relatedDocument: text(item.related_document),
    status: item.status || 'Not started',
  }));

  const eol = wishesRes.data || {};
  data.eolWishes = {
    ...data.eolWishes,
    dispositionPreference: text(eol.disposition_preference),
    funeralHome: text(eol.funeral_home),
    funeralHomeContact: text(eol.funeral_home_contact),
    cemetery: text(eol.cemetery),
    cemeteryPlot: text(eol.cemetery_plot),
    paperworkLocation: text(eol.paperwork_location),
    funeralServiceDesired: yesNo(eol.funeral_service_desired),
    memorialServiceDesired: yesNo(eol.memorial_service_desired),
    religiousService: yesNo(eol.religious_service),
    clergy: text(eol.clergy),
    viewing: yesNo(eol.viewing),
    casketPreference: text(eol.casket_preference),
    preferredLocation: text(eol.preferred_location),
    preferredMusic: text(eol.preferred_music),
    preferredReadings: text(eol.preferred_readings),
    preferredSpeakers: text(eol.preferred_speakers),
    obituaryWishes: text(eol.obituary_wishes),
    peopleToNotify: text(eol.people_to_notify),
    organizationsToNotify: text(eol.organizations_to_notify),
    flowersPreference: text(eol.flowers_preference),
    memorialDonation: text(eol.memorial_donation),
    pallbearerPreferences: text(eol.pallbearer_preferences),
    clothingPreference: text(eol.clothing_preference),
    militaryHonors: text(eol.military_honors),
    headstoneWishes: text(eol.headstone_wishes),
    ashesInstructions: text(eol.ashes_instructions),
    organDonationWishes: text(eol.organ_donation_wishes),
    prepaidArrangements: text(eol.prepaid_arrangements),
    funeralContractLocation: text(eol.funeral_contract_location),
  };

  const mine = myWishesRes.data || {};
  data.myWishes = {
    ...data.myWishes,
    mostImportant: text(mine.most_important),
    familyToKnow: text(mine.family_to_know),
    traditions: text(mine.traditions),
    specialBelongings: text(mine.special_belongings),
    specificGifts: text(mine.specific_gifts),
    charitableWishes: text(mine.charitable_wishes),
    importantOrganizations: text(mine.important_organizations),
    petsCare: text(mine.pets_care),
    socialMedia: text(mine.social_media),
    digitalMedia: text(mine.digital_media),
    collections: text(mine.collections),
    personalFiles: text(mine.personal_files),
    phoneComputer: text(mine.phone_computer),
    onlinePresence: text(mine.online_presence),
    thankedRemembered: text(mine.thanked_remembered),
    doNotWant: text(mine.do_not_want),
    personalItems: (itemsRes.data || []).map((item) =>
      withFiles(
        {
          id: item.id,
          item: text(item.item),
          description: text(item.description),
          location: text(item.location),
          recipient: text(item.recipient),
          reason: text(item.reason),
          photoReference: text(item.photo_reference),
          specialInstructions: text(item.special_instructions),
        },
        personalItemFiles
      )
    ),
  };

  data.letters = (lettersRes.data || [])
    .filter((item) => !item.section_id || item.section_id === builtin.get('letters')?.id)
    .map((item) => withFiles(mapLetter(item), letterFiles));
  const fieldsByRecord = new Map<string, { id: string; label: string; value: string }[]>();
  (customFields || []).forEach((field) => {
    const list = fieldsByRecord.get(field.record_id) || [];
    list.push({ id: field.id, label: text(field.label), value: text(field.value) });
    fieldsByRecord.set(field.record_id, list);
  });
  data.otherRecords = (otherRes.data || [])
    .filter((item) => !item.section_id || item.section_id === builtin.get('other')?.id)
    .map((item) => withFiles(mapOther(item, fieldsByRecord.get(item.id) || []), otherFiles));

  sections.forEach((section) => {
    if (section.kind === 'builtin' && section.builtin_key) {
      data.sectionLabels[section.builtin_key] = section.name;
      data[NOTE_KEYS[section.builtin_key]] = section.notes as never;
      if (section.is_complete) data.completedSectionIds.push(section.builtin_key);
      if (section.is_inactive) data.inactiveSectionIds.push(section.builtin_key);
      if (section.is_removed) data.removedSectionIds.push(section.builtin_key);
    }
  });
  (subsectionsRes.data || []).forEach((item) => {
    data.sectionLabels[item.subsection_key] = item.name;
    if (item.is_inactive) data.inactiveSubsectionIds.push(item.subsection_key);
  });

  data.customSections = customSections.map((section) => {
    const custom: EolCustomSection = {
      ...emptyCustomSection(section.name, (section.modeled_after || 'other') as EolCustomTemplate),
      id: section.id,
      name: section.name,
      notes: section.notes,
    };
    if (section.is_complete) data.completedSectionIds.push(section.id);
    if (section.is_inactive) data.inactiveSectionIds.push(section.id);
    if (section.is_removed) data.removedSectionIds.push(section.id);
    if (section.modeled_after === 'contacts') custom.contacts = (contactsRes.data || []).filter((item) => item.section_id === section.id).map(mapContact);
    if (section.modeled_after === 'devices') custom.devices = (devicesRes.data || []).filter((item) => item.section_id === section.id).map(mapDevice);
    if (section.modeled_after === 'online') custom.onlineAccounts = (onlineRes.data || []).filter((item) => item.section_id === section.id).map(mapOnline);
    if (section.modeled_after === 'documents') custom.documents = (documentsRes.data || []).filter((item) => item.section_id === section.id).map((item) => withFiles(mapDocument(item), documentFiles));
    if (section.modeled_after === 'insurance') custom.insurance = (insuranceRes.data || []).filter((item) => item.section_id === section.id).map((item) => withFiles(mapInsurance(item), insuranceFiles));
    if (section.modeled_after === 'letters') custom.letters = (lettersRes.data || []).filter((item) => item.section_id === section.id).map((item) => withFiles(mapLetter(item), letterFiles));
    if (section.modeled_after === 'other') {
      custom.otherRecords = (otherRes.data || [])
        .filter((item) => item.section_id === section.id)
        .map((item) => withFiles(mapOther(item, fieldsByRecord.get(item.id) || []), otherFiles));
    }
    return custom;
  });

  data.sectionOrder = sections
    .filter((section) => !section.is_removed)
    .sort((a, b) => a.display_order - b.display_order)
    .map((section) => (section.kind === 'builtin' && section.builtin_key ? section.builtin_key : section.id));

  return {
    id: planId,
    name: text(row.name),
    personFullName: text(row.person_full_name),
    relationship: (text(row.relationship) as EolRelationship | '') || '',
    relationshipCustom: text(row.relationship_custom),
    dateOfBirth: dateOrEmpty(row.date_of_birth as string),
    dateCreated: text(row.created_at) || new Date().toISOString(),
    lastUpdated: text(row.updated_at) || new Date().toISOString(),
    card_color: text(row.card_color) || '#10b981',
    status: (row.status === 'Archived' ? 'Archived' : 'Active') as EolPlanStatus,
    historyEvents: seedPlanHistory({
      historyEvents: normalizeHistoryEvents(row.history_events),
      dateCreated: text(row.created_at) || new Date().toISOString(),
    } as EolPlan),
    data,
  };
}

function mapContact(item: Record<string, unknown>) {
  return {
    id: text(item.id),
    name: text(item.name),
    relationship: text(item.relationship),
    contactType: text(item.contact_type),
    company: text(item.company),
    phone: text(item.phone),
    alternatePhone: text(item.alternate_phone),
    email: text(item.email),
    address: text(item.address),
    whyContact: text(item.why_contact),
    priority: Number(item.priority) || 1,
  };
}

function mapDevice(item: Record<string, unknown>) {
  return {
    id: text(item.id),
    name: text(item.name),
    deviceType: text(item.device_type),
    manufacturer: text(item.manufacturer),
    model: text(item.model),
    location: text(item.location),
    username: text(item.username),
    pin: withSecret(text(item.pin_secret)),
    password: withSecret(text(item.password_secret)),
    recoveryKey: withSecret(text(item.recovery_key_secret)),
    associatedAccount: text(item.associated_account),
    accessInstructions: text(item.access_instructions),
    storedInformation: text(item.stored_information),
  };
}

function mapOnline(item: Record<string, unknown>) {
  return {
    id: text(item.id),
    serviceName: text(item.service_name),
    website: text(item.website),
    category: text(item.category),
    username: text(item.username),
    password: withSecret(text(item.password_secret)),
    mfaEnabled: yesNo(item.mfa_enabled),
    mfaMethod: text(item.mfa_method),
    mfaLocation: withSecret(text(item.mfa_location_secret)),
    recoveryEmail: withSecret(text(item.recovery_email_secret)),
    recoveryPhone: withSecret(text(item.recovery_phone_secret)),
    accountReference: text(item.account_reference),
    disposition: text(item.disposition),
    specialInstructions: text(item.special_instructions),
    passwordStoredElsewhere: text(item.password_stored_elsewhere),
    passwordStoredElsewhereDetail: text(item.password_stored_elsewhere_detail),
  };
}

function mapDocument(item: Record<string, unknown>) {
  return {
    id: text(item.id),
    name: text(item.name),
    documentType: text(item.document_type),
    originalOrCopy: text(item.original_or_copy),
    physicalLocation: text(item.physical_location),
    digitalLocation: text(item.digital_location),
    whoHasCopy: text(item.who_has_copy),
    attorneyContact: text(item.attorney_contact),
    dateCreated: dateOrEmpty(item.date_created as string),
    lastUpdated: dateOrEmpty(item.last_updated as string),
    expirationDate: dateOrEmpty(item.expiration_date as string),
    specialInstructions: text(item.special_instructions),
  };
}

function mapInsurance(item: Record<string, unknown>) {
  return {
    id: text(item.id),
    company: text(item.company),
    policyType: text(item.policy_type),
    policyNumber: text(item.policy_number),
    policyholder: text(item.policyholder),
    insuredPerson: text(item.insured_person),
    agent: text(item.agent),
    agentContact: text(item.agent_contact),
    beneficiary: text(item.beneficiary),
    coverageAmount: text(item.coverage_amount),
    premium: text(item.premium),
    paymentFrequency: text(item.payment_frequency),
    automaticPayment: yesNo(item.automatic_payment),
    paymentAccount: text(item.payment_account),
    expirationRenewal: text(item.expiration_renewal),
    website: text(item.website),
    claimContact: text(item.claim_contact),
    documentLocation: text(item.document_location),
    instructions: text(item.instructions),
  };
}

function mapLetter(item: Record<string, unknown>) {
  return {
    id: text(item.id),
    title: text(item.title),
    recipient: text(item.recipient),
    letterType: text(item.letter_type),
    body: withSecret(text(item.body_secret)),
    whenToShare: text(item.when_to_share),
    instructions: text(item.instructions),
    status: (item.status === 'Complete' ? 'Complete' : 'Draft') as 'Draft' | 'Complete',
    visibility: (item.visibility === 'Private' ? 'Private' : 'Visible') as 'Visible' | 'Private',
    lastUpdated: text(item.last_updated) || new Date().toISOString(),
  };
}

function mapOther(item: Record<string, unknown>, customFields: { id: string; label: string; value: string }[]) {
  return {
    id: text(item.id),
    title: text(item.title),
    category: text(item.category),
    description: text(item.description),
    importantDate: dateOrEmpty(item.important_date as string),
    contact: text(item.contact),
    location: text(item.location),
    website: text(item.website),
    instructions: text(item.instructions),
    customNotes: text(item.custom_notes),
    customFields,
  };
}
