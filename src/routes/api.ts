import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getEnv } from '../config/env.js';
import { resolveRequestUser } from '../middleware/auth.js';

export const apiRoutes = new Hono<AppEnv>();

apiRoutes.get('/api/health', (c) => {
  const env = getEnv();

  return c.json({
    ok: true,
    service: 'mobile-api',
    app: env.appName,
    env: env.nodeEnv,
  });
});

apiRoutes.get('/api/me', (c) => {
  const user = c.get('user') ?? resolveRequestUser(c);
  const tenant = c.get('tenant');

  if (!user || !tenant) {
    return c.json(
      {
        ok: false,
        error: 'unauthorized',
      },
      401,
    );
  }

  return c.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      logoPath: tenant.logo_path,
    },
  });
});