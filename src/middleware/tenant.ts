import { createMiddleware } from 'hono/factory';
import { getDb } from '../db/connection';

export type TenantVariables = {
  tenant:
    | {
        id: number;
        name: string;
        subdomain: string;
        logo_path: string | null;
        billing_exempt: number;
        billing_status: string;
        billing_plan: string | null;
        billing_trial_ends_at: string | null;
        billing_grace_ends_at: string | null;
      }
    | null;
  subdomain: string | null;
};

export const tenantMiddleware = createMiddleware<{ Variables: TenantVariables }>(
  async (c, next) => {
    const baseDomain = (process.env.BASE_DOMAIN ?? 'localhost').toLowerCase().trim();

    const rawHost = c.req.header('Host') ?? '';
    const host = rawHost.split(':')[0].toLowerCase();

    let subdomain: string | null = null;

    if (host === baseDomain) {
      subdomain = null;
    } else {
      const suffix = `.${baseDomain}`;
      if (host.endsWith(suffix)) {
        const sub = host.slice(0, -suffix.length);
        subdomain = sub || null;
      }
    }

    c.set('subdomain', subdomain);
    c.set('tenant', null);

    if (subdomain) {
      const db = getDb();
      const row = db
        .prepare(
          `SELECT id, name, subdomain, logo_path,
                  billing_exempt, billing_status, billing_plan,
                  billing_trial_ends_at, billing_grace_ends_at
           FROM tenants WHERE subdomain = ?`,
        )
        .get(subdomain) as
        | {
            id: number;
            name: string;
            subdomain: string;
            logo_path: string | null;
            billing_exempt: number;
            billing_status: string;
            billing_plan: string | null;
            billing_trial_ends_at: string | null;
            billing_grace_ends_at: string | null;
          }
        | undefined;

      if (row) {
        c.set('tenant', {
          id: row.id,
          name: row.name,
          subdomain: row.subdomain,
          logo_path: row.logo_path,
          billing_exempt: Number(row.billing_exempt || 0),
          billing_status: row.billing_status || 'trialing',
          billing_plan: row.billing_plan || null,
          billing_trial_ends_at: row.billing_trial_ends_at || null,
          billing_grace_ends_at: row.billing_grace_ends_at || null,
        });
      }
    }

    await next();
  },
);
