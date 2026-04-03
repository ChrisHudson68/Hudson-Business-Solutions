import Stripe from 'stripe';
import { getEnv } from '../config/env.js';
import type { DB } from '../db/connection.js';
import * as tenantQueries from '../db/queries/tenants.js';
import type { BillingStatus, Tenant } from '../db/types.js';

let stripeClient: Stripe | null = null;

export type BillingResyncResult =
  | { ok: true; source: 'subscription' | 'customer'; status: string }
  | { ok: false; code: 'stripe-disabled' | 'no-remote-record' | 'customer-not-found' | 'subscription-not-found' };

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

export function mapStripeBillingState(status: Stripe.Subscription.Status | string | null | undefined): string {
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

function getObjectStringId(value: string | Stripe.Customer | Stripe.DeletedCustomer | Stripe.Subscription | Stripe.Invoice | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

function pickBestSubscription(subscriptions: Stripe.ApiList<Stripe.Subscription>): Stripe.Subscription | null {
  if (!subscriptions.data.length) return null;

  const sorted = [...subscriptions.data].sort((a, b) => {
    const aCanceled = a.status === 'canceled' ? 1 : 0;
    const bCanceled = b.status === 'canceled' ? 1 : 0;
    if (aCanceled !== bCanceled) return aCanceled - bCanceled;
    return (b.created || 0) - (a.created || 0);
  });

  return sorted[0] || null;
}

export function applyStripeSubscriptionToTenant(db: DB, tenantId: number, subscription: Stripe.Subscription): void {
  const env = getEnv();
  const normalizedStatus = String(subscription.status || '').trim().toLowerCase();
  const graceUntil = normalizedStatus === 'past_due'
    ? addGracePeriodDaysFromNow(env.stripeGracePeriodDays)
    : null;

  tenantQueries.updateBillingState(db, tenantId, {
    billing_plan: 'pro',
    billing_customer_id: getObjectStringId(subscription.customer),
    billing_subscription_id: subscription.id,
    billing_subscription_status: subscription.status,
    billing_status: mapStripeSubscriptionStatus(subscription.status),
    billing_trial_ends_at: unixToSqliteUtcTimestamp(subscription.trial_end),
    billing_grace_ends_at: graceUntil,
    billing_state: mapStripeBillingState(subscription.status),
    billing_grace_until: graceUntil,
  });
}

export async function resyncTenantBillingFromStripe(
  db: DB,
  tenant: Pick<Tenant, 'id' | 'billing_customer_id' | 'billing_subscription_id'>,
): Promise<BillingResyncResult> {
  if (!isStripeEnabled()) {
    return { ok: false, code: 'stripe-disabled' };
  }

  const stripe = getStripeClient();

  if (tenant.billing_subscription_id) {
    try {
      const subscription = await stripe.subscriptions.retrieve(tenant.billing_subscription_id);
      applyStripeSubscriptionToTenant(db, tenant.id, subscription);
      return { ok: true, source: 'subscription', status: subscription.status };
    } catch (error: any) {
      const message = String(error?.message || '');
      if (!/no such subscription/i.test(message)) {
        throw error;
      }

      tenantQueries.updateBillingState(db, tenant.id, {
        billing_subscription_id: null,
        billing_subscription_status: null,
      });
    }
  }

  if (!tenant.billing_customer_id) {
    return { ok: false, code: 'no-remote-record' };
  }

  try {
    const customer = await stripe.customers.retrieve(tenant.billing_customer_id);
    if ('deleted' in customer && customer.deleted) {
      tenantQueries.updateBillingState(db, tenant.id, {
        billing_customer_id: null,
        billing_subscription_id: null,
        billing_subscription_status: null,
      });
      return { ok: false, code: 'customer-not-found' };
    }
  } catch (error: any) {
    const message = String(error?.message || '');
    if (!/no such customer/i.test(message)) {
      throw error;
    }

    tenantQueries.updateBillingState(db, tenant.id, {
      billing_customer_id: null,
      billing_subscription_id: null,
      billing_subscription_status: null,
    });
    return { ok: false, code: 'customer-not-found' };
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: tenant.billing_customer_id,
    status: 'all',
    limit: 10,
  });

  const best = pickBestSubscription(subscriptions);
  if (!best) {
    return { ok: false, code: 'subscription-not-found' };
  }

  applyStripeSubscriptionToTenant(db, tenant.id, best);
  return { ok: true, source: 'customer', status: best.status };
}
