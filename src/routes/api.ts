import path from 'node:path';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getEnv } from '../config/env.js';
import { getDb } from '../db/connection.js';
import * as jobs from '../db/queries/jobs.js';
import * as expenses from '../db/queries/expenses.js';
import * as receiptOcrResults from '../db/queries/receipt-ocr-results.js';
import * as income from '../db/queries/income.js';
import * as invoices from '../db/queries/invoices.js';
import * as payments from '../db/queries/payments.js';
import * as employees from '../db/queries/employees.js';
import * as timeEntries from '../db/queries/time-entries.js';
import { generateInvoicePdf } from '../services/invoice-pdf.js';
import { resolveRequestUser, userHasPermission } from '../middleware/auth.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';
import {
  saveUploadedFile,
  deleteUploadedFile,
  RECEIPT_EXTENSIONS,
  RECEIPT_MIME_TYPES,
  buildTenantReceiptUploadDir,
  buildTenantReceiptStoredPath,
  resolveUploadedFilePath,
} from '../services/file-upload.js';
import { hasUsefulReceiptSuggestions, runReceiptOcr } from '../services/receipt-ocr.js';

const receiptRootDir = path.join(getEnv().uploadDir, 'receipts');

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

function requireManagerOrAdmin(c: any, user: { role: string }) {
  if (user.role !== 'Admin' && user.role !== 'Manager') {
    return c.json(
      {
        ok: false,
        error: 'forbidden',
      },
      403,
    );
  }

  return null;
}

function requireApiPermission(c: any, user: { permissions?: string[] }, permission: string) {
  if (!userHasPermission(user as any, permission)) {
    return c.json(
      {
        ok: false,
        error: 'forbidden',
      },
      403,
    );
  }

  return null;
}

function sanitizeJobRowForApi(row: any, includeFinancials: boolean) {
  const baseJob = {
    id: row.id,
    jobName: row.job_name,
    jobCode: row.job_code,
    jobDescription: row.job_description,
    clientName: row.client_name,
    startDate: row.start_date,
    status: row.status,
    isOverhead: Number(row.is_overhead || 0) === 1,
    sourceEstimateId: row.source_estimate_id,
    sourceEstimateNumber: row.source_estimate_number || null,
    sourceEstimateCustomerName: row.source_estimate_customer_name || null,
  };

  if (!includeFinancials) {
    return baseJob;
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

  return {
    ...baseJob,
    soldBy: row.sold_by,
    commissionPercent: Number(row.commission_percent || 0),
    contractAmount,
    retainagePercent,
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
}

function sanitizeClockInJobRow(row: any) {
  return {
    id: row.id,
    jobName: row.job_name,
    jobCode: row.job_code,
    clientName: row.client_name,
    status: row.status,
    isOverhead: Number(row.is_overhead || 0) === 1,
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

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;

  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function requireDate(value: unknown, fieldLabel: string): string {
  const raw = String(value ?? '').trim();

  if (!raw) {
    throw new Error(`${fieldLabel} is required.`);
  }

  if (!isRealIsoDate(raw)) {
    throw new Error(`${fieldLabel} must be a valid date.`);
  }

  return raw;
}

function parsePositiveMoney(value: unknown, fieldLabel: string): number {
  const raw = String(value ?? '').trim();

  if (!raw) {
    throw new Error(`${fieldLabel} is required.`);
  }

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`${fieldLabel} must be a valid number with up to 2 decimal places.`);
  }

  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldLabel} must be greater than 0.`);
  }

  return Number(parsed.toFixed(2));
}

function requireText(value: unknown, fieldLabel: string, maxLength: number): string {
  const raw = String(value ?? '').trim();

  if (!raw) {
    throw new Error(`${fieldLabel} is required.`);
  }

  if (raw.length > maxLength) {
    throw new Error(`${fieldLabel} must be ${maxLength} characters or less.`);
  }

  return raw;
}

function optionalText(value: unknown, fieldLabel: string, maxLength: number): string | undefined {
  const raw = String(value ?? '').trim();

  if (!raw) return undefined;

  if (raw.length > maxLength) {
    throw new Error(`${fieldLabel} must be ${maxLength} characters or less.`);
  }

  return raw;
}

function parsePendingReceiptFilename(value: unknown, tenantId: number): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const parts = raw.split('/');
  if (parts.length < 2) return null;

  const pathTenantId = Number.parseInt(parts[0] || '0', 10);
  if (!Number.isInteger(pathTenantId) || pathTenantId !== tenantId) {
    return null;
  }

  try {
    return buildTenantReceiptStoredPath(tenantId, parts.slice(1).join('/'));
  } catch {
    return null;
  }
}

function buildReceiptOcrErrorMessage(errorMessage?: string | null): string | null {
  const clean = String(errorMessage ?? '').trim();
  return clean ? clean : null;
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

  const { user, tenant } = resolved;
  const jobsAccessError = requireApiPermission(c, user, 'jobs.view');
  if (jobsAccessError) {
    return jobsAccessError;
  }

  const includeFinancials = userHasPermission(user, 'financials.view');
  const db = getDb();
  const rows = jobs.listWithFinancials(db, tenant.id, false);

  return c.json({
    ok: true,
    jobs: rows.map((row) => sanitizeJobRowForApi(row, includeFinancials)),
  });
});

apiRoutes.get('/api/jobs/:id', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) {
    return resolved.response;
  }

  const { user, tenant } = resolved;
  const jobsAccessError = requireApiPermission(c, user, 'jobs.view');
  if (jobsAccessError) {
    return jobsAccessError;
  }

  const includeFinancials = userHasPermission(user, 'financials.view');
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

  return c.json({
    ok: true,
    job: sanitizeJobRowForApi(row, includeFinancials),
  });
});

apiRoutes.get('/api/timesheets/clock-in-jobs', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) {
    return resolved.response;
  }

  const { user, tenant } = resolved;
  const clockAccessError = requireApiPermission(c, user, 'time.clock');
  if (clockAccessError) {
    return clockAccessError;
  }

  const db = getDb();
  const rows = jobs.listWithFinancials(db, tenant.id, false);

  return c.json({
    ok: true,
    jobs: rows.map((row) => sanitizeClockInJobRow(row)),
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
  const lat = typeof body.lat === 'number' && isFinite(body.lat) ? body.lat : null;
  const lng = typeof body.lng === 'number' && isFinite(body.lng) ? body.lng : null;

  if (!requestedJobId) {
    return c.json(
      {
        ok: false,
        error: 'job_required',
      },
      400,
    );
  }

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

  const jobId: number = job.id;

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
      approval_status,
      lat,
      lng
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'clock', 'pending', ?, ?)
  `).run(
    tenant.id,
    linkedEmployee.employee_id,
    jobId,
    date,
    0,
    note,
    nowIso,
    lat,
    lng,
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
      lat,
      lng,
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

apiRoutes.post('/api/expenses/upload-receipt', async (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) {
    return resolved.response;
  }

  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) {
    return accessError;
  }

  const db = getDb();
  const env = getEnv();
  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const file = body.receipt;

  if (!(file instanceof File) || file.size <= 0) {
    return c.json(
      {
        ok: false,
        error: 'receipt_required',
      },
      400,
    );
  }

  const pendingReceiptFilename =
    parsePendingReceiptFilename(body.pendingReceiptFilename, tenant.id) ??
    parsePendingReceiptFilename(body.pending_receipt_filename, tenant.id);

  try {
    const tenantReceiptDir = buildTenantReceiptUploadDir(receiptRootDir, tenant.id);
    const savedFilename = await saveUploadedFile(file, tenantReceiptDir, {
      allowedExtensions: RECEIPT_EXTENSIONS,
      allowedMimeTypes: RECEIPT_MIME_TYPES,
      maxBytes: env.maxReceiptUploadBytes,
    });

    const receiptFilename = buildTenantReceiptStoredPath(tenant.id, savedFilename);

    if (pendingReceiptFilename && pendingReceiptFilename !== receiptFilename) {
      deleteUploadedFile(pendingReceiptFilename, receiptRootDir);
    }

    const absoluteReceiptPath = resolveUploadedFilePath(receiptFilename, receiptRootDir);
    const ocrResult = await runReceiptOcr(absoluteReceiptPath);

    receiptOcrResults.upsertByReceipt(db, tenant.id, receiptFilename, {
      status: ocrResult.status,
      rawText: ocrResult.rawText,
      parsed: ocrResult.parsed,
      errorMessage: ocrResult.errorMessage,
      ocrEngine: ocrResult.ocrEngine,
    });

    return c.json({
      ok: true,
      receipt: {
        receiptFilename,
        status: ocrResult.status,
        ocrEngine: ocrResult.ocrEngine,
        errorMessage: buildReceiptOcrErrorMessage(ocrResult.errorMessage),
        hasSuggestions: hasUsefulReceiptSuggestions(ocrResult.parsed),
        parsed: ocrResult.parsed,
      },
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unable to upload receipt.',
      },
      400,
    );
  }
});

apiRoutes.post('/api/expenses', async (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) {
    return resolved.response;
  }

  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) {
    return accessError;
  }

  const db = getDb();
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));

  try {
    const jobId = parsePositiveInt(body.jobId);
    if (!jobId) {
      throw new Error('Job is required.');
    }

    const job = jobs.findById(db, jobId, tenant.id);
    if (!job || job.archived_at) {
      return c.json(
        {
          ok: false,
          error: 'job_not_found',
        },
        404,
      );
    }

    const category = requireText(body.category, 'Category', 120);
    const vendor = optionalText(body.vendor, 'Vendor', 120);
    const amount = parsePositiveMoney(body.amount, 'Amount');
    const date = requireDate(body.date, 'Date');
    const receiptFilename =
      parsePendingReceiptFilename(body.receiptFilename, tenant.id) ??
      parsePendingReceiptFilename(body.receipt_filename, tenant.id) ??
      undefined;

    const expenseId = expenses.create(db, tenant.id, {
      job_id: jobId,
      category,
      vendor,
      amount,
      date,
      receipt_filename: receiptFilename,
    });

    if (receiptFilename) {
      receiptOcrResults.attachToExpense(db, tenant.id, receiptFilename, expenseId);
    }

    if (user && receiptFilename) {
      logActivity(db, {
        tenantId: tenant.id,
        actorUserId: user.id,
        eventType: 'expense.receipt_uploaded',
        entityType: 'expense',
        entityId: expenseId,
        description: `${user.name} uploaded a receipt for expense ${category} on job ${job.job_name}.`,
        metadata: {
          job_id: job.id,
          job_name: job.job_name,
          category,
          vendor: vendor ?? null,
          amount,
          date,
          receipt_filename: receiptFilename,
          receipt_ocr_status:
            receiptOcrResults.findLatestByReceipt(db, tenant.id, receiptFilename)?.status ?? null,
        },
        ipAddress: resolveRequestIp(c),
      });
    }

    const savedExpense = expenses.findById(db, expenseId, tenant.id);
    const ocrRecord = receiptFilename
      ? receiptOcrResults.findLatestByReceipt(db, tenant.id, receiptFilename)
      : undefined;

    return c.json({
      ok: true,
      expense: {
        id: expenseId,
        jobId: savedExpense?.job_id ?? jobId,
        category: savedExpense?.category ?? category,
        vendor: savedExpense?.vendor ?? vendor ?? null,
        amount: Number(savedExpense?.amount ?? amount),
        date: savedExpense?.date ?? date,
        receiptFilename: savedExpense?.receipt_filename ?? receiptFilename ?? null,
        receiptOcrStatus: ocrRecord?.status ?? null,
      },
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unable to save expense entry.',
      },
      400,
    );
  }
});

// ─── Jobs CRUD ────────────────────────────────────────────────────────────────

apiRoutes.post('/api/jobs', async (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));

  try {
    const jobName = requireText(body.jobName, 'Job name', 200);
    const jobCode = optionalText(body.jobCode, 'Job code', 50);
    const clientName = optionalText(body.clientName, 'Client name', 200);
    const soldBy = optionalText(body.soldBy, 'Sold by', 200);
    const jobDescription = optionalText(body.jobDescription, 'Description', 2000);
    const status = optionalText(body.status, 'Status', 50) ?? 'Active';
    const isOverhead = body.isOverhead === true ? 1 : 0;
    const contractAmount = body.contractAmount != null ? Number(body.contractAmount) : null;
    const startDate = body.startDate ? optionalText(body.startDate, 'Start date', 20) : undefined;

    const jobId = jobs.create(db, tenant.id, {
      job_name: jobName,
      job_code: jobCode,
      client_name: clientName,
      sold_by: soldBy,
      job_description: jobDescription,
      contract_amount: contractAmount && isFinite(contractAmount) ? contractAmount : null,
      start_date: startDate ?? null,
      status,
      is_overhead: isOverhead,
    });

    return c.json({ ok: true, jobId });
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : 'Failed to create job.' }, 400);
  }
});

apiRoutes.patch('/api/jobs/:id', async (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const jobId = parsePositiveInt(c.req.param('id'));
  if (!jobId) return c.json({ ok: false, error: 'invalid_id' }, 400);

  const existing = jobs.findById(db, jobId, tenant.id);
  if (!existing || existing.archived_at) return c.json({ ok: false, error: 'not_found' }, 404);

  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));

  try {
    const row = existing as any;
    jobs.update(db, jobId, tenant.id, {
      job_name: body.jobName != null ? requireText(body.jobName, 'Job name', 200) : row.job_name,
      job_code: body.jobCode != null ? (optionalText(body.jobCode, 'Job code', 50) ?? null) : row.job_code,
      client_name: body.clientName != null ? (optionalText(body.clientName, 'Client name', 200) ?? null) : row.client_name,
      sold_by: body.soldBy != null ? (optionalText(body.soldBy, 'Sold by', 200) ?? null) : row.sold_by,
      job_description: body.jobDescription != null ? (optionalText(body.jobDescription, 'Description', 2000) ?? null) : row.job_description,
      status: body.status != null ? String(body.status) : row.status,
      is_overhead: body.isOverhead != null ? (body.isOverhead ? 1 : 0) : row.is_overhead,
      contract_amount: body.contractAmount != null ? Number(body.contractAmount) : row.contract_amount,
      start_date: body.startDate != null ? (optionalText(body.startDate, 'Start date', 20) ?? null) : row.start_date,
    });
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : 'Failed to update job.' }, 400);
  }
});

// ─── Job Income ───────────────────────────────────────────────────────────────

apiRoutes.get('/api/jobs/:id/income', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const jobId = parsePositiveInt(c.req.param('id'));
  if (!jobId) return c.json({ ok: false, error: 'invalid_id' }, 400);

  const job = jobs.findById(db, jobId, tenant.id);
  if (!job || job.archived_at) return c.json({ ok: false, error: 'not_found' }, 404);

  const rows = income.listByJob(db, jobId, tenant.id);
  return c.json({
    ok: true,
    income: rows.map(r => ({
      id: r.id,
      jobId: r.job_id,
      amount: Number(r.amount),
      date: r.date,
      description: r.description ?? null,
    })),
  });
});

apiRoutes.post('/api/jobs/:id/income', async (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const jobId = parsePositiveInt(c.req.param('id'));
  if (!jobId) return c.json({ ok: false, error: 'invalid_id' }, 400);

  const job = jobs.findById(db, jobId, tenant.id);
  if (!job || job.archived_at) return c.json({ ok: false, error: 'not_found' }, 404);

  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  try {
    const amount = parsePositiveMoney(body.amount, 'Amount');
    const date = requireDate(body.date, 'Date');
    const description = optionalText(body.description, 'Description', 500);

    const incomeId = income.create(db, tenant.id, { job_id: jobId, amount, date, description });
    const saved = income.findById(db, incomeId, tenant.id);
    return c.json({
      ok: true,
      income: { id: incomeId, jobId, amount: Number(saved?.amount ?? amount), date, description: description ?? null },
    });
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : 'Failed to add income.' }, 400);
  }
});

apiRoutes.delete('/api/jobs/:id/income/:incomeId', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const jobId = parsePositiveInt(c.req.param('id'));
  const incomeId = parsePositiveInt(c.req.param('incomeId'));
  if (!jobId || !incomeId) return c.json({ ok: false, error: 'invalid_id' }, 400);

  const row = income.findById(db, incomeId, tenant.id);
  if (!row || (row as any).job_id !== jobId) return c.json({ ok: false, error: 'not_found' }, 404);

  income.deleteById(db, incomeId, tenant.id);
  return c.json({ ok: true });
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

apiRoutes.get('/api/invoices', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const rows = invoices.listByTenant(db, tenant.id, false);

  return c.json({
    ok: true,
    invoices: rows.map(r => {
      const totalPaid = payments.sumByInvoice(db, r.id, tenant.id);
      return {
        id: r.id,
        jobId: r.job_id,
        jobName: r.job_name ?? null,
        clientName: r.client_name ?? null,
        invoiceNumber: r.invoice_number ?? null,
        dateIssued: r.date_issued,
        dueDate: r.due_date,
        amount: Number(r.amount),
        status: r.status,
        notes: r.notes ?? null,
        totalPaid: Number(totalPaid),
        balance: Math.max(0, Number(r.amount) - Number(totalPaid)),
      };
    }),
  });
});

apiRoutes.get('/api/invoices/:id', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const invoiceId = parsePositiveInt(c.req.param('id'));
  if (!invoiceId) return c.json({ ok: false, error: 'invalid_id' }, 400);

  const row = invoices.findById(db, invoiceId, tenant.id);
  if (!row || row.archived_at) return c.json({ ok: false, error: 'not_found' }, 404);

  const invPayments = payments.listByInvoice(db, invoiceId, tenant.id);
  const totalPaid = invPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  return c.json({
    ok: true,
    invoice: {
      id: row.id,
      jobId: row.job_id,
      jobName: row.job_name ?? null,
      clientName: row.client_name ?? null,
      invoiceNumber: row.invoice_number ?? null,
      dateIssued: row.date_issued,
      dueDate: row.due_date,
      amount: Number(row.amount),
      status: row.status,
      notes: row.notes ?? null,
      totalPaid: Number(totalPaid),
      balance: Math.max(0, Number(row.amount) - Number(totalPaid)),
      payments: invPayments.map(p => ({
        id: p.id,
        date: p.date,
        amount: Number(p.amount),
        method: p.method ?? null,
        reference: p.reference ?? null,
      })),
    },
  });
});

apiRoutes.post('/api/invoices', async (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));

  try {
    const jobId = parsePositiveInt(body.jobId);
    if (!jobId) throw new Error('Job is required.');
    const job = jobs.findById(db, jobId, tenant.id);
    if (!job || job.archived_at) return c.json({ ok: false, error: 'job_not_found' }, 404);

    const dateIssued = requireDate(body.dateIssued, 'Date issued');
    const dueDate = requireDate(body.dueDate, 'Due date');
    const amount = parsePositiveMoney(body.amount, 'Amount');
    const notes = optionalText(body.notes, 'Notes', 2000);

    const invoiceNumber = invoices.nextInvoiceNumber(db, tenant.id, 'INV');
    const invoiceId = invoices.create(db, tenant.id, {
      job_id: jobId,
      invoice_number: invoiceNumber,
      date_issued: dateIssued,
      due_date: dueDate,
      amount,
      notes,
    });

    const saved = invoices.findById(db, invoiceId, tenant.id);
    return c.json({
      ok: true,
      invoice: {
        id: invoiceId,
        jobId,
        jobName: saved?.job_name ?? null,
        invoiceNumber,
        dateIssued,
        dueDate,
        amount,
        status: 'Unpaid',
        notes: notes ?? null,
        totalPaid: 0,
        balance: amount,
      },
    });
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : 'Failed to create invoice.' }, 400);
  }
});

apiRoutes.post('/api/invoices/:id/payments', async (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const invoiceId = parsePositiveInt(c.req.param('id'));
  if (!invoiceId) return c.json({ ok: false, error: 'invalid_id' }, 400);

  const row = invoices.findById(db, invoiceId, tenant.id);
  if (!row || row.archived_at) return c.json({ ok: false, error: 'not_found' }, 404);

  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  try {
    const amount = parsePositiveMoney(body.amount, 'Amount');
    const date = requireDate(body.date, 'Date');
    const method = optionalText(body.method, 'Method', 50);
    const reference = optionalText(body.reference, 'Reference', 100);

    const paymentId = payments.create(db, tenant.id, { invoice_id: invoiceId, date, amount, method, reference });

    const totalPaid = payments.sumByInvoice(db, invoiceId, tenant.id);
    const balance = Math.max(0, Number(row.amount) - Number(totalPaid));
    const newStatus = balance <= 0 ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Unpaid';
    invoices.updateStatus(db, invoiceId, tenant.id, newStatus);

    return c.json({
      ok: true,
      payment: { id: paymentId, date, amount, method: method ?? null, reference: reference ?? null },
    });
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : 'Failed to record payment.' }, 400);
  }
});

// ─── Employees ────────────────────────────────────────────────────────────────

apiRoutes.get('/api/employees', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const rows = employees.listByTenant(db, tenant.id);

  return c.json({
    ok: true,
    employees: rows.map(e => ({
      id: e.id,
      name: e.name,
      payType: e.pay_type,
      hourlyRate: e.hourly_rate != null ? Number(e.hourly_rate) : null,
      annualSalary: e.annual_salary != null ? Number(e.annual_salary) : null,
      active: e.active,
    })),
  });
});

// ─── Manual Time Entry ────────────────────────────────────────────────────────

apiRoutes.post('/api/timesheets/manual', async (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));

  try {
    const jobId = parsePositiveInt(body.jobId);
    if (!jobId) throw new Error('Job is required.');
    const job = jobs.findById(db, jobId, tenant.id);
    if (!job || job.archived_at) return c.json({ ok: false, error: 'job_not_found' }, 404);

    const date = requireDate(body.date, 'Date');
    const hoursRaw = Number(body.hours);
    if (!isFinite(hoursRaw) || hoursRaw <= 0) throw new Error('Hours must be a positive number.');
    const hours = Number(hoursRaw.toFixed(2));
    const note = optionalText(body.note, 'Note', 500);

    let employeeId: number | null = null;
    const requestedEmployeeId = parsePositiveInt(body.employeeId);
    if (requestedEmployeeId) {
      const emp = employees.findById(db, requestedEmployeeId, tenant.id);
      if (!emp) return c.json({ ok: false, error: 'employee_not_found' }, 404);
      employeeId = emp.id;
    } else {
      const linked = db.prepare(
        'SELECT employee_id FROM users WHERE id = ? AND tenant_id = ? LIMIT 1'
      ).get(user.id, tenant.id) as { employee_id: number | null } | undefined;
      employeeId = linked?.employee_id ?? null;
    }

    if (!employeeId) throw new Error('No employee linked. Specify an employeeId.');

    const result = db.prepare(`
      INSERT INTO time_entries (tenant_id, employee_id, job_id, date, hours, note, entry_method, approval_status)
      VALUES (?, ?, ?, ?, ?, ?, 'manual', 'pending')
    `).run(tenant.id, employeeId, jobId, date, hours, note ?? null);

    return c.json({ ok: true, entry: { id: Number(result.lastInsertRowid) } });
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : 'Failed to save time entry.' }, 400);
  }
});

// ─── Job Expenses & Time Entries (for job detail tabs) ────────────────────────

apiRoutes.get('/api/jobs/:id/expenses', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const jobId = parsePositiveInt(c.req.param('id'));
  if (!jobId) return c.json({ ok: false, error: 'invalid_id' }, 400);

  const job = jobs.findById(db, jobId, tenant.id);
  if (!job || job.archived_at) return c.json({ ok: false, error: 'not_found' }, 404);

  const rows = expenses.listByJob(db, jobId, tenant.id, false);
  return c.json({
    ok: true,
    expenses: rows.map(r => ({
      id: r.id,
      jobId: r.job_id,
      category: r.category,
      vendor: r.vendor ?? null,
      amount: Number(r.amount),
      date: r.date,
    })),
  });
});

apiRoutes.patch('/api/expenses/:id', async (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, resolved.user);
  if (accessError) return accessError;

  const db = getDb();
  const expenseId = parsePositiveInt(c.req.param('id'));
  if (!expenseId) return c.json({ ok: false, error: 'invalid_id' }, 400);

  const row = expenses.findById(db, expenseId, tenant.id);
  if (!row || row.archived_at) return c.json({ ok: false, error: 'not_found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const category = requireText(body.category, 'Category', 120);
  const vendor = optionalText(body.vendor, 'Vendor', 120);
  const amount = parsePositiveMoney(body.amount, 'Amount');
  const date = requireDate(body.date, 'Date');

  expenses.update(db, expenseId, tenant.id, { category, vendor, amount, date });
  return c.json({ ok: true });
});

apiRoutes.delete('/api/expenses/:id', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, resolved.user);
  if (accessError) return accessError;

  const db = getDb();
  const expenseId = parsePositiveInt(c.req.param('id'));
  if (!expenseId) return c.json({ ok: false, error: 'invalid_id' }, 400);

  const row = expenses.findById(db, expenseId, tenant.id);
  if (!row || row.archived_at) return c.json({ ok: false, error: 'not_found' }, 404);

  expenses.deleteById(db, expenseId, tenant.id);
  return c.json({ ok: true });
});

apiRoutes.get('/api/jobs/:id/time-entries', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const jobId = parsePositiveInt(c.req.param('id'));
  if (!jobId) return c.json({ ok: false, error: 'invalid_id' }, 400);

  const job = jobs.findById(db, jobId, tenant.id);
  if (!job || job.archived_at) return c.json({ ok: false, error: 'not_found' }, 404);

  const rows = timeEntries.listByJob(db, jobId, tenant.id);
  return c.json({
    ok: true,
    entries: rows.map(r => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      date: r.date,
      hours: Number(r.hours || 0),
      note: r.note ?? null,
      entryMethod: r.entry_method ?? null,
    })),
  });
});

apiRoutes.delete('/api/timesheets/:id', (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const entryId = parsePositiveInt(c.req.param('id'));
  if (!entryId) return c.json({ ok: false, error: 'invalid_id' }, 400);

  const row = db.prepare(
    'SELECT id FROM time_entries WHERE id = ? AND tenant_id = ? LIMIT 1'
  ).get(entryId, tenant.id) as { id: number } | undefined;

  if (!row) return c.json({ ok: false, error: 'not_found' }, 404);

  timeEntries.deleteById(db, entryId, tenant.id);
  return c.json({ ok: true });
});

apiRoutes.patch('/api/timesheets/:id', async (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const entryId = parsePositiveInt(c.req.param('id'));
  if (!entryId) return c.json({ ok: false, error: 'invalid_id' }, 400);

  const row = db.prepare(
    'SELECT id FROM time_entries WHERE id = ? AND tenant_id = ? LIMIT 1'
  ).get(entryId, tenant.id) as { id: number } | undefined;
  if (!row) return c.json({ ok: false, error: 'not_found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const hours = body.hours !== undefined ? Number(body.hours) : undefined;
  if (hours !== undefined && (isNaN(hours) || hours <= 0 || hours > 24)) {
    return c.json({ ok: false, error: 'invalid_hours' }, 400);
  }

  timeEntries.updateById(db, entryId, tenant.id, {
    hours,
    note: body.note !== undefined ? (String(body.note).trim() || null) : undefined,
    date: body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : undefined,
    job_id: body.jobId ? parsePositiveInt(String(body.jobId)) ?? undefined : undefined,
  });

  return c.json({ ok: true });
});

apiRoutes.post('/api/timesheets/approve-week', async (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;

  const permError = requireApiPermission(c, user, 'time.approve');
  if (permError) return permError;

  const db = getDb();
  const body = await c.req.json().catch(() => ({}));
  const employeeId = parsePositiveInt(String(body.employeeId || ''));
  const weekStart = String(body.weekStart || '').trim();

  if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return c.json({ ok: false, error: 'invalid_params' }, 400);
  }

  const empRow = db.prepare(
    'SELECT id FROM employees WHERE id = ? AND tenant_id = ? LIMIT 1'
  ).get(employeeId, tenant.id) as { id: number } | undefined;
  if (!empRow) return c.json({ ok: false, error: 'not_found' }, 404);

  timeEntries.approveWeek(db, tenant.id, employeeId, weekStart, user.id);
  return c.json({ ok: true });
});

// ─── Invoice PDF ──────────────────────────────────────────────────────────────

apiRoutes.get('/api/invoices/:id/pdf', async (c) => {
  const resolved = resolveApiContext(c);
  if (!resolved.ok) return resolved.response;
  const { user, tenant } = resolved;
  const accessError = requireManagerOrAdmin(c, user);
  if (accessError) return accessError;

  const db = getDb();
  const invoiceId = parsePositiveInt(c.req.param('id'));
  if (!invoiceId) return c.json({ ok: false, error: 'invalid_id' }, 400);

  const tenantRow = db.prepare(
    'SELECT id, name, subdomain, logo_path, company_email, company_phone, company_address FROM tenants WHERE id = ? LIMIT 1'
  ).get(tenant.id) as any;

  const inv = db.prepare(`
    SELECT i.*, j.job_name, j.job_code
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.id = ? AND i.tenant_id = ?
  `).get(invoiceId, tenant.id) as any;

  if (!inv || inv.archived_at) return c.json({ ok: false, error: 'not_found' }, 404);

  const lineItems = db.prepare(`
    SELECT description, quantity, unit, unit_price, line_total
    FROM invoice_line_items
    WHERE invoice_id = ? AND tenant_id = ?
    ORDER BY sort_order ASC
  `).all(invoiceId, tenant.id) as any[];

  const paidRow = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoice_id = ? AND tenant_id = ?'
  ).get(invoiceId, tenant.id) as any;

  const paid = Number(paidRow?.total || 0);
  const total = Number(inv.total_amount || inv.amount || 0);
  const outstanding = Math.max(total - paid, 0);

  const pdfBytes = await generateInvoicePdf({
    tenant: {
      name: tenantRow?.name ?? tenant.name,
      logo_path: tenantRow?.logo_path ?? null,
      company_address: tenantRow?.company_address ?? null,
      company_email: tenantRow?.company_email ?? null,
      company_phone: tenantRow?.company_phone ?? null,
    },
    invoice: {
      id: inv.id,
      invoice_number: inv.invoice_number,
      date_issued: inv.date_issued,
      due_date: inv.due_date,
      subtotal_amount: inv.subtotal_amount || total,
      discount_amount: inv.discount_amount || 0,
      tax_amount: inv.tax_amount || 0,
      total_amount: total,
      public_notes: inv.public_notes ?? inv.notes ?? null,
      terms_text: inv.terms_text ?? null,
      status: inv.status || 'Draft',
    },
    customer: {
      name: inv.customer_name ?? inv.client_name ?? null,
      email: inv.customer_email ?? null,
      phone: inv.customer_phone ?? null,
      address: inv.customer_address ?? null,
    },
    job: {
      job_name: inv.job_name,
      job_code: inv.job_code,
    },
    lineItems,
    paid,
    outstanding,
  });

  const filename = `invoice_${inv.invoice_number || inv.id}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
});