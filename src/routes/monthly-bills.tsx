import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import * as monthlyBills from '../db/queries/monthly-bills.js';
import { permissionRequired, userHasPermission } from '../middleware/auth.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { MonthlyBillsPage } from '../pages/financials/MonthlyBillsPage.js';

function renderApp(c: any, subtitle: string, content: any, status: 200 | 400 = 200) {
  return c.html(
    <AppLayout
      currentTenant={c.get('tenant')}
      currentSubdomain={c.get('subdomain')}
      currentUser={c.get('user')}
      appName={process.env.APP_NAME || 'Hudson Business Solutions'}
      appLogo={process.env.APP_LOGO || '/static/brand/hudson-business-solutions-logo.png'}
      path={c.req.path}
      csrfToken={c.get('csrfToken')}
      subtitle={subtitle}
    >
      {content}
    </AppLayout>,
    status as any,
  );
}

function parsePositiveInt(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseMoney(value: unknown, label: string): number {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error(`${label} is required.`);
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error(`${label} must be a valid number with up to 2 decimals.`);
  const amount = Number.parseFloat(raw);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`${label} must be greater than 0.`);
  return Number(amount.toFixed(2));
}

function parseDueDay(value: unknown): number {
  const parsed = parsePositiveInt(value);
  if (!parsed || parsed < 1 || parsed > 31) {
    throw new Error('Due day must be between 1 and 31.');
  }
  return parsed;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

function requireDate(value: unknown, label: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error(`${label} is required.`);
  if (!isIsoDate(raw)) throw new Error(`${label} must be a valid date.`);
  return raw;
}

function optionalDate(value: unknown, label: string): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (!isIsoDate(raw)) throw new Error(`${label} must be a valid date.`);
  return raw;
}

function requireText(value: unknown, label: string, maxLength: number): string {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error(`${label} is required.`);
  if (raw.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or less.`);
  return raw;
}

function optionalText(value: unknown, label: string, maxLength: number): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (raw.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or less.`);
  return raw;
}

function buildFormData(source: Record<string, unknown>, defaults?: { effective_start_date?: string }) {
  return {
    name: String(source.name ?? ''),
    category: String(source.category ?? ''),
    vendor: String(source.vendor ?? ''),
    amount: String(source.amount ?? ''),
    due_day: String(source.due_day ?? '1'),
    effective_start_date: String(source.effective_start_date ?? defaults?.effective_start_date ?? new Date().toISOString().slice(0, 10)),
    end_date: String(source.end_date ?? ''),
    active: String(source.active ?? '1'),
    notes: String(source.notes ?? ''),
  };
}

function loadPageData(db: any, tenantId: number) {
  const today = new Date().toISOString().slice(0, 10);
  const bills = monthlyBills.listByTenant(db, tenantId, true).map((bill) => ({
    ...bill,
    next_due_date: monthlyBills.nextDueDate(bill, today),
  }));

  const monthStart = new Date();
  const currentYearMonth = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
  const nextThirtyDaysEnd = new Date();
  nextThirtyDaysEnd.setDate(nextThirtyDaysEnd.getDate() + 30);
  const nextThirtyDays = nextThirtyDaysEnd.toISOString().slice(0, 10);

  return {
    bills,
    summary: {
      activeCount: bills.filter((bill) => !bill.archived_at && bill.active === 1).length,
      archivedCount: bills.filter((bill) => !!bill.archived_at).length,
      scheduledThisMonth: monthlyBills.sumScheduledByTenantMonthToDate(db, tenantId, currentYearMonth),
      nextThirtyDays: monthlyBills.listOccurrencesForRange(db, tenantId, today, nextThirtyDays)
        .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    },
  };
}

function renderList(
  c: any,
  options?: {
    error?: string;
    success?: string;
    formData?: ReturnType<typeof buildFormData>;
    editingBillId?: number | null;
  },
  status: 200 | 400 = 200,
) {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const db = getDb();
  const { bills, summary } = loadPageData(db, tenant.id);

  return renderApp(
    c,
    'Monthly Bills',
    <MonthlyBillsPage
      bills={bills}
      summary={summary}
      formData={options?.formData || buildFormData({}, { effective_start_date: new Date().toISOString().slice(0, 10) })}
      editingBillId={options?.editingBillId || null}
      error={options?.error}
      success={options?.success}
      csrfToken={c.get('csrfToken')}
      canManage={userHasPermission(currentUser, 'financials.edit')}
    />,
    status,
  );
}

export const monthlyBillRoutes = new Hono<AppEnv>();

monthlyBillRoutes.get('/monthly-bills', permissionRequired('financials.view'), (c) => {
  const tenant = c.get('tenant');
  const db = getDb();
  const editId = parsePositiveInt(c.req.query('edit'));

  if (!editId) {
    return renderList(c, { success: c.req.query('success') || undefined });
  }

  const bill = monthlyBills.findById(db, editId, tenant.id);
  if (!bill || bill.archived_at) {
    return renderList(c, { error: 'Monthly bill not found.' }, 400);
  }

  return renderList(c, {
    success: c.req.query('success') || undefined,
    editingBillId: bill.id,
    formData: buildFormData(bill),
  });
});

monthlyBillRoutes.post('/monthly-bills', permissionRequired('financials.edit'), async (c) => {
  const tenant = c.get('tenant');
  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const db = getDb();

  try {
    const name = requireText(body.name, 'Bill name', 120);
    const category = optionalText(body.category, 'Category', 80);
    const vendor = optionalText(body.vendor, 'Vendor', 120);
    const amount = parseMoney(body.amount, 'Amount');
    const dueDay = parseDueDay(body.due_day);
    const effectiveStartDate = requireDate(body.effective_start_date, 'Effective start date');
    const endDate = optionalDate(body.end_date, 'End date');
    const active = String(body.active ?? '1') === '0' ? 0 : 1;
    const notes = optionalText(body.notes, 'Notes', 500);

    if (endDate && endDate < effectiveStartDate) {
      throw new Error('End date cannot be earlier than the effective start date.');
    }

    monthlyBills.create(db, tenant.id, {
      name,
      category,
      vendor,
      amount,
      due_day: dueDay,
      effective_start_date: effectiveStartDate,
      end_date: endDate,
      active,
      notes,
    });

    return c.redirect('/monthly-bills?success=Monthly%20bill%20added');
  } catch (error) {
    return renderList(c, {
      error: error instanceof Error ? error.message : 'Unable to save monthly bill.',
      formData: buildFormData(body),
    }, 400);
  }
});

monthlyBillRoutes.post('/monthly-bills/:id/update', permissionRequired('financials.edit'), async (c) => {
  const tenant = c.get('tenant');
  const billId = parsePositiveInt(c.req.param('id'));
  const db = getDb();
  const body = (await c.req.parseBody()) as Record<string, unknown>;

  if (!billId) {
    return renderList(c, { error: 'Monthly bill not found.' }, 400);
  }

  const existing = monthlyBills.findById(db, billId, tenant.id);
  if (!existing || existing.archived_at) {
    return renderList(c, { error: 'Monthly bill not found.' }, 400);
  }

  try {
    const name = requireText(body.name, 'Bill name', 120);
    const category = optionalText(body.category, 'Category', 80);
    const vendor = optionalText(body.vendor, 'Vendor', 120);
    const amount = parseMoney(body.amount, 'Amount');
    const dueDay = parseDueDay(body.due_day);
    const effectiveStartDate = requireDate(body.effective_start_date, 'Effective start date');
    const endDate = optionalDate(body.end_date, 'End date');
    const active = String(body.active ?? '1') === '0' ? 0 : 1;
    const notes = optionalText(body.notes, 'Notes', 500);

    if (endDate && endDate < effectiveStartDate) {
      throw new Error('End date cannot be earlier than the effective start date.');
    }

    monthlyBills.update(db, billId, tenant.id, {
      name,
      category,
      vendor,
      amount,
      due_day: dueDay,
      effective_start_date: effectiveStartDate,
      end_date: endDate,
      active,
      notes,
    });

    return c.redirect('/monthly-bills?success=Monthly%20bill%20updated');
  } catch (error) {
    return renderList(c, {
      error: error instanceof Error ? error.message : 'Unable to update monthly bill.',
      editingBillId: billId,
      formData: buildFormData(body),
    }, 400);
  }
});

monthlyBillRoutes.post('/monthly-bills/:id/archive', permissionRequired('financials.edit'), (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const billId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!billId) {
    return renderList(c, { error: 'Monthly bill not found.' }, 400);
  }

  const existing = monthlyBills.findById(db, billId, tenant.id);
  if (!existing || existing.archived_at) {
    return renderList(c, { error: 'Monthly bill not found.' }, 400);
  }

  monthlyBills.archive(db, billId, tenant.id, currentUser.id);
  return c.redirect('/monthly-bills?success=Monthly%20bill%20archived');
});

monthlyBillRoutes.post('/monthly-bills/:id/restore', permissionRequired('financials.edit'), (c) => {
  const tenant = c.get('tenant');
  const billId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!billId) {
    return renderList(c, { error: 'Monthly bill not found.' }, 400);
  }

  const existing = monthlyBills.findById(db, billId, tenant.id);
  if (!existing || !existing.archived_at) {
    return renderList(c, { error: 'Monthly bill not found.' }, 400);
  }

  monthlyBills.restore(db, billId, tenant.id);
  return c.redirect('/monthly-bills?success=Monthly%20bill%20restored');
});
