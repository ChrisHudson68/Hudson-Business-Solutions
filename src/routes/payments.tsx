import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import { permissionRequired, userHasPermission } from '../middleware/auth.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';
import { ValidationError, optionalTrimmedString, parseIsoDate, parseMoney, parsePositiveInt } from '../lib/validation.js';
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

function invoiceStatus(amount: number, paid: number, dueDate: string): string {
  if (amount > 0 && paid >= amount) return 'Paid';

  const dueDateValue = new Date(`${dueDate}T23:59:59Z`);
  if (!Number.isNaN(dueDateValue.getTime()) && dueDateValue < new Date() && paid < amount) {
    return 'Overdue';
  }

  return 'Unpaid';
}

function parseRouteId(raw: string, label: string): number {
  return parsePositiveInt(raw, label);
}

function loadInvoiceDetailData(db: any, tenantId: number, invoiceId: number) {
  const tenantSettings = db
    .prepare(
      `
        SELECT id, name, subdomain, logo_path, invoice_prefix,
               company_email, company_phone, company_address
        FROM tenants
        WHERE id = ?
      `,
    )
    .get(tenantId) as any;

  const inv = db
    .prepare(
      `
        SELECT i.id, i.job_id, j.job_name, j.client_name,
               i.invoice_number, i.date_issued, i.due_date, i.amount, i.notes, i.archived_at
        FROM invoices i
        JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
        WHERE i.id = ? AND i.tenant_id = ?
      `,
    )
    .get(invoiceId, tenantId) as any;

  if (!tenantSettings || !inv) {
    return null;
  }

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
    .prepare(
      `
        SELECT COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE invoice_id = ? AND tenant_id = ?
      `,
    )
    .get(invoiceId, tenantId) as { total: number };

  const amount = Number.parseFloat(String(inv.amount || 0));
  const paid = Number.parseFloat(String(paidRow?.total || 0));
  const status = invoiceStatus(amount, paid, inv.due_date);
  const outstanding = Math.max(amount - paid, 0);
  const paymentCount = payments.length;

  db.prepare(
    `
      UPDATE invoices
      SET status = ?
      WHERE id = ? AND tenant_id = ?
    `,
  ).run(status === 'Paid' ? 'Paid' : 'Unpaid', invoiceId, tenantId);

  return {
    inv,
    tenant: tenantSettings,
    payments,
    paid,
    outstanding,
    status,
    paymentCount,
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
      paymentCount={data.paymentCount}
      csrfToken={c.get('csrfToken')}
      error={options?.error}
      success={options?.success}
      paymentForm={options?.paymentForm}
      canArchiveInvoices={userHasPermission(c.get('user'), 'invoices.archive')}
      canManagePayments={userHasPermission(c.get('user'), 'payments.manage')}
      canEditInvoices={userHasPermission(c.get('user'), 'invoices.edit')}
    />,
    statusCode,
  );
}

export const paymentRoutes = new Hono<AppEnv>();

paymentRoutes.post('/add_payment/:invoiceId', permissionRequired('payments.manage'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  let invoiceId: number;
  try {
    invoiceId = parseRouteId(c.req.param('invoiceId'), 'Invoice');
  } catch {
    return c.text('Invoice not found', 404);
  }

  const tenantId = tenant.id;
  const db = getDb();

  const invoice = db
    .prepare(
      `
        SELECT i.id, i.invoice_number, i.amount, i.job_id, i.archived_at, j.job_name
        FROM invoices i
        JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
        WHERE i.id = ? AND i.tenant_id = ?
      `,
    )
    .get(invoiceId, tenantId) as
      | { id: number; invoice_number: string | null; amount: number; job_id: number; archived_at: string | null; job_name: string }
      | undefined;

  if (!invoice) {
    return c.text('Invoice not found', 404);
  }

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const paymentForm = {
    date: String(body['date'] ?? ''),
    amount: String(body['amount'] ?? ''),
    method: String(body['method'] ?? ''),
    reference: String(body['reference'] ?? ''),
  };

  try {
    if (invoice.archived_at) {
      throw new ValidationError('Cannot add a payment to an archived invoice.');
    }

    const date = parseIsoDate(body['date'], 'Payment date');
    const amount = parseMoney(body['amount'], 'Payment amount');
    const method = optionalTrimmedString(body['method'], 120);
    const reference = optionalTrimmedString(body['reference'], 120);

    const paidRow = db
      .prepare(
        `
          SELECT COALESCE(SUM(amount), 0) as total
          FROM payments
          WHERE invoice_id = ? AND tenant_id = ?
        `,
      )
      .get(invoiceId, tenantId) as { total: number };

    const currentPaid = Number(paidRow?.total || 0);
    const invoiceAmount = Number(invoice.amount || 0);

    if (currentPaid + amount > invoiceAmount) {
      throw new ValidationError('Payment exceeds remaining invoice balance.');
    }

    const result = db.prepare(
      `
        INSERT INTO payments (invoice_id, date, amount, method, reference, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    ).run(invoiceId, date, amount, method, reference, tenantId);

    const paymentId = Number(result.lastInsertRowid);

    logActivity(db, {
      tenantId,
      actorUserId: currentUser.id,
      eventType: 'payment.created',
      entityType: 'payment',
      entityId: paymentId,
      description: `${currentUser.name} added a payment to invoice ${invoice.invoice_number || `#${invoiceId}`}.`,
      metadata: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        job_id: invoice.job_id,
        job_name: invoice.job_name,
        amount,
        date,
        method,
        reference,
      },
      ipAddress: resolveRequestIp(c),
    });

    return renderInvoiceDetail(
      c,
      tenantId,
      invoiceId,
      {
        success: 'Payment added successfully.',
      },
      200,
    );
  } catch (error) {
    const message =
      error instanceof ValidationError ? error.message : 'Unable to add payment right now.';

    return renderInvoiceDetail(
      c,
      tenantId,
      invoiceId,
      {
        error: message,
        paymentForm,
      },
      400,
    );
  }
});

paymentRoutes.post('/delete_payment/:paymentId/:invoiceId', permissionRequired('payments.manage'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  let paymentId: number;
  let invoiceId: number;
  try {
    paymentId = parseRouteId(c.req.param('paymentId'), 'Payment');
    invoiceId = parseRouteId(c.req.param('invoiceId'), 'Invoice');
  } catch {
    return c.text('Payment not found', 404);
  }

  const tenantId = tenant.id;
  const db = getDb();

  const payment = db
    .prepare(
      `
        SELECT
          p.id,
          p.invoice_id,
          p.date,
          p.amount,
          p.method,
          p.reference,
          i.invoice_number,
          i.job_id,
          i.archived_at,
          j.job_name
        FROM payments p
        JOIN invoices i
          ON i.id = p.invoice_id
         AND i.tenant_id = p.tenant_id
        JOIN jobs j
          ON j.id = i.job_id
         AND j.tenant_id = i.tenant_id
        WHERE p.id = ? AND p.invoice_id = ? AND p.tenant_id = ?
      `,
    )
    .get(paymentId, invoiceId, tenantId) as
      | {
          id: number;
          invoice_id: number;
          date: string;
          amount: number;
          method: string | null;
          reference: string | null;
          invoice_number: string | null;
          job_id: number;
          archived_at: string | null;
          job_name: string;
        }
      | undefined;

  if (!payment) {
    return c.text('Payment not found', 404);
  }

  if (payment.archived_at) {
    return renderInvoiceDetail(
      c,
      tenantId,
      invoiceId,
      {
        error: 'Cannot delete a payment while its invoice is archived. Restore the invoice first.',
      },
      400,
    );
  }

  db.prepare(
    `
      DELETE FROM payments
      WHERE id = ? AND invoice_id = ? AND tenant_id = ?
    `,
  ).run(paymentId, invoiceId, tenantId);

  logActivity(db, {
    tenantId,
    actorUserId: currentUser.id,
    eventType: 'payment.deleted',
    entityType: 'payment',
    entityId: paymentId,
    description: `${currentUser.name} deleted a payment from invoice ${payment.invoice_number || `#${invoiceId}`}.`,
    metadata: {
      invoice_id: payment.invoice_id,
      invoice_number: payment.invoice_number,
      job_id: payment.job_id,
      job_name: payment.job_name,
      amount: Number(payment.amount || 0),
      date: payment.date,
      method: payment.method,
      reference: payment.reference,
    },
    ipAddress: resolveRequestIp(c),
  });

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