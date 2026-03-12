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
        <div class="actions">
          <a class="btn" href="/add_invoice">New Invoice</a>
          <a class="btn btn-primary" href="/add_job">New Job</a>
        </div>
      </div>

      <div class="grid grid-4">
        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Active Jobs</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{stats.active_jobs || 0}</div>
          <div class="muted" style="font-size:12px; margin-top:6px;">
            {stats.on_hold_jobs || 0} on hold
          </div>
        </div>

        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Invoiced (MTD)</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            ${fmt(stats.invoiced_mtd || 0)}
          </div>
          <div class="muted" style="font-size:12px; margin-top:6px;">
            ${fmt(stats.collected_mtd || 0)} collected this month
          </div>
        </div>

        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Costs (MTD)</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            ${fmt(stats.costs_mtd || 0)}
          </div>
          <div class="muted" style="font-size:12px; margin-top:6px;">
            ${fmt(stats.labor_mtd || 0)} labor · ${fmt(stats.expenses_mtd || 0)} expenses
          </div>
        </div>

        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Open Receivables</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            ${fmt(stats.invoices_due_total || 0)}
          </div>
          <div class="muted" style="font-size:12px; margin-top:6px;">
            {stats.invoices_due_count || 0} unpaid invoices
          </div>
        </div>
      </div>

      <div class="grid grid-4" style="margin-top:14px;">
        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Recorded Income (MTD)</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            ${fmt(stats.revenue_mtd || 0)}
          </div>
          <div class="muted" style="font-size:12px; margin-top:6px;">
            Manual income entries this month
          </div>
        </div>

        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Overdue Receivables</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            ${fmt(stats.overdue_invoice_total || 0)}
          </div>
          <div class="muted" style="font-size:12px; margin-top:6px;">
            {stats.overdue_invoice_count || 0} overdue invoices
          </div>
        </div>

        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Portfolio Profit</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            ${fmt(stats.total_profit_all || 0)}
          </div>
          <div class="muted" style="font-size:12px; margin-top:6px;">
            Income minus labor and expenses
          </div>
        </div>

        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Closed / Cancelled Jobs</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            {(stats.completed_jobs || 0) + (stats.cancelled_jobs || 0)}
          </div>
          <div class="muted" style="font-size:12px; margin-top:6px;">
            {stats.completed_jobs || 0} completed · {stats.cancelled_jobs || 0} cancelled
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px;">
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <b>Active Jobs</b>
            <a class="btn" href="/jobs">View Jobs</a>
          </div>

          {activeJobs && activeJobs.length ? (
            <div class="table-wrap">
              <table>
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
                        <div class="muted" style="font-size:12px;">#{j.code || j.id}</div>
                      </td>
                      <td>{j.client || '\u2014'}</td>
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
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <b>Invoices Due</b>
            <a class="btn" href="/invoices">View</a>
          </div>

          {invoicesDue && invoicesDue.length ? (
            <div class="table-wrap">
              <table>
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
                        <div class="muted" style="font-size:12px;">{inv.job_name || '\u2014'}</div>
                      </td>
                      <td>{inv.customer || '\u2014'}</td>
                      <td>{inv.due_date || '\u2014'}</td>
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
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <b>Recent Time Activity</b>
          <a class="btn" href="/timesheet">View Timesheets</a>
        </div>

        {recentTime && recentTime.length ? (
          <div class="table-wrap">
            <table>
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