'use client';

/**
 * End of Life Planner.
 * Persists to /api/tools/end-of-life-planner (tools_eolp_*).
 * localStorage drafts are migrated once if the database is empty.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTheme } from './AppThemeProvider';
import {
  ACCOUNT_DISPOSITIONS,
  BANK_ACCOUNT_TYPES,
  cloneCustomSection,
  CONTACT_TYPES,
  copyName,
  createEolId,
  duplicateBuiltInSection,
  duplicatePersonalSubsection,
  DEBT_TYPES,
  DEVICE_TYPES,
  DOCUMENT_TYPES,
  duplicateListItem,
  emptyBankAccount,
  emptyContact,
  emptyCreditCard,
  emptyCustomField,
  emptyCustomRecord,
  emptyDebt,
  emptyDevice,
  emptyDocumentNote,
  emptyFamilyPerson,
  FAMILY_RELATIONSHIPS,
  emptyHomeProvider,
  emptyIncomeSource,
  emptyInsurancePolicy,
  emptyInvestmentAccount,
  emptyLetter,
  emptyNextStep,
  emptyOnlineAccount,
  emptyPersonalItem,
  emptyRecurringBill,
  emptyUtility,
  emptyVehicle,
  EOL_BUILT_IN_TABS,
  EOL_CUSTOM_TEMPLATES,
  EOL_RELATIONSHIPS,
  EOL_TOOL_DESCRIPTION,
  EOL_TOOL_TITLE,
  EolBankAccount,
  EolBuiltInSectionId,
  EolContact,
  EolCreditCard,
  EolCustomRecord,
  EolCustomSection,
  EolDebt,
  EolDevice,
  EolDocumentNote,
  EolFamilyPerson,
  EolHomeProvider,
  EolIncomeSource,
  EolInsurancePolicy,
  EolInvestmentAccount,
  EolLetter,
  EolNextStep,
  EolOnlineAccount,
  EolPersonalItem,
  EolRecurringBill,
  EolUtility,
  EolVehicle,
  EolPersonalBlockKind,
  EolPersonalExtraSection,
  EolPlan,
  EolPlanData,
  EolRelationship,
  formatDateDisplay,
  formatDateTimeDisplay,
  appendPlanHistory,
  HOME_PROVIDER_TYPES,
  INCOME_TYPES,
  insertSectionAfter,
  INVESTMENT_TYPES,
  LETTER_TYPES,
  clearEolDraft,
  loadEolDraft,
  moveSectionOrder,
  maskSecret,
  MY_WISHES_QUESTIONS,
  nowIso,
  ONLINE_CATEGORIES,
  overallPlanPercent,
  PASSWORD_MANAGERS,
  POLICY_TYPES,
  removeListItem,
  reorderList,
  replaceListItem,
  resolveSectionOrder,
  secretText,
  sortContacts,
  touchPlan,
  UTILITY_TYPES,
  withSecret,
} from '@/lib/end-of-life-planner';

type EndOfLifePlannerToolProps = {
  toolId?: string;
};

function eolPlannerUrl(toolId: string, extra?: Record<string, string>) {
  const params = new URLSearchParams({ toolId, ...extra });
  return `/api/tools/end-of-life-planner?${params.toString()}`;
}

async function eolPlannerRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload;
}

type TabId = EolBuiltInSectionId | 'export' | `custom:${string}`;

type DeleteTarget =
  | { kind: 'plan'; id: string; label: string }
  | { kind: 'record'; label: string; onConfirm: () => void }
  | { kind: 'section'; id: string; label: string; custom: boolean };

type AddingKey = string | null;

type FieldKind = 'text' | 'date' | 'textarea' | 'secret' | 'select' | 'yesno' | 'number';

type FieldSpec = {
  kind: FieldKind;
  key: string;
  label: string;
  options?: readonly string[];
  span?: 1 | 2;
  rows?: number;
  min?: number;
  helper?: string;
  placeholder?: string;
  readOnly?: boolean;
};

const ICON = {
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  archive:
    'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  restore: 'M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  up: 'M5 15l7-7 7 7',
  down: 'M19 9l-7 7-7-7',
  left: 'M15 19l-7-7 7-7',
  right: 'M9 5l7 7-7 7',
  duplicate: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  plus: 'M12 4v16m8-8H4',
  close: 'M6 18L18 6M6 6l12 12',
  dots: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  eyeOff:
    'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21',
  lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
};

function OutlineIcon({ d, className = 'h-5 w-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

function readFieldValue(record: Record<string, unknown>, spec: FieldSpec): string {
  const value = record[spec.key];
  if (spec.kind === 'secret') return secretText(value as never);
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value : '';
}

function writeFieldValue<T extends object>(record: T, spec: FieldSpec, raw: string): T {
  if (spec.kind === 'secret') return { ...record, [spec.key]: withSecret(raw) };
  if (spec.kind === 'number') {
    const parsed = Number(raw);
    return { ...record, [spec.key]: Number.isFinite(parsed) ? parsed : 0 };
  }
  return { ...record, [spec.key]: raw };
}

type RecordListChrome = {
  addingKey: string | null;
  drafts: Record<string, unknown>;
  editingId: string | null;
  nestedCardClass: string;
  subsectionClass: string;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  bodyTextClass: string;
  mutedTextClass: string;
  setAddingKey: (key: string | null) => void;
  setEditingId: (id: string | null) => void;
  setDraft: (key: string, value: unknown) => void;
  startAdd: (key: string, draft: unknown) => void;
  cancelAdd: () => void;
  setDeleteTarget: (target: DeleteTarget) => void;
  renderGrid: <T extends object>(record: T, fields: FieldSpec[], onChange: (next: T) => void, idPrefix: string) => ReactNode;
  recordActions: (
    itemId: string,
    options: {
      onEdit: () => void;
      onDuplicate: () => void;
      onUp: () => void;
      onDown: () => void;
      onDelete?: () => void;
      disableUp?: boolean;
      disableDown?: boolean;
    }
  ) => ReactNode;
};

function RecordList<T extends { id: string }>(props: {
  chrome: RecordListChrome;
  listKey: string;
  records: T[];
  addLabel: string;
  emptyText: string;
  requiredValue?: (draft: T) => boolean;
  titleOf: (item: T) => string;
  summaryOf: (item: T) => ReactNode;
  fields?: FieldSpec[];
  renderForm?: (item: T, onChange: (next: T) => void, prefix: string) => ReactNode;
  onCommit: (records: T[], immediate?: boolean) => void;
  createDraft: () => T;
  cloneItem: (item: T, newId: string) => T;
  deleteLabel: string;
  hideDelete?: (item: T) => boolean;
  extra?: (item: T, onChange: (next: T) => void) => ReactNode;
}) {
  const { chrome } = props;
  const isAdding = chrome.addingKey === props.listKey;
  const draft = (chrome.drafts[props.listKey] as T | undefined) || null;
  return (
    <div className="space-y-4">
      {isAdding && draft ? (
        <div className={chrome.nestedCardClass}>
          <h4 className={chrome.subsectionClass}>{props.addLabel}</h4>
          {props.renderForm
            ? props.renderForm(draft, (next) => chrome.setDraft(props.listKey, next), `${props.listKey}-new`)
            : chrome.renderGrid(draft, props.fields || [], (next) => chrome.setDraft(props.listKey, next), `${props.listKey}-new`)}
          {props.extra ? props.extra(draft, (next) => chrome.setDraft(props.listKey, next)) : null}
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              className={chrome.primaryButtonClass}
              disabled={props.requiredValue ? !props.requiredValue(draft) : false}
              onClick={() => {
                if (props.requiredValue && !props.requiredValue(draft)) return;
                props.onCommit([...props.records, draft], true);
                chrome.setAddingKey(null);
              }}
            >
              Add
            </button>
            <button type="button" className={chrome.secondaryButtonClass} onClick={chrome.cancelAdd}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-start">
          <button type="button" className={chrome.primaryButtonClass} onClick={() => chrome.startAdd(props.listKey, props.createDraft())}>
            {props.addLabel}
          </button>
        </div>
      )}
      {props.records.length === 0 && !isAdding ? (
        <p className={`${chrome.mutedTextClass} text-center py-6`}>{props.emptyText}</p>
      ) : null}
      {props.records.map((item, index) => {
        const isEditing = chrome.editingId === `${props.listKey}:${item.id}`;
        return (
          <div key={item.id} className={chrome.nestedCardClass}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className={`font-medium ${chrome.bodyTextClass}`}>{props.titleOf(item) || 'Untitled'}</div>
                {!isEditing ? <div className={`${chrome.mutedTextClass} text-sm mt-1`}>{props.summaryOf(item)}</div> : null}
              </div>
              {chrome.recordActions(item.id, {
                onEdit: () => chrome.setEditingId(isEditing ? null : `${props.listKey}:${item.id}`),
                onDuplicate: () => props.onCommit(duplicateListItem(props.records, item.id, props.cloneItem), true),
                onUp: () => props.onCommit(reorderList(props.records, item.id, -1), true),
                onDown: () => props.onCommit(reorderList(props.records, item.id, 1), true),
                disableUp: index === 0,
                disableDown: index === props.records.length - 1,
                onDelete: props.hideDelete?.(item)
                  ? undefined
                  : () =>
                      chrome.setDeleteTarget({
                        kind: 'record',
                        label: props.deleteLabel,
                        onConfirm: () => props.onCommit(removeListItem(props.records, item.id), true),
                      }),
              })}
            </div>
            {isEditing ? (
              <div className="mt-4 space-y-4">
                {props.renderForm
                  ? props.renderForm(item, (next) => props.onCommit(replaceListItem(props.records, item.id, next)), `${props.listKey}-${item.id}`)
                  : chrome.renderGrid(item, props.fields || [], (next) => props.onCommit(replaceListItem(props.records, item.id, next)), `${props.listKey}-${item.id}`)}
                {props.extra ? props.extra(item, (next) => props.onCommit(replaceListItem(props.records, item.id, next))) : null}
                <button type="button" className={chrome.secondaryButtonClass} onClick={() => chrome.setEditingId(null)}>
                  Done
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function familyRelationshipOptions(current: string): readonly string[] {
  return FAMILY_RELATIONSHIPS.includes(current as (typeof FAMILY_RELATIONSHIPS)[number]) || !current
    ? FAMILY_RELATIONSHIPS
    : [current, ...FAMILY_RELATIONSHIPS];
}

function FamilyMemberList(props: {
  records: EolFamilyPerson[];
  onCommit: (next: EolFamilyPerson[], immediate?: boolean) => void;
  onDelete: (label: string, onConfirm: () => void) => void;
  bodyTextClass: string;
  mutedTextClass: string;
  labelClass: string;
  inputClass: string;
  selectClass: string;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  iconButtonClass: string;
  rowIconSecondaryClass: string;
  rowIconDangerClass: string;
  overlayClass: string;
  modalCardClass: string;
  sectionTitleClass: string;
  listDividerClass: string;
  addRequestKey?: number;
}) {
  const [editor, setEditor] = useState<{ mode: 'add' | 'edit'; draft: EolFamilyPerson } | null>(null);
  const listControlId = useId();
  const [filterText, setFilterText] = useState('');
  const [sortBy, setSortBy] = useState<SectionSortId>('saved');
  const members = props.records.filter(
    (person) => person.name.trim() || person.contactInfo.trim() || person.relationship.trim()
  );
  const visibleMembers = useMemo(
    () =>
      filterAndSortSectionRows(members, filterText, sortBy, (person) => person.name, (person) => [
        person.contactInfo,
        person.relationship,
      ]),
    [members, filterText, sortBy]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && editor) setEditor(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor]);

  useEffect(() => {
    if (!props.addRequestKey) return;
    setEditor({ mode: 'add', draft: emptyFamilyPerson() });
  }, [props.addRequestKey]);

  const saveEditor = () => {
    if (!editor || !editor.draft.name.trim()) return;
    if (editor.mode === 'add') {
      props.onCommit([...members, editor.draft], true);
    } else {
      props.onCommit(replaceListItem(members, editor.draft.id, editor.draft), true);
    }
    setEditor(null);
  };

  return (
    <div className="space-y-3">
      <SectionListControls
        filterId={`${listControlId}-filter`}
        sortId={`${listControlId}-sort`}
        filterText={filterText}
        sortBy={sortBy}
        onFilter={setFilterText}
        onSort={setSortBy}
        inputClass={props.inputClass}
        selectClass={props.selectClass}
        labelClass={props.labelClass}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] table-fixed text-sm">
          <thead>
            <tr className={`${props.mutedTextClass} border-b ${props.listDividerClass} text-left text-xs font-semibold uppercase tracking-wide`}>
              <th className="py-2 pr-3 font-semibold">Name</th>
              <th className="py-2 pr-3 font-semibold">Contact Info</th>
              <th className="py-2 pr-3 font-semibold">Relationship</th>
              <th className="w-24 py-2 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={4} className={`${props.mutedTextClass} py-4`}>
                  No family members added yet. Next step: Add family member.
                </td>
              </tr>
            ) : visibleMembers.length === 0 ? (
              <tr>
                <td colSpan={4} className={`${props.mutedTextClass} py-4`}>
                  No matching entries in this section.
                </td>
              </tr>
            ) : (
              visibleMembers.map((person) => (
                <tr key={person.id} className={`border-t ${props.listDividerClass}`}>
                  <td className={`truncate py-2.5 pr-3 font-medium ${props.bodyTextClass}`}>{person.name || 'Untitled'}</td>
                  <td className={`truncate py-2.5 pr-3 ${props.bodyTextClass}`}>{person.contactInfo || '—'}</td>
                  <td className={`truncate py-2.5 pr-3 ${props.bodyTextClass}`}>{person.relationship || '—'}</td>
                  <td className="py-2.5">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className={props.rowIconSecondaryClass}
                        aria-label={`Edit ${person.name || 'family member'}`}
                        title="Edit"
                        onClick={() => setEditor({ mode: 'edit', draft: { ...person } })}
                      >
                        <OutlineIcon d={ICON.edit} className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={props.rowIconDangerClass}
                        aria-label={`Delete ${person.name || 'family member'}`}
                        title="Delete"
                        onClick={() =>
                          props.onDelete(person.name.trim() || 'family member', () =>
                            props.onCommit(removeListItem(members, person.id), true)
                          )
                        }
                      >
                        <OutlineIcon d={ICON.trash} className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {editor ? (
        <div className={props.overlayClass}>
          <div className={props.modalCardClass}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className={props.sectionTitleClass}>{editor.mode === 'add' ? 'Add Family Member' : 'Edit Family Member'}</h3>
              <button
                type="button"
                onClick={() => setEditor(null)}
                className={props.iconButtonClass}
                aria-label="Close modal"
                title="Close modal"
              >
                <OutlineIcon d={ICON.close} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="family-editor-name" className={props.labelClass}>
                  Name
                </label>
                <input
                  id="family-editor-name"
                  value={editor.draft.name}
                  onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, name: event.target.value } })}
                  className={props.inputClass}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="family-editor-contact" className={props.labelClass}>
                  Contact Info
                </label>
                <input
                  id="family-editor-contact"
                  value={editor.draft.contactInfo}
                  onChange={(event) =>
                    setEditor({ ...editor, draft: { ...editor.draft, contactInfo: event.target.value } })
                  }
                  className={props.inputClass}
                />
              </div>
              <div>
                <label htmlFor="family-editor-relationship" className={props.labelClass}>
                  Relationship
                </label>
                <select
                  id="family-editor-relationship"
                  value={editor.draft.relationship}
                  onChange={(event) =>
                    setEditor({ ...editor, draft: { ...editor.draft, relationship: event.target.value } })
                  }
                  className={props.selectClass}
                >
                  <option value="">Select…</option>
                  {familyRelationshipOptions(editor.draft.relationship).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={saveEditor}
                  disabled={!editor.draft.name.trim()}
                  className={props.primaryButtonClass}
                >
                  {editor.mode === 'add' ? 'Add' : 'Save'}
                </button>
                <button type="button" onClick={() => setEditor(null)} className={props.secondaryButtonClass}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type SectionSortId = 'saved' | 'az' | 'za';

function filterAndSortSectionRows<T extends { id: string }>(
  records: T[],
  filterText: string,
  sortBy: SectionSortId,
  titleOf: (item: T) => string,
  extraValues: (item: T) => string[]
): T[] {
  const query = filterText.trim().toLowerCase();
  let rows = records;
  if (query) {
    rows = rows.filter((item) => {
      if ((titleOf(item) || '').toLowerCase().includes(query)) return true;
      return extraValues(item).some((value) => value.toLowerCase().includes(query));
    });
  }
  if (sortBy === 'az' || sortBy === 'za') {
    rows = [...rows].sort((a, b) => {
      const cmp = (titleOf(a) || '').localeCompare(titleOf(b) || '', undefined, { sensitivity: 'base' });
      return sortBy === 'az' ? cmp : -cmp;
    });
  }
  return rows;
}

function SectionListControls(props: {
  filterId: string;
  sortId: string;
  filterText: string;
  sortBy: SectionSortId;
  onFilter: (value: string) => void;
  onSort: (value: SectionSortId) => void;
  inputClass: string;
  selectClass: string;
  labelClass: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[12rem] flex-1">
        <label htmlFor={props.filterId} className={props.labelClass}>
          Filter
        </label>
        <input
          id={props.filterId}
          value={props.filterText}
          onChange={(event) => props.onFilter(event.target.value)}
          className={props.inputClass}
          placeholder="Filter this section"
        />
      </div>
      <div className="min-w-[10rem]">
        <label htmlFor={props.sortId} className={props.labelClass}>
          Sort
        </label>
        <select
          id={props.sortId}
          value={props.sortBy}
          onChange={(event) => props.onSort(event.target.value as SectionSortId)}
          className={props.selectClass}
        >
          <option value="saved">Saved order</option>
          <option value="az">Name A–Z</option>
          <option value="za">Name Z–A</option>
        </select>
      </div>
    </div>
  );
}

function RecordTableList<T extends { id: string }>(props: {
  records: T[];
  columns: { label: string; value: (item: T) => string; emphasize?: boolean }[];
  emptyText: string;
  addTitle: string;
  editTitle: string;
  itemLabel: string;
  createDraft: () => T;
  requiredValue: (item: T) => boolean;
  titleOf: (item: T) => string;
  addRequestKey?: number;
  onCommit: (next: T[], immediate?: boolean) => void;
  onDelete: (label: string, onConfirm: () => void) => void;
  renderForm: (item: T, onChange: (next: T) => void, prefix: string) => ReactNode;
  renderFormExtra?: (item: T, onChange: (next: T) => void, helpers: { prefix: string; close: () => void }) => ReactNode;
  formExtra?: ReactNode;
  hideDelete?: (item: T) => boolean;
  onInactivate?: (item: T) => void;
  bodyTextClass: string;
  mutedTextClass: string;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  iconButtonClass: string;
  rowIconSecondaryClass: string;
  rowIconDangerClass: string;
  overlayClass: string;
  modalCardClass: string;
  sectionTitleClass: string;
  listDividerClass: string;
  inputClass: string;
  selectClass: string;
  labelClass: string;
}) {
  const [editor, setEditor] = useState<{ mode: 'add' | 'edit'; draft: T } | null>(null);
  const listControlId = useId();
  const [filterText, setFilterText] = useState('');
  const [sortBy, setSortBy] = useState<SectionSortId>('saved');
  const visibleRecords = useMemo(
    () =>
      filterAndSortSectionRows(props.records, filterText, sortBy, props.titleOf, (item) =>
        props.columns.map((column) => column.value(item) || '')
      ),
    [props.records, props.columns, props.titleOf, filterText, sortBy]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && editor) setEditor(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor]);

  useEffect(() => {
    if (!props.addRequestKey) return;
    setEditor({ mode: 'add', draft: props.createDraft() });
  }, [props.addRequestKey]);

  const saveEditor = () => {
    if (!editor || !props.requiredValue(editor.draft)) return;
    props.onCommit(
      editor.mode === 'add'
        ? [...props.records, editor.draft]
        : replaceListItem(props.records, editor.draft.id, editor.draft),
      true
    );
    setEditor(null);
  };

  return (
    <div className="space-y-3">
      <SectionListControls
        filterId={`${listControlId}-filter`}
        sortId={`${listControlId}-sort`}
        filterText={filterText}
        sortBy={sortBy}
        onFilter={setFilterText}
        onSort={setSortBy}
        inputClass={props.inputClass}
        selectClass={props.selectClass}
        labelClass={props.labelClass}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] table-fixed text-sm">
          <thead>
            <tr className={`${props.mutedTextClass} border-b ${props.listDividerClass} text-left text-xs font-semibold uppercase tracking-wide`}>
              {props.columns.map((column) => (
                <th key={column.label} className="py-2 pr-3 font-semibold">
                  {column.label}
                </th>
              ))}
              <th className="w-28 py-2 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {props.records.length === 0 ? (
              <tr>
                <td colSpan={props.columns.length + 1} className={`${props.mutedTextClass} py-4`}>
                  {props.emptyText} Next step: {props.addTitle}.
                </td>
              </tr>
            ) : visibleRecords.length === 0 ? (
              <tr>
                <td colSpan={props.columns.length + 1} className={`${props.mutedTextClass} py-4`}>
                  No matching entries in this section.
                </td>
              </tr>
            ) : (
              visibleRecords.map((item) => (
                <tr key={item.id} className={`border-t ${props.listDividerClass}`}>
                  {props.columns.map((column) => (
                    <td
                      key={column.label}
                      className={`truncate py-2.5 pr-3 ${column.emphasize ? `font-medium ${props.bodyTextClass}` : props.bodyTextClass}`}
                    >
                      {column.value(item) || '—'}
                    </td>
                  ))}
                  <td className="py-2.5">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className={props.rowIconSecondaryClass}
                        aria-label={`Edit ${props.titleOf(item) || props.itemLabel}`}
                        title="Edit"
                        onClick={() => setEditor({ mode: 'edit', draft: { ...item } })}
                      >
                        <OutlineIcon d={ICON.edit} className="h-4 w-4" />
                      </button>
                      {props.onInactivate ? (
                        <button
                          type="button"
                          className={props.rowIconSecondaryClass}
                          aria-label={`Inactivate ${props.titleOf(item) || props.itemLabel}`}
                          title="Inactivate"
                          onClick={() => props.onInactivate?.(item)}
                        >
                          <OutlineIcon d={ICON.archive} className="h-4 w-4" />
                        </button>
                      ) : null}
                      {props.hideDelete?.(item) ? null : (
                        <button
                          type="button"
                          className={props.rowIconDangerClass}
                          aria-label={`Delete ${props.titleOf(item) || props.itemLabel}`}
                          title="Delete"
                          onClick={() =>
                            props.onDelete(props.titleOf(item).trim() || props.itemLabel, () =>
                              props.onCommit(removeListItem(props.records, item.id), true)
                            )
                          }
                        >
                          <OutlineIcon d={ICON.trash} className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {editor ? (
        <div className={props.overlayClass}>
          <div className={props.modalCardClass}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className={props.sectionTitleClass}>{editor.mode === 'add' ? props.addTitle : props.editTitle}</h3>
              <button
                type="button"
                onClick={() => setEditor(null)}
                className={props.iconButtonClass}
                aria-label="Close modal"
                title="Close modal"
              >
                <OutlineIcon d={ICON.close} />
              </button>
            </div>
            <div className="space-y-4">
              {props.renderForm(editor.draft, (next) => setEditor({ ...editor, draft: next }), 'record-editor')}
              {props.formExtra}
              {props.renderFormExtra?.(
                editor.draft,
                (next) => setEditor({ ...editor, draft: next }),
                { prefix: 'record-editor', close: () => setEditor(null) }
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={saveEditor}
                  disabled={!props.requiredValue(editor.draft)}
                  className={props.primaryButtonClass}
                >
                  {editor.mode === 'add' ? 'Add' : 'Save'}
                </button>
                <button type="button" onClick={() => setEditor(null)} className={props.secondaryButtonClass}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function contrastOnColor(hex: string): string {
  const raw = hex.replace('#', '');
  if (raw.length < 6) return '#022c22';
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#022c22' : '#ffffff';
}

function statusBadgeClass(status: string, isLight: boolean): string {
  if (status === 'Complete') {
    return isLight
      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
      : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
  }
  if (status === 'In progress') {
    return isLight
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : 'border-amber-500/40 bg-amber-500/15 text-amber-200';
  }
  return isLight
    ? 'border-slate-300 bg-slate-100 text-slate-700'
    : 'border-slate-600 bg-slate-800 text-slate-300';
}

export function EndOfLifePlannerTool({ toolId }: EndOfLifePlannerToolProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const titleClass = isLight ? 'text-2xl font-semibold text-slate-900 mb-2' : 'text-2xl font-semibold text-slate-50 mb-2';
  const descClass = isLight ? 'text-slate-600 text-sm' : 'text-slate-400 text-sm';
  const cardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-6';
  const cardCompactClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-4';
  const nestedCardClass = isLight
    ? 'p-4 rounded-lg border border-slate-200 bg-slate-50'
    : 'p-4 rounded-lg border border-slate-700 bg-slate-800/50';
  const sectionTitleClass = isLight ? 'text-lg font-semibold text-slate-900 mb-4' : 'text-lg font-semibold text-slate-50 mb-4';
  const subsectionClass = isLight ? 'text-base font-semibold text-slate-900 mb-3' : 'text-base font-semibold text-slate-100 mb-3';
  const sectionRuleClass = isLight
    ? 'mb-4 border-t border-dotted border-slate-300'
    : 'mb-4 border-t border-dotted border-slate-600';
  const sectionRule = () => <div className={sectionRuleClass} aria-hidden="true" />;
  const labelClass = isLight ? 'block text-sm font-medium text-slate-700 mb-2' : 'block text-sm font-medium text-slate-300 mb-2';
  const helperClass = isLight ? 'mt-1 text-xs text-slate-600' : 'mt-1 text-xs text-slate-400';
  const inputClass = isLight
    ? 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const selectClass = isLight
    ? 'w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const primaryButtonClass = isLight
    ? 'px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
    : 'px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
  const secondaryButtonClass = isLight
    ? 'px-4 py-2 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
    : 'px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const tabStripClass = isLight ? 'border-b border-slate-200 pb-3' : 'border-b border-slate-800 pb-3';
  const tabActiveClass = isLight
    ? 'rounded-lg border-2 border-emerald-700 bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm'
    : 'rounded-lg border-2 border-emerald-400 bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950 shadow-sm';
  const tabInactiveClass = isLight
    ? 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900'
    : 'rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-slate-500 hover:bg-slate-800 hover:text-slate-100';
  const popupMenuClass = isLight
    ? 'absolute top-full right-0 z-50 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5 min-w-[160px] py-1'
    : 'absolute top-full right-0 z-50 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg min-w-[160px] py-1';
  const popupMenuLeftClass = isLight
    ? 'absolute top-full left-0 z-50 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5 min-w-[160px] py-1'
    : 'absolute top-full left-0 z-50 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg min-w-[160px] py-1';
  const popupMenuItemClass = isLight
    ? 'w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2'
    : 'w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2';
  const popupMenuDangerItemClass = isLight
    ? 'w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 flex items-center gap-2'
    : 'w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 transition-colors flex items-center gap-2';
  const modalCardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-xl'
    : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4';
  const modalCardWideClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto'
    : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto';
  const overlayClass = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm';
  const deleteWarningBoxClass = isLight
    ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 mb-4'
    : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4';
  const deleteWarningTextClass = isLight ? 'text-red-700 font-semibold mb-2' : 'text-red-300 font-semibold mb-2';
  const deleteWarningDetailClass = isLight ? 'text-red-600 text-sm' : 'text-red-200 text-sm';
  const deleteInputClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4';
  const rowIconEmeraldClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-700 bg-white p-2 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 p-2 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const rowIconSecondaryClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-slate-400 bg-slate-100 p-2 text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-slate-600 bg-slate-800 p-2 text-slate-200 transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const rowIconDangerClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-red-300 bg-white p-2 text-red-700 transition-colors hover:bg-red-50 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-800/50 p-2 text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const iconButtonClass = isLight
    ? 'rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors'
    : 'rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors';
  const successBannerClass = isLight
    ? 'rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
    : 'rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300';
  const errorBannerClass = isLight
    ? 'rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700'
    : 'rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300';
  const warningBannerClass = isLight
    ? 'rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950'
    : 'rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100';
  const mutedTextClass = isLight ? 'text-slate-600' : 'text-slate-400';
  const bodyTextClass = isLight ? 'text-slate-900' : 'text-slate-100';
  const emptyStateClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center';

  const [plans, setPlans] = useState<EolPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [formError, setFormError] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [planSearchQuery, setPlanSearchQuery] = useState('');
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [newRelationship, setNewRelationship] = useState<EolRelationship | ''>('');
  const [newRelationshipCustom, setNewRelationshipCustom] = useState('');
  const [newDob, setNewDob] = useState('');
  const [newColor, setNewColor] = useState('#10b981');
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPersonName, setEditPersonName] = useState('');
  const [editRelationship, setEditRelationship] = useState<EolRelationship | ''>('');
  const [editRelationshipCustom, setEditRelationshipCustom] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editColor, setEditColor] = useState('#10b981');
  const [menuOpenPlanId, setMenuOpenPlanId] = useState<string | null>(null);
  const [menuOpenTabId, setMenuOpenTabId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('personal');
  const [addingKey, setAddingKey] = useState<AddingKey>(null);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [revealedLetters, setRevealedLetters] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [archiveConfirmPlanId, setArchiveConfirmPlanId] = useState<string | null>(null);
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuOpenSubsectionId, setMenuOpenSubsectionId] = useState<string | null>(null);
  const [familyAddRequestKey, setFamilyAddRequestKey] = useState<Record<string, number>>({});

  const persistTimer = useRef<number | null>(null);
  const persistGeneration = useRef(0);
  const selectedPlanIdRef = useRef<string | null>(null);
  selectedPlanIdRef.current = selectedPlanId;

  const persist = useCallback((
    nextPlans: EolPlan[],
    nextSelected: string | null,
    immediate: boolean,
    options?: { selectionOnly?: boolean; planIds?: string[] }
  ) => {
    const write = async () => {
      if (!toolId) {
        setSaveStatus('error');
        return;
      }
      const generation = ++persistGeneration.current;
      try {
        const savedPlans: EolPlan[] = [];
        if (!options?.selectionOnly) {
          const ids = new Set(options?.planIds || nextPlans.map((plan) => plan.id));
          for (const plan of nextPlans.filter((item) => ids.has(item.id))) {
            const result = await eolPlannerRequest<{ plan: EolPlan }>(eolPlannerUrl(toolId), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ toolId, plan }),
            });
            savedPlans.push(result.plan);
          }
        }
        await eolPlannerRequest<{ ok: true }>(eolPlannerUrl(toolId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toolId, selectedPlanId: nextSelected }),
        });
        if (generation !== persistGeneration.current) return;
        if (savedPlans.length) {
          setPlans((current) => current.map((plan) => savedPlans.find((saved) => saved.id === plan.id) || plan));
        }
        setSaveStatus('saved');
        window.setTimeout(() => {
          setSaveStatus((current) => (current === 'saved' ? 'idle' : current));
        }, 3000);
      } catch {
        if (generation === persistGeneration.current) setSaveStatus('error');
      }
    };
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    setSaveStatus('saving');
    if (immediate) {
      void write();
      return;
    }
    persistTimer.current = window.setTimeout(() => {
      void write();
    }, 700);
  }, [toolId]);

  useEffect(() => {
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!toolId) {
        setFormError('This tool is missing its workspace id.');
        setIsLoading(false);
        return;
      }
      try {
        let result = await eolPlannerRequest<{ plans: EolPlan[]; selectedPlanId: string | null }>(eolPlannerUrl(toolId));
        if (result.plans.length === 0) {
          const draft = loadEolDraft();
          if (draft.plans.length) {
            for (const plan of draft.plans) {
              await eolPlannerRequest<{ plan: EolPlan }>(eolPlannerUrl(toolId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toolId, plan }),
              });
            }
            await eolPlannerRequest<{ ok: true }>(eolPlannerUrl(toolId), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ toolId, selectedPlanId: draft.selectedPlanId }),
            });
            result = await eolPlannerRequest<{ plans: EolPlan[]; selectedPlanId: string | null }>(eolPlannerUrl(toolId));
            clearEolDraft();
          }
        }
        if (cancelled) return;
        setPlans(result.plans);
        setSelectedPlanId(result.selectedPlanId);
      } catch {
        if (!cancelled) setFormError('Could not load plans from the database.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [toolId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (deleteTarget) {
        setDeleteTarget(null);
        setDeleteConfirmText('');
        return;
      }
      if (archiveConfirmPlanId) {
        setArchiveConfirmPlanId(null);
        return;
      }
      if (showExportPopup) {
        setShowExportPopup(false);
        return;
      }
      if (renamingSectionId) {
        setRenamingSectionId(null);
        return;
      }
      if (menuOpenPlanId) setMenuOpenPlanId(null);
      if (menuOpenTabId) setMenuOpenTabId(null);
      if (menuOpenSubsectionId) setMenuOpenSubsectionId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [archiveConfirmPlanId, deleteTarget, showExportPopup, renamingSectionId, menuOpenPlanId, menuOpenTabId, menuOpenSubsectionId]);

  const visiblePlans = useMemo(() => {
    const query = planSearchQuery.trim().toLowerCase();
    return plans.filter((plan) => {
      if (!showArchived && plan.status !== 'Active') return false;
      if (!query) return true;
      return (
        plan.name.toLowerCase().includes(query) ||
        plan.personFullName.toLowerCase().includes(query)
      );
    });
  }, [plans, showArchived, planSearchQuery]);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || null;
  const overall = selectedPlan ? overallPlanPercent(selectedPlan) : 0;

  useEffect(() => {
    if (!selectedPlan) return;
    const key = activeTab.startsWith('custom:') ? activeTab.slice(7) : activeTab;
    const shouldLeave = activeTab === 'export' || selectedPlan.data.inactiveSectionIds.includes(key);
    if (!shouldLeave) return;
    const hidden = new Set(selectedPlan.data.inactiveSectionIds);
    const removed = new Set(selectedPlan.data.removedSectionIds);
    const nextBuilt = EOL_BUILT_IN_TABS.find((tab) => !removed.has(tab.id) && !hidden.has(tab.id));
    const nextCustom = selectedPlan.data.customSections.find((section) => !hidden.has(section.id) && !removed.has(section.id));
    setActiveTab(nextBuilt ? nextBuilt.id : nextCustom ? `custom:${nextCustom.id}` : 'personal');
  }, [selectedPlan, activeTab]);

  const commitPlans = useCallback(
    (nextPlans: EolPlan[], options?: { selectedId?: string | null; immediate?: boolean }) => {
      const nextSelected = options?.selectedId !== undefined ? options.selectedId : selectedPlanIdRef.current;
      setPlans(nextPlans);
      if (options?.selectedId !== undefined) setSelectedPlanId(options.selectedId);
      persist(nextPlans, nextSelected, Boolean(options?.immediate), {
        planIds: nextPlans.map((plan) => plan.id),
      });
    },
    [persist]
  );

  const patchSelected = useCallback(
    (updater: (plan: EolPlan) => EolPlan, immediate = false) => {
      const currentId = selectedPlanIdRef.current;
      if (!currentId) return;
      setPlans((prev) => {
        const next = prev.map((plan) => {
          if (plan.id !== currentId) return plan;
          const updated = touchPlan(updater(plan));
          return immediate ? appendPlanHistory(updated, 'edit', 'Edited plan') : updated;
        });
        persist(next, currentId, immediate, { planIds: [currentId] });
        return next;
      });
    },
    [persist]
  );

  const patchData = useCallback(
    (updater: (data: EolPlanData) => EolPlanData, immediate = false) => {
      patchSelected((plan) => ({ ...plan, data: updater(plan.data) }), immediate);
    },
    [patchSelected]
  );

  const startCreatePlan = () => {
    setIsCreatingPlan(true);
    setSelectedPlanId(null);
    setEditingPlanId(null);
    setMenuOpenPlanId(null);
    setNewPlanName('');
    setNewPersonName('');
    setNewRelationship('');
    setNewRelationshipCustom('');
    setNewDob('');
    setNewColor('#10b981');
    setFormError('');
  };

  const createNewPlan = async () => {
    if (!newPlanName.trim() || !newPersonName.trim()) {
      setFormError('Plan name and person’s full name are required.');
      return;
    }
    if (!toolId) {
      setFormError('This tool is missing its workspace id.');
      return;
    }
    setSaveStatus('saving');
    setFormError('');
    try {
      const result = await eolPlannerRequest<{ plan: EolPlan }>(eolPlannerUrl(toolId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          name: newPlanName,
          personFullName: newPersonName,
          relationship: newRelationship,
          relationshipCustom: newRelationshipCustom,
          dateOfBirth: newDob,
          card_color: newColor,
        }),
      });
      setPlans((current) => [...current, result.plan]);
      setSelectedPlanId(result.plan.id);
      setIsCreatingPlan(false);
      setActiveTab('personal');
      setSaveStatus('saved');
      window.setTimeout(() => {
        setSaveStatus((current) => (current === 'saved' ? 'idle' : current));
      }, 3000);
    } catch {
      setSaveStatus('error');
      setFormError('Could not create the plan.');
    }
  };

  const startEditPlan = (plan: EolPlan) => {
    setEditingPlanId(plan.id);
    setEditName(plan.name);
    setEditPersonName(plan.personFullName);
    setEditRelationship(plan.relationship);
    setEditRelationshipCustom(plan.relationshipCustom);
    setEditDob(plan.dateOfBirth);
    setEditColor(plan.card_color);
    setMenuOpenPlanId(null);
    setFormError('');
  };

  const savePlanEdit = () => {
    if (!editingPlanId) return;
    if (!editName.trim() || !editPersonName.trim()) {
      setFormError('Plan name and person’s full name are required.');
      return;
    }
    const next = plans.map((plan) =>
      plan.id === editingPlanId
        ? appendPlanHistory(
            {
              ...plan,
              name: editName.trim(),
              personFullName: editPersonName.trim(),
              relationship: editRelationship,
              relationshipCustom: editRelationshipCustom.trim(),
              dateOfBirth: editDob,
              card_color: editColor,
            },
            'edit',
            'Edited plan details'
          )
        : plan
    );
    setEditingPlanId(null);
    setFormError('');
    commitPlans(next, { immediate: true });
  };

  const archivePlan = (id: string, archived: boolean) => {
    if (archived) {
      setMenuOpenPlanId(null);
      setArchiveConfirmPlanId(id);
      return;
    }
    applyArchivePlan(id, false);
  };

  const applyArchivePlan = (id: string, archived: boolean) => {
    const next = plans.map((plan) =>
      plan.id === id
        ? appendPlanHistory(
            { ...plan, status: archived ? 'Archived' : 'Active' },
            archived ? 'archive' : 'restore',
            archived ? 'Archived plan' : 'Restored plan'
          )
        : plan
    );
    setMenuOpenPlanId(null);
    const shouldDeselect = archived && selectedPlanId === id && !showArchived;
    commitPlans(next, { selectedId: shouldDeselect ? null : selectedPlanId, immediate: true });
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteConfirmText.toLowerCase() !== 'delete') return;
    if (deleteTarget.kind === 'plan') {
      if (!toolId) {
        setFormError('This tool is missing its workspace id.');
        return;
      }
      setSaveStatus('saving');
      try {
        await eolPlannerRequest<{ ok: true }>(eolPlannerUrl(toolId, { id: deleteTarget.id }), {
          method: 'DELETE',
        });
        const nextSelected = selectedPlanId === deleteTarget.id ? null : selectedPlanId;
        setPlans((current) => current.filter((plan) => plan.id !== deleteTarget.id));
        setSelectedPlanId(nextSelected);
        persist(plans.filter((plan) => plan.id !== deleteTarget.id), nextSelected, true, { selectionOnly: true });
        setSaveStatus('saved');
        window.setTimeout(() => {
          setSaveStatus((current) => (current === 'saved' ? 'idle' : current));
        }, 3000);
      } catch {
        setSaveStatus('error');
        setFormError('Could not delete the plan.');
      }
    } else if (deleteTarget.kind === 'section') {
      if (deleteTarget.custom) {
        patchData((data) => ({
          ...data,
          customSections: data.customSections.filter((section) => section.id !== deleteTarget.id),
          completedSectionIds: (data.completedSectionIds || []).filter((id) => id !== deleteTarget.id),
          sectionOrder: resolveSectionOrder(data).filter((id) => id !== deleteTarget.id),
        }), true);
        if (activeTab === `custom:${deleteTarget.id}`) setActiveTab('personal');
      } else {
        patchData((data) => ({
          ...data,
          removedSectionIds: data.removedSectionIds.includes(deleteTarget.id)
            ? data.removedSectionIds
            : [...data.removedSectionIds, deleteTarget.id],
          inactiveSectionIds: data.inactiveSectionIds.filter((id) => id !== deleteTarget.id),
          completedSectionIds: (data.completedSectionIds || []).filter((id) => id !== deleteTarget.id),
          sectionOrder: resolveSectionOrder(data).filter((id) => id !== deleteTarget.id),
        }), true);
        if (activeTab === deleteTarget.id) setActiveTab('personal');
      }
    } else {
      deleteTarget.onConfirm();
    }
    setDeleteTarget(null);
    setDeleteConfirmText('');
  };

  const saveRenameSection = () => {
    if (!renamingSectionId || !renameValue.trim()) return;
    const nextName = renameValue.trim();
    patchData((data) => {
      const extras = data.personalExtraSections || [];
      if (extras.some((section) => section.id === renamingSectionId)) {
        return {
          ...data,
          personalExtraSections: extras.map((section) =>
            section.id === renamingSectionId ? { ...section, name: nextName } : section
          ),
        };
      }
      const isCustom = data.customSections.some((section) => section.id === renamingSectionId);
      if (isCustom) {
        return {
          ...data,
          customSections: data.customSections.map((section) =>
            section.id === renamingSectionId ? { ...section, name: nextName } : section
          ),
        };
      }
      return {
        ...data,
        sectionLabels: { ...data.sectionLabels, [renamingSectionId]: nextName },
      };
    }, true);
    setRenamingSectionId(null);
  };

  const setSectionInactive = (key: string, inactive: boolean) => {
    patchData((data) => ({
      ...data,
      inactiveSectionIds: inactive
        ? data.inactiveSectionIds.includes(key)
          ? data.inactiveSectionIds
          : [...data.inactiveSectionIds, key]
        : data.inactiveSectionIds.filter((id) => id !== key),
    }), true);
    setMenuOpenTabId(null);
    if (inactive && selectedPlan && (activeTab === key || activeTab === `custom:${key}`)) {
      const hidden = new Set([...selectedPlan.data.inactiveSectionIds, key]);
      const removed = new Set(selectedPlan.data.removedSectionIds);
      const nextBuilt = EOL_BUILT_IN_TABS.find((tab) => !removed.has(tab.id) && !hidden.has(tab.id));
      const nextCustom = selectedPlan.data.customSections.find((section) => !hidden.has(section.id) && !removed.has(section.id));
      setActiveTab(nextBuilt ? nextBuilt.id : nextCustom ? `custom:${nextCustom.id}` : 'personal');
    }
  };

  const setSectionComplete = (key: string, complete: boolean) => {
    patchData((data) => {
      const current = data.completedSectionIds || [];
      return {
        ...data,
        completedSectionIds: complete
          ? current.includes(key)
            ? current
            : [...current, key]
          : current.filter((id) => id !== key),
      };
    }, true);
  };

  const sectionCompleteControl = (sectionKey: string) => (
    <div className="mt-6 flex justify-end">
      <label className={`inline-flex cursor-pointer items-center gap-2 ${bodyTextClass}`}>
        <input
          type="checkbox"
          checked={(selectedPlan?.data.completedSectionIds || []).includes(sectionKey)}
          onChange={(event) => setSectionComplete(sectionKey, event.target.checked)}
          className="h-4 w-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500"
        />
        <span className="text-sm font-medium">This Section is Complete</span>
      </label>
    </div>
  );

  const inactiveSubsectionIds = selectedPlan?.data.inactiveSubsectionIds || [];
  const isSubsectionInactive = (key: string) => inactiveSubsectionIds.includes(key);

  const toggleSubsection = (key: string) => {
    patchData((data) => {
      const current = data.inactiveSubsectionIds || [];
      return {
        ...data,
        inactiveSubsectionIds: current.includes(key) ? current.filter((id) => id !== key) : [...current, key],
      };
    }, true);
  };

  const subsectionHeading = (
    title: string,
    options?: { collapseKey?: string; onDuplicate?: () => void; onDelete?: () => void; onAdd?: () => void; addLabel?: string }
  ) => {
    const collapseKey = options?.collapseKey;
    const menuId = collapseKey || null;
    const inactive = collapseKey ? isSubsectionInactive(collapseKey) : false;
    const showMenu = Boolean(menuId && (collapseKey || options?.onDuplicate || options?.onDelete));
    return (
      <div className="mb-3 flex items-center gap-2">
        <h3
          className={
            isLight
              ? `text-base font-semibold ${inactive ? 'text-slate-400' : 'text-slate-900'}`
              : `text-base font-semibold ${inactive ? 'text-slate-500' : 'text-slate-100'}`
          }
        >
          {title}
        </h3>
        {showMenu && menuId ? (
          <div className="relative">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpenSubsectionId(menuOpenSubsectionId === menuId ? null : menuId);
                setMenuOpenTabId(null);
                setMenuOpenPlanId(null);
              }}
              className={
                isLight
                  ? 'rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700'
                  : 'rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200'
              }
              aria-label={`${title} options`}
              title={`${title} options`}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d={ICON.dots} />
              </svg>
            </button>
            {menuOpenSubsectionId === menuId ? (
              <div className={popupMenuLeftClass}>
                <button
                  type="button"
                  className={popupMenuItemClass}
                  onClick={() => {
                    setMenuOpenSubsectionId(null);
                    setRenamingSectionId(menuId);
                    setRenameValue(title);
                  }}
                >
                  <OutlineIcon d={ICON.edit} className="h-4 w-4" />
                  Rename
                </button>
                {options?.onDuplicate ? (
                  <button
                    type="button"
                    className={popupMenuItemClass}
                    onClick={() => {
                      setMenuOpenSubsectionId(null);
                      options.onDuplicate?.();
                    }}
                  >
                    <OutlineIcon d={ICON.duplicate} className="h-4 w-4" />
                    Duplicate
                  </button>
                ) : null}
                {collapseKey ? (
                  <button
                    type="button"
                    className={popupMenuItemClass}
                    onClick={() => {
                      setMenuOpenSubsectionId(null);
                      toggleSubsection(collapseKey);
                    }}
                  >
                    <OutlineIcon d={inactive ? ICON.restore : ICON.archive} className="h-4 w-4" />
                    {inactive ? 'Activate' : 'Inactivate'}
                  </button>
                ) : null}
                {options?.onDelete ? (
                  <button
                    type="button"
                    className={popupMenuDangerItemClass}
                    onClick={() => {
                      setMenuOpenSubsectionId(null);
                      options.onDelete?.();
                    }}
                  >
                    <OutlineIcon d={ICON.trash} className="h-4 w-4" />
                    Delete
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {options?.onAdd ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              options.onAdd?.();
            }}
            className={
              isLight
                ? 'inline-flex items-center justify-center rounded-md border-2 border-emerald-600 p-0.5 text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800'
                : 'inline-flex items-center justify-center rounded-md border-2 border-emerald-400 p-0.5 text-emerald-400 transition-colors hover:bg-emerald-500/15 hover:text-emerald-300'
            }
            aria-label={options?.addLabel || 'Add family member'}
            title={options?.addLabel || 'Add family member'}
          >
            <OutlineIcon d={ICON.plus} className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    );
  };

  const duplicatePersonalBlock = (kind: EolPersonalBlockKind, extraId?: string) => {
    patchData((data) => duplicatePersonalSubsection(data, kind, extraId).data, true);
  };

  const deletePersonalExtra = (extra: EolPersonalExtraSection) => {
    setDeleteTarget({
      kind: 'record',
      label: extra.name,
      onConfirm: () =>
        patchData((data) => ({
          ...data,
          personalExtraSections: (data.personalExtraSections || []).filter((item) => item.id !== extra.id),
          inactiveSubsectionIds: (data.inactiveSubsectionIds || []).filter((id) => id !== extra.id),
        }), true),
    });
  };

  const personalBlockTitle = (key: string, fallback: string) =>
    selectedPlan?.data.sectionLabels?.[key] || fallback;

  const updatePersonalExtra = (extraId: string, next: Partial<EolPersonalExtraSection>, immediate = false) => {
    patchData(
      (data) => ({
        ...data,
        personalExtraSections: (data.personalExtraSections || []).map((item) =>
          item.id === extraId ? { ...item, ...next } : item
        ),
      }),
      immediate
    );
  };

  const collapseBody = (key: string, children: ReactNode) => {
    const inactive = isSubsectionInactive(key);
    return (
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          inactive ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    );
  };

  const duplicateSection = (tab: { id: TabId; label: string; custom?: boolean }) => {
    if (!selectedPlan) return;
    setMenuOpenTabId(null);
    if (tab.custom && tab.id.startsWith('custom:')) {
      const current = selectedPlan.data.customSections.find((section) => `custom:${section.id}` === tab.id);
      if (!current) return;
      const copy = cloneCustomSection(current);
      patchData((data) => ({
        ...data,
        customSections: [...data.customSections, copy],
        sectionOrder: insertSectionAfter(resolveSectionOrder(data), current.id, copy.id),
      }), true);
      setActiveTab(`custom:${copy.id}`);
      return;
    }
    if (tab.id === 'export') return;
    const copy = duplicateBuiltInSection(selectedPlan.data, tab.id as EolBuiltInSectionId, tab.label);
    patchData((data) => ({
      ...data,
      customSections: [...data.customSections, copy],
      sectionOrder: insertSectionAfter(resolveSectionOrder(data), String(tab.id), copy.id),
    }), true);
    setActiveTab(`custom:${copy.id}`);
  };

  const moveSectionTab = (key: string, direction: -1 | 1) => {
    patchData((data) => ({
      ...data,
      sectionOrder: moveSectionOrder(resolveSectionOrder(data), key, direction),
    }), true);
    setMenuOpenTabId(null);
  };

  const toggleSecret = (id: string) => {
    setRevealedSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const startAdd = (key: string, draft: unknown) => {
    setAddingKey(key);
    setDrafts((prev) => ({ ...prev, [key]: draft }));
    setEditingId(null);
  };

  const cancelAdd = () => {
    setAddingKey(null);
  };

  const setDraft = (key: string, value: unknown) => {
    setDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const renderField = <T extends object>(record: T, spec: FieldSpec, onChange: (next: T) => void, idPrefix: string) => {
    const id = `${idPrefix}-${spec.key}`;
    const value = readFieldValue(record as Record<string, unknown>, spec);
    const shown = revealedSecrets[id];
    return (
      <div key={spec.key} className={spec.span === 2 ? 'md:col-span-2' : undefined}>
        <label htmlFor={id} className={labelClass}>
          {spec.label}
        </label>
        {spec.kind === 'select' ? (
          <select
            id={id}
            value={value}
            onChange={(event) => onChange(writeFieldValue(record, spec, event.target.value))}
            className={selectClass}
          >
            <option value="">Select…</option>
            {(spec.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : spec.kind === 'yesno' ? (
          <select
            id={id}
            value={value}
            onChange={(event) => onChange(writeFieldValue(record, spec, event.target.value))}
            className={selectClass}
          >
            <option value="">Select…</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        ) : spec.kind === 'textarea' ? (
          <textarea
            id={id}
            value={value}
            rows={spec.rows || 3}
            onChange={(event) => onChange(writeFieldValue(record, spec, event.target.value))}
            className={`${inputClass} resize-y`}
          />
        ) : spec.kind === 'secret' ? (
          <div className="flex gap-2">
            <input
              id={id}
              type={shown ? 'text' : 'password'}
              value={value}
              onChange={(event) => onChange(writeFieldValue(record, spec, event.target.value))}
              autoComplete="off"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => toggleSecret(id)}
              className={rowIconSecondaryClass}
              aria-label={shown ? `Hide ${spec.label}` : `Show ${spec.label}`}
              title={shown ? `Hide ${spec.label}` : `Show ${spec.label}`}
            >
              <OutlineIcon d={shown ? ICON.eyeOff : ICON.eye} />
            </button>
          </div>
        ) : (
          <input
            id={id}
            type={spec.kind === 'date' ? 'date' : spec.kind === 'number' ? 'number' : 'text'}
            min={spec.kind === 'number' ? spec.min : undefined}
            value={spec.readOnly ? '' : value}
            placeholder={spec.placeholder}
            readOnly={spec.readOnly}
            tabIndex={spec.readOnly ? -1 : undefined}
            onChange={(event) => {
              if (spec.readOnly) return;
              onChange(writeFieldValue(record, spec, event.target.value));
            }}
            className={
              spec.readOnly
                ? `${inputClass} cursor-default italic placeholder:italic`
                : inputClass
            }
          />
        )}
        {spec.helper ? <p className={helperClass}>{spec.helper}</p> : null}
      </div>
    );
  };

  const renderGrid = <T extends object>(record: T, fields: FieldSpec[], onChange: (next: T) => void, idPrefix: string) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map((field) => renderField(record, field, onChange, idPrefix))}
    </div>
  );

  const sectionNotes = (id: string, value: string, onChange: (next: string) => void) => (
    <div className="pt-2">
      <label htmlFor={id} className={labelClass}>
        Notes
      </label>
      <textarea
        id={id}
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} resize-y`}
      />
    </div>
  );

  const recordActions = (
    itemId: string,
    options: {
      onEdit: () => void;
      onDuplicate: () => void;
      onUp: () => void;
      onDown: () => void;
      onDelete?: () => void;
      disableUp?: boolean;
      disableDown?: boolean;
    }
  ) => (
    <div className="flex shrink-0 items-center gap-1.5 ml-4">
      <button type="button" className={rowIconEmeraldClass} aria-label="Edit" title="Edit" onClick={options.onEdit}>
        <OutlineIcon d={ICON.edit} />
      </button>
      <button type="button" className={rowIconSecondaryClass} aria-label="Duplicate" title="Duplicate" onClick={options.onDuplicate}>
        <OutlineIcon d={ICON.duplicate} />
      </button>
      <button
        type="button"
        className={rowIconSecondaryClass}
        aria-label="Move up"
        title="Move up"
        onClick={options.onUp}
        disabled={options.disableUp}
      >
        <OutlineIcon d={ICON.up} />
      </button>
      <button
        type="button"
        className={rowIconSecondaryClass}
        aria-label="Move down"
        title="Move down"
        onClick={options.onDown}
        disabled={options.disableDown}
      >
        <OutlineIcon d={ICON.down} />
      </button>
      {options.onDelete ? (
        <button type="button" className={rowIconDangerClass} aria-label="Delete" title="Delete" onClick={options.onDelete}>
          <OutlineIcon d={ICON.trash} />
        </button>
      ) : null}
    </div>
  );

  const listChrome: RecordListChrome = {
    addingKey,
    drafts,
    editingId,
    nestedCardClass,
    subsectionClass,
    primaryButtonClass,
    secondaryButtonClass,
    bodyTextClass,
    mutedTextClass,
    setAddingKey,
    setEditingId,
    setDraft,
    startAdd,
    cancelAdd,
    setDeleteTarget,
    renderGrid,
    recordActions,
  };

  const requestFamilyAdd = (id: string) => {
    setFamilyAddRequestKey((current) => ({ ...current, [id]: (current[id] || 0) + 1 }));
  };

  const renderFamilyMembers = (
    listId: string,
    records: EolFamilyPerson[],
    onCommit: (next: EolFamilyPerson[], immediate?: boolean) => void
  ) => (
    <FamilyMemberList
      records={records}
      onCommit={onCommit}
      addRequestKey={familyAddRequestKey[listId] || 0}
      onDelete={(label, onConfirm) => setDeleteTarget({ kind: 'record', label, onConfirm })}
      bodyTextClass={bodyTextClass}
      mutedTextClass={mutedTextClass}
      labelClass={labelClass}
      inputClass={inputClass}
      selectClass={selectClass}
      primaryButtonClass={primaryButtonClass}
      secondaryButtonClass={secondaryButtonClass}
      iconButtonClass={iconButtonClass}
      rowIconSecondaryClass={rowIconSecondaryClass}
      rowIconDangerClass={rowIconDangerClass}
      overlayClass={overlayClass}
      modalCardClass={modalCardClass}
      sectionTitleClass={sectionTitleClass}
      listDividerClass={isLight ? 'border-slate-200' : 'border-slate-700/50'}
    />
  );

  const contactFields: FieldSpec[] = [
    { kind: 'text', key: 'name', label: 'Name' },
    { kind: 'text', key: 'relationship', label: 'Relationship' },
    { kind: 'select', key: 'contactType', label: 'Contact type', options: CONTACT_TYPES },
    { kind: 'text', key: 'company', label: 'Company/organization' },
    { kind: 'text', key: 'phone', label: 'Phone' },
    { kind: 'text', key: 'alternatePhone', label: 'Alternate phone' },
    { kind: 'text', key: 'email', label: 'Email' },
    { kind: 'text', key: 'address', label: 'Address' },
    { kind: 'textarea', key: 'whyContact', label: 'Why this person should be contacted', span: 2 },
    { kind: 'number', key: 'priority', label: 'Priority/order to contact', min: 1 },
  ];

  const deviceFields: FieldSpec[] = [
    { kind: 'text', key: 'name', label: 'Device name' },
    { kind: 'select', key: 'deviceType', label: 'Device type', options: DEVICE_TYPES },
    { kind: 'text', key: 'manufacturer', label: 'Manufacturer' },
    { kind: 'text', key: 'model', label: 'Model' },
    { kind: 'text', key: 'location', label: 'Device location' },
    { kind: 'text', key: 'username', label: 'Username' },
    { kind: 'secret', key: 'pin', label: 'PIN/passcode' },
    { kind: 'secret', key: 'password', label: 'Password or password reference' },
    { kind: 'secret', key: 'recoveryKey', label: 'Encryption/recovery key location', span: 2 },
    { kind: 'text', key: 'associatedAccount', label: 'Apple ID / Google account associated with device', span: 2 },
    { kind: 'textarea', key: 'accessInstructions', label: 'Instructions for accessing device', span: 2 },
    { kind: 'textarea', key: 'storedInformation', label: 'What important information is stored on it', span: 2 },
  ];

  const onlineFields: FieldSpec[] = [
    { kind: 'text', key: 'serviceName', label: 'Account/service name' },
    { kind: 'text', key: 'website', label: 'Website' },
    { kind: 'select', key: 'category', label: 'Category', options: ONLINE_CATEGORIES },
    { kind: 'text', key: 'username', label: 'Username/email' },
    { kind: 'secret', key: 'password', label: 'Password' },
    { kind: 'yesno', key: 'mfaEnabled', label: 'MFA enabled' },
    { kind: 'text', key: 'mfaMethod', label: 'MFA method' },
    { kind: 'secret', key: 'mfaLocation', label: 'Where MFA device/code can be found' },
    { kind: 'secret', key: 'recoveryEmail', label: 'Recovery email' },
    { kind: 'secret', key: 'recoveryPhone', label: 'Recovery phone' },
    { kind: 'text', key: 'accountReference', label: 'Account number/reference' },
    { kind: 'select', key: 'disposition', label: 'What should happen to account', options: ACCOUNT_DISPOSITIONS },
    { kind: 'textarea', key: 'specialInstructions', label: 'Special instructions', span: 2 },
    { kind: 'select', key: 'passwordStoredElsewhere', label: 'Password stored elsewhere', options: PASSWORD_MANAGERS },
    { kind: 'text', key: 'passwordStoredElsewhereDetail', label: 'Password manager detail' },
  ];

  const documentFields: FieldSpec[] = [
    { kind: 'text', key: 'name', label: 'Document name' },
    { kind: 'select', key: 'documentType', label: 'Document type', options: DOCUMENT_TYPES },
    { kind: 'select', key: 'originalOrCopy', label: 'Original/copy', options: ['Original', 'Copy'] },
    { kind: 'text', key: 'physicalLocation', label: 'Physical location' },
    { kind: 'text', key: 'digitalLocation', label: 'Digital location' },
    { kind: 'text', key: 'whoHasCopy', label: 'Who has a copy' },
    { kind: 'text', key: 'attorneyContact', label: 'Attorney/contact associated with document' },
    { kind: 'date', key: 'dateCreated', label: 'Date document was created' },
    { kind: 'date', key: 'lastUpdated', label: 'Last updated' },
    { kind: 'date', key: 'expirationDate', label: 'Expiration date if applicable' },
    { kind: 'textarea', key: 'specialInstructions', label: 'Special instructions', span: 2 },
  ];

  const insuranceFields: FieldSpec[] = [
    { kind: 'text', key: 'company', label: 'Insurance company' },
    { kind: 'select', key: 'policyType', label: 'Policy type', options: POLICY_TYPES },
    { kind: 'text', key: 'policyNumber', label: 'Policy number' },
    { kind: 'text', key: 'policyholder', label: 'Policyholder' },
    { kind: 'text', key: 'insuredPerson', label: 'Insured person' },
    { kind: 'text', key: 'agent', label: 'Agent' },
    { kind: 'text', key: 'agentContact', label: 'Agent phone/email' },
    { kind: 'text', key: 'beneficiary', label: 'Beneficiary' },
    { kind: 'text', key: 'coverageAmount', label: 'Coverage amount' },
    { kind: 'text', key: 'premium', label: 'Premium' },
    { kind: 'text', key: 'paymentFrequency', label: 'Payment frequency' },
    { kind: 'yesno', key: 'automaticPayment', label: 'Automatic payment?' },
    { kind: 'text', key: 'paymentAccount', label: 'Account used for payment' },
    { kind: 'text', key: 'expirationRenewal', label: 'Policy expiration/renewal' },
    { kind: 'text', key: 'website', label: 'Website' },
    { kind: 'text', key: 'claimContact', label: 'Claim contact information' },
    { kind: 'text', key: 'documentLocation', label: 'Location of policy documents' },
    { kind: 'textarea', key: 'instructions', label: 'Instructions', span: 2 },
  ];

  const bankFields: FieldSpec[] = [
    { kind: 'text', key: 'institution', label: 'Financial institution' },
    { kind: 'select', key: 'accountType', label: 'Account type', options: BANK_ACCOUNT_TYPES },
    { kind: 'text', key: 'owners', label: 'Account owner(s)' },
    { kind: 'text', key: 'lastFour', label: 'Last four digits/account reference' },
    { kind: 'text', key: 'jointOwner', label: 'Joint owner' },
    { kind: 'text', key: 'beneficiary', label: 'Beneficiary/POD' },
    { kind: 'text', key: 'bankContact', label: 'Bank contact' },
    { kind: 'text', key: 'website', label: 'Website' },
    { kind: 'text', key: 'loginStorage', label: 'Where login information is stored' },
    { kind: 'textarea', key: 'purpose', label: 'Approximate purpose of account', span: 2 },
  ];

  const investmentFields: FieldSpec[] = [
    { kind: 'text', key: 'institution', label: 'Institution' },
    { kind: 'select', key: 'accountType', label: 'Account type', options: INVESTMENT_TYPES },
    { kind: 'text', key: 'owner', label: 'Account owner' },
    { kind: 'text', key: 'accountReference', label: 'Account reference' },
    { kind: 'text', key: 'beneficiaries', label: 'Beneficiaries' },
    { kind: 'text', key: 'advisor', label: 'Financial advisor' },
    { kind: 'text', key: 'websiteLogin', label: 'Website/login reference' },
  ];

  const creditCardFields: FieldSpec[] = [
    { kind: 'text', key: 'issuer', label: 'Issuer' },
    { kind: 'text', key: 'cardType', label: 'Card type' },
    { kind: 'text', key: 'lastFour', label: 'Last four digits' },
    { kind: 'text', key: 'primaryHolder', label: 'Primary cardholder' },
    { kind: 'text', key: 'authorizedUsers', label: 'Joint/authorized users' },
    { kind: 'textarea', key: 'automaticPayments', label: 'Automatic payments charged to this card', span: 2 },
    { kind: 'textarea', key: 'balanceNotes', label: 'Balance notes', span: 2 },
    { kind: 'textarea', key: 'closingInstructions', label: 'Instructions for closing', span: 2 },
  ];

  const debtFields: FieldSpec[] = [
    { kind: 'text', key: 'creditor', label: 'Creditor' },
    { kind: 'select', key: 'debtType', label: 'Debt type', options: DEBT_TYPES },
    { kind: 'text', key: 'accountReference', label: 'Account reference' },
    { kind: 'text', key: 'approximateBalance', label: 'Approximate balance' },
    { kind: 'text', key: 'monthlyPayment', label: 'Monthly payment' },
    { kind: 'text', key: 'automaticPayment', label: 'Automatic payment' },
    { kind: 'text', key: 'collateral', label: 'Collateral' },
    { kind: 'text', key: 'contact', label: 'Contact information' },
  ];

  const incomeFields: FieldSpec[] = [
    { kind: 'select', key: 'incomeType', label: 'Type', options: INCOME_TYPES },
    { kind: 'text', key: 'amountFrequency', label: 'Amount/frequency' },
    { kind: 'text', key: 'depositedWhere', label: 'Where deposited' },
    { kind: 'text', key: 'contact', label: 'Contact information' },
    { kind: 'yesno', key: 'survivorBenefits', label: 'Survivor benefits?' },
  ];

  const billFields: FieldSpec[] = [
    { kind: 'text', key: 'company', label: 'Company' },
    { kind: 'text', key: 'description', label: 'Description' },
    { kind: 'text', key: 'amount', label: 'Amount' },
    { kind: 'text', key: 'frequency', label: 'Frequency' },
    { kind: 'text', key: 'dueDate', label: 'Due date' },
    { kind: 'yesno', key: 'automaticPayment', label: 'Automatic payment?' },
    { kind: 'text', key: 'paymentAccount', label: 'Payment account/card' },
    { kind: 'yesno', key: 'cancelAfterDeath', label: 'Should it be canceled after death?' },
  ];

  const utilityFields: FieldSpec[] = [
    { kind: 'select', key: 'utilityType', label: 'Type', options: UTILITY_TYPES },
    { kind: 'text', key: 'provider', label: 'Provider' },
    { kind: 'text', key: 'accountReference', label: 'Account reference' },
    { kind: 'text', key: 'contact', label: 'Contact' },
    { kind: 'text', key: 'automaticPayment', label: 'Automatic payment' },
    { kind: 'text', key: 'paymentSource', label: 'Payment source' },
    { kind: 'text', key: 'loginReference', label: 'Login reference' },
  ];

  const homeProviderFields: FieldSpec[] = [
    { kind: 'select', key: 'providerType', label: 'Type', options: HOME_PROVIDER_TYPES },
    { kind: 'text', key: 'name', label: 'Provider name' },
    { kind: 'text', key: 'contact', label: 'Contact' },
    { kind: 'text', key: 'accountReference', label: 'Account/reference' },
    { kind: 'textarea', key: 'notes', label: 'Notes', span: 2 },
  ];

  const vehicleFields: FieldSpec[] = [
    { kind: 'text', key: 'year', label: 'Year' },
    { kind: 'text', key: 'make', label: 'Make' },
    { kind: 'text', key: 'model', label: 'Model' },
    { kind: 'text', key: 'vin', label: 'VIN' },
    { kind: 'text', key: 'loanInformation', label: 'Loan information' },
    { kind: 'text', key: 'titleLocation', label: 'Title location' },
    { kind: 'text', key: 'insurance', label: 'Insurance' },
    { kind: 'text', key: 'spareKeyLocation', label: 'Spare key location' },
  ];

  const nextStepFields: FieldSpec[] = [
    { kind: 'text', key: 'title', label: 'Title' },
    { kind: 'select', key: 'priority', label: 'Priority', options: ['High', 'Medium', 'Low'] },
    { kind: 'text', key: 'personResponsible', label: 'Person responsible' },
    { kind: 'select', key: 'status', label: 'Status', options: ['Not started', 'Completed', 'Not applicable'] },
    { kind: 'textarea', key: 'instructions', label: 'Instructions', span: 2 },
    { kind: 'text', key: 'relatedDocument', label: 'Related document' },
  ];

  const personalItemFields: FieldSpec[] = [
    { kind: 'text', key: 'item', label: 'Item' },
    { kind: 'textarea', key: 'description', label: 'Description', span: 2 },
    { kind: 'text', key: 'location', label: 'Location' },
    { kind: 'text', key: 'recipient', label: 'Intended recipient' },
    { kind: 'textarea', key: 'reason', label: 'Reason/message', span: 2 },
    { kind: 'text', key: 'photoReference', label: 'Photo/document reference' },
    { kind: 'textarea', key: 'specialInstructions', label: 'Special instructions', span: 2 },
  ];

  const letterFields: FieldSpec[] = [
    { kind: 'text', key: 'title', label: 'Letter title' },
    { kind: 'text', key: 'recipient', label: 'Recipient' },
    { kind: 'select', key: 'letterType', label: 'Relationship / letter type', options: LETTER_TYPES },
    { kind: 'text', key: 'whenToShare', label: 'When it should be shared' },
    { kind: 'select', key: 'status', label: 'Status', options: ['Draft', 'Complete'] },
    { kind: 'select', key: 'visibility', label: 'Visibility', options: ['Visible', 'Private'] },
    { kind: 'textarea', key: 'instructions', label: 'Optional instructions', span: 2 },
  ];

  const otherFields: FieldSpec[] = [
    { kind: 'text', key: 'title', label: 'Title' },
    { kind: 'text', key: 'category', label: 'Category' },
    { kind: 'textarea', key: 'description', label: 'Description', span: 2 },
    { kind: 'date', key: 'importantDate', label: 'Important date' },
    { kind: 'text', key: 'contact', label: 'Contact' },
    { kind: 'text', key: 'location', label: 'Location' },
    { kind: 'text', key: 'website', label: 'Website' },
    { kind: 'textarea', key: 'instructions', label: 'Instructions', span: 2 },
    { kind: 'textarea', key: 'customNotes', label: 'Custom notes', span: 2 },
  ];

  const secretHelper = (
    <p className={`${helperClass} md:col-span-2`}>
      Stored privately. Additional encryption will be added in a later update.
    </p>
  );

  const tableListChrome = {
    bodyTextClass,
    mutedTextClass,
    primaryButtonClass,
    secondaryButtonClass,
    iconButtonClass,
    rowIconSecondaryClass,
    rowIconDangerClass,
    overlayClass,
    modalCardClass: modalCardWideClass,
    sectionTitleClass,
    listDividerClass: isLight ? 'border-slate-200' : 'border-slate-700/50',
    inputClass,
    selectClass,
    labelClass,
    onDelete: (label: string, onConfirm: () => void) => setDeleteTarget({ kind: 'record', label, onConfirm }),
  };

  const renderContacts = (
    listKey: string,
    records: EolContact[],
    onCommit: (next: EolContact[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={sortContacts(records)}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Name', value: (item) => item.name, emphasize: true },
        { label: 'Contact Type', value: (item) => item.contactType },
        { label: 'Phone', value: (item) => item.phone },
        { label: 'Email', value: (item) => item.email },
      ]}
      emptyText="No contacts added yet."
      addTitle="Add Contact"
      editTitle="Edit Contact"
      itemLabel="contact"
      createDraft={emptyContact}
      requiredValue={(item) => Boolean(item.name.trim())}
      titleOf={(item) => item.name}
      onCommit={(next, immediate) =>
        onCommit(
          next.map((item, index) => ({ ...item, priority: index + 1 })),
          immediate
        )
      }
      renderForm={(item, onChange, prefix) => renderGrid(item, contactFields, onChange, prefix)}
      {...tableListChrome}
    />
  );

  const renderDevices = (
    listKey: string,
    records: EolDevice[],
    onCommit: (next: EolDevice[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Name', value: (item) => item.name, emphasize: true },
        { label: 'Type', value: (item) => item.deviceType },
        { label: 'Location', value: (item) => item.location },
        { label: 'Username', value: (item) => item.username },
      ]}
      emptyText="No devices added yet."
      addTitle="Add Device"
      editTitle="Edit Device"
      itemLabel="device"
      createDraft={emptyDevice}
      requiredValue={(item) => Boolean(item.name.trim())}
      titleOf={(item) => item.name}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => renderGrid(item, deviceFields, onChange, prefix)}
      formExtra={secretHelper}
      {...tableListChrome}
    />
  );

  const renderOnline = (
    listKey: string,
    records: EolOnlineAccount[],
    onCommit: (next: EolOnlineAccount[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Service', value: (item) => item.serviceName, emphasize: true },
        { label: 'Category', value: (item) => item.category },
        { label: 'Username', value: (item) => item.username },
        { label: 'Website', value: (item) => item.website },
      ]}
      emptyText="No online accounts added yet."
      addTitle="Add Online Account"
      editTitle="Edit Online Account"
      itemLabel="online account"
      createDraft={emptyOnlineAccount}
      requiredValue={(item) => Boolean(item.serviceName.trim())}
      titleOf={(item) => item.serviceName}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => renderGrid(item, onlineFields, onChange, prefix)}
      formExtra={
        <div className="space-y-2">
          {secretHelper}
          <p className={helperClass}>You can point to a password manager instead of storing the password here.</p>
        </div>
      }
      {...tableListChrome}
    />
  );

  const renderDocuments = (
    listKey: string,
    records: EolDocumentNote[],
    onCommit: (next: EolDocumentNote[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Name', value: (item) => item.name, emphasize: true },
        { label: 'Type', value: (item) => item.documentType },
        { label: 'Location', value: (item) => item.physicalLocation },
        { label: 'Expiration', value: (item) => (item.expirationDate ? formatDateDisplay(item.expirationDate) : '') },
      ]}
      emptyText="No document notes added yet."
      addTitle="Add Document"
      editTitle="Edit Document"
      itemLabel="document"
      createDraft={emptyDocumentNote}
      requiredValue={(item) => Boolean(item.name.trim())}
      titleOf={(item) => item.name}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => renderGrid(item, documentFields, onChange, prefix)}
      formExtra={
        <div>
          <label htmlFor={`${listKey}-link`} className={labelClass}>
            Link an existing Important Document
          </label>
          <select id={`${listKey}-link`} disabled className={`${selectClass} opacity-60 cursor-not-allowed`}>
            <option>Not available yet</option>
          </select>
          <p className={helperClass}>Linking to the Important Documents tool will be added in a later update.</p>
        </div>
      }
      {...tableListChrome}
    />
  );

  const renderInsurance = (
    listKey: string,
    records: EolInsurancePolicy[],
    onCommit: (next: EolInsurancePolicy[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Company', value: (item) => item.company, emphasize: true },
        { label: 'Type', value: (item) => item.policyType },
        { label: 'Policy #', value: (item) => item.policyNumber },
        { label: 'Beneficiary', value: (item) => item.beneficiary },
      ]}
      emptyText="No policies added yet."
      addTitle="Add Policy"
      editTitle="Edit Policy"
      itemLabel="policy"
      createDraft={emptyInsurancePolicy}
      requiredValue={(item) => Boolean(item.company.trim())}
      titleOf={(item) => item.company}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => renderGrid(item, insuranceFields, onChange, prefix)}
      {...tableListChrome}
    />
  );

  const lastFourDisplay = (value: string) => (value ? `••••${value}` : '');

  const renderBankAccounts = (
    listKey: string,
    records: EolBankAccount[],
    onCommit: (next: EolBankAccount[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Institution', value: (item) => item.institution, emphasize: true },
        { label: 'Type', value: (item) => item.accountType },
        { label: 'Owner(s)', value: (item) => item.owners },
        { label: 'Last 4', value: (item) => lastFourDisplay(item.lastFour) },
      ]}
      emptyText="No bank accounts added yet."
      addTitle="Add Bank Account"
      editTitle="Edit Bank Account"
      itemLabel="bank account"
      createDraft={emptyBankAccount}
      requiredValue={(item) => Boolean(item.institution.trim())}
      titleOf={(item) => item.institution}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => renderGrid(item, bankFields, onChange, prefix)}
      {...tableListChrome}
    />
  );

  const renderInvestments = (
    listKey: string,
    records: EolInvestmentAccount[],
    onCommit: (next: EolInvestmentAccount[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Institution', value: (item) => item.institution, emphasize: true },
        { label: 'Type', value: (item) => item.accountType },
        { label: 'Owner', value: (item) => item.owner },
        { label: 'Beneficiaries', value: (item) => item.beneficiaries },
      ]}
      emptyText="No investment accounts added yet."
      addTitle="Add Investment Account"
      editTitle="Edit Investment Account"
      itemLabel="investment account"
      createDraft={emptyInvestmentAccount}
      requiredValue={(item) => Boolean(item.institution.trim())}
      titleOf={(item) => item.institution}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => renderGrid(item, investmentFields, onChange, prefix)}
      {...tableListChrome}
    />
  );

  const renderCreditCards = (
    listKey: string,
    records: EolCreditCard[],
    onCommit: (next: EolCreditCard[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Issuer', value: (item) => item.issuer, emphasize: true },
        { label: 'Type', value: (item) => item.cardType },
        { label: 'Last 4', value: (item) => lastFourDisplay(item.lastFour) },
        { label: 'Cardholder', value: (item) => item.primaryHolder },
      ]}
      emptyText="No credit cards added yet."
      addTitle="Add Credit Card"
      editTitle="Edit Credit Card"
      itemLabel="credit card"
      createDraft={emptyCreditCard}
      requiredValue={(item) => Boolean(item.issuer.trim())}
      titleOf={(item) => item.issuer}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => renderGrid(item, creditCardFields, onChange, prefix)}
      {...tableListChrome}
    />
  );

  const renderDebts = (
    listKey: string,
    records: EolDebt[],
    onCommit: (next: EolDebt[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Creditor', value: (item) => item.creditor, emphasize: true },
        { label: 'Type', value: (item) => item.debtType },
        { label: 'Balance', value: (item) => item.approximateBalance },
        { label: 'Payment', value: (item) => item.monthlyPayment },
      ]}
      emptyText="No debts added yet."
      addTitle="Add Debt"
      editTitle="Edit Debt"
      itemLabel="debt"
      createDraft={emptyDebt}
      requiredValue={(item) => Boolean(item.creditor.trim())}
      titleOf={(item) => item.creditor}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => renderGrid(item, debtFields, onChange, prefix)}
      {...tableListChrome}
    />
  );

  const renderIncomeSources = (
    listKey: string,
    records: EolIncomeSource[],
    onCommit: (next: EolIncomeSource[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Type', value: (item) => item.incomeType, emphasize: true },
        { label: 'Amount', value: (item) => item.amountFrequency },
        { label: 'Deposited', value: (item) => item.depositedWhere },
        { label: 'Contact', value: (item) => item.contact },
      ]}
      emptyText="No income sources added yet."
      addTitle="Add Income Source"
      editTitle="Edit Income Source"
      itemLabel="income source"
      createDraft={emptyIncomeSource}
      requiredValue={(item) => Boolean(item.incomeType.trim())}
      titleOf={(item) => item.incomeType}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => renderGrid(item, incomeFields, onChange, prefix)}
      {...tableListChrome}
    />
  );

  const renderRecurringBills = (
    listKey: string,
    records: EolRecurringBill[],
    onCommit: (next: EolRecurringBill[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Company', value: (item) => item.company, emphasize: true },
        { label: 'Description', value: (item) => item.description },
        { label: 'Amount', value: (item) => item.amount },
        { label: 'Frequency', value: (item) => item.frequency },
      ]}
      emptyText="No recurring bills added yet."
      addTitle="Add Recurring Bill"
      editTitle="Edit Recurring Bill"
      itemLabel="recurring bill"
      createDraft={emptyRecurringBill}
      requiredValue={(item) => Boolean(item.company.trim())}
      titleOf={(item) => item.company}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => renderGrid(item, billFields, onChange, prefix)}
      {...tableListChrome}
    />
  );

  const renderUtilities = (
    listKey: string,
    records: EolUtility[],
    onCommit: (next: EolUtility[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Type', value: (item) => item.utilityType, emphasize: true },
        { label: 'Provider', value: (item) => item.provider },
        { label: 'Account', value: (item) => item.accountReference },
        { label: 'Contact', value: (item) => item.contact },
      ]}
      emptyText="No utilities added yet."
      addTitle="Add Utility"
      editTitle="Edit Utility"
      itemLabel="utility"
      createDraft={emptyUtility}
      requiredValue={(item) => Boolean(item.utilityType.trim() || item.provider.trim())}
      titleOf={(item) => item.utilityType || item.provider}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => renderGrid(item, utilityFields, onChange, prefix)}
      {...tableListChrome}
    />
  );

  const renderHomeProviders = (
    listKey: string,
    records: EolHomeProvider[],
    onCommit: (next: EolHomeProvider[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Name', value: (item) => item.name, emphasize: true },
        { label: 'Type', value: (item) => item.providerType },
        { label: 'Contact', value: (item) => item.contact },
        { label: 'Account', value: (item) => item.accountReference },
      ]}
      emptyText="No service providers added yet."
      addTitle="Add Service Provider"
      editTitle="Edit Service Provider"
      itemLabel="service provider"
      createDraft={emptyHomeProvider}
      requiredValue={(item) => Boolean(item.name.trim() || item.providerType.trim())}
      titleOf={(item) => item.name || item.providerType}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => renderGrid(item, homeProviderFields, onChange, prefix)}
      {...tableListChrome}
    />
  );

  const renderVehicles = (
    listKey: string,
    records: EolVehicle[],
    onCommit: (next: EolVehicle[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        {
          label: 'Vehicle',
          value: (item) => [item.year, item.make, item.model].filter(Boolean).join(' '),
          emphasize: true,
        },
        { label: 'VIN', value: (item) => item.vin },
        { label: 'Insurance', value: (item) => item.insurance },
        { label: 'Title', value: (item) => item.titleLocation },
      ]}
      emptyText="No vehicles added yet."
      addTitle="Add Vehicle"
      editTitle="Edit Vehicle"
      itemLabel="vehicle"
      createDraft={emptyVehicle}
      requiredValue={(item) => Boolean(item.make.trim() || item.model.trim() || item.year.trim())}
      titleOf={(item) => [item.year, item.make, item.model].filter(Boolean).join(' ')}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => renderGrid(item, vehicleFields, onChange, prefix)}
      {...tableListChrome}
    />
  );

  const renderNextSteps = (
    listKey: string,
    records: EolNextStep[],
    onCommit: (next: EolNextStep[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Step', value: (item) => item.title, emphasize: true },
        { label: 'Priority', value: (item) => item.priority },
        { label: 'Responsible', value: (item) => item.personResponsible },
      ]}
      emptyText="No next steps added yet."
      addTitle="Add Step"
      editTitle="Edit Step"
      itemLabel="step"
      createDraft={() => emptyNextStep({ priority: 'Medium' })}
      requiredValue={(item) => Boolean(item.title.trim())}
      titleOf={(item) => item.title}
      onCommit={onCommit}
      hideDelete={(item) => item.isPredefined}
      onInactivate={(item) =>
        patchData(
          (data) => ({
            ...data,
            nextSteps: data.nextSteps.map((step) => (step.id === item.id ? { ...step, hidden: true } : step)),
          }),
          true
        )
      }
      renderForm={(item, onChange, prefix) => renderGrid(item, nextStepFields, onChange, prefix)}
      renderFormExtra={(item, onChange, helpers) => (
        <div>
          <label htmlFor={`${helpers.prefix}-contact`} className={labelClass}>
            Related contact
          </label>
          <select
            id={`${helpers.prefix}-contact`}
            value={item.relatedContactId}
            onChange={(event) => onChange({ ...item, relatedContactId: event.target.value })}
            className={selectClass}
          >
            <option value="">None</option>
            {(selectedPlan?.data.contacts || []).map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name || 'Untitled contact'}
              </option>
            ))}
          </select>
        </div>
      )}
      {...tableListChrome}
    />
  );

  const renderPersonalItems = (
    listKey: string,
    records: EolPersonalItem[],
    onCommit: (next: EolPersonalItem[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Item', value: (item) => item.item, emphasize: true },
        { label: 'Recipient', value: (item) => item.recipient },
        { label: 'Location', value: (item) => item.location },
        { label: 'Description', value: (item) => item.description },
      ]}
      emptyText="No personal items added yet."
      addTitle="Add Personal Item"
      editTitle="Edit Personal Item"
      itemLabel="personal item"
      createDraft={emptyPersonalItem}
      requiredValue={(item) => Boolean(item.item.trim())}
      titleOf={(item) => item.item}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => renderGrid(item, personalItemFields, onChange, prefix)}
      formExtra={
        <p className={helperClass}>Photo and document uploads are not available in this pass. Use a text reference only.</p>
      }
      {...tableListChrome}
    />
  );

  const renderWishQuestions = (keys: Array<(typeof MY_WISHES_QUESTIONS)[number]['key']>) => (
    <div className="space-y-4">
      {MY_WISHES_QUESTIONS.filter((question) => keys.includes(question.key)).map((question) => (
        <div key={question.key}>
          <label htmlFor={`wish-${question.key}`} className={labelClass}>
            {question.label}
          </label>
          <textarea
            id={`wish-${question.key}`}
            rows={3}
            value={selectedPlan?.data.myWishes[question.key] || ''}
            onChange={(event) =>
              patchData((data) => ({
                ...data,
                myWishes: { ...data.myWishes, [question.key]: event.target.value },
              }))
            }
            className={`${inputClass} resize-y`}
          />
        </div>
      ))}
    </div>
  );

  const renderLetters = (
    listKey: string,
    records: EolLetter[],
    onCommit: (next: EolLetter[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Title', value: (item) => item.title, emphasize: true },
        { label: 'Recipient', value: (item) => item.recipient },
        { label: 'Type', value: (item) => item.letterType },
        { label: 'Visibility', value: (item) => item.visibility },
      ]}
      emptyText="No letters added yet."
      addTitle="Add Letter"
      editTitle="Edit Letter"
      itemLabel="letter"
      createDraft={emptyLetter}
      requiredValue={(item) => Boolean(item.title.trim())}
      titleOf={(item) => item.title}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => {
        const revealed = item.visibility !== 'Private' || revealedLetters[item.id];
        return (
          <div className="space-y-4">
            {renderGrid(item, letterFields, (next) => onChange({ ...next, lastUpdated: nowIso() }), prefix)}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor={`${prefix}-body`} className={labelClass}>
                  Letter/message
                </label>
                {item.visibility === 'Private' ? (
                  <button
                    type="button"
                    className={isLight ? 'text-sm font-medium text-emerald-800' : 'text-sm font-medium text-emerald-300'}
                    onClick={() => setRevealedLetters((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                  >
                    {revealed ? 'Hide letter' : 'Show letter'}
                  </button>
                ) : null}
              </div>
              {revealed ? (
                <textarea
                  id={`${prefix}-body`}
                  rows={8}
                  value={secretText(item.body)}
                  onChange={(event) => onChange({ ...item, body: withSecret(event.target.value), lastUpdated: nowIso() })}
                  className={`${inputClass} resize-y`}
                />
              ) : (
                <p className={mutedTextClass}>•••••••• Letter hidden</p>
              )}
              {secretHelper}
              <p className={helperClass}>Attachments will be available in a later update.</p>
            </div>
          </div>
        );
      }}
      {...tableListChrome}
    />
  );

  const otherExtra = (item: EolCustomRecord, onChange: (next: EolCustomRecord) => void) => (
    <div className="space-y-3">
      <div className="flex justify-start">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => onChange({ ...item, customFields: [...item.customFields, emptyCustomField()] })}
        >
          + Add Custom Field
        </button>
      </div>
      {item.customFields.map((field, index) => (
        <div key={field.id} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${field.id}-label`} className={labelClass}>
              Field label
            </label>
            <input
              id={`${field.id}-label`}
              value={field.label}
              onChange={(event) =>
                onChange({
                  ...item,
                  customFields: replaceListItem(item.customFields, field.id, { ...field, label: event.target.value }),
                })
              }
              className={inputClass}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor={`${field.id}-value`} className={labelClass}>
                Value
              </label>
              <input
                id={`${field.id}-value`}
                value={field.value}
                onChange={(event) =>
                  onChange({
                    ...item,
                    customFields: replaceListItem(item.customFields, field.id, { ...field, value: event.target.value }),
                  })
                }
                className={inputClass}
              />
            </div>
            <button
              type="button"
              className={rowIconDangerClass}
              aria-label="Delete custom field"
              title="Delete custom field"
              onClick={() =>
                setDeleteTarget({
                  kind: 'record',
                  label: 'custom field',
                  onConfirm: () =>
                    onChange({ ...item, customFields: removeListItem(item.customFields, field.id) }),
                })
              }
            >
              <OutlineIcon d={ICON.trash} />
            </button>
            {index > 0 ? null : null}
          </div>
        </div>
      ))}
    </div>
  );

  const renderOther = (
    listKey: string,
    records: EolCustomRecord[],
    onCommit: (next: EolCustomRecord[], immediate?: boolean) => void
  ) => (
    <RecordTableList
      records={records}
      addRequestKey={familyAddRequestKey[listKey] || 0}
      columns={[
        { label: 'Title', value: (item) => item.title, emphasize: true },
        { label: 'Category', value: (item) => item.category },
        { label: 'Location', value: (item) => item.location },
        { label: 'Date', value: (item) => (item.importantDate ? formatDateDisplay(item.importantDate) : '') },
      ]}
      emptyText="No custom records added yet."
      addTitle="Add Custom Record"
      editTitle="Edit Custom Record"
      itemLabel="custom record"
      createDraft={emptyCustomRecord}
      requiredValue={(item) => Boolean(item.title.trim())}
      titleOf={(item) => item.title}
      onCommit={onCommit}
      renderForm={(item, onChange, prefix) => renderGrid(item, otherFields, onChange, prefix)}
      renderFormExtra={(item, onChange) => otherExtra(item, onChange)}
      {...tableListChrome}
    />
  );

  const renderCustomSection = (section: EolCustomSection) => {
    const updateSection = (next: EolCustomSection, immediate = false) => {
      patchData(
        (data) => ({
          ...data,
          customSections: replaceListItem(data.customSections, section.id, next),
        }),
        immediate
      );
    };
    return (
      <div className="space-y-6">
        <div className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <h3 className={sectionTitleClass}>{section.name}</h3>
              {section.modeledAfter === 'contacts' ||
              section.modeledAfter === 'devices' ||
              section.modeledAfter === 'online' ||
              section.modeledAfter === 'documents' ||
              section.modeledAfter === 'insurance' ||
              section.modeledAfter === 'letters' ||
              section.modeledAfter === 'other' ? (
                <button
                  type="button"
                  onClick={() =>
                    requestFamilyAdd(
                      section.modeledAfter === 'contacts'
                        ? `custom-contacts-${section.id}`
                        : section.modeledAfter === 'devices'
                          ? `custom-devices-${section.id}`
                          : section.modeledAfter === 'online'
                            ? `custom-online-${section.id}`
                            : section.modeledAfter === 'documents'
                              ? `custom-docs-${section.id}`
                              : section.modeledAfter === 'insurance'
                                ? `custom-ins-${section.id}`
                                : section.modeledAfter === 'letters'
                                  ? `custom-letters-${section.id}`
                                  : `custom-other-${section.id}`
                    )
                  }
                  className={
                    isLight
                      ? 'inline-flex items-center justify-center rounded-md border-2 border-emerald-600 p-0.5 text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800'
                      : 'inline-flex items-center justify-center rounded-md border-2 border-emerald-400 p-0.5 text-emerald-400 transition-colors hover:bg-emerald-500/15 hover:text-emerald-300'
                  }
                  aria-label={
                    section.modeledAfter === 'contacts'
                      ? 'Add contact'
                      : section.modeledAfter === 'devices'
                        ? 'Add device'
                        : section.modeledAfter === 'online'
                          ? 'Add online account'
                          : section.modeledAfter === 'documents'
                            ? 'Add document'
                            : section.modeledAfter === 'insurance'
                              ? 'Add policy'
                              : section.modeledAfter === 'letters'
                                ? 'Add letter'
                                : 'Add custom record'
                  }
                  title={
                    section.modeledAfter === 'contacts'
                      ? 'Add contact'
                      : section.modeledAfter === 'devices'
                        ? 'Add device'
                        : section.modeledAfter === 'online'
                          ? 'Add online account'
                          : section.modeledAfter === 'documents'
                            ? 'Add document'
                            : section.modeledAfter === 'insurance'
                              ? 'Add policy'
                              : section.modeledAfter === 'letters'
                                ? 'Add letter'
                                : 'Add custom record'
                  }
                >
                  <OutlineIcon d={ICON.plus} className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  setRenamingSectionId(section.id);
                  setRenameValue(section.name);
                }}
              >
                Rename
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                onClick={() => setDeleteTarget({ kind: 'section', id: section.id, label: section.name, custom: true })}
              >
                Delete section
              </button>
            </div>
          </div>
          <p className={`${mutedTextClass} text-sm mb-4`}>
            Modeled after {EOL_CUSTOM_TEMPLATES.find((item) => item.id === section.modeledAfter)?.label}.
          </p>
          {section.modeledAfter === 'contacts'
            ? renderContacts(`custom-contacts-${section.id}`, section.contacts, (next, immediate) =>
                updateSection({ ...section, contacts: next }, immediate)
              )
            : null}
          {section.modeledAfter === 'devices'
            ? renderDevices(`custom-devices-${section.id}`, section.devices, (next, immediate) =>
                updateSection({ ...section, devices: next }, immediate)
              )
            : null}
          {section.modeledAfter === 'online'
            ? renderOnline(`custom-online-${section.id}`, section.onlineAccounts, (next, immediate) =>
                updateSection({ ...section, onlineAccounts: next }, immediate)
              )
            : null}
          {section.modeledAfter === 'documents'
            ? renderDocuments(`custom-docs-${section.id}`, section.documents, (next, immediate) =>
                updateSection({ ...section, documents: next }, immediate)
              )
            : null}
          {section.modeledAfter === 'insurance'
            ? renderInsurance(`custom-ins-${section.id}`, section.insurance, (next, immediate) =>
                updateSection({ ...section, insurance: next }, immediate)
              )
            : null}
          {section.modeledAfter === 'letters'
            ? renderLetters(`custom-letters-${section.id}`, section.letters, (next, immediate) =>
                updateSection({ ...section, letters: next }, immediate)
              )
            : null}
          {section.modeledAfter === 'other'
            ? renderOther(`custom-other-${section.id}`, section.otherRecords, (next, immediate) =>
                updateSection({ ...section, otherRecords: next }, immediate)
              )
            : null}
          {sectionNotes(`custom-notes-${section.id}`, section.notes, (notes) => updateSection({ ...section, notes }))}
          {sectionCompleteControl(section.id)}
        </div>
      </div>
    );
  };

  const relationshipFields = (
    value: EolRelationship | '',
    custom: string,
    onValue: (next: EolRelationship | '') => void,
    onCustom: (next: string) => void,
    idPrefix: string
  ) => (
    <>
      <div>
        <label htmlFor={`${idPrefix}-relationship`} className={labelClass}>
          Relationship to account owner
        </label>
        <select
          id={`${idPrefix}-relationship`}
          value={value}
          onChange={(event) => onValue(event.target.value as EolRelationship | '')}
          className={selectClass}
        >
          <option value="">Select…</option>
          {EOL_RELATIONSHIPS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      {value === 'Other' ? (
        <div>
          <label htmlFor={`${idPrefix}-relationship-custom`} className={labelClass}>
            Custom relationship
          </label>
          <input
            id={`${idPrefix}-relationship-custom`}
            value={custom}
            onChange={(event) => onCustom(event.target.value)}
            className={inputClass}
          />
        </div>
      ) : null}
    </>
  );

  const customSection = selectedPlan?.data.customSections.find((section) => activeTab === `custom:${section.id}`);
  const sectionLabels = selectedPlan?.data.sectionLabels || {};
  const inactiveSectionIds = new Set(selectedPlan?.data.inactiveSectionIds || []);
  const removedSectionIds = new Set(selectedPlan?.data.removedSectionIds || []);
  const sectionOrder = selectedPlan ? resolveSectionOrder(selectedPlan.data) : [];
  const tabsByKey = new Map<string, { id: TabId; label: string; custom: boolean; inactive: boolean }>();
  EOL_BUILT_IN_TABS.filter((tab) => !removedSectionIds.has(tab.id)).forEach((tab) => {
    tabsByKey.set(tab.id, {
      id: tab.id,
      label: sectionLabels[tab.id] || tab.label,
      custom: false,
      inactive: inactiveSectionIds.has(tab.id),
    });
  });
  (selectedPlan?.data.customSections || [])
    .filter((section) => !removedSectionIds.has(section.id))
    .forEach((section) => {
      tabsByKey.set(section.id, {
        id: `custom:${section.id}`,
        label: section.name,
        custom: true,
        inactive: inactiveSectionIds.has(section.id),
      });
    });
  const tabs: { id: TabId; label: string; custom?: boolean; inactive?: boolean }[] = sectionOrder
    .map((key) => tabsByKey.get(key))
    .filter((tab): tab is { id: TabId; label: string; custom: boolean; inactive: boolean } => Boolean(tab));
  const contentTabs = tabs;
  const contentTabCount = contentTabs.filter((tab) => !tab.inactive).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className={titleClass}>{EOL_TOOL_TITLE}</h2>
        <p className={descClass}>{EOL_TOOL_DESCRIPTION}</p>
      </div>

      {saveStatus === 'saving' ? <div className={successBannerClass}>Saving…</div> : null}
      {saveStatus === 'saved' ? <div className={successBannerClass}>Saved</div> : null}
      {saveStatus === 'error' ? (
        <div className={errorBannerClass}>Could not save to the database. Try again, or copy important notes elsewhere.</div>
      ) : null}
      {formError ? <div className={errorBannerClass}>{formError}</div> : null}

      <div className={cardCompactClass}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <label className={isLight ? 'text-sm font-medium text-slate-700' : 'text-sm font-medium text-slate-300'}>
            Select a Plan
          </label>
          {!isCreatingPlan ? (
            <div className="flex flex-col items-end gap-1.5">
              {selectedPlan ? (
                <p className={`text-xs text-right whitespace-nowrap ${mutedTextClass}`}>
                  Last updated {formatDateTimeDisplay(selectedPlan.lastUpdated)}
                </p>
              ) : null}
              <label className={`inline-flex items-center gap-2 text-sm ${mutedTextClass}`}>
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500"
                />
                Show archived plans
              </label>
            </div>
          ) : null}
        </div>
        {!isCreatingPlan ? (
          <>
            <div className="mb-3 max-w-md">
              <label htmlFor="eol-plan-search" className={labelClass}>
                Search plans
              </label>
              <input
                id="eol-plan-search"
                type="text"
                value={planSearchQuery}
                onChange={(event) => setPlanSearchQuery(event.target.value)}
                placeholder="Search by plan name or person…"
                className={inputClass}
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {plans.filter((plan) => showArchived || plan.status === 'Active').length > 0 && visiblePlans.length === 0 ? (
                <p className={mutedTextClass}>No matching plans.</p>
              ) : null}
              {visiblePlans.map((plan) =>
                editingPlanId === plan.id ? (
                  <div
                    key={plan.id}
                    className="px-4 py-3 rounded-lg border min-w-[280px] max-w-md"
                    style={{ borderColor: editColor, backgroundColor: `${editColor}15` }}
                  >
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="edit-plan-name" className={labelClass}>
                          Plan name
                        </label>
                        <input id="edit-plan-name" value={editName} onChange={(event) => setEditName(event.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="edit-person-name" className={labelClass}>
                          Person’s full name
                        </label>
                        <input id="edit-person-name" value={editPersonName} onChange={(event) => setEditPersonName(event.target.value)} className={inputClass} />
                      </div>
                      {relationshipFields(editRelationship, editRelationshipCustom, setEditRelationship, setEditRelationshipCustom, 'edit')}
                      <div>
                        <label htmlFor="edit-dob" className={labelClass}>
                          Date of birth
                        </label>
                        <input id="edit-dob" type="date" value={editDob} onChange={(event) => setEditDob(event.target.value)} className={inputClass} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label htmlFor="edit-color" className={labelClass}>
                          Color
                        </label>
                        <input id="edit-color" type="color" value={editColor} onChange={(event) => setEditColor(event.target.value)} className="h-8 w-14 rounded border border-slate-400 cursor-pointer" />
                      </div>
                      <p className={helperClass}>Created {formatDateDisplay(plan.dateCreated.split('T')[0])} · Last updated {formatDateTimeDisplay(plan.lastUpdated)}</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={savePlanEdit} disabled={!editName.trim() || !editPersonName.trim()} className={primaryButtonClass}>
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingPlanId(null)} className={secondaryButtonClass}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={plan.id} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        persist(plans, plan.id, true, { selectionOnly: true });
                        setActiveTab('personal');
                      }}
                      aria-pressed={selectedPlanId === plan.id}
                      className={`px-4 py-3 rounded-lg transition-all duration-200 min-w-[120px] ${
                        selectedPlanId === plan.id
                          ? 'border-2 font-semibold shadow-lg'
                          : isLight
                            ? 'border border-transparent hover:brightness-95'
                            : 'border hover:brightness-125'
                      }`}
                      style={{
                        borderColor: plan.card_color || '#10b981',
                        backgroundColor:
                          selectedPlanId === plan.id
                            ? plan.card_color || '#10b981'
                            : `${plan.card_color || '#10b981'}18`,
                        color: selectedPlanId === plan.id ? contrastOnColor(plan.card_color || '#10b981') : plan.card_color || '#10b981',
                        boxShadow:
                          selectedPlanId === plan.id
                            ? `0 0 0 3px ${(plan.card_color || '#10b981')}66`
                            : undefined,
                      }}
                    >
                      <div className="text-center">{plan.name}</div>
                      {plan.status === 'Archived' ? <div className="text-xs mt-1 opacity-80">Archived</div> : null}
                      <div className="text-xs mt-1 opacity-80">Updated {formatDateTimeDisplay(plan.lastUpdated)}</div>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuOpenPlanId(menuOpenPlanId === plan.id ? null : plan.id);
                        setMenuOpenTabId(null);
                        setMenuOpenSubsectionId(null);
                      }}
                      className={isLight ? 'absolute top-1 right-1 p-1 rounded hover:bg-slate-100 transition-colors' : 'absolute top-1 right-1 p-1 rounded hover:bg-slate-700/50 transition-colors'}
                      aria-label="Plan options"
                      title="Plan options"
                    >
                      <svg className={isLight ? 'h-4 w-4 text-slate-600 hover:text-slate-900' : 'h-4 w-4 text-slate-400 hover:text-slate-200'} fill="currentColor" viewBox="0 0 24 24">
                        <path d={ICON.dots} />
                      </svg>
                    </button>
                    {menuOpenPlanId === plan.id ? (
                      <div className={popupMenuClass}>
                        <button type="button" className={popupMenuItemClass} onClick={() => startEditPlan(plan)}>
                          <OutlineIcon d={ICON.edit} className="h-4 w-4" />
                          Edit
                        </button>
                        {plan.status === 'Active' ? (
                          <button type="button" className={popupMenuItemClass} onClick={() => archivePlan(plan.id, true)}>
                            <OutlineIcon d={ICON.archive} className="h-4 w-4" />
                            Archive
                          </button>
                        ) : (
                          <button type="button" className={popupMenuItemClass} onClick={() => archivePlan(plan.id, false)}>
                            <OutlineIcon d={ICON.restore} className="h-4 w-4" />
                            Restore
                          </button>
                        )}
                        <button
                          type="button"
                          className={popupMenuDangerItemClass}
                          onClick={() => {
                            setMenuOpenPlanId(null);
                            setDeleteTarget({ kind: 'plan', id: plan.id, label: plan.name });
                            setDeleteConfirmText('');
                          }}
                        >
                          <OutlineIcon d={ICON.trash} className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              )}
              <button
                type="button"
                onClick={startCreatePlan}
                className={
                  isLight
                    ? 'px-4 py-3 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition-all duration-200 flex items-center justify-center min-w-[60px]'
                    : 'px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all duration-200 flex items-center justify-center min-w-[60px]'
                }
                title="Add New Plan"
                aria-label="Add New Plan"
              >
                <OutlineIcon d={ICON.plus} className="h-6 w-6" />
              </button>
            </div>
            {selectedPlan ? (
              <div className="mt-4 flex items-center gap-3">
                <span className={`shrink-0 text-xs font-medium ${mutedTextClass}`}>Overall completion</span>
                <div
                  className={isLight ? 'h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200' : 'h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800'}
                  role="progressbar"
                  aria-label="Overall plan completion"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={overall}
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, overall))}%` }}
                  />
                </div>
                <span className={`w-10 shrink-0 text-right text-sm font-semibold tabular-nums ${bodyTextClass}`}>
                  {overall}%
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-plan-name" className={labelClass}>
                Plan name
              </label>
              <input
                id="new-plan-name"
                value={newPlanName}
                onChange={(event) => setNewPlanName(event.target.value)}
                className={inputClass}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="new-person-name" className={labelClass}>
                Person’s full name
              </label>
              <input
                id="new-person-name"
                value={newPersonName}
                onChange={(event) => setNewPersonName(event.target.value)}
                className={inputClass}
              />
            </div>
            {relationshipFields(newRelationship, newRelationshipCustom, setNewRelationship, setNewRelationshipCustom, 'new')}
            <div>
              <label htmlFor="new-dob" className={labelClass}>
                Date of birth
              </label>
              <input id="new-dob" type="date" value={newDob} onChange={(event) => setNewDob(event.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="new-color" className={labelClass}>
                Card color
              </label>
              <input id="new-color" type="color" value={newColor} onChange={(event) => setNewColor(event.target.value)} className="h-10 w-16 rounded border border-slate-400 cursor-pointer" />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="button" onClick={createNewPlan} disabled={!newPlanName.trim() || !newPersonName.trim()} className={primaryButtonClass}>
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingPlan(false);
                  setFormError('');
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {menuOpenPlanId || menuOpenTabId || menuOpenSubsectionId ? (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setMenuOpenPlanId(null);
            setMenuOpenTabId(null);
            setMenuOpenSubsectionId(null);
          }}
        />
      ) : null}

      {isLoading ? (
        <div className={emptyStateClass}>
          <p className={mutedTextClass}>Loading plans…</p>
        </div>
      ) : null}

      {!isLoading && !selectedPlan && !isCreatingPlan ? (
        <div className={emptyStateClass}>
          <p className={mutedTextClass}>Please select a plan or create a new one to get started.</p>
        </div>
      ) : null}

      {selectedPlan ? (
        <>
          <div className={`${tabStripClass} relative z-50`}>
            <div className="mb-2">
              <p className={`text-base font-semibold ${bodyTextClass}`}>{selectedPlan.name}</p>
              <p className={`text-xs ${mutedTextClass}`}>
                Created {formatDateDisplay(selectedPlan.dateCreated.split('T')[0])} · Last updated{' '}
                {formatDateTimeDisplay(selectedPlan.lastUpdated)}
              </p>
              {(selectedPlan.historyEvents || []).length > 0 ? (
                <ul className={`mt-2 space-y-0.5 text-xs ${mutedTextClass}`}>
                  <li className={isLight ? 'font-semibold text-slate-700' : 'font-semibold text-slate-300'}>
                    Recent activity
                  </li>
                  {[...selectedPlan.historyEvents].reverse().slice(0, 8).map((event) => (
                    <li key={event.id}>
                      {event.kind === 'restore'
                        ? 'Restored'
                        : event.kind === 'archive'
                          ? 'Archived'
                          : event.kind === 'created'
                            ? 'Created'
                            : 'Edited'}
                      : {event.summary} · {formatDateTimeDisplay(event.at)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => {
                const sectionKey = tab.custom && tab.id.startsWith('custom:') ? tab.id.slice(7) : String(tab.id);
                const isActive = activeTab === tab.id && !tab.inactive;
                const showMenu = true;
                const inactiveTabClass = isLight
                  ? 'relative rounded-lg border border-slate-300 bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-500'
                  : 'relative rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm font-medium text-slate-500';
                return (
                  <div key={tab.id} className="relative">
                    <div
                      className={`inline-flex items-center ${
                        tab.inactive ? inactiveTabClass : isActive ? tabActiveClass : tabInactiveClass
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (!tab.inactive) setActiveTab(tab.id);
                        }}
                        disabled={tab.inactive}
                        aria-current={isActive ? 'page' : undefined}
                        aria-disabled={tab.inactive || undefined}
                        title={tab.inactive ? `${tab.label} is inactive` : undefined}
                        className={`px-0.5 ${tab.inactive ? 'cursor-not-allowed' : ''}`}
                      >
                        {tab.label}
                      </button>
                      {tab.inactive ? (
                        <span
                          className={
                            isLight
                              ? 'pointer-events-none absolute inset-0 rounded-lg bg-white/55'
                              : 'pointer-events-none absolute inset-0 rounded-lg bg-slate-950/55'
                          }
                          aria-hidden
                        />
                      ) : null}
                      {showMenu ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuOpenTabId(menuOpenTabId === tab.id ? null : tab.id);
                            setMenuOpenPlanId(null);
                            setMenuOpenSubsectionId(null);
                          }}
                          className={`relative z-10 ml-1 rounded p-0.5 ${
                            isActive
                              ? isLight
                                ? 'text-white hover:bg-white/15'
                                : 'text-slate-950 hover:bg-slate-950/10'
                              : isLight
                                ? 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                                : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'
                          }`}
                          aria-label={`${tab.label} options`}
                          title={`${tab.label} options`}
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path d={ICON.dots} />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                    {menuOpenTabId === tab.id ? (
                      <div className={popupMenuClass}>
                        <button
                          type="button"
                          className={popupMenuItemClass}
                          onClick={() => {
                            setMenuOpenTabId(null);
                            setRenamingSectionId(sectionKey);
                            setRenameValue(tab.label);
                          }}
                        >
                          <OutlineIcon d={ICON.edit} className="h-4 w-4" />
                          Rename
                        </button>
                        <button
                          type="button"
                          className={popupMenuItemClass}
                          onClick={() => duplicateSection(tab)}
                        >
                          <OutlineIcon d={ICON.duplicate} className="h-4 w-4" />
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className={`${popupMenuItemClass} disabled:cursor-not-allowed disabled:opacity-50`}
                          disabled={contentTabs.findIndex((item) => item.id === tab.id) <= 0}
                          onClick={() => moveSectionTab(sectionKey, -1)}
                        >
                          <OutlineIcon d={ICON.left} className="h-4 w-4" />
                          Move left
                        </button>
                        <button
                          type="button"
                          className={`${popupMenuItemClass} disabled:cursor-not-allowed disabled:opacity-50`}
                          disabled={contentTabs.findIndex((item) => item.id === tab.id) === contentTabs.length - 1}
                          onClick={() => moveSectionTab(sectionKey, 1)}
                        >
                          <OutlineIcon d={ICON.right} className="h-4 w-4" />
                          Move right
                        </button>
                        {tab.inactive ? (
                          <button type="button" className={popupMenuItemClass} onClick={() => setSectionInactive(sectionKey, false)}>
                            <OutlineIcon d={ICON.restore} className="h-4 w-4" />
                            Activate
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`${popupMenuItemClass} disabled:cursor-not-allowed disabled:opacity-50`}
                            disabled={contentTabCount <= 1}
                            onClick={() => setSectionInactive(sectionKey, true)}
                          >
                            <OutlineIcon d={ICON.archive} className="h-4 w-4" />
                            Inactivate
                          </button>
                        )}
                        <button
                          type="button"
                          className={`${popupMenuDangerItemClass} disabled:cursor-not-allowed disabled:opacity-50`}
                          disabled={!tab.inactive && contentTabCount <= 1}
                          onClick={() => {
                            setMenuOpenTabId(null);
                            setDeleteTarget({
                              kind: 'section',
                              id: sectionKey,
                              label: tab.label,
                              custom: Boolean(tab.custom),
                            });
                            setDeleteConfirmText('');
                          }}
                        >
                          <OutlineIcon d={ICON.trash} className="h-4 w-4" />
                          Delete Section
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {activeTab === 'personal' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Personal Record</h3>
              <div className="space-y-8">
                <section>
                  {sectionRule()}
                  {subsectionHeading('Personal Information')}
                  {renderGrid(
                    selectedPlan.data.personal,
                    [
                      { kind: 'text', key: 'fullLegalName', label: 'Full legal name' },
                      { kind: 'text', key: 'preferredName', label: 'Preferred name' },
                      { kind: 'text', key: 'previousNames', label: 'Previous/maiden names' },
                      { kind: 'date', key: 'dateOfBirth', label: 'Date of birth' },
                      { kind: 'text', key: 'placeOfBirth', label: 'Place of birth' },
                      {
                        kind: 'text',
                        key: 'ssn',
                        label: 'Social Security number',
                        placeholder: 'Hand write this value on printed form',
                        readOnly: true,
                        span: 2,
                      },
                      { kind: 'text', key: 'maritalStatus', label: 'Marital status' },
                      { kind: 'text', key: 'spousePartner', label: 'Spouse/partner' },
                      { kind: 'textarea', key: 'homeAddress', label: 'Home address', span: 2 },
                      { kind: 'text', key: 'phone', label: 'Phone' },
                      { kind: 'text', key: 'personalEmail', label: 'Personal email' },
                    ],
                    (next) => patchData((data) => ({ ...data, personal: next })),
                    'personal-info'
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('personal-id', 'Identification'), {
                    collapseKey: 'personal-id',
                    onDuplicate: () => duplicatePersonalBlock('identification'),
                  })}
                  {collapseBody(
                    'personal-id',
                    renderGrid(
                      selectedPlan.data.personal,
                      [
                        {
                          kind: 'text',
                          key: 'driversLicenseNumber',
                          label: 'Driver’s license number',
                          placeholder: 'Hand write this value on printed form',
                          readOnly: true,
                        },
                        { kind: 'text', key: 'driversLicenseState', label: 'Driver’s license state' },
                        {
                          kind: 'text',
                          key: 'passportNumber',
                          label: 'Passport number',
                          placeholder: 'Hand write this value on printed form',
                          readOnly: true,
                        },
                        { kind: 'date', key: 'passportExpiration', label: 'Passport expiration' },
                        { kind: 'textarea', key: 'otherIdentification', label: 'Other identification', span: 2 },
                      ],
                      (next) => patchData((data) => ({ ...data, personal: next })),
                      'personal-id'
                    )
                  )}
                </section>
                {(selectedPlan.data.personalExtraSections || [])
                  .filter((extra) => extra.kind === 'identification')
                  .map((extra) => (
                    <section key={extra.id}>
                      {sectionRule()}
                      {subsectionHeading(extra.name, {
                        collapseKey: extra.id,
                        onDuplicate: () => duplicatePersonalBlock('identification', extra.id),
                        onDelete: () => deletePersonalExtra(extra),
                      })}
                      {collapseBody(
                        extra.id,
                        renderGrid(
                          extra.identification,
                          [
                            {
                              kind: 'text',
                              key: 'driversLicenseNumber',
                              label: 'Driver’s license number',
                              placeholder: 'Hand write this value on printed form',
                              readOnly: true,
                            },
                            { kind: 'text', key: 'driversLicenseState', label: 'Driver’s license state' },
                            {
                              kind: 'text',
                              key: 'passportNumber',
                              label: 'Passport number',
                              placeholder: 'Hand write this value on printed form',
                              readOnly: true,
                            },
                            { kind: 'date', key: 'passportExpiration', label: 'Passport expiration' },
                            { kind: 'textarea', key: 'otherIdentification', label: 'Other identification', span: 2 },
                          ],
                          (next) => updatePersonalExtra(extra.id, { identification: next }),
                          extra.id
                        )
                      )}
                    </section>
                  ))}
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('personal-work', 'Employment'), {
                    collapseKey: 'personal-work',
                    onDuplicate: () => duplicatePersonalBlock('employment'),
                  })}
                  {collapseBody(
                    'personal-work',
                    renderGrid(
                      selectedPlan.data.personal,
                      [
                        { kind: 'text', key: 'employer', label: 'Employer' },
                        { kind: 'text', key: 'jobTitle', label: 'Job title' },
                        { kind: 'text', key: 'employerContact', label: 'Employer contact' },
                        { kind: 'text', key: 'hrContact', label: 'HR contact' },
                        { kind: 'text', key: 'workPhone', label: 'Work phone' },
                        { kind: 'text', key: 'workEmail', label: 'Work email' },
                      ],
                      (next) => patchData((data) => ({ ...data, personal: next })),
                      'personal-work'
                    )
                  )}
                </section>
                {(selectedPlan.data.personalExtraSections || [])
                  .filter((extra) => extra.kind === 'employment')
                  .map((extra) => (
                    <section key={extra.id}>
                      {sectionRule()}
                      {subsectionHeading(extra.name, {
                        collapseKey: extra.id,
                        onDuplicate: () => duplicatePersonalBlock('employment', extra.id),
                        onDelete: () => deletePersonalExtra(extra),
                      })}
                      {collapseBody(
                        extra.id,
                        renderGrid(
                          extra.employment,
                          [
                            { kind: 'text', key: 'employer', label: 'Employer' },
                            { kind: 'text', key: 'jobTitle', label: 'Job title' },
                            { kind: 'text', key: 'employerContact', label: 'Employer contact' },
                            { kind: 'text', key: 'hrContact', label: 'HR contact' },
                            { kind: 'text', key: 'workPhone', label: 'Work phone' },
                            { kind: 'text', key: 'workEmail', label: 'Work email' },
                          ],
                          (next) => updatePersonalExtra(extra.id, { employment: next }),
                          extra.id
                        )
                      )}
                    </section>
                  ))}
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('personal-military', 'Military Information'), {
                    collapseKey: 'personal-military',
                    onDuplicate: () => duplicatePersonalBlock('military'),
                  })}
                  {collapseBody(
                    'personal-military',
                    renderGrid(
                      selectedPlan.data.personal,
                      [
                        { kind: 'text', key: 'veteranStatus', label: 'Veteran status' },
                        { kind: 'text', key: 'militaryBranch', label: 'Branch' },
                        { kind: 'text', key: 'serviceDates', label: 'Service dates' },
                        { kind: 'text', key: 'militaryId', label: 'Military ID/service number' },
                        { kind: 'textarea', key: 'dischargeRecordsLocation', label: 'Location of discharge/service records', span: 2 },
                      ],
                      (next) => patchData((data) => ({ ...data, personal: next })),
                      'personal-military'
                    )
                  )}
                </section>
                {(selectedPlan.data.personalExtraSections || [])
                  .filter((extra) => extra.kind === 'military')
                  .map((extra) => (
                    <section key={extra.id}>
                      {sectionRule()}
                      {subsectionHeading(extra.name, {
                        collapseKey: extra.id,
                        onDuplicate: () => duplicatePersonalBlock('military', extra.id),
                        onDelete: () => deletePersonalExtra(extra),
                      })}
                      {collapseBody(
                        extra.id,
                        renderGrid(
                          extra.military,
                          [
                            { kind: 'text', key: 'veteranStatus', label: 'Veteran status' },
                            { kind: 'text', key: 'militaryBranch', label: 'Branch' },
                            { kind: 'text', key: 'serviceDates', label: 'Service dates' },
                            { kind: 'text', key: 'militaryId', label: 'Military ID/service number' },
                            { kind: 'textarea', key: 'dischargeRecordsLocation', label: 'Location of discharge/service records', span: 2 },
                          ],
                          (next) => updatePersonalExtra(extra.id, { military: next }),
                          extra.id
                        )
                      )}
                    </section>
                  ))}
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('personal-family', 'Family Information'), {
                    collapseKey: 'personal-family',
                    onDuplicate: () => duplicatePersonalBlock('family'),
                    onAdd: () => {
                      if (isSubsectionInactive('personal-family')) toggleSubsection('personal-family');
                      requestFamilyAdd('personal-family');
                    },
                  })}
                  {collapseBody(
                    'personal-family',
                    renderFamilyMembers('personal-family', selectedPlan.data.personal.familyMembers, (next, immediate) =>
                      patchData((data) => ({ ...data, personal: { ...data.personal, familyMembers: next } }), immediate)
                    )
                  )}
                </section>
                {(selectedPlan.data.personalExtraSections || [])
                  .filter((extra) => extra.kind === 'family')
                  .map((extra) => (
                    <section key={extra.id}>
                      {sectionRule()}
                      {subsectionHeading(extra.name, {
                        collapseKey: extra.id,
                        onDuplicate: () => duplicatePersonalBlock('family', extra.id),
                        onDelete: () => deletePersonalExtra(extra),
                        onAdd: () => {
                          if (isSubsectionInactive(extra.id)) toggleSubsection(extra.id);
                          requestFamilyAdd(extra.id);
                        },
                      })}
                      {collapseBody(
                        extra.id,
                        renderFamilyMembers(extra.id, extra.family.members, (next, immediate) =>
                          updatePersonalExtra(extra.id, { family: { members: next } }, immediate)
                        )
                      )}
                    </section>
                  ))}
                <div>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('personal-notes', 'Notes'), {
                    collapseKey: 'personal-notes',
                    onDuplicate: () => duplicatePersonalBlock('notes'),
                  })}
                  {collapseBody(
                    'personal-notes',
                    <textarea
                      id="personal-notes"
                      value={selectedPlan.data.personalNotes}
                      rows={4}
                      onChange={(event) => patchData((data) => ({ ...data, personalNotes: event.target.value }))}
                      className={`${inputClass} resize-y`}
                    />
                  )}
                </div>
                {(selectedPlan.data.personalExtraSections || [])
                  .filter((extra) => extra.kind === 'notes')
                  .map((extra) => (
                    <div key={extra.id}>
                      {sectionRule()}
                      {subsectionHeading(extra.name, {
                        collapseKey: extra.id,
                        onDuplicate: () => duplicatePersonalBlock('notes', extra.id),
                        onDelete: () => deletePersonalExtra(extra),
                      })}
                      {collapseBody(
                        extra.id,
                        <textarea
                          id={`personal-notes-${extra.id}`}
                          value={extra.notes}
                          rows={4}
                          onChange={(event) => updatePersonalExtra(extra.id, { notes: event.target.value })}
                          className={`${inputClass} resize-y`}
                        />
                      )}
                    </div>
                  ))}
                {sectionCompleteControl('personal')}
              </div>
            </div>
          ) : null}

          {activeTab === 'contacts' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Important Contacts</h3>
              <div className="space-y-8">
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('contacts-list', 'Contacts'), {
                    collapseKey: 'contacts-list',
                    addLabel: 'Add Contact',
                    onAdd: () => {
                      if (isSubsectionInactive('contacts-list')) toggleSubsection('contacts-list');
                      requestFamilyAdd('contacts');
                    },
                  })}
                  {collapseBody(
                    'contacts-list',
                    renderContacts('contacts', selectedPlan.data.contacts, (next, immediate) =>
                      patchData((data) => ({ ...data, contacts: next }), immediate)
                    )
                  )}
                </section>
                <div>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('contacts-notes', 'Notes'), {
                    collapseKey: 'contacts-notes',
                  })}
                  {collapseBody(
                    'contacts-notes',
                    <textarea
                      id="contacts-notes"
                      value={selectedPlan.data.contactsNotes}
                      rows={4}
                      onChange={(event) => patchData((data) => ({ ...data, contactsNotes: event.target.value }))}
                      className={`${inputClass} resize-y`}
                    />
                  )}
                </div>
                {sectionCompleteControl('contacts')}
              </div>
            </div>
          ) : null}

          {activeTab === 'devices' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Device Login</h3>
              <div className="space-y-8">
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('devices-list', 'Devices'), {
                    collapseKey: 'devices-list',
                    addLabel: 'Add Device',
                    onAdd: () => {
                      if (isSubsectionInactive('devices-list')) toggleSubsection('devices-list');
                      requestFamilyAdd('devices');
                    },
                  })}
                  {collapseBody(
                    'devices-list',
                    renderDevices('devices', selectedPlan.data.devices, (next, immediate) =>
                      patchData((data) => ({ ...data, devices: next }), immediate)
                    )
                  )}
                </section>
                <div>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('devices-notes', 'Notes'), {
                    collapseKey: 'devices-notes',
                  })}
                  {collapseBody(
                    'devices-notes',
                    <textarea
                      id="devices-notes"
                      value={selectedPlan.data.devicesNotes}
                      rows={4}
                      onChange={(event) => patchData((data) => ({ ...data, devicesNotes: event.target.value }))}
                      className={`${inputClass} resize-y`}
                    />
                  )}
                </div>
                {sectionCompleteControl('devices')}
              </div>
            </div>
          ) : null}

          {activeTab === 'online' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Online Login</h3>
              <div className="space-y-8">
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('online-list', 'Accounts'), {
                    collapseKey: 'online-list',
                    addLabel: 'Add Online Account',
                    onAdd: () => {
                      if (isSubsectionInactive('online-list')) toggleSubsection('online-list');
                      requestFamilyAdd('online');
                    },
                  })}
                  {collapseBody(
                    'online-list',
                    renderOnline('online', selectedPlan.data.onlineAccounts, (next, immediate) =>
                      patchData((data) => ({ ...data, onlineAccounts: next }), immediate)
                    )
                  )}
                </section>
                <div>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('online-notes', 'Notes'), {
                    collapseKey: 'online-notes',
                  })}
                  {collapseBody(
                    'online-notes',
                    <textarea
                      id="online-notes"
                      value={selectedPlan.data.onlineNotes}
                      rows={4}
                      onChange={(event) => patchData((data) => ({ ...data, onlineNotes: event.target.value }))}
                      className={`${inputClass} resize-y`}
                    />
                  )}
                </div>
                {sectionCompleteControl('online')}
              </div>
            </div>
          ) : null}

          {activeTab === 'documents' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Important Documents</h3>
              <div className="space-y-8">
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('documents-list', 'Documents'), {
                    collapseKey: 'documents-list',
                    addLabel: 'Add Document',
                    onAdd: () => {
                      if (isSubsectionInactive('documents-list')) toggleSubsection('documents-list');
                      requestFamilyAdd('documents');
                    },
                  })}
                  {collapseBody(
                    'documents-list',
                    renderDocuments('documents', selectedPlan.data.documents, (next, immediate) =>
                      patchData((data) => ({ ...data, documents: next }), immediate)
                    )
                  )}
                </section>
                <div>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('documents-notes', 'Notes'), {
                    collapseKey: 'documents-notes',
                  })}
                  {collapseBody(
                    'documents-notes',
                    <textarea
                      id="documents-notes"
                      value={selectedPlan.data.documentsNotes}
                      rows={4}
                      onChange={(event) => patchData((data) => ({ ...data, documentsNotes: event.target.value }))}
                      className={`${inputClass} resize-y`}
                    />
                  )}
                </div>
                {sectionCompleteControl('documents')}
              </div>
            </div>
          ) : null}

          {activeTab === 'insurance' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Insurance Information</h3>
              <div className="space-y-8">
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('insurance-list', 'Policies'), {
                    collapseKey: 'insurance-list',
                    addLabel: 'Add Policy',
                    onAdd: () => {
                      if (isSubsectionInactive('insurance-list')) toggleSubsection('insurance-list');
                      requestFamilyAdd('insurance');
                    },
                  })}
                  {collapseBody(
                    'insurance-list',
                    renderInsurance('insurance', selectedPlan.data.insurance, (next, immediate) =>
                      patchData((data) => ({ ...data, insurance: next }), immediate)
                    )
                  )}
                </section>
                <div>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('insurance-notes', 'Notes'), {
                    collapseKey: 'insurance-notes',
                  })}
                  {collapseBody(
                    'insurance-notes',
                    <textarea
                      id="insurance-notes"
                      value={selectedPlan.data.insuranceNotes}
                      rows={4}
                      onChange={(event) => patchData((data) => ({ ...data, insuranceNotes: event.target.value }))}
                      className={`${inputClass} resize-y`}
                    />
                  )}
                </div>
                {sectionCompleteControl('insurance')}
              </div>
            </div>
          ) : null}

          {activeTab === 'financial' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Financial Info</h3>
              <div className="space-y-8">
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('financial-bank', 'Bank Accounts'), {
                    collapseKey: 'financial-bank',
                    addLabel: 'Add Bank Account',
                    onAdd: () => {
                      if (isSubsectionInactive('financial-bank')) toggleSubsection('financial-bank');
                      requestFamilyAdd('bank');
                    },
                  })}
                  {collapseBody(
                    'financial-bank',
                    renderBankAccounts('bank', selectedPlan.data.financial.bankAccounts, (next, immediate) =>
                      patchData((data) => ({ ...data, financial: { ...data.financial, bankAccounts: next } }), immediate)
                    )
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('financial-invest', 'Investment & Retirement Accounts'), {
                    collapseKey: 'financial-invest',
                    addLabel: 'Add Investment Account',
                    onAdd: () => {
                      if (isSubsectionInactive('financial-invest')) toggleSubsection('financial-invest');
                      requestFamilyAdd('invest');
                    },
                  })}
                  {collapseBody(
                    'financial-invest',
                    renderInvestments('invest', selectedPlan.data.financial.investments, (next, immediate) =>
                      patchData((data) => ({ ...data, financial: { ...data.financial, investments: next } }), immediate)
                    )
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('financial-cards', 'Credit Cards'), {
                    collapseKey: 'financial-cards',
                    addLabel: 'Add Credit Card',
                    onAdd: () => {
                      if (isSubsectionInactive('financial-cards')) toggleSubsection('financial-cards');
                      requestFamilyAdd('cards');
                    },
                  })}
                  {collapseBody(
                    'financial-cards',
                    renderCreditCards('cards', selectedPlan.data.financial.creditCards, (next, immediate) =>
                      patchData((data) => ({ ...data, financial: { ...data.financial, creditCards: next } }), immediate)
                    )
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('financial-debts', 'Loans & Debts'), {
                    collapseKey: 'financial-debts',
                    addLabel: 'Add Debt',
                    onAdd: () => {
                      if (isSubsectionInactive('financial-debts')) toggleSubsection('financial-debts');
                      requestFamilyAdd('debts');
                    },
                  })}
                  {collapseBody(
                    'financial-debts',
                    renderDebts('debts', selectedPlan.data.financial.debts, (next, immediate) =>
                      patchData((data) => ({ ...data, financial: { ...data.financial, debts: next } }), immediate)
                    )
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('financial-income', 'Income Sources'), {
                    collapseKey: 'financial-income',
                    addLabel: 'Add Income Source',
                    onAdd: () => {
                      if (isSubsectionInactive('financial-income')) toggleSubsection('financial-income');
                      requestFamilyAdd('income');
                    },
                  })}
                  {collapseBody(
                    'financial-income',
                    renderIncomeSources('income', selectedPlan.data.financial.incomeSources, (next, immediate) =>
                      patchData((data) => ({ ...data, financial: { ...data.financial, incomeSources: next } }), immediate)
                    )
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('financial-bills', 'Recurring Bills'), {
                    collapseKey: 'financial-bills',
                    addLabel: 'Add Recurring Bill',
                    onAdd: () => {
                      if (isSubsectionInactive('financial-bills')) toggleSubsection('financial-bills');
                      requestFamilyAdd('bills');
                    },
                  })}
                  {collapseBody(
                    'financial-bills',
                    renderRecurringBills('bills', selectedPlan.data.financial.recurringBills, (next, immediate) =>
                      patchData((data) => ({ ...data, financial: { ...data.financial, recurringBills: next } }), immediate)
                    )
                  )}
                </section>
                <div>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('financial-notes', 'Notes'), {
                    collapseKey: 'financial-notes',
                  })}
                  {collapseBody(
                    'financial-notes',
                    <textarea
                      id="financial-notes"
                      value={selectedPlan.data.financialNotes}
                      rows={4}
                      onChange={(event) => patchData((data) => ({ ...data, financialNotes: event.target.value }))}
                      className={`${inputClass} resize-y`}
                    />
                  )}
                </div>
                {sectionCompleteControl('financial')}
              </div>
            </div>
          ) : null}

          {activeTab === 'home' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Home Info</h3>
              <div className="space-y-8">
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('home-property', 'Property'), {
                    collapseKey: 'home-property',
                  })}
                  {collapseBody(
                    'home-property',
                    renderGrid(
                      selectedPlan.data.home.property,
                      [
                        { kind: 'textarea', key: 'address', label: 'Property address', span: 2 },
                        { kind: 'text', key: 'ownershipType', label: 'Ownership type' },
                        { kind: 'text', key: 'otherOwners', label: 'Other owners' },
                        { kind: 'text', key: 'mortgageCompany', label: 'Mortgage company' },
                        { kind: 'text', key: 'mortgageReference', label: 'Mortgage account reference' },
                        { kind: 'text', key: 'mortgageBalance', label: 'Approximate mortgage balance' },
                        { kind: 'text', key: 'monthlyPayment', label: 'Monthly payment' },
                        { kind: 'textarea', key: 'propertyTax', label: 'Property tax information', span: 2 },
                        { kind: 'text', key: 'homeownersInsurance', label: 'Homeowners insurance reference' },
                        { kind: 'text', key: 'deedLocation', label: 'Deed location' },
                      ],
                      (next) => patchData((data) => ({ ...data, home: { ...data.home, property: next } })),
                      'home-property'
                    )
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('home-utilities', 'Utilities'), {
                    collapseKey: 'home-utilities',
                    addLabel: 'Add Utility',
                    onAdd: () => {
                      if (isSubsectionInactive('home-utilities')) toggleSubsection('home-utilities');
                      requestFamilyAdd('utilities');
                    },
                  })}
                  {collapseBody(
                    'home-utilities',
                    renderUtilities('utilities', selectedPlan.data.home.utilities, (next, immediate) =>
                      patchData((data) => ({ ...data, home: { ...data.home, utilities: next } }), immediate)
                    )
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('home-access', 'Home Access'), {
                    collapseKey: 'home-access',
                  })}
                  {collapseBody(
                    'home-access',
                    <div className="space-y-2">
                      {renderGrid(
                        selectedPlan.data.home.access,
                        [
                          { kind: 'secret', key: 'garageCode', label: 'Garage code' },
                          { kind: 'secret', key: 'alarmInformation', label: 'Alarm information' },
                          { kind: 'text', key: 'safeLocation', label: 'Safe location' },
                          { kind: 'secret', key: 'safeInstructions', label: 'Safe instructions' },
                          { kind: 'text', key: 'spareKeyLocation', label: 'Spare key location' },
                          { kind: 'text', key: 'mailboxInformation', label: 'Mailbox information' },
                          { kind: 'textarea', key: 'cameraInformation', label: 'Security camera information', span: 2 },
                        ],
                        (next) => patchData((data) => ({ ...data, home: { ...data.home, access: next } })),
                        'home-access'
                      )}
                      {secretHelper}
                    </div>
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('home-providers', 'Home Service Providers'), {
                    collapseKey: 'home-providers',
                    addLabel: 'Add Service Provider',
                    onAdd: () => {
                      if (isSubsectionInactive('home-providers')) toggleSubsection('home-providers');
                      requestFamilyAdd('providers');
                    },
                  })}
                  {collapseBody(
                    'home-providers',
                    renderHomeProviders('providers', selectedPlan.data.home.providers, (next, immediate) =>
                      patchData((data) => ({ ...data, home: { ...data.home, providers: next } }), immediate)
                    )
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('home-vehicles', 'Vehicles'), {
                    collapseKey: 'home-vehicles',
                    addLabel: 'Add Vehicle',
                    onAdd: () => {
                      if (isSubsectionInactive('home-vehicles')) toggleSubsection('home-vehicles');
                      requestFamilyAdd('vehicles');
                    },
                  })}
                  {collapseBody(
                    'home-vehicles',
                    renderVehicles('vehicles', selectedPlan.data.home.vehicles, (next, immediate) =>
                      patchData((data) => ({ ...data, home: { ...data.home, vehicles: next } }), immediate)
                    )
                  )}
                </section>
                <div>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('home-notes', 'Notes'), {
                    collapseKey: 'home-notes',
                  })}
                  {collapseBody(
                    'home-notes',
                    <textarea
                      id="home-notes"
                      value={selectedPlan.data.homeNotes}
                      rows={4}
                      onChange={(event) => patchData((data) => ({ ...data, homeNotes: event.target.value }))}
                      className={`${inputClass} resize-y`}
                    />
                  )}
                </div>
                {sectionCompleteControl('home')}
              </div>
            </div>
          ) : null}

          {activeTab === 'nextSteps' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Next Steps</h3>
              <p className={`${bodyTextClass} mb-4 font-medium`}>If something happened to me today, start here.</p>
              <div className="space-y-8">
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('next-steps-list', 'Steps'), {
                    collapseKey: 'next-steps-list',
                    addLabel: 'Add Step',
                    onAdd: () => {
                      if (isSubsectionInactive('next-steps-list')) toggleSubsection('next-steps-list');
                      requestFamilyAdd('steps');
                    },
                  })}
                  {collapseBody(
                    'next-steps-list',
                    <div className="space-y-4">
                      {renderNextSteps(
                        'steps',
                        selectedPlan.data.nextSteps.filter((step) => !step.hidden),
                        (next, immediate) => {
                          const hidden = selectedPlan.data.nextSteps.filter((step) => step.hidden);
                          const visibleIds = new Set(next.map((step) => step.id));
                          const remainingHidden = hidden.filter((step) => !visibleIds.has(step.id));
                          patchData((data) => ({ ...data, nextSteps: [...next, ...remainingHidden] }), immediate);
                        }
                      )}
                      <div>
                        <p className={`${mutedTextClass} text-sm mb-2`}>Inactivated steps</p>
                        {selectedPlan.data.nextSteps.filter((step) => step.hidden).length === 0 ? (
                          <p className={helperClass}>
                            None. Use the archive icon beside a step to inactivate it.
                          </p>
                        ) : (
                          selectedPlan.data.nextSteps
                            .filter((step) => step.hidden)
                            .map((step) => (
                              <button
                                key={step.id}
                                type="button"
                                className={`${secondaryButtonClass} mr-2 mb-2`}
                                onClick={() =>
                                  patchData(
                                    (data) => ({
                                      ...data,
                                      nextSteps: data.nextSteps.map((item) =>
                                        item.id === step.id ? { ...item, hidden: false } : item
                                      ),
                                    }),
                                    true
                                  )
                                }
                              >
                                Restore: {step.title}
                              </button>
                            ))
                        )}
                      </div>
                    </div>
                  )}
                </section>
                <div>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('next-steps-notes', 'Notes'), {
                    collapseKey: 'next-steps-notes',
                  })}
                  {collapseBody(
                    'next-steps-notes',
                    <textarea
                      id="next-steps-notes"
                      value={selectedPlan.data.nextStepsNotes}
                      rows={4}
                      onChange={(event) => patchData((data) => ({ ...data, nextStepsNotes: event.target.value }))}
                      className={`${inputClass} resize-y`}
                    />
                  )}
                </div>
                {sectionCompleteControl('nextSteps')}
              </div>
            </div>
          ) : null}

          {activeTab === 'eolWishes' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>End of Life Wishes</h3>
              <div className={`${warningBannerClass} mb-6`}>
                Recording wishes here does not replace legally required estate, healthcare, or disposition documents. This is a guide for your family, not a legal instrument.
              </div>
              <div className="space-y-8">
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('eol-disposition', 'Disposition'), {
                    collapseKey: 'eol-disposition',
                  })}
                  {collapseBody(
                    'eol-disposition',
                    renderGrid(
                      selectedPlan.data.eolWishes,
                      [
                        { kind: 'select', key: 'dispositionPreference', label: 'Burial / Cremation / Donation / Other preference', options: ['Burial', 'Cremation', 'Donation', 'Other'] },
                        { kind: 'text', key: 'funeralHome', label: 'Preferred funeral home' },
                        { kind: 'text', key: 'funeralHomeContact', label: 'Funeral home contact' },
                        { kind: 'text', key: 'cemetery', label: 'Cemetery' },
                        { kind: 'textarea', key: 'cemeteryPlot', label: 'Cemetery plot information', span: 2 },
                        { kind: 'text', key: 'paperworkLocation', label: 'Location of ownership paperwork' },
                      ],
                      (next) => patchData((data) => ({ ...data, eolWishes: next })),
                      'eol-disposition'
                    )
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('eol-service', 'Service Preferences'), {
                    collapseKey: 'eol-service',
                  })}
                  {collapseBody(
                    'eol-service',
                    renderGrid(
                      selectedPlan.data.eolWishes,
                      [
                        { kind: 'yesno', key: 'funeralServiceDesired', label: 'Funeral service desired?' },
                        { kind: 'yesno', key: 'memorialServiceDesired', label: 'Memorial service desired?' },
                        { kind: 'yesno', key: 'religiousService', label: 'Religious service?' },
                        { kind: 'text', key: 'clergy', label: 'Preferred clergy/officiant' },
                        { kind: 'yesno', key: 'viewing', label: 'Viewing?' },
                        { kind: 'text', key: 'casketPreference', label: 'Open/closed casket preference' },
                        { kind: 'text', key: 'preferredLocation', label: 'Preferred location' },
                        { kind: 'textarea', key: 'preferredMusic', label: 'Preferred music', span: 2 },
                        { kind: 'textarea', key: 'preferredReadings', label: 'Preferred readings', span: 2 },
                        { kind: 'textarea', key: 'preferredSpeakers', label: 'Preferred speakers', span: 2 },
                      ],
                      (next) => patchData((data) => ({ ...data, eolWishes: next })),
                      'eol-service'
                    )
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('eol-notify', 'Notifications & Remembrance'), {
                    collapseKey: 'eol-notify',
                  })}
                  {collapseBody(
                    'eol-notify',
                    renderGrid(
                      selectedPlan.data.eolWishes,
                      [
                        { kind: 'textarea', key: 'obituaryWishes', label: 'Obituary wishes', span: 2 },
                        { kind: 'textarea', key: 'peopleToNotify', label: 'People who should be notified', span: 2 },
                        { kind: 'textarea', key: 'organizationsToNotify', label: 'Organizations to notify', span: 2 },
                        { kind: 'text', key: 'flowersPreference', label: 'Flowers preference' },
                        { kind: 'text', key: 'memorialDonation', label: 'Memorial donation preference' },
                        { kind: 'textarea', key: 'pallbearerPreferences', label: 'Pallbearer preferences', span: 2 },
                      ],
                      (next) => patchData((data) => ({ ...data, eolWishes: next })),
                      'eol-notify'
                    )
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('eol-arrangements', 'Final Arrangements'), {
                    collapseKey: 'eol-arrangements',
                  })}
                  {collapseBody(
                    'eol-arrangements',
                    renderGrid(
                      selectedPlan.data.eolWishes,
                      [
                        { kind: 'text', key: 'clothingPreference', label: 'Clothing preference' },
                        { kind: 'text', key: 'militaryHonors', label: 'Military honors' },
                        { kind: 'textarea', key: 'headstoneWishes', label: 'Headstone/marker wishes', span: 2 },
                        { kind: 'textarea', key: 'ashesInstructions', label: 'Ashes instructions', span: 2 },
                        { kind: 'textarea', key: 'organDonationWishes', label: 'Organ/tissue donation wishes', span: 2 },
                        { kind: 'textarea', key: 'prepaidArrangements', label: 'Prepaid funeral arrangements', span: 2 },
                        { kind: 'text', key: 'funeralContractLocation', label: 'Location of funeral contracts' },
                      ],
                      (next) => patchData((data) => ({ ...data, eolWishes: next })),
                      'eol-arrangements'
                    )
                  )}
                </section>
                <div>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('eol-wishes-notes', 'Notes'), {
                    collapseKey: 'eol-wishes-notes',
                  })}
                  {collapseBody(
                    'eol-wishes-notes',
                    <textarea
                      id="eol-wishes-notes"
                      value={selectedPlan.data.eolWishesNotes}
                      rows={4}
                      onChange={(event) => patchData((data) => ({ ...data, eolWishesNotes: event.target.value }))}
                      className={`${inputClass} resize-y`}
                    />
                  )}
                </div>
                {sectionCompleteControl('eolWishes')}
              </div>
            </div>
          ) : null}

          {activeTab === 'myWishes' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>My Wishes</h3>
              <div className={`${warningBannerClass} mb-6`}>
                Personal wishes entered here may not constitute a legally enforceable transfer of property. Use formal estate documents for legally binding gifts.
              </div>
              <div className="space-y-8">
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('my-wishes-matter', 'What Matters'), {
                    collapseKey: 'my-wishes-matter',
                  })}
                  {collapseBody(
                    'my-wishes-matter',
                    renderWishQuestions(['mostImportant', 'familyToKnow', 'traditions', 'thankedRemembered', 'doNotWant'])
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('my-wishes-giving', 'Belongings & Giving'), {
                    collapseKey: 'my-wishes-giving',
                  })}
                  {collapseBody(
                    'my-wishes-giving',
                    renderWishQuestions([
                      'specialBelongings',
                      'specificGifts',
                      'charitableWishes',
                      'importantOrganizations',
                      'collections',
                    ])
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('my-wishes-digital', 'Care & Digital Life'), {
                    collapseKey: 'my-wishes-digital',
                  })}
                  {collapseBody(
                    'my-wishes-digital',
                    renderWishQuestions([
                      'petsCare',
                      'socialMedia',
                      'digitalMedia',
                      'personalFiles',
                      'phoneComputer',
                      'onlinePresence',
                    ])
                  )}
                </section>
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('my-wishes-items', 'Personal Property'), {
                    collapseKey: 'my-wishes-items',
                    addLabel: 'Add Personal Item',
                    onAdd: () => {
                      if (isSubsectionInactive('my-wishes-items')) toggleSubsection('my-wishes-items');
                      requestFamilyAdd('items');
                    },
                  })}
                  {collapseBody(
                    'my-wishes-items',
                    renderPersonalItems('items', selectedPlan.data.myWishes.personalItems, (next, immediate) =>
                      patchData((data) => ({ ...data, myWishes: { ...data.myWishes, personalItems: next } }), immediate)
                    )
                  )}
                </section>
                <div>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('my-wishes-notes', 'Notes'), {
                    collapseKey: 'my-wishes-notes',
                  })}
                  {collapseBody(
                    'my-wishes-notes',
                    <textarea
                      id="my-wishes-notes"
                      value={selectedPlan.data.myWishesNotes}
                      rows={4}
                      onChange={(event) => patchData((data) => ({ ...data, myWishesNotes: event.target.value }))}
                      className={`${inputClass} resize-y`}
                    />
                  )}
                </div>
                {sectionCompleteControl('myWishes')}
              </div>
            </div>
          ) : null}

          {activeTab === 'letters' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Letters</h3>
              <div className="space-y-8">
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('letters-list', 'Letters'), {
                    collapseKey: 'letters-list',
                    addLabel: 'Add Letter',
                    onAdd: () => {
                      if (isSubsectionInactive('letters-list')) toggleSubsection('letters-list');
                      requestFamilyAdd('letters');
                    },
                  })}
                  {collapseBody(
                    'letters-list',
                    renderLetters('letters', selectedPlan.data.letters, (next, immediate) =>
                      patchData((data) => ({ ...data, letters: next }), immediate)
                    )
                  )}
                </section>
                <div>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('letters-notes', 'Notes'), {
                    collapseKey: 'letters-notes',
                  })}
                  {collapseBody(
                    'letters-notes',
                    <textarea
                      id="letters-notes"
                      value={selectedPlan.data.lettersNotes}
                      rows={4}
                      onChange={(event) => patchData((data) => ({ ...data, lettersNotes: event.target.value }))}
                      className={`${inputClass} resize-y`}
                    />
                  )}
                </div>
                {sectionCompleteControl('letters')}
              </div>
            </div>
          ) : null}

          {activeTab === 'other' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Other</h3>
              <div className="space-y-8">
                <section>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('other-list', 'Records'), {
                    collapseKey: 'other-list',
                    addLabel: 'Add Custom Record',
                    onAdd: () => {
                      if (isSubsectionInactive('other-list')) toggleSubsection('other-list');
                      requestFamilyAdd('other');
                    },
                  })}
                  {collapseBody(
                    'other-list',
                    renderOther('other', selectedPlan.data.otherRecords, (next, immediate) =>
                      patchData((data) => ({ ...data, otherRecords: next }), immediate)
                    )
                  )}
                </section>
                <div>
                  {sectionRule()}
                  {subsectionHeading(personalBlockTitle('other-notes', 'Notes'), {
                    collapseKey: 'other-notes',
                  })}
                  {collapseBody(
                    'other-notes',
                    <textarea
                      id="other-notes"
                      value={selectedPlan.data.otherNotes}
                      rows={4}
                      onChange={(event) => patchData((data) => ({ ...data, otherNotes: event.target.value }))}
                      className={`${inputClass} resize-y`}
                    />
                  )}
                </div>
                {sectionCompleteControl('other')}
              </div>
            </div>
          ) : null}

          {customSection ? renderCustomSection(customSection) : null}

          {activeTab === 'export' ? (
            <div className="space-y-6">
              <div className={cardClass}>
                <h3 className={sectionTitleClass}>Export End of Life Planner Report</h3>
                <p className={`${isLight ? 'text-slate-700' : 'text-slate-300'} mb-4`}>
                  Generate a PDF of the selected plan, including all sections, notes, and a completion summary. PDF generation will be added in a later update.
                </p>
                <button type="button" onClick={() => setShowExportPopup(true)} className={primaryButtonClass}>
                  Generate PDF Report
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {archiveConfirmPlanId ? (
        <div className={overlayClass}>
          <div className={modalCardClass} role="dialog" aria-modal="true" aria-labelledby="eolp-archive-title">
            <h3 id="eolp-archive-title" className={isLight ? 'text-xl font-semibold text-slate-900 mb-2' : 'text-xl font-semibold text-slate-50 mb-2'}>
              Archive Plan
            </h3>
            <p className={isLight ? 'text-slate-700 mb-4' : 'text-slate-300 mb-4'}>
              Archive “{plans.find((item) => item.id === archiveConfirmPlanId)?.name || 'this plan'}”? The plan and its data stay available under Show archived plans.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  applyArchivePlan(archiveConfirmPlanId, true);
                  setArchiveConfirmPlanId(null);
                }}
                className={`flex-1 ${primaryButtonClass}`}
              >
                Archive
              </button>
              <button
                type="button"
                onClick={() => setArchiveConfirmPlanId(null)}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className={overlayClass}>
          <div className={modalCardClass}>
            <h3 className={isLight ? 'text-xl font-semibold text-slate-900 mb-2' : 'text-xl font-semibold text-slate-50 mb-2'}>
              {deleteTarget.kind === 'plan'
                ? 'Delete Plan'
                : deleteTarget.kind === 'section'
                  ? 'Delete Section'
                  : 'Delete Record'}
            </h3>
            <div className={deleteWarningBoxClass}>
              <p className={deleteWarningTextClass}>⚠️ Warning: This action cannot be undone!</p>
              <p className={deleteWarningDetailClass}>
                {deleteTarget.kind === 'plan'
                  ? `This will permanently delete “${deleteTarget.label}” and all of its section data.`
                  : deleteTarget.kind === 'section'
                    ? deleteTarget.custom
                      ? `This will permanently delete the “${deleteTarget.label}” section and its records.`
                      : `This will remove “${deleteTarget.label}” from this plan.`
                    : `This ${deleteTarget.label} will be permanently deleted.`}
              </p>
            </div>
            <p className={isLight ? 'text-slate-700 mb-4' : 'text-slate-300 mb-4'}>
              To confirm, type <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>delete</strong> below.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder="Type 'delete' to confirm"
              className={deleteInputClass}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmText('');
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {renamingSectionId ? (
        <div className={overlayClass}>
          <div className={modalCardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>Rename Section</h3>
              <button type="button" onClick={() => setRenamingSectionId(null)} className={iconButtonClass} aria-label="Close modal" title="Close modal">
                <OutlineIcon d={ICON.close} />
              </button>
            </div>
            <label htmlFor="rename-section" className={labelClass}>
              Section name
            </label>
            <input id="rename-section" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} className={inputClass} />
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={saveRenameSection} disabled={!renameValue.trim()} className={primaryButtonClass}>
                Save
              </button>
              <button type="button" onClick={() => setRenamingSectionId(null)} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showExportPopup ? (
        <div className={overlayClass}>
          <div className={modalCardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>Export Options</h3>
              <button type="button" onClick={() => setShowExportPopup(false)} className={iconButtonClass} aria-label="Close modal" title="Close modal">
                <OutlineIcon d={ICON.close} />
              </button>
            </div>
            <p className={`${mutedTextClass} text-sm mb-4`}>PDF export is not available in this pass. Closing this dialog will not generate a file.</p>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowExportPopup(false)} className={`flex-1 ${primaryButtonClass}`}>
                Export to PDF
              </button>
              <button type="button" onClick={() => setShowExportPopup(false)} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}