'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  ASSIGNMENT_OPTIONS,
  defaultQuantityForType,
  DISCOUNT_PLATFORMS,
  DISCOUNT_TYPE_OPTIONS,
  discountToolsByCategory,
  ELIGIBLE_USER_LABELS,
  ELIGIBLE_USERS,
  listStatusHint,
  normalizeDiscountDraft,
  normalizePublicCode,
  STORED_STATUSES,
  toolNamesForSlugs,
  validateDiscountDraft,
  type DiscountCode,
  type DiscountCodeDraft,
  type DiscountType,
  type StoredDiscountStatus,
} from '@/lib/discount-codes';
import { DiscountPreviewCard } from './DiscountPreviewCard';
import type { DiscountAdminStyles } from './styles';

type DiscountCodeFormProps = {
  mode: 'create' | 'edit' | 'clone';
  initial: DiscountCodeDraft;
  existingCodes: DiscountCode[];
  editingId?: string;
  sourceCode?: string;
  styles: DiscountAdminStyles;
  isLight: boolean;
  onCancel: () => void;
  onSave: (draft: DiscountCodeDraft) => void;
};

const FORM_SECTIONS = [
  ['basic', 'Basic'],
  ['benefit', 'Benefit'],
  ['duration', 'Duration'],
  ['eligibility', 'Eligibility'],
  ['assignment', 'Assignment'],
  ['campaign', 'Campaign'],
] as const;

const STATUS_LABELS: Record<StoredDiscountStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  draft: 'Draft',
  archived: 'Archived',
};

export function DiscountCodeForm({
  mode,
  initial,
  existingCodes,
  editingId,
  sourceCode,
  styles,
  isLight,
  onCancel,
  onSave,
}: DiscountCodeFormProps) {
  const [draft, setDraft] = useState<DiscountCodeDraft>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [toolQuery, setToolQuery] = useState('');
  const toolGroups = useMemo(() => discountToolsByCategory(), []);
  const statusHint = listStatusHint(draft);
  const selectedNames = toolNamesForSlugs(draft.toolSlugs);

  const title = mode === 'edit' ? 'Edit Discount Code' : mode === 'clone' ? 'Duplicate Discount Code' : 'Create Discount Code';
  const statusChoices = draft.status === 'archived'
    ? STORED_STATUSES
    : STORED_STATUSES.filter((status) => status !== 'archived');

  const update = (patch: Partial<DiscountCodeDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const changeType = (discountType: DiscountType) => {
    update({
      discountType,
      quantity: defaultQuantityForType(discountType),
    });
  };

  const toggleTool = (slug: string) => {
    update({
      toolSlugs: draft.toolSlugs.includes(slug)
        ? draft.toolSlugs.filter((item) => item !== slug)
        : [...draft.toolSlugs, slug],
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeDiscountDraft(draft);
    const nextErrors = validateDiscountDraft(normalized, existingCodes, mode === 'edit' ? editingId : undefined);
    setDraft(normalized);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    onSave(normalized);
  };

  const filteredGroups = toolGroups
    .map((group) => ({
      ...group,
      tools: group.tools.filter((tool) => tool.name.toLowerCase().includes(toolQuery.trim().toLowerCase())),
    }))
    .filter((group) => group.tools.length > 0);

  return (
    <form onSubmit={submit}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>
            Set what the customer receives, how long it lasts, and who can use it.
          </p>
        </div>
        <div className="flex gap-3">
          <button type="button" className={styles.secondaryButton} onClick={onCancel}>Cancel</button>
          <button type="submit" className={styles.primaryButton}>Save Discount Code</button>
        </div>
      </div>

      {mode === 'clone' && (
        <div className={`mb-4 ${styles.note}`}>
          Copied from {sourceCode || 'an existing code'}. Enter a new public code. This copy starts as a draft, and the dates and campaign details can be changed.
        </div>
      )}

      {errors.length > 0 && (
        <div className={`mb-4 ${styles.error}`} role="alert">
          <p className="font-medium">Check these fields before saving.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {FORM_SECTIONS.map(([id, label]) => (
          <a key={id} href={`#discount-${id}`} className={styles.jump}>{label}</a>
        ))}
        <a href="#discount-preview" className={styles.jump}>Preview</a>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section id="discount-basic" className={`${styles.card} scroll-mt-6`}>
            <h2 className={styles.sectionTitle}>1. Basic information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className={styles.label}>Status</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Status">
                  {statusChoices.map((status) => (
                    <button
                      key={status}
                      type="button"
                      role="radio"
                      aria-checked={draft.status === status}
                      className={draft.status === status ? styles.choiceSelected : styles.choice}
                      onClick={() => update({ status })}
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
                {statusHint && <p className={styles.hint}>{statusHint}</p>}
                {draft.status === 'inactive' && <p className={styles.hint}>Inactive codes stay in the list and cannot be redeemed.</p>}
                {draft.status === 'draft' && <p className={styles.hint}>Drafts are still being prepared.</p>}
              </div>
              <div className="sm:col-span-2">
                <label className={styles.label} htmlFor="discount-name">Internal promotion name</label>
                <input id="discount-name" className={styles.input} value={draft.internalName} onChange={(event) => update({ internalName: event.target.value })} />
              </div>
              <div>
                <label className={styles.label} htmlFor="discount-code">Public discount code</label>
                <input
                  id="discount-code"
                  className={`${styles.input} font-mono uppercase`}
                  value={draft.publicCode}
                  onChange={(event) => update({ publicCode: normalizePublicCode(event.target.value) })}
                  autoCapitalize="characters"
                />
                <p className={styles.hint}>Letters, numbers, and hyphens. Stored in uppercase.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 sm:col-span-1">
                <div>
                  <label className={styles.label} htmlFor="discount-start">Redeem from</label>
                  <input id="discount-start" type="date" className={styles.input} value={draft.redeemStartDate} onChange={(event) => update({ redeemStartDate: event.target.value })} />
                </div>
                <div>
                  <label className={styles.label} htmlFor="discount-end">Redeem through</label>
                  <input id="discount-end" type="date" className={styles.input} value={draft.redeemEndDate} onChange={(event) => update({ redeemEndDate: event.target.value })} />
                </div>
              </div>
              <p className={`${styles.hint} sm:col-span-2`}>
                These dates control when someone can redeem the code. They do not set how long the benefit lasts after it is applied.
              </p>
              <div className="sm:col-span-2">
                <label className={styles.label} htmlFor="discount-customer">Description shown to customer</label>
                <textarea id="discount-customer" rows={3} className={styles.input} value={draft.customerDescription} onChange={(event) => update({ customerDescription: event.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className={styles.label} htmlFor="discount-notes">Internal admin notes</label>
                <textarea id="discount-notes" rows={3} className={styles.input} value={draft.adminNotes} onChange={(event) => update({ adminNotes: event.target.value })} />
              </div>
            </div>
          </section>

          <section id="discount-benefit" className={`${styles.card} scroll-mt-6`}>
            <h2 className={styles.sectionTitle}>2. Benefit</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Discount type">
              {DISCOUNT_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={draft.discountType === option.value}
                  className={draft.discountType === option.value ? styles.choiceSelected : styles.choice}
                  onClick={() => changeType(option.value)}
                >
                  <span className={`block text-sm font-medium ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{option.title}</span>
                  <span className={`mt-1 block text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{option.description}</span>
                </button>
              ))}
            </div>

            {draft.discountType === 'free_tool_slots' && (
              <div className="mt-4 grid gap-4">
                <div className="max-w-xs">
                  <label className={styles.label} htmlFor="slot-count">Number of free tool slots</label>
                  <input id="slot-count" type="number" min={1} step={1} className={styles.input} value={draft.quantity || ''} onChange={(event) => update({ quantity: Number(event.target.value) })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Free tool slot behavior">
                  <button type="button" role="radio" aria-checked={draft.slotMode === 'additional'} className={draft.slotMode === 'additional' ? styles.choiceSelected : styles.choice} onClick={() => update({ slotMode: 'additional' })}>
                    <span className={`block text-sm font-medium ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>Add additional slots</span>
                    <span className={`mt-1 block text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Add this many free slots on top of what the account already has.</span>
                  </button>
                  <button type="button" role="radio" aria-checked={draft.slotMode === 'total'} className={draft.slotMode === 'total' ? styles.choiceSelected : styles.choice} onClick={() => update({ slotMode: 'total' })}>
                    <span className={`block text-sm font-medium ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>Set total free slots</span>
                    <span className={`mt-1 block text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>The account’s free tool slots become this number.</span>
                  </button>
                </div>
                <p className={styles.hint}>Slots are open spots. They are not permanently assigned to one tool.</p>
              </div>
            )}

            {draft.discountType === 'specific_tools' && (
              <div className="mt-4">
                <p className={styles.label}>Tools included</p>
                {selectedNames.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {draft.toolSlugs.map((slug, index) => (
                      <button key={slug} type="button" className={styles.chip} onClick={() => toggleTool(slug)}>
                        {selectedNames[index]} <span aria-hidden="true">×</span>
                      </button>
                    ))}
                  </div>
                )}
                <input className={styles.input} value={toolQuery} onChange={(event) => setToolQuery(event.target.value)} placeholder="Find a tool" aria-label="Find a tool" />
                <div className={`mt-3 max-h-64 space-y-4 overflow-y-auto rounded-lg border p-3 ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
                  {filteredGroups.map((group) => (
                    <fieldset key={group.category}>
                      <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{group.category}</legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {group.tools.map((tool) => (
                          <label key={tool.slug} className={`flex items-center gap-2 text-sm ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                            <input type="checkbox" className="accent-emerald-500" checked={draft.toolSlugs.includes(tool.slug)} onChange={() => toggleTool(tool.slug)} />
                            {tool.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                  {filteredGroups.length === 0 && <p className={styles.muted}>No tools match that search.</p>}
                </div>
              </div>
            )}

            {draft.discountType === 'percent_100' && (
              <p className={`mt-4 ${styles.note}`}>Everything billable is free. Choose Lifetime in Duration for a lifetime free account.</p>
            )}

            {draft.discountType === 'percentage' && (
              <div className="mt-4 max-w-xs">
                <label className={styles.label} htmlFor="percent-off">Percentage off</label>
                <input id="percent-off" type="number" min={1} max={100} step={1} className={styles.input} value={draft.quantity || ''} onChange={(event) => update({ quantity: Number(event.target.value) })} />
              </div>
            )}

            {draft.discountType === 'fixed_amount' && (
              <div className="mt-4 max-w-xs">
                <label className={styles.label} htmlFor="dollar-off">Dollars off per month</label>
                <input id="dollar-off" type="number" min={0.01} step={0.01} className={styles.input} value={draft.quantity || ''} onChange={(event) => update({ quantity: Number(event.target.value) })} />
              </div>
            )}

            {draft.discountType === 'bonus_storage' && (
              <div className="mt-4 max-w-xs">
                <label className={styles.label} htmlFor="storage-gb">Bonus storage (GB)</label>
                <input id="storage-gb" type="number" min={1} step={1} className={styles.input} value={draft.quantity || ''} onChange={(event) => update({ quantity: Number(event.target.value) })} />
              </div>
            )}
          </section>

          <section id="discount-duration" className={`${styles.card} scroll-mt-6`}>
            <h2 className={styles.sectionTitle}>3. Duration</h2>
            <p className={styles.hint}>How long the benefit lasts after it is applied.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Benefit duration">
              <button type="button" role="radio" aria-checked={draft.durationUnit === 'lifetime'} className={draft.durationUnit === 'lifetime' ? styles.choiceSelected : styles.choice} onClick={() => update({ durationUnit: 'lifetime' })}>
                <span className={`block text-sm font-medium ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>Lifetime</span>
                <span className={`mt-1 block text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>The benefit does not expire. A code can still have a last day to redeem it.</span>
              </button>
              <button type="button" role="radio" aria-checked={draft.durationUnit !== 'lifetime'} className={draft.durationUnit !== 'lifetime' ? styles.choiceSelected : styles.choice} onClick={() => update({ durationUnit: draft.durationUnit === 'lifetime' ? 'months' : draft.durationUnit })}>
                <span className={`block text-sm font-medium ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>A set length of time</span>
                <span className={`mt-1 block text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Days, months, or years after the benefit starts.</span>
              </button>
            </div>
            {draft.durationUnit !== 'lifetime' && (
              <div className="mt-4 grid max-w-md gap-3 sm:grid-cols-2">
                <div>
                  <label className={styles.label} htmlFor="duration-amount">Length</label>
                  <input id="duration-amount" type="number" min={1} step={1} className={styles.input} value={draft.durationAmount || ''} onChange={(event) => update({ durationAmount: Number(event.target.value) })} />
                </div>
                <div>
                  <label className={styles.label} htmlFor="duration-unit">Unit</label>
                  <select id="duration-unit" className={styles.input} value={draft.durationUnit} onChange={(event) => update({ durationUnit: event.target.value as DiscountCodeDraft['durationUnit'] })}>
                    <option value="days">Days</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>
              </div>
            )}
          </section>

          <section id="discount-eligibility" className={`${styles.card} scroll-mt-6`}>
            <h2 className={styles.sectionTitle}>4. Eligibility and limits</h2>
            <p className={styles.hint}>These start permissive. Limits can be tightened later if they are needed.</p>
            <div className="mt-4 grid gap-4">
              <fieldset>
                <legend className={styles.label}>Maximum total redemptions</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" className={draft.maxRedemptionsMode === 'unlimited' ? styles.choiceSelected : styles.choice} onClick={() => update({ maxRedemptionsMode: 'unlimited', maxRedemptions: null })}>Unlimited</button>
                  <button type="button" className={draft.maxRedemptionsMode === 'custom' ? styles.choiceSelected : styles.choice} onClick={() => update({ maxRedemptionsMode: 'custom', maxRedemptions: draft.maxRedemptions ?? 100 })}>Custom number</button>
                </div>
                {draft.maxRedemptionsMode === 'custom' && (
                  <div className="mt-3 max-w-xs">
                    <label className={styles.label} htmlFor="max-redemptions">Redemption limit</label>
                    <input id="max-redemptions" type="number" min={1} step={1} className={styles.input} value={draft.maxRedemptions ?? ''} onChange={(event) => update({ maxRedemptions: Number(event.target.value) })} />
                  </div>
                )}
              </fieldset>
              <ChoiceRow
                label="Per-user redemption"
                value={draft.perUserRedemption}
                options={[
                  ['once', 'Once', 'The same person can redeem this code one time.'],
                  ['repeatable', 'Repeatable', 'The same person can redeem this code more than once.'],
                ]}
                styles={styles}
                isLight={isLight}
                onChange={(perUserRedemption) => update({ perUserRedemption: perUserRedemption as DiscountCodeDraft['perUserRedemption'] })}
              />
              <ChoiceRow
                label="Eligible users"
                value={draft.eligibleUsers}
                options={ELIGIBLE_USERS.map((value) => [value, ELIGIBLE_USER_LABELS[value], ''])}
                styles={styles}
                isLight={isLight}
                onChange={(eligibleUsers) => update({ eligibleUsers: eligibleUsers as DiscountCodeDraft['eligibleUsers'] })}
              />
              <ChoiceRow
                label="Eligible account types"
                value={draft.eligibleAccountType}
                options={ACCOUNT_TYPES.map((value) => [value, ACCOUNT_TYPE_LABELS[value], ''])}
                styles={styles}
                isLight={isLight}
                onChange={(eligibleAccountType) => update({ eligibleAccountType: eligibleAccountType as DiscountCodeDraft['eligibleAccountType'] })}
              />
              <fieldset>
                <legend className={styles.label}>Can combine with other discounts</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" className={draft.canStack ? styles.choiceSelected : styles.choice} onClick={() => update({ canStack: true })}>Yes</button>
                  <button type="button" className={!draft.canStack ? styles.choiceSelected : styles.choice} onClick={() => update({ canStack: false })}>No</button>
                </div>
                <p className={styles.hint}>Yes is the usual setting. Several benefits may exist on one account.</p>
              </fieldset>
            </div>
          </section>

          <section id="discount-assignment" className={`${styles.card} scroll-mt-6`}>
            <h2 className={styles.sectionTitle}>5. Assignment</h2>
            <div className="mt-4 grid gap-3" role="radiogroup" aria-label="Assignment method">
              {ASSIGNMENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={draft.assignmentMethod === option.value}
                  className={draft.assignmentMethod === option.value ? styles.choiceSelected : styles.choice}
                  onClick={() => update({ assignmentMethod: option.value })}
                >
                  <span className={`block text-sm font-medium ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{option.title}</span>
                  <span className={`mt-1 block text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{option.description}</span>
                </button>
              ))}
            </div>
            {draft.assignmentMethod !== 'public_code' && (
              <p className={`mt-3 ${styles.hint}`}>A public code is still stored so reports can identify the promotion.</p>
            )}
          </section>

          <section id="discount-campaign" className={`${styles.card} scroll-mt-6`}>
            <h2 className={styles.sectionTitle}>6. Marketing and campaign</h2>
            <p className={styles.hint}>Optional. Revenue share is kept for later reporting. This screen does not pay anyone.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={styles.label} htmlFor="partner-name">Partner / influencer</label>
                <input id="partner-name" className={styles.input} value={draft.partnerName} onChange={(event) => update({ partnerName: event.target.value })} />
              </div>
              <div>
                <label className={styles.label} htmlFor="platform">Platform</label>
                <select id="platform" className={styles.input} value={draft.platform} onChange={(event) => update({ platform: event.target.value as DiscountCodeDraft['platform'] })}>
                  {DISCOUNT_PLATFORMS.map((option) => (
                    <option key={option.label} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={styles.label} htmlFor="campaign-name">Campaign name</label>
                <input id="campaign-name" className={styles.input} value={draft.campaignName} onChange={(event) => update({ campaignName: event.target.value })} />
              </div>
              <div>
                <label className={styles.label} htmlFor="revenue-share">Revenue share percentage</label>
                <input id="revenue-share" className={styles.input} inputMode="decimal" value={draft.revenueSharePercent} onChange={(event) => update({ revenueSharePercent: event.target.value })} placeholder="Optional" />
              </div>
              <div className="sm:col-span-2">
                <label className={styles.label} htmlFor="partner-notes">Internal partner notes</label>
                <textarea id="partner-notes" rows={3} className={styles.input} value={draft.partnerNotes} onChange={(event) => update({ partnerNotes: event.target.value })} />
              </div>
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className={styles.secondaryButton} onClick={onCancel}>Cancel</button>
            <button type="submit" className={styles.primaryButton}>Save Discount Code</button>
          </div>
        </div>

        <aside id="discount-preview" className="scroll-mt-6 max-lg:order-first lg:sticky lg:top-6">
          <DiscountPreviewCard draft={draft} styles={styles} isLight={isLight} />
        </aside>
      </div>
    </form>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  styles,
  isLight,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string, string]>;
  styles: DiscountAdminStyles;
  isLight: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className={styles.label}>{label}</legend>
      <div className={`grid gap-3 ${options.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {options.map(([optionValue, title, description]) => (
          <button
            key={optionValue}
            type="button"
            className={value === optionValue ? styles.choiceSelected : styles.choice}
            onClick={() => onChange(optionValue)}
          >
            <span className={`block text-sm font-medium ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{title}</span>
            {description && <span className={`mt-1 block text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{description}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
