import type { FC } from 'hono/jsx';

type TrendPoint = {
  label: string;
  income: number;
  expenses: number;
  profit: number;
};

type ExpenseCategoryPoint = {
  label: string;
  value: number;
};

type JobProfitabilityRow = {
  id: number;
  job_name: string | null;
  client: string | null;
  status: string;
  income: number;
  expenses: number;
  profit: number;
  margin: number;
};

interface ReportsPageProps {
  range: '1w' | '1m' | '1y';
  totals: {
    income: number;
    expenses: number;
    profit: number;
    margin: number;
  };
  trend: TrendPoint[];
  expenseCategories: ExpenseCategoryPoint[];
  rows: JobProfitabilityRow[];
}

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

function rangeHref(range: ReportsPageProps['range']): string {
  return `/reports?range=${range}`;
}

function activeRangeClass(current: ReportsPageProps['range'], value: ReportsPageProps['range']): string {
  return current === value ? 'btn btn-primary' : 'btn';
}

export const ReportsPage: FC<ReportsPageProps> = ({
  range,
  totals,
  trend,
  expenseCategories,
  rows,
}) => {
  const trendLabels = trend.map((point) => point.label);
  const incomeSeries = trend.map((point) => point.income);
  const expenseSeries = trend.map((point) => point.expenses);
  const profitSeries = trend.map((point) => point.profit);

  const expenseLabels = expenseCategories.map((item) => item.label);
  const expenseValues = expenseCategories.map((item) => item.value);

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Reports</h1>
          <p>Profit monitoring across time, cost categories, and individual jobs.</p>
        </div>

        <div class="actions" style="flex-wrap:wrap;">
          <a class={activeRangeClass(range, '1w')} href={rangeHref('1w')}>1 Week</a>
          <a class={activeRangeClass(range, '1m')} href={rangeHref('1m')}>1 Month</a>
          <a class={activeRangeClass(range, '1y')} href={rangeHref('1y')}>1 Year</a>
        </div>
      </div>

      <div class="grid grid-4">
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Income</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{formatMoney(totals.income)}</div>
        </div>
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Expenses</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{formatMoney(totals.expenses)}</div>
        </div>
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Profit</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{formatMoney(totals.profit)}</div>
        </div>
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Margin</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{formatPercent(totals.margin)}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px;">
        <div class="card">
          <h3 style="margin-top:0;">Profit Trend</h3>
          <div class="muted" style="margin-bottom:12px;">
            Blue = income, gold = expenses, green = profit.
          </div>
          <canvas id="profitTrendChart"></canvas>
        </div>

        <div class="card">
          <h3 style="margin-top:0;">Expense Categories</h3>
          <div class="muted" style="margin-bottom:12px;">
            Cost mix for the selected reporting period.
          </div>
          <canvas id="expenseBreakdownChart"></canvas>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <h3 style="margin-top:0;">Job Profitability</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Client</th>
                <th>Status</th>
                <th class="right">Income</th>
                <th class="right">Expenses</th>
                <th class="right">Profit</th>
                <th class="right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colspan={7} class="muted">No jobs found.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr>
                    <td>{row.job_name || `Job #${row.id}`}</td>
                    <td>{row.client || '—'}</td>
                    <td>{row.status || '—'}</td>
                    <td class="right">{formatMoney(row.income)}</td>
                    <td class="right">{formatMoney(row.expenses)}</td>
                    <td class="right">{formatMoney(row.profit)}</td>
                    <td class="right">{formatPercent(row.margin)}</td>
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
              const incomeSeries = ${JSON.stringify(incomeSeries)};
              const expenseSeries = ${JSON.stringify(expenseSeries)};
              const profitSeries = ${JSON.stringify(profitSeries)};
              const expenseLabels = ${JSON.stringify(expenseLabels)};
              const expenseValues = ${JSON.stringify(expenseValues)};

              const profitCanvas = document.getElementById('profitTrendChart');
              if (profitCanvas && trendLabels.length > 0) {
                new Chart(profitCanvas, {
                  type: 'bar',
                  data: {
                    labels: trendLabels,
                    datasets: [
                      {
                        label: 'Income',
                        data: incomeSeries,
                        backgroundColor: '#1E3A5F'
                      },
                      {
                        label: 'Expenses',
                        data: expenseSeries,
                        backgroundColor: '#F59E0B'
                      },
                      {
                        label: 'Profit',
                        data: profitSeries,
                        backgroundColor: '#10B981'
                      }
                    ]
                  },
                  options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                      y: {
                        beginAtZero: true
                      }
                    }
                  }
                });
              } else if (profitCanvas) {
                profitCanvas.replaceWith(Object.assign(document.createElement('div'), {
                  className: 'muted',
                  textContent: 'No trend data found for this range.'
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
                        '#F97316'
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