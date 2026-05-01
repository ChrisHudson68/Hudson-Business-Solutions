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

function rangeHref(range: Exclude<ReportRange, 'custom'>, filter: ReportFilter): string {
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

function reportActionHref(basePath: string, filter: ReportFilter): string {
  const params = new URLSearchParams();
  params.set('range', filter.range);
  params.set('start', filter.startDate);
  params.set('end', filter.endDate);
  return `${basePath}?${params.toString()}`;
}

function profitColor(value: number): string {
  return value >= 0 ? '#065F46' : '#991B1B';
}

function AgingBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style="display:grid; gap:4px;">
      <div style="display:flex; justify-content:space-between; align-items:baseline;">
        <span style="font-size:12px; color:#64748B; font-weight:600;">{label}</span>
        <span style="font-size:13px; font-weight:700;">{formatMoney(value)}</span>
      </div>
      <div style="height:6px; background:#E5EAF2; border-radius:3px; overflow:hidden;">
        <div style={`height:100%; width:${pct}%; background:${color}; border-radius:3px;`} />
      </div>
    </div>
  );
}

function JobRankCard({ title, rows, valueLabel, valueKey, subKey, subLabel }: {
  title: string;
  rows: ProfitabilityRow[];
  valueLabel: string;
  valueKey: 'profit' | 'margin';
  subKey: 'profit' | 'margin';
  subLabel: string;
}) {
  return (
    <div class="card">
      <h3 style="margin-top:0; margin-bottom:12px;">{title}</h3>
      {rows.length === 0 ? (
        <div class="muted">No jobs found.</div>
      ) : (
        <div style="display:grid; gap:8px;">
          {rows.map((row, i) => (
            <div key={row.id} style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #F1F5F9;">
              <div style="font-size:11px; font-weight:800; color:#94A3B8; width:18px; flex:0 0 auto;">{i + 1}</div>
              <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  <a href={`/job/${row.id}`} style="color:inherit; text-decoration:none;">{row.job_name || `Job #${row.id}`}</a>
                </div>
                <div class="muted" style="font-size:11px;">{row.client || '—'}</div>
              </div>
              <div style="text-align:right; flex:0 0 auto;">
                <div style={`font-weight:700; font-size:13px; color:${valueKey === 'profit' ? profitColor(row.profit) : '#1E3A5F'};`}>
                  {valueKey === 'profit' ? formatMoney(row.profit) : formatPercent(row.margin)}
                </div>
                <div class="muted" style="font-size:11px;">
                  {subKey === 'profit' ? formatMoney(row.profit) : formatPercent(row.margin)} {subLabel}
                </div>
              </div>
            </div>
          ))}
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
  const trendLabels = trend.map((p) => p.label);
  const inflowSeries = trend.map((p) => p.inflow);
  const outflowSeries = trend.map((p) => p.outflow);
  const netSeries = trend.map((p) => p.net);
  const expenseLabels = expenseCategories.map((i) => i.label);
  const expenseValues = expenseCategories.map((i) => i.value);

  const revenue = Number(cash.recordedIncome || 0);
  const costs = Number(cash.cashOutflow || 0);
  const netProfit = revenue - costs;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const collected = Number(cash.collectedPayments || 0);
  const outstanding = Number(cash.openReceivables || 0);
  const invoiced = Number(cash.invoicedAmount || 0);
  const agingTotal = Number(aging.totalOpen || 0);

  const csvHref = reportActionHref('/reports/export.csv', filter);
  const printHref = reportActionHref('/reports/print', filter);

  const hasData =
    rows.length > 0 ||
    trend.length > 0 ||
    expenseCategories.length > 0 ||
    revenue > 0 ||
    collected > 0 ||
    costs > 0 ||
    invoiced > 0 ||
    aging.openCount > 0;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Reports</h1>
          <p class="muted">{filter.label}</p>
        </div>
        <div class="actions">
          <a class="btn" href={csvHref}>Export CSV</a>
          <a class="btn" href={printHref} target="_blank" rel="noreferrer">Print View</a>
        </div>
      </div>

      {/* Date range filter */}
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:14px;">
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <a class={activeRangeClass(filter.range, '1w')} href={rangeHref('1w', filter)}>This Week</a>
            <a class={activeRangeClass(filter.range, '1m')} href={rangeHref('1m', filter)}>This Month</a>
            <a class={activeRangeClass(filter.range, '1y')} href={rangeHref('1y', filter)}>This Year</a>
          </div>
        </div>
        <form method="get" action="/reports">
          <input type="hidden" name="range" value="custom" />
          <div class="row" style="max-width:520px;">
            <div>
              <label>Start Date</label>
              <input type="date" name="start" value={filter.startDate} required />
            </div>
            <div>
              <label>End Date</label>
              <input type="date" name="end" value={filter.endDate} required />
            </div>
            <div style="flex:0; align-self:flex-end;">
              <label>&nbsp;</label>
              <button class="btn btn-primary" type="submit">Apply</button>
            </div>
          </div>
        </form>
      </div>

      {!hasData ? (
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <h3>No report data yet</h3>
            <p>Reports populate as you add jobs, record time, log expenses, and issue invoices.</p>
            <div class="actions" style="justify-content:center;">
              <a class="btn" href="/jobs">Jobs</a>
              <a class="btn" href="/timesheet">Timesheets</a>
              <a class="btn btn-primary" href="/invoices">Invoices</a>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ── P&L Summary ── */}
          <div class="stat-grid stat-grid-4" style="margin-bottom:14px;">
            <div class="stat-card stat-card-green">
              <div class="stat-label">Revenue</div>
              <div class="stat-value">{formatMoney(revenue)}</div>
              <div class="stat-sub">{formatMoney(invoiced)} invoiced</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Costs</div>
              <div class="stat-value">{formatMoney(costs)}</div>
              <div class="stat-sub">{formatMoney(cash.recordedExpenses)} expenses · {formatMoney(cash.laborCost)} labor</div>
            </div>
            <div class="stat-card stat-card-navy">
              <div class="stat-label">Net Profit</div>
              <div class="stat-value" style={`color:${netProfit >= 0 ? '#22C55E' : '#F87171'};`}>{formatMoney(netProfit)}</div>
              <div class="stat-sub">{formatPercent(margin)} margin</div>
            </div>
            <div class="stat-card stat-card-accent">
              <div class="stat-label">Cash Collected</div>
              <div class="stat-value">{formatMoney(collected)}</div>
              <div class="stat-sub">{formatMoney(outstanding)} still outstanding</div>
            </div>
          </div>

          {/* ── Invoice Position ── */}
          <div class="card" style="margin-bottom:14px;">
            <h3 style="margin-top:0; margin-bottom:16px;">Invoice Position</h3>
            <div class="grid" style="grid-template-columns:1fr 1fr; gap:24px; margin-bottom:16px;">
              <div style="display:grid; gap:6px;">
                <div style="display:flex; justify-content:space-between; font-size:13px;">
                  <span class="muted">Total Invoiced</span>
                  <span style="font-weight:700;">{formatMoney(invoiced)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:13px;">
                  <span class="muted">Collected</span>
                  <span style="font-weight:700; color:#065F46;">{formatMoney(collected)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:13px; padding-top:6px; border-top:1px solid #E5EAF2;">
                  <span class="muted">Outstanding</span>
                  <span style="font-weight:700; color:#92400E;">{formatMoney(outstanding)}</span>
                </div>
              </div>
              <div style="display:grid; gap:6px;">
                <div style="display:flex; justify-content:space-between; font-size:13px;">
                  <span class="muted">Open Invoices</span>
                  <span style="font-weight:700;">{aging.openCount}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:13px;">
                  <span class="muted">Overdue</span>
                  <span style="font-weight:700; color:#991B1B;">{formatMoney(aging.overdueTotal)}</span>
                </div>
              </div>
            </div>

            {agingTotal > 0 ? (
              <div style="display:grid; gap:10px; padding-top:14px; border-top:1px solid #E5EAF2;">
                <div style="font-size:12px; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:.06em;">
                  Aging Breakdown — {formatMoney(agingTotal)} total open
                </div>
                <AgingBar label="Current (not yet due)" value={aging.current} total={agingTotal} color="#10B981" />
                <AgingBar label="1–30 days overdue" value={aging.days1to30} total={agingTotal} color="#F59E0B" />
                <AgingBar label="31–60 days overdue" value={aging.days31to60} total={agingTotal} color="#F97316" />
                <AgingBar label="61–90 days overdue" value={aging.days61to90} total={agingTotal} color="#EF4444" />
                <AgingBar label="90+ days overdue" value={aging.days90Plus} total={agingTotal} color="#991B1B" />
              </div>
            ) : null}
          </div>

          {/* ── Charts ── */}
          <div class="grid grid-2" style="margin-bottom:14px;">
            <div class="card">
              <h3 style="margin-top:0;">Income vs. Costs Over Time</h3>
              <p class="muted" style="font-size:13px; margin-bottom:14px;">
                Revenue collected and total costs by period, with net profit line.
              </p>
              <canvas id="trendChart"></canvas>
            </div>
            <div class="card">
              <h3 style="margin-top:0;">Expense Breakdown</h3>
              <p class="muted" style="font-size:13px; margin-bottom:14px;">
                Where your costs are going this period.
              </p>
              {expenseCategories.length > 0 ? (
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:center;">
                  <canvas id="expenseChart"></canvas>
                  <div style="display:grid; gap:6px;">
                    {expenseCategories.map((item, i) => {
                      const colors = ['#1E3A5F','#F59E0B','#3B82F6','#10B981','#EF4444','#8B5CF6','#F97316','#14B8A6'];
                      return (
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:12px;">
                          <div style="display:flex; align-items:center; gap:6px;">
                            <div style={`width:10px; height:10px; border-radius:2px; background:${colors[i % colors.length]}; flex:0 0 auto;`} />
                            <span class="muted">{item.label}</span>
                          </div>
                          <span style="font-weight:700;">{formatMoney(item.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div class="muted">No expense data for this period.</div>
              )}
            </div>
          </div>

          {/* ── Job Rankings ── */}
          <div class="grid grid-2" style="margin-bottom:14px;">
            <JobRankCard
              title="Top Profit Jobs"
              rows={topProfitJobs}
              valueLabel="Profit"
              valueKey="profit"
              subKey="margin"
              subLabel="margin"
            />
            <JobRankCard
              title="Top Margin Jobs"
              rows={topMarginJobs}
              valueLabel="Margin"
              valueKey="margin"
              subKey="profit"
              subLabel="profit"
            />
          </div>
          <div class="grid grid-2" style="margin-bottom:14px;">
            <JobRankCard
              title="Lowest Profit Jobs"
              rows={worstProfitJobs}
              valueLabel="Profit"
              valueKey="profit"
              subKey="margin"
              subLabel="margin"
            />
            <JobRankCard
              title="Lowest Margin Jobs"
              rows={worstMarginJobs}
              valueLabel="Margin"
              valueKey="margin"
              subKey="profit"
              subLabel="profit"
            />
          </div>

          {/* ── Job Profitability Table ── */}
          <div class="card">
            <h3 style="margin-top:0; margin-bottom:4px;">Job Profitability</h3>
            <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:14px;">
              <span class="muted" style="font-size:12px;">
                <b>Income</b> = revenue entries recorded on the job
              </span>
              <span class="muted" style="font-size:12px;">
                <b>Collected</b> = all invoice payments received (all-time)
              </span>
              <span class="muted" style="font-size:12px;">
                <b>Profit</b> = Income − (Expenses + Labor)
              </span>
            </div>
            <div class="table-wrap" style="margin:0 -18px -16px;">
              <table>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th class="right">Income</th>
                    <th class="right">Collected</th>
                    <th class="right">Expenses</th>
                    <th class="right">Labor</th>
                    <th class="right">Profit</th>
                    <th class="right">Margin</th>
                    <th class="right">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} class="muted">No jobs found for this period.</td>
                    </tr>
                  ) : rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <a href={`/job/${row.id}`} style="font-weight:700; color:var(--navy);">
                          {row.job_name || `Job #${row.id}`}
                        </a>
                      </td>
                      <td>{row.client || '—'}</td>
                      <td>
                        {row.archived ? (
                          <span class="badge badge-warn">Archived</span>
                        ) : (
                          <span class="badge">{row.status || '—'}</span>
                        )}
                      </td>
                      <td class="right">{row.income > 0 ? formatMoney(row.income) : <span class="muted">—</span>}</td>
                      <td class="right">{row.collected > 0 ? formatMoney(row.collected) : <span class="muted">—</span>}</td>
                      <td class="right">{row.expenses > 0 ? formatMoney(row.expenses) : <span class="muted">—</span>}</td>
                      <td class="right">{row.labor > 0 ? formatMoney(row.labor) : <span class="muted">—</span>}</td>
                      <td class="right" style={`font-weight:700; color:${profitColor(row.profit)};`}>
                        {formatMoney(row.profit)}
                      </td>
                      <td class="right">{formatPercent(row.margin)}</td>
                      <td class="right">
                        {row.openAr > 0 ? (
                          <span style="color:#92400E; font-weight:700;">{formatMoney(row.openAr)}</span>
                        ) : (
                          <span class="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <script dangerouslySetInnerHTML={{ __html: `
            (() => {
              const labels = ${JSON.stringify(trendLabels)};
              const inflow = ${JSON.stringify(inflowSeries)};
              const outflow = ${JSON.stringify(outflowSeries)};
              const net = ${JSON.stringify(netSeries)};
              const expLabels = ${JSON.stringify(expenseLabels)};
              const expValues = ${JSON.stringify(expenseValues)};
              const colors = ['#1E3A5F','#F59E0B','#3B82F6','#10B981','#EF4444','#8B5CF6','#F97316','#14B8A6'];

              const trendCanvas = document.getElementById('trendChart');
              if (trendCanvas && labels.length > 0) {
                new Chart(trendCanvas, {
                  data: {
                    labels,
                    datasets: [
                      { type: 'bar', label: 'Revenue', data: inflow, backgroundColor: 'rgba(16,185,129,0.7)' },
                      { type: 'bar', label: 'Costs', data: outflow, backgroundColor: 'rgba(239,68,68,0.7)' },
                      { type: 'line', label: 'Net Profit', data: net, borderColor: '#1E3A5F', backgroundColor: '#1E3A5F', tension: 0.3, pointRadius: 3 }
                    ]
                  },
                  options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { beginAtZero: true, ticks: { callback: v => '$' + Number(v).toLocaleString() } } }
                  }
                });
              } else if (trendCanvas) {
                trendCanvas.replaceWith(Object.assign(document.createElement('div'), { className: 'muted', textContent: 'No trend data for this period.' }));
              }

              const expCanvas = document.getElementById('expenseChart');
              if (expCanvas && expLabels.length > 0) {
                new Chart(expCanvas, {
                  type: 'doughnut',
                  data: { labels: expLabels, datasets: [{ data: expValues, backgroundColor: colors, borderWidth: 2 }] },
                  options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
                });
              }
            })();
          ` }} />
        </>
      )}
    </div>
  );
};

export default ReportsPage;
