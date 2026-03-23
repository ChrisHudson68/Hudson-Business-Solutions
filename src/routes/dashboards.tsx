import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import * as jobs from '../db/queries/jobs.js';
import * as income from '../db/queries/income.js';
import * as expenses from '../db/queries/expenses.js';
import * as timeEntries from '../db/queries/time-entries.js';
import * as invoices from '../db/queries/invoices.js';
import * as payments from '../db/queries/payments.js';
import { loginRequired, roleRequired } from '../middleware/auth.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { DashboardPage } from '../pages/dashboard/DashboardPage.js';
import { ProfitDashboardPage } from '../pages/dashboard/ProfitDashboardPage.js';
import { JobCostDashboardPage } from '../pages/dashboard/JobCostDashboardPage.js';
import { ReportsPage } from '../pages/dashboard/ReportsPage.js';
import { ReportsPrintPage } from '../pages/dashboard/ReportsPrintPage.js';
import { buildAdvancedReports, buildReportsCsv, parseReportFilter } from '../services/reporting.js';

function renderApp(c: any, subtitle: string, content: any) {
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
  );
}

function parsePositiveInt(value: string | null | undefined): number | null {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isActiveStatus(status: string | null | undefined): boolean {
  return (status || 'Active') === 'Active';
}

function isOnHoldStatus(status: string | null | undefined): boolean {
  return (status || '') === 'On Hold';
}

function isCompletedStatus(status: string | null | undefined): boolean {
  const normalized = (status || '').trim().toLowerCase();
  return normalized === 'complete' || normalized === 'completed';
}

function isCancelledStatus(status: string | null | undefined): boolean {
  return (status || '').trim().toLowerCase() === 'cancelled';
}

function invoiceDerivedStatus(
  amount: number,
  paid: number,
  dueDate: string,
): 'Paid' | 'Unpaid' | 'Overdue' {
  if (amount > 0 && paid >= amount) return 'Paid';

  const dueDateValue = new Date(`${dueDate}T23:59:59Z`);
  if (!Number.isNaN(dueDateValue.getTime()) && dueDateValue < new Date() && paid < amount) {
    return 'Overdue';
  }

  return 'Unpaid';
}

function buildReportFilename(prefix: string, startDate: string, endDate: string): string {
  return `${prefix}_${startDate}_to_${endDate}`;
}

function canManageWorkflow(user: any): boolean {
  return user?.role === 'Admin' || user?.role === 'Manager';
}

function hasValue(value: unknown): boolean {
  return String(value ?? '').trim().length > 0;
}

function isCompanyProfileComplete(profile: {
  name: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  invoice_prefix: string | null;
  logo_path: string | null;
} | null | undefined): boolean {
  if (!profile) return false;

  return (
    hasValue(profile.name)
    && hasValue(profile.company_email)
    && hasValue(profile.company_phone)
    && hasValue(profile.company_address)
    && hasValue(profile.invoice_prefix)
  );
}

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get('/dashboard', loginRequired, (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  const tenantId = tenant!.id;
  const db = getDb();

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const allJobs = jobs.listByTenantSorted(db, tenantId);
  const activeJobsAll = allJobs.filter((j) => isActiveStatus(j.status));
  const onHoldJobsAll = allJobs.filter((j) => isOnHoldStatus(j.status));
  const completedJobsAll = allJobs.filter((j) => isCompletedStatus(j.status));
  const cancelledJobsAll = allJobs.filter((j) => isCancelledStatus(j.status));

  const activeJobs = activeJobsAll.slice(0, 8).map((j) => ({
    id: j.id,
    name: j.job_name,
    client: j.client_name,
    status: j.status || 'Active',
    budget: Number(j.contract_amount || 0),
    code: j.job_code || `J-${1000 + j.id}`,
  }));

  const revenueMtd = Number(income.sumByTenantMonth(db, tenantId, yearMonth) || 0);
  const laborMtd = Number(timeEntries.sumLaborByTenantMonth(db, tenantId, yearMonth) || 0);

  const expenseMtdRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE tenant_id = ? AND archived_at IS NULL AND substr(date, 1, 7) = ?`,
    )
    .get(tenantId, yearMonth) as { total: number };

  const expenseMtd = Number(expenseMtdRow?.total || 0);

  const invoiceMtdRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE tenant_id = ? AND archived_at IS NULL AND substr(date_issued, 1, 7) = ?`,
    )
    .get(tenantId, yearMonth) as { total: number };

  const invoicedMtd = Number(invoiceMtdRow?.total || 0);

  const collectedMtdRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE tenant_id = ? AND substr(date, 1, 7) = ?`,
    )
    .get(tenantId, yearMonth) as { total: number };

  const collectedMtd = Number(collectedMtdRow?.total || 0);

  const allInvoices = invoices.listByTenant(db, tenantId);

  const invoicesDue: {
    id: number;
    number: string;
    customer: string | null;
    due_date: string;
    balance: number;
    job_name: string | null;
    derived_status: 'Paid' | 'Unpaid' | 'Overdue';
  }[] = [];

  let invoicesDueTotal = 0;
  let overdueInvoiceTotal = 0;
  let overdueInvoiceCount = 0;

  for (const inv of allInvoices) {
    const amount = Number(inv.amount || 0);
    const paid = Number(payments.sumByInvoice(db, inv.id, tenantId) || 0);
    const balance = Math.max(amount - paid, 0);
    const derivedStatus = invoiceDerivedStatus(amount, paid, inv.due_date);

    if (balance > 0) {
      invoicesDueTotal += balance;

      if (derivedStatus === 'Overdue') {
        overdueInvoiceTotal += balance;
        overdueInvoiceCount += 1;
      }

      invoicesDue.push({
        id: inv.id,
        number: inv.invoice_number || `INV-${inv.id}`,
        customer: inv.client_name,
        due_date: inv.due_date,
        balance,
        job_name: inv.job_name,
        derived_status: derivedStatus,
      });
    }
  }

  invoicesDue.sort((a, b) => {
    if (a.derived_status === 'Overdue' && b.derived_status !== 'Overdue') return -1;
    if (a.derived_status !== 'Overdue' && b.derived_status === 'Overdue') return 1;
    return a.due_date.localeCompare(b.due_date);
  });

  const recentTime = timeEntries.recentByTenant(db, tenantId, 6);

  const totalIncomeAll = allJobs.reduce(
    (sum, job) => sum + Number(income.sumByJob(db, job.id, tenantId) || 0),
    0,
  );
  const totalBaseExpensesAll = allJobs.reduce(
    (sum, job) => sum + Number(expenses.sumByJob(db, job.id, tenantId) || 0),
    0,
  );
  const totalLaborAll = Number(timeEntries.sumLaborByTenant(db, tenantId) || 0);
  const totalCostAll = totalBaseExpensesAll + totalLaborAll;
  const totalProfitAll = totalIncomeAll - totalCostAll;

  const jobsCountRow = db
    .prepare(`SELECT COUNT(*) AS count FROM jobs WHERE tenant_id = ?`)
    .get(tenantId) as { count: number };
  const employeesCountRow = db
    .prepare(`SELECT COUNT(*) AS count FROM employees WHERE tenant_id = ? AND archived_at IS NULL`)
    .get(tenantId) as { count: number };
  const invoicesCountRow = db
    .prepare(`SELECT COUNT(*) AS count FROM invoices WHERE tenant_id = ? AND archived_at IS NULL`)
    .get(tenantId) as { count: number };

  const estimateStatsRow = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) AS draft_count,
      COALESCE(SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END), 0) AS ready_count,
      COALESCE(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0) AS awaiting_response_count,
      COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_count,
      COALESCE(SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END), 0) AS converted_count,
      COALESCE(SUM(CASE WHEN status IN ('draft', 'ready', 'sent') THEN total ELSE 0 END), 0) AS estimate_pipeline_value
    FROM estimates
    WHERE tenant_id = ?
      AND archived_at IS NULL
  `).get(tenantId) as {
    draft_count: number;
    ready_count: number;
    awaiting_response_count: number;
    rejected_count: number;
    converted_count: number;
    estimate_pipeline_value: number;
  };

  const recentEstimates = db.prepare(`
    SELECT
      id,
      estimate_number,
      customer_name,
      total,
      status,
      created_at,
      sent_at,
      responded_at,
      converted_job_id
    FROM estimates
    WHERE tenant_id = ?
      AND archived_at IS NULL
    ORDER BY updated_at DESC, id DESC
    LIMIT 6
  `).all(tenantId) as Array<{
    id: number;
    estimate_number: string;
    customer_name: string;
    total: number;
    status: string;
    created_at: string;
    sent_at: string | null;
    responded_at: string | null;
    converted_job_id: number | null;
  }>;

  const stats = {
    active_jobs: activeJobsAll.length,
    on_hold_jobs: onHoldJobsAll.length,
    completed_jobs: completedJobsAll.length,
    cancelled_jobs: cancelledJobsAll.length,
    revenue_mtd: revenueMtd,
    invoiced_mtd: invoicedMtd,
    collected_mtd: collectedMtd,
    labor_mtd: laborMtd,
    expenses_mtd: expenseMtd,
    costs_mtd: laborMtd + expenseMtd,
    invoices_due_count: invoicesDue.length,
    invoices_due_total: invoicesDueTotal,
    overdue_invoice_count: overdueInvoiceCount,
    overdue_invoice_total: overdueInvoiceTotal,
    total_profit_all: totalProfitAll,
    jobs_count: Number(jobsCountRow?.count || 0),
    employees_count: Number(employeesCountRow?.count || 0),
    invoices_count: Number(invoicesCountRow?.count || 0),
  };

  const tenantProfile = db
    .prepare(
      `SELECT name, logo_path, invoice_prefix, company_email, company_phone, company_address
       FROM tenants
       WHERE id = ?`,
    )
    .get(tenantId) as {
      name: string | null;
      logo_path: string | null;
      invoice_prefix: string | null;
      company_email: string | null;
      company_phone: string | null;
      company_address: string | null;
    } | undefined;

  const companyConfigured = isCompanyProfileComplete(tenantProfile);

  return renderApp(
    c,
    'Overview',
    <DashboardPage
      stats={stats}
      estimateStats={{
        draft_count: Number(estimateStatsRow?.draft_count || 0),
        ready_count: Number(estimateStatsRow?.ready_count || 0),
        awaiting_response_count: Number(estimateStatsRow?.awaiting_response_count || 0),
        rejected_count: Number(estimateStatsRow?.rejected_count || 0),
        converted_count: Number(estimateStatsRow?.converted_count || 0),
        estimate_pipeline_value: Number(estimateStatsRow?.estimate_pipeline_value || 0),
      }}
      activeJobs={activeJobs}
      invoicesDue={invoicesDue.slice(0, 6)}
      recentTime={recentTime}
      recentEstimates={recentEstimates}
      companyConfigured={companyConfigured}
      csrfToken={c.get('csrfToken')}
      canManageWorkflow={canManageWorkflow(currentUser)}
    />,
  );
});

dashboardRoutes.get('/profit', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const db = getDb();

  const allJobs = jobs.listByTenant(db, tenantId);

  const rows: {
    id: number;
    job_name: string | null;
    client: string | null;
    status: string;
    contract: number;
    income: number;
    expenses: number;
    profit: number;
    margin: number;
  }[] = [];

  let totalIncome = 0;
  let totalExpenses = 0;
  let totalProfit = 0;
  let activeContractValue = 0;
  let profitableJobs = 0;
  let losingJobs = 0;

  for (const job of allJobs) {
    const jobId = job.id;
    const contractAmount = Number(job.contract_amount || 0);
    const status = job.status || 'Active';

    const incomeTotal = Number(income.sumByJob(db, jobId, tenantId) || 0);
    const baseExp = Number(expenses.sumByJob(db, jobId, tenantId) || 0);
    const laborCost = Number(timeEntries.sumLaborByTenant(db, tenantId, jobId) || 0);
    const expensesTotal = baseExp + laborCost;

    const profit = incomeTotal - expensesTotal;
    const margin = incomeTotal > 0 ? (profit / incomeTotal) * 100 : 0;

    totalIncome += incomeTotal;
    totalExpenses += expensesTotal;
    totalProfit += profit;

    if (isActiveStatus(status)) activeContractValue += contractAmount;
    if (profit > 0) profitableJobs++;
    else if (profit < 0) losingJobs++;

    rows.push({
      id: jobId,
      job_name: job.job_name,
      client: job.client_name,
      status,
      contract: contractAmount,
      income: incomeTotal,
      expenses: expensesTotal,
      profit,
      margin,
    });
  }

  const avgMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;
  const topProfit = [...rows].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const topMargin = [...rows].sort((a, b) => b.margin - a.margin).slice(0, 5);
  const worstProfit = [...rows].sort((a, b) => a.profit - a.profit).slice(0, 5);

  return renderApp(
    c,
    'Profit Dashboard',
    <ProfitDashboardPage
      totalIncome={totalIncome}
      totalExpenses={totalExpenses}
      totalProfit={totalProfit}
      avgMargin={avgMargin}
      activeContractValue={activeContractValue}
      profitableJobs={profitableJobs}
      losingJobs={losingJobs}
      topProfit={topProfit}
      topMargin={topMargin}
      worstProfit={worstProfit}
      rows={rows}
    />,
  );
});

dashboardRoutes.get('/job-costing', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const db = getDb();

  const allJobs = jobs.listByTenant(db, tenantId);

  const rows = allJobs.map((job) => {
    const incomeTotal = Number(income.sumByJob(db, job.id, tenantId) || 0);
    const expenseTotal = Number(expenses.sumByJob(db, job.id, tenantId) || 0);
    const laborTotal = Number(timeEntries.sumLaborByTenant(db, tenantId, job.id) || 0);
    const totalCost = expenseTotal + laborTotal;
    const contractAmount = Number(job.contract_amount || 0);
    const remainingBudget = contractAmount - totalCost;

    return {
      id: job.id,
      job_name: job.job_name,
      client: job.client_name,
      status: job.status || 'Active',
      contract_amount: contractAmount,
      income_total: incomeTotal,
      expense_total: expenseTotal,
      labor_total: laborTotal,
      total_cost: totalCost,
      remaining_budget: remainingBudget,
      progress_percent: contractAmount > 0 ? Math.min((totalCost / contractAmount) * 100, 100) : 0,
    };
  });

  return renderApp(
    c,
    'Job Costing',
    <JobCostDashboardPage rows={rows} />,
  );
});

dashboardRoutes.get('/reports', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const db = getDb();

  const filter = parseReportFilter(c.req.query());
  const report = buildAdvancedReports(db, tenantId, filter);

  return renderApp(
    c,
    'Reports',
    <ReportsPage
      filter={filter}
      report={report}
    />,
  );
});

dashboardRoutes.get('/reports/print', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const db = getDb();

  const filter = parseReportFilter(c.req.query());
  const report = buildAdvancedReports(db, tenantId, filter);

  return c.html(
    <ReportsPrintPage
      currentTenant={tenant}
      appName={process.env.APP_NAME || 'Hudson Business Solutions'}
      appLogo={process.env.APP_LOGO || '/static/brand/hudson-business-solutions-logo.png'}
      filter={filter}
      report={report}
    />,
  );
});

dashboardRoutes.get('/reports/export.csv', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const db = getDb();

  const filter = parseReportFilter(c.req.query());
  const report = buildAdvancedReports(db, tenantId, filter);
  const csv = buildReportsCsv(report);

  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header(
    'Content-Disposition',
    `attachment; filename="${buildReportFilename('reports', filter.startDate, filter.endDate)}.csv"`,
  );

  return c.body(csv);
});