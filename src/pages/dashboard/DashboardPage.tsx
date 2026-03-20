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
    jobs_count?: number;
    employees_count?: number;
    invoices_count?: number;
  };
  estimateStats: {
    draft_count: number;
    ready_count: number;
    awaiting_response_count: number;
    rejected_count: number;
    converted_count: number;
    estimate_pipeline_value: number;
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
  recentEstimates: {
    id: number;
    estimate_number: string;
    customer_name: string;
    total: number;
    status: string;
    created_at: string;
    sent_at: string | null;
    responded_at: string | null;
    converted_job_id: number | null;
  }[];
  companyConfigured?: boolean;
  csrfToken: string;
  canManageWorkflow?: boolean;
}

function badgeClass(status: string): string {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'converted' || normalized === 'approved') return 'badge badge-good';
  if (normalized === 'rejected' || normalized === 'expired') return 'badge badge-bad';
  if (normalized === 'sent' || normalized === 'ready') return 'badge badge-warn';
  return 'badge';
}

function statusLabel(status: string): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export const DashboardPage: FC<DashboardPageProps> = ({
  stats,
  estimateStats,
  activeJobs,
  invoicesDue,
  recentTime,
  recentEstimates,
  companyConfigured = false,
  canManageWorkflow = false,
}) => {
  const onboardingSteps = [
    {
      label: 'Complete company profile',
      done: companyConfigured,
      href: '/settings',
    },
    {
      label: 'Create your first job',
      done: (stats.jobs_count ?? stats.active_jobs ?? 0) > 0,
      href: '/add_job',
    },
    {
      label: 'Add your first employee',
      done: (stats.employees_count ?? 0) > 0,
      href: '/add_employee',
    },
    {
      label: 'Create your first invoice',
      done: (stats.invoices_count ?? stats.invoices_due_count ?? 0) > 0,
      href: '/add_invoice',
    },
  ];

  const completedSteps = onboardingSteps.filter((step) => step.done).length;
  const allDone = completedSteps === onboardingSteps.length;

  return (
    <div>
      {!allDone ? (
        <div class="card" style="margin-bottom:14px;">
          <div class="card-head">
            <div>
              <b>Getting Started</b>
              <div class="muted small" style="margin-top:4px;">
                Complete these steps to finish setting up your workspace and start using the platform.
              </div>
            </div>
            <span class="badge">
              {completedSteps}/{onboardingSteps.length} complete
            </span>
          </div>

          <div class="list" style="margin-top:14px;">
            {onboardingSteps.map((step) => (
              <a
                href={step.href}
                class="list-item"
                style={`display:flex; align-items:center; gap:12px; text-decoration:none; color:inherit; ${
                  step.done ? 'background:#F0FDF4; border-color:#BBF7D0;' : ''
                }`}
              >
                <span
                  class={step.done ? 'badge badge-good' : 'badge'}
                  style="min-width:32px; justify-content:center;"
                >
                  {step.done ? '✓' : '○'}
                </span>

                <div style="flex:1;">
                  <div style="font-weight:800; color:#0F172A;">{step.label}</div>
                  <div class="muted small" style="margin-top:4px;">
                    {step.done ? 'Completed' : 'Open this step'}
                  </div>
                </div>

                <span class="btn">Open</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <div class="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Quick view of jobs, estimates, billing, costs, and recent labor activity.</p>
        </div>
        <div class="actions actions-mobile-stack">
          {canManageWorkflow ? <a class="btn" href="/estimates/new">New Estimate</a> : null}
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
          <div class="metric-label">Awaiting Estimate Response</div>
          <div class="metric-value">{estimateStats.awaiting_response_count || 0}</div>
          <div class="muted small" style="margin-top:6px;">
            Sent to customers and waiting
          </div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Estimate Pipeline Value</div>
          <div class="metric-value">${fmt(estimateStats.estimate_pipeline_value || 0)}</div>
          <div class="muted small" style="margin-top:6px;">
            Draft + ready + sent estimate value
          </div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Rejected Estimates</div>
          <div class="metric-value">{estimateStats.rejected_count || 0}</div>
          <div class="muted small" style="margin-top:6px;">
            Need follow-up or revision
          </div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Converted Estimates</div>
          <div class="metric-value">{estimateStats.converted_count || 0}</div>
          <div class="muted small" style="margin-top:6px;">
            Already turned into active jobs
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
            <b>Recent Estimate Activity</b>
            <a class="btn" href="/estimates">View Estimates</a>
          </div>

          {recentEstimates && recentEstimates.length ? (
            <div class="table-wrap table-wrap-tight">
              <table class="table">
                <thead>
                  <tr>
                    <th>Estimate</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th class="right">Total</th>
                    <th class="right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEstimates.map((estimate) => (
                    <tr>
                      <td>
                        <b>{estimate.estimate_number}</b>
                        <div class="muted small">
                          {estimate.responded_at
                            ? `Responded ${String(estimate.responded_at).replace('T', ' ').slice(0, 16)}`
                            : estimate.sent_at
                              ? `Sent ${String(estimate.sent_at).replace('T', ' ').slice(0, 16)}`
                              : `Created ${String(estimate.created_at).replace('T', ' ').slice(0, 16)}`}
                        </div>
                      </td>
                      <td>{estimate.customer_name || '—'}</td>
                      <td>
                        <span class={badgeClass(estimate.status)}>{statusLabel(estimate.status)}</span>
                      </td>
                      <td class="right">${fmt(estimate.total || 0)}</td>
                      <td class="right">
                        {estimate.converted_job_id ? (
                          <a class="btn" href={`/job/${estimate.converted_job_id}`}>Open Job</a>
                        ) : (
                          <a class="btn" href={`/estimate/${estimate.id}`}>Open</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div class="muted">No estimate activity yet.</div>
          )}
        </div>

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
      </div>

      <div class="grid grid-2" style="margin-top:14px;">
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

        <div class="card">
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
    </div>
  );
};

export default DashboardPage;