import { createMiddleware } from 'hono/factory';
import { getCookie, deleteCookie } from 'hono/cookie';
import { getEnv } from '../config/env.js';
import {
  PLATFORM_ADMIN_COOKIE_NAME,
  getPlatformAdminEmail,
} from '../services/platform-admin-session.js';
import { isPlatformAdminConfigured } from '../services/platform-admin-auth.js';
import type { TenantVariables } from './tenant.js';

export type PlatformAdminVariables = {
  platformAdmin: { email: string } | null;
};

function clearPlatformAdminCookie(c: any) {
  const env = getEnv();

  deleteCookie(c, PLATFORM_ADMIN_COOKIE_NAME, {
    path: '/',
    secure: env.isProduction,
    sameSite: 'Lax',
    httpOnly: true,
  });
}

export const platformAdminRequired = createMiddleware<{
  Variables: PlatformAdminVariables & TenantVariables;
}>(async (c, next) => {
  const env = getEnv();
  const subdomain = c.get('subdomain');

  if (subdomain) {
    return c.text('Not found', 404);
  }

  if (!isPlatformAdminConfigured(env)) {
    return c.text('Platform admin portal is not configured.', 503);
  }

  const cookie = getCookie(c, PLATFORM_ADMIN_COOKIE_NAME);
  if (!cookie) {
    return c.redirect('/admin/login');
  }

  const email = getPlatformAdminEmail(cookie, env.secretKey);
  if (!email || email !== env.platformAdminEmail) {
    clearPlatformAdminCookie(c);
    return c.redirect('/admin/login');
  }

  c.set('platformAdmin', { email });
  await next();
});
