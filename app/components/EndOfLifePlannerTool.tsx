'use client';

/**
 * End of Life Planner — UI-only first pass.
 * Accepts toolId for later API wiring. Persistence is localStorage until
 * /api/tools/end-of-life-planner and tools_eol_* exist.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTheme } from './AppThemeProvider';
import {
  ACCOUNT_DISPOSITIONS,
  BANK_ACCOUNT_TYPES,
  CONTACT_TYPES,
  copyName,
  createEolId,
  createPlan,
  customSectionPercent,
  DEBT_TYPES,
  DEVICE_TYPES,
  DOCUMENT_TYPES,
  duplicateListItem,
  emptyBankAccount,
  emptyContact,
  emptyCreditCard,
  emptyCustomField,
  emptyCustomRecord,
  emptyCustomSection,
  emptyDebt,
  emptyDevice,
  emptyDocumentNote,
  emptyFamilyPerson,
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
  EolBuiltInSectionId,
  EolContact,
  EolCustomRecord,
  EolCustomSection,
  EolCustomTemplate,
  EolDevice,
  EolDocumentNote,
  EolFamilyPerson,
  EolInsurancePolicy,
  EolLetter,
  EolOnlineAccount,
  EolPlan,
  EolPlanData,
  EolRelationship,
  formatDateDisplay,
  formatDateTimeDisplay,
  HOME_PROVIDER_TYPES,
  INCOME_TYPES,
  INVESTMENT_TYPES,
  LETTER_TYPES,
  loadEolDraft,
  maskSecret,
  MY_WISHES_QUESTIONS,
  nowIso,
  ONLINE_CATEGORIES,
  overallPlanPercent,
  PASSWORD_MANAGERS,
  planSectionProgress,
  POLICY_TYPES,
  removeListItem,
  reorderList,
  replaceListItem,
  saveEolDraft,
  secretText,
  sortContacts,
  touchPlan,
  UTILITY_TYPES,
  withSecret,
} from '@/lib/end-of-life-planner';

type EndOfLifePlannerToolProps = {
  toolId?: string;
};

type TabId = EolBuiltInSectionId | 'export' | `custom:${string}`;

type DeleteTarget =
  | { kind: 'plan'; id: string; label: string }
  | { kind: 'record'; label: string; onConfirm: () => void }
  | { kind: 'custom-tab'; id: string; label: string };

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
};

const ICON = {
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  archive:
    'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  restore: 'M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  up: 'M5 15l7-7 7 7',
  down: 'M19 9l-7 7-7-7',
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

export function EndOfLifePlannerTool({ toolId: _toolId }: EndOfLifePlannerToolProps) {
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
  const tabStripClass = isLight ? 'border-b-2 border-slate-300' : 'border-b border-slate-800';
  const tabActiveClass = isLight
    ? 'border-b-2 border-emerald-600 text-emerald-900 font-semibold'
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
  const [activeTab, setActiveTab] = useState<TabId>('personal');
  const [addingKey, setAddingKey] = useState<AddingKey>(null);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [revealedLetters, setRevealedLetters] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customTemplate, setCustomTemplate] = useState<EolCustomTemplate>('contacts');
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const persistTimer = useRef<number | null>(null);
  const selectedPlanIdRef = useRef<string | null>(null);
  selectedPlanIdRef.current = selectedPlanId;

  const persist = useCallback((nextPlans: EolPlan[], nextSelected: string | null, immediate: boolean) => {
    const write = () => {
      try {
        saveEolDraft({ version: 1, plans: nextPlans, selectedPlanId: nextSelected });
        setSaveStatus('saved');
        window.setTimeout(() => {
          setSaveStatus((current) => (current === 'saved' ? 'idle' : current));
        }, 3000);
      } catch {
        setSaveStatus('error');
      }
    };
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    setSaveStatus('saving');
    if (immediate) {
      write();
      return;
    }
    persistTimer.current = window.setTimeout(write, 700);
  }, []);

  useEffect(() => {
    const draft = loadEolDraft();
    setPlans(draft.plans);
    setSelectedPlanId(draft.selectedPlanId);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (deleteTarget) {
        setDeleteTarget(null);
        setDeleteConfirmText('');
        return;
      }
      if (showExportPopup) {
        setShowExportPopup(false);
        return;
      }
      if (showCustomModal) {
        setShowCustomModal(false);
        return;
      }
      if (renamingSectionId) {
        setRenamingSectionId(null);
        return;
      }
      if (menuOpenPlanId) setMenuOpenPlanId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteTarget, showExportPopup, showCustomModal, renamingSectionId, menuOpenPlanId]);

  const visiblePlans = useMemo(
    () => plans.filter((plan) => showArchived || plan.status === 'Active'),
    [plans, showArchived]
  );

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || null;
  const progress = selectedPlan ? planSectionProgress(selectedPlan) : [];
  const overall = selectedPlan ? overallPlanPercent(selectedPlan) : 0;

  const commitPlans = useCallback(
    (nextPlans: EolPlan[], options?: { selectedId?: string | null; immediate?: boolean }) => {
      const nextSelected = options?.selectedId !== undefined ? options.selectedId : selectedPlanIdRef.current;
      setPlans(nextPlans);
      if (options?.selectedId !== undefined) setSelectedPlanId(options.selectedId);
      persist(nextPlans, nextSelected, Boolean(options?.immediate));
    },
    [persist]
  );

  const patchSelected = useCallback(
    (updater: (plan: EolPlan) => EolPlan, immediate = false) => {
      const currentId = selectedPlanIdRef.current;
      if (!currentId) return;
      setPlans((prev) => {
        const next = prev.map((plan) => (plan.id === currentId ? touchPlan(updater(plan)) : plan));
        persist(next, currentId, immediate);
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

  const createNewPlan = () => {
    if (!newPlanName.trim() || !newPersonName.trim()) {
      setFormError('Plan name and person’s full name are required.');
      return;
    }
    const plan = createPlan({
      name: newPlanName,
      personFullName: newPersonName,
      relationship: newRelationship,
      relationshipCustom: newRelationshipCustom,
      dateOfBirth: newDob,
      card_color: newColor,
    });
    const next = [...plans, plan];
    setIsCreatingPlan(false);
    setFormError('');
    setActiveTab('personal');
    commitPlans(next, { selectedId: plan.id, immediate: true });
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
        ? touchPlan({
            ...plan,
            name: editName.trim(),
            personFullName: editPersonName.trim(),
            relationship: editRelationship,
            relationshipCustom: editRelationshipCustom.trim(),
            dateOfBirth: editDob,
            card_color: editColor,
          })
        : plan
    );
    setEditingPlanId(null);
    setFormError('');
    commitPlans(next, { immediate: true });
  };

  const archivePlan = (id: string, archived: boolean) => {
    const next = plans.map((plan) =>
      plan.id === id ? touchPlan({ ...plan, status: archived ? 'Archived' : 'Active' }) : plan
    );
    setMenuOpenPlanId(null);
    const shouldDeselect = archived && selectedPlanId === id && !showArchived;
    commitPlans(next, { selectedId: shouldDeselect ? null : selectedPlanId, immediate: true });
  };

  const confirmDelete = () => {
    if (!deleteTarget || deleteConfirmText.toLowerCase() !== 'delete') return;
    if (deleteTarget.kind === 'plan') {
      const next = plans.filter((plan) => plan.id !== deleteTarget.id);
      commitPlans(next, {
        selectedId: selectedPlanId === deleteTarget.id ? null : selectedPlanId,
        immediate: true,
      });
    } else if (deleteTarget.kind === 'custom-tab') {
      patchData((data) => ({
        ...data,
        customSections: data.customSections.filter((section) => section.id !== deleteTarget.id),
      }), true);
      if (activeTab === `custom:${deleteTarget.id}`) setActiveTab('other');
    } else {
      deleteTarget.onConfirm();
    }
    setDeleteTarget(null);
    setDeleteConfirmText('');
  };

  const addCustomSection = () => {
    if (!customName.trim()) {
      setFormError('Section name is required.');
      return;
    }
    const section = emptyCustomSection(customName.trim(), customTemplate);
    patchData((data) => ({ ...data, customSections: [...data.customSections, section] }), true);
    setShowCustomModal(false);
    setCustomName('');
    setFormError('');
    setActiveTab(`custom:${section.id}`);
  };

  const saveRenameSection = () => {
    if (!renamingSectionId || !renameValue.trim()) return;
    patchData((data) => ({
      ...data,
      customSections: data.customSections.map((section) =>
        section.id === renamingSectionId ? { ...section, name: renameValue.trim() } : section
      ),
    }), true);
    setRenamingSectionId(null);
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
              aria-label={shown ? 'Hide value' : 'Show value'}
              title={shown ? 'Hide value' : 'Show value'}
            >
              <OutlineIcon d={shown ? ICON.eyeOff : ICON.eye} />
            </button>
          </div>
        ) : (
          <input
            id={id}
            type={spec.kind === 'date' ? 'date' : spec.kind === 'number' ? 'number' : 'text'}
            min={spec.kind === 'number' ? spec.min : undefined}
            value={value}
            onChange={(event) => onChange(writeFieldValue(record, spec, event.target.value))}
            className={inputClass}
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

  const familyList = (
    listKey: string,
    records: EolFamilyPerson[],
    addLabel: string,
    onCommit: (next: EolFamilyPerson[], immediate?: boolean) => void
  ) => (
    <div className="md:col-span-2 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className={isLight ? 'text-sm font-medium text-slate-800' : 'text-sm font-medium text-slate-200'}>
          {addLabel.replace('+ Add New ', '')}
        </h4>
        {addingKey !== listKey ? (
          <button type="button" className={primaryButtonClass} onClick={() => startAdd(listKey, emptyFamilyPerson())}>
            {addLabel}
          </button>
        ) : null}
      </div>
      {addingKey === listKey && drafts[listKey] ? (
        <div className={nestedCardClass}>
          {renderGrid(
            drafts[listKey] as EolFamilyPerson,
            [
              { kind: 'text', key: 'name', label: 'Name' },
              { kind: 'text', key: 'notes', label: 'Notes' },
            ],
            (next) => setDraft(listKey, next),
            `${listKey}-new`
          )}
          <div className="flex gap-3 mt-3">
            <button
              type="button"
              className={primaryButtonClass}
              disabled={!(drafts[listKey] as EolFamilyPerson).name.trim()}
              onClick={() => {
                onCommit([...records, drafts[listKey] as EolFamilyPerson], true);
                setAddingKey(null);
              }}
            >
              Add
            </button>
            <button type="button" className={secondaryButtonClass} onClick={cancelAdd}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {records.map((person, index) => (
        <div key={person.id} className={`${nestedCardClass} flex items-start justify-between`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
            <div>
              <label htmlFor={`${listKey}-${person.id}-name`} className={labelClass}>
                Name
              </label>
              <input
                id={`${listKey}-${person.id}-name`}
                value={person.name}
                onChange={(event) =>
                  onCommit(replaceListItem(records, person.id, { ...person, name: event.target.value }))
                }
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor={`${listKey}-${person.id}-notes`} className={labelClass}>
                Notes
              </label>
              <input
                id={`${listKey}-${person.id}-notes`}
                value={person.notes}
                onChange={(event) =>
                  onCommit(replaceListItem(records, person.id, { ...person, notes: event.target.value }))
                }
                className={inputClass}
              />
            </div>
          </div>
          {recordActions(person.id, {
            onEdit: () => setEditingId(`${listKey}:${person.id}`),
            onDuplicate: () =>
              onCommit(
                duplicateListItem(records, person.id, (item, id) => ({ ...item, id, name: copyName(item.name) })),
                true
              ),
            onUp: () => onCommit(reorderList(records, person.id, -1), true),
            onDown: () => onCommit(reorderList(records, person.id, 1), true),
            disableUp: index === 0,
            disableDown: index === records.length - 1,
            onDelete: () =>
              setDeleteTarget({
                kind: 'record',
                label: 'family member',
                onConfirm: () => onCommit(removeListItem(records, person.id), true),
              }),
          })}
        </div>
      ))}
    </div>
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

  const renderContacts = (
    listKey: string,
    records: EolContact[],
    onCommit: (next: EolContact[], immediate?: boolean) => void
  ) => (
    <RecordList chrome={listChrome}
      listKey={listKey}
      records={sortContacts(records)}
      addLabel="+ Add New Contact"
      emptyText="No contacts yet. Add one to get started."
      requiredValue={(draft) => Boolean(draft.name.trim())}
      titleOf={(item) => item.name}
      summaryOf={(item) =>
        [item.contactType, item.relationship, item.phone, item.email].filter(Boolean).join(' · ') || 'No details yet'
      }
      fields={contactFields}
      createDraft={emptyContact}
      cloneItem={(item, id) => ({ ...item, id, name: copyName(item.name) })}
      deleteLabel="contact"
      onCommit={(next) =>
        onCommit(
          next.map((item, index) => ({ ...item, priority: index + 1 })),
          true
        )
      }
    />
  );

  const renderDevices = (
    listKey: string,
    records: EolDevice[],
    onCommit: (next: EolDevice[], immediate?: boolean) => void
  ) => (
    <RecordList chrome={listChrome}
      listKey={listKey}
      records={records}
      addLabel="+ Add New Device"
      emptyText="No devices yet. Add one to get started."
      requiredValue={(draft) => Boolean(draft.name.trim())}
      titleOf={(item) => item.name}
      summaryOf={(item) =>
        [item.deviceType, item.location, secretText(item.pin) ? 'PIN stored' : ''].filter(Boolean).join(' · ') ||
        'No details yet'
      }
      fields={deviceFields}
      extra={() => secretHelper}
      createDraft={emptyDevice}
      cloneItem={(item, id) => ({ ...item, id, name: copyName(item.name) })}
      deleteLabel="device"
      onCommit={onCommit}
    />
  );

  const renderOnline = (
    listKey: string,
    records: EolOnlineAccount[],
    onCommit: (next: EolOnlineAccount[], immediate?: boolean) => void
  ) => (
    <RecordList chrome={listChrome}
      listKey={listKey}
      records={records}
      addLabel="+ Add New Online Account"
      emptyText="No online accounts yet. Add one to get started."
      requiredValue={(draft) => Boolean(draft.serviceName.trim())}
      titleOf={(item) => item.serviceName}
      summaryOf={(item) =>
        [item.category, item.username, item.passwordStoredElsewhere, maskSecret(secretText(item.password))]
          .filter(Boolean)
          .join(' · ') || 'No details yet'
      }
      fields={onlineFields}
      extra={() => (
        <div className="space-y-2">
          {secretHelper}
          <p className={helperClass}>You can point to a password manager instead of storing the password here.</p>
        </div>
      )}
      createDraft={emptyOnlineAccount}
      cloneItem={(item, id) => ({ ...item, id, serviceName: copyName(item.serviceName) })}
      deleteLabel="online account"
      onCommit={onCommit}
    />
  );

  const renderDocuments = (
    listKey: string,
    records: EolDocumentNote[],
    onCommit: (next: EolDocumentNote[], immediate?: boolean) => void
  ) => (
    <RecordList chrome={listChrome}
      listKey={listKey}
      records={records}
      addLabel="+ Add New Document"
      emptyText="No document notes yet. Add one to get started."
      requiredValue={(draft) => Boolean(draft.name.trim())}
      titleOf={(item) => item.name}
      summaryOf={(item) =>
        [item.documentType, item.physicalLocation, item.dateCreated ? formatDateDisplay(item.dateCreated) : '']
          .filter(Boolean)
          .join(' · ') || 'No details yet'
      }
      fields={documentFields}
      extra={() => (
        <div>
          <label htmlFor={`${listKey}-link`} className={labelClass}>
            Link an existing Important Document
          </label>
          <select id={`${listKey}-link`} disabled className={`${selectClass} opacity-60 cursor-not-allowed`}>
            <option>Not available yet</option>
          </select>
          <p className={helperClass}>Linking to the Important Documents tool will be added in a later update.</p>
        </div>
      )}
      createDraft={emptyDocumentNote}
      cloneItem={(item, id) => ({ ...item, id, name: copyName(item.name) })}
      deleteLabel="document note"
      onCommit={onCommit}
    />
  );

  const renderInsurance = (
    listKey: string,
    records: EolInsurancePolicy[],
    onCommit: (next: EolInsurancePolicy[], immediate?: boolean) => void
  ) => (
    <RecordList chrome={listChrome}
      listKey={listKey}
      records={records}
      addLabel="+ Add New Policy"
      emptyText="No policies yet. Add one to get started."
      requiredValue={(draft) => Boolean(draft.company.trim())}
      titleOf={(item) => item.company}
      summaryOf={(item) => [item.policyType, item.policyNumber, item.beneficiary].filter(Boolean).join(' · ') || 'No details yet'}
      fields={insuranceFields}
      createDraft={emptyInsurancePolicy}
      cloneItem={(item, id) => ({ ...item, id, company: copyName(item.company) })}
      deleteLabel="policy"
      onCommit={onCommit}
    />
  );

  const renderLetters = (
    listKey: string,
    records: EolLetter[],
    onCommit: (next: EolLetter[], immediate?: boolean) => void
  ) => (
    <RecordList chrome={listChrome}
      listKey={listKey}
      records={records}
      addLabel="+ Add New Letter"
      emptyText="No letters yet. Add one to get started."
      requiredValue={(draft) => Boolean(draft.title.trim())}
      titleOf={(item) => item.title}
      summaryOf={(item) => (
        <span className="flex flex-wrap items-center gap-2">
          <span>{[item.recipient, item.letterType, item.status].filter(Boolean).join(' · ')}</span>
          {item.visibility === 'Private' ? (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${statusBadgeClass('In progress', isLight)}`}>
              <OutlineIcon d={ICON.lock} className="h-3.5 w-3.5" />
              Private
            </span>
          ) : null}
          <span>Updated {formatDateTimeDisplay(item.lastUpdated)}</span>
        </span>
      )}
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
      createDraft={emptyLetter}
      cloneItem={(item, id) => ({ ...item, id, title: copyName(item.title), lastUpdated: nowIso() })}
      deleteLabel="letter"
      onCommit={onCommit}
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
    <RecordList chrome={listChrome}
      listKey={listKey}
      records={records}
      addLabel="+ Add New Custom Record"
      emptyText="No custom records yet. Add one to get started."
      requiredValue={(draft) => Boolean(draft.title.trim())}
      titleOf={(item) => item.title}
      summaryOf={(item) => [item.category, item.location, item.importantDate ? formatDateDisplay(item.importantDate) : ''].filter(Boolean).join(' · ') || 'No details yet'}
      fields={otherFields}
      extra={otherExtra}
      createDraft={emptyCustomRecord}
      cloneItem={(item, id) => ({
        ...item,
        id,
        title: copyName(item.title),
        customFields: item.customFields.map((field) => ({ ...field, id: createEolId('cfield'), label: field.label, value: field.value })),
      })}
      deleteLabel="custom record"
      onCommit={onCommit}
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
            <h3 className={sectionTitleClass}>{section.name}</h3>
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
                onClick={() => setDeleteTarget({ kind: 'custom-tab', id: section.id, label: section.name })}
              >
                Delete section
              </button>
            </div>
          </div>
          <p className={`${mutedTextClass} text-sm mb-4`}>
            Modeled after {EOL_CUSTOM_TEMPLATES.find((item) => item.id === section.modeledAfter)?.label}. Completion:{' '}
            {customSectionPercent(section)}%
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
  const tabs: { id: TabId; label: string; percent?: number; complete?: boolean; custom?: boolean }[] = [
    ...EOL_BUILT_IN_TABS.map((tab) => {
      const item = progress.find((entry) => entry.id === tab.id);
      return { id: tab.id as TabId, label: tab.label, percent: item?.percent, complete: item?.status === 'Complete' };
    }),
    ...(selectedPlan?.data.customSections || []).map((section) => {
      const item = progress.find((entry) => entry.id === section.id);
      return {
        id: `custom:${section.id}` as TabId,
        label: section.name,
        percent: item?.percent,
        complete: item?.status === 'Complete',
        custom: true,
      };
    }),
    { id: 'export', label: 'Export' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className={titleClass}>{EOL_TOOL_TITLE}</h2>
        <p className={descClass}>{EOL_TOOL_DESCRIPTION}</p>
      </div>

      {saveStatus === 'saving' ? <div className={successBannerClass}>Saving…</div> : null}
      {saveStatus === 'saved' ? <div className={successBannerClass}>Saved</div> : null}
      {saveStatus === 'error' ? (
        <div className={errorBannerClass}>Draft could not be saved to this browser. Try again, or copy important notes elsewhere.</div>
      ) : null}
      {formError ? <div className={errorBannerClass}>{formError}</div> : null}

      <div className={cardCompactClass}>
        <label className={isLight ? 'block text-sm font-medium text-slate-700 mb-3' : 'block text-sm font-medium text-slate-300 mb-3'}>
          Select a Plan
        </label>
        {!isCreatingPlan ? (
          <>
            <div className="flex items-center gap-3 flex-wrap">
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
                        persist(plans, plan.id, true);
                        setActiveTab('personal');
                      }}
                      className={`px-4 py-3 rounded-lg border transition-all duration-200 min-w-[120px] ${
                        selectedPlanId === plan.id ? 'shadow-lg' : 'hover:border-slate-600'
                      }`}
                      style={{
                        borderColor: plan.card_color || '#10b981',
                        backgroundColor:
                          selectedPlanId === plan.id ? `${plan.card_color || '#10b981'}15` : `${plan.card_color || '#10b981'}08`,
                        color: plan.card_color || '#10b981',
                      }}
                    >
                      <div className="font-medium text-center">{plan.name}</div>
                      {plan.status === 'Archived' ? <div className="text-xs mt-1 opacity-80">Archived</div> : null}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuOpenPlanId(menuOpenPlanId === plan.id ? null : plan.id);
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
            <label className={`mt-4 inline-flex items-center gap-2 text-sm ${mutedTextClass}`}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
                className="h-4 w-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500"
              />
              Show archived plans
            </label>
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

      {menuOpenPlanId ? <div className="fixed inset-0 z-40" onClick={() => setMenuOpenPlanId(null)} /> : null}

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
          <div className={cardClass}>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
              <div>
                <p className={isLight ? 'text-sm font-medium text-slate-600' : 'text-sm font-medium text-slate-400'}>Overall completion</p>
                <p className={isLight ? 'text-3xl font-semibold text-slate-900' : 'text-3xl font-semibold text-slate-50'}>{overall}%</p>
              </div>
              <div className="text-right">
                <p className={isLight ? 'text-sm font-medium text-slate-600' : 'text-sm font-medium text-slate-400'}>Last updated</p>
                <p className={isLight ? 'text-xl font-semibold text-slate-900' : 'text-xl font-semibold text-slate-50'}>
                  {formatDateTimeDisplay(selectedPlan.lastUpdated)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {progress.map((item) => (
                <span
                  key={item.id}
                  className={`px-2 py-1 rounded text-xs font-medium border ${statusBadgeClass(item.status, isLight)}`}
                >
                  {item.label}: {item.status} ({item.percent}%)
                </span>
              ))}
            </div>
          </div>

          <div className={tabStripClass}>
            <div className="flex items-center gap-2 overflow-x-auto">
              <div className={`px-4 py-2 text-[18px] font-medium whitespace-nowrap ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                {selectedPlan.name}:
              </div>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id ? tabActiveClass : tabInactiveClass
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {tab.label}
                    {tab.id !== 'export' ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          tab.complete ? 'bg-emerald-500' : isLight ? 'bg-slate-400' : 'bg-slate-500'
                        }`}
                        aria-hidden
                      />
                    ) : null}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setShowCustomModal(true);
                  setCustomName('');
                  setCustomTemplate('contacts');
                  setFormError('');
                }}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${isLight ? 'text-emerald-800 hover:text-emerald-950' : 'text-emerald-300 hover:text-emerald-200'}`}
              >
                + Add Custom Section
              </button>
            </div>
          </div>

          {activeTab === 'personal' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Personal Record</h3>
              <div className="space-y-8">
                <section>
                  <h3 className={subsectionClass}>Personal Information</h3>
                  {renderGrid(
                    selectedPlan.data.personal,
                    [
                      { kind: 'text', key: 'fullLegalName', label: 'Full legal name' },
                      { kind: 'text', key: 'preferredName', label: 'Preferred name' },
                      { kind: 'text', key: 'previousNames', label: 'Previous/maiden names' },
                      { kind: 'date', key: 'dateOfBirth', label: 'Date of birth' },
                      { kind: 'text', key: 'placeOfBirth', label: 'Place of birth' },
                      { kind: 'secret', key: 'ssn', label: 'Social Security number' },
                      { kind: 'text', key: 'maritalStatus', label: 'Marital status' },
                      { kind: 'text', key: 'spousePartner', label: 'Spouse/partner' },
                      { kind: 'textarea', key: 'homeAddress', label: 'Home address', span: 2 },
                      { kind: 'text', key: 'phone', label: 'Phone' },
                      { kind: 'text', key: 'personalEmail', label: 'Personal email' },
                    ],
                    (next) => patchData((data) => ({ ...data, personal: next })),
                    'personal-info'
                  )}
                  {secretHelper}
                </section>
                <section>
                  <h3 className={subsectionClass}>Identification</h3>
                  {renderGrid(
                    selectedPlan.data.personal,
                    [
                      { kind: 'secret', key: 'driversLicenseNumber', label: 'Driver’s license number' },
                      { kind: 'text', key: 'driversLicenseState', label: 'Driver’s license state' },
                      { kind: 'secret', key: 'passportNumber', label: 'Passport number' },
                      { kind: 'date', key: 'passportExpiration', label: 'Passport expiration' },
                      { kind: 'textarea', key: 'otherIdentification', label: 'Other identification', span: 2 },
                    ],
                    (next) => patchData((data) => ({ ...data, personal: next })),
                    'personal-id'
                  )}
                  {secretHelper}
                </section>
                <section>
                  <h3 className={subsectionClass}>Employment</h3>
                  {renderGrid(
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
                  )}
                </section>
                <section>
                  <h3 className={subsectionClass}>Military Information</h3>
                  {renderGrid(
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
                  )}
                </section>
                <section>
                  <h3 className={subsectionClass}>Family Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="family-spouse" className={labelClass}>
                        Spouse
                      </label>
                      <input
                        id="family-spouse"
                        value={selectedPlan.data.personal.familySpouse}
                        onChange={(event) =>
                          patchData((data) => ({
                            ...data,
                            personal: { ...data.personal, familySpouse: event.target.value },
                          }))
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="family-emergency" className={labelClass}>
                        Emergency family contact
                      </label>
                      <input
                        id="family-emergency"
                        value={selectedPlan.data.personal.emergencyFamilyContact}
                        onChange={(event) =>
                          patchData((data) => ({
                            ...data,
                            personal: { ...data.personal, emergencyFamilyContact: event.target.value },
                          }))
                        }
                        className={inputClass}
                      />
                    </div>
                    {familyList('children', selectedPlan.data.personal.children, '+ Add New Child', (next, immediate) =>
                      patchData((data) => ({ ...data, personal: { ...data.personal, children: next } }), immediate)
                    )}
                    {familyList('parents', selectedPlan.data.personal.parents, '+ Add New Parent', (next, immediate) =>
                      patchData((data) => ({ ...data, personal: { ...data.personal, parents: next } }), immediate)
                    )}
                    {familyList('dependents', selectedPlan.data.personal.dependents, '+ Add New Dependent', (next, immediate) =>
                      patchData((data) => ({ ...data, personal: { ...data.personal, dependents: next } }), immediate)
                    )}
                  </div>
                </section>
                {sectionNotes('personal-notes', selectedPlan.data.personalNotes, (notes) =>
                  patchData((data) => ({ ...data, personalNotes: notes }))
                )}
              </div>
            </div>
          ) : null}

          {activeTab === 'contacts' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Important Contacts</h3>
              {renderContacts('contacts', selectedPlan.data.contacts, (next, immediate) =>
                patchData((data) => ({ ...data, contacts: next }), immediate)
              )}
              {sectionNotes('contacts-notes', selectedPlan.data.contactsNotes, (notes) =>
                patchData((data) => ({ ...data, contactsNotes: notes }))
              )}
            </div>
          ) : null}

          {activeTab === 'devices' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Device Login</h3>
              {renderDevices('devices', selectedPlan.data.devices, (next, immediate) =>
                patchData((data) => ({ ...data, devices: next }), immediate)
              )}
              {sectionNotes('devices-notes', selectedPlan.data.devicesNotes, (notes) =>
                patchData((data) => ({ ...data, devicesNotes: notes }))
              )}
            </div>
          ) : null}

          {activeTab === 'online' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Online Login</h3>
              {renderOnline('online', selectedPlan.data.onlineAccounts, (next, immediate) =>
                patchData((data) => ({ ...data, onlineAccounts: next }), immediate)
              )}
              {sectionNotes('online-notes', selectedPlan.data.onlineNotes, (notes) =>
                patchData((data) => ({ ...data, onlineNotes: notes }))
              )}
            </div>
          ) : null}

          {activeTab === 'documents' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Important Document Notes</h3>
              {renderDocuments('documents', selectedPlan.data.documents, (next, immediate) =>
                patchData((data) => ({ ...data, documents: next }), immediate)
              )}
              {sectionNotes('documents-notes', selectedPlan.data.documentsNotes, (notes) =>
                patchData((data) => ({ ...data, documentsNotes: notes }))
              )}
            </div>
          ) : null}

          {activeTab === 'insurance' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Insurance Information</h3>
              {renderInsurance('insurance', selectedPlan.data.insurance, (next, immediate) =>
                patchData((data) => ({ ...data, insurance: next }), immediate)
              )}
              {sectionNotes('insurance-notes', selectedPlan.data.insuranceNotes, (notes) =>
                patchData((data) => ({ ...data, insuranceNotes: notes }))
              )}
            </div>
          ) : null}

          {activeTab === 'financial' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Financial Info</h3>
              <div className="space-y-10">
                <section>
                  <h3 className={subsectionClass}>Bank Accounts</h3>
                  <RecordList chrome={listChrome}
                    listKey="bank"
                    records={selectedPlan.data.financial.bankAccounts}
                    addLabel="+ Add New Bank Account"
                    emptyText="No bank accounts yet. Add one to get started."
                    requiredValue={(draft) => Boolean(draft.institution.trim())}
                    titleOf={(item) => item.institution}
                    summaryOf={(item) => [item.accountType, item.lastFour ? `••••${item.lastFour}` : ''].filter(Boolean).join(' · ') || 'No details yet'}
                    fields={[
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
                    ]}
                    createDraft={emptyBankAccount}
                    cloneItem={(item, id) => ({ ...item, id, institution: copyName(item.institution) })}
                    deleteLabel="bank account"
                    onCommit={(next, immediate) =>
                      patchData((data) => ({ ...data, financial: { ...data.financial, bankAccounts: next } }), immediate)
                    }
                  />
                </section>
                <section>
                  <h3 className={subsectionClass}>Investment & Retirement Accounts</h3>
                  <RecordList chrome={listChrome}
                    listKey="invest"
                    records={selectedPlan.data.financial.investments}
                    addLabel="+ Add New Investment Account"
                    emptyText="No investment accounts yet. Add one to get started."
                    requiredValue={(draft) => Boolean(draft.institution.trim())}
                    titleOf={(item) => item.institution}
                    summaryOf={(item) => [item.accountType, item.accountReference].filter(Boolean).join(' · ') || 'No details yet'}
                    fields={[
                      { kind: 'text', key: 'institution', label: 'Institution' },
                      { kind: 'select', key: 'accountType', label: 'Account type', options: INVESTMENT_TYPES },
                      { kind: 'text', key: 'owner', label: 'Account owner' },
                      { kind: 'text', key: 'accountReference', label: 'Account reference' },
                      { kind: 'text', key: 'beneficiaries', label: 'Beneficiaries' },
                      { kind: 'text', key: 'advisor', label: 'Financial advisor' },
                      { kind: 'text', key: 'websiteLogin', label: 'Website/login reference' },
                    ]}
                    createDraft={emptyInvestmentAccount}
                    cloneItem={(item, id) => ({ ...item, id, institution: copyName(item.institution) })}
                    deleteLabel="investment account"
                    onCommit={(next, immediate) =>
                      patchData((data) => ({ ...data, financial: { ...data.financial, investments: next } }), immediate)
                    }
                  />
                </section>
                <section>
                  <h3 className={subsectionClass}>Credit Cards</h3>
                  <RecordList chrome={listChrome}
                    listKey="cards"
                    records={selectedPlan.data.financial.creditCards}
                    addLabel="+ Add New Credit Card"
                    emptyText="No credit cards yet. Add one to get started."
                    requiredValue={(draft) => Boolean(draft.issuer.trim())}
                    titleOf={(item) => item.issuer}
                    summaryOf={(item) => [item.cardType, item.lastFour ? `••••${item.lastFour}` : ''].filter(Boolean).join(' · ') || 'No details yet'}
                    fields={[
                      { kind: 'text', key: 'issuer', label: 'Issuer' },
                      { kind: 'text', key: 'cardType', label: 'Card type' },
                      { kind: 'text', key: 'lastFour', label: 'Last four digits' },
                      { kind: 'text', key: 'primaryHolder', label: 'Primary cardholder' },
                      { kind: 'text', key: 'authorizedUsers', label: 'Joint/authorized users' },
                      { kind: 'textarea', key: 'automaticPayments', label: 'Automatic payments charged to this card', span: 2 },
                      { kind: 'textarea', key: 'balanceNotes', label: 'Balance notes', span: 2 },
                      { kind: 'textarea', key: 'closingInstructions', label: 'Instructions for closing', span: 2 },
                    ]}
                    createDraft={emptyCreditCard}
                    cloneItem={(item, id) => ({ ...item, id, issuer: copyName(item.issuer) })}
                    deleteLabel="credit card"
                    onCommit={(next, immediate) =>
                      patchData((data) => ({ ...data, financial: { ...data.financial, creditCards: next } }), immediate)
                    }
                  />
                </section>
                <section>
                  <h3 className={subsectionClass}>Loans & Debts</h3>
                  <RecordList chrome={listChrome}
                    listKey="debts"
                    records={selectedPlan.data.financial.debts}
                    addLabel="+ Add New Debt"
                    emptyText="No debts yet. Add one to get started."
                    requiredValue={(draft) => Boolean(draft.creditor.trim())}
                    titleOf={(item) => item.creditor}
                    summaryOf={(item) => [item.debtType, item.approximateBalance].filter(Boolean).join(' · ') || 'No details yet'}
                    fields={[
                      { kind: 'text', key: 'creditor', label: 'Creditor' },
                      { kind: 'select', key: 'debtType', label: 'Debt type', options: DEBT_TYPES },
                      { kind: 'text', key: 'accountReference', label: 'Account reference' },
                      { kind: 'text', key: 'approximateBalance', label: 'Approximate balance' },
                      { kind: 'text', key: 'monthlyPayment', label: 'Monthly payment' },
                      { kind: 'text', key: 'automaticPayment', label: 'Automatic payment' },
                      { kind: 'text', key: 'collateral', label: 'Collateral' },
                      { kind: 'text', key: 'contact', label: 'Contact information' },
                    ]}
                    createDraft={emptyDebt}
                    cloneItem={(item, id) => ({ ...item, id, creditor: copyName(item.creditor) })}
                    deleteLabel="debt"
                    onCommit={(next, immediate) =>
                      patchData((data) => ({ ...data, financial: { ...data.financial, debts: next } }), immediate)
                    }
                  />
                </section>
                <section>
                  <h3 className={subsectionClass}>Income Sources</h3>
                  <RecordList chrome={listChrome}
                    listKey="income"
                    records={selectedPlan.data.financial.incomeSources}
                    addLabel="+ Add New Income Source"
                    emptyText="No income sources yet. Add one to get started."
                    titleOf={(item) => item.incomeType || 'Income source'}
                    summaryOf={(item) => [item.amountFrequency, item.depositedWhere].filter(Boolean).join(' · ') || 'No details yet'}
                    fields={[
                      { kind: 'select', key: 'incomeType', label: 'Type', options: INCOME_TYPES },
                      { kind: 'text', key: 'amountFrequency', label: 'Amount/frequency' },
                      { kind: 'text', key: 'depositedWhere', label: 'Where deposited' },
                      { kind: 'text', key: 'contact', label: 'Contact information' },
                      { kind: 'yesno', key: 'survivorBenefits', label: 'Survivor benefits?' },
                    ]}
                    createDraft={emptyIncomeSource}
                    cloneItem={(item, id) => ({ ...item, id, incomeType: copyName(item.incomeType) })}
                    deleteLabel="income source"
                    onCommit={(next, immediate) =>
                      patchData((data) => ({ ...data, financial: { ...data.financial, incomeSources: next } }), immediate)
                    }
                  />
                </section>
                <section>
                  <h3 className={subsectionClass}>Recurring Bills</h3>
                  <RecordList chrome={listChrome}
                    listKey="bills"
                    records={selectedPlan.data.financial.recurringBills}
                    addLabel="+ Add New Recurring Bill"
                    emptyText="No recurring bills yet. Add one to get started."
                    requiredValue={(draft) => Boolean(draft.company.trim())}
                    titleOf={(item) => item.company}
                    summaryOf={(item) => [item.description, item.amount, item.frequency].filter(Boolean).join(' · ') || 'No details yet'}
                    fields={[
                      { kind: 'text', key: 'company', label: 'Company' },
                      { kind: 'text', key: 'description', label: 'Description' },
                      { kind: 'text', key: 'amount', label: 'Amount' },
                      { kind: 'text', key: 'frequency', label: 'Frequency' },
                      { kind: 'text', key: 'dueDate', label: 'Due date' },
                      { kind: 'yesno', key: 'automaticPayment', label: 'Automatic payment?' },
                      { kind: 'text', key: 'paymentAccount', label: 'Payment account/card' },
                      { kind: 'yesno', key: 'cancelAfterDeath', label: 'Should it be canceled after death?' },
                    ]}
                    createDraft={emptyRecurringBill}
                    cloneItem={(item, id) => ({ ...item, id, company: copyName(item.company) })}
                    deleteLabel="recurring bill"
                    onCommit={(next, immediate) =>
                      patchData((data) => ({ ...data, financial: { ...data.financial, recurringBills: next } }), immediate)
                    }
                  />
                </section>
                {sectionNotes('financial-notes', selectedPlan.data.financialNotes, (notes) =>
                  patchData((data) => ({ ...data, financialNotes: notes }))
                )}
              </div>
            </div>
          ) : null}

          {activeTab === 'home' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Home Info</h3>
              <div className="space-y-10">
                <section>
                  <h3 className={subsectionClass}>Property</h3>
                  {renderGrid(
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
                  )}
                </section>
                <section>
                  <h3 className={subsectionClass}>Utilities</h3>
                  <RecordList chrome={listChrome}
                    listKey="utilities"
                    records={selectedPlan.data.home.utilities}
                    addLabel="+ Add New Utility"
                    emptyText="No utilities yet. Add one to get started."
                    titleOf={(item) => item.utilityType || item.provider || 'Utility'}
                    summaryOf={(item) => [item.provider, item.accountReference].filter(Boolean).join(' · ') || 'No details yet'}
                    fields={[
                      { kind: 'select', key: 'utilityType', label: 'Type', options: UTILITY_TYPES },
                      { kind: 'text', key: 'provider', label: 'Provider' },
                      { kind: 'text', key: 'accountReference', label: 'Account reference' },
                      { kind: 'text', key: 'contact', label: 'Contact' },
                      { kind: 'text', key: 'automaticPayment', label: 'Automatic payment' },
                      { kind: 'text', key: 'paymentSource', label: 'Payment source' },
                      { kind: 'text', key: 'loginReference', label: 'Login reference' },
                    ]}
                    createDraft={emptyUtility}
                    cloneItem={(item, id) => ({ ...item, id })}
                    deleteLabel="utility"
                    onCommit={(next, immediate) =>
                      patchData((data) => ({ ...data, home: { ...data.home, utilities: next } }), immediate)
                    }
                  />
                </section>
                <section>
                  <h3 className={subsectionClass}>Home Access</h3>
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
                </section>
                <section>
                  <h3 className={subsectionClass}>Home Service Providers</h3>
                  <RecordList chrome={listChrome}
                    listKey="providers"
                    records={selectedPlan.data.home.providers}
                    addLabel="+ Add New Service Provider"
                    emptyText="No service providers yet. Add one to get started."
                    titleOf={(item) => item.name || item.providerType || 'Provider'}
                    summaryOf={(item) => [item.providerType, item.contact].filter(Boolean).join(' · ') || 'No details yet'}
                    fields={[
                      { kind: 'select', key: 'providerType', label: 'Type', options: HOME_PROVIDER_TYPES },
                      { kind: 'text', key: 'name', label: 'Provider name' },
                      { kind: 'text', key: 'contact', label: 'Contact' },
                      { kind: 'text', key: 'accountReference', label: 'Account/reference' },
                      { kind: 'textarea', key: 'notes', label: 'Notes', span: 2 },
                    ]}
                    createDraft={emptyHomeProvider}
                    cloneItem={(item, id) => ({ ...item, id, name: copyName(item.name) })}
                    deleteLabel="service provider"
                    onCommit={(next, immediate) =>
                      patchData((data) => ({ ...data, home: { ...data.home, providers: next } }), immediate)
                    }
                  />
                </section>
                <section>
                  <h3 className={subsectionClass}>Vehicles</h3>
                  <RecordList chrome={listChrome}
                    listKey="vehicles"
                    records={selectedPlan.data.home.vehicles}
                    addLabel="+ Add New Vehicle"
                    emptyText="No vehicles yet. Add one to get started."
                    titleOf={(item) => [item.year, item.make, item.model].filter(Boolean).join(' ') || 'Vehicle'}
                    summaryOf={(item) => [item.vin, item.insurance].filter(Boolean).join(' · ') || 'No details yet'}
                    fields={[
                      { kind: 'text', key: 'year', label: 'Year' },
                      { kind: 'text', key: 'make', label: 'Make' },
                      { kind: 'text', key: 'model', label: 'Model' },
                      { kind: 'text', key: 'vin', label: 'VIN' },
                      { kind: 'text', key: 'loanInformation', label: 'Loan information' },
                      { kind: 'text', key: 'titleLocation', label: 'Title location' },
                      { kind: 'text', key: 'insurance', label: 'Insurance' },
                      { kind: 'text', key: 'spareKeyLocation', label: 'Spare key location' },
                    ]}
                    createDraft={emptyVehicle}
                    cloneItem={(item, id) => ({ ...item, id })}
                    deleteLabel="vehicle"
                    onCommit={(next, immediate) =>
                      patchData((data) => ({ ...data, home: { ...data.home, vehicles: next } }), immediate)
                    }
                  />
                </section>
                {sectionNotes('home-notes', selectedPlan.data.homeNotes, (notes) =>
                  patchData((data) => ({ ...data, homeNotes: notes }))
                )}
              </div>
            </div>
          ) : null}

          {activeTab === 'nextSteps' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Next Steps</h3>
              <p className={`${bodyTextClass} mb-4 font-medium`}>If something happened to me today, start here.</p>
              <RecordList chrome={listChrome}
                listKey="steps"
                records={selectedPlan.data.nextSteps.filter((step) => !step.hidden)}
                addLabel="+ Add New Step"
                emptyText="No next steps yet."
                requiredValue={(draft) => Boolean(draft.title.trim())}
                titleOf={(item) => item.title}
                summaryOf={(item) => [item.priority, item.status, item.personResponsible].filter(Boolean).join(' · ')}
                hideDelete={(item) => item.isPredefined}
                fields={[
                  { kind: 'text', key: 'title', label: 'Title' },
                  { kind: 'select', key: 'priority', label: 'Priority', options: ['High', 'Medium', 'Low'] },
                  { kind: 'text', key: 'personResponsible', label: 'Person responsible' },
                  { kind: 'select', key: 'status', label: 'Status', options: ['Not started', 'Completed', 'Not applicable'] },
                  { kind: 'textarea', key: 'instructions', label: 'Instructions', span: 2 },
                  { kind: 'text', key: 'relatedDocument', label: 'Related document' },
                ]}
                extra={(item, onChange) => (
                  <div>
                    <label htmlFor={`step-contact-${item.id}`} className={labelClass}>
                      Related contact
                    </label>
                    <select
                      id={`step-contact-${item.id}`}
                      value={item.relatedContactId}
                      onChange={(event) => onChange({ ...item, relatedContactId: event.target.value })}
                      className={selectClass}
                    >
                      <option value="">None</option>
                      {selectedPlan.data.contacts.map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name || 'Untitled contact'}
                        </option>
                      ))}
                    </select>
                    {item.isPredefined ? (
                      <div className="mt-3 space-y-2">
                        <p className={helperClass}>Predefined steps can be marked not applicable or hidden, but not permanently deleted.</p>
                        <button type="button" className={secondaryButtonClass} onClick={() => onChange({ ...item, hidden: true })}>
                          Hide this step
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
                createDraft={() => emptyNextStep({ priority: 'Medium' })}
                cloneItem={(item, id) => emptyNextStep({ ...item, id, isPredefined: false, seedKey: undefined, title: copyName(item.title) })}
                deleteLabel="step"
                onCommit={(next, immediate) => {
                  const hidden = selectedPlan.data.nextSteps.filter((step) => step.hidden);
                  const visibleIds = new Set(next.map((step) => step.id));
                  const remainingHidden = hidden.filter((step) => !visibleIds.has(step.id));
                  patchData((data) => ({ ...data, nextSteps: [...next, ...remainingHidden] }), immediate);
                }}
              />
              <div className="mt-4">
                <p className={`${mutedTextClass} text-sm mb-2`}>Hidden predefined steps</p>
                {selectedPlan.data.nextSteps.filter((step) => step.hidden).length === 0 ? (
                  <p className={helperClass}>None. Use status “Not applicable” or hide a predefined step from its edit form by marking N/A.</p>
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
              {sectionNotes('next-steps-notes', selectedPlan.data.nextStepsNotes, (notes) =>
                patchData((data) => ({ ...data, nextStepsNotes: notes }))
              )}
            </div>
          ) : null}

          {activeTab === 'eolWishes' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>End of Life Wishes</h3>
              <div className={`${warningBannerClass} mb-6`}>
                Recording wishes here does not replace legally required estate, healthcare, or disposition documents. This is a guide for your family, not a legal instrument.
              </div>
              {renderGrid(
                selectedPlan.data.eolWishes,
                [
                  { kind: 'select', key: 'dispositionPreference', label: 'Burial / Cremation / Donation / Other preference', options: ['Burial', 'Cremation', 'Donation', 'Other'] },
                  { kind: 'text', key: 'funeralHome', label: 'Preferred funeral home' },
                  { kind: 'text', key: 'funeralHomeContact', label: 'Funeral home contact' },
                  { kind: 'text', key: 'cemetery', label: 'Cemetery' },
                  { kind: 'textarea', key: 'cemeteryPlot', label: 'Cemetery plot information', span: 2 },
                  { kind: 'text', key: 'paperworkLocation', label: 'Location of ownership paperwork' },
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
                  { kind: 'textarea', key: 'obituaryWishes', label: 'Obituary wishes', span: 2 },
                  { kind: 'textarea', key: 'peopleToNotify', label: 'People who should be notified', span: 2 },
                  { kind: 'textarea', key: 'organizationsToNotify', label: 'Organizations to notify', span: 2 },
                  { kind: 'text', key: 'flowersPreference', label: 'Flowers preference' },
                  { kind: 'text', key: 'memorialDonation', label: 'Memorial donation preference' },
                  { kind: 'textarea', key: 'pallbearerPreferences', label: 'Pallbearer preferences', span: 2 },
                  { kind: 'text', key: 'clothingPreference', label: 'Clothing preference' },
                  { kind: 'text', key: 'militaryHonors', label: 'Military honors' },
                  { kind: 'textarea', key: 'headstoneWishes', label: 'Headstone/marker wishes', span: 2 },
                  { kind: 'textarea', key: 'ashesInstructions', label: 'Ashes instructions', span: 2 },
                  { kind: 'textarea', key: 'organDonationWishes', label: 'Organ/tissue donation wishes', span: 2 },
                  { kind: 'textarea', key: 'prepaidArrangements', label: 'Prepaid funeral arrangements', span: 2 },
                  { kind: 'text', key: 'funeralContractLocation', label: 'Location of funeral contracts' },
                ],
                (next) => patchData((data) => ({ ...data, eolWishes: next })),
                'eol-wishes'
              )}
              {sectionNotes('eol-wishes-notes', selectedPlan.data.eolWishesNotes, (notes) =>
                patchData((data) => ({ ...data, eolWishesNotes: notes }))
              )}
            </div>
          ) : null}

          {activeTab === 'myWishes' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>My Wishes</h3>
              <div className={`${warningBannerClass} mb-6`}>
                Personal wishes entered here may not constitute a legally enforceable transfer of property. Use formal estate documents for legally binding gifts.
              </div>
              <div className="space-y-4 mb-8">
                {MY_WISHES_QUESTIONS.map((question) => (
                  <div key={question.key}>
                    <label htmlFor={`wish-${question.key}`} className={labelClass}>
                      {question.label}
                    </label>
                    <textarea
                      id={`wish-${question.key}`}
                      rows={3}
                      value={selectedPlan.data.myWishes[question.key]}
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
              <h3 className={subsectionClass}>Personal property</h3>
              <RecordList chrome={listChrome}
                listKey="items"
                records={selectedPlan.data.myWishes.personalItems}
                addLabel="+ Add New Personal Item"
                emptyText="No personal items yet. Add one to get started."
                requiredValue={(draft) => Boolean(draft.item.trim())}
                titleOf={(item) => item.item}
                summaryOf={(item) => [item.recipient, item.location].filter(Boolean).join(' · ') || 'No details yet'}
                fields={[
                  { kind: 'text', key: 'item', label: 'Item' },
                  { kind: 'textarea', key: 'description', label: 'Description', span: 2 },
                  { kind: 'text', key: 'location', label: 'Location' },
                  { kind: 'text', key: 'recipient', label: 'Intended recipient' },
                  { kind: 'textarea', key: 'reason', label: 'Reason/message', span: 2 },
                  { kind: 'text', key: 'photoReference', label: 'Photo/document reference' },
                  { kind: 'textarea', key: 'specialInstructions', label: 'Special instructions', span: 2 },
                ]}
                extra={() => <p className={helperClass}>Photo and document uploads are not available in this pass. Use a text reference only.</p>}
                createDraft={emptyPersonalItem}
                cloneItem={(item, id) => ({ ...item, id, item: copyName(item.item) })}
                deleteLabel="personal item"
                onCommit={(next, immediate) =>
                  patchData((data) => ({ ...data, myWishes: { ...data.myWishes, personalItems: next } }), immediate)
                }
              />
              {sectionNotes('my-wishes-notes', selectedPlan.data.myWishesNotes, (notes) =>
                patchData((data) => ({ ...data, myWishesNotes: notes }))
              )}
            </div>
          ) : null}

          {activeTab === 'letters' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Letters</h3>
              {renderLetters('letters', selectedPlan.data.letters, (next, immediate) =>
                patchData((data) => ({ ...data, letters: next }), immediate)
              )}
              {sectionNotes('letters-notes', selectedPlan.data.lettersNotes, (notes) =>
                patchData((data) => ({ ...data, lettersNotes: notes }))
              )}
            </div>
          ) : null}

          {activeTab === 'other' ? (
            <div className={cardClass}>
              <h3 className={sectionTitleClass}>Other</h3>
              {renderOther('other', selectedPlan.data.otherRecords, (next, immediate) =>
                patchData((data) => ({ ...data, otherRecords: next }), immediate)
              )}
              {sectionNotes('other-notes', selectedPlan.data.otherNotes, (notes) =>
                patchData((data) => ({ ...data, otherNotes: notes }))
              )}
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

      {deleteTarget ? (
        <div className={overlayClass}>
          <div className={modalCardClass}>
            <h3 className={isLight ? 'text-xl font-semibold text-slate-900 mb-2' : 'text-xl font-semibold text-slate-50 mb-2'}>
              {deleteTarget.kind === 'plan'
                ? 'Delete Plan'
                : deleteTarget.kind === 'custom-tab'
                  ? 'Delete Custom Section'
                  : 'Delete Record'}
            </h3>
            <div className={deleteWarningBoxClass}>
              <p className={deleteWarningTextClass}>⚠️ Warning: This action cannot be undone!</p>
              <p className={deleteWarningDetailClass}>
                {deleteTarget.kind === 'plan'
                  ? `This will permanently delete “${deleteTarget.label}” and all of its section data.`
                  : deleteTarget.kind === 'custom-tab'
                    ? `This will permanently delete the “${deleteTarget.label}” section and its records.`
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

      {showCustomModal ? (
        <div className={overlayClass}>
          <div className={modalCardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>Add Custom Section</h3>
              <button type="button" onClick={() => setShowCustomModal(false)} className={iconButtonClass} aria-label="Close modal" title="Close modal">
                <OutlineIcon d={ICON.close} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="custom-section-name" className={labelClass}>
                  Section name
                </label>
                <input id="custom-section-name" value={customName} onChange={(event) => setCustomName(event.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="custom-section-template" className={labelClass}>
                  Model after
                </label>
                <select
                  id="custom-section-template"
                  value={customTemplate}
                  onChange={(event) => setCustomTemplate(event.target.value as EolCustomTemplate)}
                  className={selectClass}
                >
                  {EOL_CUSTOM_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={addCustomSection} disabled={!customName.trim()} className={primaryButtonClass}>
                  Create section
                </button>
                <button type="button" onClick={() => setShowCustomModal(false)} className={secondaryButtonClass}>
                  Cancel
                </button>
              </div>
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