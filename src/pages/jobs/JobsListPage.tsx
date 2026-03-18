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
  canArchiveJobs?: boolean;
}

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
  csrfToken,
  showArchived,
  canArchiveJobs,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Jobs</h1>
          <p class="muted">Track project profitability, invoices, collections, and labor.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href={showArchived ? '/jobs' : '/jobs?show_archived=1'}>
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </a>
          <a class="btn btn-primary" href="/add_job">Add Job</a>
        </div>
      </div>

      {deleteError ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;"
        >
          {deleteError}
        </div>
      ) : null}

      <div class="grid grid-4 mobile-card-grid" style="margin-bottom:14px;">
        <div class="card mobile-kpi-card">
          <div class="metric-label">Jobs</div>
          <div class="metric-value">{totalJobs}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Contract Value</div>
          <div class="metric-value">${formatMoney(totalContract || 0)}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Invoiced</div>
          <div class="metric-value">${formatMoney(totalInvoiced || 0)}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Collected</div>
          <div class="metric-value">${formatMoney(totalPayments || 0)}</div>
        </div>
      </div>

      <div class="grid grid-4 mobile-card-grid" style="margin-bottom:14px;">
        <div class="card mobile-kpi-card">
          <div class="metric-label">Income</div>
          <div class="metric-value">${formatMoney(totalIncome || 0)}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Costs</div>
          <div class="metric-value">${formatMoney(totalCost || 0)}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Profit</div>
          <div class="metric-value">${formatMoney(totalProfit || 0)}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Unpaid Invoices</div>
          <div class="metric-value">${formatMoney(totalUnpaidInvoiceBalance || 0)}</div>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap table-wrap-tight">
          <table class="table">
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
              {jobs.length > 0 ? (
                jobs.map((job) => (
                  <tr>
                    <td>
                      <div><b>{job.job_name}</b></div>
                      <div class="muted small">
                        {job.job_code || 'No job code'}
                        {job.archived_at ? ' • Archived' : ''}
                      </div>
                    </td>
                    <td>{job.client_name || '—'}</td>
                    <td>
                      {job.archived_at ? (
                        <span class="badge badge-warn">Archived</span>
                      ) : (
                        <span class="badge">{job.status || 'Unknown'}</span>
                      )}
                    </td>
                    <td class="right">${formatMoney(job.contract_amount || 0)}</td>
                    <td class="right">${formatMoney(job.income_total || 0)}</td>
                    <td class="right">${formatMoney(job.total_costs || 0)}</td>
                    <td class="right">${formatMoney(job.profit || 0)}</td>
                    <td class="right">
                      <div class="actions actions-mobile-stack" style="justify-content:flex-end;">
                        <a class="btn" href={`/job/${job.id}`}>View</a>
                        <a class="btn" href={`/edit_job/${job.id}`}>Edit</a>

                        {canArchiveJobs ? (
                          job.archived_at ? (
                            <form method="post" action={`/restore_job/${job.id}`} class="inline-form">
                              <input type="hidden" name="csrf_token" value={csrfToken} />
                              <button class="btn" type="submit">Restore</button>
                            </form>
                          ) : (
                            <form method="post" action={`/archive_job/${job.id}`} class="inline-form">
                              <input type="hidden" name="csrf_token" value={csrfToken} />
                              <button class="btn" type="submit">Archive</button>
                            </form>
                          )
                        ) : (
                          <span class="muted">View only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colspan={8} class="muted">
                    {showArchived ? 'No archived jobs found.' : 'No active jobs found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div class="muted" style="margin-top:12px;">
          Archived jobs are hidden from normal views but preserved for historical reporting and recovery.
        </div>
      </div>
    </div>
  );
};

export default JobsListPage;