import type { DB } from '../connection.js';
import type { Expense } from '../types.js';

export function listByJob(db: DB, jobId: number, tenantId: number) {
  return db.prepare(
    'SELECT * FROM expenses WHERE job_id = ? AND tenant_id = ? ORDER BY date DESC, id DESC'
  ).all(jobId, tenantId) as Expense[];
}

export function findById(db: DB, expenseId: number, tenantId: number) {
  return db.prepare(
    'SELECT * FROM expenses WHERE id = ? AND tenant_id = ?'
  ).get(expenseId, tenantId) as Expense | undefined;
}

export function sumByJob(db: DB, jobId: number, tenantId: number): number {
  const row = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE job_id = ? AND tenant_id = ?'
  ).get(jobId, tenantId) as { total: number };
  return row.total;
}

export function sumByCategory(db: DB, tenantId: number, jobId?: number) {
  if (jobId) {
    return db.prepare(
      'SELECT category, SUM(amount) as total FROM expenses WHERE job_id = ? AND tenant_id = ? GROUP BY category'
    ).all(jobId, tenantId) as { category: string | null; total: number }[];
  }
  return db.prepare(
    'SELECT category, SUM(amount) as total FROM expenses WHERE tenant_id = ? GROUP BY category'
  ).all(tenantId) as { category: string | null; total: number }[];
}

export function create(db: DB, tenantId: number, data: {
  job_id: number;
  category?: string;
  vendor?: string;
  amount: number;
  date: string;
  receipt_filename?: string;
}) {
  const result = db.prepare(
    'INSERT INTO expenses (job_id, category, vendor, amount, date, receipt_filename, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(data.job_id, data.category || null, data.vendor || null, data.amount, data.date, data.receipt_filename || null, tenantId);
  return result.lastInsertRowid as number;
}

export function deleteById(db: DB, expenseId: number, tenantId: number) {
  db.prepare('DELETE FROM expenses WHERE id = ? AND tenant_id = ?').run(expenseId, tenantId);
}
