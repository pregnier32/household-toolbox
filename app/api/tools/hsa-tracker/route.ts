import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

type DepositSource = 'Payroll' | 'Employer' | 'Personal' | 'Other';
type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
type ExpenseCategory = 'Doctor Visit' | 'Dental' | 'Vision' | 'Prescription' | 'Other';
type PaymentMethod = 'HSA Card' | 'Out of Pocket';

type DepositRow = {
  id: string;
  account_id: string;
  name: string;
  date: string;
  amount: number | string;
  source: string;
  tax_year: number;
  note: string | null;
  is_repeatable: boolean;
  recurrence_frequency: string | null;
  recurrence_start: string | null;
  recurrence_end: string | null;
};

type ExpenseRow = {
  id: string;
  account_id: string;
  name: string;
  date: string;
  amount: number | string;
  provider_or_store: string | null;
  category: string;
  payment_method: string;
  reimbursed: boolean;
  reimbursement_date: string | null;
  warn_until_receipt: boolean;
  notes: string | null;
};

function parseAmount(value: number | string): number {
  return typeof value === 'number' ? value : parseFloat(String(value));
}

function mapDeposit(row: DepositRow) {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    amount: parseAmount(row.amount),
    source: row.source as DepositSource,
    taxYear: row.tax_year,
    note: row.note ?? '',
    isRepeatable: !!row.is_repeatable,
    recurrenceFrequency: row.recurrence_frequency as RecurrenceFrequency | null,
    recurrenceStart: row.recurrence_start,
    recurrenceEnd: row.recurrence_end,
  };
}

function mapExpense(row: ExpenseRow) {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    amount: parseAmount(row.amount),
    providerOrStore: row.provider_or_store ?? '',
    category: row.category as ExpenseCategory,
    paymentMethod: row.payment_method as PaymentMethod,
    reimbursedYet: row.reimbursed ? ('Yes' as const) : ('No' as const),
    reimbursementDate: row.reimbursement_date,
    receiptFileName: null as string | null,
    warnUntilReceipt: !!row.warn_until_receipt,
    notes: row.notes ?? '',
  };
}

async function copyDefaultAccountsToUser(userId: string, toolId: string) {
  const { data: existing } = await supabaseServer
    .from('tools_hsa_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .limit(1);

  if (existing?.length) return;

  const { data: defaults } = await supabaseServer
    .from('tools_hsa_default_accounts')
    .select('*')
    .order('display_order', { ascending: true });

  if (!defaults?.length) return;

  await supabaseServer.from('tools_hsa_accounts').insert(
    defaults.map((d, i) => ({
      user_id: userId,
      tool_id: toolId,
      name: d.name,
      card_color: d.card_color,
      display_order: d.display_order ?? i,
    }))
  );
}

async function assertAccountOwned(accountId: string, userId: string, toolId: string) {
  const { data, error } = await supabaseServer
    .from('tools_hsa_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const toolId = searchParams.get('toolId');

  if (!toolId) {
    return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
  }

  try {
    await copyDefaultAccountsToUser(user.id, toolId);

    const { data: accountRows, error: accountsError } = await supabaseServer
      .from('tools_hsa_accounts')
      .select('id, name, card_color, display_order')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('display_order', { ascending: true });

    if (accountsError) {
      console.error('HSA accounts fetch error:', accountsError);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    const accounts = accountRows ?? [];
    const accountIds = accounts.map((a) => a.id);

    let deposits: DepositRow[] = [];
    let expenses: ExpenseRow[] = [];

    if (accountIds.length > 0) {
      const [depositsRes, expensesRes] = await Promise.all([
        supabaseServer
          .from('tools_hsa_deposits')
          .select('*')
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .in('account_id', accountIds)
          .order('date', { ascending: false }),
        supabaseServer
          .from('tools_hsa_expenses')
          .select('*')
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .in('account_id', accountIds)
          .order('date', { ascending: false }),
      ]);

      if (depositsRes.error) {
        console.error('HSA deposits fetch error:', depositsRes.error);
        return NextResponse.json({ error: 'Failed to fetch deposits' }, { status: 500 });
      }
      if (expensesRes.error) {
        console.error('HSA expenses fetch error:', expensesRes.error);
        return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
      }

      deposits = (depositsRes.data ?? []) as DepositRow[];
      expenses = (expensesRes.data ?? []) as ExpenseRow[];
    }

    const accountsWithData = accounts.map((a) => ({
      id: a.id,
      name: a.name,
      card_color: a.card_color || '#10b981',
      deposits: deposits.filter((d) => d.account_id === a.id).map(mapDeposit),
      expenses: expenses.filter((e) => e.account_id === a.id).map(mapExpense),
    }));

    return NextResponse.json({ accounts: accountsWithData });
  } catch (err) {
    console.error('HSA tracker GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { resource, action, toolId } = body as {
      resource: 'account' | 'deposit' | 'expense';
      action: 'create' | 'update' | 'delete';
      toolId?: string;
    };

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    if (resource === 'account') {
      if (action === 'create') {
        const { name, card_color } = body as { name: string; card_color?: string };
        if (!name?.trim()) {
          return NextResponse.json({ error: 'Account name is required' }, { status: 400 });
        }

        const { count } = await supabaseServer
          .from('tools_hsa_accounts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('tool_id', toolId);

        const { data, error } = await supabaseServer
          .from('tools_hsa_accounts')
          .insert({
            user_id: user.id,
            tool_id: toolId,
            name: name.trim(),
            card_color: card_color || '#10b981',
            display_order: count ?? 0,
          })
          .select()
          .single();

        if (error) {
          console.error('HSA account create error:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          account: {
            id: data.id,
            name: data.name,
            card_color: data.card_color || '#10b981',
            deposits: [],
            expenses: [],
          },
        });
      }

      if (action === 'update') {
        const { accountId, name, card_color } = body as {
          accountId: string;
          name?: string;
          card_color?: string;
        };
        if (!accountId) {
          return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
        }

        const updates: Record<string, string> = {};
        if (name !== undefined) updates.name = name.trim();
        if (card_color !== undefined) updates.card_color = card_color;

        const { data, error } = await supabaseServer
          .from('tools_hsa_accounts')
          .update(updates)
          .eq('id', accountId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .select()
          .single();

        if (error) {
          console.error('HSA account update error:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          account: {
            id: data.id,
            name: data.name,
            card_color: data.card_color || '#10b981',
          },
        });
      }

      if (action === 'delete') {
        const { accountId } = body as { accountId: string };
        if (!accountId) {
          return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
        }

        const { count } = await supabaseServer
          .from('tools_hsa_accounts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('tool_id', toolId);

        if ((count ?? 0) <= 1) {
          return NextResponse.json({ error: 'At least one HSA account is required' }, { status: 400 });
        }

        const { error } = await supabaseServer
          .from('tools_hsa_accounts')
          .delete()
          .eq('id', accountId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId);

        if (error) {
          console.error('HSA account delete error:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }
    }

    if (resource === 'deposit') {
      if (action === 'delete') {
        const { depositId } = body as { depositId: string };
        if (!depositId) {
          return NextResponse.json({ error: 'Deposit ID is required' }, { status: 400 });
        }

        const { error } = await supabaseServer
          .from('tools_hsa_deposits')
          .delete()
          .eq('id', depositId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId);

        if (error) {
          console.error('HSA deposit delete error:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      const isUpdate = action === 'update';
      const {
        depositId,
        accountId,
        name,
        date,
        amount,
        source,
        taxYear,
        note,
        isRepeatable,
        recurrenceFrequency,
        recurrenceStart,
        recurrenceEnd,
      } = body as {
        depositId?: string;
        accountId: string;
        name: string;
        date: string;
        amount: number;
        source: DepositSource;
        taxYear: number;
        note?: string;
        isRepeatable?: boolean;
        recurrenceFrequency?: RecurrenceFrequency | null;
        recurrenceStart?: string | null;
        recurrenceEnd?: string | null;
      };

      if (isUpdate && !depositId) {
        return NextResponse.json({ error: 'Deposit ID is required' }, { status: 400 });
      }
      if (!accountId || !name?.trim() || !date || amount == null || !source || !taxYear) {
        return NextResponse.json({ error: 'Missing required deposit fields' }, { status: 400 });
      }

      const owned = await assertAccountOwned(accountId, user.id, toolId);
      if (!owned) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      const repeatable = !!isRepeatable;
      const row = {
        account_id: accountId,
        user_id: user.id,
        tool_id: toolId,
        name: name.trim(),
        date,
        amount,
        source,
        tax_year: taxYear,
        note: note?.trim() ?? '',
        is_repeatable: repeatable,
        recurrence_frequency: repeatable ? recurrenceFrequency ?? null : null,
        recurrence_start: repeatable ? recurrenceStart ?? null : null,
        recurrence_end: repeatable && recurrenceEnd ? recurrenceEnd : null,
      };

      if (repeatable && (!row.recurrence_frequency || !row.recurrence_start)) {
        return NextResponse.json(
          { error: 'Repeatable deposits require frequency and start date' },
          { status: 400 }
        );
      }

      if (isUpdate) {
        const { data, error } = await supabaseServer
          .from('tools_hsa_deposits')
          .update(row)
          .eq('id', depositId!)
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .select()
          .single();

        if (error) {
          console.error('HSA deposit update error:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ deposit: mapDeposit(data as DepositRow) });
      }

      const { data, error } = await supabaseServer
        .from('tools_hsa_deposits')
        .insert(row)
        .select()
        .single();

      if (error) {
        console.error('HSA deposit create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ deposit: mapDeposit(data as DepositRow) });
    }

    if (resource === 'expense') {
      if (action === 'delete') {
        const { expenseId } = body as { expenseId: string };
        if (!expenseId) {
          return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
        }

        const { error } = await supabaseServer
          .from('tools_hsa_expenses')
          .delete()
          .eq('id', expenseId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId);

        if (error) {
          console.error('HSA expense delete error:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      const isUpdate = action === 'update';
      const {
        expenseId,
        accountId,
        name,
        date,
        amount,
        providerOrStore,
        category,
        paymentMethod,
        reimbursedYet,
        reimbursementDate,
        warnUntilReceipt,
        notes,
      } = body as {
        expenseId?: string;
        accountId: string;
        name: string;
        date: string;
        amount: number;
        providerOrStore?: string;
        category: ExpenseCategory;
        paymentMethod: PaymentMethod;
        reimbursedYet: 'Yes' | 'No';
        reimbursementDate?: string | null;
        warnUntilReceipt?: boolean;
        notes?: string;
      };

      if (isUpdate && !expenseId) {
        return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
      }
      if (!accountId || !name?.trim() || !date || amount == null || !category || !paymentMethod) {
        return NextResponse.json({ error: 'Missing required expense fields' }, { status: 400 });
      }

      const owned = await assertAccountOwned(accountId, user.id, toolId);
      if (!owned) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      const reimbursed = reimbursedYet === 'Yes';
      const row = {
        account_id: accountId,
        user_id: user.id,
        tool_id: toolId,
        name: name.trim(),
        date,
        amount,
        provider_or_store: providerOrStore?.trim() ?? '',
        category,
        payment_method: paymentMethod,
        reimbursed,
        reimbursement_date: reimbursed && reimbursementDate ? reimbursementDate : null,
        warn_until_receipt: !!warnUntilReceipt,
        notes: notes?.trim() ?? '',
      };

      if (isUpdate) {
        const { data, error } = await supabaseServer
          .from('tools_hsa_expenses')
          .update(row)
          .eq('id', expenseId!)
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .select()
          .single();

        if (error) {
          console.error('HSA expense update error:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ expense: mapExpense(data as ExpenseRow) });
      }

      const { data, error } = await supabaseServer
        .from('tools_hsa_expenses')
        .insert(row)
        .select()
        .single();

      if (error) {
        console.error('HSA expense create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ expense: mapExpense(data as ExpenseRow) });
    }

    return NextResponse.json({ error: 'Invalid resource or action' }, { status: 400 });
  } catch (err) {
    console.error('HSA tracker POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
