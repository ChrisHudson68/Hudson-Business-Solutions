import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import { roleRequired } from '../middleware/auth.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { InvoiceDetailPage } from '../pages/invoices/InvoiceDetailPage.js';

function renderApp(c: any, subtitle: string, content: any, status: 200 | 400 | 404 = 200) {
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

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;

  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function parsePaymentAmount(value: unknown): number {
  const raw = String(value ?? '').trim();

  if (!raw) {
    throw new Error('Payment amount is required.');
  }

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error('Payment amount must be a valid number with up to 2 decimal places.');
  }

  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Payment amount must be greater than 0.');
  }

  return Number(parsed.toFixed(2));
}

function requirePaymentDate(value: unknown): string {
  const raw = String(value ?? '').trim();

  if (!raw) {
    throw new Error('Payment date is required.');
  }

  if (!isRealIsoDate(raw)) {
    throw new Error('Payment date must be a valid date.');
  }

  return raw;
}

function normalizeOptionalText(value: unknown, fieldLabel: string, maxLength: number): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  if (raw.length > maxLength) {
    throw new Error(`${fieldLabel} must be ${maxLength} characters or less.`);
  }

  return raw;
}

function invoiceStatus(amount: number, paid: number, dueDate: string): string {
  if (amount > 0 && paid >= amount) return 'Paid';

  const dueDateValue = new Date(`${dueDate}T23:59:59Z`);
  if (!Number.isNaN(dueDateValue.getTime()) && dueDateValue < new Date() && paid < amount) {
    return 'Overdue';
  }

  return 'Unpaid';
}

function getTenantSettings(db: any, tenantId: number) {
  return db.prepare(`
    SELECT id, name, subdomain, logo_path, invoice_prefix,
           company_email, company_phone, company_address
    FROM tenants
    WHERE id = ?
  `).get(tenantId) as any;
}

function loadInvoiceDetailData(db: any, tenantId: number, invoiceId: number) {
  const tenantSettings = getTenantSettings(db, tenantId);

  const inv = db.prepare(`
    SELECT i.id, i.job_id, j.job_name, j.client_name,
           i.invoice_number, i.date_issued, i.due_date, i.amount, i.notes
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.id = ? AND i.tenant_id = ?
  `).get(invoiceId, tenantId) as any;

  if (!tenantSettings || !inv) {
    return null;
  }

  const payments = db.prepare(`
    SELECT id, date, amount, method, reference
    FROM payments
    WHERE invoice_id = ? AND tenant_id = ?
    ORDER BY date DESC, id DESC
  `).all(invoiceId, tenantId) as any[];

  const paidRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM payments
    WHERE invoice_id = ? AND tenant_id = ?
  `).get(invoiceId, tenantId) as { total: number };

  const amount = Number(inv.amount || 0);
  const paid = Number(paidRow?.total || 0);
  const outstanding = Math.max(amount - paid, 0);
  const status = invoiceStatus(amount, paid, inv.due_date);
  const persistedStatus = status === 'Paid' ? 'Paid' : 'Unpaid';

  db.prepare(`
    UPDATE invoices
    SET status = ?
    WHERE id = ? AND tenant_id = ?
  `).run(persistedStatus, invoiceId, tenantId);

  return {
    inv,
    tenant: tenantSettings,
    payments,
    paid,
    outstanding,
    status,
  };
}

function renderInvoiceDetail(
  c: any,
  tenantId: number,
  invoiceId: number,
  options?: {
    error?: string;
    success?: string;
    paymentForm?: {
      date?: string;
      amount?: string;
      method?: string;
      reference?: string;
    };
  },
  statusCode: 200 | 400 | 404 = 200,
) {
  const db = getDb();
  const data = loadInvoiceDetailData(db, tenantId, invoiceId);

  if (!data) {
    return c.text('Invoice not found', 404);
  }

  return renderApp(
    c,
    'Invoice Detail',
    <InvoiceDetailPage
      inv={data.inv}
      payments={data.payments}
      paid={data.paid}
      outstanding={data.outstanding}
      status={data.status}
      tenant={data.tenant}
      csrfToken={c.get('csrfToken')}
      error={options?.error}
      success={options?.success}
      paymentForm={options?.paymentForm}
    />,
    statusCode,
  );
}

export const paymentRoutes = new Hono<AppEnv>();

paymentRoutes.post('/add_payment/:id', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');
  const tenantId = tenant.id;

  const invoiceId = parsePositiveInt(c.req.param('id'));
  if (!invoiceId) {
    return c.text('Invoice not found', 404);
  }

  const body = (await c.req.parseBody()) as Record<string, unknown>;

  const formValues = {
    date: String(body['date'] ?? ''),
    amount: String(body['amount'] ?? ''),
    method: String(body['method'] ?? ''),
    reference: String(body['reference'] ?? ''),
  };

  try {
    const db = getDb();

    const inv = db.prepare(`
      SELECT id, amount, date_issued
      FROM invoices
      WHERE id = ? AND tenant_id = ?
    `).get(invoiceId, tenantId) as
      | { id: number; amount: number; date_issued: string }
      | undefined;

    if (!inv) {
      return c.text('Invoice not found', 404);
    }

    const date = requirePaymentDate(body['date']);
    const amount = parsePaymentAmount(body['amount']);
    const method = normalizeOptionalText(body['method'], 'Method', 60);
    const reference = normalizeOptionalText(body['reference'], 'Reference', 120);

    if (date < String(inv.date_issued)) {
      throw new Error('Payment date cannot be earlier than the invoice issue date.');
    }

    const paidRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payments
      WHERE invoice_id = ? AND tenant_id = ?
    `).get(invoiceId, tenantId) as { total: number };

    const currentlyPaid = Number(paidRow?.total || 0);
    const invoiceAmount = Number(inv.amount || 0);

    if (currentlyPaid + amount > invoiceAmount) {
      throw new Error('Payment amount would exceed the invoice balance.');
    }

    db.prepare(`
      INSERT INTO payments (invoice_id, date, amount, method, reference, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(invoiceId, date, amount, method, reference, tenantId);

    return renderInvoiceDetail(
      c,
      tenantId,
      invoiceId,
      {
        success: 'Payment added successfully.',
        paymentForm: {
          date: '',
          amount: '',
          method: '',
          reference: '',
        },
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add payment.';

    return renderInvoiceDetail(
      c,
      tenantId,
      invoiceId,
      {
        error: message,
        paymentForm: formValues,
      },
      400,
    );
  }
});

paymentRoutes.post('/delete_payment/:paymentId/:invoiceId', roleRequired('Admin'), async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');
  const tenantId = tenant.id;

  const paymentId = parsePositiveInt(c.req.param('paymentId'));
  const invoiceId = parsePositiveInt(c.req.param('invoiceId'));

  if (!paymentId || !invoiceId) {
    return c.text('Payment not found', 404);
  }

  const db = getDb();

  const payment = db.prepare(`
    SELECT id, invoice_id
    FROM payments
    WHERE id = ? AND tenant_id = ?
  `).get(paymentId, tenantId) as { id: number; invoice_id: number } | undefined;

  if (!payment || payment.invoice_id !== invoiceId) {
    return c.text('Payment not found', 404);
  }

  const inv = db.prepare(`
    SELECT id
    FROM invoices
    WHERE id = ? AND tenant_id = ?
  `).get(invoiceId, tenantId) as { id: number } | undefined;

  if (!inv) {
    return c.text('Invoice not found', 404);
  }

  db.prepare(`
    DELETE FROM payments
    WHERE id = ? AND tenant_id = ?
  `).run(paymentId, tenantId);

  return renderInvoiceDetail(
    c,
    tenantId,
    invoiceId,
    {
      success: 'Payment deleted successfully.',
    },
    200,
  );
});

export default paymentRoutes;