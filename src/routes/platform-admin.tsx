import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { getDb } from '../db/connection.js';
import { getEnv } from '../config/env.js';
import { platformAdminRequired } from '../middleware/platform-admin.js';
import * as tenantQueries from '../db/queries/tenants.js';
import type { BillingStatus } from '../db/types.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';
import { createImpersonationToken } from '../services/session.js';
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
import { AdminActivityPage } from '../pages/admin/AdminActivityPage.js';

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

function buildTenantImpersonationUrl(subdomain: string, token: string): string {
  const env = getEnv();

  if (env.baseDomain === 'localhost') {
    return `http://${subdomain}.localhost:${env.port}/impersonation/start?token=${encodeURIComponent(token)}`;
  }

  return `https://${subdomain}.${env.baseDomain}/impersonation/start?token=${encodeURIComponent(token)}`;
}

function requireBaseDomain(c: any) {
  const subdomain = c.get('subdomain');
  if (subdomain) {
    return c.text('Not found', 404);
  }
  return null;
}

function parseTenantId(c: any): number | null {
  const tenantId = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isInteger(tenantId) || tenantId <= 0) return null;
  return tenantId;
}

function parsePositiveInt(value: string): number | null {
  if (!/^\d+$/.test(String(value || '').trim())) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toSqlDate(value: Date): string {
  return value.toISOString().slice(0, 19).replace('T', ' ');
}

function addDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return toSqlDate(d);
}

function resolveNotice(c: any): { tone: 'good' | 'warn' | 'bad'; message: string } | undefined {
  const updated = String(c.req.query('updated') || '').trim().toLowerCase();
  const error = String(c.req.query('error') || '').trim().toLowerCase();

  if (updated === 'status') {
    return { tone: 'good', message: 'Tenant billing status was updated.' };
  }
  if (updated === 'exempt-on') {
    return { tone: 'good', message: 'Tenant is now marked internal / exempt.' };
  }
  if (updated === 'exempt-off') {
    return { tone: 'good', message: 'Tenant internal / exempt status was removed.' };
  }
  if (updated === 'trial') {
    return { tone: 'good', message: 'Tenant trial was extended by 14 days.' };
  }
  if (updated === 'grace') {
    return { tone: 'good', message: 'Tenant grace period was extended by 7 days.' };
  }
  if (updated === 'impersonation-started') {
    return { tone: 'good', message: 'Impersonation session started in the tenant workspace.' };
  }

  if (error === 'tenant-not-found') {
    return { tone: 'bad', message: 'Tenant was not found.' };
  }
  if (error === 'invalid-status') {
    return { tone: 'bad', message: 'That billing status is not allowed from the admin portal.' };
  }
  if (error === 'user-not-found') {
    return { tone: 'bad', message: 'That tenant user was not found or cannot be impersonated.' };
  }
  if (error === 'user-inactive') {
    return { tone: 'bad', message: 'That user is inactive and cannot be impersonated.' };
  }
  if (error === 'admin-user-blocked') {
    return { tone: 'bad', message: 'Platform admin impersonation of tenant Admin users is blocked in Phase 3A for safety.' };
  }

  return undefined;
}

function redirectTenantDetail(tenantId: number, query: string) {
  return `/admin/tenants/${tenantId}${query ? `?${query}` : ''}`;
}

function titleizeEventType(value: string): string {
  return value
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ');
}

const platformAdminRoutes = new Hono<AppEnv>();

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

platformAdminRoutes.get('/admin/activity', platformAdminRequired, (c) => {
  const db = getDb();

  const selectedTenantId = String(c.req.query('tenant_id') || '').trim();
  const selectedEventType = String(c.req.query('event_type') || '').trim();
  const tenantId = selectedTenantId ? parsePositiveInt(selectedTenantId) : null;

  const whereParts = ['1 = 1'];
  const params: Array<string | number> = [];

  if (tenantId) {
    whereParts.push('a.tenant_id = ?');
    params.push(tenantId);
  }

  if (selectedEventType) {
    whereParts.push('a.event_type = ?');
    params.push(selectedEventType);
  }

  const rows = db.prepare(`
    SELECT
      a.id,
      a.created_at,
      a.tenant_id,
      t.name AS tenant_name,
      t.subdomain AS tenant_subdomain,
      u.name AS actor_name,
      u.email AS actor_email,
      a.event_type,
      a.entity_type,
      a.entity_id,
      a.description,
      a.ip_address,
      a.metadata_json
    FROM activity_logs a
    JOIN tenants t
      ON t.id = a.tenant_id
    LEFT JOIN users u
      ON u.id = a.actor_user_id
     AND u.tenant_id = a.tenant_id
    WHERE ${whereParts.join(' AND ')}
    ORDER BY a.id DESC
    LIMIT 300
  `).all(...params) as Array<{
    id: number;
    created_at: string;
    tenant_id: number;
    tenant_name: string;
    tenant_subdomain: string;
    actor_name: string | null;
    actor_email: string | null;
    event_type: string;
    entity_type: string | null;
    entity_id: number | null;
    description: string;
    ip_address: string | null;
    metadata_json: string | null;
  }>;

  const tenants = db.prepare(`
    SELECT id, name, subdomain
    FROM tenants
    ORDER BY name COLLATE NOCASE ASC
  `).all() as Array<{ id: number; name: string; subdomain: string }>;

  const eventTypes = db.prepare(`
    SELECT DISTINCT event_type
    FROM activity_logs
    ORDER BY event_type ASC
  `).all() as Array<{ event_type: string }>;

  return renderAdminLayout(
    c,
    'Cross-tenant activity visibility',
    <AdminActivityPage
      rows={rows}
      selectedTenantId={selectedTenantId}
      selectedEventType={selectedEventType}
      tenants={tenants}
      eventTypes={eventTypes.map((row) => ({
        value: row.event_type,
        label: titleizeEventType(row.event_type),
      }))}
    />,
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
  const tenantId = parseTenantId(c);

  if (!tenantId) {
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

  const users = db.prepare(`
    SELECT id, name, email, role, active
    FROM users
    WHERE tenant_id = ?
    ORDER BY role ASC, name ASC
  `).all(tenant.id) as Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    active: number;
  }>;

  return renderAdminLayout(
    c,
    `Tenant Detail: ${tenant.name}`,
    <div class="grid" style="gap:14px;">
      <div style="display:flex; justify-content:flex-end;">
        <a class="btn" href={`/admin/activity?tenant_id=${tenant.id}`}>View Tenant Activity</a>
      </div>

      <AdminTenantDetailPage
        tenant={tenant}
        users={users}
        workspaceLoginUrl={buildTenantLoginUrl(tenant.subdomain)}
        csrfToken={c.get('csrfToken')}
        notice={resolveNotice(c)}
      />
    </div>,
  );
});

platformAdminRoutes.post('/admin/tenants/:id/billing/toggle-exempt', platformAdminRequired, (c) => {
  const db = getDb();
  const tenantId = parseTenantId(c);

  if (!tenantId) {
    return c.redirect('/admin/tenants?error=tenant-not-found');
  }

  const tenant = tenantQueries.findById(db, tenantId);
  if (!tenant) {
    return c.redirect('/admin/tenants?error=tenant-not-found');
  }

  const currentlyExempt = Number(tenant.billing_exempt || 0) === 1;

  if (currentlyExempt) {
    tenantQueries.updateBillingState(db, tenantId, {
      billing_exempt: 0,
      billing_status: 'trialing',
      billing_trial_ends_at: addDays(14),
      billing_grace_ends_at: null,
    });

    return c.redirect(redirectTenantDetail(tenantId, 'updated=exempt-off'));
  }

  tenantQueries.updateBillingState(db, tenantId, {
    billing_exempt: 1,
    billing_status: 'internal',
    billing_grace_ends_at: null,
  });

  return c.redirect(redirectTenantDetail(tenantId, 'updated=exempt-on'));
});

platformAdminRoutes.post('/admin/tenants/:id/billing/set-status', platformAdminRequired, async (c) => {
  const db = getDb();
  const tenantId = parseTenantId(c);

  if (!tenantId) {
    return c.redirect('/admin/tenants?error=tenant-not-found');
  }

  const tenant = tenantQueries.findById(db, tenantId);
  if (!tenant) {
    return c.redirect('/admin/tenants?error=tenant-not-found');
  }

  const body = await c.req.parseBody();
  const status = String(body['status'] ?? '').trim().toLowerCase() as BillingStatus;

  if (!['trialing', 'active', 'past_due', 'canceled'].includes(status)) {
    return c.redirect(redirectTenantDetail(tenantId, 'error=invalid-status'));
  }

  if (status === 'trialing') {
    tenantQueries.updateBillingState(db, tenantId, {
      billing_exempt: 0,
      billing_status: 'trialing',
      billing_trial_ends_at: addDays(14),
      billing_grace_ends_at: null,
    });
  } else if (status === 'active') {
    tenantQueries.updateBillingState(db, tenantId, {
      billing_exempt: 0,
      billing_status: 'active',
      billing_grace_ends_at: null,
    });
  } else if (status === 'past_due') {
    tenantQueries.updateBillingState(db, tenantId, {
      billing_exempt: 0,
      billing_status: 'past_due',
      billing_grace_ends_at: addDays(7),
    });
  } else if (status === 'canceled') {
    tenantQueries.updateBillingState(db, tenantId, {
      billing_exempt: 0,
      billing_status: 'canceled',
      billing_grace_ends_at: null,
    });
  }

  return c.redirect(redirectTenantDetail(tenantId, 'updated=status'));
});

platformAdminRoutes.post('/admin/tenants/:id/billing/extend-trial', platformAdminRequired, (c) => {
  const db = getDb();
  const tenantId = parseTenantId(c);

  if (!tenantId) {
    return c.redirect('/admin/tenants?error=tenant-not-found');
  }

  const tenant = tenantQueries.findById(db, tenantId);
  if (!tenant) {
    return c.redirect('/admin/tenants?error=tenant-not-found');
  }

  tenantQueries.updateBillingState(db, tenantId, {
    billing_exempt: 0,
    billing_status: 'trialing',
    billing_trial_ends_at: addDays(14),
  });

  return c.redirect(redirectTenantDetail(tenantId, 'updated=trial'));
});

platformAdminRoutes.post('/admin/tenants/:id/billing/extend-grace', platformAdminRequired, (c) => {
  const db = getDb();
  const tenantId = parseTenantId(c);

  if (!tenantId) {
    return c.redirect('/admin/tenants?error=tenant-not-found');
  }

  const tenant = tenantQueries.findById(db, tenantId);
  if (!tenant) {
    return c.redirect('/admin/tenants?error=tenant-not-found');
  }

  tenantQueries.updateBillingState(db, tenantId, {
    billing_exempt: 0,
    billing_status: 'past_due',
    billing_grace_ends_at: addDays(7),
  });

  return c.redirect(redirectTenantDetail(tenantId, 'updated=grace'));
});

platformAdminRoutes.post('/admin/tenants/:id/impersonate', platformAdminRequired, async (c) => {
  const db = getDb();
  const tenantId = parseTenantId(c);
  const platformAdmin = c.get('platformAdmin');

  if (!tenantId) {
    return c.redirect('/admin/tenants?error=tenant-not-found');
  }

  const tenant = tenantQueries.findById(db, tenantId);
  if (!tenant) {
    return c.redirect('/admin/tenants?error=tenant-not-found');
  }

  const body = await c.req.parseBody();
  const userId = parsePositiveInt(String(body['user_id'] ?? ''));
  if (!userId) {
    return c.redirect(redirectTenantDetail(tenantId, 'error=user-not-found'));
  }

  const user = db.prepare(`
    SELECT id, name, email, role, active, tenant_id
    FROM users
    WHERE id = ?
    LIMIT 1
  `).get(userId) as
    | { id: number; name: string; email: string; role: string; active: number; tenant_id: number }
    | undefined;

  if (!user || user.tenant_id !== tenantId) {
    return c.redirect(redirectTenantDetail(tenantId, 'error=user-not-found'));
  }

  if (user.active !== 1) {
    return c.redirect(redirectTenantDetail(tenantId, 'error=user-inactive'));
  }

  if (String(user.role).trim().toLowerCase() === 'admin') {
    return c.redirect(redirectTenantDetail(tenantId, 'error=admin-user-blocked'));
  }

  const env = getEnv();
  const token = createImpersonationToken(
    {
      platformAdminEmail: platformAdmin?.email || env.platformAdminEmail || 'platform-admin',
      targetUserId: user.id,
      targetTenantId: tenantId,
      redirectTo: '/dashboard',
    },
    env.secretKey,
  );

  logActivity(db, {
    tenantId,
    actorUserId: null,
    eventType: 'auth.impersonation_requested',
    entityType: 'user',
    entityId: user.id,
    description: `Platform admin ${platformAdmin?.email || env.platformAdminEmail || 'platform-admin'} requested impersonation for ${user.name}.`,
    metadata: {
      platform_admin_email: platformAdmin?.email || env.platformAdminEmail || 'platform-admin',
      impersonated_user_id: user.id,
      impersonated_user_email: user.email,
      impersonated_user_role: user.role,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect(buildTenantImpersonationUrl(tenant.subdomain, token));
});

export { platformAdminRoutes };
export default platformAdminRoutes;