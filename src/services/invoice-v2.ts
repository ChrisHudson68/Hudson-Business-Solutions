import type Database from 'better-sqlite3';
import path from 'node:path';
import { ValidationError, optionalTrimmedString, parseIsoDate, parseOptionalMoney, parseOptionalPercent, parsePositiveInt } from '../lib/validation.js';

export type InvoiceLineItemInput = {
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  lineSubtotal: number;
  lineTotal: number;
};

export type InvoiceLineItemRecord = {
  id?: number;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  line_subtotal: number;
  line_total: number;
  sort_order?: number;
};

export type InvoiceDraftFormData = {
  job_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  terms_text: string;
  public_notes: string;
  internal_notes: string;
  discount_type: 'none' | 'percent' | 'amount';
  discount_value: string;
  tax_rate: string;
  line_items: Array<{
    description: string;
    quantity: string;
    unit: string;
    unit_price: string;
  }>;
};

export type InvoiceTotals = {
  subtotal: number;
  discountType: 'none' | 'percent' | 'amount';
  discountValue: number;
  discountAmount: number;
  taxableSubtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
};

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function normalizeNullableText(value: unknown, maxLength: number): string | null {
  const parsed = optionalTrimmedString(value, maxLength);
  return parsed && parsed.length ? parsed : null;
}

function normalizeRequiredText(value: unknown, fieldLabel: string, maxLength: number): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    throw new ValidationError(`${fieldLabel} is required.`);
  }
  if (raw.length > maxLength) {
    throw new ValidationError(`${fieldLabel} must be ${maxLength} characters or less.`);
  }
  return raw;
}

function parseNonNegativeMoney(value: unknown, fieldLabel: string): number {
  return roundMoney(parseOptionalMoney(value, fieldLabel));
}

function parsePositiveQuantity(value: unknown, fieldLabel: string): number {
  const raw = String(value ?? '').trim();
  if (!raw) {
    throw new ValidationError(`${fieldLabel} is required.`);
  }

  if (!/^-?\d+(\.\d{1,4})?$/.test(raw)) {
    throw new ValidationError(`${fieldLabel} must be a valid quantity.`);
  }

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ValidationError(`${fieldLabel} must be greater than 0.`);
  }

  return roundMoney(parsed);
}

export function createEmptyInvoiceDraftForm(defaults?: Partial<InvoiceDraftFormData>): InvoiceDraftFormData {
  return {
    job_id: String(defaults?.job_id ?? ''),
    invoice_number: String(defaults?.invoice_number ?? ''),
    issue_date: String(defaults?.issue_date ?? ''),
    due_date: String(defaults?.due_date ?? ''),
    customer_name: String(defaults?.customer_name ?? ''),
    customer_email: String(defaults?.customer_email ?? ''),
    customer_phone: String(defaults?.customer_phone ?? ''),
    customer_address: String(defaults?.customer_address ?? ''),
    terms_text: String(defaults?.terms_text ?? ''),
    public_notes: String(defaults?.public_notes ?? ''),
    internal_notes: String(defaults?.internal_notes ?? ''),
    discount_type: defaults?.discount_type ?? 'none',
    discount_value: String(defaults?.discount_value ?? ''),
    tax_rate: String(defaults?.tax_rate ?? '0'),
    line_items:
      defaults?.line_items && defaults.line_items.length
        ? defaults.line_items.map((item) => ({
            description: String(item.description ?? ''),
            quantity: String(item.quantity ?? ''),
            unit: String(item.unit ?? ''),
            unit_price: String(item.unit_price ?? ''),
          }))
        : [{ description: '', quantity: '', unit: '', unit_price: '' }],
  };
}

export function parseInvoiceLineItems(body: Record<string, unknown>): InvoiceLineItemInput[] {
  const lineCount = parsePositiveInt(body['line_count'] ?? '1', 'Line count');
  const items: InvoiceLineItemInput[] = [];

  for (let index = 0; index < lineCount; index += 1) {
    const descriptionRaw = String(body[`line_description_${index}`] ?? '').trim();
    const quantityRaw = String(body[`line_quantity_${index}`] ?? '').trim();
    const unitRaw = String(body[`line_unit_${index}`] ?? '').trim();
    const unitPriceRaw = String(body[`line_unit_price_${index}`] ?? '').trim();

    const hasAnyValue = Boolean(descriptionRaw || quantityRaw || unitRaw || unitPriceRaw);
    if (!hasAnyValue) {
      continue;
    }

    const description = normalizeRequiredText(descriptionRaw, `Line ${index + 1} description`, 500);
    const quantity = parsePositiveQuantity(quantityRaw, `Line ${index + 1} quantity`);
    const unitPrice = parseNonNegativeMoney(unitPriceRaw, `Line ${index + 1} unit price`);
    const lineSubtotal = roundMoney(quantity * unitPrice);

    items.push({
      description,
      quantity,
      unit: unitRaw ? unitRaw.slice(0, 40) : null,
      unitPrice,
      lineSubtotal,
      lineTotal: lineSubtotal,
    });
  }

  if (!items.length) {
    throw new ValidationError('At least one invoice line item is required.');
  }

  return items;
}

export function calculateInvoiceTotals(args: {
  lineItems: InvoiceLineItemInput[];
  discountType: unknown;
  discountValue: unknown;
  taxRate: unknown;
}): InvoiceTotals {
  const subtotal = roundMoney(args.lineItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const taxRate = roundMoney(parseOptionalPercent(args.taxRate, 'Tax rate'));
  const rawDiscountType = String(args.discountType ?? 'none').trim().toLowerCase();
  const discountType: InvoiceTotals['discountType'] =
    rawDiscountType === 'percent' || rawDiscountType === 'amount' ? rawDiscountType : 'none';

  let discountValue = 0;
  let discountAmount = 0;

  if (discountType === 'percent') {
    discountValue = roundMoney(parseOptionalPercent(args.discountValue, 'Discount percentage'));
    discountAmount = roundMoney(subtotal * (discountValue / 100));
  } else if (discountType === 'amount') {
    discountValue = roundMoney(parseOptionalMoney(args.discountValue, 'Discount amount'));
    discountAmount = roundMoney(Math.min(discountValue, subtotal));
  }

  const taxableSubtotal = roundMoney(Math.max(subtotal - discountAmount, 0));
  const taxAmount = roundMoney(taxableSubtotal * (taxRate / 100));
  const total = roundMoney(taxableSubtotal + taxAmount);

  return {
    subtotal,
    discountType,
    discountValue,
    discountAmount,
    taxableSubtotal,
    taxRate,
    taxAmount,
    total,
  };
}

export function buildInvoiceDraftFormFromBody(body: Record<string, unknown>, fallbackInvoiceNumber: string): InvoiceDraftFormData {
  const lineCountRaw = String(body['line_count'] ?? '1').trim();
  const lineCount = /^\d+$/.test(lineCountRaw) && Number.parseInt(lineCountRaw, 10) > 0
    ? Number.parseInt(lineCountRaw, 10)
    : 1;

  const lineItems = Array.from({ length: lineCount }, (_, index) => ({
    description: String(body[`line_description_${index}`] ?? ''),
    quantity: String(body[`line_quantity_${index}`] ?? ''),
    unit: String(body[`line_unit_${index}`] ?? ''),
    unit_price: String(body[`line_unit_price_${index}`] ?? ''),
  }));

  return createEmptyInvoiceDraftForm({
    job_id: String(body['job_id'] ?? ''),
    invoice_number: String(body['invoice_number'] ?? fallbackInvoiceNumber),
    issue_date: String(body['issue_date'] ?? ''),
    due_date: String(body['due_date'] ?? ''),
    customer_name: String(body['customer_name'] ?? ''),
    customer_email: String(body['customer_email'] ?? ''),
    customer_phone: String(body['customer_phone'] ?? ''),
    customer_address: String(body['customer_address'] ?? ''),
    terms_text: String(body['terms_text'] ?? ''),
    public_notes: String(body['public_notes'] ?? ''),
    internal_notes: String(body['internal_notes'] ?? ''),
    discount_type:
      String(body['discount_type'] ?? 'none').trim().toLowerCase() === 'percent'
        ? 'percent'
        : String(body['discount_type'] ?? 'none').trim().toLowerCase() === 'amount'
          ? 'amount'
          : 'none',
    discount_value: String(body['discount_value'] ?? ''),
    tax_rate: String(body['tax_rate'] ?? '0'),
    line_items: lineItems,
  });
}

export function parseInvoiceDraftFields(body: Record<string, unknown>, lineItems: InvoiceLineItemInput[]) {
  const issueDate = parseIsoDate(body['issue_date'], 'Issue date');
  const dueDate = parseIsoDate(body['due_date'], 'Due date');
  const customerName = normalizeRequiredText(body['customer_name'], 'Customer name', 255);
  const customerEmail = normalizeNullableText(body['customer_email'], 255);
  const customerPhone = normalizeNullableText(body['customer_phone'], 100);
  const customerAddress = normalizeNullableText(body['customer_address'], 1000);
  const termsText = normalizeNullableText(body['terms_text'], 4000);
  const publicNotes = normalizeNullableText(body['public_notes'], 4000);
  const internalNotes = normalizeNullableText(body['internal_notes'], 4000);

  const totals = calculateInvoiceTotals({
    lineItems,
    discountType: body['discount_type'],
    discountValue: body['discount_value'],
    taxRate: body['tax_rate'],
  });

  return {
    issueDate,
    dueDate,
    customerName,
    customerEmail,
    customerPhone,
    customerAddress,
    termsText,
    publicNotes,
    internalNotes,
    totals,
  };
}

export function saveInvoiceLineItems(db: Database.Database, tenantId: number, invoiceId: number, lineItems: InvoiceLineItemInput[]): void {
  db.prepare('DELETE FROM invoice_line_items WHERE invoice_id = ? AND tenant_id = ?').run(invoiceId, tenantId);

  const insert = db.prepare(`
    INSERT INTO invoice_line_items (
      invoice_id,
      tenant_id,
      sort_order,
      description,
      quantity,
      unit,
      unit_price,
      line_subtotal,
      line_total,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  lineItems.forEach((item, index) => {
    insert.run(
      invoiceId,
      tenantId,
      index,
      item.description,
      item.quantity,
      item.unit,
      item.unitPrice,
      item.lineSubtotal,
      item.lineTotal,
    );
  });
}

export function loadInvoiceLineItems(db: Database.Database, tenantId: number, invoiceId: number): InvoiceLineItemRecord[] {
  return db.prepare(`
    SELECT id, description, quantity, unit, unit_price, line_subtotal, line_total, sort_order
    FROM invoice_line_items
    WHERE invoice_id = ? AND tenant_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(invoiceId, tenantId) as InvoiceLineItemRecord[];
}

export function buildLegacyLineItem(amount: number): InvoiceLineItemRecord[] {
  return [{
    description: 'Legacy invoice amount',
    quantity: 1,
    unit: null,
    unit_price: roundMoney(amount),
    line_subtotal: roundMoney(amount),
    line_total: roundMoney(amount),
    sort_order: 0,
  }];
}

export function applyInvoiceDraftUpdate(db: Database.Database, args: {
  tenantId: number;
  invoiceId: number;
  jobId: number;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  companyName: string;
  companyEmail: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  companyWebsite: string | null;
  companyLogoPath: string | null;
  jobName: string | null;
  jobCode: string | null;
  termsText: string | null;
  publicNotes: string | null;
  internalNotes: string | null;
  totals: InvoiceTotals;
  attachmentFilename: string | null;
  lineItems: InvoiceLineItemInput[];
  status?: string;
}) {
  db.prepare(`
    UPDATE invoices
    SET
      job_id = ?,
      invoice_number = ?,
      date_issued = ?,
      due_date = ?,
      amount = ?,
      status = ?,
      customer_name = ?,
      customer_email = ?,
      customer_phone = ?,
      customer_address = ?,
      company_name_snapshot = ?,
      company_email_snapshot = ?,
      company_phone_snapshot = ?,
      company_address_snapshot = ?,
      company_website_snapshot = ?,
      company_logo_path_snapshot = ?,
      job_name_snapshot = ?,
      job_code_snapshot = ?,
      subtotal_amount = ?,
      discount_type = ?,
      discount_value = ?,
      discount_amount = ?,
      tax_rate = ?,
      tax_amount = ?,
      total_amount = ?,
      terms_text = ?,
      public_notes = ?,
      internal_notes = ?,
      notes = ?,
      attachment_filename = ?
    WHERE id = ? AND tenant_id = ?
  `).run(
    args.jobId,
    args.invoiceNumber,
    args.issueDate,
    args.dueDate,
    args.totals.total,
    args.status ?? 'Draft',
    args.customerName,
    args.customerEmail,
    args.customerPhone,
    args.customerAddress,
    args.companyName,
    args.companyEmail,
    args.companyPhone,
    args.companyAddress,
    args.companyWebsite,
    args.companyLogoPath,
    args.jobName,
    args.jobCode,
    args.totals.subtotal,
    args.totals.discountType,
    args.totals.discountType === 'none' ? null : args.totals.discountValue,
    args.totals.discountAmount,
    args.totals.taxRate,
    args.totals.taxAmount,
    args.totals.total,
    args.termsText,
    args.publicNotes,
    args.internalNotes,
    args.publicNotes,
    args.attachmentFilename,
    args.invoiceId,
    args.tenantId,
  );

  saveInvoiceLineItems(db, args.tenantId, args.invoiceId, args.lineItems);
}


export function buildStoredInvoicePdfRelativePath(tenantId: number, invoiceId: number, version: number): string {
  return `invoices/tenant_${tenantId}/invoice_${invoiceId}_v${version}.pdf`;
}

export function resolveStoredInvoicePdfAbsolutePath(uploadDir: string, storedPath: string): string {
  const normalized = String(storedPath || '').replace(/^[/\\]+/, '');
  return path.join(uploadDir, normalized);
}

export function insertInvoiceEvent(db: Database.Database, args: {
  tenantId: number;
  invoiceId: number;
  eventType: string;
  description: string;
  payload?: Record<string, unknown> | null;
  createdByUserId?: number | null;
}): void {
  let payloadJson: string | null = null;
  if (args.payload) {
    try {
      payloadJson = JSON.stringify(args.payload);
    } catch {
      payloadJson = null;
    }
  }

  db.prepare(`
    INSERT INTO invoice_events (
      invoice_id,
      tenant_id,
      event_type,
      event_description,
      event_payload_json,
      created_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    args.invoiceId,
    args.tenantId,
    args.eventType,
    args.description,
    payloadJson,
    args.createdByUserId ?? null,
  );
}
