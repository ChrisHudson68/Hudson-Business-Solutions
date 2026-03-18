import type { DB } from '../connection.js';
import type { Job, JobWithFinancials } from '../types.js';

function archivedFilter(includeArchived = false): string {
  return includeArchived ? '' : 'AND j.archived_at IS NULL';
}

export function listWithFinancials(db: DB, tenantId: number, includeArchived = false) {
  return db.prepare(`
    SELECT
      j.id,
      j.job_name,
      j.job_code,
      j.client_name,
      j.contract_amount,
      j.retainage_percent,
      j.start_date,
      j.status,
      j.tenant_id,
      j.archived_at,
      j.archived_by_user_id,
      (SELECT COALESCE(SUM(i.amount), 0) FROM income i WHERE i.job_id = j.id AND i.tenant_id = j.tenant_id AND i.archived_at IS NULL) AS total_income,
      (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE e.job_id = j.id AND e.tenant_id = j.tenant_id AND e.archived_at IS NULL) AS total_expenses,
      (SELECT COALESCE(SUM(t.labor_cost), 0) FROM time_entries t WHERE t.job_id = j.id AND t.tenant_id = j.tenant_id) AS total_labor,
      (SELECT COALESCE(SUM(t.hours), 0) FROM time_entries t WHERE t.job_id = j.id AND t.tenant_id = j.tenant_id) AS total_hours,
      (SELECT COALESCE(SUM(inv.amount), 0) FROM invoices inv WHERE inv.job_id = j.id AND inv.tenant_id = j.tenant_id) AS total_invoiced,
      (SELECT COALESCE(SUM(p.amount), 0)
         FROM payments p
         JOIN invoices inv ON inv.id = p.invoice_id
        WHERE inv.job_id = j.id AND inv.tenant_id = j.tenant_id) AS total_collected,
      (SELECT COUNT(*) FROM invoices inv WHERE inv.job_id = j.id AND inv.tenant_id = j.tenant_id AND inv.status = 'Unpaid') AS unpaid_invoices
    FROM jobs j
    WHERE j.tenant_id = ?
      ${archivedFilter(includeArchived)}
    ORDER BY
      CASE WHEN j.archived_at IS NULL THEN 0 ELSE 1 END,
      CASE
        WHEN j.status = 'Active' THEN 0
        WHEN j.status = 'On Hold' THEN 1
        WHEN j.status = 'Complete' THEN 2
        WHEN j.status = 'Completed' THEN 2
        ELSE 3
      END,
      j.job_name ASC
  `).all(tenantId) as JobWithFinancials[];
}

export function findWithFinancialsById(db: DB, jobId: number, tenantId: number) {
  return db.prepare(`
    SELECT
      j.id,
      j.job_name,
      j.job_code,
      j.client_name,
      j.contract_amount,
      j.retainage_percent,
      j.start_date,
      j.status,
      j.tenant_id,
      j.archived_at,
      j.archived_by_user_id,
      (SELECT COALESCE(SUM(i.amount), 0) FROM income i WHERE i.job_id = j.id AND i.tenant_id = j.tenant_id AND i.archived_at IS NULL) AS total_income,
      (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE e.job_id = j.id AND e.tenant_id = j.tenant_id AND e.archived_at IS NULL) AS total_expenses,
      (SELECT COALESCE(SUM(t.labor_cost), 0) FROM time_entries t WHERE t.job_id = j.id AND t.tenant_id = j.tenant_id) AS total_labor,
      (SELECT COALESCE(SUM(t.hours), 0) FROM time_entries t WHERE t.job_id = j.id AND t.tenant_id = j.tenant_id) AS total_hours,
      (SELECT COALESCE(SUM(inv.amount), 0) FROM invoices inv WHERE inv.job_id = j.id AND inv.tenant_id = j.tenant_id) AS total_invoiced,
      (SELECT COALESCE(SUM(p.amount), 0)
         FROM payments p
         JOIN invoices inv ON inv.id = p.invoice_id
        WHERE inv.job_id = j.id AND inv.tenant_id = j.tenant_id) AS total_collected,
      (SELECT COUNT(*) FROM invoices inv WHERE inv.job_id = j.id AND inv.tenant_id = j.tenant_id AND inv.status = 'Unpaid') AS unpaid_invoices
    FROM jobs j
    WHERE j.id = ? AND j.tenant_id = ?
    LIMIT 1
  `).get(jobId, tenantId) as JobWithFinancials | undefined;
}

export function listByTenant(db: DB, tenantId: number, includeArchived = false) {
  return db.prepare(`
    SELECT *
    FROM jobs
    WHERE tenant_id = ?
      ${includeArchived ? '' : 'AND archived_at IS NULL'}
    ORDER BY job_name ASC
  `).all(tenantId) as Job[];
}

export function listByTenantSorted(db: DB, tenantId: number, includeArchived = false) {
  return db.prepare(`
    SELECT *
    FROM jobs
    WHERE tenant_id = ?
      ${includeArchived ? '' : 'AND archived_at IS NULL'}
    ORDER BY
      CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END,
      CASE
        WHEN status = 'Active' THEN 0
        WHEN status = 'On Hold' THEN 1
        WHEN status = 'Complete' THEN 2
        WHEN status = 'Completed' THEN 2
        ELSE 3
      END,
      job_name ASC
  `).all(tenantId) as Job[];
}

export function findById(db: DB, jobId: number, tenantId: number) {
  return db.prepare(
    'SELECT * FROM jobs WHERE id = ? AND tenant_id = ?'
  ).get(jobId, tenantId) as Job | undefined;
}

export function findByCode(db: DB, tenantId: number, jobCode: string) {
  return db.prepare(
    'SELECT * FROM jobs WHERE tenant_id = ? AND UPPER(job_code) = UPPER(?)'
  ).get(tenantId, jobCode) as Job | undefined;
}

export function create(db: DB, tenantId: number, data: {
  job_name: string;
  job_code?: string;
  client_name?: string;
  contract_amount?: number;
  retainage_percent?: number;
  start_date?: string;
  status?: string;
}) {
  const result = db.prepare(
    `INSERT INTO jobs (
      job_name,
      job_code,
      client_name,
      contract_amount,
      retainage_percent,
      start_date,
      status,
      tenant_id,
      archived_at,
      archived_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
  ).run(
    data.job_name,
    data.job_code || null,
    data.client_name || null,
    data.contract_amount || null,
    data.retainage_percent || null,
    data.start_date || null,
    data.status || 'Active',
    tenantId
  );
  return result.lastInsertRowid as number;
}

export function update(db: DB, jobId: number, tenantId: number, data: {
  job_name?: string;
  job_code?: string;
  client_name?: string;
  contract_amount?: number;
  retainage_percent?: number;
  start_date?: string;
  status?: string;
}) {
  db.prepare(`
    UPDATE jobs
    SET job_name = ?, job_code = ?, client_name = ?, contract_amount = ?, retainage_percent = ?, start_date = ?, status = ?
    WHERE id = ? AND tenant_id = ?
  `).run(
    data.job_name || null,
    data.job_code || null,
    data.client_name || null,
    data.contract_amount || null,
    data.retainage_percent || null,
    data.start_date || null,
    data.status || 'Active',
    jobId,
    tenantId
  );
}

export function archive(db: DB, jobId: number, tenantId: number, archivedByUserId: number) {
  db.prepare(`
    UPDATE jobs
    SET archived_at = CURRENT_TIMESTAMP,
        archived_by_user_id = ?
    WHERE id = ? AND tenant_id = ? AND archived_at IS NULL
  `).run(archivedByUserId, jobId, tenantId);
}

export function restore(db: DB, jobId: number, tenantId: number) {
  db.prepare(`
    UPDATE jobs
    SET archived_at = NULL,
        archived_by_user_id = NULL
    WHERE id = ? AND tenant_id = ?
  `).run(jobId, tenantId);
}

export function remove(db: DB, jobId: number, tenantId: number) {
  db.prepare('DELETE FROM jobs WHERE id = ? AND tenant_id = ?').run(jobId, tenantId);
}

export function deleteWithCascade(db: DB, jobId: number, tenantId: number) {
  const deleteAll = db.transaction(() => {
    db.prepare('DELETE FROM income WHERE job_id = ? AND tenant_id = ?').run(jobId, tenantId);
    db.prepare('DELETE FROM expenses WHERE job_id = ? AND tenant_id = ?').run(jobId, tenantId);
    db.prepare('DELETE FROM time_entries WHERE job_id = ? AND tenant_id = ?').run(jobId, tenantId);
    db.prepare(
      'DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE job_id = ? AND tenant_id = ?) AND tenant_id = ?'
    ).run(jobId, tenantId, tenantId);
    db.prepare('DELETE FROM invoices WHERE job_id = ? AND tenant_id = ?').run(jobId, tenantId);
    db.prepare('DELETE FROM jobs WHERE id = ? AND tenant_id = ?').run(jobId, tenantId);
  });
  deleteAll();
}

export default {
  listWithFinancials,
  findWithFinancialsById,
  listByTenant,
  listByTenantSorted,
  findById,
  findByCode,
  create,
  update,
  archive,
  restore,
  remove,
  deleteWithCascade,
};