import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { getDb } from '../db/connection.js';
import * as tenantQueries from '../db/queries/tenants.js';
import * as userQueries from '../db/queries/users.js';
import {
  createSessionCookie,
  getImpersonationToken,
  getSessionUser,
  SESSION_COOKIE_NAME,
} from '../services/session.js';
import { hashPassword, verifyPassword } from '../services/password.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';
import { PublicLayout } from '../pages/layouts/PublicLayout.js';
import { LoginPage } from '../pages/auth/LoginPage.js';
import { SignupPage } from '../pages/auth/SignupPage.js';
import { PickTenantPage } from '../pages/auth/PickTenantPage.js';
import { LandingPage } from '../pages/marketing/LandingPage.js';
import { getEnv } from '../config/env.js';

export const authRoutes = new Hono<AppEnv>();

function isValidSubdomain(value: string): boolean {
  if (!value) return false;
  value = value.trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9_-]{0,61}[a-z0-9])?$/.test(value);
}

function isValidEmail(value: string): boolean {
  if (!value) return false;
  value = value.trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function buildTenantLoginUrl(subdomain: string, email?: string): string {
  const env = getEnv();

  let host: string;
  if (env.baseDomain === 'localhost') {
    host = `http://${subdomain}.localhost:${env.port}`;
  } else {
    host = `https://${subdomain}.${env.baseDomain}`;
  }

  const emailQs = email ? `?email=${encodeURIComponent(email)}` : '';
  return `${host}/login${emailQs}`;
}

function buildBaseAppUrl(path = '/'): string {
  const env = getEnv();

  if (env.baseDomain === 'localhost') {
    return `http://localhost:${env.port}${path}`;
  }

  return `https://${env.baseDomain}${path}`;
}

function buildPlatformAdminTenantDetailUrl(tenantId: number): string {
  const env = getEnv();

  if (env.baseDomain === 'localhost') {
    return `http://localhost:${env.port}/admin/tenants/${tenantId}`;
  }

  return `https://${env.baseDomain}/admin/tenants/${tenantId}`;
}

function buildTenantTrialEndDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 14);
  return date.toISOString().slice(0, 10);
}

function renderPublicLayout(children: any) {
  const env = getEnv();

  return (
    <PublicLayout appName={env.appName} appLogo={env.appLogo}>
      {children}
    </PublicLayout>
  );
}

function shouldUseSecureCookies(hostHeader: string | undefined): boolean {
  const env = getEnv();
  const host = String(hostHeader ?? '').toLowerCase();

  if (!env.isProduction) {
    return false;
  }

  if (
    host.includes('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('0.0.0.0')
  ) {
    return false;
  }

  if (env.baseDomain === 'localhost') {
    return false;
  }

  return true;
}

function setSessionCookie(c: any, value: string) {
  const env = getEnv();
  const secureCookies = shouldUseSecureCookies(c.req.header('Host'));

  setCookie(c, SESSION_COOKIE_NAME, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: secureCookies,
    maxAge: env.sessionTtlSeconds,
  });
}

function clearSessionCookie(c: any) {
  const secureCookies = shouldUseSecureCookies(c.req.header('Host'));

  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: secureCookies,
  });
}

authRoutes.get('/', (c) => {
  const tenant = c.get('tenant');
  const env = getEnv();

  if (tenant) {
    const cookie = getCookie(c, SESSION_COOKIE_NAME);
    if (cookie) {
      return c.redirect('/dashboard');
    }
    return c.redirect('/login');
  }

  return c.html(
    renderPublicLayout(
      <LandingPage
        appName={env.appName}
        appLogo={env.appLogo}
      />,
    ),
  );
});

authRoutes.get('/pick-tenant', (c) => {
  const tenant = c.get('tenant');
  if (tenant) {
    return c.redirect('/login');
  }

  const sub = (c.req.query('subdomain') || '').trim().toLowerCase();
  const formData = { subdomain: sub };

  if (!sub) {
    return c.html(
      renderPublicLayout(
        <PickTenantPage formData={formData} csrfToken={c.get('csrfToken')} />,
      ),
    );
  }

  if (!isValidSubdomain(sub)) {
    return c.html(
      renderPublicLayout(
        <PickTenantPage
          error="Please enter a valid company subdomain."
          formData={formData}
          csrfToken={c.get('csrfToken')}
        />,
      ),
    );
  }

  const db = getDb();
  const exists = tenantQueries.findBySubdomain(db, sub);

  if (!exists) {
    return c.html(
      renderPublicLayout(
        <PickTenantPage
          error="That company subdomain was not found."
          formData={formData}
          csrfToken={c.get('csrfToken')}
        />,
      ),
    );
  }

  return c.redirect(buildTenantLoginUrl(sub), 303);
});

authRoutes.post('/pick-tenant', async (c) => {
  const tenant = c.get('tenant');
  if (tenant) {
    return c.redirect('/login');
  }

  // Legacy fallback for older forms. CSRF middleware reads POST bodies first,
  // so repeated or even single-use form fields can be unavailable here on a
  // second parse. Redirect to the GET flow when possible.
  const body = await c.req.parseBody({ all: true });
  const raw = Array.isArray(body.subdomain) ? body.subdomain[0] : body.subdomain;
  const sub = (typeof raw === 'string' ? raw : '').trim().toLowerCase();

  if (!sub) {
    return c.html(
      renderPublicLayout(
        <PickTenantPage
          error="Please enter a valid company subdomain."
          formData={{ subdomain: '' }}
          csrfToken={c.get('csrfToken')}
        />,
      ),
    );
  }

  return c.redirect(`/pick-tenant?subdomain=${encodeURIComponent(sub)}`, 303);
});

authRoutes.get('/login', (c) => {
  const tenant = c.get('tenant');
  if (!tenant) {
    return c.redirect('/pick-tenant');
  }

  const prefillEmail = (c.req.query('email') || '').trim().toLowerCase();
  const findWorkspaceUrl = buildBaseAppUrl('/pick-tenant');

  return c.html(
    renderPublicLayout(
      <LoginPage
        prefillEmail={prefillEmail}
        csrfToken={c.get('csrfToken')}
        currentTenant={tenant}
        findWorkspaceUrl={findWorkspaceUrl}
      />,
    ),
  );
});

authRoutes.post('/login', async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) {
    return c.redirect('/pick-tenant');
  }

  const body = await c.req.parseBody();
  const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  const db = getDb();
  const row = userQueries.findByEmailAndTenant(db, email, tenant.id) as
    | { id: number; password_hash: string; active: number; name?: string; email?: string; role?: string }
    | undefined;

  let error: string | undefined;

  if (!row) {
    error = 'Invalid login';
  } else if (row.active !== 1) {
    error = 'Account disabled';
  } else if (!verifyPassword(password, row.password_hash)) {
    error = 'Invalid login';
  }

  if (error) {
    const findWorkspaceUrl = buildBaseAppUrl('/pick-tenant');

    return c.html(
      renderPublicLayout(
        <LoginPage
          error={error}
          prefillEmail={email}
          csrfToken={c.get('csrfToken')}
          currentTenant={tenant}
          findWorkspaceUrl={findWorkspaceUrl}
        />,
      ),
    );
  }

  const fullUser = db
    .prepare('SELECT id, name, email, role FROM users WHERE id = ? AND tenant_id = ? LIMIT 1')
    .get(row!.id, tenant.id) as { id: number; name: string; email: string; role: string } | undefined;

  if (!fullUser) {
    const findWorkspaceUrl = buildBaseAppUrl('/pick-tenant');

    return c.html(
      renderPublicLayout(
        <LoginPage
          error="Invalid login"
          prefillEmail={email}
          csrfToken={c.get('csrfToken')}
          currentTenant={tenant}
          findWorkspaceUrl={findWorkspaceUrl}
        />,
      ),
      401,
    );
  }

  const env = getEnv();
  const sessionCookie = createSessionCookie(fullUser.id, env.secretKey, env.sessionTtlSeconds);

  setSessionCookie(c, sessionCookie);

  logActivity(db, {
    tenantId: tenant.id,
    actorUserId: fullUser.id,
    eventType: 'auth.login',
    entityType: 'user',
    entityId: fullUser.id,
    description: `${fullUser.name} signed in.`,
    metadata: {
      email: fullUser.email,
      role: fullUser.role,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect('/dashboard');
});

authRoutes.get('/impersonation/start', (c) => {
  const tenant = c.get('tenant');
  if (!tenant) {
    return c.redirect('/pick-tenant');
  }

  const env = getEnv();
  const tokenValue = String(c.req.query('token') || '').trim();
  if (!tokenValue) {
    return c.redirect('/login');
  }

  const token = getImpersonationToken(tokenValue, env.secretKey);
  if (!token) {
    return c.redirect('/login');
  }

  if (token.targetTenantId !== tenant.id) {
    return c.text('Invalid impersonation target.', 400);
  }

  if (env.platformAdminEmail && token.platformAdminEmail !== env.platformAdminEmail) {
    return c.text('Invalid impersonation target.', 400);
  }

  const db = getDb();
  const targetUser = db
    .prepare('SELECT id, name, email, role, active, tenant_id FROM users WHERE id = ? LIMIT 1')
    .get(token.targetUserId) as
    | { id: number; name: string; email: string; role: string; active: number; tenant_id: number }
    | undefined;

  if (!targetUser || targetUser.active !== 1 || targetUser.tenant_id !== tenant.id) {
    return c.text('Impersonation target is unavailable.', 404);
  }

  const startedAt = Math.floor(Date.now() / 1000);
  const sessionCookie = createSessionCookie(
    targetUser.id,
    env.secretKey,
    env.sessionTtlSeconds,
    {
      platformAdminEmail: token.platformAdminEmail,
      impersonatedUserId: targetUser.id,
      impersonatedTenantId: tenant.id,
      startedAt,
      supportReason: token.supportReason,
    },
  );

  setSessionCookie(c, sessionCookie);

  logActivity(db, {
    tenantId: tenant.id,
    actorUserId: targetUser.id,
    eventType: 'auth.impersonation.start',
    entityType: 'user',
    entityId: targetUser.id,
    description: `Platform admin impersonation started for ${targetUser.name}.`,
    metadata: {
      impersonated_user_email: targetUser.email,
      impersonated_user_role: targetUser.role,
      platform_admin_email: token.platformAdminEmail,
      support_reason: token.supportReason,
      started_at: startedAt,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect('/dashboard');
});

authRoutes.get('/logout', (c) => {
  const user = c.get('user');
  const tenant = c.get('tenant');

  if (user && tenant) {
    const db = getDb();
    logActivity(db, {
      tenantId: tenant.id,
      actorUserId: user.id,
      eventType: 'auth.logout',
      entityType: 'user',
      entityId: user.id,
      description: `${user.name} signed out.`,
      metadata: {
        email: user.email,
        role: user.role,
      },
      ipAddress: resolveRequestIp(c),
    });
  }

  clearSessionCookie(c);
  return c.redirect('/login');
});

authRoutes.get('/signup', (c) => {
  const tenant = c.get('tenant');
  if (tenant) {
    return c.redirect('/dashboard');
  }

  const env = getEnv();
  const inviteOnly = !!env.launchCode;

  return c.html(
    renderPublicLayout(
      <SignupPage
        csrfToken={c.get('csrfToken')}
        formData={{}}
        inviteOnly={inviteOnly}
      />,
    ),
  );
});

authRoutes.post('/signup', async (c) => {
  const tenant = c.get('tenant');
  if (tenant) {
    return c.redirect('/dashboard');
  }

  const env = getEnv();
  const inviteOnly = !!env.launchCode;

  const body = await c.req.parseBody();
  const companyName = (typeof body.company_name === 'string' ? body.company_name : '').trim();
  const subdomain = (typeof body.subdomain === 'string' ? body.subdomain : '').trim().toLowerCase();
  const adminName = (typeof body.admin_name === 'string' ? body.admin_name : '').trim();
  const adminEmail = (typeof body.admin_email === 'string' ? body.admin_email : '').trim().toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const inviteCode = (typeof body.invite_code === 'string' ? body.invite_code : '').trim();

  const formData = {
    company_name: companyName,
    subdomain,
    admin_name: adminName,
    admin_email: adminEmail,
    invite_code: inviteCode,
  };

  let error: string | undefined;

  if (!companyName) error = 'Company name is required.';
  else if (!isValidSubdomain(subdomain)) error = 'Please choose a valid subdomain.';
  else if (!adminName) error = 'Admin name is required.';
  else if (!isValidEmail(adminEmail)) error = 'Please enter a valid admin email.';
  else if (!password || password.length < 8) error = 'Password must be at least 8 characters.';
  else if (inviteOnly && inviteCode !== env.launchCode) error = 'Invite code is invalid.';

  const db = getDb();

  if (!error) {
    const existingTenant = tenantQueries.findBySubdomain(db, subdomain);
    if (existingTenant) {
      error = 'That subdomain is already in use.';
    }
  }

  if (!error) {
    const existingUser = db
      .prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
      .get(adminEmail) as { id: number } | undefined;

    if (existingUser) {
      error = 'That email address is already in use.';
    }
  }

  if (error) {
    return c.html(
      renderPublicLayout(
        <SignupPage
          error={error}
          formData={formData}
          csrfToken={c.get('csrfToken')}
          inviteOnly={inviteOnly}
        />,
      ),
      400,
    );
  }

  const passwordHash = hashPassword(password);

  const tenantInsert = db.prepare(`
    INSERT INTO tenants (
      name,
      subdomain,
      billing_status,
      billing_plan,
      billing_trial_ends_at,
      billing_exempt,
      created_at
    ) VALUES (?, ?, 'trialing', 'standard', ?, 0, CURRENT_TIMESTAMP)
  `).run(companyName, subdomain, buildTenantTrialEndDate());

  const tenantId = Number(tenantInsert.lastInsertRowid);

  const userInsert = db.prepare(`
    INSERT INTO users (
      tenant_id,
      name,
      email,
      password_hash,
      role,
      active,
      created_at
    ) VALUES (?, ?, ?, ?, 'Admin', 1, CURRENT_TIMESTAMP)
  `).run(tenantId, adminName, adminEmail, passwordHash);

  const userId = Number(userInsert.lastInsertRowid);

  db.prepare(`
    INSERT INTO settings (
      tenant_id,
      key,
      value,
      created_at,
      updated_at
    ) VALUES
      (?, 'company_name', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (?, 'invoice_prefix', 'INV', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(tenantId, companyName, tenantId);

  logActivity(db, {
    tenantId,
    actorUserId: userId,
    eventType: 'auth.signup',
    entityType: 'tenant',
    entityId: tenantId,
    description: `${companyName} workspace was created.`,
    metadata: {
      subdomain,
      admin_name: adminName,
      admin_email: adminEmail,
      billing_status: 'trialing',
      billing_plan: 'standard',
    },
    ipAddress: resolveRequestIp(c),
  });

  const adminUrl = buildPlatformAdminTenantDetailUrl(tenantId);
  console.log(`[signup] New tenant created: ${companyName} (${subdomain}) -> ${adminUrl}`);

  return c.redirect(buildTenantLoginUrl(subdomain, adminEmail));
});

authRoutes.use('*', async (c, next) => {
  const cookie = getCookie(c, SESSION_COOKIE_NAME);
  if (!cookie) {
    c.set('user', null);
    return next();
  }

  const env = getEnv();
  const session = getSessionUser(cookie, env.secretKey);

  if (!session || typeof session.userId !== 'number') {
    clearSessionCookie(c);
    c.set('user', null);
    return next();
  }

  const tenant = c.get('tenant');
  if (!tenant) {
    clearSessionCookie(c);
    c.set('user', null);
    return c.redirect('/pick-tenant');
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id, tenant_id, name, email, role, active FROM users WHERE id = ? LIMIT 1')
    .get(session.userId) as
    | { id: number; tenant_id: number; name: string; email: string; role: string; active: number }
    | undefined;

  if (!user || user.active !== 1 || user.tenant_id !== tenant.id) {
    clearSessionCookie(c);
    c.set('user', null);
    return c.redirect('/login');
  }

  c.set('user', {
    id: user.id,
    tenant_id: user.tenant_id,
    name: user.name,
    email: user.email,
    role: user.role,
    isImpersonating: !!session.platformAdminEmail,
    impersonationContext: session.platformAdminEmail ? {
      platformAdminEmail: session.platformAdminEmail,
      impersonatedUserId: session.impersonatedUserId ?? user.id,
      impersonatedTenantId: session.impersonatedTenantId ?? tenant.id,
      startedAt: session.startedAt ?? null,
      supportReason: session.supportReason ?? null,
    } : null,
  });

  return next();
});

export default authRoutes;