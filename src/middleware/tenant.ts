import { createMiddleware } from 'hono/factory';
import { getDb } from '../db/connection';

export type TenantVariables = {
  tenant: { id: number; name: string; subdomain: string; logo_path: string | null } | null;
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
      const row = db.prepare(
        'SELECT id, name, subdomain, logo_path FROM tenants WHERE subdomain = ?',
      ).get(subdomain) as
        | { id: number; name: string; subdomain: string; logo_path: string | null }
        | undefined;

      if (row) {
        c.set('tenant', {
          id: row.id,
          name: row.name,
          subdomain: row.subdomain,
          logo_path: row.logo_path,
        });
      }
    }

    await next();
  },
);
