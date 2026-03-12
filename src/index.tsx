import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

import { tenantMiddleware } from './middleware/tenant.js';
import { csrfMiddleware } from './middleware/csrf.js';
import { noCacheMiddleware } from './middleware/no-cache.js';

import { authRoutes } from './routes/auth.js';
import { legalRoutes } from './routes/legal.js';
import { userRoutes } from './routes/users.js';
import { dashboardRoutes } from './routes/dashboards.js';
import { jobRoutes } from './routes/jobs.js';
import { jobFinancialRoutes } from './routes/job-financials.js';
import { employeeRoutes } from './routes/employees.js';
import { timesheetRoutes } from './routes/timesheet.js';
import { invoiceRoutes } from './routes/invoices.js';
import { paymentRoutes } from './routes/payments.js';
import { settingsRoutes } from './routes/settings.js';

import { NotFoundPage } from './pages/errors/NotFoundPage.js';
import { ServerErrorPage } from './pages/errors/ServerErrorPage.js';

import { getDb } from './db/connection.js';
import { getEnv } from './config/env.js';

import type { TenantVariables } from './middleware/tenant.js';
import type { AuthVariables } from './middleware/auth.js';
import type { CsrfVariables } from './middleware/csrf.js';

export type AppVariables = TenantVariables & AuthVariables & CsrfVariables;
export type AppType = Hono<{ Variables: AppVariables }>;

const env = getEnv();

function ensureStartupDirectories(): void {
  fs.mkdirSync(path.dirname(env.dbPath), { recursive: true });
  fs.mkdirSync(env.uploadDir, { recursive: true });
  fs.mkdirSync(path.join(env.uploadDir, 'receipts'), { recursive: true });
  fs.mkdirSync(path.join(env.uploadDir, 'tenant_logos'), { recursive: true });
}

ensureStartupDirectories();
getDb();

const app = new Hono<{ Variables: AppVariables }>();

app.use(
  '/static/*',
  serveStatic({
    root: './public',
    rewriteRequestPath: (p) => p.replace('/static', ''),
  }),
);

app.use(
  '/uploads/receipts/*',
  serveStatic({
    root: path.join(env.uploadDir, 'receipts'),
    rewriteRequestPath: (p) => p.replace('/uploads/receipts', ''),
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

app.get('/healthz', (c) =>
  c.json({
    status: 'ok',
    app: env.appName,
    env: env.nodeEnv,
  }),
);

/*
  Important:
  authRoutes must be mounted before dashboardRoutes so GET /
  shows the public landing page on the base domain.
*/
app.route('/', authRoutes);
app.route('/', legalRoutes);
app.route('/', dashboardRoutes);
app.route('/', userRoutes);
app.route('/', jobRoutes);
app.route('/', jobFinancialRoutes);
app.route('/', employeeRoutes);
app.route('/', timesheetRoutes);
app.route('/', invoiceRoutes);
app.route('/', paymentRoutes);
app.route('/', settingsRoutes);

app.notFound((c) => {
  return c.html(<NotFoundPage />, 404);
});

app.onError((err, c) => {
  console.error(`500: ${c.req.method} ${c.req.path}`, err);
  return c.html(<ServerErrorPage />, 500);
});

console.log(`${env.appName} running on http://localhost:${env.port}`);
serve({ fetch: app.fetch, port: env.port });