import type { FC } from 'hono/jsx';
import { hasPermission } from '../../services/permissions.js';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface DashboardPageProps {
  permissions?: string[];
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
    job_name: string | null;
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
  fleetAlerts?: {
    registrationExpiringSoon: number;
    registrationOverdue: number;
    insuranceExpiringSoon: number;
    insuranceOverdue: number;
  };
}

function estimateBadgeClass(status: string): string {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'converted' || s === 'approved') return 'badge badge-good';
  if (s === 'rejected' || s === 'expired') return 'badge badge-bad';
  if (s === 'sent' || s === 'ready') return 'badge badge-warn';
  return 'badge';
}

function statusLabel(status: string): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export const DashboardPage: FC<DashboardPageProps> = ({
  permissions,
  stats,
  estimateStats,
  activeJobs,
  invoicesDue,
  recentTime,
  recentEstimates,
  companyConfigured = false,
  canManageWorkflow = false,
  fleetAlerts,
}) => {
  const onboardingSteps = [
    { label: 'Complete company profile', done: companyConfigured, href: '/settings' },
    { label: 'Create your first job', done: (stats.jobs_count ?? stats.active_jobs ?? 0) > 0, href: '/add_job' },
    { label: 'Add your first employee', done: (stats.employees_count ?? 0) > 0, href: '/add_employee' },
    { label: 'Create your first invoice', done: (stats.invoices_count ?? stats.invoices_due_count ?? 0) > 0, href: '/add_invoice' },
  ];

  const completedSteps = onboardingSteps.filter((s) => s.done).length;
  const allDone = completedSteps === onboardingSteps.length;

  const hasFleetAlerts = fleetAlerts && (
    fleetAlerts.registrationExpiringSoon > 0 ||
    fleetAlerts.registrationOverdue > 0 ||
    fleetAlerts.insuranceExpiringSoon > 0 ||
    fleetAlerts.insuranceOverdue > 0
  );

  return (
    <div>
      <style>{`
        .db-onboard-step{
          display:flex;
          align-items:center;
          gap:12px;
          padding:11px 14px;
          border-radius:10px;
          border:1px solid var(--border);
          background:#fff;
          text-decoration:none;
          color:inherit;
          transition:background .12s, border-color .12s;
        }
        .db-onboard-step:hover{ background:#F8FBFF; border-color:#CBD5E1; text-decoration:none; }
        .db-onboard-step.done{ background:#F0FDF4; border-color:#A7F3D0; }
        .db-onboard-icon{
          width:30px; height:30px; border-radius:8px;
          display:flex; align-items:center; justify-content:center;
          font-size:14px; flex:0 0 30px;
          background:#F1F5F9;
        }
        .db-onboard-step.done .db-onboard-icon{ background:#DCFCE7; }
        .db-section-gap{ margin-top:16px; }
      `}</style>

      {/* ── Onboarding ── */}
      {!allDone ? (
        <div class="card db-section-gap" style="margin-bottom:20px; margin-top:0;">
          <div class="card-head">
            <div>
              <h3>Getting Started</h3>
              <p>Finish these steps to unlock the full platform.</p>
            </div>
            <span class="badge" style="background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); color:#fff;">
              {completedSteps}/{onboardingSteps.length}
            </span>
          </div>
          <div class="list" style="gap:8px;">
            {onboardingSteps.map((step) => (
              <a href={step.href} class={`db-onboard-step${step.done ? ' done' : ''}`}>
                <div class="db-onboard-icon">{step.done ? '✓' : '○'}</div>
                <div style="flex:1;">
                  <div style="font-weight:700; font-size:13.5px;">{step.label}</div>
                  <div class="muted" style="font-size:12px; margin-top:2px;">
                    {step.done ? 'Done' : 'Click to set up'}
                  </div>
                </div>
                <span class={step.done ? 'badge badge-good' : 'badge'}>{step.done ? 'Done' : 'Open'}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Page head ── */}
      <div class="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Jobs, estimates, billing, costs, and recent activity at a glance.</p>
        </div>
        <div class="actions">
          {canManageWorkflow ? (
            <a class="btn" href="/estimates/new">New Estimate</a>
          ) : null}
          {hasPermission(permissions || [], 'invoices.create') ? (
            <a class="btn" href="/add_invoice">New Invoice</a>
          ) : null}
          {hasPermission(permissions || [], 'jobs.create') ? (
            <a class="btn btn-primary" href="/add_job">+ New Job</a>
          ) : null}
        </div>
      </div>

      {/* ── Jobs + Financial row ── */}
      <div class="stat-grid stat-grid-4">
        <div class="stat-card stat-card-navy">
          <div class="stat-label">Active Jobs</div>
          <div class="stat-value">{stats.active_jobs || 0}</div>
          <div class="stat-sub">{stats.on_hold_jobs || 0} on hold</div>
        </div>
        <div class="stat-card stat-card-accent">
          <div class="stat-label">Invoiced (MTD)</div>
          <div class="stat-value">${fmt(stats.invoiced_mtd || 0)}</div>
          <div class="stat-sub">${fmt(stats.collected_mtd || 0)} collected</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Costs (MTD)</div>
          <div class="stat-value">${fmt(stats.costs_mtd || 0)}</div>
          <div class="stat-sub">${fmt(stats.labor_mtd || 0)} labor · ${fmt(stats.expenses_mtd || 0)} other</div>
        </div>
        <div class="stat-card stat-card-red">
          <div class="stat-label">Open Receivables</div>
          <div class="stat-value">${fmt(stats.invoices_due_total || 0)}</div>
          <div class="stat-sub">{stats.invoices_due_count || 0} unpaid invoices</div>
        </div>
      </div>

      {/* ── Estimates + Profit row ── */}
      <div class="stat-grid stat-grid-4 db-section-gap">
        <div class="stat-card">
          <div class="stat-label">Awaiting Response</div>
          <div class="stat-value">{estimateStats.awaiting_response_count || 0}</div>
          <div class="stat-sub">Estimates sent to customers</div>
        </div>
        <div class="stat-card stat-card-accent">
          <div class="stat-label">Estimate Pipeline</div>
          <div class="stat-value">${fmt(estimateStats.estimate_pipeline_value || 0)}</div>
          <div class="stat-sub">Draft + ready + sent value</div>
        </div>
        <div class="stat-card stat-card-green">
          <div class="stat-label">Converted Estimates</div>
          <div class="stat-value">{estimateStats.converted_count || 0}</div>
          <div class="stat-sub">Turned into active jobs</div>
        </div>
        <div class="stat-card stat-card-navy">
          <div class="stat-label">Portfolio Profit</div>
          <div class="stat-value">${fmt(stats.total_profit_all || 0)}</div>
          <div class="stat-sub">Income minus all costs</div>
        </div>
      </div>

      {/* ── More stats row ── */}
      <div class="stat-grid stat-grid-4 db-section-gap">
        <div class="stat-card">
          <div class="stat-label">Recorded Income (MTD)</div>
          <div class="stat-value">${fmt(stats.revenue_mtd || 0)}</div>
          <div class="stat-sub">Manual income entries</div>
        </div>
        <div class="stat-card stat-card-red">
          <div class="stat-label">Overdue Receivables</div>
          <div class="stat-value">${fmt(stats.overdue_invoice_total || 0)}</div>
          <div class="stat-sub">{stats.overdue_invoice_count || 0} overdue invoices</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Rejected Estimates</div>
          <div class="stat-value">{estimateStats.rejected_count || 0}</div>
          <div class="stat-sub">Need follow-up or revision</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Closed / Cancelled</div>
          <div class="stat-value">{(stats.completed_jobs || 0) + (stats.cancelled_jobs || 0)}</div>
          <div class="stat-sub">{stats.completed_jobs || 0} completed · {stats.cancelled_jobs || 0} cancelled</div>
        </div>
      </div>

      {/* ── Fleet Alerts ── */}
      {hasFleetAlerts ? (
        <div class="card db-section-gap" style="border-color:#FDE68A;">
          <div class="card-head" style="background:linear-gradient(135deg, #92400E 0%, #B45309 100%);">
            <div>
              <h3>🚛 Fleet Renewal Watch</h3>
              <p>Registration and insurance documents needing attention soon.</p>
            </div>
            <a class="btn" href="/fleet/schedule">Fleet Schedule</a>
          </div>
          <div class="stat-grid stat-grid-4">
            <div class="stat-card stat-card-red">
              <div class="stat-label">Registration Overdue</div>
              <div class="stat-value">{fleetAlerts!.registrationOverdue || 0}</div>
            </div>
            <div class="stat-card stat-card-accent">
              <div class="stat-label">Registration Due Soon</div>
              <div class="stat-value">{fleetAlerts!.registrationExpiringSoon || 0}</div>
            </div>
            <div class="stat-card stat-card-red">
              <div class="stat-label">Insurance Overdue</div>
              <div class="stat-value">{fleetAlerts!.insuranceOverdue || 0}</div>
            </div>
            <div class="stat-card stat-card-accent">
              <div class="stat-label">Insurance Due Soon</div>
              <div class="stat-value">{fleetAlerts!.insuranceExpiringSoon || 0}</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Estimates + Active Jobs tables ── */}
      <div class="grid grid-2 db-section-gap">
        <div class="card">
          <div class="card-head">
            <h3>Recent Estimates</h3>
            <a class="btn" href="/estimates">View All</a>
          </div>
          {recentEstimates && recentEstimates.length ? (
            <div class="table-wrap" style="margin:0 -18px -16px;">
              <table>
                <thead>
                  <tr>
                    <th>Estimate</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th class="right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEstimates.map((e) => (
                    <tr>
                      <td>
                        <a href={e.converted_job_id ? `/job/${e.converted_job_id}` : `/estimate/${e.id}`} style="font-weight:700;">
                          {e.estimate_number}
                        </a>
                        <div class="muted" style="font-size:12px; margin-top:2px;">
                          {e.responded_at
                            ? `Responded ${String(e.responded_at).slice(0, 10)}`
                            : e.sent_at
                              ? `Sent ${String(e.sent_at).slice(0, 10)}`
                              : `Created ${String(e.created_at).slice(0, 10)}`}
                        </div>
                      </td>
                      <td>{e.customer_name || '—'}</td>
                      <td><span class={estimateBadgeClass(e.status)}>{statusLabel(e.status)}</span></td>
                      <td class="right" style="font-weight:700;">${fmt(e.total || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div class="empty-state">
              <div class="empty-state-icon">📋</div>
              <h3>No estimates yet</h3>
              <p>Create your first estimate to start tracking the pipeline.</p>
              {canManageWorkflow ? <a class="btn btn-primary" href="/estimates/new">New Estimate</a> : null}
            </div>
          )}
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Active Jobs</h3>
            <a class="btn" href="/jobs">View All</a>
          </div>
          {activeJobs && activeJobs.length ? (
            <div class="table-wrap" style="margin:0 -18px -16px;">
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
                        <a href={`/job/${j.id}`} style="font-weight:700;">{j.name || '—'}</a>
                        <div class="muted" style="font-size:12px; margin-top:2px;">#{j.code || j.id}</div>
                      </td>
                      <td>{j.client || '—'}</td>
                      <td><span class="badge">{j.status || 'Active'}</span></td>
                      <td class="right" style="font-weight:700;">${fmt(j.budget || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div class="empty-state">
              <div class="empty-state-icon">🏗️</div>
              <h3>No active jobs</h3>
              <p>Add your first job to start tracking costs and progress.</p>
              {hasPermission(permissions || [], 'jobs.create') ? <a class="btn btn-primary" href="/add_job">+ New Job</a> : null}
            </div>
          )}
        </div>
      </div>

      {/* ── Invoices + Recent Time tables ── */}
      <div class="grid grid-2 db-section-gap">
        <div class="card">
          <div class="card-head">
            <h3>Invoices Due</h3>
            <a class="btn" href="/invoices">View All</a>
          </div>
          {invoicesDue && invoicesDue.length ? (
            <div class="table-wrap" style="margin:0 -18px -16px;">
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
                        <a href={`/invoice/${inv.id}`} style="font-weight:700;">{inv.number || `INV-${inv.id}`}</a>
                        <div class="muted" style="font-size:12px; margin-top:2px;">{inv.job_name || '—'}</div>
                      </td>
                      <td>{inv.customer || '—'}</td>
                      <td style="white-space:nowrap;">{inv.due_date || '—'}</td>
                      <td>
                        <span class={`badge${inv.derived_status === 'Overdue' ? ' badge-bad' : ''}`}>
                          {inv.derived_status}
                        </span>
                      </td>
                      <td class="right" style="font-weight:700;">${fmt(inv.balance || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div class="empty-state">
              <div class="empty-state-icon">🧾</div>
              <h3>No invoices due</h3>
              <p>All caught up — no outstanding invoices right now.</p>
            </div>
          )}
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Recent Time</h3>
            <a class="btn" href="/timesheet">Timesheets</a>
          </div>
          {recentTime && recentTime.length ? (
            <div class="table-wrap" style="margin:0 -18px -16px;">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Job</th>
                    <th class="right">Hrs</th>
                    <th class="right">Labor Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTime.map((row) => (
                    <tr>
                      <td style="white-space:nowrap;">{row.date}</td>
                      <td>{row.employee_name}</td>
                      <td class="muted">{row.job_name || '—'}</td>
                      <td class="right">{fmt(row.hours || 0)}</td>
                      <td class="right" style="font-weight:700;">${fmt(row.labor_cost || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div class="empty-state">
              <div class="empty-state-icon">⏱️</div>
              <h3>No time entries yet</h3>
              <p>Time entries will appear here as employees clock in.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
