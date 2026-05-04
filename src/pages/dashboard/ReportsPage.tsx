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

export const ReportsPage: FC<ReportsPageProps> = ({
  filter,
  cash,
  aging,
  rows,
}) => {
  const revenue = Number(cash.recordedIncome || 0);
  const costs = Number(cash.cashOutflow || 0);
  const netProfit = revenue - costs;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const collected = Number(cash.collectedPayments || 0);
  const outstanding = Number(cash.openReceivables || 0);
  const invoiced = Number(cash.invoicedAmount || 0);
  const materialsCost = Number(cash.materialsCost || 0);
  const laborCostVal = Number(cash.laborCost || 0);
  const monthlyBillsCost = Number(cash.monthlyBillsCost || 0);
  const fleetCost = Number(cash.fleetCost || 0);

  const csvHref = reportActionHref('/reports/export.csv', filter);
  const printHref = reportActionHref('/reports/print', filter);

  const hasData = rows.length > 0 || revenue > 0 || collected > 0 || costs > 0;

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
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
          <a class={activeRangeClass(filter.range, '1w')} href={rangeHref('1w', filter)}>This Week</a>
          <a class={activeRangeClass(filter.range, '1m')} href={rangeHref('1m', filter)}>This Month</a>
          <a class={activeRangeClass(filter.range, '1y')} href={rangeHref('1y', filter)}>This Year</a>
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
              <div class="stat-sub">expenses + labor</div>
            </div>
            <div class="stat-card stat-card-navy">
              <div class="stat-label">Net Profit</div>
              <div class="stat-value" style={`color:${netProfit >= 0 ? '#22C55E' : '#F87171'};`}>{formatMoney(netProfit)}</div>
              <div class="stat-sub">{formatPercent(margin)} margin</div>
            </div>
            <div class="stat-card stat-card-accent">
              <div class="stat-label">Cash Collected</div>
              <div class="stat-value">{formatMoney(collected)}</div>
              <div class="stat-sub">{formatMoney(outstanding)} outstanding</div>
            </div>
          </div>

          {/* ── Cost Breakdown ── */}
          <div class="card" style="margin-bottom:14px;">
            <h3 style="margin-top:0; margin-bottom:16px;">Cost Breakdown</h3>
            <div class="stat-grid stat-grid-4">
              <div class="stat-card">
                <div class="stat-label">Materials</div>
                <div class="stat-value">{formatMoney(materialsCost)}</div>
                <div class="stat-sub">job expenses</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Labor</div>
                <div class="stat-value">{formatMoney(laborCostVal)}</div>
                <div class="stat-sub">time entries</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Monthly Bills</div>
                <div class="stat-value">{formatMoney(monthlyBillsCost)}</div>
                <div class="stat-sub">recurring bills</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Fleet</div>
                <div class="stat-value">{formatMoney(fleetCost)}</div>
                <div class="stat-sub">fuel &amp; maintenance</div>
              </div>
            </div>
          </div>

          {/* ── Outstanding Invoices ── */}
          {(outstanding > 0 || aging.openCount > 0) ? (
            <div class="card" style="margin-bottom:14px;">
              <h3 style="margin-top:0; margin-bottom:14px;">Outstanding Invoices</h3>
              <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px;">
                <div>
                  <div class="muted" style="font-size:12px; margin-bottom:4px;">Total Invoiced</div>
                  <div style="font-size:20px; font-weight:800;">{formatMoney(invoiced)}</div>
                </div>
                <div>
                  <div class="muted" style="font-size:12px; margin-bottom:4px;">Collected</div>
                  <div style="font-size:20px; font-weight:800; color:#065F46;">{formatMoney(collected)}</div>
                </div>
                <div>
                  <div class="muted" style="font-size:12px; margin-bottom:4px;">Still Owed</div>
                  <div style="font-size:20px; font-weight:800; color:#92400E;">{formatMoney(outstanding)}</div>
                </div>
              </div>
              {aging.overdueTotal > 0 ? (
                <div style="margin-top:14px; padding-top:14px; border-top:1px solid #E5EAF2; display:flex; align-items:center; gap:10px;">
                  <span style="background:#FEF2F2; border:1px solid #FECACA; color:#991B1B; font-weight:700; font-size:13px; padding:4px 10px; border-radius:6px;">
                    {formatMoney(aging.overdueTotal)} overdue
                  </span>
                  <span class="muted" style="font-size:13px;">{aging.openCount} open invoice{aging.openCount !== 1 ? 's' : ''}</span>
                  <a href="/invoices" style="margin-left:auto; font-size:13px; font-weight:600; color:var(--navy);">View Invoices →</a>
                </div>
              ) : (
                <div style="margin-top:14px; padding-top:14px; border-top:1px solid #E5EAF2;">
                  <span class="muted" style="font-size:13px;">{aging.openCount} open invoice{aging.openCount !== 1 ? 's' : ''} · none overdue</span>
                  <a href="/invoices" style="margin-left:16px; font-size:13px; font-weight:600; color:var(--navy);">View Invoices →</a>
                </div>
              )}
            </div>
          ) : null}

          {/* ── Job Profitability Table ── */}
          <div class="card">
            <h3 style="margin-top:0; margin-bottom:14px;">Job Breakdown</h3>
            <div class="table-wrap" style="margin:0 -18px -16px;">
              <table>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th class="right">Revenue</th>
                    <th class="right">Expenses</th>
                    <th class="right">Labor</th>
                    <th class="right">Profit</th>
                    <th class="right">Margin</th>
                    <th class="right">Owed</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} class="muted">No jobs found for this period.</td>
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
        </>
      )}
    </div>
  );
};

export default ReportsPage;
