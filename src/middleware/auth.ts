import { createMiddleware } from 'hono/factory';
import { getCookie, deleteCookie } from 'hono/cookie';
import {
  extractBearerToken,
  getSessionUserId,
  hashMobileApiToken,
  SESSION_COOKIE_NAME,
} from '../services/session.js';
import { getDb } from '../db/connection.js';
import { getEnv } from '../config/env.js';
import type { TenantVariables } from './tenant.js';
import * as mobileApiTokens from '../db/queries/mobile-api-tokens.js';
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

function resolveUserFromSessionCookie(
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

function resolveUserFromBearerToken(
  authorizationHeader: string | undefined,
  secretKey: string,
  tenantId: number | undefined,
): AuthenticatedUser | null {
  const token = extractBearerToken(authorizationHeader);
  if (!token) return null;

  const db = getDb();
  const tokenHash = hashMobileApiToken(token, secretKey);
  const row = mobileApiTokens.findActiveUserByTokenHash(db, tokenHash);

  if (!row) return null;
  if (row.active !== 1) return null;
  if (tenantId !== undefined && row.tenant_id !== tenantId) return null;

  mobileApiTokens.touchLastUsed(db, row.token_id);

  const normalizedRole = normalizeUserRole(row.role);
  const resolvedPermissions = getResolvedUserPermissions(normalizedRole, row.tenant_id, row.user_id, db);

  return {
    id: row.user_id,
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

export function resolveRequestUser(c: any): AuthenticatedUser | null {
  const cachedUser = c.get('user');
  if (cachedUser) {
    return cachedUser;
  }

  const env = getEnv();
  const tenant = c.get('tenant');
  const tenantId = tenant?.id;

  const cookie = getCookie(c, SESSION_COOKIE_NAME);
  if (cookie) {
    const userFromCookie = resolveUserFromSessionCookie(cookie, env.secretKey, tenantId);

    if (userFromCookie) {
      c.set('user', userFromCookie);
      return userFromCookie;
    }

    clearSessionCookie(c);
  }

  const userFromBearer = resolveUserFromBearerToken(
    c.req.header('Authorization'),
    env.secretKey,
    tenantId,
  );

  if (userFromBearer) {
    c.set('user', userFromBearer);
    return userFromBearer;
  }

  return null;
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