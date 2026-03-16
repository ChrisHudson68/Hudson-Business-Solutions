import type { BillingStatus } from '../db/types.js';

export type BillingTenantLike = {
  billing_exempt: number;
  billing_status: string;
  billing_trial_ends_at: string | null;
  billing_grace_ends_at: string | null;
};

export type BillingBlockReason =
  | 'trial-ended'
  | 'grace-ended'
  | 'subscription-canceled'
  | 'payment-required';

export type BillingAccessResult = {
  allowed: boolean;
  effectiveStatus:
    | 'exempt'
    | 'internal'
    | 'active'
    | 'trialing'
    | 'past_due'
    | 'canceled'
    | 'incomplete';
  reason?: BillingBlockReason;
};

function parseDate(value: string | null | undefined): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const parsed = new Date(raw.includes('T') ? raw : `${raw}T23:59:59Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

export function hasFutureDate(value: string | null | undefined): boolean {
  const parsed = parseDate(value);
  return !!parsed && parsed.getTime() >= Date.now();
}

export function isLegacyGrandfatheredTenant(tenant: BillingTenantLike): boolean {
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

export function getBillingAccess(tenant: BillingTenantLike): BillingAccessResult {
  if (Number(tenant.billing_exempt || 0) === 1) {
    return {
      allowed: true,
      effectiveStatus: 'exempt',
    };
  }

  if (isLegacyGrandfatheredTenant(tenant)) {
    return {
      allowed: true,
      effectiveStatus: 'trialing',
    };
  }

  const status = String(tenant.billing_status || 'trialing').trim().toLowerCase() as BillingStatus;

  if (status === 'internal') {
    return {
      allowed: true,
      effectiveStatus: 'internal',
    };
  }

  if (status === 'active') {
    return {
      allowed: true,
      effectiveStatus: 'active',
    };
  }

  if (status === 'trialing') {
    if (hasFutureDate(tenant.billing_trial_ends_at)) {
      return {
        allowed: true,
        effectiveStatus: 'trialing',
      };
    }

    return {
      allowed: false,
      effectiveStatus: 'trialing',
      reason: 'trial-ended',
    };
  }

  if (status === 'past_due') {
    if (hasFutureDate(tenant.billing_grace_ends_at)) {
      return {
        allowed: true,
        effectiveStatus: 'past_due',
      };
    }

    return {
      allowed: false,
      effectiveStatus: 'past_due',
      reason: 'grace-ended',
    };
  }

  if (status === 'canceled') {
    return {
      allowed: false,
      effectiveStatus: 'canceled',
      reason: 'subscription-canceled',
    };
  }

  return {
    allowed: false,
    effectiveStatus: 'incomplete',
    reason: 'payment-required',
  };
}