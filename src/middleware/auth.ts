import { createMiddleware } from 'hono/factory';
import { getCookie, deleteCookie } from 'hono/cookie';
import { getSessionUserId, SESSION_COOKIE_NAME } from '../services/session.js';
import { getDb } from '../db/connection.js';
import { getEnv } from '../config/env.js';
import type { TenantVariables } from './tenant.js';

export type AuthVariables = {
  user: { id: number; name: string; email: string; role: string; tenant_id: number } | null;
};

function resolveUser(
  cookieValue: string | undefined,
  secretKey: string,
  tenantId: number | undefined,
): { id: number; name: string; email: string; role: string; tenant_id: number } | null {
  if (!cookieValue) return null;

  const userId = getSessionUserId(cookieValue, secretKey);
  if (userId === null) return null;

  const db = getDb();
  const row = db
    .prepare('SELECT id, name, email, role, active, tenant_id FROM users WHERE id = ?')
    .get(userId) as
    | { id: number; name: string; email: string; role: string; active: number; tenant_id: number }
    | undefined;

  if (!row) return null;
  if (row.active !== 1) return null;
  if (tenantId !== undefined && row.tenant_id !== tenantId) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    tenant_id: row.tenant_id,
  };
}

function clearSessionCookie(c: any) {
  const env = getEnv();

  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: '/',
    secure: env.isProduction,
    sameSite: 'Lax',
    httpOnly: true,
  });
}

export const loginRequired = createMiddleware<{
  Variables: AuthVariables & TenantVariables;
}>(async (c, next) => {
  const env = getEnv();
  const cookie = getCookie(c, SESSION_COOKIE_NAME);

  if (!cookie) {
    return c.redirect('/login');
  }

  const tenant = c.get('tenant');
  const tenantId = tenant?.id;
  const user = resolveUser(cookie, env.secretKey, tenantId);

  if (!user) {
    clearSessionCookie(c);
    return c.redirect('/login');
  }

  c.set('user', user);
  await next();
});

export function roleRequired(...roles: string[]) {
  return createMiddleware<{ Variables: AuthVariables & TenantVariables }>(async (c, next) => {
    const env = getEnv();
    const cookie = getCookie(c, SESSION_COOKIE_NAME);

    if (!cookie) {
      return c.redirect('/login');
    }

    const tenant = c.get('tenant');
    const tenantId = tenant?.id;
    const user = resolveUser(cookie, env.secretKey, tenantId);

    if (!user) {
      clearSessionCookie(c);
      return c.redirect('/login');
    }

    if (!roles.includes(user.role)) {
      return c.text('Forbidden (insufficient permissions)', 403);
    }

    c.set('user', user);
    await next();
  });
}