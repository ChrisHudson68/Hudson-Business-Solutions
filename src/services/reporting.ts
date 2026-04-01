import type { DB } from '../db/connection.js';
import * as jobs from '../db/queries/jobs.js';
import * as monthlyBills from '../db/queries/monthly-bills.js';

export type ReportRange = '1w' | '1m' | '1y' | 'custom';

export interface ReportFilter {
  range: ReportRange;
  startDate: string;
  endDate: string;
  label: string;
}

export interface CashSummary {
  recordedIncome: number;
  invoicedAmount: number;
  collectedPayments: number;
  recordedExpenses: number;
  laborCost: number;
  cashOutflow: number;
  netCash: number;
  openReceivables: number;
}

export interface InvoiceAging {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90Plus: number;
  totalOpen: number;
  overdueTotal: number;
  openCount: number;
}

export interface TrendPoint {
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  invoiced: number;
  collected: number;
}

export interface ExpenseCategoryPoint {
  label: string;
  value: number;
}

export interface ProfitabilityRow {
  id: number;
  job_name: string | null;
  client: string | null;
  status: string;
  archived: boolean;
  contract: number;
  income: number;
  invoiced: number;
  collected: number;
  expenses: number;
  labor: number;
  totalCost: number;
  profit: number;
  margin: number;
  openAr: number;
  openInvoiceCount: number;
}

export interface AdvancedReportsData {
  filter: ReportFilter;
  cash: CashSummary;
  aging: InvoiceAging;
  trend: TrendPoint[];
  expenseCategories: ExpenseCategoryPoint[];
  rows: ProfitabilityRow[];
  topProfitJobs: ProfitabilityRow[];
  worstProfitJobs: ProfitabilityRow[];
  topMarginJobs: ProfitabilityRow[];
  worstMarginJobs: ProfitabilityRow[];
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startDateForRange(range: Exclude<ReportRange, 'custom'>): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);

  if (range === '1w') d.setUTCDate(d.getUTCDate() - 6);
  else if (range === '1m') d.setUTCDate(d.getUTCDate() - 29);
  else d.setUTCMonth(d.getUTCMonth() - 11, 1);

  return d.toISOString().slice(0, 10);
}

function formatFilterLabel(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z}`);

  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return `${startLabel} - ${endLabel}`;
}

function bucketKeyForRange(dateStr: string, range: ReportRange): string {
  if (range === '1y') return `${String(dateStr).slice(0, 7)}-01`;
  return String(dateStr).slice(0, 10);
}

function bucketLabel(bucketDate: string, range: ReportRange): string {
  const d = new Date(`${bucketDate}T00:00:00Z}`);
  if (range === '1y') {
    return d.toLocaleDateString('en-US', { month: 'short' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function roundMoney(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function diffDays(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00Z}`);
  const to = new Date(`${toDate}T00:00:00Z}`);
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / 86400000);
}

function cloneRow(row: ProfitabilityRow): ProfitabilityRow {
  return { ...row };
}

function csvEscape(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatMoneyCsv(value: number): string {
  return roundMoney(value).toFixed(2);
}

function formatPercentCsv(value: number): string {
  return (Number(value || 0)).toFixed(2);
}

export function parseReportFilter(query: {
  range?: string | null;
  start?: string | null;
  end?: string | null;
}): ReportFilter {
  const rawRange = String(query.range || '1m').trim().toLowerCase();
  const requestedRange: ReportRange =
    rawRange === '1w' || rawRange === '1m' || rawRange === '1y' || rawRange === 'custom'
      ? (rawRange as ReportRange)
      : '1m';

  if (requestedRange === 'custom') {
    const startDate = String(query.start || '').trim();
    const endDate = String(query.end || '').trim();

    if (isIsoDate(startDate) && isIsoDate(endDate) && startDate <= endDate) {
      return {
        range: 'custom',
        startDate,
        endDate,
        label: formatFilterLabel(startDate, endDate),
      };
    }
  }

  const fallbackRange: Exclude<ReportRange, 'custom'> =
    requestedRange === '1w' || requestedRange === '1m' || requestedRange === '1y'
      ? requestedRange
      : '1m';

  const startDate = startDateForRange(fallbackRange);
  const endDate = todayIso();

  return {
    range: fallbackRange,
    startDate,
    endDate,
    label: formatFilterLabel(startDate, endDate),
  };
}

export function buildAdvancedReports(db: DB, tenantId: number, filter: ReportFilter): AdvancedReportsData {
  const allJobs = jobs.listByTenant(db, tenantId, true);

  const incomeRows = db.prepare(
    `
      SELECT date, amount, job_id
      FROM income
      WHERE tenant_id = ?
        AND archived_at IS NULL
        AND date >= ?
        AND date <= ?
      ORDER BY date ASC, id ASC
    `
  ).all(tenantId, filter.startDate, filter.endDate) as Array<{
    date: string;
    amount: number;
    job_id: number | null;
  }>;

  const expenseRows = db.prepare(
    `
      SELECT date, amount, category, job_id
      FROM expenses
      WHERE tenant_id = ?
        AND archived_at IS NULL
        AND date >= ?
        AND date <= ?
      ORDER BY date ASC, id ASC
    `
  ).all(tenantId, filter.startDate, filter.endDate) as Array<{
    date: string;
    amount: number;
    category: string | null;
    job_id: number | null;
  }>;

  const recurringBillRows = monthlyBills.listOccurrencesForRange(db, tenantId, filter.startDate, filter.endDate).map((row) => ({
    date: row.date,
    amount: Number(row.amount || 0),
    category: row.category || 'Static Monthly Bills',
    job_id: null as number | null,
  }));

  const laborRows = db.prepare(
    `
      SELECT date, labor_cost, job_id
      FROM time_entries
      WHERE tenant_id = ?
        AND date >= ?
        AND date <= ?
      ORDER BY date ASC, id ASC
    `
  ).all(tenantId, filter.startDate, filter.endDate) as Array<{
    date: string;
    labor_cost: number;
    job_id: number | null;
  }>;

  const invoiceRows = db.prepare(
    `
      SELECT id, job_id, date_issued, due_date, amount
      FROM invoices
      WHERE tenant_id = ?
        AND archived_at IS NULL
        AND date_issued >= ?
        AND date_issued <= ?
      ORDER BY date_issued ASC, id ASC
    `
  ).all(tenantId, filter.startDate, filter.endDate) as Array<{
    id: number;
    job_id: number;
    date_issued: string;
    due_date: string;
    amount: number;
  }>;

  const paymentRows = db.prepare(
    `
      SELECT p.date, p.amount, i.job_id
      FROM payments p
      JOIN invoices i
        ON i.id = p.invoice_id
       AND i.tenant_id = p.tenant_id
      WHERE p.tenant_id = ?
        AND i.archived_at IS NULL
        AND p.date >= ?
        AND p.date <= ?
      ORDER BY p.date ASC, p.id ASC
    `
  ).all(tenantId, filter.startDate, filter.endDate) as Array<{
    date: string;
    amount: number;
    job_id: number | null;
  }>;

  const agingInvoiceRows = db.prepare(
    `
      SELECT id, job_id, due_date, amount
      FROM invoices
      WHERE tenant_id = ?
        AND archived_at IS NULL
        AND date_issued <= ?
      ORDER BY due_date ASC, id ASC
    `
  ).all(tenantId, filter.endDate) as Array<{
    id: number;
    job_id: number;
    due_date: string;
    amount: number;
  }>;

  const paidToDateRows = db.prepare(
    `
      SELECT p.invoice_id, COALESCE(SUM(p.amount), 0) AS total_paid
      FROM payments p
      JOIN invoices i
        ON i.id = p.invoice_id
       AND i.tenant_id = p.tenant_id
      WHERE p.tenant_id = ?
        AND i.archived_at IS NULL
        AND p.date <= ?
      GROUP BY p.invoice_id
    `
  ).all(tenantId, filter.endDate) as Array<{
    invoice_id: number;
    total_paid: number;
  }>;

  const paidToDateMap = new Map<number, number>();
  for (const row of paidToDateRows) {
    paidToDateMap.set(row.invoice_id, Number(row.total_paid || 0));
  }

  const jobMap = new Map<number, ProfitabilityRow>();
  for (const job of allJobs) {
    jobMap.set(job.id, {
      id: job.id,
      job_name: job.job_name,
      client: job.client_name,
      status: job.status || 'Active',
      archived: !!job.archived_at,
      contract: Number(job.contract_amount || 0),
      income: 0,
      invoiced: 0,
      collected: 0,
      expenses: 0,
      labor: 0,
      totalCost: 0,
      profit: 0,
      margin: 0,
      openAr: 0,
      openInvoiceCount: 0,
    });
  }

  const trendMap = new Map<string, { inflow: number; outflow: number; invoiced: number; collected: number }>();
  const categoryMap = new Map<string, number>();

  let recordedIncome = 0;
  let recordedExpenses = 0;
  let laborCost = 0;
  let invoicedAmount = 0;
  let collectedPayments = 0;

  for (const row of incomeRows) {
    const amount = Number(row.amount || 0);
    recordedIncome += amount;

    const key = bucketKeyForRange(row.date, filter.range);
    const bucket = trendMap.get(key) || { inflow: 0, outflow: 0, invoiced: 0, collected: 0 };
    bucket.inflow += amount;
    trendMap.set(key, bucket);

    if (row.job_id && jobMap.has(row.job_id)) {
      jobMap.get(row.job_id)!.income += amount;
    }
  }

  for (const row of paymentRows) {
    const amount = Number(row.amount || 0);
    collectedPayments += amount;

    const key = bucketKeyForRange(row.date, filter.range);
    const bucket = trendMap.get(key) || { inflow: 0, outflow: 0, invoiced: 0, collected: 0 };
    bucket.collected += amount;
    trendMap.set(key, bucket);

    if (row.job_id && jobMap.has(row.job_id)) {
      jobMap.get(row.job_id)!.collected += amount;
    }
  }

  for (const row of invoiceRows) {
    const amount = Number(row.amount || 0);
    invoicedAmount += amount;

    const key = bucketKeyForRange(row.date_issued, filter.range);
    const bucket = trendMap.get(key) || { inflow: 0, outflow: 0, invoiced: 0, collected: 0 };
    bucket.invoiced += amount;
    trendMap.set(key, bucket);

    if (jobMap.has(row.job_id)) {
      jobMap.get(row.job_id)!.invoiced += amount;
    }
  }

  for (const row of [...expenseRows, ...recurringBillRows]) {
    const amount = Number(row.amount || 0);
    recordedExpenses += amount;

    const key = bucketKeyForRange(row.date, filter.range);
    const bucket = trendMap.get(key) || { inflow: 0, outflow: 0, invoiced: 0, collected: 0 };
    bucket.outflow += amount;
    trendMap.set(key, bucket);

    const category = String(row.category || 'Other').trim() || 'Other';
    categoryMap.set(category, (categoryMap.get(category) || 0) + amount);

    if (row.job_id && jobMap.has(row.job_id)) {
      jobMap.get(row.job_id)!.expenses += amount;
    }
  }

  for (const row of laborRows) {
    const amount = Number(row.labor_cost || 0);
    laborCost += amount;

    const key = bucketKeyForRange(row.date, filter.range);
    const bucket = trendMap.get(key) || { inflow: 0, outflow: 0, invoiced: 0, collected: 0 };
    bucket.outflow += amount;
    trendMap.set(key, bucket);

    if (row.job_id && jobMap.has(row.job_id)) {
      jobMap.get(row.job_id)!.labor += amount;
    }
  }

  const aging: InvoiceAging = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90Plus: 0,
    totalOpen: 0,
    overdueTotal: 0,
    openCount: 0,
  };

  for (const row of agingInvoiceRows) {
    const paid = Number(paidToDateMap.get(row.id) || 0);
    const openBalance = Math.max(Number(row.amount || 0) - paid, 0);

    if (openBalance <= 0) continue;

    aging.totalOpen += openBalance;
    aging.openCount += 1;

    if (jobMap.has(row.job_id)) {
      const job = jobMap.get(row.job_id)!;
      job.openAr += openBalance;
      job.openInvoiceCount += 1;
    }

    if (row.due_date >= filter.endDate) {
      aging.current += openBalance;
      continue;
    }

    const overdueDays = diffDays(row.due_date, filter.endDate);
    aging.overdueTotal += openBalance;

    if (overdueDays <= 30) aging.days1to30 += openBalance;
    else if (overdueDays <= 60) aging.days31to60 += openBalance;
    else if (overdueDays <= 90) aging.days61to90 += openBalance;
    else aging.days90Plus += openBalance;
  }

  const trend = [...trendMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucketDate, values]) => ({
      label: bucketLabel(bucketDate, filter.range),
      inflow: roundMoney(values.inflow),
      outflow: roundMoney(values.outflow),
      net: roundMoney(values.inflow - values.outflow),
      invoiced: roundMoney(values.invoiced),
      collected: roundMoney(values.collected),
    }));

  const expenseCategories = [...categoryMap.entries()]
    .map(([label, value]) => ({ label, value: roundMoney(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const rows = [...jobMap.values()]
    .map((row) => {
      row.totalCost = roundMoney(row.expenses + row.labor);
      row.profit = roundMoney(row.income - row.totalCost);
      row.margin = row.income > 0 ? (row.profit / row.income) * 100 : 0;

      row.income = roundMoney(row.income);
      row.invoiced = roundMoney(row.invoiced);
      row.collected = roundMoney(row.collected);
      row.expenses = roundMoney(row.expenses);
      row.labor = roundMoney(row.labor);
      row.contract = roundMoney(row.contract);
      row.openAr = roundMoney(row.openAr);

      return row;
    })
    .sort((a, b) => b.profit - a.profit);

  const eligibleMarginRows = rows.filter((row) => row.income > 0);

  return {
    filter,
    cash: {
      recordedIncome: roundMoney(recordedIncome),
      invoicedAmount: roundMoney(invoicedAmount),
      collectedPayments: roundMoney(collectedPayments),
      recordedExpenses: roundMoney(recordedExpenses),
      laborCost: roundMoney(laborCost),
      cashOutflow: roundMoney(recordedExpenses + laborCost),
      netCash: roundMoney(collectedPayments - (recordedExpenses + laborCost)),
      openReceivables: roundMoney(aging.totalOpen),
    },
    aging: {
      current: roundMoney(aging.current),
      days1to30: roundMoney(aging.days1to30),
      days31to60: roundMoney(aging.days31to60),
      days61to90: roundMoney(aging.days61to90),
      days90Plus: roundMoney(aging.days90Plus),
      totalOpen: roundMoney(aging.totalOpen),
      overdueTotal: roundMoney(aging.overdueTotal),
      openCount: aging.openCount,
    },
    trend,
    expenseCategories,
    rows,
    topProfitJobs: rows.slice(0, 5).map(cloneRow),
    worstProfitJobs: [...rows].sort((a, b) => a.profit - b.profit).slice(0, 5).map(cloneRow),
    topMarginJobs: [...eligibleMarginRows].sort((a, b) => b.margin - a.margin).slice(0, 5).map(cloneRow),
    worstMarginJobs: [...eligibleMarginRows].sort((a, b) => a.margin - b.margin).slice(0, 5).map(cloneRow),
  };
}

export function buildReportsCsv(data: AdvancedReportsData): string {
  const lines: string[] = [];

  lines.push(`Hudson Business Solutions Reports`);
  lines.push(`Range,${csvEscape(data.filter.label)}`);
  lines.push(`Start Date,${csvEscape(data.filter.startDate)}`);
  lines.push(`End Date,${csvEscape(data.filter.endDate)}`);
  lines.push('');

  lines.push('Cash Summary');
  lines.push('Metric,Value');
  lines.push(`Recorded Income,${formatMoneyCsv(data.cash.recordedIncome)}`);
  lines.push(`Invoiced Amount,${formatMoneyCsv(data.cash.invoicedAmount)}`);
  lines.push(`Collected Payments,${formatMoneyCsv(data.cash.collectedPayments)}`);
  lines.push(`Recorded Expenses,${formatMoneyCsv(data.cash.recordedExpenses)}`);
  lines.push(`Labor Cost,${formatMoneyCsv(data.cash.laborCost)}`);
  lines.push(`Cash Outflow,${formatMoneyCsv(data.cash.cashOutflow)}`);
  lines.push(`Net Cash,${formatMoneyCsv(data.cash.netCash)}`);
  lines.push(`Open Receivables,${formatMoneyCsv(data.cash.openReceivables)}`);
  lines.push('');

  lines.push('Invoice Aging');
  lines.push('Bucket,Value');
  lines.push(`Current,${formatMoneyCsv(data.aging.current)}`);
  lines.push(`1-30 Days,${formatMoneyCsv(data.aging.days1to30)}`);
  lines.push(`31-60 Days,${formatMoneyCsv(data.aging.days31to60)}`);
  lines.push(`61-90 Days,${formatMoneyCsv(data.aging.days61to90)}`);
  lines.push(`90+ Days,${formatMoneyCsv(data.aging.days90Plus)}`);
  lines.push(`Total Open,${formatMoneyCsv(data.aging.totalOpen)}`);
  lines.push(`Overdue Total,${formatMoneyCsv(data.aging.overdueTotal)}`);
  lines.push(`Open Count,${data.aging.openCount}`);
  lines.push('');

  lines.push('Expense Categories');
  lines.push('Category,Amount');
  for (const item of data.expenseCategories) {
    lines.push(`${csvEscape(item.label)},${formatMoneyCsv(item.value)}`);
  }
  lines.push('');

  lines.push('Trend');
  lines.push('Period,Income,Outflow,Net,Invoiced,Collected');
  for (const point of data.trend) {
    lines.push([
      csvEscape(point.label),
      formatMoneyCsv(point.inflow),
      formatMoneyCsv(point.outflow),
      formatMoneyCsv(point.net),
      formatMoneyCsv(point.invoiced),
      formatMoneyCsv(point.collected),
    ].join(','));
  }
  lines.push('');

  lines.push('Job Profitability Summary');
  lines.push([
    'Job',
    'Client',
    'Status',
    'Archived',
    'Contract',
    'Income',
    'Invoiced',
    'Collected',
    'Expenses',
    'Labor',
    'Total Cost',
    'Profit',
    'Margin %',
    'Open A/R',
    'Open Invoice Count',
  ].join(','));

  for (const row of data.rows) {
    lines.push([
      csvEscape(row.job_name || `Job #${row.id}`),
      csvEscape(row.client || ''),
      csvEscape(row.status || ''),
      row.archived ? 'Yes' : 'No',
      formatMoneyCsv(row.contract),
      formatMoneyCsv(row.income),
      formatMoneyCsv(row.invoiced),
      formatMoneyCsv(row.collected),
      formatMoneyCsv(row.expenses),
      formatMoneyCsv(row.labor),
      formatMoneyCsv(row.totalCost),
      formatMoneyCsv(row.profit),
      formatPercentCsv(row.margin),
      formatMoneyCsv(row.openAr),
      String(row.openInvoiceCount),
    ].join(','));
  }

  return lines.join('\n');
}