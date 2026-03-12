import { createMiddleware } from 'hono/factory';
import type { BillingStatus } from '../db/types.js';

const BILLING_ALLOWED_PREFIXES = ['/billing', '/logout'];

function isAllowedPath(path: string): boolean {
  return BILLING_ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function parseDate(value: string | null | undefined): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw.includes('T') ? raw : `${raw}T23:59:59Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hasFutureDate(value: string | null | undefined): boolean {
  const parsed = parseDate(value);
  return !!parsed && parsed.getTime() >= Date.now();
}

function isLegacyGrandfatheredTenant(tenant: {
  billing_exempt: number;
  billing_status: string;
  billing_trial_ends_at: string | null;
  billing_grace_ends_at: string | null;
}): boolean {
  if (Number(tenant.billing_exempt || 0) === 1) {
    return false;
  }

  const status = String(tenant.billing_status || 'trialing').trim().toLowerCase() as BillingStatus;

  return (
    status === 'trialing' &&
    !tenant.billing_trial_ends_at &&
    !tenant.billing_grace_ends_at
  );
}

function hasAccess(tenant: {
  billing_exempt: number;
  billing_status: string;
  billing_trial_ends_at: string | null;
  billing_grace_ends_at: string | null;
}): boolean {
  if (Number(tenant.billing_exempt || 0) === 1) {
    return true;
  }

  if (isLegacyGrandfatheredTenant(tenant)) {
    return true;
  }

  const status = String(tenant.billing_status || 'trialing').trim().toLowerCase() as BillingStatus;

  if (status === 'active' || status === 'internal') {
    return true;
  }

  if (status === 'trialing') {
    return hasFutureDate(tenant.billing_trial_ends_at);
  }

  if (status === 'past_due') {
    return hasFutureDate(tenant.billing_grace_ends_at);
  }

  return false;
}

function resolveReason(tenant: {
  billing_status: string;
  billing_trial_ends_at: string | null;
  billing_grace_ends_at: string | null;
}): string {
  const status = String(tenant.billing_status || 'trialing').trim().toLowerCase() as BillingStatus;

  if (status === 'trialing' && !hasFutureDate(tenant.billing_trial_ends_at)) {
    return 'trial-ended';
  }

  if (status === 'past_due' && !hasFutureDate(tenant.billing_grace_ends_at)) {
    return 'grace-ended';
  }

  if (status === 'canceled') {
    return 'subscription-canceled';
  }

  if (status === 'incomplete') {
    return 'payment-required';
  }

  return 'payment-required';
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

  if (hasAccess(tenant)) {
    await next();
    return;
  }

  return c.redirect(`/billing?reason=${encodeURIComponent(resolveReason(tenant))}`);
});