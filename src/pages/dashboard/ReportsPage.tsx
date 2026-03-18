import type { FC } from 'hono/jsx';
import type {
  AdvancedReportsData,
  ReportFilter,
  ReportRange,
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

export const ReportsPage: FC<ReportsPageProps> = ({
  filter,
  cash,
  aging,
  trend,
  expenseCategories,
  rows,
}) => {
  const trendLabels = trend.map((point) => point.label);
  const inflowSeries = trend.map((point) => point.inflow);
  const outflowSeries = trend.map((point) => point.outflow);
  const netSeries = trend.map((point) => point.net);

  const expenseLabels = expenseCategories.map((item) => item.label);
  const expenseValues = expenseCategories.map((item) => item.value);

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Reports</h1>
          <p>Cash flow, invoice aging, and job profitability for {filter.label}.</p>
        </div>

        <div class="actions actions-mobile-stack">
          <a class={activeRangeClass(filter.range, '1w')} href={rangeHref('1w', filter)}>1 Week</a>
          <a class={activeRangeClass(filter.range, '1m')} href={rangeHref('1m', filter)}>1 Month</a>
          <a class={activeRangeClass(filter.range, '1y')} href={rangeHref('1y', filter)}>1 Year</a>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <div class="card-head">
          <b>Custom Date Range</b>
          <span class="badge">{filter.label}</span>
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
            <div style="flex:0;">
              <label>&nbsp;</label>
              <button class="btn btn-primary" type="submit">Apply</button>
            </div>
          </div>
        </form>
      </div>

      <div class="grid grid-4">
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Recorded Income</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{formatMoney(cash.recordedIncome)}</div>
        </div>

        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Payments Collected</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{formatMoney(cash.collectedPayments)}</div>
        </div>

        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Cash Outflow</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{formatMoney(cash.cashOutflow)}</div>
          <div class="muted small" style="margin-top:6px;">
            {formatMoney(cash.recordedExpenses)} expenses • {formatMoney(cash.laborCost)} labor
          </div>
        </div>

        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Net Cash Movement</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{formatMoney(cash.netCash)}</div>
        </div>
      </div>

      <div class="grid grid-4" style="margin-top:14px;">
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Invoiced</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{formatMoney(cash.invoicedAmount)}</div>
        </div>

        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Open Receivables</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{formatMoney(cash.openReceivables)}</div>
        </div>

        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Open Invoices</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{aging.openCount}</div>
        </div>

        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Overdue Total</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{formatMoney(aging.overdueTotal)}</div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="card-head">
          <h3 style="margin:0;">Invoice Aging</h3>
          <span class="badge">{aging.openCount} open invoice{aging.openCount === 1 ? '' : 's'}</span>
        </div>

        <div class="grid grid-4" style="margin-bottom:14px;">
          <div class="card" style="padding:14px;">
            <div class="muted small strong">Current</div>
            <div style="font-size:24px; font-weight:900; margin-top:6px;">{formatMoney(aging.current)}</div>
          </div>
          <div class="card" style="padding:14px;">
            <div class="muted small strong">1-30 Days</div>
            <div style="font-size:24px; font-weight:900; margin-top:6px;">{formatMoney(aging.days1to30)}</div>
          </div>
          <div class="card" style="padding:14px;">
            <div class="muted small strong">31-60 Days</div>
            <div style="font-size:24px; font-weight:900; margin-top:6px;">{formatMoney(aging.days31to60)}</div>
          </div>
          <div class="card" style="padding:14px;">
            <div class="muted small strong">61-90 Days</div>
            <div style="font-size:24px; font-weight:900; margin-top:6px;">{formatMoney(aging.days61to90)}</div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="card" style="padding:14px;">
            <div class="muted small strong">90+ Days</div>
            <div style="font-size:24px; font-weight:900; margin-top:6px;">{formatMoney(aging.days90Plus)}</div>
          </div>
          <div class="card" style="padding:14px;">
            <div class="muted small strong">Total Open A/R</div>
            <div style="font-size:24px; font-weight:900; margin-top:6px;">{formatMoney(aging.totalOpen)}</div>
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px;">
        <div class="card">
          <h3 style="margin-top:0;">Cash Flow Trend</h3>
          <div class="muted" style="margin-bottom:12px;">
            Inflow is recorded income. Outflow combines expenses and labor. Net shows inflow minus outflow.
          </div>
          <canvas id="cashTrendChart"></canvas>
        </div>

        <div class="card">
          <h3 style="margin-top:0;">Expense Categories</h3>
          <div class="muted" style="margin-bottom:12px;">
            Recorded expenses for the selected reporting period.
          </div>
          <canvas id="expenseBreakdownChart"></canvas>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <h3 style="margin-top:0;">Job Profitability Summary</h3>
        <div class="table-wrap table-wrap-tight">
          <table class="table">
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
                        label: 'Inflow',
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
                  textContent: 'No cash flow trend data found for this range.'
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
    </div>
  );
};

export default ReportsPage;