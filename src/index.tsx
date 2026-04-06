import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

import { tenantMiddleware } from './middleware/tenant.js';
import { securityHeadersMiddleware } from './middleware/security-headers.js';
import { csrfMiddleware } from './middleware/csrf.js';
import { noCacheMiddleware } from './middleware/no-cache.js';
import { billingRequired } from './middleware/billing.js';

import { apiRoutes } from './routes/api.js';
import { mobileAuthRoutes } from './routes/api-mobile-auth.js';
import { authRoutes } from './routes/auth.js';
import { legalRoutes } from './routes/legal.js';
import { platformAdminRoutes } from './routes/platform-admin.js';
import { adminSupportRoutes } from './routes/admin-support.js';
import { supportRoutes } from './routes/support.js';
import { activityRoutes } from './routes/activity.js';
import { userRoutes } from './routes/users.js';
import { dashboardRoutes } from './routes/dashboards.js';
import { jobRoutes } from './routes/jobs.js';
import { jobFinancialRoutes } from './routes/job-financials.js';
import { employeeRoutes } from './routes/employees.js';
import { timesheetRoutes } from './routes/timesheet.js';
import { invoiceRoutes } from './routes/invoices.js';
import { paymentRoutes } from './routes/payments.js';
import { settingsRoutes } from './routes/settings.js';
import { monthlyBillRoutes } from './routes/monthly-bills.js';
import { fleetRoutes } from './routes/fleet.js';
import { billingRoutes } from './routes/billing.js';
import { estimateRoutes } from './routes/estimates.js';
import { publicEstimateRoutes } from './routes/public-estimate.js';
import { stripeRoutes } from './routes/stripe.js';

import { NotFoundPage } from './pages/errors/NotFoundPage.js';
import { ServerErrorPage } from './pages/errors/ServerErrorPage.js';

import { getDb } from './db/connection.js';
import { getEnv } from './config/env.js';

import type { TenantVariables } from './middleware/tenant.js';
import type { AuthVariables } from './middleware/auth.js';
import type { CsrfVariables } from './middleware/csrf.js';
import type { PlatformAdminVariables } from './middleware/platform-admin.js';

export type AppVariables = TenantVariables & AuthVariables & CsrfVariables & PlatformAdminVariables;
export type AppType = Hono<{ Variables: AppVariables }>;

const env = getEnv();

function ensureStartupDirectories(): void {
  fs.mkdirSync(path.dirname(env.dbPath), { recursive: true });
  fs.mkdirSync(env.uploadDir, { recursive: true });
  fs.mkdirSync(path.join(env.uploadDir, 'receipts'), { recursive: true });
  fs.mkdirSync(path.join(env.uploadDir, 'tenant_logos'), { recursive: true });
  fs.mkdirSync(path.join(env.uploadDir, 'fleet_receipts'), { recursive: true });
}

ensureStartupDirectories();
getDb();

const app = new Hono<{ Variables: AppVariables }>();

app.use('*', securityHeadersMiddleware);

app.use(
  '/static/*',
  serveStatic({
    root: './public',
    rewriteRequestPath: (p) => p.replace('/static', ''),
  }),
);

app.use(
  '/uploads/logos/*',
  serveStatic({
    root: path.join(env.uploadDir, 'tenant_logos'),
    rewriteRequestPath: (p) => p.replace('/uploads/logos', ''),
  }),
);

app.use('*', noCacheMiddleware);
app.use('*', tenantMiddleware);
app.use('*', csrfMiddleware);
app.use('*', billingRequired);

app.get('/healthz', (c) =>
  c.json({
    status: 'ok',
    app: env.appName,
    env: env.nodeEnv,
  }),
);

app.route('/', apiRoutes);
app.route('/', mobileAuthRoutes);
app.route('/', stripeRoutes);
app.route('/', authRoutes);
app.route('/', legalRoutes);
app.route('/', platformAdminRoutes);
app.route('/', adminSupportRoutes);
app.route('/', supportRoutes);
app.route('/', activityRoutes);
app.route('/', billingRoutes);
app.route('/', estimateRoutes);
app.route('/', publicEstimateRoutes);
app.route('/', dashboardRoutes);
app.route('/', userRoutes);
app.route('/', jobRoutes);
app.route('/', jobFinancialRoutes);
app.route('/', employeeRoutes);
app.route('/', timesheetRoutes);
app.route('/', invoiceRoutes);
app.route('/', paymentRoutes);
app.route('/', settingsRoutes);
app.route('/', monthlyBillRoutes);
app.route('/', fleetRoutes);

app.notFound((c) => {
  return c.html(<NotFoundPage />, 404);
});

app.onError((err, c) => {
  console.error(`500: ${c.req.method} ${c.req.path}`, err);
  return c.html(<ServerErrorPage />, 500);
});

console.log(`${env.appName} running on http://localhost:${env.port}`);
serve({ fetch: app.fetch, port: env.port });