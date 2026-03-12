import type { DB } from '../connection.js';
import type { User } from '../types.js';

export function findById(db: DB, userId: number) {
  return db.prepare(
    'SELECT id, name, email, role, active, tenant_id FROM users WHERE id = ?'
  ).get(userId) as Omit<User, 'password_hash'> | undefined;
}

export function findByEmailAndTenant(db: DB, email: string, tenantId: number) {
  return db.prepare(
    'SELECT id, password_hash, active FROM users WHERE email = ? AND tenant_id = ?'
  ).get(email, tenantId) as Pick<User, 'id' | 'password_hash' | 'active'> | undefined;
}

export function findByEmail(db: DB, email: string) {
  return db.prepare(
    'SELECT id FROM users WHERE lower(email) = lower(?)'
  ).get(email) as Pick<User, 'id'> | undefined;
}

export function listByTenant(db: DB, tenantId: number) {
  return db.prepare(
    'SELECT id, name, email, role, active FROM users WHERE tenant_id = ? ORDER BY role ASC, name ASC'
  ).all(tenantId) as Omit<User, 'password_hash' | 'tenant_id'>[];
}

export function create(db: DB, data: {
  name: string;
  email: string;
  password_hash: string;
  role: string;
  tenant_id: number;
}) {
  const result = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, active, tenant_id) VALUES (?, ?, ?, ?, 1, ?)'
  ).run(data.name, data.email, data.password_hash, data.role, data.tenant_id);
  return result.lastInsertRowid as number;
}

export function update(db: DB, userId: number, tenantId: number, data: {
  name: string;
  email: string;
  role: string;
  active: number;
}) {
  db.prepare(
    'UPDATE users SET name = ?, email = ?, role = ?, active = ? WHERE id = ? AND tenant_id = ?'
  ).run(data.name, data.email, data.role, data.active, userId, tenantId);
}

export function updatePassword(db: DB, userId: number, tenantId: number, passwordHash: string) {
  db.prepare(
    'UPDATE users SET password_hash = ? WHERE id = ? AND tenant_id = ?'
  ).run(passwordHash, userId, tenantId);
}
