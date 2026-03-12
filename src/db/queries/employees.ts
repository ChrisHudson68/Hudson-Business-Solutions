import type { DB } from '../connection.js';
import type { Employee } from '../types.js';

export function listByTenant(db: DB, tenantId: number) {
  return db.prepare(
    'SELECT * FROM employees WHERE tenant_id = ? ORDER BY name ASC'
  ).all(tenantId) as Employee[];
}

export function listActiveByTenant(db: DB, tenantId: number) {
  return db.prepare(
    'SELECT * FROM employees WHERE tenant_id = ? AND active = 1 ORDER BY name ASC'
  ).all(tenantId) as Employee[];
}

export function findById(db: DB, employeeId: number, tenantId: number) {
  return db.prepare(
    'SELECT * FROM employees WHERE id = ? AND tenant_id = ?'
  ).get(employeeId, tenantId) as Employee | undefined;
}

export function create(db: DB, tenantId: number, data: {
  name: string;
  pay_type: string;
  hourly_rate?: number;
  annual_salary?: number;
}) {
  const result = db.prepare(
    'INSERT INTO employees (name, pay_type, hourly_rate, annual_salary, active, tenant_id) VALUES (?, ?, ?, ?, 1, ?)'
  ).run(data.name, data.pay_type, data.hourly_rate || null, data.annual_salary || null, tenantId);
  return result.lastInsertRowid as number;
}

export function update(db: DB, employeeId: number, tenantId: number, data: {
  name: string;
  pay_type: string;
  hourly_rate?: number | null;
  annual_salary?: number | null;
  active: number;
}) {
  db.prepare(
    'UPDATE employees SET name = ?, pay_type = ?, hourly_rate = ?, annual_salary = ?, active = ? WHERE id = ? AND tenant_id = ?'
  ).run(data.name, data.pay_type, data.hourly_rate ?? null, data.annual_salary ?? null, data.active, employeeId, tenantId);
}
