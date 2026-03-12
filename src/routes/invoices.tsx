import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import { loginRequired, roleRequired } from '../middleware/auth.js';
import { generateInvoicePdf } from '../services/invoice-pdf.js';
import { InvoicesPage } from '../pages/invoices/InvoicesPage.js';
import { InvoiceDetailPage } from '../pages/invoices/InvoiceDetailPage.js';
import { AddInvoicePage } from '../pages/invoices/AddInvoicePage.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import {
  ValidationError,
  ensureDateOrder,
  normalizeInvoiceNumber,
  normalizeInvoicePrefix,
  optionalTrimmedString,
  parseIsoDate,
  parseMoney,
  parsePositiveInt,
} from '../lib/validation.js';

function renderApp(c: any, subtitle: string, content: any) {
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
  );
}

function invoiceStatus(amount: number, paid: number, dueDate: string): string {
  if (amount > 0 && paid >= amount) return 'Paid';

  const dueDateValue = new Date(`${dueDate}T23:59:59Z`);
  if (!Number.isNaN(dueDateValue.getTime()) && dueDateValue < new Date() && paid < amount) {
    return 'Overdue';
  }

  return 'Unpaid';
}

function nextInvoiceNumber(db: any, tenantId: number, invoicePrefix: string): string {
  const prefix = normalizeInvoicePrefix(invoicePrefix || 'INV');

  const row = db
    .prepare(
      `
        SELECT invoice_number
        FROM invoices
        WHERE tenant_id = ? AND invoice_number IS NOT NULL AND invoice_number != ''
        ORDER BY id DESC
        LIMIT 1
      `,
    )
    .get(tenantId) as { invoice_number: string } | undefined;

  if (!row) return `${prefix}-1001`;

  const lastNumber = String(row.invoice_number || '').trim().toUpperCase();
  const expectedPrefix = `${prefix}-`;

  if (lastNumber.startsWith(expectedPrefix)) {
    const suffix = lastNumber.slice(expectedPrefix.length);
    if (/^\d+$/.test(suffix)) {
      return `${prefix}-${Number.parseInt(suffix, 10) + 1}`;
    }
  }

  return `${prefix}-1001`;
}

function getTenantSettings(db: any, tenantId: number) {
  return db
    .prepare(
      `
        SELECT id, name, subdomain, logo_path, invoice_prefix,
               company_email, company_phone, company_address
        FROM tenants
        WHERE id = ?
      `,
    )
    .get(tenantId) as any;
}

function parseRouteId(raw: string, label: string): number {
  return parsePositiveInt(raw, label);
}

function buildInvoiceFormValues(
  body: Record<string, unknown>,
  fallbackInvoiceNumber: string,
  prefillJobId: number | null,
) {
  return {
    job_id: String(body['job_id'] ?? (prefillJobId ? String(prefillJobId) : '')),
    invoice_number: String(body['invoice_number'] ?? fallbackInvoiceNumber),
    amount: String(body['amount'] ?? ''),
    date_issued: String(body['date_issued'] ?? ''),
    due_date: String(body['due_date'] ?? ''),
    notes: String(body['notes'] ?? ''),
  };
}

export const invoiceRoutes = new Hono<AppEnv>();

invoiceRoutes.get('/invoices', loginRequired, (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const tenantId = tenant.id;
  const db = getDb();

  const invRows = db
    .prepare(
      `
        SELECT i.id, i.job_id, j.job_name, j.client_name,
               i.invoice_number, i.date_issued, i.due_date, i.amount, i.status
        FROM invoices i
        JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
        WHERE i.tenant_id = ?
        ORDER BY i.due_date DESC, i.id DESC
      `,
    )
    .all(tenantId) as any[];

  const paymentTotals = db
    .prepare(
      `
        SELECT invoice_id, COALESCE(SUM(amount), 0) as total_paid
        FROM payments
        WHERE tenant_id = ?
        GROUP BY invoice_id
      `,
    )
    .all(tenantId) as Array<{ invoice_id: number; total_paid: number }>;

  const paymentMap = new Map<number, number>();
  for (const row of paymentTotals) {
    paymentMap.set(row.invoice_id, Number(row.total_paid || 0));
  }

  const invoices: any[] = [];
  let totalOutstanding = 0;
  let totalOverdue = 0;

  for (const row of invRows) {
    const invoiceId = Number(row.id);
    const amount = Number.parseFloat(String(row.amount || 0));
    const paid = Number(paymentMap.get(invoiceId) || 0);

    const status = invoiceStatus(amount, paid, row.due_date);
    const outstanding = Math.max(amount - paid, 0);

    totalOutstanding += outstanding;
    if (status === 'Overdue') {
      totalOverdue += outstanding;
    }

    invoices.push({
      id: invoiceId,
      job_id: row.job_id,
      job_name: row.job_name,
      client: row.client_name,
      invoice_number: row.invoice_number,
      date_issued: row.date_issued,
      due_date: row.due_date,
      amount,
      paid,
      outstanding,
      status,
    });
  }

  return renderApp(
    c,
    'Invoices',
    <InvoicesPage
      invoices={invoices}
      totalOutstanding={totalOutstanding}
      totalOverdue={totalOverdue}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

invoiceRoutes.get('/add_invoice', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const tenantId = tenant.id;
  const db = getDb();

  const tenantSettings = getTenantSettings(db, tenantId);
  if (!tenantSettings) return c.text('Tenant not found', 404);

  const jobs = db
    .prepare(
      `
        SELECT id, job_name, client_name
        FROM jobs
        WHERE tenant_id = ?
        ORDER BY job_name ASC
      `,
    )
    .all(tenantId) as any[];

  const prefillJobIdRaw = c.req.query('job_id');
  const prefillJobId =
    prefillJobIdRaw && /^\d+$/.test(prefillJobIdRaw) ? Number.parseInt(prefillJobIdRaw, 10) : null;

  const suggestedInvoiceNumber = nextInvoiceNumber(
    db,
    tenantId,
    tenantSettings.invoice_prefix || 'INV',
  );

  return renderApp(
    c,
    'Create Invoice',
    <AddInvoicePage
      jobs={jobs}
      prefillJobId={prefillJobId}
      suggestedInvoiceNumber={suggestedInvoiceNumber}
      tenant={tenantSettings}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

invoiceRoutes.post('/add_invoice', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const tenantId = tenant.id;
  const db = getDb();

  const tenantSettings = getTenantSettings(db, tenantId);
  if (!tenantSettings) return c.text('Tenant not found', 404);

  const jobs = db
    .prepare(
      `
        SELECT id, job_name, client_name
        FROM jobs
        WHERE tenant_id = ?
        ORDER BY job_name ASC
      `,
    )
    .all(tenantId) as any[];

  const fallbackInvoiceNumber = nextInvoiceNumber(
    db,
    tenantId,
    tenantSettings.invoice_prefix || 'INV',
  );

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const formValues = buildInvoiceFormValues(body, fallbackInvoiceNumber, null);

  try {
    const jobId = parsePositiveInt(body['job_id'], 'Job');

    const rawInvoiceNumber = String(body['invoice_number'] ?? '').trim();
    const invoiceNumber = normalizeInvoiceNumber(
      rawInvoiceNumber || fallbackInvoiceNumber,
      tenantSettings.invoice_prefix || 'INV',
    );

    const dateIssued = parseIsoDate(body['date_issued'], 'Date issued');
    const dueDate = parseIsoDate(body['due_date'], 'Due date');
    ensureDateOrder(dateIssued, dueDate, 'date issued', 'Due date');

    const amount = parseMoney(body['amount'], 'Amount');
    const notes = optionalTrimmedString(body['notes'], 2000);

    const job = db
      .prepare('SELECT id FROM jobs WHERE id = ? AND tenant_id = ?')
      .get(jobId, tenantId) as { id: number } | undefined;

    if (!job) {
      throw new ValidationError('Selected job was not found for this company.');
    }

    const existingInvoice = db
      .prepare(
        `
          SELECT id
          FROM invoices
          WHERE tenant_id = ? AND UPPER(invoice_number) = UPPER(?)
          LIMIT 1
        `,
      )
      .get(tenantId, invoiceNumber) as { id: number } | undefined;

    if (existingInvoice) {
      throw new ValidationError('Invoice number already exists. Please choose a different one.');
    }

    db.prepare(
      `
        INSERT INTO invoices (job_id, invoice_number, date_issued, due_date, amount, status, notes, tenant_id)
        VALUES (?, ?, ?, ?, ?, 'Unpaid', ?, ?)
      `,
    ).run(jobId, invoiceNumber, dateIssued, dueDate, amount, notes, tenantId);

    return c.redirect('/invoices');
  } catch (error) {
    const message =
      error instanceof ValidationError ? error.message : 'Unable to create invoice right now.';

    return renderApp(
      c,
      'Create Invoice',
      <AddInvoicePage
        jobs={jobs}
        prefillJobId={null}
        suggestedInvoiceNumber={fallbackInvoiceNumber}
        tenant={tenantSettings}
        csrfToken={c.get('csrfToken')}
        error={message}
        formValues={formValues}
      />,
    );
  }
});

invoiceRoutes.get('/invoice/:id', loginRequired, (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  let invoiceId: number;
  try {
    invoiceId = parseRouteId(c.req.param('id'), 'Invoice');
  } catch {
    return c.text('Invoice not found', 404);
  }

  const tenantId = tenant.id;
  const db = getDb();

  const tenantSettings = getTenantSettings(db, tenantId);
  if (!tenantSettings) return c.text('Tenant not found', 404);

  const inv = db
    .prepare(
      `
        SELECT i.id, i.job_id, j.job_name, j.client_name,
               i.invoice_number, i.date_issued, i.due_date, i.amount, i.notes
        FROM invoices i
        JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
        WHERE i.id = ? AND i.tenant_id = ?
      `,
    )
    .get(invoiceId, tenantId) as any;

  if (!inv) return c.text('Invoice not found', 404);

  const amount = Number.parseFloat(String(inv.amount || 0));

  const payments = db
    .prepare(
      `
        SELECT id, date, amount, method, reference
        FROM payments
        WHERE invoice_id = ? AND tenant_id = ?
        ORDER BY date DESC, id DESC
      `,
    )
    .all(invoiceId, tenantId) as any[];

  const paidRow = db
    .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoice_id = ? AND tenant_id = ?')
    .get(invoiceId, tenantId) as any;

  const paid = Number.parseFloat(String(paidRow?.total || 0));
  const status = invoiceStatus(amount, paid, inv.due_date);
  const outstanding = Math.max(amount - paid, 0);

  const newStatus = status === 'Paid' ? 'Paid' : 'Unpaid';
  db.prepare('UPDATE invoices SET status = ? WHERE id = ? AND tenant_id = ?').run(
    newStatus,
    invoiceId,
    tenantId,
  );

  return renderApp(
    c,
    'Invoice Detail',
    <InvoiceDetailPage
      inv={inv}
      payments={payments}
      paid={paid}
      outstanding={outstanding}
      status={status}
      tenant={tenantSettings}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

invoiceRoutes.get('/invoice/:id/pdf', loginRequired, async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  let invoiceId: number;
  try {
    invoiceId = parseRouteId(c.req.param('id'), 'Invoice');
  } catch {
    return c.text('Invoice not found', 404);
  }

  const tenantId = tenant.id;
  const db = getDb();

  const tenantSettings = getTenantSettings(db, tenantId);
  if (!tenantSettings) return c.text('Tenant not found', 404);

  const inv = db
    .prepare(
      `
        SELECT i.id, i.job_id, j.job_name, j.client_name,
               i.invoice_number, i.date_issued, i.due_date, i.amount, i.notes
        FROM invoices i
        JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
        WHERE i.id = ? AND i.tenant_id = ?
      `,
    )
    .get(invoiceId, tenantId) as any;

  if (!inv) return c.text('Invoice not found', 404);

  const amount = Number.parseFloat(String(inv.amount || 0));

  const paidRow = db
    .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoice_id = ? AND tenant_id = ?')
    .get(invoiceId, tenantId) as any;

  const paid = Number.parseFloat(String(paidRow?.total || 0));
  const outstanding = Math.max(amount - paid, 0);
  const status = outstanding <= 0 ? 'PAID' : 'UNPAID';

  const label = inv.invoice_number || `#${inv.id}`;

  const pdfBytes = await generateInvoicePdf({
    tenant: {
      name: tenantSettings.name,
      company_address: tenantSettings.company_address,
      company_email: tenantSettings.company_email,
      company_phone: tenantSettings.company_phone,
    },
    invoice: {
      id: inv.id,
      invoice_number: inv.invoice_number,
      date_issued: inv.date_issued,
      due_date: inv.due_date,
      amount,
      notes: inv.notes,
    },
    job: {
      job_name: inv.job_name,
      client_name: inv.client_name,
    },
    paid,
    outstanding,
    status,
  });

  const filename = `invoice_${String(label).replace(/ /g, '_').replace(/#/g, '')}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

invoiceRoutes.post('/delete_invoice/:id', roleRequired('Admin'), async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  let invoiceId: number;
  try {
    invoiceId = parseRouteId(c.req.param('id'), 'Invoice');
  } catch {
    return c.text('Invoice not found', 404);
  }

  const tenantId = tenant.id;
  const db = getDb();

  const invoice = db
    .prepare('SELECT id FROM invoices WHERE id = ? AND tenant_id = ?')
    .get(invoiceId, tenantId) as { id: number } | undefined;

  if (!invoice) {
    return c.text('Invoice not found', 404);
  }

  db.prepare('DELETE FROM payments WHERE invoice_id = ? AND tenant_id = ?').run(invoiceId, tenantId);
  db.prepare('DELETE FROM invoices WHERE id = ? AND tenant_id = ?').run(invoiceId, tenantId);

  return c.redirect('/invoices');
});