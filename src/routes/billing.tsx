import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import * as tenantQueries from '../db/queries/tenants.js';
import { loginRequired } from '../middleware/auth.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { BillingPage } from '../pages/billing/BillingPage.js';

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
    status,
  );
}

export const billingRoutes = new Hono<AppEnv>();

billingRoutes.get('/billing', loginRequired, (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const db = getDb();
  const billing = tenantQueries.getBillingSummary(db, tenant.id);

  if (!billing) {
    return c.text('Tenant not found', 404);
  }

  const reason = String(c.req.query('reason') || '').trim();

  return renderApp(
    c,
    'Workspace Billing',
    <BillingPage
      tenant={billing}
      blockedReason={reason || undefined}
    />,
    reason ? 402 : 200,
  );
});
