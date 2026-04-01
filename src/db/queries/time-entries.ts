import type { DB } from '../connection.js';
import type { TimeEntry, TimeEntryWithNames } from '../types.js';

export function listByJob(db: DB, jobId: number, tenantId: number) {
  return db.prepare(`
    SELECT t.*, e.name AS employee_name
    FROM time_entries t
    JOIN employees e ON e.id = t.employee_id AND e.tenant_id = t.tenant_id
    WHERE t.job_id = ? AND t.tenant_id = ?
    ORDER BY t.date DESC, t.id DESC
  `).all(jobId, tenantId) as (TimeEntry & { employee_name: string })[];
}

export function listByWeek(db: DB, tenantId: number, weekStart: string, weekEnd: string) {
  return db.prepare(`
    SELECT t.id, t.job_id, t.employee_id, t.date, t.hours, t.note, t.labor_cost, t.tenant_id,
           e.name AS employee_name, j.job_name
    FROM time_entries t
    JOIN employees e ON e.id = t.employee_id AND e.tenant_id = t.tenant_id
    JOIN jobs j ON j.id = t.job_id AND j.tenant_id = t.tenant_id
    WHERE t.tenant_id = ? AND t.date >= ? AND t.date <= ?
    ORDER BY t.date ASC, e.name ASC
  `).all(tenantId, weekStart, weekEnd) as TimeEntryWithNames[];
}

export function sumByJob(db: DB, jobId: number, tenantId: number) {
  const row = db.prepare(
    'SELECT COALESCE(SUM(hours), 0) as totalHours, COALESCE(SUM(labor_cost), 0) as totalCost FROM time_entries WHERE job_id = ? AND tenant_id = ?'
  ).get(jobId, tenantId) as { totalHours: number; totalCost: number };
  return row;
}

export function sumLaborByTenantMonth(db: DB, tenantId: number, yearMonth: string): number {
  const row = db.prepare(
    'SELECT COALESCE(SUM(labor_cost), 0) as total FROM time_entries WHERE tenant_id = ? AND substr(date, 1, 7) = ?'
  ).get(tenantId, yearMonth) as { total: number };
  return row.total;
}

export function sumLaborByTenant(db: DB, tenantId: number, jobId?: number): number {
  if (jobId) {
    const row = db.prepare(
      'SELECT COALESCE(SUM(labor_cost), 0) as total FROM time_entries WHERE job_id = ? AND tenant_id = ?'
    ).get(jobId, tenantId) as { total: number };
    return row.total;
  }
  const row = db.prepare(
    'SELECT COALESCE(SUM(labor_cost), 0) as total FROM time_entries WHERE tenant_id = ?'
  ).get(tenantId) as { total: number };
  return row.total;
}

export function recentByTenant(db: DB, tenantId: number, limit: number = 6) {
  return db.prepare(`
    SELECT t.date,
           t.hours,
           t.labor_cost,
           e.name AS employee_name,
           j.job_name
    FROM time_entries t
    JOIN employees e
      ON e.id = t.employee_id
     AND e.tenant_id = t.tenant_id
    LEFT JOIN jobs j
      ON j.id = t.job_id
     AND j.tenant_id = t.tenant_id
    WHERE t.tenant_id = ?
    ORDER BY t.date DESC, t.id DESC
    LIMIT ?
  `).all(tenantId, limit) as {
    date: string;
    hours: number;
    labor_cost: number;
    employee_name: string;
    job_name: string | null;
  }[];
}

export function create(db: DB, tenantId: number, data: {
  job_id: number;
  employee_id: number;
  date: string;
  hours: number;
  note?: string;
  labor_cost: number;
}) {
  const result = db.prepare(
    'INSERT INTO time_entries (job_id, employee_id, date, hours, note, labor_cost, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(data.job_id, data.employee_id, data.date, data.hours, data.note || null, data.labor_cost, tenantId);
  return result.lastInsertRowid as number;
}

export function deleteById(db: DB, timeId: number, tenantId: number) {
  db.prepare('DELETE FROM time_entries WHERE id = ? AND tenant_id = ?').run(timeId, tenantId);
}
