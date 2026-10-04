import { supabaseServer } from '@/lib/supabaseServer';
import { loadAccountPricingInputs } from '@/lib/load-account-pricing';
import { billingSchedule } from '@/lib/billing-cycle';
import { loadFrozenPeriod, loadSignupAt } from '@/lib/billing-period-store';
import { assembleBillingPreview, type BillingPreviewPayload, type PreviewNotice, type PreviewPerson } from '@/lib/billing-preview';

type UserRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
};

function toPerson(row: UserRow): PreviewPerson {
  return { id: row.id, email: row.email, firstName: row.first_name, lastName: row.last_name };
}

export async function resolveBillingUserId(userId: string): Promise<string> {
  const member = await supabaseServer
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (member.error) throw member.error;
  if (!member.data) return userId;
  const household = await supabaseServer.from('households').select('admin_user_id').eq('id', member.data.household_id).maybeSingle();
  if (household.error) throw household.error;
  return household.data?.admin_user_id || userId;
}

export async function loadBillingPreview(openedUserId: string, simulatedAt: Date, actualAt = new Date()): Promise<BillingPreviewPayload | null> {
  const billingUserId = await resolveBillingUserId(openedUserId);
  const ids = [...new Set([openedUserId, billingUserId])];
  const [inputs, people, notices, catalog] = await Promise.all([
    loadAccountPricingInputs([billingUserId]),
    supabaseServer.from('users').select('id, email, first_name, last_name').in('id', ids),
    supabaseServer.from('account_notices').select('id, severity, title, body, created_at, read_at').eq('user_id', billingUserId).order('created_at', { ascending: false }),
    supabaseServer.from('tools').select('id, name'),
  ]);
  const input = inputs.get(billingUserId);
  if (!input || people.error || !people.data) return null;
  if (notices.error) throw notices.error;
  if (catalog.error) throw catalog.error;
  const rows = people.data as UserRow[];
  const opened = rows.find((row) => row.id === openedUserId);
  const billing = rows.find((row) => row.id === billingUserId);
  if (!opened || !billing) return null;
  const signupAt = await loadSignupAt(billingUserId);
  let frozen = null;
  if (signupAt) {
    const schedule = billingSchedule(signupAt, simulatedAt);
    if (schedule.periodStart) {
      frozen = (await loadFrozenPeriod(billingUserId, schedule.periodStart)).frozen;
    }
  }
  const toolNames = new Map((catalog.data ?? []).map((tool) => [tool.id, tool.name]));
  const actualNotices: PreviewNotice[] = (notices.data ?? []).map((notice) => ({
    id: notice.id,
    severity: notice.severity,
    title: notice.title,
    body: notice.body,
    createdAt: notice.created_at,
    readAt: notice.read_at,
  }));
  return assembleBillingPreview({
    input,
    opened: toPerson(opened),
    billing: toPerson(billing),
    notices: actualNotices,
    toolNames,
    actualAt,
    simulatedAt,
    signupAt,
    frozenPeriodTools: frozen,
  });
}
