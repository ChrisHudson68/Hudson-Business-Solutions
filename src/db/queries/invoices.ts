import type { DB } from '../connection.js';
import type { Invoice, InvoiceWithJob } from '../types.js';

export function listByTenant(db: DB, tenantId: number, includeArchived = false) {
  return db.prepare(`
    SELECT i.id, i.job_id, j.job_name, j.client_name,
           i.invoice_number, i.date_issued, i.due_date, i.amount, i.status,
           i.notes, i.attachment_filename, i.archived_at, i.archived_by_user_id
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.tenant_id = ?
      ${includeArchived ? '' : 'AND i.archived_at IS NULL'}
    ORDER BY i.due_date DESC, i.id DESC
  `).all(tenantId) as Array<InvoiceWithJob & {
    notes?: string | null;
    attachment_filename?: string | null;
    archived_at?: string | null;
    archived_by_user_id?: number | null;
  }>;
}

export function listArchivedByTenant(db: DB, tenantId: number) {
  return db.prepare(`
    SELECT i.id, i.job_id, j.job_name, j.client_name,
           i.invoice_number, i.date_issued, i.due_date, i.amount, i.status,
           i.notes, i.attachment_filename, i.archived_at, i.archived_by_user_id
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.tenant_id = ?
      AND i.archived_at IS NOT NULL
    ORDER BY i.archived_at DESC, i.id DESC
  `).all(tenantId) as Array<InvoiceWithJob & {
    notes?: string | null;
    attachment_filename?: string | null;
    archived_at?: string | null;
    archived_by_user_id?: number | null;
  }>;
}

export function findById(db: DB, invoiceId: number, tenantId: number) {
  return db.prepare(`
    SELECT i.id, i.job_id, j.job_name, j.client_name,
           i.invoice_number, i.date_issued, i.due_date, i.amount, i.notes,
           i.status, i.attachment_filename, i.archived_at, i.archived_by_user_id,
           i.public_token, i.sent_for_signature_at,
           i.signature_data, i.signer_name, i.signature_ip, i.signed_at
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.id = ? AND i.tenant_id = ?
  `).get(invoiceId, tenantId) as (InvoiceWithJob & {
    notes: string | null;
    attachment_filename?: string | null;
    archived_at?: string | null;
    archived_by_user_id?: number | null;
    public_token?: string | null;
    sent_for_signature_at?: string | null;
    signature_data?: string | null;
    signer_name?: string | null;
    signature_ip?: string | null;
    signed_at?: string | null;
  }) | undefined;
}

export function findByPublicToken(db: DB, token: string) {
  return db.prepare(`
    SELECT i.id, i.tenant_id, i.job_id, j.job_name, j.client_name,
           i.invoice_number, i.date_issued, i.due_date, i.amount, i.notes,
           i.status, i.public_token, i.sent_for_signature_at,
           i.signature_data, i.signer_name, i.signed_at, i.archived_at
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.public_token = ?
  `).get(token) as ({
    id: number;
    tenant_id: number;
    job_id: number;
    job_name: string;
    client_name: string | null;
    invoice_number: string;
    date_issued: string;
    due_date: string;
    amount: number;
    notes: string | null;
    status: string;
    public_token: string;
    sent_for_signature_at: string | null;
    signature_data: string | null;
    signer_name: string | null;
    signed_at: string | null;
    archived_at: string | null;
  }) | undefined;
}

export function setSignatureToken(db: DB, invoiceId: number, tenantId: number, token: string) {
  db.prepare(
    'UPDATE invoices SET public_token = ?, sent_for_signature_at = ? WHERE id = ? AND tenant_id = ?'
  ).run(token, new Date().toISOString(), invoiceId, tenantId);
}

export function recordSignature(
  db: DB,
  invoiceId: number,
  tenantId: number,
  data: { signature_data: string; signer_name: string; signature_ip: string },
) {
  db.prepare(`
    UPDATE invoices
    SET signature_data = ?, signer_name = ?, signature_ip = ?, signed_at = ?
    WHERE id = ? AND tenant_id = ?
  `).run(data.signature_data, data.signer_name, data.signature_ip, new Date().toISOString(), invoiceId, tenantId);
}

export function findSimpleById(db: DB, invoiceId: number, tenantId: number) {
  return db.prepare(
    'SELECT id, archived_at, archived_by_user_id FROM invoices WHERE id = ? AND tenant_id = ?'
  ).get(invoiceId, tenantId) as (Pick<Invoice, 'id'> & {
    archived_at?: string | null;
    archived_by_user_id?: number | null;
  }) | undefined;
}

export function create(db: DB, tenantId: number, data: {
  job_id: number;
  invoice_number: string;
  date_issued: string;
  due_date: string;
  amount: number;
  notes?: string;
  attachment_filename?: string | null;
}) {
  const result = db.prepare(
    `INSERT INTO invoices (
      job_id, invoice_number, date_issued, due_date, amount, status, notes,
      attachment_filename, tenant_id, archived_at, archived_by_user_id
    ) VALUES (?, ?, ?, ?, ?, 'Unpaid', ?, ?, ?, NULL, NULL)`
  ).run(
    data.job_id,
    data.invoice_number,
    data.date_issued,
    data.due_date,
    data.amount,
    data.notes || null,
    data.attachment_filename || null,
    tenantId,
  );

  return result.lastInsertRowid as number;
}

export function updateStatus(db: DB, invoiceId: number, tenantId: number, status: string) {
  db.prepare(
    'UPDATE invoices SET status = ? WHERE id = ? AND tenant_id = ?'
  ).run(status, invoiceId, tenantId);
}

export function archive(db: DB, invoiceId: number, tenantId: number, archivedByUserId: number) {
  db.prepare(`
    UPDATE invoices
    SET archived_at = CURRENT_TIMESTAMP,
        archived_by_user_id = ?
    WHERE id = ? AND tenant_id = ? AND archived_at IS NULL
  `).run(archivedByUserId, invoiceId, tenantId);
}

export function restore(db: DB, invoiceId: number, tenantId: number) {
  db.prepare(`
    UPDATE invoices
    SET archived_at = NULL,
        archived_by_user_id = NULL
    WHERE id = ? AND tenant_id = ? AND archived_at IS NOT NULL
  `).run(invoiceId, tenantId);
}

export function deleteById(db: DB, invoiceId: number, tenantId: number) {
  db.prepare('DELETE FROM payments WHERE invoice_id = ? AND tenant_id = ?').run(invoiceId, tenantId);
  db.prepare('DELETE FROM invoices WHERE id = ? AND tenant_id = ?').run(invoiceId, tenantId);
}

export function nextInvoiceNumber(db: DB, tenantId: number, invoicePrefix: string): string {
  const prefix = (invoicePrefix || 'INV').trim().toUpperCase();

  const row = db.prepare(`
    SELECT invoice_number FROM invoices
    WHERE tenant_id = ? AND invoice_number IS NOT NULL AND invoice_number != ''
    ORDER BY id DESC LIMIT 1
  `).get(tenantId) as { invoice_number: string } | undefined;

  if (!row) return `${prefix}-1001`;

  const lastNumber = (row.invoice_number || '').trim();
  const expectedPrefix = `${prefix}-`;

  if (lastNumber.startsWith(expectedPrefix)) {
    const suffix = lastNumber.slice(expectedPrefix.length);
    if (/^\d+$/.test(suffix)) {
      return `${prefix}-${parseInt(suffix, 10) + 1}`;
    }
  }

  return `${prefix}-1001`;
}
