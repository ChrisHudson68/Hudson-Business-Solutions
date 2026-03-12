import type { DB } from '../connection.js';
import type { BillingStatus, Tenant } from '../types.js';

export function findBySubdomain(db: DB, subdomain: string) {
  return db.prepare(
    `SELECT id, name, subdomain, logo_path,
            billing_exempt, billing_status, billing_plan,
            billing_trial_ends_at, billing_grace_ends_at
     FROM tenants
     WHERE subdomain = ?`,
  ).get(subdomain) as
    | Pick<
        Tenant,
        | 'id'
        | 'name'
        | 'subdomain'
        | 'logo_path'
        | 'billing_exempt'
        | 'billing_status'
        | 'billing_plan'
        | 'billing_trial_ends_at'
        | 'billing_grace_ends_at'
      >
    | undefined;
}

export function findById(db: DB, tenantId: number) {
  return db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as Tenant | undefined;
}

export function create(
  db: DB,
  data: {
    name: string;
    subdomain: string;
    invoice_prefix?: string;
    billing_plan?: string | null;
    billing_status?: BillingStatus;
    billing_trial_ends_at?: string | null;
  },
) {
  const result = db.prepare(
    `INSERT INTO tenants (
      name,
      subdomain,
      invoice_prefix,
      billing_plan,
      billing_status,
      billing_trial_ends_at,
      billing_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
  ).run(
    data.name,
    data.subdomain,
    data.invoice_prefix || null,
    data.billing_plan || 'standard',
    data.billing_status || 'trialing',
    data.billing_trial_ends_at || null,
  );
  return result.lastInsertRowid as number;
}

export function update(
  db: DB,
  tenantId: number,
  data: {
    name?: string;
    logo_path?: string | null;
    invoice_prefix?: string | null;
    company_email?: string | null;
    company_phone?: string | null;
    company_address?: string | null;
    default_tax_rate?: number;
    default_labor_rate?: number;
  },
) {
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

export function getBillingSummary(db: DB, tenantId: number) {
  return db.prepare(
    `SELECT id, name, subdomain, billing_exempt, billing_status, billing_plan,
            billing_trial_ends_at, billing_grace_ends_at, billing_customer_id,
            billing_subscription_id, billing_subscription_status, billing_updated_at,
            created_at
     FROM tenants
     WHERE id = ?`,
  ).get(tenantId) as
    | Pick<
        Tenant,
        | 'id'
        | 'name'
        | 'subdomain'
        | 'billing_exempt'
        | 'billing_status'
        | 'billing_plan'
        | 'billing_trial_ends_at'
        | 'billing_grace_ends_at'
        | 'billing_customer_id'
        | 'billing_subscription_id'
        | 'billing_subscription_status'
        | 'billing_updated_at'
        | 'created_at'
      >
    | undefined;
}
