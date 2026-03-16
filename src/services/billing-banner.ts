export type BillingBannerTenantLike = {
  billing_exempt?: number;
  billing_status?: string;
  billing_trial_ends_at?: string | null;
  billing_grace_ends_at?: string | null;
};

export type BillingBanner = {
  tone: 'info' | 'warn' | 'bad';
  title: string;
  message: string;
};

function parseDate(value: string | null | undefined): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const parsed = new Date(raw.includes('T') ? raw : `${raw}T23:59:59Z`);
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

export function getBillingBanner(tenant: BillingBannerTenantLike | null | undefined): BillingBanner | null {
  if (!tenant) return null;
  if (Number(tenant.billing_exempt || 0) === 1) return null;

  const status = String(tenant.billing_status || 'trialing').trim().toLowerCase();

  if (status === 'internal' || status === 'active') {
    return null;
  }

  if (status === 'trialing') {
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
        title: `Trial ends in ${remaining} day${remaining === 1 ? '' : 's'}`,
        message: `Your workspace trial ends on ${formatDate(tenant.billing_trial_ends_at)}. Add billing to avoid interruption.`,
      };
    }

    return null;
  }

  if (status === 'past_due') {
    const remaining = daysUntil(tenant.billing_grace_ends_at);

    if (remaining === null) {
      return {
        tone: 'warn',
        title: 'Payment past due',
        message: 'Your workspace has a past-due payment. Update billing to avoid interruption.',
      };
    }

    if (remaining < 0) {
      return {
        tone: 'bad',
        title: 'Grace period expired',
        message: 'Your billing grace period has ended. Update billing to restore access.',
      };
    }

    return {
      tone: remaining <= 3 ? 'bad' : 'warn',
      title: `Payment past due — ${remaining} day${remaining === 1 ? '' : 's'} left`,
      message: `Your grace period ends on ${formatDate(tenant.billing_grace_ends_at)}. Update billing to avoid interruption.`,
    };
  }

  if (status === 'canceled') {
    return {
      tone: 'bad',
      title: 'Subscription canceled',
      message: 'This workspace subscription has been canceled. Restart billing to continue access.',
    };
  }

  if (status === 'incomplete') {
    return {
      tone: 'warn',
      title: 'Billing setup incomplete',
      message: 'Billing setup is incomplete. Finish checkout to continue using the workspace without interruption.',
    };
  }

  return null;
}