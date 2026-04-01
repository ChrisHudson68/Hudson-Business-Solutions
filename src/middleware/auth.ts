import { createMiddleware } from 'hono/factory';
import { getCookie, deleteCookie } from 'hono/cookie';
import { getSessionUserId, SESSION_COOKIE_NAME } from '../services/session.js';
import { getDb } from '../db/connection.js';
import { getEnv } from '../config/env.js';
import type { TenantVariables } from './tenant.js';
import {
  getResolvedUserPermissions,
  hasAllPermissions,
  hasAnyPermission,
  normalizeUserRole,
} from '../services/permissions.js';

export type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  tenant_id: number;
  permissions: string[];
};

export type AuthVariables = {
  user: AuthenticatedUser | null;
};

function resolveUser(
  cookieValue: string | undefined,
  secretKey: string,
  tenantId: number | undefined,
): AuthenticatedUser | null {
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

  const normalizedRole = normalizeUserRole(row.role);
  const resolvedPermissions = getResolvedUserPermissions(normalizedRole, row.tenant_id, row.id, db);

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: normalizedRole,
    tenant_id: row.tenant_id,
    permissions: resolvedPermissions.permissions,
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

function resolveRequestUser(c: any): AuthenticatedUser | null {
  const env = getEnv();
  const cookie = getCookie(c, SESSION_COOKIE_NAME);

  if (!cookie) {
    return null;
  }

  const tenant = c.get('tenant');
  const tenantId = tenant?.id;
  const user = resolveUser(cookie, env.secretKey, tenantId);

  if (!user) {
    clearSessionCookie(c);
    return null;
  }

  c.set('user', user);
  return user;
}

export const loginRequired = createMiddleware<{
  Variables: AuthVariables & TenantVariables;
}>(async (c, next) => {
  const user = resolveRequestUser(c);

  if (!user) {
    return c.redirect('/login');
  }

  await next();
});

export function roleRequired(...roles: string[]) {
  return createMiddleware<{ Variables: AuthVariables & TenantVariables }>(async (c, next) => {
    const user = resolveRequestUser(c);

    if (!user) {
      return c.redirect('/login');
    }

    const normalizedAllowedRoles = roles.map((role) => normalizeUserRole(role));

    if (!normalizedAllowedRoles.includes(normalizeUserRole(user.role))) {
      return c.text('Forbidden (insufficient role access)', 403);
    }

    await next();
  });
}

export function permissionRequired(...permissions: string[]) {
  return createMiddleware<{ Variables: AuthVariables & TenantVariables }>(async (c, next) => {
    const user = resolveRequestUser(c);

    if (!user) {
      return c.redirect('/login');
    }

    if (!hasAllPermissions(user.permissions, permissions as any)) {
      return c.text('Forbidden (insufficient permissions)', 403);
    }

    await next();
  });
}

export function anyPermissionRequired(...permissions: string[]) {
  return createMiddleware<{ Variables: AuthVariables & TenantVariables }>(async (c, next) => {
    const user = resolveRequestUser(c);

    if (!user) {
      return c.redirect('/login');
    }

    if (!hasAnyPermission(user.permissions, permissions as any)) {
      return c.text('Forbidden (insufficient permissions)', 403);
    }

    await next();
  });
}

export function userHasPermission(user: AuthenticatedUser | null | undefined, permission: string): boolean {
  if (!user) return false;
  return user.permissions.includes(permission);
}
