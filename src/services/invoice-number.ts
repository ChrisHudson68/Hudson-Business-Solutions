import type { DB } from '../db/connection.js';

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
