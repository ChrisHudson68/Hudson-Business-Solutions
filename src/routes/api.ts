import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getEnv } from '../config/env.js';
import { getDb } from '../db/connection.js';
import * as jobs from '../db/queries/jobs.js';
import { resolveRequestUser } from '../middleware/auth.js';

export const apiRoutes = new Hono<AppEnv>();

function resolveApiContext(c: any) {
  const user = c.get('user') ?? resolveRequestUser(c);
  const tenant = c.get('tenant');

  if (!tenant) {
    return {
      ok: false as const,
      response: c.json({ ok: false, error: 'tenant_required' }, 400),
    };
  }

  if (!user) {
    return {
      ok: false as const,
      response: c.json({ ok: false, error: 'unauthorized' }, 401),
    };
  }

  return { ok: true as const, user, tenant };
}

apiRoutes.get('/api/health', (c) => {
  const env = getEnv();

  return c.json({
    ok: true,
    service: 'mobile-api',
    app: env.appName,
    env: env.nodeEnv,
  });
});

apiRoutes.get('/api/me', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;

  const { user, tenant } = resolved;

  return c.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      logoPath: tenant.logo_path,
    },
  });
});

apiRoutes.get('/api/jobs', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;

  const { tenant } = resolved;
  const db = getDb();
  const rows = jobs.listWithFinancials(db, tenant.id, false);

  return c.json({
    ok: true,
    jobs: rows.map((row) => ({
      id: row.id,
      jobName: row.job_name,
      jobCode: row.job_code,
      clientName: row.client_name,
      status: row.status,
      startDate: row.start_date,
    })),
  });
});

apiRoutes.get('/api/jobs/:id', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;

  const { tenant } = resolved;
  const db = getDb();
  const jobId = Number(c.req.param('id'));

  if (!jobId || isNaN(jobId)) {
    return c.json({ ok: false, error: 'invalid_id' }, 400);
  }

  const row = jobs.listWithFinancials(db, tenant.id, jobId);

  if (!row) {
    return c.json({ ok: false, error: 'not_found' }, 404);
  }

  const contractAmount = Number(row.contract_amount || 0);
  const totalIncome = Number(row.total_income || 0);
  const totalExpenses = Number(row.total_expenses || 0);
  const totalLabor = Number(row.total_labor || 0);
  const totalCosts = totalExpenses + totalLabor;
  const profit = totalIncome - totalCosts;

  return c.json({
    ok: true,
    job: {
      id: row.id,
      jobName: row.job_name,
      jobCode: row.job_code,
      description: row.job_description,
      clientName: row.client_name,
      soldBy: row.sold_by,
      commissionPercent: Number(row.commission_percent || 0),
      status: row.status,
      startDate: row.start_date,

      financials: {
        contractAmount,
        totalIncome,
        totalExpenses,
        totalLabor,
        totalCosts,
        profit,
      },
    },
  });
});