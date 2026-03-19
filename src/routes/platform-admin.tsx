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

type AdvancedBillingState =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'grace_period'
  | 'suspended'
  | 'canceled'
  | 'internal'
  | 'billing_exempt';

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

function normalizeQueryText(value: string | undefined | null): string {
  return String(value || '').trim();
}

function normalizeRoleFilter(value: string | undefined | null): string {
  const role = String(value || '').trim();
  if (role === 'Admin' || role === 'Manager' || role === 'Employee') return role;
  return '';
}

function normalizeStatusFilter(value: string | undefined | null): string {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'eligible' || status === 'blocked' || status === 'disabled') return status;
  return '';
}

function normalizeAdvancedBillingState(value: string | undefined | null): AdvancedBillingState | null {
  const normalized = String(value || '').trim().toLowerCase();

  switch (normalized) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'grace_period':
    case 'suspended':
    case 'canceled':
    case 'internal':
    case 'billing_exempt':
      return normalized;
    default:
      return null;
  }
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
  if (updated === 'override') {
    return { tone: 'good', message: 'Advanced billing override was applied and logged.' };
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
  if (error === 'invalid-advanced-state') {
    return { tone: 'bad', message: 'That advanced billing state is not allowed.' };
  }
  if (error === 'reason-too-long') {
    return { tone: 'bad', message: 'Billing override reason must be 300 characters or less.' };
  }
  if (error === 'user-not-found') {
    return { tone: 'bad', message: 'That tenant user was not found or cannot be impersonated.' };
  }
  if (error === 'user-inactive') {
    return { tone: 'bad', message: 'That user is inactive and cannot be impersonated.' };
  }
  if (error === 'admin-user-blocked') {
    return { tone: 'bad', message: 'Platform admin impersonation of tenant Admin users is blocked in Phase 3B for safety.' };
  }
  if (error === 'support-reason-too-long') {
    return { tone: 'bad', message: 'Support reason must be 200 characters or less.' };
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

function buildAdvancedBillingLegacySync(
  state: AdvancedBillingState,
  graceUntil: string | null,
) {
  const patch: Record<string, unknown> = {
    billing_state: state,
    billing_grace_until: graceUntil,
  };

  switch (state) {
    case 'billing_exempt':
      patch.billing_exempt = 1;
      patch.billing_status = 'internal';
      patch.billing_grace_ends_at = null;
      break;

    case 'internal':
      patch.billing_exempt = 0;
      patch.billing_status = 'internal';
      patch.billing_grace_ends_at = null;
      break;

    case 'active':
      patch.billing_exempt = 0;
      patch.billing_status = 'active';
      patch.billing_grace_ends_at = null;
      patch.billing_grace_until = null;
      break;

    case 'trialing':
      patch.billing_exempt = 0;
      patch.billing_status = 'trialing';
      patch.billing_grace_ends_at = null;
      patch.billing_grace_until = null;
      break;

    case 'past_due':
      patch.billing_exempt = 0;
      patch.billing_status = 'past_due';
      patch.billing_grace_ends_at = graceUntil;
      break;

    case 'grace_period': {
      const safeGrace = graceUntil || addDays(7);
      patch.billing_exempt = 0;
      patch.billing_status = 'past_due';
      patch.billing_grace_until = safeGrace;
      patch.billing_grace_ends_at = safeGrace;
      break;
    }

    case 'suspended':
      patch.billing_exempt = 0;
      patch.billing_status = 'past_due';
      break;

    case 'canceled':
      patch.billing_exempt = 0;
      patch.billing_status = 'canceled';
      patch.billing_grace_ends_at = null;
      break;
  }

  return patch;
}

type TenantHealthRow = {
  id: number;
  name: string;
  subdomain: string;
  created_at: string | null;
  billing_status: string;
  billing_state: string | null;
  billing_exempt: number;
  onboarding_completed_steps: number;
  onboarding_total_steps: number;
  onboarding_status: 'complete' | 'in_progress' | 'not_started';
  user_count: number;
  active_user_count: number;
  job_count: number;
  employee_count: number;
  invoice_count: number;
  open_support_count: number;
  critical_support_count: number;
  recent_activity_count_7d: number;
  recent_activity_count_30d: number;
  last_activity_at: string | null;
  risk_level: 'good' | 'warn' | 'bad';
  risk_summary: string;
};

function hasValue(value: unknown): boolean {
  return String(value ?? '').trim().length > 0;
}

function isCompanyConfigured(tenant: {
  name: string;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  invoice_prefix: string | null;
}): boolean {
  return (
    hasValue(tenant.name)
    && hasValue(tenant.company_email)
    && hasValue(tenant.company_phone)
    && hasValue(tenant.company_address)
    && hasValue(tenant.invoice_prefix)
  );
}

function determineTenantRisk(row: {
  billing_status: string;
  billing_state: string | null;
  billing_exempt: number;
  onboarding_completed_steps: number;
  onboarding_total_steps: number;
  open_support_count: number;
  critical_support_count: number;
  recent_activity_count_7d: number;
  recent_activity_count_30d: number;
  active_user_count: number;
  job_count: number;
}): { risk_level: 'good' | 'warn' | 'bad'; risk_summary: string } {
  const reasons: string[] = [];
  const billingStatus = String(row.billing_status || '').trim().toLowerCase();
  const billingState = String(row.billing_state || '').trim().toLowerCase();
  const onboardingIncomplete = row.onboarding_completed_steps < row.onboarding_total_steps;
  const dormant = row.recent_activity_count_30d === 0;
  const lowActivity = row.recent_activity_count_7d === 0;

  if (billingStatus === 'past_due' || billingStatus === 'canceled' || billingState === 'past_due' || billingState === 'suspended' || billingState === 'canceled') {
    reasons.push('billing needs attention');
  }

  if (row.critical_support_count > 0) {
    reasons.push('critical support ticket open');
  } else if (row.open_support_count > 0) {
    reasons.push('open support follow-up');
  }

  if (!row.billing_exempt && dormant && onboardingIncomplete) {
    reasons.push('no recent activity and onboarding incomplete');
  } else if (lowActivity && row.job_count > 0) {
    reasons.push('no activity in the last 7 days');
  }

  if (row.active_user_count === 0) {
    reasons.push('no active users');
  }

  if (onboardingIncomplete && row.onboarding_completed_steps <= 1) {
    reasons.push('very early onboarding');
  } else if (onboardingIncomplete) {
    reasons.push('onboarding still in progress');
  }

  const hasHardRisk = reasons.some((reason) =>
    reason === 'billing needs attention'
    || reason === 'critical support ticket open'
    || reason === 'no recent activity and onboarding incomplete'
    || reason === 'no active users',
  );

  if (hasHardRisk) {
    return {
      risk_level: 'bad',
      risk_summary: reasons.slice(0, 2).join(' · ') || 'Needs review',
    };
  }

  if (reasons.length > 0) {
    return {
      risk_level: 'warn',
      risk_summary: reasons.slice(0, 2).join(' · '),
    };
  }

  return {
    risk_level: 'good',
    risk_summary: 'Healthy billing, activity, and onboarding signals',
  };
}

function getAdminDashboardData(db: any) {
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

  const baseRows = db.prepare(`
    SELECT
      t.id,
      t.name,
      t.subdomain,
      t.created_at,
      t.billing_status,
      t.billing_state,
      t.billing_exempt,
      t.company_email,
      t.company_phone,
      t.company_address,
      t.invoice_prefix,
      (
        SELECT COUNT(*)
        FROM users u
        WHERE u.tenant_id = t.id
      ) as user_count,
      (
        SELECT COUNT(*)
        FROM users u
        WHERE u.tenant_id = t.id
          AND u.active = 1
      ) as active_user_count,
      (
        SELECT COUNT(*)
        FROM jobs j
        WHERE j.tenant_id = t.id
          AND j.archived_at IS NULL
      ) as job_count,
      (
        SELECT COUNT(*)
        FROM employees e
        WHERE e.tenant_id = t.id
          AND e.archived_at IS NULL
      ) as employee_count,
      (
        SELECT COUNT(*)
        FROM invoices i
        WHERE i.tenant_id = t.id
          AND i.archived_at IS NULL
      ) as invoice_count,
      (
        SELECT COUNT(*)
        FROM support_tickets st
        WHERE st.tenant_id = t.id
          AND st.status <> 'closed'
      ) as open_support_count,
      (
        SELECT COUNT(*)
        FROM support_tickets st
        WHERE st.tenant_id = t.id
          AND st.status <> 'closed'
          AND st.priority = 'critical'
      ) as critical_support_count,
      (
        SELECT COUNT(*)
        FROM activity_logs a
        WHERE a.tenant_id = t.id
          AND a.created_at >= datetime('now', '-7 days')
      ) as recent_activity_count_7d,
      (
        SELECT COUNT(*)
        FROM activity_logs a
        WHERE a.tenant_id = t.id
          AND a.created_at >= datetime('now', '-30 days')
      ) as recent_activity_count_30d,
      (
        SELECT MAX(a.created_at)
        FROM activity_logs a
        WHERE a.tenant_id = t.id
      ) as last_activity_at
    FROM tenants t
    ORDER BY t.name COLLATE NOCASE ASC
  `).all() as Array<{
    id: number;
    name: string;
    subdomain: string;
    created_at: string | null;
    billing_status: string;
    billing_state: string | null;
    billing_exempt: number;
    company_email: string | null;
    company_phone: string | null;
    company_address: string | null;
    invoice_prefix: string | null;
    user_count: number;
    active_user_count: number;
    job_count: number;
    employee_count: number;
    invoice_count: number;
    open_support_count: number;
    critical_support_count: number;
    recent_activity_count_7d: number;
    recent_activity_count_30d: number;
    last_activity_at: string | null;
  }>;

  const tenantHealth = baseRows.map((row) => {
    const totalSteps = 4;
    const completedSteps = [
      isCompanyConfigured(row),
      Number(row.job_count) > 0,
      Number(row.employee_count) > 0,
      Number(row.invoice_count) > 0,
    ].filter(Boolean).length;

    let onboardingStatus: 'complete' | 'in_progress' | 'not_started' = 'not_started';
    if (completedSteps >= totalSteps) onboardingStatus = 'complete';
    else if (completedSteps > 0) onboardingStatus = 'in_progress';

    const risk = determineTenantRisk({
      billing_status: row.billing_status,
      billing_state: row.billing_state,
      billing_exempt: Number(row.billing_exempt),
      onboarding_completed_steps: completedSteps,
      onboarding_total_steps: totalSteps,
      open_support_count: Number(row.open_support_count),
      critical_support_count: Number(row.critical_support_count),
      recent_activity_count_7d: Number(row.recent_activity_count_7d),
      recent_activity_count_30d: Number(row.recent_activity_count_30d),
      active_user_count: Number(row.active_user_count),
      job_count: Number(row.job_count),
    });

    return {
      id: row.id,
      name: row.name,
      subdomain: row.subdomain,
      created_at: row.created_at,
      billing_status: row.billing_status,
      billing_state: row.billing_state,
      billing_exempt: Number(row.billing_exempt),
      onboarding_completed_steps: completedSteps,
      onboarding_total_steps: totalSteps,
      onboarding_status: onboardingStatus,
      user_count: Number(row.user_count),
      active_user_count: Number(row.active_user_count),
      job_count: Number(row.job_count),
      employee_count: Number(row.employee_count),
      invoice_count: Number(row.invoice_count),
      open_support_count: Number(row.open_support_count),
      critical_support_count: Number(row.critical_support_count),
      recent_activity_count_7d: Number(row.recent_activity_count_7d),
      recent_activity_count_30d: Number(row.recent_activity_count_30d),
      last_activity_at: row.last_activity_at,
      risk_level: risk.risk_level,
      risk_summary: risk.risk_summary,
    } satisfies TenantHealthRow;
  }).sort((a, b) => {
    const riskRank = { bad: 0, warn: 1, good: 2 };
    const riskDiff = riskRank[a.risk_level] - riskRank[b.risk_level];
    if (riskDiff !== 0) return riskDiff;
    if (b.open_support_count !== a.open_support_count) return b.open_support_count - a.open_support_count;
    if (a.onboarding_completed_steps !== b.onboarding_completed_steps) return a.onboarding_completed_steps - b.onboarding_completed_steps;
    return a.name.localeCompare(b.name);
  });

  const metrics = {
    totalTenants: tenantHealth.length,
    activeTenants: tenantHealth.filter((tenant) => !tenant.billing_exempt && tenant.billing_status === 'active').length,
    trialingTenants: tenantHealth.filter((tenant) => !tenant.billing_exempt && tenant.billing_status === 'trialing').length,
    internalTenants: tenantHealth.filter((tenant) => tenant.billing_exempt || tenant.billing_status === 'internal').length,
    pastDueTenants: tenantHealth.filter((tenant) => !tenant.billing_exempt && tenant.billing_status === 'past_due').length,
    canceledTenants: tenantHealth.filter((tenant) => !tenant.billing_exempt && tenant.billing_status === 'canceled').length,
    onboardingCompleteTenants: tenantHealth.filter((tenant) => tenant.onboarding_status === 'complete').length,
    onboardingInProgressTenants: tenantHealth.filter((tenant) => tenant.onboarding_status === 'in_progress').length,
    onboardingNotStartedTenants: tenantHealth.filter((tenant) => tenant.onboarding_status === 'not_started').length,
    atRiskTenants: tenantHealth.filter((tenant) => tenant.risk_level === 'bad').length,
    dormantTenants: tenantHealth.filter((tenant) => tenant.recent_activity_count_30d === 0).length,
    openSupportTickets: tenantHealth.reduce((sum, tenant) => sum + tenant.open_support_count, 0),
    criticalSupportTickets: tenantHealth.reduce((sum, tenant) => sum + tenant.critical_support_count, 0),
    tenantsWithNoActivity7d: tenantHealth.filter((tenant) => tenant.recent_activity_count_7d === 0).length,
  };

  return { metrics, recentTenants, tenantHealth };
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
  const { metrics, recentTenants, tenantHealth } = getAdminDashboardData(db);

  return renderAdminLayout(
    c,
    'Tenant health and operational visibility',
    <AdminDashboardPage metrics={metrics} recentTenants={recentTenants} tenantHealth={tenantHealth} />,
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
  const search = normalizeQueryText(c.req.query('q'));

  const whereParts = ['1 = 1'];
  const params: Array<string | number> = [];

  if (search) {
    whereParts.push('(t.name LIKE ? OR t.subdomain LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

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
      COUNT(DISTINCT j.id) as job_count,
      (
        SELECT COUNT(*)
        FROM users ux
        WHERE ux.tenant_id = t.id
          AND ux.active = 1
          AND LOWER(ux.role) <> 'admin'
      ) as impersonatable_user_count,
      (
        SELECT ux.id
        FROM users ux
        WHERE ux.tenant_id = t.id
          AND ux.active = 1
          AND LOWER(ux.role) <> 'admin'
        ORDER BY CASE LOWER(ux.role)
          WHEN 'manager' THEN 1
          WHEN 'employee' THEN 2
          ELSE 9
        END, ux.name COLLATE NOCASE ASC
        LIMIT 1
      ) as first_impersonatable_user_id,
      (
        SELECT ux.name
        FROM users ux
        WHERE ux.tenant_id = t.id
          AND ux.active = 1
          AND LOWER(ux.role) <> 'admin'
        ORDER BY CASE LOWER(ux.role)
          WHEN 'manager' THEN 1
          WHEN 'employee' THEN 2
          ELSE 9
        END, ux.name COLLATE NOCASE ASC
        LIMIT 1
      ) as first_impersonatable_user_name,
      (
        SELECT ux.role
        FROM users ux
        WHERE ux.tenant_id = t.id
          AND ux.active = 1
          AND LOWER(ux.role) <> 'admin'
        ORDER BY CASE LOWER(ux.role)
          WHEN 'manager' THEN 1
          WHEN 'employee' THEN 2
          ELSE 9
        END, ux.name COLLATE NOCASE ASC
        LIMIT 1
      ) as first_impersonatable_user_role
    FROM tenants t
    LEFT JOIN users u ON u.tenant_id = t.id
    LEFT JOIN jobs j ON j.tenant_id = t.id
    WHERE ${whereParts.join(' AND ')}
    GROUP BY t.id
    ORDER BY t.name COLLATE NOCASE ASC
  `).all(...params) as Array<{
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
    impersonatable_user_count: number;
    first_impersonatable_user_id: number | null;
    first_impersonatable_user_name: string | null;
    first_impersonatable_user_role: string | null;
  }>;

  return renderAdminLayout(
    c,
    'Tenant Directory',
    <AdminTenantsPage tenants={tenants} csrfToken={c.get('csrfToken')} search={search} />,
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
        billing_state: string | null;
        billing_grace_until: string | null;
        billing_override_reason: string | null;
        billing_overridden_by_user_id: number | null;
        billing_overridden_at: string | null;
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

  const userSearch = normalizeQueryText(c.req.query('q'));
  const roleFilter = normalizeRoleFilter(c.req.query('role'));
  const statusFilter = normalizeStatusFilter(c.req.query('status'));

  const userWhereParts = ['tenant_id = ?'];
  const userParams: Array<string | number> = [tenant.id];

  if (userSearch) {
    userWhereParts.push('(name LIKE ? OR email LIKE ?)');
    userParams.push(`%${userSearch}%`, `%${userSearch}%`);
  }

  if (roleFilter) {
    userWhereParts.push('role = ?');
    userParams.push(roleFilter);
  }

  if (statusFilter === 'eligible') {
    userWhereParts.push('active = 1 AND LOWER(role) <> ?');
    userParams.push('admin');
  } else if (statusFilter === 'blocked') {
    userWhereParts.push('active = 1 AND LOWER(role) = ?');
    userParams.push('admin');
  } else if (statusFilter === 'disabled') {
    userWhereParts.push('active <> 1');
  }

  const users = db.prepare(`
    SELECT id, name, email, role, active
    FROM users
    WHERE ${userWhereParts.join(' AND ')}
    ORDER BY CASE LOWER(role)
      WHEN 'admin' THEN 1
      WHEN 'manager' THEN 2
      WHEN 'employee' THEN 3
      ELSE 9
    END, name COLLATE NOCASE ASC
  `).all(...userParams).map((user: any) => ({
    ...user,
    can_impersonate: Number(user.active) === 1 && String(user.role).trim().toLowerCase() !== 'admin',
  })) as Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    active: number;
    can_impersonate: boolean;
  }>;

  return renderAdminLayout(
    c,
    `Tenant Detail: ${tenant.name}`,
    <AdminTenantDetailPage
      tenant={tenant}
      users={users}
      workspaceLoginUrl={buildTenantLoginUrl(tenant.subdomain)}
      csrfToken={c.get('csrfToken')}
      userSearch={userSearch}
      roleFilter={roleFilter}
      statusFilter={statusFilter}
      notice={resolveNotice(c)}
    />,
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

platformAdminRoutes.post('/admin/tenants/:id/billing/override', platformAdminRequired, async (c) => {
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
  const billingState = normalizeAdvancedBillingState(body['billing_state'] as string);
  const reason = String(body['reason'] ?? '').trim();
  const graceUntilRaw = String(body['grace_until'] ?? '').trim();
  const graceUntil = graceUntilRaw ? `${graceUntilRaw} 23:59:59` : null;

  if (!billingState) {
    return c.redirect(redirectTenantDetail(tenantId, 'error=invalid-advanced-state'));
  }

  if (reason.length > 300) {
    return c.redirect(redirectTenantDetail(tenantId, 'error=reason-too-long'));
  }

  const patch = buildAdvancedBillingLegacySync(billingState, graceUntil);

  tenantQueries.updateBillingState(db, tenantId, {
    ...patch,
    billing_override_reason: reason || null,
    billing_overridden_by_user_id: null,
    billing_overridden_at: toSqlDate(new Date()),
  });

  db.prepare(`
    INSERT INTO activity_logs (
      tenant_id,
      actor_user_id,
      event_type,
      entity_type,
      entity_id,
      description,
      ip_address,
      metadata_json
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
  `).run(
    tenantId,
    'admin.billing.override',
    'tenant',
    tenantId,
    `Platform admin set advanced billing state to ${billingState}.`,
    resolveRequestIp(c.req.raw),
    JSON.stringify({
      billing_state: billingState,
      reason: reason || null,
      grace_until: graceUntil,
      platform_admin_email: c.get('platformAdmin')?.email || null,
    }),
  );

  return c.redirect(redirectTenantDetail(tenantId, 'updated=override'));
});

platformAdminRoutes.post('/admin/tenants/:id/impersonate', platformAdminRequired, async (c) => {
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
  const userId = parsePositiveInt(String(body['user_id'] ?? ''));
  const supportReason = String(body['support_reason'] ?? '').trim();

  if (!userId) {
    return c.redirect(redirectTenantDetail(tenantId, 'error=user-not-found'));
  }

  if (supportReason.length > 200) {
    return c.redirect(redirectTenantDetail(tenantId, 'error=support-reason-too-long'));
  }

  const user = db.prepare(`
    SELECT id, tenant_id, name, email, role, active
    FROM users
    WHERE id = ? AND tenant_id = ?
    LIMIT 1
  `).get(userId, tenantId) as
    | {
        id: number;
        tenant_id: number;
        name: string;
        email: string;
        role: string;
        active: number;
      }
    | undefined;

  if (!user) {
    return c.redirect(redirectTenantDetail(tenantId, 'error=user-not-found'));
  }

  if (Number(user.active) !== 1) {
    return c.redirect(redirectTenantDetail(tenantId, 'error=user-inactive'));
  }

  if (String(user.role).trim().toLowerCase() === 'admin') {
    return c.redirect(redirectTenantDetail(tenantId, 'error=admin-user-blocked'));
  }

  const token = createImpersonationToken({
    tenantId,
    userId: user.id,
    platformAdminEmail: c.get('platformAdmin')?.email || 'unknown',
    supportReason: supportReason || 'Support access',
  });

  await logActivity(db, {
    tenantId,
    actorUserId: null,
    eventType: 'admin.impersonation.started',
    entityType: 'user',
    entityId: user.id,
    description: `Platform admin initiated impersonation for ${user.name} (${user.role}).`,
    ipAddress: resolveRequestIp(c.req.raw),
    metadata: {
      target_user_name: user.name,
      target_user_email: user.email,
      target_user_role: user.role,
      platform_admin_email: c.get('platformAdmin')?.email || null,
      support_reason: supportReason || null,
    },
  });

  return c.redirect(buildTenantImpersonationUrl(tenant.subdomain, token));
});
export { platformAdminRoutes };
export default platformAdminRoutes;