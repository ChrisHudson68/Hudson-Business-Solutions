import type { DB } from '../connection.js';
import type { Payment } from '../types.js';

export function listByInvoice(db: DB, invoiceId: number, tenantId: number) {
  return db.prepare(
    'SELECT id, date, amount, method, reference FROM payments WHERE invoice_id = ? AND tenant_id = ? ORDER BY date DESC, id DESC'
  ).all(invoiceId, tenantId) as Omit<Payment, 'invoice_id' | 'tenant_id'>[];
}

export function sumByInvoice(db: DB, invoiceId: number, tenantId: number): number {
  const row = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoice_id = ? AND tenant_id = ?'
  ).get(invoiceId, tenantId) as { total: number };
  return row.total;
}

export function create(db: DB, tenantId: number, data: {
  invoice_id: number;
  date: string;
  amount: number;
  method?: string;
  reference?: string;
}) {
  const result = db.prepare(
    'INSERT INTO payments (invoice_id, date, amount, method, reference, tenant_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(data.invoice_id, data.date, data.amount, data.method || null, data.reference || null, tenantId);
  return result.lastInsertRowid as number;
}

export function deleteById(db: DB, paymentId: number, tenantId: number) {
  db.prepare('DELETE FROM payments WHERE id = ? AND tenant_id = ?').run(paymentId, tenantId);
}
