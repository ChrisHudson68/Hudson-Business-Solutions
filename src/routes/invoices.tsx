import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/connection.js';
import { loginRequired, permissionRequired, userHasPermission } from '../middleware/auth.js';
import { generateInvoicePdf } from '../services/invoice-pdf.js';
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
  parsePositiveInt,
} from '../lib/validation.js';
import { getEnv } from '../config/env.js';
import {
  applyInvoiceDraftUpdate,
  buildInvoiceDraftFormFromBody,
  buildLegacyLineItem,
  buildStoredInvoicePdfRelativePath,
  calculateInvoiceTotals,
  createEmptyInvoiceDraftForm,
  insertInvoiceEvent,
  loadInvoiceLineItems,
  parseInvoiceDraftFields,
  parseInvoiceLineItems,
  resolveStoredInvoicePdfAbsolutePath,
  type InvoiceDraftFormData,
  type InvoiceLineItemRecord,
} from '../services/invoice-v2.js';

const invoiceAttachmentRootDir = path.join(getEnv().uploadDir, 'invoice_attachments');


function ensureStoredInvoicePdfDir(relativePath: string) {
  const absolutePath = resolveStoredInvoicePdfAbsolutePath(getEnv().uploadDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  return absolutePath;
}

function createFrozenInvoicePdf(data: ReturnType<typeof loadInvoiceSummaryData>) {
  return generateInvoicePdf({
    tenant: {
      name: data.inv.company_name_snapshot || data.tenant.name,
      logo_path: data.inv.company_logo_path_snapshot || data.tenant.logo_path,
      company_address: data.inv.company_address_snapshot || data.tenant.company_address,
      company_email: data.inv.company_email_snapshot || data.tenant.company_email,
      company_phone: data.inv.company_phone_snapshot || data.tenant.company_phone,
      company_website: data.inv.company_website_snapshot || data.tenant.company_website,
    },
    invoice: {
      id: data.inv.id,
      invoice_number: data.inv.invoice_number,
      date_issued: data.inv.date_issued,
      due_date: data.inv.due_date,
      subtotal_amount: Number(data.inv.subtotal_amount ?? data.inv.amount ?? 0),
      discount_amount: Number(data.inv.discount_amount ?? 0),
      tax_amount: Number(data.inv.tax_amount ?? 0),
      total_amount: Number(data.inv.total_amount ?? data.inv.amount ?? 0),
      public_notes: data.inv.public_notes || data.inv.notes,
      terms_text: data.inv.terms_text,
      status: data.status,
    },
    customer: {
      name: data.inv.customer_name || data.inv.client_name,
      email: data.inv.customer_email,
      phone: data.inv.customer_phone,
      address: data.inv.customer_address,
    },
    job: {
      job_name: data.inv.job_name_snapshot || data.inv.job_name,
      job_code: data.inv.job_code_snapshot || data.inv.job_code,
    },
    lineItems: data.lineItems.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity || 0),
      unit: item.unit || null,
      unit_price: Number(item.unit_price || 0),
      line_total: Number(item.line_total || 0),
    })),
    paid: data.paid,
    outstanding: data.outstanding,
  });
}


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

function parseRouteId(raw: string, label: string): number {
  return parsePositiveInt(raw, label);
}

function nextInvoiceNumber(db: any, tenantId: number, invoicePrefix: string): string {
  const prefix = normalizeInvoicePrefix(invoicePrefix || 'INV');
  const row = db
    .prepare(`
      SELECT invoice_number
      FROM invoices
      WHERE tenant_id = ? AND invoice_number IS NOT NULL AND invoice_number != ''
      ORDER BY id DESC
      LIMIT 1
    `)
    .get(tenantId) as { invoice_number: string } | undefined;

  if (!row) return `${prefix}-1001`;
  const lastNumber = String(row.invoice_number || '').trim().toUpperCase();
  const expectedPrefix = `${prefix}-`;

  if (lastNumber.startsWith(expectedPrefix)) {
    const suffix = lastNumber.slice(expectedPrefix.length);
    if (/^\d+$/.test(suffix)) return `${prefix}-${Number.parseInt(suffix, 10) + 1}`;
  }

  return `${prefix}-1001`;
}

function getTenantSettings(db: any, tenantId: number) {
  return db.prepare(`
    SELECT id, name, subdomain, logo_path, invoice_prefix,
           company_email, company_phone, company_address, company_website
    FROM tenants
    WHERE id = ?
  `).get(tenantId) as any;
}

function loadJobs(db: any, tenantId: number) {
  return db.prepare(`
    SELECT id, job_name, client_name, job_code
    FROM jobs
    WHERE tenant_id = ? AND archived_at IS NULL
    ORDER BY job_name ASC
  `).all(tenantId) as any[];
}

function deriveInvoiceStatus(row: {
  status?: string | null;
  archived_at?: string | null;
  locked_at?: string | null;
  total_amount?: number | null;
  amount?: number | null;
  due_date?: string | null;
}, paid: number) {
  if (row.archived_at) return 'Archived';
  const stored = String(row.status || '').trim();
  if (stored === 'Voided') return 'Voided';
  if (stored === 'Draft') return 'Draft';

  const total = Number(row.total_amount ?? row.amount ?? 0);
  if (total > 0 && paid >= total) return 'Paid';
  if (paid > 0) return 'Partially Paid';

  const dueDate = String(row.due_date || '').trim();
  if (dueDate) {
    const dueDateValue = new Date(`${dueDate}T23:59:59Z`);
    if (!Number.isNaN(dueDateValue.getTime()) && dueDateValue < new Date()) {
      return 'Overdue';
    }
  }

  if (stored === 'Sent') return 'Sent';
  if (stored === 'Unpaid') return 'Unpaid';
  if (row.locked_at) return 'Sent';
  return 'Draft';
}

function getInvoiceLineItemsOrFallback(db: any, tenantId: number, invoiceId: number, amount: number): InvoiceLineItemRecord[] {
  const items = loadInvoiceLineItems(db, tenantId, invoiceId);
  return items.length ? items : buildLegacyLineItem(amount);
}

function buildDraftFormFromInvoice(db: any, tenantId: number, invoice: any): InvoiceDraftFormData {
  const lineItems = getInvoiceLineItemsOrFallback(db, tenantId, invoice.id, Number(invoice.total_amount ?? invoice.amount ?? 0));
  return createEmptyInvoiceDraftForm({
    job_id: String(invoice.job_id || ''),
    invoice_number: String(invoice.invoice_number || ''),
    issue_date: String(invoice.date_issued || ''),
    due_date: String(invoice.due_date || ''),
    customer_name: String(invoice.customer_name || invoice.client_name || ''),
    customer_email: String(invoice.customer_email || ''),
    customer_phone: String(invoice.customer_phone || ''),
    customer_address: String(invoice.customer_address || ''),
    terms_text: String(invoice.terms_text || ''),
    public_notes: String(invoice.public_notes || invoice.notes || ''),
    internal_notes: String(invoice.internal_notes || ''),
    discount_type:
      String(invoice.discount_type || '').toLowerCase() === 'percent'
        ? 'percent'
        : String(invoice.discount_type || '').toLowerCase() === 'amount'
          ? 'amount'
          : 'none',
    discount_value: String(invoice.discount_value ?? ''),
    tax_rate: String(invoice.tax_rate ?? '0'),
    line_items: lineItems.map((item) => ({
      description: item.description || '',
      quantity: String(item.quantity ?? ''),
      unit: String(item.unit ?? ''),
      unit_price: String(item.unit_price ?? ''),
    })),
  });
}

function loadInvoiceSummaryData(db: any, tenantId: number, invoiceId: number) {
  const tenantSettings = getTenantSettings(db, tenantId);
  const inv = db.prepare(`
    SELECT
      i.id,
      i.job_id,
      j.job_name,
      j.client_name,
      j.job_code,
      i.invoice_number,
      i.date_issued,
      i.due_date,
      i.amount,
      i.status,
      i.notes,
      i.attachment_filename,
      i.archived_at,
      i.customer_name,
      i.customer_email,
      i.customer_phone,
      i.customer_address,
      i.company_name_snapshot,
      i.company_email_snapshot,
      i.company_phone_snapshot,
      i.company_address_snapshot,
      i.company_website_snapshot,
      i.company_logo_path_snapshot,
      i.job_name_snapshot,
      i.job_code_snapshot,
      i.subtotal_amount,
      i.discount_type,
      i.discount_value,
      i.discount_amount,
      i.tax_rate,
      i.tax_amount,
      i.total_amount,
      i.terms_text,
      i.public_notes,
      i.internal_notes,
      i.locked_at,
      i.sent_at,
      i.pdf_generated_at,
      i.pdf_file_path,
      i.pdf_version,
      i.version_number,
      i.void_reason,
      i.voided_at
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.id = ? AND i.tenant_id = ?
  `).get(invoiceId, tenantId) as any;

  if (!tenantSettings || !inv) return null;

  const payments = db.prepare(`
    SELECT id, date, amount, method, reference
    FROM payments
    WHERE invoice_id = ? AND tenant_id = ?
    ORDER BY date DESC, id DESC
  `).all(invoiceId, tenantId) as any[];

  const paidRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoice_id = ? AND tenant_id = ?`).get(invoiceId, tenantId) as { total: number };
  const totalAmount = Number(inv.total_amount ?? inv.amount ?? 0);
  const paid = Number(paidRow?.total || 0);
  const status = deriveInvoiceStatus(inv, paid);
  const outstanding = Math.max(totalAmount - paid, 0);
  const lineItems = getInvoiceLineItemsOrFallback(db, tenantId, invoiceId, totalAmount);

  if (status !== inv.status && status !== 'Archived') {
    db.prepare('UPDATE invoices SET status = ? WHERE id = ? AND tenant_id = ?').run(status, invoiceId, tenantId);
  }

  return {
    inv,
    tenant: tenantSettings,
    payments,
    paid,
    outstanding,
    status,
    paymentCount: payments.length,
    lineItems,
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
  const data = loadInvoiceSummaryData(db, tenantId, invoiceId);
  if (!data) return c.text('Invoice not found', 404);

  return renderApp(
    c,
    'Invoice Detail',
    <InvoiceDetailPage
      inv={data.inv}
      lineItems={data.lineItems}
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

function ensureEditableInvoice(invoice: any) {
  const status = String(invoice.status || '').trim();
  if (invoice.archived_at) {
    throw new ValidationError('Archived invoices cannot be edited. Restore the invoice first.');
  }
  if (status === 'Paid' || status === 'Voided') {
    throw new ValidationError('This invoice can no longer be edited in its current status.');
  }
  if (invoice.locked_at) {
    throw new ValidationError('This invoice is locked and can no longer be edited.');
  }
}

export const invoiceRoutes = new Hono<AppEnv>();

invoiceRoutes.get('/invoices', permissionRequired('invoices.view'), (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const tenantId = tenant.id;
  const db = getDb();
  const showArchived = c.req.query('show_archived') === '1';

  const invRows = db.prepare(`
    SELECT
      i.id,
      i.job_id,
      j.job_name,
      COALESCE(i.customer_name, j.client_name) AS client_name,
      i.invoice_number,
      i.date_issued,
      i.due_date,
      i.amount,
      i.total_amount,
      i.status,
      i.locked_at,
      i.attachment_filename,
      i.archived_at
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.tenant_id = ?
      AND ${showArchived ? 'i.archived_at IS NOT NULL' : 'i.archived_at IS NULL'}
    ORDER BY i.due_date DESC, i.id DESC
  `).all(tenantId) as any[];

  const paymentTotals = db.prepare(`
    SELECT invoice_id, COALESCE(SUM(amount), 0) as total_paid, COUNT(*) as payment_count
    FROM payments
    WHERE tenant_id = ?
    GROUP BY invoice_id
  `).all(tenantId) as Array<{ invoice_id: number; total_paid: number; payment_count: number }>;

  const paymentMap = new Map<number, { totalPaid: number; paymentCount: number }>();
  paymentTotals.forEach((row) => paymentMap.set(row.invoice_id, { totalPaid: Number(row.total_paid || 0), paymentCount: Number(row.payment_count || 0) }));

  const invoices: any[] = [];
  let totalOutstanding = 0;
  let totalOverdue = 0;

  for (const row of invRows) {
    const invoiceId = Number(row.id);
    const amount = Number(row.total_amount ?? row.amount ?? 0);
    const paymentInfo = paymentMap.get(invoiceId) || { totalPaid: 0, paymentCount: 0 };
    const paid = Number(paymentInfo.totalPaid || 0);
    const status = deriveInvoiceStatus(row, paid);
    const outstanding = Math.max(amount - paid, 0);

    if (status !== 'Draft' && status !== 'Voided') {
      totalOutstanding += outstanding;
      if (status === 'Overdue') totalOverdue += outstanding;
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

  const jobs = loadJobs(db, tenantId);
  const prefillJobIdRaw = c.req.query('job_id');
  const prefillJobId = prefillJobIdRaw && /^\d+$/.test(prefillJobIdRaw) ? Number.parseInt(prefillJobIdRaw, 10) : null;
  const suggestedInvoiceNumber = nextInvoiceNumber(db, tenantId, tenantSettings.invoice_prefix || 'INV');
  const today = new Date().toISOString().slice(0, 10);

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
        issue_date: today,
        due_date: today,
        tax_rate: '0',
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

  const jobs = loadJobs(db, tenantId);
  const suggestedInvoiceNumber = nextInvoiceNumber(db, tenantId, tenantSettings.invoice_prefix || 'INV');
  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const formValues = buildInvoiceDraftFormFromBody(body, suggestedInvoiceNumber);

  let attachmentFilename: string | null = null;

  try {
    const jobId = parsePositiveInt(body['job_id'], 'Job');
    const invoiceNumber = normalizeInvoiceNumber(String(body['invoice_number'] ?? '').trim() || suggestedInvoiceNumber, tenantSettings.invoice_prefix || 'INV');
    const lineItems = parseInvoiceLineItems(body);
    const draftFields = parseInvoiceDraftFields(body, lineItems);
    ensureDateOrder(draftFields.issueDate, draftFields.dueDate, 'Issue date', 'Due date');

    const job = db.prepare(`
      SELECT id, job_name, job_code, client_name
      FROM jobs
      WHERE id = ? AND tenant_id = ? AND archived_at IS NULL
    `).get(jobId, tenantId) as any;
    if (!job) throw new ValidationError('Selected job was not found for this company.');

    const existingInvoice = db.prepare(`
      SELECT id
      FROM invoices
      WHERE tenant_id = ? AND UPPER(invoice_number) = UPPER(?)
      LIMIT 1
    `).get(tenantId, invoiceNumber) as { id: number } | undefined;
    if (existingInvoice) throw new ValidationError('Invoice number already exists. Please choose a different one.');

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

    const result = db.prepare(`
      INSERT INTO invoices (
        job_id, invoice_number, date_issued, due_date, amount, status, notes,
        attachment_filename, tenant_id, archived_at, archived_by_user_id,
        created_by_user_id, version_number
      )
      VALUES (?, ?, ?, ?, ?, 'Draft', ?, ?, ?, NULL, NULL, ?, 1)
    `).run(jobId, invoiceNumber, draftFields.issueDate, draftFields.dueDate, draftFields.totals.total, draftFields.publicNotes, attachmentFilename, tenantId, currentUser.id);

    const invoiceId = Number(result.lastInsertRowid);

    applyInvoiceDraftUpdate(db, {
      tenantId,
      invoiceId,
      jobId,
      invoiceNumber,
      issueDate: draftFields.issueDate,
      dueDate: draftFields.dueDate,
      customerName: draftFields.customerName,
      customerEmail: draftFields.customerEmail,
      customerPhone: draftFields.customerPhone,
      customerAddress: draftFields.customerAddress,
      companyName: tenantSettings.name,
      companyEmail: tenantSettings.company_email,
      companyPhone: tenantSettings.company_phone,
      companyAddress: tenantSettings.company_address,
      companyWebsite: tenantSettings.company_website,
      companyLogoPath: tenantSettings.logo_path,
      jobName: job.job_name,
      jobCode: job.job_code,
      termsText: draftFields.termsText,
      publicNotes: draftFields.publicNotes,
      internalNotes: draftFields.internalNotes,
      totals: draftFields.totals,
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
        total_amount: draftFields.totals.total,
        line_item_count: lineItems.length,
        date_issued: draftFields.issueDate,
        due_date: draftFields.dueDate,
      },
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect(`/invoice/${invoiceId}`);
  } catch (error) {
    if (attachmentFilename) deleteUploadedFile(attachmentFilename, invoiceAttachmentRootDir);
    const message = error instanceof ValidationError ? error.message : 'Unable to create invoice right now.';
    return renderApp(
      c,
      'Create Invoice',
      <AddInvoicePage
        jobs={jobs}
        prefillJobId={null}
        suggestedInvoiceNumber={suggestedInvoiceNumber}
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
  const invoice = db.prepare(`
    SELECT i.*, j.client_name
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.id = ? AND i.tenant_id = ?
    LIMIT 1
  `).get(invoiceId, tenantId) as any;
  if (!invoice) return c.text('Invoice not found', 404);

  try {
    ensureEditableInvoice(invoice);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to edit this invoice.';
    return renderInvoiceDetail(c, tenantId, invoiceId, { error: message }, 400);
  }

  return renderApp(
    c,
    'Edit Invoice',
    <EditInvoicePage
      invoice={invoice}
      jobs={loadJobs(db, tenantId)}
      csrfToken={c.get('csrfToken')}
      formValues={buildDraftFormFromInvoice(db, tenantId, invoice)}
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
  const invoice = db.prepare(`
    SELECT i.*, j.client_name
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.id = ? AND i.tenant_id = ?
    LIMIT 1
  `).get(invoiceId, tenantId) as any;
  if (!invoice) return c.text('Invoice not found', 404);

  const jobs = loadJobs(db, tenantId);
  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const formValues = buildInvoiceDraftFormFromBody(body, String(invoice.invoice_number || ''));

  let newStoredAttachment: string | null = null;

  try {
    ensureEditableInvoice(invoice);

    const tenantSettings = getTenantSettings(db, tenantId);
    if (!tenantSettings) throw new ValidationError('Tenant not found.');

    const jobId = parsePositiveInt(body['job_id'], 'Job');
    const invoiceNumber = normalizeInvoiceNumber(String(body['invoice_number'] ?? '').trim(), tenantSettings.invoice_prefix || 'INV');
    const lineItems = parseInvoiceLineItems(body);
    const draftFields = parseInvoiceDraftFields(body, lineItems);
    ensureDateOrder(draftFields.issueDate, draftFields.dueDate, 'Issue date', 'Due date');

    const job = db.prepare(`
      SELECT id, job_name, job_code, client_name
      FROM jobs
      WHERE id = ? AND tenant_id = ? AND archived_at IS NULL
    `).get(jobId, tenantId) as any;
    if (!job) throw new ValidationError('Selected job was not found for this company.');

    const duplicate = db.prepare(`
      SELECT id
      FROM invoices
      WHERE tenant_id = ? AND UPPER(invoice_number) = UPPER(?) AND id != ?
      LIMIT 1
    `).get(tenantId, invoiceNumber, invoiceId) as { id: number } | undefined;
    if (duplicate) throw new ValidationError('Invoice number already exists. Please choose a different one.');

    let nextAttachmentFilename = invoice.attachment_filename || null;
    let oldAttachmentToDelete: string | null = null;
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
      oldAttachmentToDelete = invoice.attachment_filename || null;
    }

    applyInvoiceDraftUpdate(db, {
      tenantId,
      invoiceId,
      jobId,
      invoiceNumber,
      issueDate: draftFields.issueDate,
      dueDate: draftFields.dueDate,
      customerName: draftFields.customerName,
      customerEmail: draftFields.customerEmail,
      customerPhone: draftFields.customerPhone,
      customerAddress: draftFields.customerAddress,
      companyName: tenantSettings.name,
      companyEmail: tenantSettings.company_email,
      companyPhone: tenantSettings.company_phone,
      companyAddress: tenantSettings.company_address,
      companyWebsite: tenantSettings.company_website,
      companyLogoPath: tenantSettings.logo_path,
      jobName: job.job_name,
      jobCode: job.job_code,
      termsText: draftFields.termsText,
      publicNotes: draftFields.publicNotes,
      internalNotes: draftFields.internalNotes,
      totals: draftFields.totals,
      attachmentFilename: nextAttachmentFilename,
      lineItems,
      status: invoice.status === 'Draft' ? 'Draft' : invoice.status || 'Draft',
    });

    if (oldAttachmentToDelete) deleteUploadedFile(oldAttachmentToDelete, invoiceAttachmentRootDir);

    logActivity(db, {
      tenantId,
      actorUserId: currentUser.id,
      eventType: 'invoice.updated',
      entityType: 'invoice',
      entityId: invoiceId,
      description: `${currentUser.name} updated draft invoice ${invoiceNumber}.`,
      metadata: {
        invoice_number: invoiceNumber,
        job_id: job.id,
        job_name: job.job_name,
        total_amount: draftFields.totals.total,
        line_item_count: lineItems.length,
      },
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect(`/invoice/${invoiceId}`);
  } catch (error) {
    if (newStoredAttachment) deleteUploadedFile(newStoredAttachment, invoiceAttachmentRootDir);
    const message = error instanceof ValidationError ? error.message : 'Unable to update invoice right now.';
    return renderApp(
      c,
      'Edit Invoice',
      <EditInvoicePage invoice={invoice} jobs={jobs} csrfToken={c.get('csrfToken')} error={message} formValues={formValues} />,
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
  const invoice = db.prepare(`
    SELECT id, invoice_number, attachment_filename, archived_at
    FROM invoices
    WHERE id = ? AND tenant_id = ?
    LIMIT 1
  `).get(invoiceId, tenantId) as any;
  if (!invoice) return c.text('Invoice not found', 404);
  if (invoice.archived_at) return c.redirect(`/invoice/${invoiceId}`);
  if (!invoice.attachment_filename) return c.redirect(`/edit_invoice/${invoiceId}`);

  deleteUploadedFile(invoice.attachment_filename, invoiceAttachmentRootDir);
  db.prepare(`UPDATE invoices SET attachment_filename = NULL WHERE id = ? AND tenant_id = ?`).run(invoiceId, tenantId);

  logActivity(db, {
    tenantId,
    actorUserId: currentUser.id,
    eventType: 'invoice.attachment_deleted',
    entityType: 'invoice',
    entityId: invoiceId,
    description: `${currentUser.name} removed the attachment from invoice ${invoice.invoice_number || `#${invoiceId}`}.`,
    metadata: { invoice_number: invoice.invoice_number, attachment_filename: invoice.attachment_filename },
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
  if (!tenant || !currentUser) return c.redirect('/login');

  let invoiceId: number;
  try {
    invoiceId = parseRouteId(c.req.param('id'), 'Invoice');
  } catch {
    return c.text('Attachment not found', 404);
  }

  const tenantId = tenant.id;
  const db = getDb();
  const invoice = db.prepare(`
    SELECT i.id, i.invoice_number, i.amount, i.job_id, i.attachment_filename, j.job_name
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.id = ? AND i.tenant_id = ?
    LIMIT 1
  `).get(invoiceId, tenantId) as any;
  if (!invoice || !invoice.attachment_filename) return c.text('Attachment not found', 404);

  try {
    const filePath = resolveUploadedFilePath(invoice.attachment_filename, invoiceAttachmentRootDir);
    if (!fs.existsSync(filePath)) return c.text('Attachment file not found', 404);

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
    const downloadName = buildSafeDownloadFilename(`invoice-${invoice.id}-attachment`, invoice.attachment_filename);

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


invoiceRoutes.post('/send_invoice/:id', permissionRequired('invoices.edit'), async (c) => {
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
  const data = loadInvoiceSummaryData(db, tenantId, invoiceId);
  if (!data) return c.text('Invoice not found', 404);

  if (data.inv.archived_at) {
    return renderInvoiceDetail(c, tenantId, invoiceId, { error: 'Archived invoices cannot be finalized.' }, 400);
  }
  if (data.status !== 'Draft') {
    return renderInvoiceDetail(c, tenantId, invoiceId, { error: 'Only draft invoices can be finalized.' }, 400);
  }
  if (data.payments.length > 0) {
    return renderInvoiceDetail(c, tenantId, invoiceId, { error: 'This invoice already has payments and cannot be finalized as a fresh draft.' }, 400);
  }

  const nextPdfVersion = Math.max(Number(data.inv.pdf_version || 0) + 1, 1);
  const relativePdfPath = buildStoredInvoicePdfRelativePath(tenantId, invoiceId, nextPdfVersion);
  const absolutePdfPath = ensureStoredInvoicePdfDir(relativePdfPath);
  const pdfBytes = await createFrozenInvoicePdf(data);
  fs.writeFileSync(absolutePdfPath, Buffer.from(pdfBytes));

  db.prepare(`
    UPDATE invoices
    SET status = 'Sent',
        sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP),
        sent_by_user_id = ?,
        locked_at = COALESCE(locked_at, CURRENT_TIMESTAMP),
        lock_reason = COALESCE(lock_reason, 'Finalized'),
        pdf_generated_at = CURRENT_TIMESTAMP,
        pdf_file_path = ?,
        pdf_version = ?,
        version_number = COALESCE(version_number, 1)
    WHERE id = ? AND tenant_id = ?
  `).run(currentUser.id, relativePdfPath, nextPdfVersion, invoiceId, tenantId);

  insertInvoiceEvent(db, {
    tenantId,
    invoiceId,
    eventType: 'invoice.finalized',
    description: `${currentUser.name} finalized and locked invoice ${data.inv.invoice_number || `#${invoiceId}`}.`,
    payload: {
      invoice_number: data.inv.invoice_number,
      total_amount: Number(data.inv.total_amount ?? data.inv.amount ?? 0),
      pdf_version: nextPdfVersion,
      pdf_file_path: relativePdfPath,
    },
    createdByUserId: currentUser.id,
  });

  logActivity(db, {
    tenantId,
    actorUserId: currentUser.id,
    eventType: 'invoice.finalized',
    entityType: 'invoice',
    entityId: invoiceId,
    description: `${currentUser.name} finalized and locked invoice ${data.inv.invoice_number || `#${invoiceId}`}.`,
    metadata: {
      invoice_number: data.inv.invoice_number,
      total_amount: Number(data.inv.total_amount ?? data.inv.amount ?? 0),
      pdf_version: nextPdfVersion,
      pdf_file_path: relativePdfPath,
      job_id: data.inv.job_id,
      job_name: data.inv.job_name,
    },
    ipAddress: resolveRequestIp(c),
  });

  return renderInvoiceDetail(c, tenantId, invoiceId, { success: 'Invoice finalized, locked, and frozen PDF snapshot generated.' });
});

invoiceRoutes.post('/void_invoice/:id', permissionRequired('invoices.edit'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  let invoiceId: number;
  try {
    invoiceId = parseRouteId(c.req.param('id'), 'Invoice');
  } catch {
    return c.text('Invoice not found', 404);
  }

  const form = await c.req.parseBody();
  const tenantId = tenant.id;
  const db = getDb();
  const data = loadInvoiceSummaryData(db, tenantId, invoiceId);
  if (!data) return c.text('Invoice not found', 404);

  if (data.inv.archived_at) {
    return renderInvoiceDetail(c, tenantId, invoiceId, { error: 'Archived invoices cannot be voided.' }, 400);
  }
  if (data.status === 'Paid') {
    return renderInvoiceDetail(c, tenantId, invoiceId, { error: 'Paid invoices cannot be voided. Use a separate credit/refund workflow instead.' }, 400);
  }
  if (data.status === 'Voided') {
    return renderInvoiceDetail(c, tenantId, invoiceId, { error: 'This invoice is already voided.' }, 400);
  }
  if (data.payments.length > 0) {
    return renderInvoiceDetail(c, tenantId, invoiceId, { error: 'Invoices with recorded payments cannot be voided.' }, 400);
  }

  const voidReasonRaw = String(form['void_reason'] ?? '').trim();
  const voidReason = voidReasonRaw ? voidReasonRaw.slice(0, 500) : 'Voided by tenant user.';

  db.prepare(`
    UPDATE invoices
    SET status = 'Voided',
        voided_at = CURRENT_TIMESTAMP,
        voided_by_user_id = ?,
        void_reason = ?,
        locked_at = COALESCE(locked_at, CURRENT_TIMESTAMP),
        lock_reason = COALESCE(lock_reason, 'Voided')
    WHERE id = ? AND tenant_id = ?
  `).run(currentUser.id, voidReason, invoiceId, tenantId);

  insertInvoiceEvent(db, {
    tenantId,
    invoiceId,
    eventType: 'invoice.voided',
    description: `${currentUser.name} voided invoice ${data.inv.invoice_number || `#${invoiceId}`}.`,
    payload: {
      invoice_number: data.inv.invoice_number,
      void_reason: voidReason,
      total_amount: Number(data.inv.total_amount ?? data.inv.amount ?? 0),
    },
    createdByUserId: currentUser.id,
  });

  logActivity(db, {
    tenantId,
    actorUserId: currentUser.id,
    eventType: 'invoice.voided',
    entityType: 'invoice',
    entityId: invoiceId,
    description: `${currentUser.name} voided invoice ${data.inv.invoice_number || `#${invoiceId}`}.`,
    metadata: {
      invoice_number: data.inv.invoice_number,
      void_reason: voidReason,
      total_amount: Number(data.inv.total_amount ?? data.inv.amount ?? 0),
      job_id: data.inv.job_id,
      job_name: data.inv.job_name,
    },
    ipAddress: resolveRequestIp(c),
  });

  return renderInvoiceDetail(c, tenantId, invoiceId, { success: 'Invoice voided successfully.' });
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
  const data = loadInvoiceSummaryData(db, tenantId, invoiceId);
  if (!data) return c.text('Invoice not found', 404);

  let pdfBuffer: Buffer;
  if (data.inv.pdf_file_path) {
    const storedPdfPath = resolveStoredInvoicePdfAbsolutePath(getEnv().uploadDir, data.inv.pdf_file_path);
    if (fs.existsSync(storedPdfPath)) {
      pdfBuffer = fs.readFileSync(storedPdfPath);
    } else {
      const regenerated = await createFrozenInvoicePdf(data);
      pdfBuffer = Buffer.from(regenerated);
    }
  } else {
    const livePdf = await createFrozenInvoicePdf(data);
    pdfBuffer = Buffer.from(livePdf);
  }

  const label = data.inv.invoice_number || `#${data.inv.id}`;
  const filename = `invoice_${String(label).replace(/ /g, '_').replace(/#/g, '')}.pdf`;
  return new Response(pdfBuffer, {
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
  const invoice = db.prepare(`
    SELECT i.id, i.invoice_number, COALESCE(i.total_amount, i.amount) AS amount, i.job_id, i.archived_at, j.job_name
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.id = ? AND i.tenant_id = ?
  `).get(invoiceId, tenantId) as any;
  if (!invoice) return c.text('Invoice not found', 404);

  const paymentRow = db.prepare(`SELECT COUNT(*) as total FROM payments WHERE invoice_id = ? AND tenant_id = ?`).get(invoiceId, tenantId) as { total: number };
  const paymentCount = Number(paymentRow?.total || 0);
  if (paymentCount > 0) {
    return renderInvoiceDetail(c, tenantId, invoiceId, {
      error: 'Cannot archive this invoice while payments are attached. Remove the payments first, then archive the invoice.',
    }, 400);
  }

  if (!invoice.archived_at) {
    db.prepare(`
      UPDATE invoices
      SET archived_at = CURRENT_TIMESTAMP,
          archived_by_user_id = ?
      WHERE id = ? AND tenant_id = ?
    `).run(currentUser.id, invoiceId, tenantId);

    logActivity(db, {
      tenantId,
      actorUserId: currentUser.id,
      eventType: 'invoice.archived',
      entityType: 'invoice',
      entityId: invoiceId,
      description: `${currentUser.name} archived invoice ${invoice.invoice_number || `#${invoiceId}`}.`,
      metadata: { invoice_number: invoice.invoice_number, amount: Number(invoice.amount || 0), job_id: invoice.job_id, job_name: invoice.job_name },
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
  const invoice = db.prepare(`
    SELECT i.id, i.invoice_number, COALESCE(i.total_amount, i.amount) AS amount, i.job_id, j.job_name
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.id = ? AND i.tenant_id = ?
  `).get(invoiceId, tenantId) as any;
  if (!invoice) return c.text('Invoice not found', 404);

  db.prepare(`
    UPDATE invoices
    SET archived_at = NULL,
        archived_by_user_id = NULL
    WHERE id = ? AND tenant_id = ?
  `).run(invoiceId, tenantId);

  logActivity(db, {
    tenantId,
    actorUserId: currentUser.id,
    eventType: 'invoice.restored',
    entityType: 'invoice',
    entityId: invoiceId,
    description: `${currentUser.name} restored invoice ${invoice.invoice_number || `#${invoiceId}`}.`,
    metadata: { invoice_number: invoice.invoice_number, amount: Number(invoice.amount || 0), job_id: invoice.job_id, job_name: invoice.job_name },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect('/invoices?show_archived=1');
});

export default invoiceRoutes;
