import type { DB } from '../connection.js';
import type { BillingStatus, Tenant } from '../types.js';

export function findBySubdomain(db: DB, subdomain: string) {
  return db.prepare(
    `SELECT id, name, subdomain, logo_path,
            billing_exempt, billing_status, billing_plan,
            billing_trial_ends_at, billing_grace_ends_at,
            billing_state, billing_grace_until
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
      > & {
        billing_state?: string | null;
        billing_grace_until?: string | null;
      }
    | undefined;
}

export function findById(db: DB, tenantId: number) {
  return db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as
    | (Tenant & {
        billing_state?: string | null;
        billing_grace_until?: string | null;
        billing_override_reason?: string | null;
        billing_overridden_by_user_id?: number | null;
        billing_overridden_at?: string | null;
      })
    | undefined;
}

export function findByBillingCustomerId(db: DB, customerId: string) {
  return db.prepare('SELECT * FROM tenants WHERE billing_customer_id = ?').get(customerId) as
    | (Tenant & {
        billing_state?: string | null;
        billing_grace_until?: string | null;
        billing_override_reason?: string | null;
        billing_overridden_by_user_id?: number | null;
        billing_overridden_at?: string | null;
      })
    | undefined;
}

export function findByBillingSubscriptionId(db: DB, subscriptionId: string) {
  return db.prepare('SELECT * FROM tenants WHERE billing_subscription_id = ?').get(subscriptionId) as
    | (Tenant & {
        billing_state?: string | null;
        billing_grace_until?: string | null;
        billing_override_reason?: string | null;
        billing_overridden_by_user_id?: number | null;
        billing_overridden_at?: string | null;
      })
    | undefined;
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
      billing_state,
      billing_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
  ).run(
    data.name,
    data.subdomain,
    data.invoice_prefix || null,
    data.billing_plan || 'standard',
    data.billing_status || 'trialing',
    data.billing_trial_ends_at || null,
    data.billing_status || 'trialing',
  );
  return result.lastInsertRowid as number;
}

const TENANT_UPDATE_ALLOWED_COLUMNS = new Set([
  'name', 'logo_path', 'invoice_prefix', 'company_email',
  'company_phone', 'company_address', 'default_tax_rate', 'default_labor_rate',
]);

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
    if (value !== undefined && TENANT_UPDATE_ALLOWED_COLUMNS.has(key)) {
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
            billing_state, billing_grace_until, billing_override_reason,
            billing_overridden_by_user_id, billing_overridden_at,
            created_at
     FROM tenants
     WHERE id = ?`,
  ).get(tenantId) as
    | (Pick<
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
      > & {
        billing_state?: string | null;
        billing_grace_until?: string | null;
        billing_override_reason?: string | null;
        billing_overridden_by_user_id?: number | null;
        billing_overridden_at?: string | null;
      })
    | undefined;
}

const BILLING_STATE_ALLOWED_COLUMNS = new Set([
  'billing_exempt', 'billing_status', 'billing_plan', 'billing_trial_ends_at',
  'billing_grace_ends_at', 'billing_customer_id', 'billing_subscription_id',
  'billing_subscription_status', 'billing_updated_at', 'billing_state',
  'billing_grace_until', 'billing_override_reason', 'billing_overridden_by_user_id',
  'billing_overridden_at',
]);

export function updateBillingState(
  db: DB,
  tenantId: number,
  data: {
    billing_exempt?: number;
    billing_status?: BillingStatus;
    billing_plan?: string | null;
    billing_trial_ends_at?: string | null;
    billing_grace_ends_at?: string | null;
    billing_customer_id?: string | null;
    billing_subscription_id?: string | null;
    billing_subscription_status?: string | null;
    billing_updated_at?: string | null;
    billing_state?: string | null;
    billing_grace_until?: string | null;
    billing_override_reason?: string | null;
    billing_overridden_by_user_id?: number | null;
    billing_overridden_at?: string | null;
  },
) {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && BILLING_STATE_ALLOWED_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (data.billing_updated_at === undefined) {
    fields.push('billing_updated_at = CURRENT_TIMESTAMP');
  }

  if (fields.length === 0) {
    return;
  }

  values.push(tenantId);

  db.prepare(`UPDATE tenants SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}