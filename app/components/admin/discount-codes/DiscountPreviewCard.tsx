import {
  assignmentLabel,
  ELIGIBLE_USER_LABELS,
  formatRedeemWindow,
  previewHeadline,
  type DiscountCodeDraft,
} from '@/lib/discount-codes';
import type { DiscountAdminStyles } from './styles';

type DiscountPreviewCardProps = {
  draft: DiscountCodeDraft;
  styles: DiscountAdminStyles;
  isLight: boolean;
};

export function DiscountPreviewCard({ draft, styles, isLight }: DiscountPreviewCardProps) {
  const headline = previewHeadline(draft);
  const code = draft.publicCode.trim() || 'CODE';
  const title = draft.internalName.trim() || 'New promotion';

  return (
    <div className={styles.preview}>
      <p className={`text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>
        Preview
      </p>
      <p className={`mt-2 font-mono text-sm tracking-wide ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{code}</p>
      <h3 className={`mt-1 text-xl font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>{headline}</h3>
      <p className={`mt-1 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{title}</p>
      <p className={`mt-3 text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
        {draft.customerDescription.trim() || 'No customer description yet.'}
      </p>
      <dl className={`mt-4 space-y-1 text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
        <div className="flex justify-between gap-3">
          <dt>How it is applied</dt>
          <dd>{assignmentLabel(draft.assignmentMethod)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Who can use it</dt>
          <dd>{ELIGIBLE_USER_LABELS[draft.eligibleUsers]}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Combines with others</dt>
          <dd>{draft.canStack ? 'Yes' : 'No'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Can be redeemed</dt>
          <dd className="text-right">{formatRedeemWindow(draft.redeemStartDate, draft.redeemEndDate)}</dd>
        </div>
      </dl>
    </div>
  );
}
