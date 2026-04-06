import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getEnv } from '../config/env.js';
import { getDb } from '../db/connection.js';
import * as jobs from '../db/queries/jobs.js';
import { resolveRequestUser, userHasPermission } from '../middleware/auth.js';

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

function weekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parsePositiveInt(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function loadEmployeeForUser(db: any, userId: number, tenantId: number) {
  return db.prepare(`
    SELECT u.employee_id, e.name AS employee_name
    FROM users u
    LEFT JOIN employees e
      ON e.id = u.employee_id
     AND e.tenant_id = u.tenant_id
     AND e.active = 1
    WHERE u.id = ? AND u.tenant_id = ?
    LIMIT 1
  `).get(userId, tenantId) as { employee_id: number | null; employee_name: string | null } | undefined;
}

function loadActiveClockEntry(db: any, tenantId: number, employeeId: number | null) {
  if (!employeeId) return null;

  return db.prepare(`
    SELECT
      t.id,
      t.job_id,
      COALESCE(j.job_name, 'General Time') AS job_name,
      t.clock_in_at
    FROM time_entries t
    LEFT JOIN jobs j
      ON j.id = t.job_id
     AND j.tenant_id = t.tenant_id
    WHERE t.tenant_id = ?
      AND t.employee_id = ?
      AND t.entry_method = 'clock'
      AND t.clock_in_at IS NOT NULL
      AND t.clock_out_at IS NULL
    ORDER BY t.id DESC
    LIMIT 1
  `).get(tenantId, employeeId) as
    | {
        id: number;
        job_id: number | null;
        job_name: string;
        clock_in_at: string;
      }
    | null;
}

function loadExistingEntriesForRange(
  db: any,
  tenantId: number,
  employeeId: number,
  start: string,
  end: string,
) {
  return db.prepare(`
    SELECT
      t.id,
      t.employee_id,
      e.name AS employee_name,
      t.date,
      t.job_id,
      COALESCE(j.job_name, 'Unassigned / General Time') AS job_name,
      t.hours,
      t.note,
      t.clock_in_at,
      t.clock_out_at,
      t.entry_method,
      t.approval_status,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM time_entry_edit_requests r
          WHERE r.time_entry_id = t.id
            AND r.tenant_id = t.tenant_id
            AND r.status = 'pending'
        )
        THEN 1
        ELSE 0
      END AS has_pending_edit_request
    FROM time_entries t
    JOIN employees e
      ON e.id = t.employee_id
     AND e.tenant_id = t.tenant_id
    LEFT JOIN jobs j
      ON j.id = t.job_id
     AND j.tenant_id = t.tenant_id
    WHERE t.employee_id = ?
      AND t.date BETWEEN ? AND ?
      AND t.tenant_id = ?
    ORDER BY t.date ASC, t.clock_in_at ASC, t.id ASC
  `).all(employeeId, start, end, tenantId) as Array<{
    id: number;
    employee_id: number;
    employee_name: string;
    date: string;
    job_id: number | null;
    job_name: string;
    hours: number;
    note: string | null;
    clock_in_at: string | null;
    clock_out_at: string | null;
    entry_method: string;
    approval_status: string;
    has_pending_edit_request: number;
  }>;
}

function loadWeekApproval(db: any, tenantId: number, employeeId: number, start: string) {
  return db.prepare(`
    SELECT
      w.id,
      w.employee_id,
      w.week_start,
      w.approved_at,
      w.note,
      w.approved_by_user_id,
      u.name AS approved_by_name
    FROM time_entry_week_approvals w
    LEFT JOIN users u ON u.id = w.approved_by_user_id AND u.tenant_id = w.tenant_id
    WHERE w.tenant_id = ? AND w.employee_id = ? AND w.week_start = ?
    LIMIT 1
  `).get(tenantId, employeeId, start) as
    | {
        id: number;
        employee_id: number;
        week_start: string;
        approved_at: string;
        note: string | null;
        approved_by_user_id: number;
        approved_by_name: string | null;
      }
    | null;
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

apiRoutes.get('/api/csrf-token', (c) => {
  return c.json({
    ok: true,
    csrfToken: c.get('csrfToken'),
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

apiRoutes.get('/api/jobs/:id', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) {
    return resolved.response;
  }

  const { tenant } = resolved;
  const db = getDb();
  const jobId = Number(c.req.param('id'));

  if (!jobId || Number.isNaN(jobId)) {
    return c.json(
      {
        ok: false,
        error: 'invalid_id',
      },
      400,
    );
  }

  const row = jobs.findWithFinancialsById(db, jobId, tenant.id);

  if (!row || row.archived_at) {
    return c.json(
      {
        ok: false,
        error: 'not_found',
      },
      404,
    );
  }

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

  return c.json({
    ok: true,
    job: {
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
    },
  });
});

apiRoutes.get('/api/timesheets', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) {
    return resolved.response;
  }

  const { user, tenant } = resolved;
  const db = getDb();

  const requestedEmployeeId = parsePositiveInt(c.req.query('employeeId'));
  const requestedStart = String(c.req.query('start') || '').trim();

  const linkedEmployee = loadEmployeeForUser(db, user.id, tenant.id);
  const isEmployeeUser = user.role === 'Employee';
  const canApproveTime = userHasPermission(user, 'time.approve');
  const canUseSelfClock = userHasPermission(user, 'time.clock') && !!linkedEmployee?.employee_id;

  let employeeId: number | null = null;

  if (isEmployeeUser) {
    employeeId = linkedEmployee?.employee_id ?? null;
  } else if (requestedEmployeeId) {
    employeeId = requestedEmployeeId;
  } else if (linkedEmployee?.employee_id) {
    employeeId = linkedEmployee.employee_id;
  }

  if (!employeeId) {
    return c.json(
      {
        ok: false,
        error: 'employee_required',
      },
      400,
    );
  }

  const start = /^\d{4}-\d{2}-\d{2}$/.test(requestedStart)
    ? weekStart(requestedStart)
    : weekStart(toIsoDate(new Date()));
  const end = addDays(start, 6);

  const entries = loadExistingEntriesForRange(db, tenant.id, employeeId, start, end);
  const weekApproval = loadWeekApproval(db, tenant.id, employeeId, start);
  const activeClockEntry = canUseSelfClock
    ? loadActiveClockEntry(db, tenant.id, linkedEmployee?.employee_id ?? null)
    : null;

  const totalHours = Number(
    entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0).toFixed(2),
  );

  return c.json({
    ok: true,
    scope: {
      employeeId,
      start,
      end,
      isEmployeeUser,
      canApproveTime,
      canUseSelfClock,
    },
    summary: {
      entryCount: entries.length,
      totalHours,
      weekApproved: !!weekApproval,
      approvedAt: weekApproval?.approved_at || null,
      approvedByName: weekApproval?.approved_by_name || null,
    },
    activeClockEntry: activeClockEntry
      ? {
          id: activeClockEntry.id,
          jobId: activeClockEntry.job_id,
          jobName: activeClockEntry.job_name,
          clockInAt: activeClockEntry.clock_in_at,
        }
      : null,
    timesheets: entries.map((entry) => ({
      id: entry.id,
      employeeId: entry.employee_id,
      employeeName: entry.employee_name,
      date: entry.date,
      jobId: entry.job_id,
      jobName: entry.job_name,
      hours: Number(entry.hours || 0),
      note: entry.note,
      clockInAt: entry.clock_in_at,
      clockOutAt: entry.clock_out_at,
      entryMethod: entry.entry_method,
      approvalStatus: entry.approval_status,
      hasPendingEditRequest: Number(entry.has_pending_edit_request || 0) === 1,
    })),
  });
});

apiRoutes.post('/api/timesheets/clock-in', async (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) {
    return resolved.response;
  }

  const { user, tenant } = resolved;
  const db = getDb();

  const linkedEmployee = loadEmployeeForUser(db, user.id, tenant.id);

  if (!linkedEmployee?.employee_id) {
    return c.json(
      {
        ok: false,
        error: 'employee_required',
      },
      400,
    );
  }

  const activeEntry = loadActiveClockEntry(db, tenant.id, linkedEmployee.employee_id);
  if (activeEntry) {
    return c.json(
      {
        ok: false,
        error: 'already_clocked_in',
      },
      409,
    );
  }

  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const requestedJobId = parsePositiveInt(body.jobId);
  const note =
    typeof body.note === 'string' && body.note.trim().length > 0 ? body.note.trim() : null;

  let jobId: number | null = null;

  if (requestedJobId) {
    const job = db.prepare(`
      SELECT id, job_name
      FROM jobs
      WHERE id = ? AND tenant_id = ? AND archived_at IS NULL
      LIMIT 1
    `).get(requestedJobId, tenant.id) as { id: number; job_name: string } | undefined;

    if (!job) {
      return c.json(
        {
          ok: false,
          error: 'invalid_job',
        },
        400,
      );
    }

    jobId = job.id;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const date = nowIso.slice(0, 10);

  const result = db.prepare(`
    INSERT INTO time_entries (
      tenant_id,
      employee_id,
      job_id,
      date,
      hours,
      note,
      clock_in_at,
      clock_out_at,
      entry_method,
      approval_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'clock', 'pending')
  `).run(
    tenant.id,
    linkedEmployee.employee_id,
    jobId,
    date,
    0,
    note,
    nowIso,
  );

  return c.json({
    ok: true,
    entry: {
      id: Number(result.lastInsertRowid),
      employeeId: linkedEmployee.employee_id,
      jobId,
      date,
      note,
      clockInAt: nowIso,
      entryMethod: 'clock',
      approvalStatus: 'pending',
    },
  });
});

apiRoutes.post('/api/timesheets/clock-out', async (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) {
    return resolved.response;
  }

  const { user, tenant } = resolved;
  const db = getDb();

  const linkedEmployee = loadEmployeeForUser(db, user.id, tenant.id);

  if (!linkedEmployee?.employee_id) {
    return c.json(
      {
        ok: false,
        error: 'employee_required',
      },
      400,
    );
  }

  const activeEntry = loadActiveClockEntry(db, tenant.id, linkedEmployee.employee_id);
  if (!activeEntry) {
    return c.json(
      {
        ok: false,
        error: 'not_clocked_in',
      },
      409,
    );
  }

  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const note =
    typeof body.note === 'string' && body.note.trim().length > 0 ? body.note.trim() : null;

  const now = new Date();
  const clockOutAt = now.toISOString();
  const clockInAt = new Date(activeEntry.clock_in_at);
  const elapsedMs = now.getTime() - clockInAt.getTime();
  const hours = Math.max(0, Number((elapsedMs / (1000 * 60 * 60)).toFixed(2)));

  db.prepare(`
    UPDATE time_entries
    SET
      clock_out_at = ?,
      hours = ?,
      note = COALESCE(?, note)
    WHERE id = ? AND tenant_id = ?
  `).run(clockOutAt, hours, note, activeEntry.id, tenant.id);

  return c.json({
    ok: true,
    entry: {
      id: activeEntry.id,
      jobId: activeEntry.job_id,
      jobName: activeEntry.job_name,
      clockInAt: activeEntry.clock_in_at,
      clockOutAt,
      hours,
      note,
    },
  });
});