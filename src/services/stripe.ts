import Stripe from 'stripe';
import { getEnv } from '../config/env.js';
import type { BillingStatus, Tenant } from '../db/types.js';
import type { DB } from '../db/connection.js';
import * as tenantQueries from '../db/queries/tenants.js';

let stripeClient: Stripe | null = null;

export function isStripeEnabled(): boolean {
  return getEnv().stripeEnabled;
}

export function isStripePortalEnabled(): boolean {
  const env = getEnv();
  return env.stripeEnabled && env.stripeBillingPortalEnabled;
}

export function getStripeModeLabel(): string {
  const env = getEnv();

  if (!env.stripeEnabled) {
    return 'Disabled';
  }

  if (env.stripeSecretKey.startsWith('sk_test_')) {
    return 'Test Mode';
  }

  return 'Live Mode';
}

export function getStripePlanLabel(): string {
  return getEnv().stripeProPlanLabel;
}

export function getStripePriceId(): string {
  return getEnv().stripePriceProMonthly;
}

export function getStripeClient(): Stripe {
  const env = getEnv();

  if (!env.stripeEnabled) {
    throw new Error('Stripe is disabled.');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.stripeSecretKey, {});
  }

  return stripeClient;
}

export function verifyStripeWebhookEvent(payload: string, signature: string): Stripe.Event {
  const env = getEnv();

  if (!env.stripeEnabled) {
    throw new Error('Stripe is disabled.');
  }

  if (!env.stripeWebhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  }

  return getStripeClient().webhooks.constructEvent(payload, signature, env.stripeWebhookSecret);
}

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status | string | null | undefined,
): BillingStatus {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'active') return 'active';
  if (normalized === 'trialing') return 'trialing';
  if (normalized === 'past_due') return 'past_due';
  if (normalized === 'canceled' || normalized === 'unpaid' || normalized === 'paused') return 'canceled';

  return 'incomplete';
}

export function mapStripeAdvancedBillingState(
  status: Stripe.Subscription.Status | string | null | undefined,
): string {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'active') return 'active';
  if (normalized === 'trialing') return 'trialing';
  if (normalized === 'past_due') return 'grace_period';
  if (normalized === 'canceled' || normalized === 'unpaid' || normalized === 'paused') return 'canceled';

  return 'suspended';
}

export function toSqliteUtcTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function unixToSqliteUtcTimestamp(value: number | null | undefined): string | null {
  if (!value || !Number.isFinite(value)) return null;
  return toSqliteUtcTimestamp(new Date(value * 1000));
}

export function addGracePeriodDaysFromNow(days: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + days);
  return toSqliteUtcTimestamp(now);
}

function getCustomerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

function pickBestSubscription(subscriptions: Stripe.ApiList<Stripe.Subscription>): Stripe.Subscription | null {
  if (!subscriptions.data.length) return null;

  const ranked = [...subscriptions.data].sort((a, b) => {
    const aRank = a.status === 'active' ? 0 : a.status === 'trialing' ? 1 : a.status === 'past_due' ? 2 : 3;
    const bRank = b.status === 'active' ? 0 : b.status === 'trialing' ? 1 : b.status === 'past_due' ? 2 : 3;
    if (aRank !== bRank) return aRank - bRank;
    return (b.created || 0) - (a.created || 0);
  });

  return ranked[0] || null;
}

function buildSubscriptionPatch(subscription: Stripe.Subscription, graceDays: number) {
  const normalizedStatus = String(subscription.status || '').trim().toLowerCase();
  const graceUntil = normalizedStatus === 'past_due'
    ? addGracePeriodDaysFromNow(graceDays)
    : null;

  return {
    billing_plan: 'pro',
    billing_customer_id: getCustomerId(subscription.customer),
    billing_subscription_id: subscription.id,
    billing_subscription_status: subscription.status,
    billing_status: mapStripeSubscriptionStatus(subscription.status),
    billing_trial_ends_at: unixToSqliteUtcTimestamp(subscription.trial_end),
    billing_grace_ends_at: graceUntil,
    billing_state: mapStripeAdvancedBillingState(subscription.status),
    billing_grace_until: graceUntil,
  } as const;
}

export async function resyncTenantBillingFromStripe(
  db: DB,
  tenantOrId: number | (Tenant & { billing_state?: string | null; billing_grace_until?: string | null }),
): Promise<{
  outcome: 'synced' | 'skipped';
  reason:
    | 'subscription'
    | 'customer-without-subscription'
    | 'billing-exempt'
    | 'stripe-ids-missing';
  tenantId: number;
  subscriptionId: string | null;
  customerId: string | null;
  status: string | null;
}> {
  if (!isStripeEnabled()) {
    throw new Error('Stripe is disabled.');
  }

  const tenant = typeof tenantOrId === 'number'
    ? tenantQueries.findById(db, tenantOrId)
    : tenantOrId;

  if (!tenant) {
    throw new Error('Tenant not found.');
  }

  const billingState = String(tenant.billing_state || '').trim().toLowerCase();

  if (
    Number(tenant.billing_exempt || 0) === 1
    || billingState === 'billing_exempt'
    || billingState === 'internal'
  ) {
    return {
      outcome: 'skipped',
      reason: 'billing-exempt',
      tenantId: tenant.id,
      subscriptionId: tenant.billing_subscription_id || null,
      customerId: tenant.billing_customer_id || null,
      status: tenant.billing_subscription_status || tenant.billing_status || null,
    };
  }

  const stripe = getStripeClient();
  let customerId = tenant.billing_customer_id || null;
  let subscriptionId = tenant.billing_subscription_id || null;
  let subscription: Stripe.Subscription | null = null;

  if (subscriptionId) {
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
      customerId = getCustomerId(subscription.customer) || customerId;
    } catch (error: any) {
      const message = String(error?.message || '');
      if (/no such subscription/i.test(message)) {
        subscriptionId = null;
      } else {
        throw error;
      }
    }
  }

  if (!subscription && customerId) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 10,
      });
      subscription = pickBestSubscription(subscriptions);
      subscriptionId = subscription?.id || null;
    } catch (error: any) {
      const message = String(error?.message || '');
      if (/no such customer/i.test(message)) {
        customerId = null;
      } else {
        throw error;
      }
    }
  }

  if (!subscription && !customerId) {
    tenantQueries.updateBillingState(db, tenant.id, {
      billing_customer_id: null,
      billing_subscription_id: null,
      billing_subscription_status: null,
    });

    return {
      outcome: 'skipped',
      reason: 'stripe-ids-missing',
      tenantId: tenant.id,
      subscriptionId: null,
      customerId: null,
      status: null,
    };
  }

  if (!subscription && customerId) {
    tenantQueries.updateBillingState(db, tenant.id, {
      billing_customer_id: customerId,
      billing_subscription_id: null,
      billing_subscription_status: null,
      billing_state: 'suspended',
      billing_status: 'incomplete',
      billing_grace_ends_at: null,
      billing_grace_until: null,
    });

    return {
      outcome: 'skipped',
      reason: 'customer-without-subscription',
      tenantId: tenant.id,
      subscriptionId: null,
      customerId,
      status: null,
    };
  }

  const patch = buildSubscriptionPatch(subscription, getEnv().stripeGracePeriodDays);
  tenantQueries.updateBillingState(db, tenant.id, patch);

  return {
    outcome: 'synced',
    reason: 'subscription',
    tenantId: tenant.id,
    subscriptionId: subscription.id,
    customerId: patch.billing_customer_id,
    status: subscription.status,
  };
}
