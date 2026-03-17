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

function startDateForRange(range: '1w' | '1m' | '1y'): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);

  if (range === '1w') d.setUTCDate(d.getUTCDate() - 6);
  else if (range === '1m') d.setUTCDate(d.getUTCDate() - 29);
  else d.setUTCMonth(d.getUTCMonth() - 11, 1);

  return d.toISOString().slice(0, 10);
}

function formatBucketLabel(dateStr: string, range: '1w' | '1m' | '1y'): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (range === '1y') {
    return d.toLocaleDateString('en-US', { month: 'short' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getRange(c: any): '1w' | '1m' | '1y' {
  const range = String(c.req.query('range') || '1m').trim().toLowerCase();
  if (range === '1w' || range === '1m' || range === '1y') return range;
  return '1m';
}

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get('/dashboard', loginRequired, (c) => {
  const tenant = c.get('tenant');
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
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE tenant_id = ? AND substr(date, 1, 7) = ?`,
    )
    .get(tenantId, yearMonth) as { total: number };

  const expenseMtd = Number(expenseMtdRow?.total || 0);

  const invoiceMtdRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE tenant_id = ? AND substr(date_issued, 1, 7) = ?`,
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
  };

  return renderApp(
    c,
    'Overview',
    <DashboardPage
      stats={stats}
      activeJobs={activeJobs}
      invoicesDue={invoicesDue.slice(0, 6)}
      recentTime={recentTime}
      csrfToken={c.get('csrfToken')}
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
  const worstProfit = [...rows].sort((a, b) => a.profit - b.profit).slice(0, 5);

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

dashboardRoutes.get('/job_costs', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const db = getDb();

  const allJobs = jobs.listByTenant(db, tenantId);

  const selectedJobId = parsePositiveInt(c.req.query('job_id'));

  function getBreakdown(jobId: number | null) {
    const breakdown: Record<string, number> = {};

    const catRows = expenses.sumByCategory(db, tenantId, jobId || undefined);
    for (const row of catRows) {
      const cat = (row.category || 'Other').trim() || 'Other';
      breakdown[cat] = (breakdown[cat] || 0) + Number(row.total || 0);
    }

    const labor = Number(timeEntries.sumLaborByTenant(db, tenantId, jobId || undefined) || 0);
    breakdown['Labor'] = (breakdown['Labor'] || 0) + labor;

    const totalCost = Object.values(breakdown).reduce((s, v) => s + v, 0);
    return { breakdown, totalCost };
  }

  const { breakdown: overallBreakdown, totalCost: overallTotal } = getBreakdown(null);

  let selectedJob: any = null;
  let selectedTotal = 0;
  let selectedLabels: string[] = [];
  let selectedValues: number[] = [];

  if (selectedJobId) {
    selectedJob = jobs.findById(db, selectedJobId, tenantId);
    if (selectedJob) {
      const { breakdown: selBreakdown, totalCost: selTotal } = getBreakdown(selectedJobId);
      selectedTotal = selTotal;
      const selItems = Object.entries(selBreakdown).sort((a, b) => b[1] - a[1]);
      selectedLabels = selItems.map(([k]) => k);
      selectedValues = selItems.map(([, v]) => Math.round(v * 100) / 100);
    }
  }

  const overallItems = Object.entries(overallBreakdown).sort((a, b) => b[1] - a[1]);
  const overallLabels = overallItems.map(([k]) => k);
  const overallValues = overallItems.map(([, v]) => Math.round(v * 100) / 100);

  const rows: {
    job_name: string | null;
    income: number;
    expenses: number;
    labor: number;
  }[] = [];

  for (const job of allJobs) {
    const incomeTotal = Number(income.sumByJob(db, job.id, tenantId) || 0);
    const expTotal = Number(expenses.sumByJob(db, job.id, tenantId) || 0);
    const laborTotal = Number(timeEntries.sumLaborByTenant(db, tenantId, job.id) || 0);

    rows.push({
      job_name: job.job_name,
      income: incomeTotal,
      expenses: expTotal,
      labor: laborTotal,
    });
  }

  return renderApp(
    c,
    'Job Cost Breakdown',
    <JobCostDashboardPage
      jobs={allJobs}
      selectedJobId={selectedJobId}
      selectedJob={selectedJob}
      overallTotal={overallTotal}
      overallLabels={overallLabels}
      overallValues={overallValues}
      selectedTotal={selectedTotal}
      selectedLabels={selectedLabels}
      selectedValues={selectedValues}
      rows={rows}
    />,
  );
});

dashboardRoutes.get('/reports', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const db = getDb();
  const range = getRange(c);
  const startDate = startDateForRange(range);

  const allJobs = jobs.listByTenant(db, tenantId);

  const incomeRows = db.prepare(
    `SELECT date, amount, job_id
     FROM income
     WHERE tenant_id = ? AND date >= ?
     ORDER BY date ASC`,
  ).all(tenantId, startDate) as Array<{ date: string; amount: number; job_id: number | null }>;

  const expenseRows = db.prepare(
    `SELECT date, amount, category, job_id
     FROM expenses
     WHERE tenant_id = ? AND date >= ?
     ORDER BY date ASC`,
  ).all(tenantId, startDate) as Array<{ date: string; amount: number; category: string | null; job_id: number | null }>;

  const jobMap = new Map<number, {
    id: number;
    job_name: string | null;
    client: string | null;
    status: string;
    income: number;
    expenses: number;
  }>();

  for (const job of allJobs) {
    jobMap.set(job.id, {
      id: job.id,
      job_name: job.job_name,
      client: job.client_name,
      status: job.status || 'Active',
      income: 0,
      expenses: 0,
    });
  }

  const trendMap = new Map<string, { income: number; expenses: number }>();
  const categoryMap = new Map<string, number>();

  function bucketKey(dateStr: string): string {
    if (range === '1y') return String(dateStr || '').slice(0, 7) + '-01';
    return String(dateStr || '').slice(0, 10);
  }

  for (const row of incomeRows) {
    const key = bucketKey(row.date);
    const existing = trendMap.get(key) || { income: 0, expenses: 0 };
    existing.income += Number(row.amount || 0);
    trendMap.set(key, existing);

    if (row.job_id && jobMap.has(row.job_id)) {
      jobMap.get(row.job_id)!.income += Number(row.amount || 0);
    }
  }

  for (const row of expenseRows) {
    const key = bucketKey(row.date);
    const existing = trendMap.get(key) || { income: 0, expenses: 0 };
    existing.expenses += Number(row.amount || 0);
    trendMap.set(key, existing);

    const category = String(row.category || 'Other').trim() || 'Other';
    categoryMap.set(category, (categoryMap.get(category) || 0) + Number(row.amount || 0));

    if (row.job_id && jobMap.has(row.job_id)) {
      jobMap.get(row.job_id)!.expenses += Number(row.amount || 0);
    }
  }

  for (const job of allJobs) {
    const laborCost = Number(timeEntries.sumLaborByTenant(db, tenantId, job.id) || 0);
    const existing = jobMap.get(job.id);
    if (existing) {
      existing.expenses += laborCost;
    }
  }

  const trend = [...trendMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, values]) => ({
      label: formatBucketLabel(date, range),
      income: Math.round(values.income * 100) / 100,
      expenses: Math.round(values.expenses * 100) / 100,
      profit: Math.round((values.income - values.expenses) * 100) / 100,
    }));

  const totalIncome = trend.reduce((sum, point) => sum + point.income, 0);
  const totalExpenses = trend.reduce((sum, point) => sum + point.expenses, 0);
  const totalProfit = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;

  const expenseCategories = [...categoryMap.entries()]
    .map(([label, value]) => ({
      label,
      value: Math.round(value * 100) / 100,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const rows = [...jobMap.values()]
    .map((job) => {
      const profit = job.income - job.expenses;
      const rowMargin = job.income > 0 ? (profit / job.income) * 100 : 0;

      return {
        id: job.id,
        job_name: job.job_name,
        client: job.client,
        status: job.status,
        income: Math.round(job.income * 100) / 100,
        expenses: Math.round(job.expenses * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin: rowMargin,
      };
    })
    .sort((a, b) => b.profit - a.profit);

  return renderApp(
    c,
    'Reports',
    <ReportsPage
      range={range}
      totals={{
        income: totalIncome,
        expenses: totalExpenses,
        profit: totalProfit,
        margin,
      }}
      trend={trend}
      expenseCategories={expenseCategories}
      rows={rows}
    />,
  );
});

export default dashboardRoutes;