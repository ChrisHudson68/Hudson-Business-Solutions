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
      response: c.json(
        {
          ok: false,
          error: 'tenant_required',
        },
        400,
      ),
    };
  }

  if (!user) {
    return {
      ok: false as const,
      response: c.json(
        {
          ok: false,
          error: 'unauthorized',
        },
        401,
      ),
    };
  }

  return {
    ok: true as const,
    user,
    tenant,
  };
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
  if (!resolved.ok) {
    return resolved.response;
  }

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
  if (!resolved.ok) {
    return resolved.response;
  }

  const { tenant } = resolved;
  const db = getDb();
  const rows = jobs.listWithFinancials(db, tenant.id, false);

  return c.json({
    ok: true,
    jobs: rows.map((row) => {
      const contractAmount = Number(row.contract_amount || 0);
      const totalIncome = Number(row.total_income || 0);
      const totalExpenses = Number(row.total_expenses || 0);
      const totalLabor = Number(row.total_labor || 0);
      const totalHours = Number(row.total_hours || 0);
      const totalInvoiced = Number(row.total_invoiced || 0);
      const totalCollected = Number(row.total_collected || 0);
      const unpaidInvoices = Number(row.unpaid_invoices || 0);
      const retainagePercent = Number(row.retainage_percent || 0);

      const totalCosts = totalExpenses + totalLabor;
      const profit = totalIncome - totalCosts;
      const remainingContract = contractAmount - totalIncome;
      const unpaidInvoiceBalance = Math.max(totalInvoiced - totalCollected, 0);

      return {
        id: row.id,
        jobName: row.job_name,
        jobCode: row.job_code,
        jobDescription: row.job_description,
        clientName: row.client_name,
        soldBy: row.sold_by,
        commissionPercent: Number(row.commission_percent || 0),
        contractAmount,
        retainagePercent,
        startDate: row.start_date,
        status: row.status,
        sourceEstimateId: row.source_estimate_id,
        sourceEstimateNumber: row.source_estimate_number || null,
        sourceEstimateCustomerName: row.source_estimate_customer_name || null,
        financials: {
          totalIncome,
          totalExpenses,
          totalLabor,
          totalHours,
          totalCosts,
          totalInvoiced,
          totalCollected,
          unpaidInvoices,
          unpaidInvoiceBalance,
          remainingContract,
          profit,
        },
      };
    }),
  });
});