import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/connection.js';
import { loginRequired, permissionRequired, userHasPermission } from '../middleware/auth.js';
import { generateInvoicePdf } from '../services/invoice-pdf.js';
import {
  applyInvoiceDraftUpdate,
  buildInvoiceDraftFormFromBody,
  buildLegacyLineItem,
  createEmptyInvoiceDraftForm,
  loadInvoiceLineItems,
  parseInvoiceDraftFields,
  parseInvoiceLineItems,
} from '../services/invoice-v2.js';
import {
  DOCUMENT_ATTACHMENT_EXTENSIONS,
  DOCUMENT_ATTACHMENT_MIME_TYPES,
  saveUploadedFile,
  buildTenantScopedStoredPath,
  buildTenantScopedUploadDir,
  resolveUploadedFilePath,
  inferMimeTypeFromStoredFilename,
  buildSafeDownloadFilename,
  deleteUploadedFile,
} from '../services/file-upload.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';
import { InvoicesPage } from '../pages/invoices/InvoicesPage.js';
import { InvoiceDetailPage } from '../pages/invoices/InvoiceDetailPage.js';
import { AddInvoicePage } from '../pages/invoices/AddInvoicePage.js';
import { EditInvoicePage } from '../pages/invoices/EditInvoicePage.js';
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
import { getEnv } from '../config/env.js';

const invoiceAttachmentRootDir = path.join(getEnv().uploadDir, 'invoice_attachments');

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
               company_email, company_phone, company_address, company_website
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

function loadInvoiceDetailData(db: any, tenantId: number, invoiceId: number) {
  const tenantSettings = getTenantSettings(db, tenantId);

  const inv = db
    .prepare(
      `
        SELECT
          i.id,
          i.job_id,
          j.job_name,
          j.client_name,
          i.invoice_number,
          i.date_issued,
          i.due_date,
          i.amount,
          i.notes,
          i.attachment_filename,
          i.archived_at
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

  const newStatus = status === 'Paid' ? 'Paid' : 'Unpaid';
  db.prepare(
    `
      UPDATE invoices
      SET status = ?
      WHERE id = ? AND tenant_id = ?
    `,
  ).run(newStatus, invoiceId, tenantId);

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

export const invoiceRoutes = new Hono<AppEnv>();

invoiceRoutes.get('/invoices', permissionRequired('invoices.view'), (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const tenantId = tenant.id;
  const db = getDb();
  const showArchived = c.req.query('show_archived') === '1';

  const invRows = db
    .prepare(
      `
        SELECT
          i.id,
          i.job_id,
          j.job_name,
          j.client_name,
          i.invoice_number,
          i.date_issued,
          i.due_date,
          i.amount,
          i.status,
          i.attachment_filename,
          i.archived_at
        FROM invoices i
        JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
        WHERE i.tenant_id = ?
          AND ${showArchived ? 'i.archived_at IS NOT NULL' : 'i.archived_at IS NULL'}
        ORDER BY i.due_date DESC, i.id DESC
      `,
    )
    .all(tenantId) as any[];

  const paymentTotals = db
    .prepare(
      `
        SELECT invoice_id, COALESCE(SUM(amount), 0) as total_paid, COUNT(*) as payment_count
        FROM payments
        WHERE tenant_id = ?
        GROUP BY invoice_id
      `,
    )
    .all(tenantId) as Array<{ invoice_id: number; total_paid: number; payment_count: number }>;

  const paymentMap = new Map<number, { totalPaid: number; paymentCount: number }>();
  for (const row of paymentTotals) {
    paymentMap.set(row.invoice_id, {
      totalPaid: Number(row.total_paid || 0),
      paymentCount: Number(row.payment_count || 0),
    });
  }

  const invoices: any[] = [];
  let totalOutstanding = 0;
  let totalOverdue = 0;

  for (const row of invRows) {
    const invoiceId = Number(row.id);
    const amount = Number.parseFloat(String(row.amount || 0));
    const paymentInfo = paymentMap.get(invoiceId) || { totalPaid: 0, paymentCount: 0 };
    const paid = Number(paymentInfo.totalPaid || 0);

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
      payment_count: paymentInfo.paymentCount,
      attachment_filename: row.attachment_filename || null,
      archived_at: row.archived_at || null,
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
      showArchived={showArchived}
      canArchiveInvoices={userHasPermission(c.get('user'), 'invoices.archive')}
      canCreateInvoices={userHasPermission(c.get('user'), 'invoices.create')}
    />,
  );
});

invoiceRoutes.get('/add_invoice', permissionRequired('invoices.create'), (c) => {
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
        WHERE tenant_id = ? AND archived_at IS NULL
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
      formValues={createEmptyInvoiceDraftForm({
        job_id: prefillJobId ? String(prefillJobId) : '',
        invoice_number: suggestedInvoiceNumber,
      })}
    />,
  );
});

invoiceRoutes.post('/add_invoice', permissionRequired('invoices.create'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const tenantId = tenant.id;
  const db = getDb();
  const env = getEnv();

  const tenantSettings = getTenantSettings(db, tenantId);
  if (!tenantSettings) return c.text('Tenant not found', 404);

  const jobs = db
    .prepare(
      `
        SELECT id, job_name, client_name
        FROM jobs
        WHERE tenant_id = ? AND archived_at IS NULL
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
  const formValues = buildInvoiceDraftFormFromBody(body, fallbackInvoiceNumber);

  let attachmentFilename: string | null = null;

  try {
    const jobId = parsePositiveInt(body['job_id'], 'Job');

    const rawInvoiceNumber = String(body['invoice_number'] ?? '').trim();
    const invoiceNumber = normalizeInvoiceNumber(
      rawInvoiceNumber || fallbackInvoiceNumber,
      tenantSettings.invoice_prefix || 'INV',
    );

    const lineItems = parseInvoiceLineItems(body);
    const draft = parseInvoiceDraftFields(body, lineItems);

    ensureDateOrder(draft.issueDate, draft.dueDate, 'Issue date', 'Due date');

    const job = db
      .prepare(
        `
          SELECT id, job_name, client_name, job_code
          FROM jobs
          WHERE id = ? AND tenant_id = ? AND archived_at IS NULL
          LIMIT 1
        `,
      )
      .get(jobId, tenantId) as
      | { id: number; job_name: string; client_name: string | null; job_code: string | null }
      | undefined;

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

    const attachment = body['attachment'];
    if (attachment && attachment instanceof File && attachment.size > 0) {
      const tenantAttachmentDir = buildTenantScopedUploadDir(invoiceAttachmentRootDir, tenantId);
      const savedFilename = await saveUploadedFile(attachment, tenantAttachmentDir, {
        allowedExtensions: DOCUMENT_ATTACHMENT_EXTENSIONS,
        allowedMimeTypes: DOCUMENT_ATTACHMENT_MIME_TYPES,
        maxBytes: env.maxReceiptUploadBytes,
      });

      attachmentFilename = buildTenantScopedStoredPath(tenantId, savedFilename);
    }

    const result = db.prepare(
      `
        INSERT INTO invoices (
          job_id,
          invoice_number,
          date_issued,
          due_date,
          amount,
          status,
          notes,
          attachment_filename,
          tenant_id,
          created_by_user_id,
          archived_at,
          archived_by_user_id
        )
        VALUES (?, ?, ?, ?, ?, 'Draft', ?, ?, ?, ?, NULL, NULL)
      `,
    ).run(
      jobId,
      invoiceNumber,
      draft.issueDate,
      draft.dueDate,
      draft.totals.total,
      draft.publicNotes,
      attachmentFilename,
      tenantId,
      currentUser.id,
    );

    const invoiceId = Number(result.lastInsertRowid);

    applyInvoiceDraftUpdate(db, {
      tenantId,
      invoiceId,
      jobId,
      invoiceNumber,
      issueDate: draft.issueDate,
      dueDate: draft.dueDate,
      customerName: draft.customerName,
      customerEmail: draft.customerEmail,
      customerPhone: draft.customerPhone,
      customerAddress: draft.customerAddress,
      companyName: tenantSettings.name,
      companyEmail: tenantSettings.company_email,
      companyPhone: tenantSettings.company_phone,
      companyAddress: tenantSettings.company_address,
      companyWebsite: tenantSettings.company_website ?? null,
      companyLogoPath: tenantSettings.logo_path,
      jobName: job.job_name,
      jobCode: job.job_code ?? null,
      termsText: draft.termsText,
      publicNotes: draft.publicNotes,
      internalNotes: draft.internalNotes,
      totals: draft.totals,
      attachmentFilename,
      lineItems,
      status: 'Draft',
    });

    logActivity(db, {
      tenantId,
      actorUserId: currentUser.id,
      eventType: 'invoice.created',
      entityType: 'invoice',
      entityId: invoiceId,
      description: `${currentUser.name} created draft invoice ${invoiceNumber}.`,
      metadata: {
        invoice_number: invoiceNumber,
        job_id: job.id,
        job_name: job.job_name,
        customer_name: draft.customerName,
        subtotal_amount: draft.totals.subtotal,
        discount_type: draft.totals.discountType,
        discount_value: draft.totals.discountValue,
        discount_amount: draft.totals.discountAmount,
        tax_rate: draft.totals.taxRate,
        tax_amount: draft.totals.taxAmount,
        total_amount: draft.totals.total,
        line_item_count: lineItems.length,
        attachment_filename: attachmentFilename,
      },
      ipAddress: resolveRequestIp(c),
    });

    if (attachmentFilename) {
      logActivity(db, {
        tenantId,
        actorUserId: currentUser.id,
        eventType: 'invoice.attachment_uploaded',
        entityType: 'invoice',
        entityId: invoiceId,
        description: `${currentUser.name} uploaded an attachment for invoice ${invoiceNumber}.`,
        metadata: {
          invoice_number: invoiceNumber,
          job_id: job.id,
          job_name: job.job_name,
          total_amount: draft.totals.total,
          attachment_filename: attachmentFilename,
        },
        ipAddress: resolveRequestIp(c),
      });
    }

    return c.redirect(`/invoice/${invoiceId}`);
  } catch (error) {
    if (attachmentFilename) {
      deleteUploadedFile(attachmentFilename, invoiceAttachmentRootDir);
    }

    const message =
      error instanceof ValidationError ? error.message : 'Unable to create invoice right now.';

    return renderApp(
      c,
      'Create Invoice',
      <AddInvoicePage
        jobs={jobs}
        prefillJobId={formValues.job_id && /^\d+$/.test(formValues.job_id) ? Number.parseInt(formValues.job_id, 10) : null}
        suggestedInvoiceNumber={fallbackInvoiceNumber}
        tenant={tenantSettings}
        csrfToken={c.get('csrfToken')}
        error={message}
        formValues={formValues}
      />,
      400,
    );
  }
});

invoiceRoutes.get('/edit_invoice/:id', permissionRequired('invoices.edit'), (c) => {
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

  const invoice = db.prepare(
    `
      SELECT
        id,
        job_id,
        invoice_number,
        date_issued,
        due_date,
        amount,
        status,
        notes,
        attachment_filename,
        archived_at,
        customer_name,
        customer_email,
        customer_phone,
        customer_address,
        terms_text,
        public_notes,
        internal_notes,
        discount_type,
        discount_value,
        tax_rate,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount
      FROM invoices
      WHERE id = ? AND tenant_id = ?
      LIMIT 1
    `
  ).get(invoiceId, tenantId) as any;

  if (!invoice) {
    return c.text('Invoice not found', 404);
  }

  const jobs = db.prepare(
    `
      SELECT id, job_name, client_name
      FROM jobs
      WHERE tenant_id = ? AND archived_at IS NULL
      ORDER BY job_name ASC
    `
  ).all(tenantId) as any[];

  const storedLineItems = loadInvoiceLineItems(db, tenantId, invoiceId);
  const lineItems = storedLineItems.length ? storedLineItems : buildLegacyLineItem(Number(invoice.total_amount || invoice.amount || 0));

  const formValues = createEmptyInvoiceDraftForm({
    job_id: String(invoice.job_id ?? ''),
    invoice_number: String(invoice.invoice_number ?? ''),
    issue_date: String(invoice.date_issued ?? ''),
    due_date: String(invoice.due_date ?? ''),
    customer_name: String(invoice.customer_name ?? ''),
    customer_email: String(invoice.customer_email ?? ''),
    customer_phone: String(invoice.customer_phone ?? ''),
    customer_address: String(invoice.customer_address ?? ''),
    terms_text: String(invoice.terms_text ?? ''),
    public_notes: String(invoice.public_notes ?? invoice.notes ?? ''),
    internal_notes: String(invoice.internal_notes ?? ''),
    discount_type:
      String(invoice.discount_type ?? 'none').trim().toLowerCase() === 'percent'
        ? 'percent'
        : String(invoice.discount_type ?? 'none').trim().toLowerCase() === 'amount'
          ? 'amount'
          : 'none',
    discount_value:
      invoice.discount_value === null || invoice.discount_value === undefined
        ? ''
        : String(invoice.discount_value),
    tax_rate:
      invoice.tax_rate === null || invoice.tax_rate === undefined
        ? '0'
        : String(invoice.tax_rate),
    line_items: lineItems.map((item) => ({
      description: String(item.description ?? ''),
      quantity: String(item.quantity ?? ''),
      unit: String(item.unit ?? ''),
      unit_price: String(item.unit_price ?? ''),
    })),
  });

  return renderApp(
    c,
    'Edit Invoice',
    <EditInvoicePage
      invoice={invoice}
      jobs={jobs}
      csrfToken={c.get('csrfToken')}
      formValues={formValues}
    />,
  );
});

invoiceRoutes.post('/edit_invoice/:id', permissionRequired('invoices.edit'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  let invoiceId: number;
  try {
    invoiceId = parseRouteId(c.req.param('id'), 'Invoice');
  } catch {
    return c.text('Invoice not found', 404);
  }

  const tenantId = tenant.id;
  const db = getDb();
  const env = getEnv();

  const existingInvoice = db.prepare(
    `
      SELECT
        id,
        job_id,
        invoice_number,
        date_issued,
        due_date,
        amount,
        status,
        notes,
        attachment_filename,
        archived_at,
        customer_name,
        customer_email,
        customer_phone,
        customer_address,
        company_name_snapshot,
        company_email_snapshot,
        company_phone_snapshot,
        company_address_snapshot,
        company_website_snapshot,
        company_logo_path_snapshot,
        terms_text,
        public_notes,
        internal_notes,
        discount_type,
        discount_value,
        discount_amount,
        tax_rate,
        tax_amount,
        subtotal_amount,
        total_amount
      FROM invoices
      WHERE id = ? AND tenant_id = ?
      LIMIT 1
    `
  ).get(invoiceId, tenantId) as any;

  if (!existingInvoice) {
    return c.text('Invoice not found', 404);
  }

  const jobs = db.prepare(
    `
      SELECT id, job_name, client_name
      FROM jobs
      WHERE tenant_id = ? AND archived_at IS NULL
      ORDER BY job_name ASC
    `
  ).all(tenantId) as any[];

  const existingLineItems = loadInvoiceLineItems(db, tenantId, invoiceId);
  const fallbackLineItems = existingLineItems.length
    ? existingLineItems
    : buildLegacyLineItem(Number(existingInvoice.total_amount || existingInvoice.amount || 0));

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const formValues = buildInvoiceDraftFormFromBody(body, String(existingInvoice.invoice_number ?? ''));

  const pageInvoice = {
    ...existingInvoice,
    job_id: formValues.job_id || String(existingInvoice.job_id ?? ''),
    invoice_number: formValues.invoice_number || String(existingInvoice.invoice_number ?? ''),
    date_issued: formValues.issue_date || String(existingInvoice.date_issued ?? ''),
    due_date: formValues.due_date || String(existingInvoice.due_date ?? ''),
    customer_name: formValues.customer_name || String(existingInvoice.customer_name ?? ''),
    customer_email: formValues.customer_email || String(existingInvoice.customer_email ?? ''),
    customer_phone: formValues.customer_phone || String(existingInvoice.customer_phone ?? ''),
    customer_address: formValues.customer_address || String(existingInvoice.customer_address ?? ''),
    terms_text: formValues.terms_text || String(existingInvoice.terms_text ?? ''),
    public_notes: formValues.public_notes || String(existingInvoice.public_notes ?? existingInvoice.notes ?? ''),
    internal_notes: formValues.internal_notes || String(existingInvoice.internal_notes ?? ''),
    discount_type: formValues.discount_type || String(existingInvoice.discount_type ?? 'none'),
    discount_value: formValues.discount_value || String(existingInvoice.discount_value ?? ''),
    tax_rate: formValues.tax_rate || String(existingInvoice.tax_rate ?? '0'),
    line_items: formValues.line_items.length
      ? formValues.line_items
      : fallbackLineItems.map((item) => ({
          description: String(item.description ?? ''),
          quantity: String(item.quantity ?? ''),
          unit: String(item.unit ?? ''),
          unit_price: String(item.unit_price ?? ''),
        })),
  };

  if (existingInvoice.archived_at) {
    return renderApp(
      c,
      'Edit Invoice',
      <EditInvoicePage
        invoice={pageInvoice}
        jobs={jobs}
        csrfToken={c.get('csrfToken')}
        error="Archived invoices cannot be edited. Restore the invoice first."
        formValues={pageInvoice}
      />,
      400,
    );
  }

  let newStoredAttachment: string | null = null;
  let oldAttachmentToDelete: string | null = null;

  try {
    const jobId = parsePositiveInt(body['job_id'], 'Job');
    const rawInvoiceNumber = String(body['invoice_number'] ?? '').trim();
    const invoiceNumber = normalizeInvoiceNumber(
      rawInvoiceNumber || String(existingInvoice.invoice_number ?? ''),
      tenant.invoice_prefix || 'INV',
    );

    const lineItems = parseInvoiceLineItems(body);
    const draft = parseInvoiceDraftFields(body, lineItems);
    ensureDateOrder(draft.issueDate, draft.dueDate, 'Issue date', 'Due date');

    const job = db
      .prepare(
        `
          SELECT id, job_name, client_name, job_code
          FROM jobs
          WHERE id = ? AND tenant_id = ? AND archived_at IS NULL
          LIMIT 1
        `,
      )
      .get(jobId, tenantId) as
      | { id: number; job_name: string; client_name: string | null; job_code: string | null }
      | undefined;

    if (!job) {
      throw new ValidationError('Selected job was not found for this company.');
    }

    const duplicate = db.prepare(
      `
        SELECT id
        FROM invoices
        WHERE tenant_id = ? AND UPPER(invoice_number) = UPPER(?) AND id != ?
        LIMIT 1
      `
    ).get(tenantId, invoiceNumber, invoiceId) as { id: number } | undefined;

    if (duplicate) {
      throw new ValidationError('Invoice number already exists. Please choose a different one.');
    }

    let nextAttachmentFilename = existingInvoice.attachment_filename || null;

    const attachment = body['attachment'];
    if (attachment && attachment instanceof File && attachment.size > 0) {
      const tenantAttachmentDir = buildTenantScopedUploadDir(invoiceAttachmentRootDir, tenantId);
      const savedFilename = await saveUploadedFile(attachment, tenantAttachmentDir, {
        allowedExtensions: DOCUMENT_ATTACHMENT_EXTENSIONS,
        allowedMimeTypes: DOCUMENT_ATTACHMENT_MIME_TYPES,
        maxBytes: env.maxReceiptUploadBytes,
      });

      newStoredAttachment = buildTenantScopedStoredPath(tenantId, savedFilename);
      nextAttachmentFilename = newStoredAttachment;
      oldAttachmentToDelete = existingInvoice.attachment_filename || null;
    }

    const tenantSettings = getTenantSettings(db, tenantId);
    if (!tenantSettings) {
      throw new ValidationError('Tenant not found.');
    }

    applyInvoiceDraftUpdate(db, {
      tenantId,
      invoiceId,
      jobId,
      invoiceNumber,
      issueDate: draft.issueDate,
      dueDate: draft.dueDate,
      customerName: draft.customerName,
      customerEmail: draft.customerEmail,
      customerPhone: draft.customerPhone,
      customerAddress: draft.customerAddress,
      companyName: tenantSettings.name,
      companyEmail: tenantSettings.company_email,
      companyPhone: tenantSettings.company_phone,
      companyAddress: tenantSettings.company_address,
      companyWebsite: tenantSettings.company_website ?? null,
      companyLogoPath: tenantSettings.logo_path,
      jobName: job.job_name,
      jobCode: job.job_code ?? null,
      termsText: draft.termsText,
      publicNotes: draft.publicNotes,
      internalNotes: draft.internalNotes,
      totals: draft.totals,
      attachmentFilename: nextAttachmentFilename,
      lineItems,
      status: existingInvoice.status || 'Draft',
    });

    if (oldAttachmentToDelete) {
      deleteUploadedFile(oldAttachmentToDelete, invoiceAttachmentRootDir);
    }

    logActivity(db, {
      tenantId,
      actorUserId: currentUser.id,
      eventType: 'invoice.updated',
      entityType: 'invoice',
      entityId: invoiceId,
      description: `${currentUser.name} updated draft invoice ${invoiceNumber}.`,
      metadata: {
        previous_job_id: existingInvoice.job_id,
        new_job_id: jobId,
        previous_invoice_number: existingInvoice.invoice_number,
        new_invoice_number: invoiceNumber,
        previous_customer_name: existingInvoice.customer_name,
        new_customer_name: draft.customerName,
        previous_issue_date: existingInvoice.date_issued,
        new_issue_date: draft.issueDate,
        previous_due_date: existingInvoice.due_date,
        new_due_date: draft.dueDate,
        previous_subtotal_amount: Number(existingInvoice.subtotal_amount || existingInvoice.amount || 0),
        new_subtotal_amount: draft.totals.subtotal,
        previous_discount_amount: Number(existingInvoice.discount_amount || 0),
        new_discount_amount: draft.totals.discountAmount,
        previous_tax_amount: Number(existingInvoice.tax_amount || 0),
        new_tax_amount: draft.totals.taxAmount,
        previous_total_amount: Number(existingInvoice.total_amount || existingInvoice.amount || 0),
        new_total_amount: draft.totals.total,
        line_item_count: lineItems.length,
        attachment_filename: nextAttachmentFilename,
      },
      ipAddress: resolveRequestIp(c),
    });

    if (newStoredAttachment) {
      logActivity(db, {
        tenantId,
        actorUserId: currentUser.id,
        eventType: 'invoice.attachment_replaced',
        entityType: 'invoice',
        entityId: invoiceId,
        description: `${currentUser.name} replaced the attachment for invoice ${invoiceNumber}.`,
        metadata: {
          invoice_number: invoiceNumber,
          previous_attachment_filename: existingInvoice.attachment_filename,
          attachment_filename: newStoredAttachment,
        },
        ipAddress: resolveRequestIp(c),
      });
    }

    return c.redirect(`/invoice/${invoiceId}`);
  } catch (error) {
    if (newStoredAttachment) {
      deleteUploadedFile(newStoredAttachment, invoiceAttachmentRootDir);
    }

    const message =
      error instanceof ValidationError ? error.message : 'Unable to update invoice right now.';

    const errorFormValues = pageInvoice.line_items?.length
      ? pageInvoice
      : {
          ...pageInvoice,
          line_items: fallbackLineItems.map((item) => ({
            description: String(item.description ?? ''),
            quantity: String(item.quantity ?? ''),
            unit: String(item.unit ?? ''),
            unit_price: String(item.unit_price ?? ''),
          })),
        };

    return renderApp(
      c,
      'Edit Invoice',
      <EditInvoicePage
        invoice={pageInvoice}
        jobs={jobs}
        csrfToken={c.get('csrfToken')}
        error={message}
        formValues={errorFormValues}
      />,
      400,
    );
  }
});

invoiceRoutes.post('/delete_invoice_attachment/:id', permissionRequired('invoices.edit'), (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  let invoiceId: number;
  try {
    invoiceId = parseRouteId(c.req.param('id'), 'Invoice');
  } catch {
    return c.text('Invoice not found', 404);
  }

  const tenantId = tenant.id;
  const db = getDb();

  const invoice = db.prepare(
    `
      SELECT id, invoice_number, attachment_filename, archived_at
      FROM invoices
      WHERE id = ? AND tenant_id = ?
      LIMIT 1
    `
  ).get(invoiceId, tenantId) as any;

  if (!invoice) {
    return c.text('Invoice not found', 404);
  }

  if (invoice.archived_at) {
    return c.redirect(`/invoice/${invoiceId}`);
  }

  if (!invoice.attachment_filename) {
    return c.redirect(`/edit_invoice/${invoiceId}`);
  }

  deleteUploadedFile(invoice.attachment_filename, invoiceAttachmentRootDir);

  db.prepare(
    `
      UPDATE invoices
      SET attachment_filename = NULL
      WHERE id = ? AND tenant_id = ?
    `
  ).run(invoiceId, tenantId);

  logActivity(db, {
    tenantId,
    actorUserId: currentUser.id,
    eventType: 'invoice.attachment_deleted',
    entityType: 'invoice',
    entityId: invoiceId,
    description: `${currentUser.name} removed the attachment from invoice ${invoice.invoice_number || `#${invoiceId}`}.`,
    metadata: {
      invoice_number: invoice.invoice_number,
      attachment_filename: invoice.attachment_filename,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect(`/edit_invoice/${invoiceId}`);
});

invoiceRoutes.get('/invoice/:id', permissionRequired('invoices.view'), (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  let invoiceId: number;
  try {
    invoiceId = parseRouteId(c.req.param('id'), 'Invoice');
  } catch {
    return c.text('Invoice not found', 404);
  }

  return renderInvoiceDetail(c, tenant.id, invoiceId);
});

invoiceRoutes.get('/invoice-attachments/:id', loginRequired, (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) {
    return c.redirect('/login');
  }

  const tenantId = tenant.id;
  let invoiceId: number;
  try {
    invoiceId = parseRouteId(c.req.param('id'), 'Invoice');
  } catch {
    return c.text('Attachment not found', 404);
  }

  const db = getDb();

  const invoice = db
    .prepare(
      `
        SELECT
          i.id,
          i.invoice_number,
          i.amount,
          i.job_id,
          i.attachment_filename,
          j.job_name
        FROM invoices i
        JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
        WHERE i.id = ? AND i.tenant_id = ?
        LIMIT 1
      `,
    )
    .get(invoiceId, tenantId) as
      | {
          id: number;
          invoice_number: string | null;
          amount: number | null;
          job_id: number;
          attachment_filename: string | null;
          job_name: string | null;
        }
      | undefined;

  if (!invoice || !invoice.attachment_filename) {
    return c.text('Attachment not found', 404);
  }

  try {
    const filePath = resolveUploadedFilePath(invoice.attachment_filename, invoiceAttachmentRootDir);

    if (!fs.existsSync(filePath)) {
      return c.text('Attachment file not found', 404);
    }

    logActivity(db, {
      tenantId,
      actorUserId: currentUser.id,
      eventType: 'invoice.attachment_viewed',
      entityType: 'invoice',
      entityId: invoice.id,
      description: `${currentUser.name} viewed an attachment for invoice ${invoice.invoice_number || `#${invoice.id}`}.`,
      metadata: {
        invoice_number: invoice.invoice_number,
        amount: Number(invoice.amount || 0),
        job_id: invoice.job_id,
        job_name: invoice.job_name,
        attachment_filename: invoice.attachment_filename,
      },
      ipAddress: resolveRequestIp(c),
    });

    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = inferMimeTypeFromStoredFilename(invoice.attachment_filename);
    const downloadName = buildSafeDownloadFilename(
      `invoice-${invoice.id}-attachment`,
      invoice.attachment_filename,
    );

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${downloadName}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return c.text('Attachment not found', 404);
  }
});

invoiceRoutes.get('/invoice/:id/pdf', loginRequired, async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const tenantId = tenant.id;
  const db = getDb();

  let invoiceId: number;
  try {
    invoiceId = parseRouteId(c.req.param('id'), 'Invoice');
  } catch {
    return c.text('Invoice not found', 404);
  }

  const tenantSettings = getTenantSettings(db, tenantId);
  if (!tenantSettings) return c.text('Tenant not found', 404);

  const inv = db.prepare(`
    SELECT i.*, j.job_name, j.client_name, j.job_code
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.id = ? AND i.tenant_id = ?
  `).get(invoiceId, tenantId) as any;

  if (!inv) return c.text('Invoice not found', 404);

  // 🔥 LOAD REAL LINE ITEMS
  const lineItems = db.prepare(`
    SELECT description, quantity, unit, unit_price, line_total
    FROM invoice_line_items
    WHERE invoice_id = ? AND tenant_id = ?
    ORDER BY sort_order ASC
  `).all(invoiceId, tenantId);

  const paidRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM payments
    WHERE invoice_id = ? AND tenant_id = ?
  `).get(invoiceId, tenantId) as any;

  const paid = Number(paidRow?.total || 0);
  const total = Number(inv.total_amount || inv.amount || 0);
  const outstanding = Math.max(total - paid, 0);

  const pdfBytes = await generateInvoicePdf({
    tenant: {
      name: tenantSettings.name,
      logo_path: tenantSettings.logo_path,
      company_address: tenantSettings.company_address,
      company_email: tenantSettings.company_email,
      company_phone: tenantSettings.company_phone,
    },
    invoice: {
      id: inv.id,
      invoice_number: inv.invoice_number,
      date_issued: inv.date_issued,
      due_date: inv.due_date,
      subtotal_amount: inv.subtotal_amount || total,
      discount_amount: inv.discount_amount || 0,
      tax_amount: inv.tax_amount || 0,
      total_amount: total,
      public_notes: inv.public_notes,
      terms_text: inv.terms_text,
      status: inv.status || 'Draft',
    },
    customer: {
      name: inv.customer_name,
      email: inv.customer_email,
      phone: inv.customer_phone,
      address: inv.customer_address,
    },
    job: {
      job_name: inv.job_name,
      job_code: inv.job_code,
    },
    lineItems: lineItems,
    paid,
    outstanding,
  });

  const filename = `invoice_${inv.invoice_number || inv.id}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

invoiceRoutes.post('/archive_invoice/:id', permissionRequired('invoices.archive'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  let invoiceId: number;
  try {
    invoiceId = parseRouteId(c.req.param('id'), 'Invoice');
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

  const paymentRow = db
    .prepare(
      `
        SELECT COUNT(*) as total
        FROM payments
        WHERE invoice_id = ? AND tenant_id = ?
      `,
    )
    .get(invoiceId, tenantId) as { total: number };

  const paymentCount = Number(paymentRow?.total || 0);

  if (paymentCount > 0) {
    return renderInvoiceDetail(
      c,
      tenantId,
      invoiceId,
      {
        error: 'Cannot archive this invoice while payments are attached. Remove the payments first, then archive the invoice.',
      },
      400,
    );
  }

  if (!invoice.archived_at) {
    db.prepare(
      `
        UPDATE invoices
        SET archived_at = CURRENT_TIMESTAMP,
            archived_by_user_id = ?
        WHERE id = ? AND tenant_id = ?
      `,
    ).run(currentUser.id, invoiceId, tenantId);

    logActivity(db, {
      tenantId,
      actorUserId: currentUser.id,
      eventType: 'invoice.archived',
      entityType: 'invoice',
      entityId: invoiceId,
      description: `${currentUser.name} archived invoice ${invoice.invoice_number || `#${invoiceId}`}.`,
      metadata: {
        invoice_number: invoice.invoice_number,
        amount: Number(invoice.amount || 0),
        job_id: invoice.job_id,
        job_name: invoice.job_name,
      },
      ipAddress: resolveRequestIp(c),
    });
  }

  return c.redirect('/invoices');
});

invoiceRoutes.post('/restore_invoice/:id', permissionRequired('invoices.archive'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  let invoiceId: number;
  try {
    invoiceId = parseRouteId(c.req.param('id'), 'Invoice');
  } catch {
    return c.text('Invoice not found', 404);
  }

  const tenantId = tenant.id;
  const db = getDb();

  const invoice = db
    .prepare(
      `
        SELECT i.id, i.invoice_number, i.amount, i.job_id, j.job_name
        FROM invoices i
        JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
        WHERE i.id = ? AND i.tenant_id = ?
      `,
    )
    .get(invoiceId, tenantId) as
      | { id: number; invoice_number: string | null; amount: number; job_id: number; job_name: string }
      | undefined;

  if (!invoice) {
    return c.text('Invoice not found', 404);
  }

  db.prepare(
    `
      UPDATE invoices
      SET archived_at = NULL,
          archived_by_user_id = NULL
      WHERE id = ? AND tenant_id = ?
    `,
  ).run(invoiceId, tenantId);

  logActivity(db, {
    tenantId,
    actorUserId: currentUser.id,
    eventType: 'invoice.restored',
    entityType: 'invoice',
    entityId: invoiceId,
    description: `${currentUser.name} restored invoice ${invoice.invoice_number || `#${invoiceId}`}.`,
    metadata: {
      invoice_number: invoice.invoice_number,
      amount: Number(invoice.amount || 0),
      job_id: invoice.job_id,
      job_name: invoice.job_name,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect('/invoices?show_archived=1');
});

export default invoiceRoutes;