import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import type { EstimateStatus } from '../db/types.js';
import * as estimates from '../db/queries/estimates.js';
import * as jobs from '../db/queries/jobs.js';
import { loginRequired, roleRequired } from '../middleware/auth.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { EstimatesListPage } from '../pages/estimates/EstimatesListPage.js';
import { EstimateFormPage } from '../pages/estimates/EstimateFormPage.js';
import { EstimateDetailPage } from '../pages/estimates/EstimateDetailPage.js';
import { sendEstimateToCustomer } from '../services/send-estimate.js';
import { generateEstimateProposalPdf } from '../services/estimate-pdf.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';

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

const ALL_STATUSES = [
  'draft',
  'ready',
  'sent',
  'approved',
  'rejected',
  'expired',
  'converted',
] as const;

const EDITABLE_STATUSES = ['draft', 'ready'] as const;
const SENDABLE_STATUSES = ['draft', 'ready', 'sent'] as const;

type EditableEstimateStatus = (typeof EDITABLE_STATUSES)[number];
type SendableEstimateStatus = (typeof SENDABLE_STATUSES)[number];

type EstimateLineItemFormValue = {
  description: string;
  quantity: string;
  unit: string;
  unit_cost: string;
  upcharge_percent: string;
  apply_upcharge: boolean;
  unit_price: string;
};

function parsePositiveInt(value: string): number | null {
  if (!/^\d+$/.test(String(value || '').trim())) return null;
  const parsed = Number.parseInt(value, 10);
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

function normalizeOptionalDate(value: unknown, fieldLabel: string): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;

  if (!isRealIsoDate(raw)) {
    throw new Error(`${fieldLabel} must be a valid date.`);
  }

  return raw;
}

function requireText(value: unknown, fieldLabel: string, maxLength: number): string {
  const parsed = String(value ?? '').trim();

  if (!parsed) {
    throw new Error(`${fieldLabel} is required.`);
  }

  if (parsed.length > maxLength) {
    throw new Error(`${fieldLabel} must be ${maxLength} characters or less.`);
  }

  return parsed;
}

function normalizeOptionalText(value: unknown, maxLength: number, fieldLabel: string): string | undefined {
  const parsed = String(value ?? '').trim();
  if (!parsed) return undefined;

  if (parsed.length > maxLength) {
    throw new Error(`${fieldLabel} must be ${maxLength} characters or less.`);
  }

  return parsed;
}

function parseNonNegativeMoney(value: unknown, fieldLabel: string): number {
  const raw = String(value ?? '').trim();

  if (!raw) return 0;

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`${fieldLabel} must be a valid non-negative number with up to 2 decimal places.`);
  }

  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a valid non-negative number.`);
  }

  return Number(parsed.toFixed(2));
}

function parsePercent(value: unknown, fieldLabel: string): number {
  const raw = String(value ?? '').trim();

  if (!raw) return 0;

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`${fieldLabel} must be a valid percentage.`);
  }

  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1000) {
    throw new Error(`${fieldLabel} must be between 0 and 1000.`);
  }

  return Number(parsed.toFixed(2));
}

function parseEditableStatus(value: unknown): EditableEstimateStatus {
  const parsed = String(value ?? 'draft').trim().toLowerCase() as EditableEstimateStatus;

  if (!EDITABLE_STATUSES.includes(parsed)) {
    throw new Error('Please select a valid estimate status.');
  }

  return parsed;
}

function parseFilterStatus(value: unknown): EstimateStatus | undefined {
  const parsed = String(value ?? '').trim().toLowerCase() as EstimateStatus;
  if (!parsed) return undefined;
  return (ALL_STATUSES as readonly string[]).includes(parsed) ? parsed : undefined;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function calculateUnitPrice(unitCost: number, upchargePercent: number, applyUpcharge: boolean): number {
  if (!applyUpcharge) return roundMoney(unitCost);
  return roundMoney(unitCost * (1 + upchargePercent / 100));
}

function buildBlankLineItems(count = 1, defaultUpchargePercent = 0): EstimateLineItemFormValue[] {
  return Array.from({ length: count }, () => ({
    description: '',
    quantity: '',
    unit: '',
    unit_cost: '',
    upcharge_percent: defaultUpchargePercent > 0 ? String(defaultUpchargePercent) : '',
    apply_upcharge: defaultUpchargePercent > 0,
    unit_price: '',
  }));
}

function parseLineCount(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? '0').trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 250);
}

function extractLineItemsFromBody(body: Record<string, unknown>): EstimateLineItemFormValue[] {
  const rows: EstimateLineItemFormValue[] = [];
  const lineCount = parseLineCount(body.line_count);

  for (let i = 0; i < lineCount; i += 1) {
    rows.push({
      description: String(body[`line_description_${i}`] ?? '').trim(),
      quantity: String(body[`line_quantity_${i}`] ?? '').trim(),
      unit: String(body[`line_unit_${i}`] ?? '').trim(),
      unit_cost: String(body[`line_unit_cost_${i}`] ?? '').trim(),
      upcharge_percent: String(body[`line_upcharge_percent_${i}`] ?? '').trim(),
      apply_upcharge: String(body[`line_apply_upcharge_${i}`] ?? '').trim() === '1',
      unit_price: String(body[`line_unit_price_${i}`] ?? '').trim(),
    });
  }

  return rows;
}

function normalizeLineItems(formRows: EstimateLineItemFormValue[]) {
  const lineItems = formRows
    .map((row, index) => {
      const description = row.description.trim();
      const quantity = parseNonNegativeMoney(row.quantity, `Line ${index + 1} quantity`);
      const unitCost = parseNonNegativeMoney(row.unit_cost, `Line ${index + 1} base cost`);
      const upchargePercent = parsePercent(row.upcharge_percent, `Line ${index + 1} upcharge percent`);
      const applyUpcharge = Boolean(row.apply_upcharge);
      const unitPrice = calculateUnitPrice(unitCost, upchargePercent, applyUpcharge);
      const unit = String(row.unit || '').trim().slice(0, 40);

      return {
        description,
        quantity,
        unit,
        unit_cost: unitCost,
        upcharge_percent: upchargePercent,
        apply_upcharge: applyUpcharge,
        unit_price: unitPrice,
        line_total: roundMoney(quantity * unitPrice),
        sort_order: index,
      };
    })
    .filter((row) => (
      row.description ||
      row.quantity > 0 ||
      row.unit_cost > 0 ||
      row.upcharge_percent > 0 ||
      row.unit ||
      row.apply_upcharge
    ));

  const invalidRow = lineItems.find((row) => !row.description);
  if (invalidRow) {
    throw new Error('Each estimate line with values must include a description.');
  }

  if (!lineItems.length) {
    throw new Error('At least one line item is required.');
  }

  return lineItems;
}

function calculateTotals(lineItems: Array<{ line_total: number }>, taxRatePercent: number) {
  const subtotal = roundMoney(lineItems.reduce((sum, row) => sum + Number(row.line_total || 0), 0));
  const tax = roundMoney((subtotal * taxRatePercent) / 100);
  const total = roundMoney(subtotal + tax);

  return { subtotal, tax, total };
}

function buildEstimateFormData(
  body: Record<string, unknown>,
  fallbackTaxRate: number,
): {
  estimate_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  site_address: string;
  scope_of_work: string;
  proposal_title: string;
  payment_schedule: string;
  custom_terms: string;
  status: string;
  expiration_date: string;
  tax_rate: string;
  default_upcharge_percent: string;
  line_items: EstimateLineItemFormValue[];
  subtotal: string;
  tax: string;
  total: string;
} {
  return {
    estimate_number: String(body.estimate_number ?? '').trim(),
    customer_name: String(body.customer_name ?? '').trim(),
    customer_email: String(body.customer_email ?? '').trim(),
    customer_phone: String(body.customer_phone ?? '').trim(),
    site_address: String(body.site_address ?? '').trim(),
    scope_of_work: String(body.scope_of_work ?? '').trim(),
    proposal_title: String(body.proposal_title ?? '').trim(),
    payment_schedule: String(body.payment_schedule ?? '').trim(),
    custom_terms: String(body.custom_terms ?? '').trim(),
    status: String(body.status ?? 'draft').trim().toLowerCase(),
    expiration_date: String(body.expiration_date ?? '').trim(),
    tax_rate: String(body.tax_rate ?? String(fallbackTaxRate ?? 0)).trim(),
    default_upcharge_percent: String(body.default_upcharge_percent ?? '').trim(),
    line_items: extractLineItemsFromBody(body),
    subtotal: String(body.subtotal ?? '').trim(),
    tax: String(body.tax ?? '').trim(),
    total: String(body.total ?? '').trim(),
  };
}

function buildEstimateFormDataFromRecord(
  estimate: Awaited<ReturnType<typeof estimates.findWithLineItemsById>>,
  fallbackTaxRate: number,
) {
  const lineItems = estimate?.line_items?.length
    ? estimate.line_items.map((item) => ({
        description: item.description ?? '',
        quantity: String(Number(item.quantity || 0)),
        unit: item.unit ?? '',
        unit_cost: String(Number(item.unit_cost || 0)),
        upcharge_percent: String(Number(item.upcharge_percent || 0)),
        apply_upcharge: Boolean(item.apply_upcharge),
        unit_price: String(Number(item.unit_price || 0)),
      }))
    : buildBlankLineItems(1);

  const subtotal = Number(estimate?.subtotal || 0);
  const tax = Number(estimate?.tax || 0);
  const taxRate = subtotal > 0 ? roundMoney((tax / subtotal) * 100) : roundMoney(fallbackTaxRate || 0);
  const defaultUpchargePercent = lineItems.find((item) => item.apply_upcharge && Number(item.upcharge_percent || 0) > 0)?.upcharge_percent || '';

  return {
    estimate_number: estimate?.estimate_number ?? '',
    customer_name: estimate?.customer_name ?? '',
    customer_email: estimate?.customer_email ?? '',
    customer_phone: estimate?.customer_phone ?? '',
    site_address: estimate?.site_address ?? '',
    scope_of_work: estimate?.scope_of_work ?? '',
    proposal_title: estimate?.proposal_title ?? '',
    payment_schedule: estimate?.payment_schedule ?? '',
    custom_terms: estimate?.custom_terms ?? '',
    status: estimate?.status ?? 'draft',
    expiration_date: estimate?.expiration_date ?? '',
    tax_rate: String(taxRate),
    default_upcharge_percent: defaultUpchargePercent,
    line_items: lineItems,
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2),
    total: Number(estimate?.total || 0).toFixed(2),
  };
}

function canEditEstimateStatus(status: string | null | undefined): boolean {
  return EDITABLE_STATUSES.includes(String(status ?? '').trim().toLowerCase() as EditableEstimateStatus);
}

function canSendEstimateStatus(status: string | null | undefined): boolean {
  return SENDABLE_STATUSES.includes(String(status ?? '').trim().toLowerCase() as SendableEstimateStatus);
}

function isManagerOrAdmin(user: any): boolean {
  return user?.role === 'Admin' || user?.role === 'Manager';
}

function buildPublicEstimateUrl(c: any, token: string): string {
  const requestUrl = new URL(c.req.url);
  return `${requestUrl.origin}/estimate/view/${token}`;
}

function buildPublicBaseUrl(c: any): string {
  const requestUrl = new URL(c.req.url);
  return requestUrl.origin;
}

function buildDetailNotice(rawValue: string | undefined): { message?: string; tone?: 'info' | 'success' | 'danger' } {
  const normalized = String(rawValue || '').trim().toLowerCase();

  if (normalized === 'sent') {
    return {
      message: 'Estimate email sent successfully. The customer approval link is shown below as a backup.',
      tone: 'success',
    };
  }

  if (normalized === 'updated') {
    return {
      message: 'Estimate updated successfully.',
      tone: 'success',
    };
  }

  if (normalized === 'archived') {
    return {
      message: 'Estimate archived successfully.',
      tone: 'success',
    };
  }

  if (normalized === 'restored') {
    return {
      message: 'Estimate restored successfully.',
      tone: 'success',
    };
  }

  return {};
}

function generateNextEstimateNumber(db: any, tenantId: number): string {
  const year = new Date().getFullYear();
  const prefix = `EST-${year}-`;
  const row = db.prepare(`
    SELECT estimate_number
    FROM estimates
    WHERE tenant_id = ? AND estimate_number LIKE ?
    ORDER BY id DESC
    LIMIT 1
  `).get(tenantId, `${prefix}%`) as { estimate_number?: string } | undefined;

  const lastSequence = row?.estimate_number ? Number.parseInt(row.estimate_number.slice(prefix.length), 10) : 0;
  const nextSequence = Number.isInteger(lastSequence) ? lastSequence + 1 : 1;
  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

export const estimateRoutes = new Hono<AppEnv>();

estimateRoutes.get('/estimates/archived', loginRequired, (c) => {
  const url = new URL(c.req.url);
  const params = new URLSearchParams(url.search);
  params.set('show_archived', '1');
  const query = params.toString();
  return c.redirect(query ? `/estimates?${query}` : '/estimates?show_archived=1');
});

estimateRoutes.get('/estimates', loginRequired, (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const db = getDb();

  const status = parseFilterStatus(c.req.query('status'));
  const showArchived = c.req.query('show_archived') === '1';
  const rows = estimates.listByTenant(db, tenantId, status, showArchived);

  const summary = rows.reduce(
    (acc: { totalCount: number; totalValue: number; statusCounts: Record<string, number> }, row: any) => {
      acc.totalCount += 1;
      acc.totalValue += Number(row.total || 0);
      const normalizedStatus = String(row.status || 'draft');
      acc.statusCounts[normalizedStatus] = (acc.statusCounts[normalizedStatus] || 0) + 1;
      return acc;
    },
    {
      totalCount: 0,
      totalValue: 0,
      statusCounts: {} as Record<string, number>,
    },
  );

  return renderApp(
    c,
    'Estimates',
    <EstimatesListPage
      estimates={rows}
      selectedStatus={status ?? ''}
      totalCount={summary.totalCount}
      totalValue={Number(summary.totalValue.toFixed(2))}
      draftCount={summary.statusCounts.draft || 0}
      readyCount={summary.statusCounts.ready || 0}
      sentCount={summary.statusCounts.sent || 0}
      approvedCount={summary.statusCounts.approved || 0}
      rejectedCount={summary.statusCounts.rejected || 0}
      canCreateEstimates={isManagerOrAdmin(currentUser)}
      showArchived={showArchived}
    />,
  );
});

estimateRoutes.get('/estimates/new', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const tenantDefaults = tenant as any;
  const db = getDb();
  const taxRate = Number(tenantDefaults?.default_tax_rate || 0);
  const estimateNumber = generateNextEstimateNumber(db, tenant!.id);

  return renderApp(
    c,
    'New Estimate',
    <EstimateFormPage
      mode="create"
      estimateNumber={estimateNumber}
      formData={{
        estimate_number: estimateNumber,
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        site_address: '',
        scope_of_work: '',
        proposal_title: '',
        payment_schedule: '',
        custom_terms: '',
        status: 'draft',
        expiration_date: '',
        tax_rate: String(taxRate),
        default_upcharge_percent: '',
        line_items: buildBlankLineItems(1),
        subtotal: '0.00',
        tax: '0.00',
        total: '0.00',
      }}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

estimateRoutes.post('/estimates/new', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const tenantDefaults = tenant as any;
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const db = getDb();
  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const fallbackTaxRate = Number(tenantDefaults?.default_tax_rate || 0);
  const formData = buildEstimateFormData(body, fallbackTaxRate);

  try {
    const customerName = requireText(body.customer_name, 'Customer name', 120);
    const customerEmail = normalizeOptionalText(body.customer_email, 160, 'Customer email');
    const customerPhone = normalizeOptionalText(body.customer_phone, 40, 'Customer phone');
    const siteAddress = normalizeOptionalText(body.site_address, 240, 'Site address');
    const scopeOfWork = normalizeOptionalText(body.scope_of_work, 5000, 'Job description');
    const proposalTitle = normalizeOptionalText(body.proposal_title, 255, 'Proposal title');
    const paymentSchedule = normalizeOptionalText(body.payment_schedule, 4000, 'Payment schedule');
    const customTerms = normalizeOptionalText(body.custom_terms, 8000, 'Estimate-specific terms');
    const expirationDate = normalizeOptionalDate(body.expiration_date, 'Expiration date');
    const taxRate = parsePercent(body.tax_rate, 'Tax rate');
    const status = parseEditableStatus(body.status);
    const lineItems = normalizeLineItems(formData.line_items);
    const totals = calculateTotals(lineItems, taxRate);
    const estimateNumber = generateNextEstimateNumber(db, tenantId);

    const estimateId = estimates.create(db, tenantId, {
      estimate_number: estimateNumber,
      customer_name: customerName,
      customer_email: customerEmail ?? null,
      customer_phone: customerPhone ?? null,
      site_address: siteAddress ?? null,
      scope_of_work: scopeOfWork ?? null,
      proposal_title: proposalTitle ?? null,
      payment_schedule: paymentSchedule ?? null,
      custom_terms: customTerms ?? null,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      status,
      created_by_user_id: currentUser!.id,
      updated_by_user_id: currentUser!.id,
      expiration_date: expirationDate ?? null,
      line_items: lineItems,
    });

    logActivity(db, {
      tenantId,
      actorUserId: currentUser?.id,
      eventType: 'estimate.created',
      entityType: 'estimate',
      entityId: estimateId,
      description: `${currentUser?.name || 'User'} created estimate ${estimateNumber}.`,
      metadata: {
        estimate_number: estimateNumber,
        customer_name: customerName,
        status,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        line_item_count: lineItems.length,
        total_base_cost: roundMoney(lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0)),
      },
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect(`/estimate/${estimateId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create estimate.';
    return renderApp(
      c,
      'New Estimate',
      <EstimateFormPage
        mode="create"
        estimateNumber={formData.estimate_number || generateNextEstimateNumber(db, tenantId)}
        formData={formData}
        error={message}
        csrfToken={c.get('csrfToken')}
      />,
      400,
    );
  }
});

estimateRoutes.get('/estimate/:id', loginRequired, (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const estimateId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!estimateId) {
    return c.text('Estimate not found', 404);
  }

  const estimate = estimates.findWithLineItemsById(db, estimateId, tenantId);

  if (!estimate) {
    return c.text('Estimate not found', 404);
  }

  const publicUrl = estimate.public_token
    ? buildPublicEstimateUrl(c, estimate.public_token)
    : null;

  const detailNotice = buildDetailNotice(c.req.query('notice'));

  return renderApp(
    c,
    'Estimate Detail',
    <EstimateDetailPage
      estimate={estimate}
      canEditEstimate={isManagerOrAdmin(currentUser) && canEditEstimateStatus(estimate.status)}
      canSendEstimate={isManagerOrAdmin(currentUser) && canSendEstimateStatus(estimate.status)}
      csrfToken={c.get('csrfToken')}
      publicUrl={publicUrl}
      notice={detailNotice.message}
      noticeTone={detailNotice.tone}
    />,
  );
});


estimateRoutes.get('/estimate/:id/pdf', loginRequired, async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const estimateId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!estimateId) {
    return c.text('Estimate not found', 404);
  }

  const estimate = estimates.findWithLineItemsById(db, estimateId, tenantId);

  if (!estimate) {
    return c.text('Estimate not found', 404);
  }

  const tenantSettings = db.prepare(`
    SELECT
      id,
      name,
      subdomain,
      logo_path,
      company_email,
      company_phone,
      company_address,
      company_website,
      proposal_license_info,
      proposal_default_terms,
      proposal_default_acknowledgment
    FROM tenants
    WHERE id = ?
    LIMIT 1
  `).get(tenantId) as {
    id: number;
    name: string;
    subdomain: string;
    logo_path: string | null;
    company_email: string | null;
    company_phone: string | null;
    company_address: string | null;
    company_website: string | null;
    proposal_license_info: string | null;
    proposal_default_terms: string | null;
    proposal_default_acknowledgment: string | null;
  } | undefined;

  if (!tenantSettings) {
    return c.text('Tenant not found', 404);
  }

  const pdfBytes = await generateEstimateProposalPdf({
    tenant: {
      name: tenantSettings.name,
      subdomain: tenantSettings.subdomain,
      logo_path: tenantSettings.logo_path,
      company_email: tenantSettings.company_email,
      company_phone: tenantSettings.company_phone,
      company_address: tenantSettings.company_address,
      company_website: tenantSettings.company_website,
      proposal_license_info: tenantSettings.proposal_license_info,
      proposal_default_terms: tenantSettings.proposal_default_terms,
      proposal_default_acknowledgment: tenantSettings.proposal_default_acknowledgment,
    },
    estimate,
  });

  logActivity(db, {
    tenantId,
    actorUserId: currentUser?.id,
    eventType: 'estimate.pdf_downloaded',
    entityType: 'estimate',
    entityId: estimateId,
    description: `${currentUser?.name || 'User'} downloaded the proposal PDF for estimate ${estimate.estimate_number}.`,
    metadata: {
      estimate_number: estimate.estimate_number,
      customer_name: estimate.customer_name,
      status: estimate.status,
    },
    ipAddress: resolveRequestIp(c),
  });

  const safeLabel = String(estimate.estimate_number || `estimate_${estimate.id}`)
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || `estimate_${estimate.id}`;

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeLabel}_proposal.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
});

estimateRoutes.post('/estimate/:id/send', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const estimateId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!estimateId) {
    return c.text('Estimate not found', 404);
  }

  const estimate = estimates.findWithLineItemsById(db, estimateId, tenantId);

  if (!estimate) {
    return c.text('Estimate not found', 404);
  }

  if (!canSendEstimateStatus(estimate.status)) {
    return c.redirect(`/estimate/${estimateId}`);
  }

  try {
    const delivery = await sendEstimateToCustomer(
      db,
      estimateId,
      tenantId,
      currentUser!.id,
      buildPublicBaseUrl(c),
    );

    const refreshed = estimates.findById(db, estimateId, tenantId);

    logActivity(db, {
      tenantId,
      actorUserId: currentUser?.id,
      eventType: 'estimate.sent',
      entityType: 'estimate',
      entityId: estimateId,
      description: `${currentUser?.name || 'User'} emailed estimate ${estimate.estimate_number} to the customer.`,
      metadata: {
        estimate_number: estimate.estimate_number,
        customer_name: estimate.customer_name,
        customer_email: delivery.recipientEmail,
        public_url: delivery.publicUrl,
        smtp_message_id: delivery.messageId,
        status_before: estimate.status,
        status_after: refreshed?.status || 'sent',
        sent_at: refreshed?.sent_at || null,
        has_public_token: Boolean(refreshed?.public_token),
      },
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect(`/estimate/${estimateId}?notice=sent`);
  } catch (error) {
    const refreshed = estimates.findWithLineItemsById(db, estimateId, tenantId);
    const message = error instanceof Error ? error.message : 'Unable to send estimate email.';
    const publicUrl = refreshed?.public_token ? buildPublicEstimateUrl(c, refreshed.public_token) : null;

    return renderApp(
      c,
      'Estimate Detail',
      <EstimateDetailPage
        estimate={refreshed || estimate}
        canEditEstimate={isManagerOrAdmin(currentUser) && canEditEstimateStatus((refreshed || estimate).status)}
        canSendEstimate={isManagerOrAdmin(currentUser) && canSendEstimateStatus((refreshed || estimate).status)}
        csrfToken={c.get('csrfToken')}
        publicUrl={publicUrl}
        notice={`Email send failed: ${message}`}
        noticeTone="danger"
      />,
      400,
    );
  }
});

estimateRoutes.get('/estimate/:id/edit', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const tenantDefaults = tenant as any;
  const tenantId = tenant!.id;
  const estimateId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!estimateId) {
    return c.text('Estimate not found', 404);
  }

  const estimate = estimates.findWithLineItemsById(db, estimateId, tenantId);

  if (!estimate) {
    return c.text('Estimate not found', 404);
  }

  if (!canEditEstimateStatus(estimate.status)) {
    return renderApp(
      c,
      'Estimate Detail',
      <EstimateDetailPage
        estimate={estimate}
        canEditEstimate={false}
        canSendEstimate={isManagerOrAdmin(c.get('user')) && canSendEstimateStatus(estimate.status)}
        csrfToken={c.get('csrfToken')}
        publicUrl={estimate.public_token ? buildPublicEstimateUrl(c, estimate.public_token) : null}
        notice="Only draft and ready estimates can be edited at this stage."
        noticeTone="info"
      />,
    );
  }

  return renderApp(
    c,
    'Edit Estimate',
    <EstimateFormPage
      mode="edit"
      estimateId={estimateId}
      estimateNumber={estimate.estimate_number}
      formData={buildEstimateFormDataFromRecord(estimate, Number(tenantDefaults?.default_tax_rate || 0))}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

estimateRoutes.post('/estimate/:id/edit', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const tenantDefaults = tenant as any;
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const estimateId = parsePositiveInt(c.req.param('id'));
  const db = getDb();
  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const fallbackTaxRate = Number(tenantDefaults?.default_tax_rate || 0);
  const formData = buildEstimateFormData(body, fallbackTaxRate);

  if (!estimateId) {
    return c.text('Estimate not found', 404);
  }

  const existingEstimate = estimates.findWithLineItemsById(db, estimateId, tenantId);

  if (!existingEstimate) {
    return c.text('Estimate not found', 404);
  }

  if (!canEditEstimateStatus(existingEstimate.status)) {
    return renderApp(
      c,
      'Estimate Detail',
      <EstimateDetailPage
        estimate={existingEstimate}
        canEditEstimate={false}
        canSendEstimate={isManagerOrAdmin(currentUser) && canSendEstimateStatus(existingEstimate.status)}
        csrfToken={c.get('csrfToken')}
        publicUrl={existingEstimate.public_token ? buildPublicEstimateUrl(c, existingEstimate.public_token) : null}
        notice="Only draft and ready estimates can be edited at this stage."
        noticeTone="info"
      />,
    );
  }

  try {
    const customerName = requireText(body.customer_name, 'Customer name', 120);
    const customerEmail = normalizeOptionalText(body.customer_email, 160, 'Customer email');
    const customerPhone = normalizeOptionalText(body.customer_phone, 40, 'Customer phone');
    const siteAddress = normalizeOptionalText(body.site_address, 240, 'Site address');
    const scopeOfWork = normalizeOptionalText(body.scope_of_work, 5000, 'Job description');
    const proposalTitle = normalizeOptionalText(body.proposal_title, 255, 'Proposal title');
    const paymentSchedule = normalizeOptionalText(body.payment_schedule, 4000, 'Payment schedule');
    const customTerms = normalizeOptionalText(body.custom_terms, 8000, 'Estimate-specific terms');
    const expirationDate = normalizeOptionalDate(body.expiration_date, 'Expiration date');
    const taxRate = parsePercent(body.tax_rate, 'Tax rate');
    const status = parseEditableStatus(body.status);
    const lineItems = normalizeLineItems(formData.line_items);
    const totals = calculateTotals(lineItems, taxRate);

    estimates.update(db, estimateId, tenantId, {
      customer_name: customerName,
      customer_email: customerEmail ?? null,
      customer_phone: customerPhone ?? null,
      site_address: siteAddress ?? null,
      scope_of_work: scopeOfWork ?? null,
      proposal_title: proposalTitle ?? null,
      payment_schedule: paymentSchedule ?? null,
      custom_terms: customTerms ?? null,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      status,
      updated_by_user_id: currentUser!.id,
      expiration_date: expirationDate ?? null,
    });

    estimates.replaceLineItems(db, estimateId, tenantId, lineItems);

    logActivity(db, {
      tenantId,
      actorUserId: currentUser?.id,
      eventType: 'estimate.updated',
      entityType: 'estimate',
      entityId: estimateId,
      description: `${currentUser?.name || 'User'} updated estimate ${existingEstimate.estimate_number}.`,
      metadata: {
        estimate_number: existingEstimate.estimate_number,
        customer_name: customerName,
        status,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        line_item_count: lineItems.length,
        total_base_cost: roundMoney(lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0)),
      },
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect(`/estimate/${estimateId}?notice=updated`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update estimate.';
    return renderApp(
      c,
      'Edit Estimate',
      <EstimateFormPage
        mode="edit"
        estimateId={estimateId}
        estimateNumber={existingEstimate.estimate_number}
        formData={{
          ...formData,
          estimate_number: existingEstimate.estimate_number,
        }}
        error={message}
        csrfToken={c.get('csrfToken')}
      />,
      400,
    );
  }
});

function buildConvertedJobName(estimate: any): string {
  return `${estimate.customer_name} - ${estimate.estimate_number}`.slice(0, 120);
}

estimateRoutes.post('/estimate/:id/convert', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const estimateId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!estimateId) return c.text('Estimate not found', 404);

  const estimate = estimates.findWithLineItemsById(db, estimateId, tenantId);
  if (!estimate) return c.text('Estimate not found', 404);
  if (estimate.converted_job_id) return c.redirect(`/estimate/${estimateId}`);

  const txn = db.transaction(() => {
    const jobId = jobs.create(db, tenantId, {
      job_name: buildConvertedJobName(estimate),
      client_name: estimate.customer_name,
      contract_amount: estimate.total,
      status: 'Active',
      job_description: estimate.scope_of_work ?? null,
      source_estimate_id: estimate.id,
      source_estimate_number: estimate.estimate_number,
      source_estimate_customer_name: estimate.customer_name,
    } as any);

    estimates.setStatus(db, estimateId, tenantId, 'converted', {
      updated_by_user_id: currentUser?.id,
      responded_at: estimate.responded_at ?? new Date().toISOString(),
      approval_notes: estimate.approval_notes,
      rejection_reason: null,
      converted_job_id: jobId,
      public_token: estimate.public_token,
    });

    return jobId;
  });

  const jobId = txn();

  logActivity(db, {
    tenantId,
    actorUserId: currentUser?.id,
    eventType: 'estimate.converted',
    entityType: 'estimate',
    entityId: estimateId,
    description: `${currentUser?.name || 'User'} converted estimate ${estimate.estimate_number} into an active job.`,
    metadata: {
      estimate_number: estimate.estimate_number,
      converted_job_id: jobId,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect(`/job/${jobId}`);
});

estimateRoutes.post('/estimate/:id/archive', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const estimateId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!estimateId) return c.text('Estimate not found', 404);

  const estimate = estimates.findById(db, estimateId, tenantId);
  if (!estimate) return c.text('Estimate not found', 404);
  if (estimate.archived_at) return c.redirect('/estimates?show_archived=1');

  estimates.archive(db, estimateId, tenantId, currentUser?.id ?? null);

  logActivity(db, {
    tenantId,
    actorUserId: currentUser?.id,
    eventType: 'estimate.archived',
    entityType: 'estimate',
    entityId: estimateId,
    description: `${currentUser?.name || 'User'} archived estimate ${estimate.estimate_number}.`,
    metadata: {
      estimate_number: estimate.estimate_number,
      customer_name: estimate.customer_name,
      status: estimate.status,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect('/estimates?notice=archived');
});

estimateRoutes.post('/estimate/:id/restore', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const estimateId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!estimateId) return c.text('Estimate not found', 404);

  const estimate = estimates.findById(db, estimateId, tenantId);
  if (!estimate) return c.text('Estimate not found', 404);
  if (!estimate.archived_at) return c.redirect(`/estimate/${estimateId}`);

  estimates.restore(db, estimateId, tenantId);

  logActivity(db, {
    tenantId,
    actorUserId: currentUser?.id,
    eventType: 'estimate.restored',
    entityType: 'estimate',
    entityId: estimateId,
    description: `${currentUser?.name || 'User'} restored estimate ${estimate.estimate_number}.`,
    metadata: {
      estimate_number: estimate.estimate_number,
      customer_name: estimate.customer_name,
      status: estimate.status,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect(`/estimate/${estimateId}?notice=restored`);
});

export default estimateRoutes;
