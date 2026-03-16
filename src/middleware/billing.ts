import { createMiddleware } from 'hono/factory';
import { getBillingAccess } from '../services/billing-access.js';

const BILLING_ALLOWED_PREFIXES = [
  '/billing',
  '/logout',
];

function isAllowedPath(path: string): boolean {
  return BILLING_ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export const billingRequired = createMiddleware(async (c, next) => {
  const tenant = c.get('tenant');
  const user = c.get('user');

  if (!tenant || !user) {
    await next();
    return;
  }

  if (isAllowedPath(c.req.path)) {
    await next();
    return;
  }

  const access = getBillingAccess({
    billing_exempt: tenant.billing_exempt,
    billing_status: tenant.billing_status,
    billing_trial_ends_at: tenant.billing_trial_ends_at,
    billing_grace_ends_at: tenant.billing_grace_ends_at,
  });

  if (access.allowed) {
    await next();
    return;
  }

  return c.redirect(`/billing?reason=${encodeURIComponent(access.reason || 'payment-required')}`);
});