import { Hono } from 'hono';
import Stripe from 'stripe';
import type { AppEnv } from '../app-env.js';
import { getEnv } from '../config/env.js';
import { getDb } from '../db/connection.js';
import * as tenantQueries from '../db/queries/tenants.js';
import * as paymentQueries from '../db/queries/payments.js';
import {
  addGracePeriodDaysFromNow,
  mapStripeSubscriptionStatus,
  unixToSqliteUtcTimestamp,
  verifyStripeWebhookEvent,
} from '../services/stripe.js';
import {
  sendTenantPaymentNotification,
  sendCustomerPaymentConfirmation,
} from '../services/send-payment-notification.js';

function getObjectStringId(value: string | Stripe.Customer | Stripe.DeletedCustomer | Stripe.Subscription | Stripe.Invoice | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  // SDK v20+: subscription lives at invoice.parent.subscription_details.subscription
  // Older webhook payloads may still have it at invoice.subscription (top-level)
  const via_parent = invoice.parent?.subscription_details?.subscription;
  const via_legacy = (invoice as any).subscription as string | Stripe.Subscription | null | undefined;
  return getObjectStringId(via_parent ?? via_legacy ?? null);
}

function resolveTenantFromMetadata(metadata: Record<string, string> | null | undefined): number | null {
  const raw = String(metadata?.tenant_id || '').trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  return Number.parseInt(raw, 10);
}

function mapStripeState(status: string | null | undefined): string {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'active') return 'active';
  if (normalized === 'trialing') return 'trialing';
  if (normalized === 'past_due') return 'grace_period';
  if (normalized === 'canceled' || normalized === 'unpaid' || normalized === 'paused') return 'canceled';

  return 'suspended';
}

function syncSubscriptionToTenant(
  subscription: Stripe.Subscription,
  tenantId: number,
) {
  const db = getDb();
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
    billing_state: mapStripeState(subscription.status),
    billing_grace_until: graceUntil,
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
    billing_updated_at: null,
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
    billing_state: 'canceled',
    billing_grace_until: null,
  });
}

function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const db = getDb();

  const subscriptionId = getInvoiceSubscriptionId(invoice);
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
    billing_state: 'active',
    billing_grace_until: null,
  });
}

function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const db = getDb();
  const env = getEnv();
  const graceUntil = addGracePeriodDaysFromNow(env.stripeGracePeriodDays);

  const subscriptionId = getInvoiceSubscriptionId(invoice);
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
    billing_grace_ends_at: graceUntil,
    billing_state: 'grace_period',
    billing_grace_until: graceUntil,
  });
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const invoiceIdRaw = paymentIntent.metadata?.invoice_id;
  const tenantIdRaw = paymentIntent.metadata?.tenant_id;

  // Not one of our invoice payments — ignore
  if (!invoiceIdRaw || !tenantIdRaw) return;

  const invoiceId = Number.parseInt(invoiceIdRaw, 10);
  const tenantId = Number.parseInt(tenantIdRaw, 10);

  if (!Number.isFinite(invoiceId) || !Number.isFinite(tenantId)) return;

  const db = getDb();

  const inv = db.prepare(`
    SELECT i.id, i.invoice_number, i.amount, i.archived_at,
           i.customer_name, i.customer_email
    FROM invoices i
    WHERE i.id = ? AND i.tenant_id = ?
  `).get(invoiceId, tenantId) as {
    id: number;
    invoice_number: string;
    amount: number;
    archived_at: string | null;
    customer_name: string | null;
    customer_email: string | null;
  } | undefined;

  if (!inv || inv.archived_at) {
    console.warn('payment_intent.succeeded: invoice not found or archived', { invoiceId, tenantId, pi: paymentIntent.id });
    return;
  }

  // Idempotency: skip if this payment intent was already recorded
  const alreadyRecorded = db.prepare(
    'SELECT id FROM payments WHERE invoice_id = ? AND tenant_id = ? AND reference = ?',
  ).get(invoiceId, tenantId, paymentIntent.id);

  if (alreadyRecorded) return;

  const amountPaid = paymentIntent.amount / 100;
  const paymentDate = new Date().toISOString().slice(0, 10);

  paymentQueries.create(db, tenantId, {
    invoice_id: invoiceId,
    date: paymentDate,
    amount: amountPaid,
    method: 'Online / Stripe',
    reference: paymentIntent.id,
  });

  const tenantRow = db.prepare(`
    SELECT name, company_email, company_phone, notification_cc_emails
    FROM tenants WHERE id = ? LIMIT 1
  `).get(tenantId) as {
    name: string;
    company_email: string | null;
    company_phone: string | null;
    notification_cc_emails: string | null;
  } | undefined;

  if (!tenantRow) return;

  // Tenant notification — fire and forget so email failures don't affect webhook acknowledgment
  if (tenantRow.company_email) {
    sendTenantPaymentNotification({
      tenantEmail: tenantRow.company_email,
      ccEmails: tenantRow.notification_cc_emails,
      companyName: tenantRow.name,
      invoiceNumber: inv.invoice_number,
      customerName: inv.customer_name,
      amountPaid,
      paymentIntentId: paymentIntent.id,
      paymentDate,
    }).catch((err) => console.error('Failed to send tenant payment notification:', err));
  }

  // Customer confirmation
  const customerEmail = String(inv.customer_email || '').trim();
  if (customerEmail && customerEmail.includes('@')) {
    sendCustomerPaymentConfirmation({
      customerEmail,
      customerName: inv.customer_name,
      companyName: tenantRow.name,
      companyEmail: tenantRow.company_email,
      companyPhone: tenantRow.company_phone,
      invoiceNumber: inv.invoice_number,
      amountPaid,
      paymentDate,
    }).catch((err) => console.error('Failed to send customer payment confirmation:', err));
  }
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

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
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
