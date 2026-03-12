import type { DB } from '../connection.js';
import type { Income } from '../types.js';

export function listByJob(db: DB, jobId: number, tenantId: number) {
  return db.prepare(
    'SELECT * FROM income WHERE job_id = ? AND tenant_id = ? ORDER BY date DESC, id DESC'
  ).all(jobId, tenantId) as Income[];
}

export function sumByJob(db: DB, jobId: number, tenantId: number): number {
  const row = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE job_id = ? AND tenant_id = ?'
  ).get(jobId, tenantId) as { total: number };
  return row.total;
}

export function sumByTenantMonth(db: DB, tenantId: number, yearMonth: string): number {
  const row = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE tenant_id = ? AND substr(date, 1, 7) = ?'
  ).get(tenantId, yearMonth) as { total: number };
  return row.total;
}

export function create(db: DB, tenantId: number, data: {
  job_id: number;
  amount: number;
  date: string;
  description?: string;
}) {
  const result = db.prepare(
    'INSERT INTO income (job_id, amount, date, description, tenant_id) VALUES (?, ?, ?, ?, ?)'
  ).run(data.job_id, data.amount, data.date, data.description || null, tenantId);
  return result.lastInsertRowid as number;
}

export function deleteById(db: DB, incomeId: number, tenantId: number) {
  db.prepare('DELETE FROM income WHERE id = ? AND tenant_id = ?').run(incomeId, tenantId);
}
