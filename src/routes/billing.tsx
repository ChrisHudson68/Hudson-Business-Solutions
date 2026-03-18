import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import * as tenantQueries from '../db/queries/tenants.js';
import { permissionRequired, userHasPermission } from '../middleware/auth.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { BillingPage } from '../pages/billing/BillingPage.js';
import { getEnv } from '../config/env.js';
import {
  getStripeClient,
  getStripeModeLabel,
  getStripePlanLabel,
  isStripeEnabled,
  isStripePortalEnabled,
} from '../services/stripe.js';

type NoticeTone = 'info' | 'good' | 'warn' | 'bad';

type BillingNotice = {
  tone: NoticeTone;
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

function resolveBlockedMessage(reason: string | undefined): string | null {
  switch (reason) {
    case 'trial-ended':
      return 'This workspace trial has ended. Start billing to restore full access.';
    case 'grace-ended':
      return 'This workspace is past due and the grace period has ended. A valid subscription is required.';
    case 'subscription-canceled':
      return 'This workspace subscription has been canceled. Restart billing to continue access.';
    case 'payment-required':
      return 'Billing must be completed before this workspace can continue using the platform.';
    default:
      return null;
  }
}

function resolveNotice(c: any): BillingNotice | undefined {
  const blockedReason = String(c.req.query('reason') || '').trim();
  const checkout = String(c.req.query('checkout') || '').trim().toLowerCase();
  const portal = String(c.req.query('portal') || '').trim().toLowerCase();
  const synced = String(c.req.query('synced') || '').trim().toLowerCase();
  const error = String(c.req.query('error') || '').trim();
  const stripeMessage = String(c.req.query('stripe_message') || '').trim();

  const blockedMessage = resolveBlockedMessage(blockedReason);
  if (blockedMessage) {
    return {
      tone: 'bad',
      message: blockedMessage,
    };
  }

  if (checkout === 'success' && synced === 'yes') {
    return {
      tone: 'good',
      message: 'Checkout completed and the workspace billing record has been synced by Stripe webhooks.',
    };
  }

  if (checkout === 'success') {
    return {
      tone: 'good',
      message: 'Stripe Checkout returned successfully. If the billing card does not update within a few seconds, refresh the page.',
    };
  }

  if (checkout === 'cancelled') {
    return {
      tone: 'warn',
      message: 'Checkout was canceled before completion.',
    };
  }

  if (portal === 'disabled') {
    return {
      tone: 'warn',
      message: 'The Stripe Billing Portal is currently disabled in configuration.',
    };
  }

  if (portal === 'unavailable') {
    return {
      tone: 'warn',
      message:
        'The billing portal is not available yet for this workspace because no Stripe customer record has been saved locally.',
    };
  }

  if (error === 'stripe-config') {
    return {
      tone: 'bad',
      message: 'Stripe is enabled, but one or more required billing environment variables are missing.',
    };
  }

  if (error === 'stripe-request') {
    return {
      tone: 'bad',
      message: stripeMessage
        ? `Stripe error: ${stripeMessage}`
        : 'Stripe could not start the billing flow right now. Please try again.',
    };
  }

  if (error === 'exempt-workspace') {
    return {
      tone: 'info',
      message: 'This workspace is marked billing-exempt, so Stripe checkout is not needed here.',
    };
  }

  return undefined;
}

function sanitizeStripeMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 300);
}

export const billingRoutes = new Hono<AppEnv>();

billingRoutes.get('/billing', permissionRequired('billing.view'), (c) => {
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
      canManageBilling={userHasPermission(user, 'billing.manage')}
    />,
    notice?.tone === 'bad' ? 402 : 200,
  );
});

billingRoutes.post('/billing/checkout', permissionRequired('billing.manage'), async (c) => {
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

  if (Number(billing.billing_exempt || 0) === 1) {
    return c.redirect('/billing?error=exempt-workspace');
  }

  try {
    const stripe = getStripeClient();
    let customerId = billing.billing_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: billing.name,
        email: user.email || undefined,
        metadata: {
          tenant_id: String(tenant.id),
          tenant_subdomain: tenant.subdomain,
          app_name: env.appName,
        },
      });

      customerId = customer.id;

      tenantQueries.updateBillingState(db, tenant.id, {
        billing_customer_id: customerId,
        billing_plan: 'pro',
      });
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

billingRoutes.post('/billing/portal', permissionRequired('billing.manage'), async (c) => {
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
      return_url: `${resolveOrigin(c)}/billing`,
    });

    return c.redirect(portalSession.url, 303);
  } catch (error: any) {
    console.error('Stripe billing portal error:', error);

    const rawMessage =
      typeof error?.message === 'string'
        ? error.message
        : 'Unknown Stripe portal error.';

    const safeMessage = encodeURIComponent(sanitizeStripeMessage(rawMessage));
    return c.redirect(`/billing?error=stripe-request&stripe_message=${safeMessage}`);
  }
});