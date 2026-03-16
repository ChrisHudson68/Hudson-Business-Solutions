import Stripe from 'stripe';
import { getEnv } from '../config/env.js';
import type { BillingStatus } from '../db/types.js';

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