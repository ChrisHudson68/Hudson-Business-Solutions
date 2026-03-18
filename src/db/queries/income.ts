import type { DB } from '../connection.js';
import type { Income } from '../types.js';

function archivedClause(includeArchived = false): string {
  return includeArchived ? '' : 'AND archived_at IS NULL';
}

export function listByJob(db: DB, jobId: number, tenantId: number, includeArchived = false) {
  return db.prepare(
    `SELECT * FROM income WHERE job_id = ? AND tenant_id = ? ${archivedClause(includeArchived)} ORDER BY date DESC, id DESC`
  ).all(jobId, tenantId) as Income[];
}

export function listArchivedByJob(db: DB, jobId: number, tenantId: number) {
  return db.prepare(
    'SELECT * FROM income WHERE job_id = ? AND tenant_id = ? AND archived_at IS NOT NULL ORDER BY archived_at DESC, date DESC, id DESC'
  ).all(jobId, tenantId) as Income[];
}

export function findById(db: DB, incomeId: number, tenantId: number) {
  return db.prepare(
    'SELECT * FROM income WHERE id = ? AND tenant_id = ? LIMIT 1'
  ).get(incomeId, tenantId) as Income | undefined;
}

export function sumByJob(db: DB, jobId: number, tenantId: number): number {
  const row = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE job_id = ? AND tenant_id = ? AND archived_at IS NULL'
  ).get(jobId, tenantId) as { total: number };
  return row.total;
}

export function sumByTenantMonth(db: DB, tenantId: number, yearMonth: string): number {
  const row = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE tenant_id = ? AND archived_at IS NULL AND substr(date, 1, 7) = ?'
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
    'INSERT INTO income (job_id, amount, date, description, tenant_id, archived_at, archived_by_user_id) VALUES (?, ?, ?, ?, ?, NULL, NULL)'
  ).run(data.job_id, data.amount, data.date, data.description || null, tenantId);
  return result.lastInsertRowid as number;
}

export function archive(db: DB, incomeId: number, tenantId: number, archivedByUserId: number) {
  db.prepare(`
    UPDATE income
    SET archived_at = CURRENT_TIMESTAMP,
        archived_by_user_id = ?
    WHERE id = ? AND tenant_id = ? AND archived_at IS NULL
  `).run(archivedByUserId, incomeId, tenantId);
}

export function restore(db: DB, incomeId: number, tenantId: number) {
  db.prepare(`
    UPDATE income
    SET archived_at = NULL,
        archived_by_user_id = NULL
    WHERE id = ? AND tenant_id = ? AND archived_at IS NOT NULL
  `).run(incomeId, tenantId);
}

export function deleteById(db: DB, incomeId: number, tenantId: number) {
  db.prepare('DELETE FROM income WHERE id = ? AND tenant_id = ?').run(incomeId, tenantId);
}
