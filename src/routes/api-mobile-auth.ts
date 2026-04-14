import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import * as userQueries from '../db/queries/users.js';
import * as mobileApiTokens from '../db/queries/mobile-api-tokens.js';
import { getEnv } from '../config/env.js';
import { resolveRequestUser } from '../middleware/auth.js';
import { verifyPassword } from '../services/password.js';
import {
  createMobileApiToken,
  extractBearerToken,
  hashMobileApiToken,
} from '../services/session.js';
import {
  getResolvedUserPermissions,
  normalizeUserRole,
} from '../services/permissions.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';
import { checkRateLimit, clearRateLimit, recordRateLimitFailure } from '../services/rate-limit.js';

export const mobileAuthRoutes = new Hono<AppEnv>();

function resolveMobileApiContext(c: any) {
  const user = c.get('user') ?? resolveRequestUser(c);
  const tenant = c.get('tenant');

  if (!tenant) {
    return {
      ok: false as const,
      response: c.json(
        {
          ok: false,
          error: 'tenant_required',
        },
        400,
      ),
    };
  }

  if (!user) {
    return {
      ok: false as const,
      response: c.json(
        {
          ok: false,
          error: 'unauthorized',
        },
        401,
      ),
    };
  }

  return {
    ok: true as const,
    user,
    tenant,
  };
}

mobileAuthRoutes.post('/api/mobile/login', async (c) => {
  const tenant = c.get('tenant');

  if (!tenant) {
    return c.json(
      {
        ok: false,
        error: 'tenant_required',
      },
      400,
    );
  }

  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return c.json(
      {
        ok: false,
        error: 'email_and_password_required',
      },
      400,
    );
  }

  const db = getDb();
  const env = getEnv();
  const rateLimitScope = 'mobile-login';
  const rateLimitKey = `${tenant.id}:${email}`;

  const loginLimit = checkRateLimit(db, {
    scope: rateLimitScope,
    key: rateLimitKey,
    windowSeconds: env.authRateLimitWindowSeconds,
    maxAttempts: env.authRateLimitMaxAttempts,
    blockSeconds: env.authRateLimitBlockSeconds,
  });

  if (!loginLimit.allowed) {
    return c.json({ ok: false, error: 'too_many_attempts' }, 429);
  }

  const loginRow = userQueries.findByEmailAndTenant(db, email, tenant.id) as
    | { id: number; password_hash: string; active: number }
    | undefined;

  if (!loginRow || loginRow.active !== 1 || !verifyPassword(password, loginRow.password_hash)) {
    recordRateLimitFailure(db, {
      scope: rateLimitScope,
      key: rateLimitKey,
      windowSeconds: env.authRateLimitWindowSeconds,
      maxAttempts: env.authRateLimitMaxAttempts,
      blockSeconds: env.authRateLimitBlockSeconds,
    });
    return c.json(
      {
        ok: false,
        error: 'invalid_login',
      },
      401,
    );
  }

  clearRateLimit(db, rateLimitScope, rateLimitKey);

  const fullUser = db
    .prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE id = ? AND tenant_id = ?
      LIMIT 1
    `)
    .get(loginRow.id, tenant.id) as
    | { id: number; name: string; email: string; role: string }
    | undefined;

  if (!fullUser) {
    return c.json(
      {
        ok: false,
        error: 'invalid_login',
      },
      401,
    );
  }

  const tokenInfo = createMobileApiToken(env.secretKey);
  const expiresAt = new Date(Date.now() + env.sessionTtlSeconds * 1000).toISOString();

  mobileApiTokens.create(db, {
    tenantId: tenant.id,
    userId: fullUser.id,
    tokenHash: tokenInfo.tokenHash,
    tokenName: 'mobile-app',
    expiresAt,
  });

  const normalizedRole = normalizeUserRole(fullUser.role);
  const resolvedPermissions = getResolvedUserPermissions(
    normalizedRole,
    tenant.id,
    fullUser.id,
    db,
  );

  logActivity(db, {
    tenantId: tenant.id,
    actorUserId: fullUser.id,
    eventType: 'auth.mobile_login',
    entityType: 'user',
    entityId: fullUser.id,
    description: `${fullUser.name} signed in through the mobile API.`,
    metadata: {
      email: fullUser.email,
      role: normalizedRole,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.json({
    ok: true,
    token: tokenInfo.token,
    expiresAt,
    user: {
      id: fullUser.id,
      name: fullUser.name,
      email: fullUser.email,
      role: normalizedRole,
      permissions: resolvedPermissions.permissions,
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      logoPath: tenant.logo_path,
    },
  });
});

mobileAuthRoutes.post('/api/mobile/logout', async (c) => {
  const resolved = resolveMobileApiContext(c);
  if (!resolved.ok) {
    return resolved.response;
  }

  const { user, tenant } = resolved;
  const bearerToken = extractBearerToken(c.req.header('Authorization'));

  if (!bearerToken) {
    return c.json(
      {
        ok: false,
        error: 'bearer_token_required',
      },
      400,
    );
  }

  const db = getDb();
  const env = getEnv();
  const tokenHash = hashMobileApiToken(bearerToken, env.secretKey);
  const revoked = mobileApiTokens.revokeByTokenHash(db, tokenHash, tenant.id, user.id);

  if (revoked) {
    logActivity(db, {
      tenantId: tenant.id,
      actorUserId: user.id,
      eventType: 'auth.mobile_logout',
      entityType: 'user',
      entityId: user.id,
      description: `${user.name} signed out from the mobile API.`,
      metadata: {
        email: user.email,
        role: user.role,
      },
      ipAddress: resolveRequestIp(c),
    });
  }

  return c.json({
    ok: true,
    revoked,
  });
});