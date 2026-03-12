import type { DB } from '../connection.js';
import type { Tenant } from '../types.js';

export function findBySubdomain(db: DB, subdomain: string) {
  return db.prepare(
    'SELECT id, name, subdomain, logo_path FROM tenants WHERE subdomain = ?'
  ).get(subdomain) as Pick<Tenant, 'id' | 'name' | 'subdomain' | 'logo_path'> | undefined;
}

export function findById(db: DB, tenantId: number) {
  return db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as Tenant | undefined;
}

export function create(db: DB, data: {
  name: string;
  subdomain: string;
  invoice_prefix?: string;
}) {
  const result = db.prepare(
    'INSERT INTO tenants (name, subdomain, invoice_prefix) VALUES (?, ?, ?)'
  ).run(data.name, data.subdomain, data.invoice_prefix || null);
  return result.lastInsertRowid as number;
}

export function update(db: DB, tenantId: number, data: {
  name?: string;
  logo_path?: string | null;
  invoice_prefix?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  company_address?: string | null;
  default_tax_rate?: number;
  default_labor_rate?: number;
}) {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  values.push(tenantId);
  db.prepare(`UPDATE tenants SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}
