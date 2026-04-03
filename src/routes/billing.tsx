import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import * as tenantQueries from '../db/queries/tenants.js';
import { loginRequired, roleRequired } from '../middleware/auth.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { BillingPage } from '../pages/billing/BillingPage.js';
import { getEnv } from '../config/env.js';
import {
  getStripeClient,
  getStripeModeLabel,
  getStripePlanLabel,
  isStripeEnabled,
  isStripePortalEnabled,
  resyncTenantBillingFromStripe,
} from '../services/stripe.js';

type NoticeTone = 'info' | 'good' | 'warn' | 'bad';

type BillingNotice = {
  tone: NoticeTone;
  title?: string;
  message: string;
};

function renderApp(c: any, subtitle: string, content: any, status = 200) {
  return c.html(
    <AppLayout
      currentTenant={c.get('tenant')}
      currentSubdomain={c.get('subdomain')}
      currentUser={c.get('user')}
      appName={process.env.APP_NAME || 'Hudson Business Solutions'}
      appLogo={process.env.APP_LOGO || '/static/brand/hudson-business-solutions-logo.png'}
      path={c.req.path}
      csrfToken={c.get('csrfToken')}
      subtitle={subtitle}
    >
      {content}
    </AppLayout>,
    status as any,
  );
}

function resolveOrigin(c: any): string {
  const forwardedProto = String(c.req.header('x-forwarded-proto') ?? '').trim().toLowerCase();
  const forwardedHost = String(c.req.header('x-forwarded-host') ?? '').trim();
  const host = forwardedHost || String(c.req.header('host') ?? '').trim();

  const proto =
    forwardedProto ||
    (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');

  return `${proto}://${host}`;
}

function resolveBlockedMessage(reason: string | undefined): BillingNotice | null {
  switch (reason) {
    case 'trial-ended':
      return {
        tone: 'bad',
        title: 'Trial Ended',
        message:
          'This workspace trial has ended. Start billing to restore full access and continue using the platform without interruption.',
      };
    case 'grace-ended':
      return {
        tone: 'bad',
        title: 'Grace Period Ended',
        message:
          'The temporary grace period has ended. Update billing now to restore normal workspace access.',
      };
    case 'workspace-suspended':
      return {
        tone: 'bad',
        title: 'Workspace Suspended',
        message:
          'This workspace is currently suspended for billing reasons. Billing recovery is required before normal access can resume.',
      };
    case 'subscription-canceled':
      return {
        tone: 'bad',
        title: 'Subscription Canceled',
        message:
          'This workspace subscription has been canceled. Restart billing to reactivate the subscription and continue access.',
      };
    case 'payment-required':
      return {
        tone: 'bad',
        title: 'Billing Required',
        message:
          'Billing must be completed before this workspace can continue using Hudson Business Solutions.',
      };
    default:
      return null;
  }
}

function resolveNotice(c: any): BillingNotice | undefined {
  const blockedReason = String(c.req.query('reason') || '').trim();
  const checkout = String(c.req.query('checkout') || '').trim().toLowerCase();
  const portal = String(c.req.query('portal') || '').trim().toLowerCase();
  const synced = String(c.req.query('synced') || '').trim().toLowerCase();
  const error = String(c.req.query('error') || '').trim().toLowerCase();
  const stripeMessage = decodeURIComponent(String(c.req.query('stripe_message') || '').trim());

  const blockedMessage = resolveBlockedMessage(blockedReason);
  if (blockedMessage) {
    return blockedMessage;
  }

  if (checkout === 'success' && synced === 'yes') {
    return {
      tone: 'good',
      title: 'Billing Activated',
      message:
        'Checkout completed and your workspace billing record was confirmed by Stripe. Your subscription details should now be fully up to date.',
    };
  }

  if (checkout === 'success') {
    return {
      tone: 'good',
      title: 'Checkout Completed',
      message:
        'Stripe Checkout finished successfully. Your billing card may take a few seconds to refresh while Stripe sync completes.',
    };
  }

  if (checkout === 'cancelled') {
    return {
      tone: 'warn',
      title: 'Checkout Canceled',
      message:
        'Billing checkout was canceled before completion. Your current billing state has not changed.',
    };
  }

  if (synced === 'manual') {
    return {
      tone: 'good',
      title: 'Billing Synced',
      message:
        'The workspace billing record was refreshed from Stripe. Review the latest status and continue if any billing action is still needed.',
    };
  }

  if (portal === 'returned') {
    return {
      tone: 'info',
      title: 'Returned from Billing Portal',
      message:
        'You returned from the Stripe Billing Portal. If you made changes, they may take a short moment to appear here.',
    };
  }

  if (portal === 'disabled') {
    return {
      tone: 'warn',
      title: 'Billing Portal Unavailable',
      message:
        'The Stripe Billing Portal is currently disabled in configuration, so self-service payment updates are not available right now.',
    };
  }

  if (portal === 'unavailable') {
    return {
      tone: 'warn',
      title: 'Billing Portal Not Ready Yet',
      message:
        'This workspace does not have a saved Stripe customer record yet, so the self-service billing portal cannot be opened right now.',
    };
  }

  if (error === 'stripe-config') {
    return {
      tone: 'bad',
      title: 'Stripe Configuration Required',
      message:
        'Stripe billing is enabled, but one or more required environment variables are still missing. Complete the Stripe configuration before using checkout or portal actions.',
    };
  }

  if (error === 'portal-config') {
    return {
      tone: 'bad',
      title: 'Billing Portal Configuration Required',
      message:
        'A Stripe customer record exists for this workspace, but the billing portal is not ready to launch because required portal settings are missing.',
    };
  }

  if (error === 'stripe-request') {
    return {
      tone: 'bad',
      title: 'Stripe Request Failed',
      message: stripeMessage
        ? `Stripe returned an error while starting the billing action: ${stripeMessage}`
        : 'Stripe could not start the billing action right now. Please try again in a moment.',
    };
  }

  if (error === 'resync-unavailable') {
    return {
      tone: 'warn',
      title: 'Nothing to Sync Yet',
      message:
        'This workspace does not have a Stripe customer or subscription record saved yet, so there is nothing to refresh from Stripe right now.',
    };
  }

  if (error === 'exempt-workspace') {
    return {
      tone: 'info',
      title: 'Billing Not Required',
      message:
        'This workspace is marked billing-exempt, so Stripe checkout is not needed here.',
    };
  }

  return undefined;
}

function sanitizeStripeMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 300);
}

export const billingRoutes = new Hono<AppEnv>();

billingRoutes.get('/billing', loginRequired, (c) => {
  const tenant = c.get('tenant');
  const user = c.get('user');
  if (!tenant || !user) return c.redirect('/login');

  const db = getDb();
  const billing = tenantQueries.getBillingSummary(db, tenant.id);

  if (!billing) {
    return c.text('Tenant not found', 404);
  }

  const env = getEnv();
  const notice = resolveNotice(c);

  return renderApp(
    c,
    'Workspace Billing',
    <BillingPage
      tenant={billing}
      csrfToken={c.get('csrfToken')}
      currentUserRole={user.role}
      stripeEnabled={env.stripeEnabled}
      stripeModeLabel={getStripeModeLabel()}
      stripePortalEnabled={isStripePortalEnabled()}
      stripePlanLabel={getStripePlanLabel()}
      notice={notice}
    />,
    notice?.tone === 'bad' ? 402 : 200,
  );
});

billingRoutes.post('/billing/checkout', roleRequired('Admin'), async (c) => {
  const tenant = c.get('tenant');
  const user = c.get('user');
  if (!tenant || !user) return c.redirect('/login');

  const env = getEnv();

  if (!isStripeEnabled()) {
    return c.redirect('/billing?error=stripe-config');
  }

  const db = getDb();
  const billing = tenantQueries.getBillingSummary(db, tenant.id);

  if (!billing) {
    return c.text('Tenant not found', 404);
  }

  if (Number(billing.billing_exempt || 0) === 1 || billing.billing_state === 'billing_exempt') {
    return c.redirect('/billing?error=exempt-workspace');
  }

  try {
    const stripe = getStripeClient();
    let customerId = billing.billing_customer_id;

    const createCustomer = async () => {
      const customer = await stripe.customers.create({
        name: billing.name,
        email: user.email || undefined,
        metadata: {
          tenant_id: String(tenant.id),
          tenant_subdomain: tenant.subdomain,
          app_name: env.appName,
        },
      });

      tenantQueries.updateBillingState(db, tenant.id, {
        billing_customer_id: customer.id,
        billing_plan: 'pro',
      });

      return customer.id;
    };

    if (customerId) {
      try {
        const existingCustomer = await stripe.customers.retrieve(customerId);
        if ((existingCustomer as any)?.deleted) {
          throw new Error(`No such customer: '${customerId}'`);
        }
      } catch (error: any) {
        const message = String(error?.message || '');
        if (/no such customer/i.test(message)) {
          tenantQueries.updateBillingState(db, tenant.id, {
            billing_customer_id: null,
            billing_subscription_id: null,
            billing_subscription_status: null,
          });
          customerId = null;
        } else {
          throw error;
        }
      }
    }

    if (!customerId) {
      customerId = await createCustomer();
    }

    const origin = resolveOrigin(c);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: env.stripePriceProMonthly,
          quantity: 1,
        },
      ],
      success_url: `${origin}/billing?checkout=success`,
      cancel_url: `${origin}/billing?checkout=cancelled`,
      allow_promotion_codes: false,
      metadata: {
        tenant_id: String(tenant.id),
        tenant_subdomain: tenant.subdomain,
        initiated_by_user_id: String(user.id),
      },
      subscription_data: {
        metadata: {
          tenant_id: String(tenant.id),
          tenant_subdomain: tenant.subdomain,
          billing_plan: 'pro',
        },
      },
    });

    if (!session.url) {
      throw new Error('Stripe Checkout did not return a redirect URL.');
    }

    return c.redirect(session.url, 303);
  } catch (error: any) {
    console.error('Stripe checkout session error:', error);

    const rawMessage =
      typeof error?.message === 'string'
        ? error.message
        : 'Unknown Stripe error while creating checkout session.';

    const safeMessage = encodeURIComponent(sanitizeStripeMessage(rawMessage));
    return c.redirect(`/billing?error=stripe-request&stripe_message=${safeMessage}`);
  }
});

billingRoutes.post('/billing/resync', roleRequired('Admin'), async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const db = getDb();
  const billing = tenantQueries.getBillingSummary(db, tenant.id);

  if (!billing) {
    return c.text('Tenant not found', 404);
  }

  try {
    const result = await resyncTenantBillingFromStripe(db, {
      id: billing.id,
      billing_customer_id: billing.billing_customer_id,
      billing_subscription_id: billing.billing_subscription_id,
    });

    if (!result.ok && (result.code === 'no-remote-record' || result.code === 'customer-not-found' || result.code === 'subscription-not-found')) {
      return c.redirect('/billing?error=resync-unavailable');
    }

    return c.redirect('/billing?synced=manual');
  } catch (error: any) {
    console.error('Stripe billing resync error:', error);

    const rawMessage =
      typeof error?.message === 'string'
        ? error.message
        : 'Unknown Stripe error while refreshing billing status.';

    const safeMessage = encodeURIComponent(sanitizeStripeMessage(rawMessage));
    return c.redirect(`/billing?error=stripe-request&stripe_message=${safeMessage}`);
  }
});

billingRoutes.post('/billing/portal', roleRequired('Admin'), async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  if (!isStripePortalEnabled()) {
    return c.redirect('/billing?portal=disabled');
  }

  const db = getDb();
  const billing = tenantQueries.getBillingSummary(db, tenant.id);

  if (!billing) {
    return c.text('Tenant not found', 404);
  }

  if (!billing.billing_customer_id) {
    return c.redirect('/billing?portal=unavailable');
  }

  try {
    const stripe = getStripeClient();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: billing.billing_customer_id,
      return_url: `${resolveOrigin(c)}/billing?portal=returned`,
    });

    return c.redirect(portalSession.url, 303);
  } catch (error: any) {
    console.error('Stripe billing portal error:', error);

    const rawMessage =
      typeof error?.message === 'string'
        ? error.message
        : 'Unknown Stripe portal error.';

    const safeMessage = encodeURIComponent(sanitizeStripeMessage(rawMessage));

    if (/portal configuration/i.test(rawMessage) || /No configuration provided/i.test(rawMessage)) {
      return c.redirect('/billing?error=portal-config');
    }

    if (/no such customer/i.test(rawMessage)) {
      tenantQueries.updateBillingState(db, tenant.id, {
        billing_customer_id: null,
        billing_subscription_id: null,
        billing_subscription_status: null,
      });
      return c.redirect('/billing?portal=unavailable');
    }

    return c.redirect(`/billing?error=stripe-request&stripe_message=${safeMessage}`);
  }
});

export default billingRoutes;
