import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { getDb } from '../db/connection.js';
import { getEnv } from '../config/env.js';
import { platformAdminRequired } from '../middleware/platform-admin.js';
import {
  PLATFORM_ADMIN_COOKIE_NAME,
  createPlatformAdminCookie,
  getPlatformAdminEmail,
} from '../services/platform-admin-session.js';
import { PublicLayout } from '../pages/layouts/PublicLayout.js';
import { AdminLayout } from '../pages/admin/AdminLayout.js';
import { AdminLoginPage } from '../pages/admin/AdminLoginPage.js';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage.js';
import { AdminTenantsPage } from '../pages/admin/AdminTenantsPage.js';
import { AdminTenantDetailPage } from '../pages/admin/AdminTenantDetailPage.js';

function renderPublicLayout(children: any) {
  const env = getEnv();

  return (
    <PublicLayout appName={env.appName} appLogo={env.appLogo}>
      {children}
    </PublicLayout>
  );
}

function renderAdminLayout(c: any, subtitle: string, children: any, status = 200) {
  const env = getEnv();

  return c.html(
    <AdminLayout
      currentAdmin={c.get('platformAdmin')}
      appName={env.appName}
      path={c.req.path}
      subtitle={subtitle}
    >
      {children}
    </AdminLayout>,
    status,
  );
}

function shouldUseSecureCookies(hostHeader: string | undefined): boolean {
  const env = getEnv();
  const host = String(hostHeader ?? '').toLowerCase();

  if (!env.isProduction) return false;
  if (host.includes('localhost') || host.startsWith('127.0.0.1') || host.startsWith('0.0.0.0')) {
    return false;
  }
  if (env.baseDomain === 'localhost') return false;

  return true;
}

function setPlatformAdminCookie(c: any, value: string) {
  const env = getEnv();

  setCookie(c, PLATFORM_ADMIN_COOKIE_NAME, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: shouldUseSecureCookies(c.req.header('Host')),
    maxAge: 60 * 60 * 12,
  });
}

function clearPlatformAdminCookie(c: any) {
  deleteCookie(c, PLATFORM_ADMIN_COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: shouldUseSecureCookies(c.req.header('Host')),
  });
}

function buildTenantLoginUrl(subdomain: string): string {
  const env = getEnv();

  if (env.baseDomain === 'localhost') {
    return `http://${subdomain}.localhost:${env.port}/login`;
  }

  return `https://${subdomain}.${env.baseDomain}/login`;
}

function requireBaseDomain(c: any) {
  const subdomain = c.get('subdomain');
  if (subdomain) {
    return c.text('Not found', 404);
  }
  return null;
}

export const platformAdminRoutes = new Hono<AppEnv>();

platformAdminRoutes.get('/admin/login', (c) => {
  const subdomainBlock = requireBaseDomain(c);
  if (subdomainBlock) return subdomainBlock;

  const env = getEnv();
  const existing = getCookie(c, PLATFORM_ADMIN_COOKIE_NAME);

  if (existing) {
    const email = getPlatformAdminEmail(existing, env.secretKey);
    if (email && email === env.platformAdminEmail) {
      return c.redirect('/admin');
    }
  }

  return c.html(
    renderPublicLayout(
      <AdminLoginPage csrfToken={c.get('csrfToken')} />,
    ),
  );
});

platformAdminRoutes.post('/admin/login', async (c) => {
  const subdomainBlock = requireBaseDomain(c);
  if (subdomainBlock) return subdomainBlock;

  const env = getEnv();
  const body = await c.req.parseBody();

  const email = String(body['email'] ?? '').trim().toLowerCase();
  const password = String(body['password'] ?? '');

  let error = '';

  if (!env.platformAdminEmail || !env.platformAdminPassword) {
    error = 'Platform admin portal is not configured yet.';
  } else if (email !== env.platformAdminEmail || password !== env.platformAdminPassword) {
    error = 'Invalid platform admin login.';
  }

  if (error) {
    return c.html(
      renderPublicLayout(
        <AdminLoginPage
          error={error}
          prefillEmail={email}
          csrfToken={c.get('csrfToken')}
        />,
      ),
      401,
    );
  }

  const cookie = createPlatformAdminCookie(email, env.secretKey, 60 * 60 * 12);
  setPlatformAdminCookie(c, cookie);

  return c.redirect('/admin');
});

platformAdminRoutes.get('/admin/logout', (c) => {
  clearPlatformAdminCookie(c);
  return c.redirect('/admin/login');
});

platformAdminRoutes.get('/admin', platformAdminRequired, (c) => {
  const db = getDb();

  const metrics = db.prepare(`
    SELECT
      COUNT(*) as totalTenants,
      SUM(CASE WHEN billing_exempt = 0 AND billing_status = 'active' THEN 1 ELSE 0 END) as activeTenants,
      SUM(CASE WHEN billing_exempt = 0 AND billing_status = 'trialing' THEN 1 ELSE 0 END) as trialingTenants,
      SUM(CASE WHEN billing_exempt = 1 OR billing_status = 'internal' THEN 1 ELSE 0 END) as internalTenants,
      SUM(CASE WHEN billing_exempt = 0 AND billing_status = 'past_due' THEN 1 ELSE 0 END) as pastDueTenants,
      SUM(CASE WHEN billing_exempt = 0 AND billing_status = 'canceled' THEN 1 ELSE 0 END) as canceledTenants
    FROM tenants
  `).get() as {
    totalTenants: number;
    activeTenants: number;
    trialingTenants: number;
    internalTenants: number;
    pastDueTenants: number;
    canceledTenants: number;
  };

  const recentTenants = db.prepare(`
    SELECT
      id,
      name,
      subdomain,
      created_at,
      billing_status,
      billing_exempt
    FROM tenants
    ORDER BY id DESC
    LIMIT 8
  `).all() as Array<{
    id: number;
    name: string;
    subdomain: string;
    created_at: string | null;
    billing_status: string;
    billing_exempt: number;
  }>;

  return renderAdminLayout(
    c,
    'Platform Overview',
    <AdminDashboardPage metrics={metrics} recentTenants={recentTenants} />,
  );
});

platformAdminRoutes.get('/admin/tenants', platformAdminRequired, (c) => {
  const db = getDb();

  const tenants = db.prepare(`
    SELECT
      t.id,
      t.name,
      t.subdomain,
      t.created_at,
      t.billing_exempt,
      t.billing_status,
      t.billing_plan,
      t.billing_trial_ends_at,
      COUNT(DISTINCT u.id) as user_count,
      COUNT(DISTINCT j.id) as job_count
    FROM tenants t
    LEFT JOIN users u ON u.tenant_id = t.id
    LEFT JOIN jobs j ON j.tenant_id = t.id
    GROUP BY t.id
    ORDER BY t.name COLLATE NOCASE ASC
  `).all() as Array<{
    id: number;
    name: string;
    subdomain: string;
    created_at: string | null;
    billing_exempt: number;
    billing_status: string;
    billing_plan: string | null;
    billing_trial_ends_at: string | null;
    user_count: number;
    job_count: number;
  }>;

  return renderAdminLayout(
    c,
    'Tenant Directory',
    <AdminTenantsPage tenants={tenants} />,
  );
});

platformAdminRoutes.get('/admin/tenants/:id', platformAdminRequired, (c) => {
  const db = getDb();
  const tenantId = Number.parseInt(c.req.param('id'), 10);

  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    return c.text('Tenant not found', 404);
  }

  const tenant = db.prepare(`
    SELECT
      t.*,
      (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as user_count,
      (SELECT COUNT(*) FROM jobs j WHERE j.tenant_id = t.id) as job_count,
      (SELECT COUNT(*) FROM invoices i WHERE i.tenant_id = t.id) as invoice_count,
      (SELECT COUNT(*) FROM payments p WHERE p.tenant_id = t.id) as payment_count
    FROM tenants t
    WHERE t.id = ?
    LIMIT 1
  `).get(tenantId) as
    | {
        id: number;
        name: string;
        subdomain: string;
        logo_path: string | null;
        invoice_prefix: string | null;
        company_email: string | null;
        company_phone: string | null;
        company_address: string | null;
        default_tax_rate: number | null;
        default_labor_rate: number | null;
        billing_exempt: number;
        billing_status: string;
        billing_plan: string | null;
        billing_trial_ends_at: string | null;
        billing_grace_ends_at: string | null;
        billing_customer_id: string | null;
        billing_subscription_id: string | null;
        billing_subscription_status: string | null;
        billing_updated_at: string | null;
        created_at: string | null;
        user_count: number;
        job_count: number;
        invoice_count: number;
        payment_count: number;
      }
    | undefined;

  if (!tenant) {
    return c.text('Tenant not found', 404);
  }

  return renderAdminLayout(
    c,
    `Tenant Detail: ${tenant.name}`,
    <AdminTenantDetailPage
      tenant={tenant}
      workspaceLoginUrl={buildTenantLoginUrl(tenant.subdomain)}
    />,
  );
});