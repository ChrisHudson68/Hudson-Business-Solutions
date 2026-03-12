import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { getDb } from '../db/connection.js';
import * as tenantQueries from '../db/queries/tenants.js';
import * as userQueries from '../db/queries/users.js';
import { createSessionCookie, SESSION_COOKIE_NAME } from '../services/session.js';
import { hashPassword, verifyPassword } from '../services/password.js';
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
  const row = userQueries.findByEmailAndTenant(db, email, tenant.id);

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

  const env = getEnv();
  const sessionCookie = createSessionCookie(row!.id, env.secretKey, env.sessionTtlSeconds);

  setSessionCookie(c, sessionCookie);

  return c.redirect('/dashboard');
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

  const tenantId = tenantQueries.create(db, {
    name: company_name,
    subdomain,
  });

  userQueries.create(db, {
    name: admin_name,
    email: admin_email,
    password_hash: hashPassword(password),
    role: 'Admin',
    tenant_id: tenantId,
  });

  return c.redirect(buildTenantLoginUrl(subdomain, admin_email));
});