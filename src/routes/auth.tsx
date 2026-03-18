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

  return c.html(
    renderPublicLayout(
      <PickTenantPage formData={{ subdomain: '' }} csrfToken={c.get('csrfToken')} />,
    ),
  );
});

authRoutes.post('/pick-tenant', async (c) => {
  const tenant = c.get('tenant');
  if (tenant) {
    return c.redirect('/login');
  }

  const body = await c.req.parseBody();
  const sub = (typeof body.subdomain === 'string' ? body.subdomain : '').trim().toLowerCase();
  const formData = { subdomain: sub };

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

  return c.redirect(buildTenantLoginUrl(sub));
});

authRoutes.get('/login', (c) => {
  const tenant = c.get('tenant');
  if (!tenant) {
    return c.redirect('/pick-tenant');
  }

  const prefillEmail = (c.req.query('email') || '').trim().toLowerCase();

  return c.html(
    renderPublicLayout(
      <LoginPage
        prefillEmail={prefillEmail}
        csrfToken={c.get('csrfToken')}
        currentTenant={tenant}
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
    return c.html(
      renderPublicLayout(
        <LoginPage
          error={error}
          prefillEmail={email}
          csrfToken={c.get('csrfToken')}
          currentTenant={tenant}
        />,
      ),
    );
  }

  const fullUser = db
    .prepare('SELECT id, name, email, role FROM users WHERE id = ? AND tenant_id = ? LIMIT 1')
    .get(row!.id, tenant.id) as { id: number; name: string; email: string; role: string } | undefined;

  if (!fullUser) {
    return c.html(
      renderPublicLayout(
        <LoginPage
          error="Invalid login"
          prefillEmail={email}
          csrfToken={c.get('csrfToken')}
          currentTenant={tenant}
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
    },
  );

  setSessionCookie(c, sessionCookie);

  logActivity(db, {
    tenantId: tenant.id,
    actorUserId: null,
    eventType: 'auth.impersonation_started',
    entityType: 'user',
    entityId: targetUser.id,
    description: `Platform admin ${token.platformAdminEmail} started impersonating ${targetUser.name}.`,
    metadata: {
      platform_admin_email: token.platformAdminEmail,
      impersonated_user_id: targetUser.id,
      impersonated_user_email: targetUser.email,
      impersonated_user_role: targetUser.role,
      started_at_unix: startedAt,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect(token.redirectTo || '/dashboard');
});

authRoutes.get('/impersonation/stop', (c) => {
  const tenant = c.get('tenant');
  if (!tenant) {
    return c.redirect('/pick-tenant');
  }

  const env = getEnv();
  const cookie = getCookie(c, SESSION_COOKIE_NAME);
  if (!cookie) {
    return c.redirect('/login');
  }

  const session = getSessionUser(cookie, env.secretKey);
  if (!session?.impersonation) {
    return c.redirect('/dashboard');
  }

  const db = getDb();
  const targetUser = db
    .prepare('SELECT id, name, email, role, tenant_id FROM users WHERE id = ? LIMIT 1')
    .get(session.userId) as { id: number; name: string; email: string; role: string; tenant_id: number } | undefined;

  clearSessionCookie(c);

  if (targetUser && targetUser.tenant_id === tenant.id) {
    logActivity(db, {
      tenantId: tenant.id,
      actorUserId: null,
      eventType: 'auth.impersonation_ended',
      entityType: 'user',
      entityId: targetUser.id,
      description: `Platform admin ${session.impersonation.platformAdminEmail} ended impersonation for ${targetUser.name}.`,
      metadata: {
        platform_admin_email: session.impersonation.platformAdminEmail,
        impersonated_user_id: targetUser.id,
        impersonated_user_email: targetUser.email,
        impersonated_user_role: targetUser.role,
      },
      ipAddress: resolveRequestIp(c),
    });
  }

  return c.redirect(buildPlatformAdminTenantDetailUrl(session.impersonation.impersonatedTenantId));
});

authRoutes.get('/logout', (c) => {
  clearSessionCookie(c);
  return c.redirect('/login');
});

authRoutes.get('/signup', (c) => {
  const env = getEnv();

  const formData = {
    company_name: '',
    subdomain: '',
    admin_name: '',
    admin_email: '',
    invite_code: '',
  };

  return c.html(
    renderPublicLayout(
      <SignupPage
        formData={formData}
        csrfToken={c.get('csrfToken')}
        inviteOnly={!!env.launchCode}
      />,
    ),
  );
});

authRoutes.post('/signup', async (c) => {
  const env = getEnv();
  const body = await c.req.parseBody();

  const company_name = (typeof body.company_name === 'string' ? body.company_name : '').trim();
  const subdomain = (typeof body.subdomain === 'string' ? body.subdomain : '').trim().toLowerCase();
  const admin_name = (typeof body.admin_name === 'string' ? body.admin_name : '').trim();
  const admin_email = (typeof body.admin_email === 'string' ? body.admin_email : '').trim().toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const invite_code = (typeof body.invite_code === 'string' ? body.invite_code : '').trim();

  const formData = { company_name, subdomain, admin_name, admin_email, invite_code };

  const renderError = (error: string) =>
    c.html(
      renderPublicLayout(
        <SignupPage
          error={error}
          formData={formData}
          csrfToken={c.get('csrfToken')}
          inviteOnly={!!env.launchCode}
        />,
      ),
      400,
    );

  if (!company_name || !subdomain || !admin_name || !admin_email || !password) {
    return renderError('All fields are required.');
  }

  if (env.launchCode && invite_code !== env.launchCode) {
    return renderError('Invalid invite code.');
  }

  if (!isValidSubdomain(subdomain)) {
    return renderError('Subdomain can only contain lowercase letters, numbers, hyphens, or underscores.');
  }

  if (!isValidEmail(admin_email)) {
    return renderError('Please enter a valid admin email address.');
  }

  if (password.length < 8) {
    return renderError('Password must be at least 8 characters long.');
  }

  const db = getDb();

  const existingTenant = tenantQueries.findBySubdomain(db, subdomain);
  if (existingTenant) {
    return renderError('That subdomain is already taken.');
  }

  try {
    const createTenantAndAdmin = db.transaction(() => {
      const tenantId = tenantQueries.create(db, {
        name: company_name,
        subdomain,
        billing_plan: 'standard',
        billing_status: 'trialing',
        billing_trial_ends_at: buildTenantTrialEndDate(),
      });

      const adminUserId = userQueries.create(db, {
        name: admin_name,
        email: admin_email,
        password_hash: hashPassword(password),
        role: 'Admin',
        tenant_id: tenantId,
      });

      logActivity(db, {
        tenantId,
        actorUserId: adminUserId,
        eventType: 'tenant.signup',
        entityType: 'tenant',
        entityId: tenantId,
        description: `${company_name} was created with ${admin_name} as the initial admin.`,
        metadata: {
          subdomain,
          admin_email,
        },
        ipAddress: resolveRequestIp(c),
      });

      return tenantId;
    });

    createTenantAndAdmin();
  } catch (error: any) {
    const message = String(error?.message || '');

    if (message.includes('users.tenant_id, users.email') || message.includes('idx_users_tenant_email_unique')) {
      return renderError('That admin email is already in use for this company.');
    }

    if (message.includes('users.email')) {
      return renderError(
        'That admin email is already being used elsewhere in the platform. Apply the tenant-scoped email migration before creating more tenants.',
      );
    }

    console.error('Signup failed:', error);
    return renderError('Signup could not be completed right now. Please try again.');
  }

  return c.redirect(buildTenantLoginUrl(subdomain, admin_email));
});
