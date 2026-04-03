import { resolveEffectiveBillingState } from './billing-access.js';

export type BillingBannerTenantLike = {
  billing_exempt?: number;
  billing_status?: string;
  billing_trial_ends_at?: string | null;
  billing_grace_ends_at?: string | null;
  billing_state?: string | null;
  billing_grace_until?: string | null;
};

export type BillingBanner = {
  tone: 'info' | 'warn' | 'bad';
  title: string;
  message: string;
};

function parseDate(value: string | null | undefined): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  let normalized = raw;
  if (!raw.includes('T')) {
    normalized = `${raw}T23:59:59.999Z`;
  } else if (!/[zZ]|[+-]\d\d:\d\d$/.test(raw)) {
    normalized = `${raw}Z`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function daysUntil(value: string | null | undefined): number | null {
  const parsed = parseDate(value);
  if (!parsed) return null;

  return Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(value: string | null | undefined): string {
  const parsed = parseDate(value);
  if (!parsed) return 'Not set';

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function dayLabel(remaining: number, singular: string, plural: string): string {
  if (remaining <= 0) return singular;
  if (remaining === 1) return '1 day';
  return `${remaining} ${plural}`;
}

export function getBillingBanner(tenant: BillingBannerTenantLike | null | undefined): BillingBanner | null {
  if (!tenant) return null;

  const effective = resolveEffectiveBillingState({
    billing_exempt: Number(tenant.billing_exempt || 0),
    billing_status: String(tenant.billing_status || 'trialing'),
    billing_trial_ends_at: tenant.billing_trial_ends_at || null,
    billing_grace_ends_at: tenant.billing_grace_ends_at || null,
    billing_state: tenant.billing_state || null,
    billing_grace_until: tenant.billing_grace_until || null,
  });

  if (effective === 'exempt' || effective === 'internal' || effective === 'active') {
    return null;
  }

  if (effective === 'trialing') {
    const remaining = daysUntil(tenant.billing_trial_ends_at);
    if (remaining === null) return null;

    if (remaining < 0) {
      return {
        tone: 'bad',
        title: 'Trial ended',
        message: 'Your workspace trial has ended. Add billing to restore full access.',
      };
    }

    if (remaining <= 7) {
      return {
        tone: remaining <= 3 ? 'warn' : 'info',
        title: remaining <= 0 ? 'Trial ends today' : `Trial ends in ${dayLabel(remaining, 'today', 'days')}`,
        message: `Your workspace trial ends on ${formatDate(tenant.billing_trial_ends_at)}. Add billing now to avoid interruption.`,
      };
    }

    return null;
  }

  if (effective === 'past_due') {
    const remaining = daysUntil(tenant.billing_grace_until);

    if (remaining === null) {
      return {
        tone: 'warn',
        title: 'Payment past due',
        message: 'This workspace is marked past due. Update billing to avoid interruption.',
      };
    }

    if (remaining < 0) {
      return {
        tone: 'bad',
        title: 'Grace period expired',
        message: 'The billing grace period has expired. Update billing now to avoid suspension.',
      };
    }

    return {
      tone: remaining <= 3 ? 'bad' : 'warn',
      title: remaining <= 0 ? 'Payment issue must be fixed today' : `Payment past due — ${dayLabel(remaining, 'today', 'days')} left`,
      message: `The current billing grace window ends on ${formatDate(tenant.billing_grace_until)}. Update the payment method to avoid suspension.`,
    };
  }

  if (effective === 'grace_period') {
    const remaining = daysUntil(tenant.billing_grace_until);

    if (remaining === null) {
      return {
        tone: 'warn',
        title: 'Grace period active',
        message: 'This workspace is in a temporary grace period. Update billing before access is restricted.',
      };
    }

    if (remaining < 0) {
      return {
        tone: 'bad',
        title: 'Grace period expired',
        message: 'This workspace grace period has expired. Update billing now to restore access.',
      };
    }

    return {
      tone: remaining <= 3 ? 'bad' : 'warn',
      title: remaining <= 0 ? 'Grace period ends today' : `Grace period — ${dayLabel(remaining, 'today', 'days')} left`,
      message: `This workspace grace period ends on ${formatDate(tenant.billing_grace_until)}. Update billing before access is restricted.`,
    };
  }

  if (effective === 'canceled') {
    return {
      tone: 'bad',
      title: 'Subscription canceled',
      message: 'This workspace subscription has been canceled. Restart billing to continue access.',
    };
  }

  if (effective === 'suspended') {
    return {
      tone: 'bad',
      title: 'Workspace suspended',
      message: 'This workspace has been suspended for billing reasons. Only billing recovery actions remain available.',
    };
  }

  return null;
}
