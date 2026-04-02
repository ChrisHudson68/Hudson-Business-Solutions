import { createMiddleware } from 'hono/factory';
import { resolveRequestUser } from './auth.js';
import { getBillingAccess } from '../services/billing-access.js';

const BILLING_ALLOWED_PREFIXES = [
  '/billing',
  '/logout',
  '/login',
  '/static',
  '/healthz',
];

function isAllowedPath(path: string): boolean {
  return BILLING_ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export const billingRequired = createMiddleware(async (c, next) => {
  if (isAllowedPath(c.req.path)) {
    await next();
    return;
  }

  const tenant = c.get('tenant');
  if (!tenant) {
    await next();
    return;
  }

  const user = c.get('user') ?? resolveRequestUser(c);
  if (!user) {
    await next();
    return;
  }

  const access = getBillingAccess({
    billing_exempt: tenant.billing_exempt,
    billing_status: tenant.billing_status,
    billing_trial_ends_at: tenant.billing_trial_ends_at,
    billing_grace_ends_at: tenant.billing_grace_ends_at,
    billing_state: tenant.billing_state || null,
    billing_grace_until: tenant.billing_grace_until || null,
  });

  if (access.allowed) {
    await next();
    return;
  }

  return c.redirect(
    `/billing?reason=${encodeURIComponent(access.reason || 'payment-required')}`,
  );
});
