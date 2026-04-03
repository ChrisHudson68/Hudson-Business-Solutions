import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/connection.js';
import * as jobs from '../db/queries/jobs.js';
import * as income from '../db/queries/income.js';
import * as expenses from '../db/queries/expenses.js';
import * as receiptOcrResults from '../db/queries/receipt-ocr-results.js';
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
import { EditExpensePage } from '../pages/jobs/EditExpensePage.js';
import { getEnv } from '../config/env.js';
import { hasUsefulReceiptSuggestions, runReceiptOcr, type ParsedReceipt } from '../services/receipt-ocr.js';

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

function formatMoneyInput(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '';
  }

  return value.toFixed(2);
}

function mergeExpenseFormDataWithParsedReceipt(
  formData: Record<string, string>,
  parsedReceipt: ParsedReceipt | null | undefined,
) {
  if (!parsedReceipt) {
    return formData;
  }

  return {
    category: formData.category || '',
    vendor: formData.vendor || parsedReceipt.vendorName || '',
    amount: formData.amount || formatMoneyInput(parsedReceipt.total ?? parsedReceipt.subtotal),
    date: formData.date || parsedReceipt.receiptDate || '',
  };
}

function buildReceiptOcrErrorMessage(errorMessage?: string | null): string | null {
  const clean = String(errorMessage ?? '').trim();
  return clean ? clean : null;
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

jobFinancialRoutes.post('/archive_income/:id', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const incomeId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!incomeId) {
    return c.text('Income entry not found', 404);
  }

  const row = income.findById(db, incomeId, tenantId);

  if (!row) {
    return c.text('Income entry not found', 404);
  }

  const job = loadJobOr404(db, row.job_id, tenantId);
  if (!job) {
    return c.text('Job not found', 404);
  }

  if (job.archived_at) {
    return c.redirect(`/job/${row.job_id}`);
  }

  if (row.archived_at) {
    return c.redirect(`/job/${row.job_id}`);
  }

  income.archive(db, incomeId, tenantId, currentUser!.id);

  if (currentUser) {
    logActivity(db, {
      tenantId,
      actorUserId: currentUser.id,
      eventType: 'income.archived',
      entityType: 'income',
      entityId: row.id,
      description: `${currentUser.name} archived an income entry on job ${job.job_name}.`,
      metadata: {
        job_id: job.id,
        job_name: job.job_name,
        amount: Number(row.amount || 0),
        date: row.date,
        description: row.description,
      },
      ipAddress: resolveRequestIp(c),
    });
  }

  return c.redirect(`/job/${row.job_id}`);
});

jobFinancialRoutes.post('/restore_income/:id', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const incomeId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!incomeId) {
    return c.text('Income entry not found', 404);
  }

  const row = income.findById(db, incomeId, tenantId);

  if (!row) {
    return c.text('Income entry not found', 404);
  }

  const job = loadJobOr404(db, row.job_id, tenantId);
  if (!job) {
    return c.text('Job not found', 404);
  }

  if (job.archived_at) {
    return c.redirect(`/job/${row.job_id}`);
  }

  if (!row.archived_at) {
    return c.redirect(`/job/${row.job_id}`);
  }

  income.restore(db, incomeId, tenantId);

  if (currentUser) {
    logActivity(db, {
      tenantId,
      actorUserId: currentUser.id,
      eventType: 'income.restored',
      entityType: 'income',
      entityId: row.id,
      description: `${currentUser.name} restored an income entry on job ${job.job_name}.`,
      metadata: {
        job_id: job.id,
        job_name: job.job_name,
        amount: Number(row.amount || 0),
        date: row.date,
        description: row.description,
      },
      ipAddress: resolveRequestIp(c),
    });
  }

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
      pendingReceiptFilename={null}
      parsedReceipt={null}
      receiptOcrError={null}
      receiptReviewPending={false}
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
  const originalFormData = buildExpenseFormData(body);
  const pendingReceiptFilename = parsePendingReceiptFilename(body.pending_receipt_filename, tenantId);
  const confirmReceiptData = String(body.confirm_receipt_data ?? '').trim() === '1';

  try {
    let receiptFilename = pendingReceiptFilename || undefined;
    let parsedReceipt: ParsedReceipt | null = null;
    let receiptOcrError: string | null = null;

    const file = body.receipt;
    if (file && file instanceof File && file.size > 0) {
      const tenantReceiptDir = buildTenantReceiptUploadDir(receiptRootDir, tenantId);
      const savedFilename = await saveUploadedFile(file, tenantReceiptDir, {
        allowedExtensions: RECEIPT_EXTENSIONS,
        allowedMimeTypes: RECEIPT_MIME_TYPES,
        maxBytes: env.maxReceiptUploadBytes,
      });

      receiptFilename = buildTenantReceiptStoredPath(tenantId, savedFilename);

      if (pendingReceiptFilename && pendingReceiptFilename !== receiptFilename) {
        deleteUploadedFile(pendingReceiptFilename, receiptRootDir);
      }

      const absoluteReceiptPath = resolveUploadedFilePath(receiptFilename, receiptRootDir);
      const ocrResult = await runReceiptOcr(absoluteReceiptPath);

      receiptOcrResults.upsertByReceipt(db, tenantId, receiptFilename, {
        status: ocrResult.status,
        rawText: ocrResult.rawText,
        parsed: ocrResult.parsed,
        errorMessage: ocrResult.errorMessage,
        ocrEngine: ocrResult.ocrEngine,
      });

      parsedReceipt = ocrResult.parsed;
      receiptOcrError = buildReceiptOcrErrorMessage(ocrResult.errorMessage);
    } else if (pendingReceiptFilename) {
      const existingOcr = receiptOcrResults.findLatestByReceipt(db, tenantId, pendingReceiptFilename);
      parsedReceipt = receiptOcrResults.parseParsedReceipt(existingOcr);
      receiptOcrError = buildReceiptOcrErrorMessage(existingOcr?.error_message);
      receiptFilename = pendingReceiptFilename;
    }

    if (receiptFilename && !confirmReceiptData) {
      return renderApp(
        c,
        'Add Expense',
        <AddExpensePage
          jobId={jobId}
          job={job}
          formData={mergeExpenseFormDataWithParsedReceipt(originalFormData, parsedReceipt)}
          parsedReceipt={parsedReceipt}
          receiptOcrError={receiptOcrError}
          pendingReceiptFilename={receiptFilename}
          receiptReviewPending={true}
          csrfToken={c.get('csrfToken')}
        />,
        400,
      );
    }

    const category = requireText(body.category, 'Category', 120);
    const vendor = optionalText(body.vendor, 'Vendor', 120);
    const amount = parsePositiveMoney(body.amount, 'Amount');
    const date = requireDate(body.date, 'Date');

    const expenseId = expenses.create(db, tenantId, {
      job_id: jobId,
      category,
      vendor,
      amount,
      date,
      receipt_filename: receiptFilename,
    });

    if (receiptFilename) {
      receiptOcrResults.attachToExpense(db, tenantId, receiptFilename, expenseId);
    }

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
          receipt_ocr_status: receiptFilename ? receiptOcrResults.findLatestByReceipt(db, tenantId, receiptFilename)?.status ?? null : null,
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
        formData={originalFormData}
        pendingReceiptFilename={pendingReceiptFilename}
        error={message}
        csrfToken={c.get('csrfToken')}
      />,
      400,
    );
  }
});

jobFinancialRoutes.get('/edit_expense/:id', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
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

  if (job.archived_at || expense.archived_at) {
    return c.redirect(`/job/${expense.job_id}`);
  }

  const existingOcr = expense.receipt_filename
    ? receiptOcrResults.findLatestByReceipt(db, tenantId, expense.receipt_filename)
    : undefined;

  return renderApp(
    c,
    'Edit Expense',
    <EditExpensePage
      expenseId={expense.id}
      job={job}
      formData={{
        category: String(expense.category ?? ''),
        vendor: String(expense.vendor ?? ''),
        amount: String(expense.amount ?? ''),
        date: String(expense.date ?? ''),
      }}
      currentReceiptFilename={expense.receipt_filename}
      parsedReceipt={receiptOcrResults.parseParsedReceipt(existingOcr)}
      receiptOcrError={buildReceiptOcrErrorMessage(existingOcr?.error_message)}
      pendingReceiptFilename={null}
      receiptReviewPending={false}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

jobFinancialRoutes.post('/edit_expense/:id', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const expenseId = parsePositiveInt(c.req.param('id'));
  const db = getDb();
  const env = getEnv();

  if (!expenseId) {
    return c.text('Expense entry not found', 404);
  }

  const existingExpense = expenses.findById(db, expenseId, tenantId);
  if (!existingExpense) {
    return c.text('Expense entry not found', 404);
  }

  const job = loadJobOr404(db, existingExpense.job_id, tenantId);
  if (!job) {
    return c.text('Job not found', 404);
  }

  if (job.archived_at || existingExpense.archived_at) {
    return c.redirect(`/job/${existingExpense.job_id}`);
  }

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const originalFormData = buildExpenseFormData(body);
  const pendingReceiptFilename = parsePendingReceiptFilename(body.pending_receipt_filename, tenantId);
  const confirmReceiptData = String(body.confirm_receipt_data ?? '').trim() === '1';

  try {
    let nextReceiptFilename = pendingReceiptFilename ?? existingExpense.receipt_filename ?? null;
    let oldReceiptToDelete: string | null = null;
    let parsedReceipt: ParsedReceipt | null = null;
    let receiptOcrError: string | null = null;

    const file = body.receipt;
    if (file && file instanceof File && file.size > 0) {
      const tenantReceiptDir = buildTenantReceiptUploadDir(receiptRootDir, tenantId);
      const savedFilename = await saveUploadedFile(file, tenantReceiptDir, {
        allowedExtensions: RECEIPT_EXTENSIONS,
        allowedMimeTypes: RECEIPT_MIME_TYPES,
        maxBytes: env.maxReceiptUploadBytes,
      });

      nextReceiptFilename = buildTenantReceiptStoredPath(tenantId, savedFilename);

      if (pendingReceiptFilename && pendingReceiptFilename !== nextReceiptFilename) {
        deleteUploadedFile(pendingReceiptFilename, receiptRootDir);
      }

      const absoluteReceiptPath = resolveUploadedFilePath(nextReceiptFilename, receiptRootDir);
      const ocrResult = await runReceiptOcr(absoluteReceiptPath);

      receiptOcrResults.upsertByReceipt(db, tenantId, nextReceiptFilename, {
        expenseId,
        status: ocrResult.status,
        rawText: ocrResult.rawText,
        parsed: ocrResult.parsed,
        errorMessage: ocrResult.errorMessage,
        ocrEngine: ocrResult.ocrEngine,
      });

      parsedReceipt = ocrResult.parsed;
      receiptOcrError = buildReceiptOcrErrorMessage(ocrResult.errorMessage);

      if (existingExpense.receipt_filename && existingExpense.receipt_filename !== nextReceiptFilename) {
        oldReceiptToDelete = existingExpense.receipt_filename;
      }
    } else if (pendingReceiptFilename) {
      const existingOcr = receiptOcrResults.findLatestByReceipt(db, tenantId, pendingReceiptFilename);
      parsedReceipt = receiptOcrResults.parseParsedReceipt(existingOcr);
      receiptOcrError = buildReceiptOcrErrorMessage(existingOcr?.error_message);
      nextReceiptFilename = pendingReceiptFilename;

      if (existingExpense.receipt_filename && existingExpense.receipt_filename !== pendingReceiptFilename) {
        oldReceiptToDelete = existingExpense.receipt_filename;
      }
    }

    if (nextReceiptFilename && !confirmReceiptData) {
      return renderApp(
        c,
        'Edit Expense',
        <EditExpensePage
          expenseId={existingExpense.id}
          job={job}
          formData={mergeExpenseFormDataWithParsedReceipt(originalFormData, parsedReceipt)}
          currentReceiptFilename={existingExpense.receipt_filename}
          parsedReceipt={parsedReceipt}
          receiptOcrError={receiptOcrError}
          pendingReceiptFilename={nextReceiptFilename}
          receiptReviewPending={true}
          csrfToken={c.get('csrfToken')}
        />,
        400,
      );
    }

    const category = requireText(body.category, 'Category', 120);
    const vendor = optionalText(body.vendor, 'Vendor', 120);
    const amount = parsePositiveMoney(body.amount, 'Amount');
    const date = requireDate(body.date, 'Date');

    expenses.update(db, expenseId, tenantId, {
      category,
      vendor,
      amount,
      date,
      receipt_filename: nextReceiptFilename,
    });

    if (nextReceiptFilename) {
      receiptOcrResults.attachToExpense(db, tenantId, nextReceiptFilename, expenseId);
    }

    if (oldReceiptToDelete) {
      deleteUploadedFile(oldReceiptToDelete, receiptRootDir);
    }

    if (currentUser) {
      logActivity(db, {
        tenantId,
        actorUserId: currentUser.id,
        eventType: 'expense.updated',
        entityType: 'expense',
        entityId: expenseId,
        description: `${currentUser.name} updated expense ${category} on job ${job.job_name}.`,
        metadata: {
          job_id: job.id,
          job_name: job.job_name,
          previous_category: existingExpense.category,
          previous_vendor: existingExpense.vendor,
          previous_amount: existingExpense.amount,
          previous_date: existingExpense.date,
          new_category: category,
          new_vendor: vendor ?? null,
          new_amount: amount,
          new_date: date,
          receipt_filename: nextReceiptFilename,
        },
        ipAddress: resolveRequestIp(c),
      });

      if (nextReceiptFilename && nextReceiptFilename !== existingExpense.receipt_filename) {
        logActivity(db, {
          tenantId,
          actorUserId: currentUser.id,
          eventType: 'expense.receipt_replaced',
          entityType: 'expense',
          entityId: expenseId,
          description: `${currentUser.name} replaced the receipt for expense ${category} on job ${job.job_name}.`,
          metadata: {
            job_id: job.id,
            job_name: job.job_name,
            category,
            vendor: vendor ?? null,
            amount,
            date,
            previous_receipt_filename: existingExpense.receipt_filename,
            receipt_filename: nextReceiptFilename,
            receipt_ocr_status: receiptOcrResults.findLatestByReceipt(db, tenantId, nextReceiptFilename)?.status ?? null,
          },
          ipAddress: resolveRequestIp(c),
        });
      }
    }

    return c.redirect(`/job/${job.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update expense entry.';
    const existingOcr = existingExpense.receipt_filename
      ? receiptOcrResults.findLatestByReceipt(db, tenantId, existingExpense.receipt_filename)
      : undefined;

    return renderApp(
      c,
      'Edit Expense',
      <EditExpensePage
        expenseId={existingExpense.id}
        job={job}
        formData={originalFormData}
        currentReceiptFilename={existingExpense.receipt_filename}
        parsedReceipt={receiptOcrResults.parseParsedReceipt(existingOcr)}
        receiptOcrError={buildReceiptOcrErrorMessage(existingOcr?.error_message)}
        pendingReceiptFilename={pendingReceiptFilename}
        receiptReviewPending={false}
        error={message}
        csrfToken={c.get('csrfToken')}
      />,
      400,
    );
  }
});

jobFinancialRoutes.post('/delete_expense_receipt/:id', roleRequired('Admin', 'Manager'), (c) => {
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

  if (job.archived_at || expense.archived_at) {
    return c.redirect(`/job/${expense.job_id}`);
  }

  if (!expense.receipt_filename) {
    return c.redirect(`/edit_expense/${expense.id}`);
  }

  deleteUploadedFile(expense.receipt_filename, receiptRootDir);
  expenses.clearReceipt(db, expense.id, tenantId);

  if (currentUser) {
    logActivity(db, {
      tenantId,
      actorUserId: currentUser.id,
      eventType: 'expense.receipt_removed',
      entityType: 'expense',
      entityId: expense.id,
      description: `${currentUser.name} removed the receipt from expense ${expense.category || `#${expense.id}`}.`,
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

  return c.redirect(`/edit_expense/${expense.id}`);
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

jobFinancialRoutes.post('/archive_expense/:id', roleRequired('Admin', 'Manager'), (c) => {
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

  if (job.archived_at) {
    return c.redirect(`/job/${expense.job_id}`);
  }

  if (expense.archived_at) {
    return c.redirect(`/job/${expense.job_id}`);
  }

  expenses.archive(db, expenseId, tenantId, currentUser!.id);

  if (currentUser) {
    logActivity(db, {
      tenantId,
      actorUserId: currentUser.id,
      eventType: 'expense.archived',
      entityType: 'expense',
      entityId: expense.id,
      description: `${currentUser.name} archived expense ${expense.category || `#${expense.id}`} on job ${job.job_name}.`,
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

  return c.redirect(`/job/${expense.job_id}`);
});

jobFinancialRoutes.post('/restore_expense/:id', roleRequired('Admin', 'Manager'), (c) => {
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

  if (job.archived_at) {
    return c.redirect(`/job/${expense.job_id}`);
  }

  if (!expense.archived_at) {
    return c.redirect(`/job/${expense.job_id}`);
  }

  expenses.restore(db, expenseId, tenantId);

  if (currentUser) {
    logActivity(db, {
      tenantId,
      actorUserId: currentUser.id,
      eventType: 'expense.restored',
      entityType: 'expense',
      entityId: expense.id,
      description: `${currentUser.name} restored expense ${expense.category || `#${expense.id}`} on job ${job.job_name}.`,
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

  return c.redirect(`/job/${expense.job_id}`);
});

export default jobFinancialRoutes;