import type { FC } from 'hono/jsx';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface DashboardPageProps {
  stats: {
    active_jobs: number;
    on_hold_jobs: number;
    completed_jobs: number;
    cancelled_jobs: number;
    revenue_mtd: number;
    invoiced_mtd: number;
    collected_mtd: number;
    labor_mtd: number;
    expenses_mtd: number;
    costs_mtd: number;
    invoices_due_count: number;
    invoices_due_total: number;
    overdue_invoice_count: number;
    overdue_invoice_total: number;
    total_profit_all: number;
  };
  activeJobs: {
    id: number;
    name: string | null;
    client: string | null;
    status: string;
    budget: number;
    code: string;
  }[];
  invoicesDue: {
    id: number;
    number: string;
    customer: string | null;
    due_date: string;
    balance: number;
    job_name: string | null;
    derived_status: 'Paid' | 'Unpaid' | 'Overdue';
  }[];
  recentTime: {
    date: string;
    hours: number;
    labor_cost: number;
    employee_name: string;
    job_name: string;
  }[];
  csrfToken: string;
}

export const DashboardPage: FC<DashboardPageProps> = ({
  stats,
  activeJobs,
  invoicesDue,
  recentTime,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Quick view of jobs, billing, costs, and recent labor activity.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href="/add_invoice">New Invoice</a>
          <a class="btn btn-primary" href="/add_job">New Job</a>
        </div>
      </div>

      <div class="grid grid-4 mobile-card-grid">
        <div class="card mobile-kpi-card">
          <div class="metric-label">Active Jobs</div>
          <div class="metric-value">{stats.active_jobs || 0}</div>
          <div class="muted small" style="margin-top:6px;">
            {stats.on_hold_jobs || 0} on hold
          </div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Invoiced (MTD)</div>
          <div class="metric-value">${fmt(stats.invoiced_mtd || 0)}</div>
          <div class="muted small" style="margin-top:6px;">
            ${fmt(stats.collected_mtd || 0)} collected this month
          </div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Costs (MTD)</div>
          <div class="metric-value">${fmt(stats.costs_mtd || 0)}</div>
          <div class="muted small" style="margin-top:6px;">
            ${fmt(stats.labor_mtd || 0)} labor · ${fmt(stats.expenses_mtd || 0)} expenses
          </div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Open Receivables</div>
          <div class="metric-value">${fmt(stats.invoices_due_total || 0)}</div>
          <div class="muted small" style="margin-top:6px;">
            {stats.invoices_due_count || 0} unpaid invoices
          </div>
        </div>
      </div>

      <div class="grid grid-4 mobile-card-grid" style="margin-top:14px;">
        <div class="card mobile-kpi-card">
          <div class="metric-label">Recorded Income (MTD)</div>
          <div class="metric-value">${fmt(stats.revenue_mtd || 0)}</div>
          <div class="muted small" style="margin-top:6px;">
            Manual income entries this month
          </div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Overdue Receivables</div>
          <div class="metric-value">${fmt(stats.overdue_invoice_total || 0)}</div>
          <div class="muted small" style="margin-top:6px;">
            {stats.overdue_invoice_count || 0} overdue invoices
          </div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Portfolio Profit</div>
          <div class="metric-value">${fmt(stats.total_profit_all || 0)}</div>
          <div class="muted small" style="margin-top:6px;">
            Income minus labor and expenses
          </div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Closed / Cancelled Jobs</div>
          <div class="metric-value">
            {(stats.completed_jobs || 0) + (stats.cancelled_jobs || 0)}
          </div>
          <div class="muted small" style="margin-top:6px;">
            {stats.completed_jobs || 0} completed · {stats.cancelled_jobs || 0} cancelled
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px;">
        <div class="card">
          <div class="card-head">
            <b>Active Jobs</b>
            <a class="btn" href="/jobs">View Jobs</a>
          </div>

          {activeJobs && activeJobs.length ? (
            <div class="table-wrap table-wrap-tight">
              <table class="table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th class="right">Contract</th>
                  </tr>
                </thead>
                <tbody>
                  {activeJobs.map((j) => (
                    <tr>
                      <td>
                        <b>{j.name}</b>
                        <div class="muted small">#{j.code || j.id}</div>
                      </td>
                      <td>{j.client || '—'}</td>
                      <td><span class="badge">{j.status || 'Active'}</span></td>
                      <td class="right">${fmt(j.budget || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div class="muted">No active jobs yet.</div>
          )}
        </div>

        <div class="card">
          <div class="card-head">
            <b>Invoices Due</b>
            <a class="btn" href="/invoices">View</a>
          </div>

          {invoicesDue && invoicesDue.length ? (
            <div class="table-wrap table-wrap-tight">
              <table class="table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th class="right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesDue.map((inv) => (
                    <tr>
                      <td>
                        <b>{inv.number || `INV-${inv.id}`}</b>
                        <div class="muted small">{inv.job_name || '—'}</div>
                      </td>
                      <td>{inv.customer || '—'}</td>
                      <td>{inv.due_date || '—'}</td>
                      <td>
                        <span class={`badge ${inv.derived_status === 'Overdue' ? 'badge-bad' : ''}`}>
                          {inv.derived_status}
                        </span>
                      </td>
                      <td class="right">${fmt(inv.balance || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div class="muted">No invoices due.</div>
          )}
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="card-head">
          <b>Recent Time Activity</b>
          <a class="btn" href="/timesheet">View Timesheets</a>
        </div>

        {recentTime && recentTime.length ? (
          <div class="table-wrap table-wrap-tight">
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Job</th>
                  <th class="right">Hours</th>
                  <th class="right">Labor Cost</th>
                </tr>
              </thead>
              <tbody>
                {recentTime.map((row) => (
                  <tr>
                    <td>{row.date}</td>
                    <td>{row.employee_name}</td>
                    <td>{row.job_name}</td>
                    <td class="right">{fmt(row.hours || 0)}</td>
                    <td class="right">${fmt(row.labor_cost || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div class="muted">No recent time activity yet.</div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;