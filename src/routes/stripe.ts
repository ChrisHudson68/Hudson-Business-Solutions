import { Hono } from 'hono';
import Stripe from 'stripe';
import type { AppEnv } from '../app-env.js';
import { getEnv } from '../config/env.js';
import { getDb } from '../db/connection.js';
import * as tenantQueries from '../db/queries/tenants.js';
import {
  addGracePeriodDaysFromNow,
  mapStripeSubscriptionStatus,
  unixToSqliteUtcTimestamp,
  verifyStripeWebhookEvent,
} from '../services/stripe.js';

function getObjectStringId(value: string | Stripe.Customer | Stripe.Subscription | Stripe.Invoice | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

function resolveTenantFromMetadata(metadata: Record<string, string> | null | undefined): number | null {
  const raw = String(metadata?.tenant_id || '').trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  return Number.parseInt(raw, 10);
}

function syncSubscriptionToTenant(
  subscription: Stripe.Subscription,
  tenantId: number,
) {
  const db = getDb();
  const env = getEnv();

  tenantQueries.updateBillingState(db, tenantId, {
    billing_plan: 'pro',
    billing_customer_id: getObjectStringId(subscription.customer),
    billing_subscription_id: subscription.id,
    billing_subscription_status: subscription.status,
    billing_status: mapStripeSubscriptionStatus(subscription.status),
    billing_trial_ends_at: unixToSqliteUtcTimestamp(subscription.trial_end),
    billing_grace_ends_at:
      subscription.status === 'past_due'
        ? addGracePeriodDaysFromNow(env.stripeGracePeriodDays)
        : null,
  });
}

function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const db = getDb();

  const tenantId = resolveTenantFromMetadata(session.metadata);
  if (!tenantId) {
    console.warn('Stripe checkout.session.completed missing tenant_id metadata:', session.id);
    return;
  }

  tenantQueries.updateBillingState(db, tenantId, {
    billing_plan: 'pro',
    billing_customer_id: getObjectStringId(session.customer),
    billing_subscription_id: getObjectStringId(session.subscription as string | Stripe.Subscription | null),
    billing_subscription_status: 'checkout_completed',
  });
}

function handleCustomerSubscriptionCreatedOrUpdated(subscription: Stripe.Subscription) {
  const db = getDb();

  let tenantId = resolveTenantFromMetadata(subscription.metadata);

  if (!tenantId) {
    const existingTenant = tenantQueries.findByBillingSubscriptionId(db, subscription.id);
    if (existingTenant) {
      tenantId = existingTenant.id;
    }
  }

  if (!tenantId) {
    const customerId = getObjectStringId(subscription.customer);
    if (customerId) {
      const existingTenant = tenantQueries.findByBillingCustomerId(db, customerId);
      if (existingTenant) {
        tenantId = existingTenant.id;
      }
    }
  }

  if (!tenantId) {
    console.warn('Stripe subscription event could not resolve tenant:', subscription.id);
    return;
  }

  syncSubscriptionToTenant(subscription, tenantId);
}

function handleCustomerSubscriptionDeleted(subscription: Stripe.Subscription) {
  const db = getDb();

  let tenant = tenantQueries.findByBillingSubscriptionId(db, subscription.id);

  if (!tenant) {
    const customerId = getObjectStringId(subscription.customer);
    if (customerId) {
      tenant = tenantQueries.findByBillingCustomerId(db, customerId);
    }
  }

  if (!tenant) {
    console.warn('Stripe customer.subscription.deleted could not resolve tenant:', subscription.id);
    return;
  }

  tenantQueries.updateBillingState(db, tenant.id, {
    billing_plan: 'pro',
    billing_customer_id: getObjectStringId(subscription.customer),
    billing_subscription_id: subscription.id,
    billing_subscription_status: subscription.status || 'canceled',
    billing_status: 'canceled',
    billing_trial_ends_at: null,
    billing_grace_ends_at: null,
  });
}

function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const db = getDb();

  const subscriptionId = getObjectStringId(invoice.subscription as string | Stripe.Subscription | null);
  const customerId = getObjectStringId(invoice.customer as string | Stripe.Customer | null);

  let tenant = subscriptionId ? tenantQueries.findByBillingSubscriptionId(db, subscriptionId) : undefined;

  if (!tenant && customerId) {
    tenant = tenantQueries.findByBillingCustomerId(db, customerId);
  }

  if (!tenant) {
    console.warn('Stripe invoice.payment_succeeded could not resolve tenant:', invoice.id);
    return;
  }

  tenantQueries.updateBillingState(db, tenant.id, {
    billing_plan: 'pro',
    billing_customer_id: customerId,
    billing_subscription_id: subscriptionId,
    billing_subscription_status: 'active',
    billing_status: 'active',
    billing_grace_ends_at: null,
  });
}

function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const db = getDb();
  const env = getEnv();

  const subscriptionId = getObjectStringId(invoice.subscription as string | Stripe.Subscription | null);
  const customerId = getObjectStringId(invoice.customer as string | Stripe.Customer | null);

  let tenant = subscriptionId ? tenantQueries.findByBillingSubscriptionId(db, subscriptionId) : undefined;

  if (!tenant && customerId) {
    tenant = tenantQueries.findByBillingCustomerId(db, customerId);
  }

  if (!tenant) {
    console.warn('Stripe invoice.payment_failed could not resolve tenant:', invoice.id);
    return;
  }

  tenantQueries.updateBillingState(db, tenant.id, {
    billing_plan: 'pro',
    billing_customer_id: customerId,
    billing_subscription_id: subscriptionId,
    billing_subscription_status: 'past_due',
    billing_status: 'past_due',
    billing_grace_ends_at: addGracePeriodDaysFromNow(env.stripeGracePeriodDays),
  });
}

export const stripeRoutes = new Hono<AppEnv>();

stripeRoutes.post('/stripe/webhook', async (c) => {
  const env = getEnv();

  if (!env.stripeEnabled) {
    return c.text('Stripe disabled', 404);
  }

  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.text('Missing Stripe signature', 400);
  }

  const payload = await c.req.text();

  let event: Stripe.Event;
  try {
    event = verifyStripeWebhookEvent(payload, signature);
  } catch (error: any) {
    console.error('Stripe webhook signature verification failed:', error);
    return c.text(`Webhook signature verification failed: ${error?.message || 'Unknown error'}`, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        handleCustomerSubscriptionCreatedOrUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        handleCustomerSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        break;
    }

    return c.json({ received: true });
  } catch (error) {
    console.error(`Stripe webhook handler failed for ${event.type}:`, error);
    return c.text('Webhook handler failed', 500);
  }
});