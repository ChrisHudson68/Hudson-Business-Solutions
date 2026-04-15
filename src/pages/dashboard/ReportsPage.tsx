import type { FC } from 'hono/jsx';
import type {
  AdvancedReportsData,
  ReportFilter,
  ReportRange,
  ProfitabilityRow,
} from '../../services/reporting.js';

interface ReportsPageProps extends AdvancedReportsData {}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatPercent(value: number): string {
  return `${(value || 0).toFixed(1)}%`;
}

function rangeHref(
  range: Exclude<ReportRange, 'custom'>,
  filter: ReportFilter,
): string {
  const params = new URLSearchParams();
  params.set('range', range);

  if (filter.range === 'custom') {
    params.set('start', filter.startDate);
    params.set('end', filter.endDate);
  }

  return `/reports?${params.toString()}`;
}

function activeRangeClass(current: ReportRange, value: ReportRange): string {
  return current === value ? 'btn btn-primary' : 'btn';
}

function reportActionHref(
  basePath: string,
  filter: ReportFilter,
): string {
  const params = new URLSearchParams();
  params.set('range', filter.range);
  params.set('start', filter.startDate);
  params.set('end', filter.endDate);
  return `${basePath}?${params.toString()}`;
}

function RankingTable({
  title,
  rows,
  valueLabel,
  valueSelector,
  secondarySelector,
}: {
  title: string;
  rows: ProfitabilityRow[];
  valueLabel: string;
  valueSelector: (row: ProfitabilityRow) => string;
  secondarySelector: (row: ProfitabilityRow) => string;
}) {
  return (
    <div class="card">
      <div class="card-head">
        <h3>{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div class="muted" style="padding:16px 0;">No jobs found.</div>
      ) : (
        <div class="table-wrap" style="margin:0 -18px -16px;">
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Client</th>
                <th class="right">{valueLabel}</th>
                <th class="right">Secondary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr>
                  <td>
                    <div style="font-weight:700;">{row.job_name || `Job #${row.id}`}</div>
                    <div class="muted" style="font-size:12px; margin-top:2px;">{row.archived ? 'Archived' : row.status}</div>
                  </td>
                  <td>{row.client || '—'}</td>
                  <td class="right" style="font-weight:700;">{valueSelector(row)}</td>
                  <td class="right">{secondarySelector(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const ReportsPage: FC<ReportsPageProps> = ({
  filter,
  cash,
  aging,
  trend,
  expenseCategories,
  rows,
  topProfitJobs,
  worstProfitJobs,
  topMarginJobs,
  worstMarginJobs,
}) => {
  const trendLabels = trend.map((point) => point.label);
  const inflowSeries = trend.map((point) => point.inflow);
  const outflowSeries = trend.map((point) => point.outflow);
  const netSeries = trend.map((point) => point.net);
  const invoicedSeries = trend.map((point) => point.invoiced);
  const collectedSeries = trend.map((point) => point.collected);

  const expenseLabels = expenseCategories.map((item) => item.label);
  const expenseValues = expenseCategories.map((item) => item.value);

  const csvHref = reportActionHref('/reports/export.csv', filter);
  const printHref = reportActionHref('/reports/print', filter);

  const hasReportData =
    rows.length > 0 ||
    trend.length > 0 ||
    expenseCategories.length > 0 ||
    Number(cash.recordedIncome || 0) > 0 ||
    Number(cash.collectedPayments || 0) > 0 ||
    Number(cash.cashOutflow || 0) > 0 ||
    Number(cash.invoicedAmount || 0) > 0 ||
    Number(cash.openReceivables || 0) > 0 ||
    Number(aging.openCount || 0) > 0 ||
    Number(aging.totalOpen || 0) > 0 ||
    Number(aging.overdueTotal || 0) > 0;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Reports</h1>
          <p>Cash flow, invoice aging, trends, and job profitability for {filter.label}.</p>
        </div>

        <div class="actions">
          <a class="btn" href={csvHref}>Export CSV</a>
          <a class="btn" href={printHref} target="_blank" rel="noreferrer">Print View</a>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-head">
          <div>
            <h3>Date Range</h3>
            <p>Currently: {filter.label}</p>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <a class={activeRangeClass(filter.range, '1w')} href={rangeHref('1w', filter)}>1 Week</a>
            <a class={activeRangeClass(filter.range, '1m')} href={rangeHref('1m', filter)}>1 Month</a>
            <a class={activeRangeClass(filter.range, '1y')} href={rangeHref('1y', filter)}>1 Year</a>
          </div>
        </div>

        <form method="get" action="/reports">
          <input type="hidden" name="range" value="custom" />
          <div class="row">
            <div>
              <label>Start Date</label>
              <input type="date" name="start" value={filter.startDate} required />
            </div>
            <div>
              <label>End Date</label>
              <input type="date" name="end" value={filter.endDate} required />
            </div>
            <div style="flex:0; align-self:flex-end; padding-bottom:0;">
              <button class="btn btn-primary" type="submit" style="margin-top:14px;">Apply</button>
            </div>
          </div>
        </form>
      </div>

      {!hasReportData ? (
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <h3>No report data yet</h3>
            <p>
              Reports populate automatically as you add jobs, record time, log expenses, and issue invoices.
              Most companies start by creating a job, adding employees, tracking time, and billing a customer.
            </p>
            <div class="actions" style="justify-content:center;">
              <a class="btn" href="/jobs">Jobs</a>
              <a class="btn" href="/timesheet">Timesheets</a>
              <a class="btn btn-primary" href="/invoices">Invoices</a>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div class="stat-grid stat-grid-4">
            <div class="stat-card stat-card-green">
              <div class="stat-label">Recorded Income</div>
              <div class="stat-value">{formatMoney(cash.recordedIncome)}</div>
            </div>
            <div class="stat-card stat-card-navy">
              <div class="stat-label">Payments Collected</div>
              <div class="stat-value">{formatMoney(cash.collectedPayments)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Cash Outflow</div>
              <div class="stat-value">{formatMoney(cash.cashOutflow)}</div>
              <div class="stat-sub">{formatMoney(cash.recordedExpenses)} exp · {formatMoney(cash.laborCost)} labor</div>
            </div>
            <div class="stat-card stat-card-navy">
              <div class="stat-label">Net Cash Movement</div>
              <div class="stat-value">{formatMoney(cash.netCash)}</div>
            </div>
          </div>

          <div class="stat-grid stat-grid-4" style="margin-top:14px;">
            <div class="stat-card stat-card-accent">
              <div class="stat-label">Invoiced</div>
              <div class="stat-value">{formatMoney(cash.invoicedAmount)}</div>
            </div>
            <div class="stat-card stat-card-accent">
              <div class="stat-label">Open Receivables</div>
              <div class="stat-value">{formatMoney(cash.openReceivables)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Open Invoices</div>
              <div class="stat-value">{aging.openCount}</div>
            </div>
            <div class="stat-card stat-card-red">
              <div class="stat-label">Overdue Total</div>
              <div class="stat-value">{formatMoney(aging.overdueTotal)}</div>
            </div>
          </div>

          <div class="card" style="margin-top:14px;">
            <div class="card-head">
              <h3>Invoice Aging</h3>
              <span class="badge" style="background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); color:#fff;">
                {aging.openCount} open invoice{aging.openCount === 1 ? '' : 's'}
              </span>
            </div>
            <div class="stat-grid stat-grid-4" style="margin-bottom:12px;">
              <div class="stat-card">
                <div class="stat-label">Current</div>
                <div class="stat-value" style="font-size:20px;">{formatMoney(aging.current)}</div>
              </div>
              <div class="stat-card stat-card-accent">
                <div class="stat-label">1–30 Days</div>
                <div class="stat-value" style="font-size:20px;">{formatMoney(aging.days1to30)}</div>
              </div>
              <div class="stat-card stat-card-accent">
                <div class="stat-label">31–60 Days</div>
                <div class="stat-value" style="font-size:20px;">{formatMoney(aging.days31to60)}</div>
              </div>
              <div class="stat-card stat-card-red">
                <div class="stat-label">61–90 Days</div>
                <div class="stat-value" style="font-size:20px;">{formatMoney(aging.days61to90)}</div>
              </div>
            </div>
            <div class="stat-grid stat-grid-2">
              <div class="stat-card stat-card-red">
                <div class="stat-label">90+ Days</div>
                <div class="stat-value" style="font-size:20px;">{formatMoney(aging.days90Plus)}</div>
              </div>
              <div class="stat-card stat-card-navy">
                <div class="stat-label">Total Open A/R</div>
                <div class="stat-value" style="font-size:20px;">{formatMoney(aging.totalOpen)}</div>
              </div>
            </div>
          </div>

          <div class="grid grid-2" style="margin-top:14px;">
            <div class="card">
              <div class="card-head">
                <h3>Operations Trend</h3>
              </div>
              <div class="muted" style="margin-bottom:14px; font-size:13px;">
                Income, outflow, and net movement over the selected period.
              </div>
              <canvas id="cashTrendChart"></canvas>
            </div>
            <div class="card">
              <div class="card-head">
                <h3>Billing Trend</h3>
              </div>
              <div class="muted" style="margin-bottom:14px; font-size:13px;">
                Invoiced work compared to actual cash collected.
              </div>
              <canvas id="billingTrendChart"></canvas>
            </div>
          </div>

          <div class="grid grid-2" style="margin-top:14px;">
            <div class="card">
              <div class="card-head">
                <h3>Expense Breakdown</h3>
              </div>
              <div class="muted" style="margin-bottom:14px; font-size:13px;">
                Recorded expenses for the selected period.
              </div>
              <canvas id="expenseBreakdownChart"></canvas>
            </div>
            <div class="card">
              <div class="card-head">
                <h3>Expense Category Totals</h3>
              </div>
              {expenseCategories.length === 0 ? (
                <div class="muted">No expense category data for this range.</div>
              ) : (
                <div class="table-wrap" style="margin:0 -18px -16px;">
                  <table>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th class="right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseCategories.map((item) => (
                        <tr>
                          <td>{item.label}</td>
                          <td class="right" style="font-weight:700;">{formatMoney(item.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div class="grid grid-2" style="margin-top:14px;">
            <RankingTable
              title="Top Profit Jobs"
              rows={topProfitJobs}
              valueLabel="Profit"
              valueSelector={(row) => formatMoney(row.profit)}
              secondarySelector={(row) => formatPercent(row.margin)}
            />

            <RankingTable
              title="Worst Profit Jobs"
              rows={worstProfitJobs}
              valueLabel="Profit"
              valueSelector={(row) => formatMoney(row.profit)}
              secondarySelector={(row) => formatPercent(row.margin)}
            />
          </div>

          <div class="grid grid-2" style="margin-top:14px;">
            <RankingTable
              title="Best Margin Jobs"
              rows={topMarginJobs}
              valueLabel="Margin"
              valueSelector={(row) => formatPercent(row.margin)}
              secondarySelector={(row) => formatMoney(row.profit)}
            />

            <RankingTable
              title="Lowest Margin Jobs"
              rows={worstMarginJobs}
              valueLabel="Margin"
              valueSelector={(row) => formatPercent(row.margin)}
              secondarySelector={(row) => formatMoney(row.profit)}
            />
          </div>

          <div class="card" style="margin-top:14px;">
            <div class="card-head">
              <h3>Job Profitability Summary</h3>
            </div>
            <div class="table-wrap" style="margin:0 -18px -16px;">
              <table>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th class="right">Contract</th>
                    <th class="right">Income</th>
                    <th class="right">Invoiced</th>
                    <th class="right">Collected</th>
                    <th class="right">Expenses</th>
                    <th class="right">Labor</th>
                    <th class="right">Total Cost</th>
                    <th class="right">Profit</th>
                    <th class="right">Margin</th>
                    <th class="right">Open A/R</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={13} class="muted">No jobs found.</td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr>
                        <td>
                          <div><b>{row.job_name || `Job #${row.id}`}</b></div>
                          <div class="muted small">
                            {row.archived ? 'Archived' : 'Active record'}
                          </div>
                        </td>
                        <td>{row.client || '—'}</td>
                        <td>
                          {row.archived ? (
                            <span class="badge badge-warn">Archived</span>
                          ) : (
                            <span class="badge">{row.status || '—'}</span>
                          )}
                        </td>
                        <td class="right">{formatMoney(row.contract)}</td>
                        <td class="right">{formatMoney(row.income)}</td>
                        <td class="right">{formatMoney(row.invoiced)}</td>
                        <td class="right">{formatMoney(row.collected)}</td>
                        <td class="right">{formatMoney(row.expenses)}</td>
                        <td class="right">{formatMoney(row.labor)}</td>
                        <td class="right">{formatMoney(row.totalCost)}</td>
                        <td class="right">{formatMoney(row.profit)}</td>
                        <td class="right">{formatPercent(row.margin)}</td>
                        <td class="right">
                          {formatMoney(row.openAr)}
                          <div class="muted small">{row.openInvoiceCount} open</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (() => {
                  const trendLabels = ${JSON.stringify(trendLabels)};
                  const inflowSeries = ${JSON.stringify(inflowSeries)};
                  const outflowSeries = ${JSON.stringify(outflowSeries)};
                  const netSeries = ${JSON.stringify(netSeries)};
                  const invoicedSeries = ${JSON.stringify(invoicedSeries)};
                  const collectedSeries = ${JSON.stringify(collectedSeries)};
                  const expenseLabels = ${JSON.stringify(expenseLabels)};
                  const expenseValues = ${JSON.stringify(expenseValues)};

                  const cashCanvas = document.getElementById('cashTrendChart');
                  if (cashCanvas && trendLabels.length > 0) {
                    new Chart(cashCanvas, {
                      data: {
                        labels: trendLabels,
                        datasets: [
                          {
                            type: 'bar',
                            label: 'Income',
                            data: inflowSeries,
                            backgroundColor: '#1E3A5F'
                          },
                          {
                            type: 'bar',
                            label: 'Outflow',
                            data: outflowSeries,
                            backgroundColor: '#F59E0B'
                          },
                          {
                            type: 'line',
                            label: 'Net',
                            data: netSeries,
                            borderColor: '#10B981',
                            backgroundColor: '#10B981',
                            tension: 0.25
                          }
                        ]
                      },
                      options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        scales: {
                          y: { beginAtZero: true }
                        }
                      }
                    });
                  } else if (cashCanvas) {
                    cashCanvas.replaceWith(Object.assign(document.createElement('div'), {
                      className: 'muted',
                      textContent: 'No operations trend data found for this range.'
                    }));
                  }

                  const billingCanvas = document.getElementById('billingTrendChart');
                  if (billingCanvas && trendLabels.length > 0) {
                    new Chart(billingCanvas, {
                      data: {
                        labels: trendLabels,
                        datasets: [
                          {
                            type: 'bar',
                            label: 'Invoiced',
                            data: invoicedSeries,
                            backgroundColor: '#3B82F6'
                          },
                          {
                            type: 'line',
                            label: 'Collected',
                            data: collectedSeries,
                            borderColor: '#10B981',
                            backgroundColor: '#10B981',
                            tension: 0.25
                          }
                        ]
                      },
                      options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        scales: {
                          y: { beginAtZero: true }
                        }
                      }
                    });
                  } else if (billingCanvas) {
                    billingCanvas.replaceWith(Object.assign(document.createElement('div'), {
                      className: 'muted',
                      textContent: 'No billing trend data found for this range.'
                    }));
                  }

                  const expenseCanvas = document.getElementById('expenseBreakdownChart');
                  if (expenseCanvas && expenseLabels.length > 0) {
                    new Chart(expenseCanvas, {
                      type: 'pie',
                      data: {
                        labels: expenseLabels,
                        datasets: [{
                          data: expenseValues,
                          backgroundColor: [
                            '#1E3A5F',
                            '#F59E0B',
                            '#3B82F6',
                            '#10B981',
                            '#EF4444',
                            '#8B5CF6',
                            '#F97316',
                            '#14B8A6'
                          ]
                        }]
                      },
                      options: {
                        responsive: true,
                        maintainAspectRatio: true
                      }
                    });
                  } else if (expenseCanvas) {
                    expenseCanvas.replaceWith(Object.assign(document.createElement('div'), {
                      className: 'muted',
                      textContent: 'No expense category data found for this range.'
                    }));
                  }
                })();
              `,
            }}
          />
        </>
      )}
    </div>
  );
};

export default ReportsPage;