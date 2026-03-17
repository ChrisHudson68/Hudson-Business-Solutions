import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/connection.js';
import * as jobs from '../db/queries/jobs.js';
import * as income from '../db/queries/income.js';
import * as expenses from '../db/queries/expenses.js';
import { loginRequired, roleRequired } from '../middleware/auth.js';
import {
  saveUploadedFile,
  deleteUploadedFile,
  RECEIPT_EXTENSIONS,
  RECEIPT_MIME_TYPES,
  buildTenantReceiptUploadDir,
  buildTenantReceiptStoredPath,
  resolveUploadedFilePath,
  inferMimeTypeFromStoredFilename,
  buildSafeDownloadFilename,
} from '../services/file-upload.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { AddIncomePage } from '../pages/jobs/AddIncomePage.js';
import { AddExpensePage } from '../pages/jobs/AddExpensePage.js';
import { getEnv } from '../config/env.js';

const receiptRootDir = path.join(getEnv().uploadDir, 'receipts');

function renderApp(c: any, subtitle: string, content: any, status: 200 | 400 = 200) {
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

function loadJobOr404(db: any, jobId: number, tenantId: number) {
  return jobs.findById(db, jobId, tenantId);
}

function buildIncomeFormData(source: Record<string, unknown>) {
  return {
    amount: String(source.amount ?? ''),
    date: String(source.date ?? ''),
    description: String(source.description ?? ''),
  };
}

function buildExpenseFormData(source: Record<string, unknown>) {
  return {
    category: String(source.category ?? ''),
    vendor: String(source.vendor ?? ''),
    amount: String(source.amount ?? ''),
    date: String(source.date ?? ''),
  };
}

export const jobFinancialRoutes = new Hono<AppEnv>();

jobFinancialRoutes.get('/add_income/:id', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const jobId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!jobId) {
    return c.text('Job not found', 404);
  }

  const job = loadJobOr404(db, jobId, tenantId);
  if (!job) {
    return c.text('Job not found', 404);
  }

  return renderApp(
    c,
    'Add Income',
    <AddIncomePage
      jobId={jobId}
      job={job}
      formData={{ amount: '', date: '', description: '' }}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

jobFinancialRoutes.post('/add_income/:id', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const jobId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!jobId) {
    return c.text('Job not found', 404);
  }

  const job = loadJobOr404(db, jobId, tenantId);
  if (!job) {
    return c.text('Job not found', 404);
  }

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const formData = buildIncomeFormData(body);

  try {
    const amount = parsePositiveMoney(body.amount, 'Amount');
    const date = requireDate(body.date, 'Date');
    const description = optionalText(body.description, 'Description', 255);

    income.create(db, tenantId, {
      job_id: jobId,
      amount,
      date,
      description,
    });

    return c.redirect(`/job/${jobId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save income entry.';

    return renderApp(
      c,
      'Add Income',
      <AddIncomePage
        jobId={jobId}
        job={job}
        formData={formData}
        error={message}
        csrfToken={c.get('csrfToken')}
      />,
      400,
    );
  }
});

jobFinancialRoutes.post('/delete_income/:id', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const incomeId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!incomeId) {
    return c.text('Income entry not found', 404);
  }

  const row = db
    .prepare('SELECT id, job_id FROM income WHERE id = ? AND tenant_id = ?')
    .get(incomeId, tenantId) as { id: number; job_id: number } | undefined;

  if (!row) {
    return c.text('Income entry not found', 404);
  }

  const job = loadJobOr404(db, row.job_id, tenantId);
  if (!job) {
    return c.text('Job not found', 404);
  }

  income.deleteById(db, incomeId, tenantId);

  return c.redirect(`/job/${row.job_id}`);
});

jobFinancialRoutes.get('/add_expense/:id', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const jobId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!jobId) {
    return c.text('Job not found', 404);
  }

  const job = loadJobOr404(db, jobId, tenantId);
  if (!job) {
    return c.text('Job not found', 404);
  }

  return renderApp(
    c,
    'Add Expense',
    <AddExpensePage
      jobId={jobId}
      job={job}
      formData={{ category: '', vendor: '', amount: '', date: '' }}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

jobFinancialRoutes.post('/add_expense/:id', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const jobId = parsePositiveInt(c.req.param('id'));
  const db = getDb();
  const env = getEnv();

  if (!jobId) {
    return c.text('Job not found', 404);
  }

  const job = loadJobOr404(db, jobId, tenantId);
  if (!job) {
    return c.text('Job not found', 404);
  }

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const formData = buildExpenseFormData(body);

  try {
    const category = requireText(body.category, 'Category', 120);
    const vendor = optionalText(body.vendor, 'Vendor', 120);
    const amount = parsePositiveMoney(body.amount, 'Amount');
    const date = requireDate(body.date, 'Date');

    let receiptFilename: string | undefined;

    const file = body.receipt;
    if (file && file instanceof File && file.size > 0) {
      const tenantReceiptDir = buildTenantReceiptUploadDir(receiptRootDir, tenantId);
      const savedFilename = await saveUploadedFile(file, tenantReceiptDir, {
        allowedExtensions: RECEIPT_EXTENSIONS,
        allowedMimeTypes: RECEIPT_MIME_TYPES,
        maxBytes: env.maxReceiptUploadBytes,
      });

      receiptFilename = buildTenantReceiptStoredPath(tenantId, savedFilename);
    }

    const expenseId = expenses.create(db, tenantId, {
      job_id: jobId,
      category,
      vendor,
      amount,
      date,
      receipt_filename: receiptFilename,
    });

    if (currentUser && receiptFilename) {
      logActivity(db, {
        tenantId,
        actorUserId: currentUser.id,
        eventType: 'expense.receipt_uploaded',
        entityType: 'expense',
        entityId: expenseId,
        description: `${currentUser.name} uploaded a receipt for expense ${category} on job ${job.job_name}.`,
        metadata: {
          job_id: job.id,
          job_name: job.job_name,
          category,
          vendor: vendor ?? null,
          amount,
          date,
          receipt_filename: receiptFilename,
        },
        ipAddress: resolveRequestIp(c),
      });
    }

    return c.redirect(`/job/${jobId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save expense entry.';

    return renderApp(
      c,
      'Add Expense',
      <AddExpensePage
        jobId={jobId}
        job={job}
        formData={formData}
        error={message}
        csrfToken={c.get('csrfToken')}
      />,
      400,
    );
  }
});

jobFinancialRoutes.get('/expense-receipts/:id', loginRequired, (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) {
    return c.redirect('/login');
  }

  const tenantId = tenant.id;
  const expenseId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!expenseId) {
    return c.text('Receipt not found', 404);
  }

  const expense = db.prepare(
    `
      SELECT
        e.id,
        e.job_id,
        e.category,
        e.vendor,
        e.amount,
        e.date,
        e.receipt_filename,
        j.job_name
      FROM expenses e
      JOIN jobs j
        ON j.id = e.job_id
       AND j.tenant_id = e.tenant_id
      WHERE e.id = ? AND e.tenant_id = ?
      LIMIT 1
    `,
  ).get(expenseId, tenantId) as
    | {
        id: number;
        job_id: number;
        category: string | null;
        vendor: string | null;
        amount: number | null;
        date: string | null;
        receipt_filename: string | null;
        job_name: string | null;
      }
    | undefined;

  if (!expense || !expense.receipt_filename) {
    return c.text('Receipt not found', 404);
  }

  try {
    const filePath = resolveUploadedFilePath(expense.receipt_filename, receiptRootDir);

    if (!fs.existsSync(filePath)) {
      return c.text('Receipt file not found', 404);
    }

    logActivity(db, {
      tenantId,
      actorUserId: currentUser.id,
      eventType: 'expense.receipt_viewed',
      entityType: 'expense',
      entityId: expense.id,
      description: `${currentUser.name} viewed a receipt for expense ${expense.category || `#${expense.id}`}.`,
      metadata: {
        job_id: expense.job_id,
        job_name: expense.job_name,
        category: expense.category,
        vendor: expense.vendor,
        amount: Number(expense.amount || 0),
        date: expense.date,
        receipt_filename: expense.receipt_filename,
      },
      ipAddress: resolveRequestIp(c),
    });

    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = inferMimeTypeFromStoredFilename(expense.receipt_filename);
    const downloadName = buildSafeDownloadFilename(`expense-${expense.id}-receipt`, expense.receipt_filename);

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${downloadName}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return c.text('Receipt not found', 404);
  }
});

jobFinancialRoutes.post('/delete_expense/:id', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const expenseId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!expenseId) {
    return c.text('Expense entry not found', 404);
  }

  const expense = expenses.findById(db, expenseId, tenantId);
  if (!expense) {
    return c.text('Expense entry not found', 404);
  }

  const job = loadJobOr404(db, expense.job_id, tenantId);
  if (!job) {
    return c.text('Job not found', 404);
  }

  if (expense.receipt_filename) {
    deleteUploadedFile(expense.receipt_filename, receiptRootDir);

    if (currentUser) {
      logActivity(db, {
        tenantId,
        actorUserId: currentUser.id,
        eventType: 'expense.receipt_deleted',
        entityType: 'expense',
        entityId: expense.id,
        description: `${currentUser.name} deleted a receipt attached to expense ${expense.category || `#${expense.id}`}.`,
        metadata: {
          job_id: job.id,
          job_name: job.job_name,
          category: expense.category,
          vendor: expense.vendor,
          amount: Number(expense.amount || 0),
          date: expense.date,
          receipt_filename: expense.receipt_filename,
        },
        ipAddress: resolveRequestIp(c),
      });
    }
  }

  expenses.deleteById(db, expenseId, tenantId);

  return c.redirect(`/job/${expense.job_id}`);
});

export default jobFinancialRoutes;