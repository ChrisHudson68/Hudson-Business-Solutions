import type { DB } from '../connection.js';
import type { Invoice, InvoiceWithJob } from '../types.js';

export function listByTenant(db: DB, tenantId: number) {
  return db.prepare(`
    SELECT i.id, i.job_id, j.job_name, j.client_name,
           i.invoice_number, i.date_issued, i.due_date, i.amount, i.status
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.tenant_id = ?
    ORDER BY i.due_date DESC, i.id DESC
  `).all(tenantId) as InvoiceWithJob[];
}

export function findById(db: DB, invoiceId: number, tenantId: number) {
  return db.prepare(`
    SELECT i.id, i.job_id, j.job_name, j.client_name,
           i.invoice_number, i.date_issued, i.due_date, i.amount, i.notes
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.id = ? AND i.tenant_id = ?
  `).get(invoiceId, tenantId) as (InvoiceWithJob & { notes: string | null }) | undefined;
}

export function findSimpleById(db: DB, invoiceId: number, tenantId: number) {
  return db.prepare(
    'SELECT id FROM invoices WHERE id = ? AND tenant_id = ?'
  ).get(invoiceId, tenantId) as Pick<Invoice, 'id'> | undefined;
}

export function create(db: DB, tenantId: number, data: {
  job_id: number;
  invoice_number: string;
  date_issued: string;
  due_date: string;
  amount: number;
  notes?: string;
}) {
  const result = db.prepare(
    "INSERT INTO invoices (job_id, invoice_number, date_issued, due_date, amount, status, notes, tenant_id) VALUES (?, ?, ?, ?, ?, 'Unpaid', ?, ?)"
  ).run(data.job_id, data.invoice_number, data.date_issued, data.due_date, data.amount, data.notes || null, tenantId);
  return result.lastInsertRowid as number;
}

export function updateStatus(db: DB, invoiceId: number, tenantId: number, status: string) {
  db.prepare(
    'UPDATE invoices SET status = ? WHERE id = ? AND tenant_id = ?'
  ).run(status, invoiceId, tenantId);
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
