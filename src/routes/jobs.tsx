import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import * as jobs from '../db/queries/jobs.js';
import * as income from '../db/queries/income.js';
import * as expenses from '../db/queries/expenses.js';
import * as timeEntries from '../db/queries/time-entries.js';
import { loginRequired, roleRequired } from '../middleware/auth.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { JobsListPage } from '../pages/jobs/JobsListPage.js';
import { JobDetailPage } from '../pages/jobs/JobDetailPage.js';
import { AddJobPage } from '../pages/jobs/AddJobPage.js';
import { EditJobPage } from '../pages/jobs/EditJobPage.js';

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

function buildJobFormData(source: Record<string, unknown>) {
  return {
    job_name: String(source.job_name ?? ''),
    job_code: String(source.job_code ?? ''),
    client_name: String(source.client_name ?? ''),
    contract_amount: String(source.contract_amount ?? ''),
    retainage_percent: String(source.retainage_percent ?? '0'),
    start_date: String(source.start_date ?? ''),
    status: String(source.status ?? 'Active'),
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

function getDeleteBlockReason(db: any, jobId: number, tenantId: number): string | null {
  const incomeCount = db
    .prepare('SELECT COUNT(*) as total FROM income WHERE job_id = ? AND tenant_id = ?')
    .get(jobId, tenantId) as { total: number };

  if ((incomeCount?.total || 0) > 0) {
    return 'This job cannot be deleted because it already has income records.';
  }

  const expenseCount = db
    .prepare('SELECT COUNT(*) as total FROM expenses WHERE job_id = ? AND tenant_id = ?')
    .get(jobId, tenantId) as { total: number };

  if ((expenseCount?.total || 0) > 0) {
    return 'This job cannot be deleted because it already has expense records.';
  }

  const timeEntryCount = db
    .prepare('SELECT COUNT(*) as total FROM time_entries WHERE job_id = ? AND tenant_id = ?')
    .get(jobId, tenantId) as { total: number };

  if ((timeEntryCount?.total || 0) > 0) {
    return 'This job cannot be deleted because it already has timesheet entries.';
  }

  const invoiceCount = db
    .prepare('SELECT COUNT(*) as total FROM invoices WHERE job_id = ? AND tenant_id = ?')
    .get(jobId, tenantId) as { total: number };

  if ((invoiceCount?.total || 0) > 0) {
    return 'This job cannot be deleted because it already has invoices.';
  }

  return null;
}

function ensureUniqueJobCode(db: any, tenantId: number, jobCode: string | undefined, ignoreJobId?: number) {
  if (!jobCode) return;

  const existing = ignoreJobId
    ? db.prepare(`
        SELECT id
        FROM jobs
        WHERE tenant_id = ? AND UPPER(job_code) = UPPER(?) AND id != ?
        LIMIT 1
      `).get(tenantId, jobCode, ignoreJobId) as { id: number } | undefined
    : db.prepare(`
        SELECT id
        FROM jobs
        WHERE tenant_id = ? AND UPPER(job_code) = UPPER(?)
        LIMIT 1
      `).get(tenantId, jobCode) as { id: number } | undefined;

  if (existing) {
    throw new Error('That job code already exists for this company.');
  }
}

export const jobRoutes = new Hono<AppEnv>();

jobRoutes.get('/jobs', loginRequired, (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const db = getDb();

  const rows = jobs.listWithFinancials(db, tenantId);
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

  const job = jobs.findById(db, jobId, tenantId);
  if (!job) {
    return c.text('Job not found', 404);
  }

  const incomeRows = income.listByJob(db, jobId, tenantId);
  const totalIncomeVal = Number(income.sumByJob(db, jobId, tenantId) || 0);

  const expenseRows = expenses.listByJob(db, jobId, tenantId);
  const baseExpenses = Number(expenses.sumByJob(db, jobId, tenantId) || 0);

  const laborSums = timeEntries.sumByJob(db, jobId, tenantId);
  const laborHours = Number(laborSums.totalHours || 0);
  const laborCost = Number(laborSums.totalCost || 0);

  const totalExpenses = baseExpenses + laborCost;
  const profit = totalIncomeVal - totalExpenses;

  const contractAmount = Number(job.contract_amount || 0);
  const retainagePercent = Number(job.retainage_percent || 0);
  const remainingContract = contractAmount - totalIncomeVal;
  const profitMargin = totalIncomeVal > 0 ? (profit / totalIncomeVal) * 100 : 0;
  const retainageHeld = retainagePercent > 0 ? (totalIncomeVal * retainagePercent) / 100 : 0;

  const invoiceTotal = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE job_id = ? AND tenant_id = ?'
  ).get(jobId, tenantId) as { total: number };

  const paymentsTotal = db.prepare(
    'SELECT COALESCE(SUM(p.amount), 0) as total FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE i.job_id = ? AND p.tenant_id = ? AND i.tenant_id = ?'
  ).get(jobId, tenantId, tenantId) as { total: number };

  const unpaidInvoiceBalance = Math.max(
    Number(invoiceTotal.total || 0) - Number(paymentsTotal.total || 0),
    0,
  );

  return renderApp(
    c,
    'Job Detail',
    <JobDetailPage
      job={job}
      incomeRows={incomeRows}
      expenseRows={expenseRows}
      totalIncome={totalIncomeVal}
      baseExpenses={baseExpenses}
      laborHours={laborHours}
      laborCost={laborCost}
      totalExpenses={totalExpenses}
      profit={profit}
      profitMargin={profitMargin}
      remainingContract={remainingContract}
      retainageHeld={retainageHeld}
      invoiceTotal={Number(invoiceTotal.total || 0)}
      paymentsTotal={Number(paymentsTotal.total || 0)}
      unpaidInvoiceBalance={unpaidInvoiceBalance}
      csrfToken={c.get('csrfToken')}
    />,
  );
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
  const tenantId = tenant!.id;
  const db = getDb();
  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const formData = buildJobFormData(body);

  try {
    const jobName = requireText(body.job_name, 'Job name', 120);
    const jobCode = normalizeOptionalJobCode(body.job_code);
    const clientName = requireText(body.client_name, 'Client name', 120);
    const contractAmount = parseNonNegativeMoney(body.contract_amount, 'Contract amount');
    const retainagePercent = parsePercent(body.retainage_percent, 'Retainage percent');
    const startDate = normalizeOptionalDate(body.start_date, 'Start date');
    const status = parseStatus(body.status);

    ensureUniqueJobCode(db, tenantId, jobCode);

    jobs.create(db, tenantId, {
      job_name: jobName,
      job_code: jobCode,
      client_name: clientName,
      contract_amount: contractAmount,
      retainage_percent: retainagePercent,
      start_date: startDate,
      status,
    });

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
    <EditJobPage job={job} csrfToken={c.get('csrfToken')} />,
  );
});

jobRoutes.post('/edit_job/:id', roleRequired('Admin', 'Manager'), async (c) => {
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

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const formData = buildJobFormData(body);

  try {
    const jobName = requireText(body.job_name, 'Job name', 120);
    const jobCode = normalizeOptionalJobCode(body.job_code);
    const clientName = requireText(body.client_name, 'Client name', 120);
    const contractAmount = parseNonNegativeMoney(body.contract_amount, 'Contract amount');
    const retainagePercent = parsePercent(body.retainage_percent, 'Retainage percent');
    const startDate = normalizeOptionalDate(body.start_date, 'Start date');
    const status = parseStatus(body.status);

    ensureUniqueJobCode(db, tenantId, jobCode, jobId);

    jobs.update(db, jobId, tenantId, {
      job_name: jobName,
      job_code: jobCode,
      client_name: clientName,
      contract_amount: contractAmount,
      retainage_percent: retainagePercent,
      start_date: startDate,
      status,
    });

    return c.redirect('/jobs');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update job.';
    return renderApp(
      c,
      'Edit Job',
      <EditJobPage
        job={{
          ...job,
          ...formData,
          job_code: formData.job_code,
          contract_amount: formData.contract_amount,
          retainage_percent: formData.retainage_percent,
          start_date: formData.start_date,
          status: formData.status,
        }}
        error={message}
        csrfToken={c.get('csrfToken')}
      />,
      400,
    );
  }
});

jobRoutes.post('/delete_job/:id', roleRequired('Admin'), (c) => {
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

  const deleteBlockReason = getDeleteBlockReason(db, jobId, tenantId);
  if (deleteBlockReason) {
    const rows = jobs.listWithFinancials(db, tenantId);
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
        error={deleteBlockReason}
      />,
      400,
    );
  }

  jobs.deleteWithCascade(db, jobId, tenantId);
  return c.redirect('/jobs');
});

export default jobRoutes;