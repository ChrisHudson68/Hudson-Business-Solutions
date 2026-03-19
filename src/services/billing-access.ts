import type { BillingStatus } from '../db/types.js';

export type AdvancedBillingState =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'grace_period'
  | 'suspended'
  | 'canceled'
  | 'internal'
  | 'billing_exempt';

export type BillingTenantLike = {
  billing_exempt: number;
  billing_status: string;
  billing_trial_ends_at: string | null;
  billing_grace_ends_at: string | null;
  billing_state?: string | null;
  billing_grace_until?: string | null;
};

export type BillingBlockReason =
  | 'trial-ended'
  | 'grace-ended'
  | 'subscription-canceled'
  | 'workspace-suspended'
  | 'payment-required';

export type BillingAccessResult = {
  allowed: boolean;
  effectiveStatus:
    | 'exempt'
    | 'internal'
    | 'active'
    | 'trialing'
    | 'past_due'
    | 'grace_period'
    | 'canceled'
    | 'suspended'
    | 'incomplete';
  reason?: BillingBlockReason;
};

/* -------------------- Helpers -------------------- */

function parseDate(value: string | null | undefined): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const normalized = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

export function hasFutureDate(value: string | null | undefined): boolean {
  const parsed = parseDate(value);
  return !!parsed && parsed.getTime() >= Date.now();
}

function normalizeAdvancedState(value: string | null | undefined): AdvancedBillingState | null {
  const normalized = String(value || '').trim().toLowerCase();

  switch (normalized) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'grace_period':
    case 'suspended':
    case 'canceled':
    case 'internal':
    case 'billing_exempt':
      return normalized;
    default:
      return null;
  }
}

/* -------------------- NEW AUTHORITATIVE LOGIC -------------------- */

export function resolveEffectiveBillingState(
  tenant: BillingTenantLike,
): Exclude<BillingAccessResult['effectiveStatus'], 'exempt' | 'incomplete'> | 'exempt' {

  // ⭐ FIRST: Advanced billing state (authoritative)
  const advanced = normalizeAdvancedState(tenant.billing_state);

  if (advanced === 'billing_exempt') return 'exempt';
  if (advanced) return advanced;

  // ⭐ SECOND: Legacy exempt/internal flags
  if (Number(tenant.billing_exempt || 0) === 1) {
    return 'exempt';
  }

  const legacy = String(tenant.billing_status || 'trialing').trim().toLowerCase() as BillingStatus;

  if (legacy === 'internal') return 'internal';
  if (legacy === 'active') return 'active';
  if (legacy === 'trialing') return 'trialing';
  if (legacy === 'past_due') return 'past_due';
  if (legacy === 'canceled') return 'canceled';

  return 'trialing';
}

/* -------------------- Access Rules -------------------- */

export function getBillingAccess(tenant: BillingTenantLike): BillingAccessResult {
  const effective = resolveEffectiveBillingState(tenant);

  if (effective === 'exempt') {
    return { allowed: true, effectiveStatus: 'exempt' };
  }

  if (effective === 'internal') {
    return { allowed: true, effectiveStatus: 'internal' };
  }

  if (effective === 'active') {
    return { allowed: true, effectiveStatus: 'active' };
  }

  if (effective === 'trialing') {
    if (hasFutureDate(tenant.billing_trial_ends_at)) {
      return { allowed: true, effectiveStatus: 'trialing' };
    }

    return {
      allowed: false,
      effectiveStatus: 'trialing',
      reason: 'trial-ended',
    };
  }

  if (effective === 'past_due') {
    return { allowed: true, effectiveStatus: 'past_due' };
  }

  if (effective === 'grace_period') {
    if (!tenant.billing_grace_until || hasFutureDate(tenant.billing_grace_until)) {
      return { allowed: true, effectiveStatus: 'grace_period' };
    }

    return {
      allowed: false,
      effectiveStatus: 'grace_period',
      reason: 'grace-ended',
    };
  }

  if (effective === 'suspended') {
    return {
      allowed: false,
      effectiveStatus: 'suspended',
      reason: 'workspace-suspended',
    };
  }

  if (effective === 'canceled') {
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