import fs from 'node:fs';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import * as jobs from '../db/queries/jobs.js';
import * as income from '../db/queries/income.js';
import * as expenses from '../db/queries/expenses.js';
import * as timeEntries from '../db/queries/time-entries.js';
import * as jobBlueprints from '../db/queries/job-blueprints.js';
import { loginRequired, roleRequired } from '../middleware/auth.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';
import {
  buildSafeDownloadFilename,
  buildTenantScopedStoredPath,
  buildTenantScopedUploadDir,
  DOCUMENT_ATTACHMENT_EXTENSIONS,
  DOCUMENT_ATTACHMENT_MIME_TYPES,
  inferMimeTypeFromStoredFilename,
  resolveUploadedFilePath,
  saveUploadedFile,
} from '../services/file-upload.js';
import { JobsListPage } from '../pages/jobs/JobsListPage.js';
import { JobDetailPage } from '../pages/jobs/JobDetailPage.js';
import { JobMergePage } from '../pages/jobs/JobMergePage.js';
import { AddJobPage } from '../pages/jobs/AddJobPage.js';
import { EditJobPage } from '../pages/jobs/EditJobPage.js';
import { JobBlueprintsPage } from '../pages/jobs/JobBlueprintsPage.js';

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

const ALLOWED_JOB_STATUSES = ['Active', 'Completed', 'On Hold', 'Cancelled'] as const;
type JobStatus = (typeof ALLOWED_JOB_STATUSES)[number];

function parsePositiveInt(value: string): number | null {
  if (!/^\d+$/.test(String(value || '').trim())) return null;
  const parsed = Number.parseInt(value, 10);
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

function normalizeOptionalDate(value: unknown, fieldLabel: string): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;

  if (!isRealIsoDate(raw)) {
    throw new Error(`${fieldLabel} must be a valid date.`);
  }

  return raw;
}

function requireText(value: unknown, fieldLabel: string, maxLength: number): string {
  const parsed = String(value ?? '').trim();

  if (!parsed) {
    throw new Error(`${fieldLabel} is required.`);
  }

  if (parsed.length > maxLength) {
    throw new Error(`${fieldLabel} must be ${maxLength} characters or less.`);
  }

  return parsed;
}

function normalizeOptionalJobCode(value: unknown): string | undefined {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return undefined;

  const normalized = raw.replace(/\s+/g, '-');

  if (normalized.length > 40) {
    throw new Error('Job code must be 40 characters or less.');
  }

  if (!/^[A-Z0-9][A-Z0-9\-_]*$/.test(normalized)) {
    throw new Error('Job code may only contain letters, numbers, dashes, and underscores.');
  }

  return normalized;
}

function parseNonNegativeMoney(value: unknown, fieldLabel: string): number {
  const raw = String(value ?? '').trim();

  if (!raw) return 0;

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`${fieldLabel} must be a valid non-negative number with up to 2 decimal places.`);
  }

  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a valid non-negative number.`);
  }

  return Number(parsed.toFixed(2));
}

function parsePercent(value: unknown, fieldLabel: string): number {
  const raw = String(value ?? '').trim();

  if (!raw) return 0;

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`${fieldLabel} must be a valid percentage.`);
  }

  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`${fieldLabel} must be between 0 and 100.`);
  }

  return Number(parsed.toFixed(2));
}

function parseStatus(value: unknown): JobStatus {
  const parsed = String(value ?? 'Active').trim() as JobStatus;

  if (!ALLOWED_JOB_STATUSES.includes(parsed)) {
    throw new Error('Please select a valid job status.');
  }

  return parsed;
}

function normalizeOptionalText(value: unknown, fieldLabel: string, maxLength: number): string | undefined {
  const parsed = String(value ?? '').trim();

  if (!parsed) return undefined;

  if (parsed.length > maxLength) {
    throw new Error(`${fieldLabel} must be ${maxLength} characters or less.`);
  }

  return parsed;
}

function buildJobFormData(source: Record<string, unknown>) {
  return {
    job_name: String(source.job_name ?? ''),
    job_code: String(source.job_code ?? ''),
    client_name: String(source.client_name ?? ''),
    sold_by: String(source.sold_by ?? ''),
    commission_percent: String(source.commission_percent ?? '0'),
    job_description: String(source.job_description ?? ''),
    contract_amount: String(source.contract_amount ?? ''),
    retainage_percent: String(source.retainage_percent ?? '0'),
    start_date: String(source.start_date ?? ''),
    status: String(source.status ?? 'Active'),
    is_overhead: source.is_overhead === '1' || source.is_overhead === 1 ? '1' : '0',
  };
}

function buildJobListData(rows: any[]) {
  const jobList: any[] = [];
  let totalContract = 0;
  let totalIncome = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let totalInvoiced = 0;
  let totalPayments = 0;
  let totalUnpaidInvoiceBalance = 0;

  for (const row of rows) {
    const contractAmount = Number(row.contract_amount || 0);
    const incomeTotal = Number(row.total_income || 0);
    const expenseTotal = Number(row.total_expenses || 0);
    const laborTotal = Number(row.total_labor || 0);
    const invoiceTotal = Number(row.total_invoiced || 0);
    const paymentsTotal = Number(row.total_collected || 0);
    const retainagePercent = Number(row.retainage_percent || 0);

    const totalCosts = expenseTotal + laborTotal;
    const profit = incomeTotal - totalCosts;
    const remainingContract = contractAmount - incomeTotal;
    const profitMargin = incomeTotal > 0 ? (profit / incomeTotal) * 100 : 0;
    const retainageHeld = retainagePercent > 0 ? (incomeTotal * retainagePercent) / 100 : 0;
    const unpaidInvoiceBalance = Math.max(invoiceTotal - paymentsTotal, 0);

    totalContract += contractAmount;
    totalIncome += incomeTotal;
    totalCost += totalCosts;
    totalProfit += profit;
    totalInvoiced += invoiceTotal;
    totalPayments += paymentsTotal;
    totalUnpaidInvoiceBalance += unpaidInvoiceBalance;

    jobList.push({
      id: row.id,
      job_name: row.job_name,
      job_code: row.job_code,
      client_name: row.client_name,
      contract_amount: contractAmount,
      retainage_percent: retainagePercent,
      start_date: row.start_date,
      status: row.status || 'Unknown',
      income_total: incomeTotal,
      expense_total: expenseTotal,
      labor_total: laborTotal,
      invoice_total: invoiceTotal,
      payments_total: paymentsTotal,
      total_costs: totalCosts,
      profit,
      profit_margin: profitMargin,
      remaining_contract: remainingContract,
      retainage_held: retainageHeld,
      unpaid_invoice_balance: unpaidInvoiceBalance,
      archived_at: row.archived_at || null,
      source_estimate_id: row.source_estimate_id ?? null,
      source_estimate_number: row.source_estimate_number ?? null,
    });
  }

  return {
    jobList,
    totalContract,
    totalIncome,
    totalCost,
    totalProfit,
    totalInvoiced,
    totalPayments,
    totalUnpaidInvoiceBalance,
  };
}

function ensureUniqueJobCode(db: any, tenantId: number, jobCode?: string, ignoreJobId?: number) {
  if (!jobCode) return;

  const row = ignoreJobId
    ? db.prepare(`
        SELECT id
        FROM jobs
        WHERE tenant_id = ? AND upper(job_code) = upper(?) AND id != ?
        LIMIT 1
      `).get(tenantId, jobCode, ignoreJobId)
    : db.prepare(`
        SELECT id
        FROM jobs
        WHERE tenant_id = ? AND upper(job_code) = upper(?)
        LIMIT 1
      `).get(tenantId, jobCode);

  if (row) {
    throw new Error('That job code already exists.');
  }
}

function canManageJobs(user: any): boolean {
  return user?.role === 'Admin' || user?.role === 'Manager';
}

const jobBlueprintRootDir = `${process.env.UPLOAD_DIR ?? './data'}/job_blueprints`;

function normalizeOptionalSearch(value: unknown, maxLength = 120): string {
  return String(value ?? '').trim().slice(0, maxLength);
}

export const jobRoutes = new Hono<AppEnv>();

jobRoutes.get('/', loginRequired, (c) => c.redirect('/dashboard'));

jobRoutes.get('/jobs', loginRequired, (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const db = getDb();
  const showArchived = c.req.query('show_archived') === '1';
  const canManage = canManageJobs(currentUser);

  const rows = jobs.listWithFinancials(db, tenantId, showArchived);
  const summary = buildJobListData(rows);

  return renderApp(
    c,
    'Jobs',
    <JobsListPage
      jobs={summary.jobList}
      totalJobs={summary.jobList.length}
      totalContract={summary.totalContract}
      totalIncome={summary.totalIncome}
      totalCost={summary.totalCost}
      totalProfit={summary.totalProfit}
      totalInvoiced={summary.totalInvoiced}
      totalPayments={summary.totalPayments}
      totalUnpaidInvoiceBalance={summary.totalUnpaidInvoiceBalance}
      csrfToken={c.get('csrfToken')}
      showArchived={showArchived}
      canCreateJobs={canManage}
      canEditJobs={canManage}
      canArchiveJobs={canManage}
      canMergeJobs={canManage}
    />,
  );
});

jobRoutes.get('/job/:id', loginRequired, (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const jobId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!jobId) {
    return c.text('Job not found', 404);
  }

  const job = jobs.findWithFinancialsById(db, jobId, tenantId);
  if (!job) {
    return c.text('Job not found', 404);
  }

  const incomes = income.listByJob(db, jobId, tenantId);
  const archivedIncomes = income.listArchivedByJob(db, jobId, tenantId);
  const jobExpenses = expenses.listByJob(db, jobId, tenantId);
  const archivedExpenses = expenses.listArchivedByJob(db, jobId, tenantId);
  const jobTime = timeEntries.listByJob(db, jobId, tenantId);

  const totalIncome = Number(job.total_income || 0);
  const totalExpenses = Number(job.total_expenses || 0);
  const totalLabor = Number(job.total_labor || 0);
  const totalCosts = totalExpenses + totalLabor;
  const profit = totalIncome - totalCosts;
  const retainageHeld = Number(job.retainage_percent || 0) > 0
    ? (totalIncome * Number(job.retainage_percent || 0)) / 100
    : 0;

  return renderApp(
    c,
    'Job Detail',
    <JobDetailPage
      job={job as any}
      incomes={incomes}
      archivedIncomes={archivedIncomes}
      expenses={jobExpenses}
      archivedExpenses={archivedExpenses}
      timeEntries={jobTime}
      totalIncome={totalIncome}
      totalExpenses={totalExpenses}
      totalLabor={totalLabor}
      totalCosts={totalCosts}
      profit={profit}
      retainageHeld={retainageHeld}
      csrfToken={c.get('csrfToken')}
      linkedEstimates={jobs.listLinkedEstimates(db, jobId, tenantId)}
    />,
  );
});

jobRoutes.get('/jobs/merge', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const db = getDb();

  const rawIds = c.req.queries('ids') ?? [];
  const jobIds = rawIds.map((v) => parsePositiveInt(v)).filter((id): id is number => !!id);

  if (jobIds.length < 2) {
    return c.redirect('/jobs');
  }

  const mergeJobs = jobs.findManyByIds(db, jobIds, tenantId);

  if (mergeJobs.length < 2) {
    return c.redirect('/jobs');
  }

  return renderApp(
    c,
    'Merge Jobs',
    <JobMergePage jobs={mergeJobs} csrfToken={c.get('csrfToken')} />,
  );
});

jobRoutes.post('/jobs/merge', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const db = getDb();
  const currentUser = c.get('user');

  const body = (await c.req.parseBody({ all: true })) as Record<string, unknown>;
  const rawIds = Array.isArray(body.job_ids) ? body.job_ids : body.job_ids ? [body.job_ids] : [];
  const jobIds = (rawIds as string[]).map((v) => parsePositiveInt(v)).filter((id): id is number => !!id);
  const primaryJobId = parsePositiveInt(String(body.primary_job_id ?? ''));

  if (jobIds.length < 2 || !primaryJobId || !jobIds.includes(primaryJobId)) {
    return c.redirect('/jobs');
  }

  const mergeJobs = jobs.findManyByIds(db, jobIds, tenantId);
  if (mergeJobs.length !== jobIds.length) {
    return c.redirect('/jobs');
  }

  const secondaryIds = jobIds.filter((id) => id !== primaryJobId);

  jobs.mergeJobs(db, primaryJobId, secondaryIds, tenantId);

  logActivity(db, {
    tenantId,
    actorUserId: currentUser?.id ?? null,
    eventType: 'job.merged',
    entityType: 'job',
    entityId: primaryJobId,
    description: `Merged job IDs [${secondaryIds.join(', ')}] into job ${primaryJobId}`,
    ipAddress: resolveRequestIp(c) ?? '',
  });

  return c.redirect(`/job/${primaryJobId}`);
});

jobRoutes.get('/add_job', roleRequired('Admin', 'Manager'), (c) => {
  return renderApp(
    c,
    'Add Job',
    <AddJobPage
      formData={{
        job_name: '',
        job_code: '',
        client_name: '',
        sold_by: '',
        commission_percent: '0',
        job_description: '',
        contract_amount: '',
        retainage_percent: '0',
        start_date: '',
        status: 'Active',
      }}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

jobRoutes.post('/add_job', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const db = getDb();
  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const formData = buildJobFormData(body);

  try {
    const jobName = requireText(body.job_name, 'Job name', 120);
    const jobCode = normalizeOptionalJobCode(body.job_code);
    const clientName = requireText(body.client_name, 'Client name', 120);
    const soldBy = normalizeOptionalText(body.sold_by, 'Sold by', 120);
    const commissionPercent = parsePercent(body.commission_percent, 'Commission percent');
    const jobDescription = normalizeOptionalText(body.job_description, 'Job description', 5000);
    const contractAmount = parseNonNegativeMoney(body.contract_amount, 'Contract amount');
    const retainagePercent = parsePercent(body.retainage_percent, 'Retainage percent');
    const startDate = normalizeOptionalDate(body.start_date, 'Start date');
    const status = parseStatus(body.status);

    ensureUniqueJobCode(db, tenantId, jobCode);

    const isOverhead = body.is_overhead === '1' ? 1 : 0;

    const jobId = jobs.create(db, tenantId, {
      job_name: jobName,
      job_code: jobCode,
      client_name: clientName,
      sold_by: soldBy ?? null,
      commission_percent: commissionPercent,
      job_description: jobDescription ?? null,
      contract_amount: contractAmount,
      retainage_percent: retainagePercent,
      start_date: startDate,
      status,
      is_overhead: isOverhead,
    });

    if (currentUser) {
      logActivity(db, {
        tenantId,
        actorUserId: currentUser.id,
        eventType: 'job.created',
        entityType: 'job',
        entityId: jobId,
        description: `${currentUser.name} created job ${jobName}.`,
        metadata: {
          job_name: jobName,
          job_code: jobCode ?? null,
          client_name: clientName,
          sold_by: soldBy ?? null,
          commission_percent: commissionPercent,
          job_description: jobDescription ?? null,
          contract_amount: contractAmount,
          retainage_percent: retainagePercent,
          start_date: startDate ?? null,
          status,
        },
        ipAddress: resolveRequestIp(c),
      });
    }

    return c.redirect('/jobs');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create job.';
    return renderApp(
      c,
      'Add Job',
      <AddJobPage
        formData={formData}
        error={message}
        csrfToken={c.get('csrfToken')}
      />,
      400,
    );
  }
});

jobRoutes.get('/edit_job/:id', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const jobId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!jobId) {
    return c.text('Job not found', 404);
  }

  const job = jobs.findById(db, jobId, tenantId);
  if (!job) {
    return c.text('Job not found', 404);
  }

  return renderApp(
    c,
    'Edit Job',
    <EditJobPage
      jobId={job.id}
      formData={{
        job_name: job.job_name || '',
        job_code: job.job_code || '',
        client_name: job.client_name || '',
        sold_by: job.sold_by || '',
        commission_percent: String(Number(job.commission_percent || 0)),
        job_description: job.job_description || '',
        contract_amount: String(Number(job.contract_amount || 0)),
        retainage_percent: String(Number(job.retainage_percent || 0)),
        start_date: job.start_date || '',
        status: job.status || 'Active',
        is_overhead: Number(job.is_overhead || 0) === 1 ? '1' : '0',
      }}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

jobRoutes.post('/edit_job/:id', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const jobId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!jobId) {
    return c.text('Job not found', 404);
  }

  const existingJob = jobs.findById(db, jobId, tenantId);
  if (!existingJob) {
    return c.text('Job not found', 404);
  }

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const formData = buildJobFormData(body);

  try {
    const jobName = requireText(body.job_name, 'Job name', 120);
    const jobCode = normalizeOptionalJobCode(body.job_code);
    const clientName = requireText(body.client_name, 'Client name', 120);
    const soldBy = normalizeOptionalText(body.sold_by, 'Sold by', 120);
    const commissionPercent = parsePercent(body.commission_percent, 'Commission percent');
    const jobDescription = normalizeOptionalText(body.job_description, 'Job description', 5000);
    const contractAmount = parseNonNegativeMoney(body.contract_amount, 'Contract amount');
    const retainagePercent = parsePercent(body.retainage_percent, 'Retainage percent');
    const startDate = normalizeOptionalDate(body.start_date, 'Start date');
    const status = parseStatus(body.status);

    ensureUniqueJobCode(db, tenantId, jobCode, jobId);

    const isOverhead = body.is_overhead === '1' ? 1 : 0;

    jobs.update(db, jobId, tenantId, {
      job_name: jobName,
      job_code: jobCode,
      client_name: clientName,
      sold_by: soldBy ?? null,
      commission_percent: commissionPercent,
      job_description: jobDescription ?? null,
      contract_amount: contractAmount,
      retainage_percent: retainagePercent,
      start_date: startDate,
      status,
      is_overhead: isOverhead,
    });

    if (currentUser) {
      logActivity(db, {
        tenantId,
        actorUserId: currentUser.id,
        eventType: 'job.updated',
        entityType: 'job',
        entityId: jobId,
        description: `${currentUser.name} updated job ${jobName}.`,
        metadata: {
          job_name: jobName,
          job_code: jobCode ?? null,
          client_name: clientName,
          sold_by: soldBy ?? null,
          commission_percent: commissionPercent,
          job_description: jobDescription ?? null,
          contract_amount: contractAmount,
          retainage_percent: retainagePercent,
          start_date: startDate ?? null,
          status,
        },
        ipAddress: resolveRequestIp(c),
      });
    }

    return c.redirect(`/job/${jobId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update job.';
    return renderApp(
      c,
      'Edit Job',
      <EditJobPage
        jobId={jobId}
        formData={formData}
        error={message}
        csrfToken={c.get('csrfToken')}
      />,
      400,
    );
  }
});

jobRoutes.post('/archive_job/:id', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const jobId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!jobId) {
    return c.text('Job not found', 404);
  }

  const existingJob = jobs.findById(db, jobId, tenantId);
  if (!existingJob) {
    return c.text('Job not found', 404);
  }

  jobs.archive(db, jobId, tenantId, currentUser!.id);

  logActivity(db, {
    tenantId,
    actorUserId: currentUser?.id,
    eventType: 'job.archived',
    entityType: 'job',
    entityId: jobId,
    description: `${currentUser?.name || 'User'} archived job ${existingJob.job_name}.`,
    metadata: {
      job_name: existingJob.job_name,
      job_code: existingJob.job_code ?? null,
      client_name: existingJob.client_name ?? null,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect('/jobs');
});

jobRoutes.post('/restore_job/:id', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const jobId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!jobId) {
    return c.text('Job not found', 404);
  }

  const existingJob = jobs.findById(db, jobId, tenantId);
  if (!existingJob) {
    return c.text('Job not found', 404);
  }

  jobs.restore(db, jobId, tenantId);

  logActivity(db, {
    tenantId,
    actorUserId: currentUser?.id,
    eventType: 'job.restored',
    entityType: 'job',
    entityId: jobId,
    description: `${currentUser?.name || 'User'} restored job ${existingJob.job_name}.`,
    metadata: {
      job_name: existingJob.job_name,
      job_code: existingJob.job_code ?? null,
      client_name: existingJob.client_name ?? null,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect('/jobs?show_archived=1');
});


jobRoutes.get('/job-blueprints', loginRequired, (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const db = getDb();
  const search = normalizeOptionalSearch(c.req.query('search'));
  const selectedJobId = parsePositiveInt(c.req.query('job_id') || '');
  const success = normalizeOptionalSearch(c.req.query('success'), 160);
  const error = normalizeOptionalSearch(c.req.query('error'), 160);

  const jobRows = jobBlueprints.listJobsWithBlueprintCounts(db, tenantId, search);

  let selectedJob = null as any;
  if (selectedJobId) {
    selectedJob = jobs.findById(db, selectedJobId, tenantId) || null;
  }

  const documents = selectedJob
    ? jobBlueprints.listByJob(db, tenantId, selectedJob.id, false)
    : [];

  return renderApp(
    c,
    'Job Blueprints',
    <JobBlueprintsPage
      jobs={jobRows}
      search={search}
      selectedJob={selectedJob}
      documents={documents}
      canManage={canManageJobs(currentUser)}
      csrfToken={c.get('csrfToken')}
      success={success || undefined}
      error={error || undefined}
    />,
  );
});

jobRoutes.post('/job-blueprints/upload', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const db = getDb();

  let jobIdForRedirect: number | null = null;

  try {
    const body = await c.req.parseBody();
    const jobId = parsePositiveInt(String(body.job_id || ''));
    jobIdForRedirect = jobId;
    if (!jobId) {
      throw new Error('Please choose a valid job.');
    }

    const job = jobs.findById(db, jobId, tenantId);
    if (!job || job.archived_at) {
      throw new Error('Selected job was not found.');
    }

    const title = requireText(body.title, 'Title', 120);
    const notes = normalizeOptionalText(body.notes, 'Notes', 2000);
    const document = body.document;
    if (!(document instanceof File) || document.size <= 0) {
      throw new Error('Please choose a blueprint file to upload.');
    }

    const uploadDir = buildTenantScopedUploadDir(jobBlueprintRootDir, tenantId);
    const storedFilename = await saveUploadedFile(document, uploadDir, {
      allowedExtensions: DOCUMENT_ATTACHMENT_EXTENSIONS,
      allowedMimeTypes: DOCUMENT_ATTACHMENT_MIME_TYPES,
      maxBytes: 10 * 1024 * 1024,
    });

    const storedPath = buildTenantScopedStoredPath(tenantId, storedFilename);
    const blueprintId = jobBlueprints.create(db, tenantId, {
      job_id: jobId,
      title,
      notes: notes ?? null,
      file_filename: storedPath,
      original_filename: document.name || null,
      uploaded_by_user_id: currentUser?.id ?? null,
    });

    logActivity(db, {
      tenantId,
      actorUserId: currentUser?.id,
      eventType: 'job.blueprint_uploaded',
      entityType: 'job_blueprint',
      entityId: blueprintId,
      description: `${currentUser?.name || 'User'} uploaded a blueprint for job ${job.job_name}.`,
      metadata: {
        job_id: job.id,
        job_name: job.job_name,
        title,
        original_filename: document.name || null,
      },
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect(`/job-blueprints?job_id=${jobId}&success=${encodeURIComponent('Blueprint uploaded.')}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to upload blueprint.';
    const fallback = jobIdForRedirect ? `?job_id=${jobIdForRedirect}&error=${encodeURIComponent(message)}` : `?error=${encodeURIComponent(message)}`;
    return c.redirect(`/job-blueprints${fallback}`);
  }
});

jobRoutes.post('/job-blueprints/:id/archive', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const blueprintId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!blueprintId) {
    return c.redirect('/job-blueprints?error=' + encodeURIComponent('Blueprint file not found.'));
  }

  const blueprint = jobBlueprints.findById(db, tenantId, blueprintId);
  if (!blueprint || blueprint.archived_at) {
    return c.redirect('/job-blueprints?error=' + encodeURIComponent('Blueprint file not found.'));
  }

  jobBlueprints.archive(db, tenantId, blueprintId, currentUser?.id ?? null);

  logActivity(db, {
    tenantId,
    actorUserId: currentUser?.id,
    eventType: 'job.blueprint_archived',
    entityType: 'job_blueprint',
    entityId: blueprintId,
    description: `${currentUser?.name || 'User'} archived blueprint ${blueprint.title}.`,
    metadata: {
      job_id: blueprint.job_id,
      title: blueprint.title,
      original_filename: blueprint.original_filename,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect(`/job-blueprints?job_id=${blueprint.job_id}&success=${encodeURIComponent('Blueprint archived.')}`);
});

jobRoutes.get('/job-blueprints/files/:id', loginRequired, (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const blueprintId = parsePositiveInt(c.req.param('id'));
  const db = getDb();

  if (!blueprintId) {
    return c.text('Blueprint not found', 404);
  }

  const blueprint = jobBlueprints.findById(db, tenantId, blueprintId);
  if (!blueprint || !blueprint.file_filename || blueprint.archived_at) {
    return c.text('Blueprint not found', 404);
  }

  try {
    const filePath = resolveUploadedFilePath(blueprint.file_filename, jobBlueprintRootDir);
    const fileBuffer = fs.readFileSync(filePath);

    c.header('Content-Type', inferMimeTypeFromStoredFilename(blueprint.file_filename));
    c.header('Content-Disposition', `inline; filename="${buildSafeDownloadFilename('job-blueprint', blueprint.file_filename)}"`);

    logActivity(db, {
      tenantId,
      actorUserId: currentUser?.id,
      eventType: 'job.blueprint_viewed',
      entityType: 'job_blueprint',
      entityId: blueprint.id,
      description: `${currentUser?.name || 'User'} opened blueprint ${blueprint.title}.`,
      metadata: {
        job_id: blueprint.job_id,
        title: blueprint.title,
        original_filename: blueprint.original_filename,
      },
      ipAddress: resolveRequestIp(c),
    });

    return c.body(fileBuffer);
  } catch {
    return c.text('Blueprint file missing', 404);
  }
});

export default jobRoutes;