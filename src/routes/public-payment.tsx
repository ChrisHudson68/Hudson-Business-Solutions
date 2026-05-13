import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import { getEnv } from '../config/env.js';
import * as invoiceQueries from '../db/queries/invoices.js';
import * as paymentQueries from '../db/queries/payments.js';
import { getStripeClient, isStripeEnabled } from '../services/stripe.js';
import { PublicLayout } from '../pages/layouts/PublicLayout.js';
import { PublicPaymentPage } from '../pages/invoices/PublicPaymentPage.js';

const appName = () => process.env.APP_NAME || 'Hudson Business Solutions';
const appLogo = () => process.env.APP_LOGO || '/static/brand/hudson-business-solutions-logo.png';

function getTenantLogo(db: any, tenantId: number): string | null {
  const row = db.prepare('SELECT logo_path FROM tenants WHERE id = ? LIMIT 1').get(tenantId) as
    | { logo_path: string | null }
    | undefined;
  return row?.logo_path ?? null;
}

function renderMessage(
  c: any,
  opts: { title: string; heading: string; message: string; tone?: 'success' | 'danger' | 'default' },
  status: 200 | 404 = 200,
) {
  const accentStyle =
    opts.tone === 'success'
      ? 'border-color:#BBF7D0; background:#F0FDF4; color:#166534;'
      : opts.tone === 'danger'
        ? 'border-color:#FECACA; background:#FEF2F2; color:#991B1B;'
        : 'border-color:#BFDBFE; background:#EFF6FF; color:#1E3A8A;';

  return c.html(
    <PublicLayout appName={appName()} appLogo={appLogo()}>
      <div style="max-width:640px; margin:0 auto; display:grid; gap:16px;">
        <div class="page-head">
          <h1>{opts.heading}</h1>
        </div>
        <div class="card" style={accentStyle}>
          <div style="line-height:1.6;">{opts.message}</div>
        </div>
      </div>
    </PublicLayout>,
    status,
  );
}

export const publicPaymentRoutes = new Hono<AppEnv>();

publicPaymentRoutes.get('/invoice/pay/:token', (c) => {
  const token = String(c.req.param('token') || '').trim();
  const db = getDb();
  const env = getEnv();

  if (!token) {
    return renderMessage(
      c,
      { title: 'Not Found', heading: 'Invoice link unavailable', message: 'This link is invalid. Please contact your contractor.', tone: 'danger' },
      404,
    );
  }

  const inv = invoiceQueries.findByPublicTokenForPayment(db, token);

  if (!inv || inv.archived_at) {
    return renderMessage(
      c,
      { title: 'Not Found', heading: 'Invoice not found', message: 'This invoice link is no longer valid. Please contact your contractor.', tone: 'danger' },
      404,
    );
  }

  if (!isStripeEnabled() || !inv.stripe_connect_account_id) {
    return renderMessage(c, {
      title: 'Payments Unavailable',
      heading: 'Online payments not available',
      message: 'This contractor has not enabled online payments. Please contact them directly to arrange payment.',
    });
  }

  const totalPaid = paymentQueries.sumByInvoice(db, inv.id, inv.tenant_id);
  const amountDue = Math.max(0, inv.amount - totalPaid);
  const logo = getTenantLogo(db, inv.tenant_id) || appLogo();

  return c.html(
    <PublicLayout appName={appName()} appLogo={logo}>
      <div style="max-width:640px; margin:0 auto;">
        <PublicPaymentPage
          invoice={inv}
          companyName={inv.company_name || appName()}
          amountDue={amountDue}
          totalPaid={totalPaid}
          stripePublishableKey={env.stripePublishableKey}
          csrfToken={c.get('csrfToken')}
        />
      </div>
    </PublicLayout>,
  );
});

publicPaymentRoutes.post('/invoice/pay/:token/intent', async (c) => {
  const token = String(c.req.param('token') || '').trim();
  const db = getDb();

  if (!token) {
    return c.json({ error: 'Invalid request.' }, 400);
  }

  if (!isStripeEnabled()) {
    return c.json({ error: 'Payment processing is unavailable.' }, 400);
  }

  const inv = invoiceQueries.findByPublicTokenForPayment(db, token);

  if (!inv || inv.archived_at) {
    return c.json({ error: 'Invoice not found.' }, 404);
  }

  if (!inv.stripe_connect_account_id) {
    return c.json({ error: 'Online payments are not available for this invoice.' }, 400);
  }

  const totalPaid = paymentQueries.sumByInvoice(db, inv.id, inv.tenant_id);
  const amountDue = Math.max(0, inv.amount - totalPaid);

  if (amountDue <= 0) {
    return c.json({ alreadyPaid: true });
  }

  const amountCents = Math.round(amountDue * 100);
  const stripe = getStripeClient();
  const feePercent = getEnv().stripeConnectPlatformFeePercent;
  const applicationFeeAmount = feePercent > 0 ? Math.round(amountCents * feePercent / 100) : undefined;

  // Reuse existing Payment Intent if it's still processable
  if (inv.stripe_payment_intent_id) {
    try {
      const existing = await stripe.paymentIntents.retrieve(inv.stripe_payment_intent_id);

      if (existing.status === 'succeeded') {
        return c.json({ alreadyPaid: true });
      }

      if (existing.status !== 'canceled') {
        return c.json({ clientSecret: existing.client_secret });
      }

      // Canceled — fall through to create a new one
      invoiceQueries.setPaymentIntentId(db, inv.id, inv.tenant_id, null);
    } catch {
      // Retrieval failed — create a new one
      invoiceQueries.setPaymentIntentId(db, inv.id, inv.tenant_id, null);
    }
  }

  const pi = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    transfer_data: { destination: inv.stripe_connect_account_id },
    ...(applicationFeeAmount ? { application_fee_amount: applicationFeeAmount } : {}),
    metadata: {
      invoice_id: String(inv.id),
      tenant_id: String(inv.tenant_id),
      invoice_number: inv.invoice_number || '',
    },
    description: `Invoice ${inv.invoice_number || inv.id}`,
  });

  invoiceQueries.setPaymentIntentId(db, inv.id, inv.tenant_id, pi.id);

  return c.json({ clientSecret: pi.client_secret });
});

export default publicPaymentRoutes;
