import type { FC } from 'hono/jsx';

interface JobRow {
  id: number;
  job_name: string;
  job_code: string | null;
  client_name: string | null;
  contract_amount: number;
  retainage_percent: number;
  start_date: string | null;
  status: string | null;
  income_total: number;
  expense_total: number;
  labor_total: number;
  invoice_total: number;
  payments_total: number;
  total_costs: number;
  profit: number;
  profit_margin: number;
  remaining_contract: number;
  retainage_held: number;
  unpaid_invoice_balance: number;
  archived_at?: string | null;
  source_estimate_id?: number | null;
  source_estimate_number?: string | null;
}

interface JobsListPageProps {
  jobs: JobRow[];
  totalJobs: number;
  totalContract: number;
  totalIncome: number;
  totalCost: number;
  totalProfit: number;
  totalInvoiced: number;
  totalPayments: number;
  totalUnpaidInvoiceBalance: number;
  deleteError?: string;
  csrfToken: string;
  showArchived?: boolean;
  canCreateJobs?: boolean;
  canEditJobs?: boolean;
  canArchiveJobs?: boolean;
}

function fmt(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const JobsListPage: FC<JobsListPageProps> = ({
  jobs,
  totalJobs,
  totalContract,
  totalIncome,
  totalCost,
  totalProfit,
  totalInvoiced,
  totalPayments,
  totalUnpaidInvoiceBalance,
  deleteError,
  showArchived,
  canCreateJobs,
  canEditJobs,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Jobs</h1>
          <p>Track project profitability, invoices, collections, labor, and estimate conversions.</p>
        </div>
        <div class="actions">
          <a class="btn" href={showArchived ? '/jobs' : '/jobs?show_archived=1'}>
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </a>
          {canCreateJobs ? <a class="btn btn-primary" href="/add_job">+ Add Job</a> : null}
        </div>
      </div>

      {deleteError ? (
        <div class="card" style="margin-bottom:16px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;">
          {deleteError}
        </div>
      ) : null}

      <div class="stat-grid stat-grid-4" style="margin-bottom:16px;">
        <div class="stat-card stat-card-navy">
          <div class="stat-label">Total Jobs</div>
          <div class="stat-value">{totalJobs}</div>
        </div>
        <div class="stat-card stat-card-accent">
          <div class="stat-label">Contract Value</div>
          <div class="stat-value">${fmt(totalContract || 0)}</div>
        </div>
        <div class="stat-card stat-card-green">
          <div class="stat-label">Collected</div>
          <div class="stat-value">${fmt(totalPayments || 0)}</div>
          <div class="stat-sub">${fmt(totalInvoiced || 0)} invoiced</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Profit</div>
          <div class="stat-value">${fmt(totalProfit || 0)}</div>
          <div class="stat-sub">${fmt(totalIncome || 0)} income · ${fmt(totalCost || 0)} costs</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h2>All Jobs</h2>
            {showArchived ? <p>Showing archived jobs</p> : null}
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <span class="badge" style="background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); color:#fff;">
              {totalJobs} jobs
            </span>
            <span class="badge" style="background:rgba(255,255,255,.12); border-color:rgba(255,255,255,.18); color:rgba(255,255,255,.8); font-size:10.5px;">
              Unpaid: ${fmt(totalUnpaidInvoiceBalance || 0)}
            </span>
          </div>
        </div>

        {jobs.length > 0 ? (
          <>
            <div class="table-wrap" style="margin:0 -18px -16px;">
              <table>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th class="right">Contract</th>
                    <th class="right">Income</th>
                    <th class="right">Costs</th>
                    <th class="right">Profit</th>
                    <th class="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr>
                      <td>
                        <a href={`/job/${job.id}`} style="font-weight:800; color:var(--navy);">{job.job_name}</a>
                        <div class="muted" style="font-size:12px; margin-top:2px;">
                          {job.job_code || 'No code'}
                          {job.archived_at ? ' · Archived' : ''}
                        </div>
                        {job.source_estimate_id ? (
                          <div style="margin-top:5px;">
                            <span class="badge badge-good" style="font-size:10px;">
                              From {job.source_estimate_number || `Estimate #${job.source_estimate_id}`}
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td>{job.client_name || '—'}</td>
                      <td>
                        {job.archived_at
                          ? <span class="badge badge-warn">Archived</span>
                          : <span class="badge">{job.status || 'Unknown'}</span>
                        }
                      </td>
                      <td class="right" style="font-weight:700;">${fmt(job.contract_amount || 0)}</td>
                      <td class="right">${fmt(job.income_total || 0)}</td>
                      <td class="right">${fmt(job.total_costs || 0)}</td>
                      <td class="right" style={`font-weight:700; color:${(job.profit || 0) >= 0 ? '#065F46' : '#991B1B'};`}>
                        ${fmt(job.profit || 0)}
                      </td>
                      <td class="right">
                        <div class="actions" style="justify-content:flex-end; gap:6px;">
                          <a class="btn btn-sm" href={`/job/${job.id}`}>View</a>
                          {canEditJobs ? <a class="btn btn-sm" href={`/edit_job/${job.id}`}>Edit</a> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div class="empty-state">
            <div class="empty-state-icon">🏗️</div>
            <h3>{showArchived ? 'No archived jobs' : 'No jobs yet'}</h3>
            <p>
              {showArchived
                ? 'Archived jobs will appear here once projects are archived.'
                : 'Jobs are the foundation of your workspace. Track costs, invoices, and profitability per project.'}
            </p>
            {!showArchived && canCreateJobs ? (
              <a class="btn btn-primary" href="/add_job">+ Create Your First Job</a>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobsListPage;
