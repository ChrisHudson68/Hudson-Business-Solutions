import type { FC } from 'hono/jsx';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

interface JobRow {
  id: number;
  job_name: string | null;
  job_code: string | null;
  client_name: string | null;
  contract_amount: number;
  retainage_percent: number;
  start_date: string | null;
  status: string;
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
  csrfToken: string;
  error?: string;
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
  csrfToken,
  error,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Jobs</h1>
          <p class="muted">Track contract value, income, costs, invoices, and profitability across all jobs.</p>
        </div>
        <div class="actions">
          <a class="btn btn-primary" href="/add_job">Add Job</a>
        </div>
      </div>

      {error ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;"
        >
          {error}
        </div>
      ) : null}

      <div class="grid grid-4" style="margin-bottom:14px;">
        <div class="card">
          <b>Total Jobs</b>
          <div style="font-size:24px; font-weight:900; margin-top:10px;">
            {totalJobs || 0}
          </div>
        </div>

        <div class="card">
          <b>Total Contract Value</b>
          <div style="font-size:24px; font-weight:900; margin-top:10px;">
            ${fmt(totalContract || 0)}
          </div>
        </div>

        <div class="card">
          <b>Total Income Received</b>
          <div style="font-size:24px; font-weight:900; margin-top:10px;">
            ${fmt(totalIncome || 0)}
          </div>
        </div>

        <div class="card">
          <b>Total Profit</b>
          <div style="font-size:24px; font-weight:900; margin-top:10px;">
            ${fmt(totalProfit || 0)}
          </div>
        </div>
      </div>

      <div class="grid grid-3" style="margin-bottom:14px;">
        <div class="card">
          <b>Total Costs</b>
          <div style="font-size:22px; font-weight:900; margin-top:10px;">
            ${fmt(totalCost || 0)}
          </div>
        </div>

        <div class="card">
          <b>Total Invoiced</b>
          <div style="font-size:22px; font-weight:900; margin-top:10px;">
            ${fmt(totalInvoiced || 0)}
          </div>
        </div>

        <div class="card">
          <b>Unpaid Invoice Balance</b>
          <div style="font-size:22px; font-weight:900; margin-top:10px;">
            ${fmt(totalUnpaidInvoiceBalance || 0)}
          </div>
          <div class="muted" style="margin-top:8px;">
            Payments Received: ${fmt(totalPayments || 0)}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Actions</th>
                <th>Job</th>
                <th>Client</th>
                <th>Status</th>
                <th class="right">Contract</th>
                <th class="right">Income</th>
                <th class="right">Expenses</th>
                <th class="right">Labor</th>
                <th class="right">Total Costs</th>
                <th class="right">Profit</th>
                <th class="right">Margin</th>
                <th class="right">Invoiced</th>
                <th class="right">Payments</th>
                <th class="right">Unpaid</th>
                <th class="right">Remaining Contract</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length > 0 ? (
                jobs.map((job) => {
                  const status = job.status || 'Unknown';
                  let statusBadgeClass = 'badge';
                  if (status === 'Active') statusBadgeClass = 'badge badge-good';
                  else if (status === 'On Hold') statusBadgeClass = 'badge badge-warn';

                  return (
                    <tr>
                      <td>
                        <div style="display:flex; flex-direction:column; gap:8px; min-width:95px;">
                          <a class="btn" href={`/job/${job.id}`}>View</a>
                          <a class="btn" href={`/edit_job/${job.id}`}>Edit</a>
                          <form
                            method="post"
                            action={`/delete_job/${job.id}`}
                            onsubmit="return confirm('Delete this job and all related records?');"
                            style="margin:0;"
                          >
                            <input type="hidden" name="csrf_token" value={csrfToken} />
                            <button type="submit" class="btn" style="width:100%;">Delete</button>
                          </form>
                        </div>
                      </td>

                      <td>
                        <div style="font-weight:900;">
                          <a href={`/job/${job.id}`}>{job.job_name}</a>
                        </div>
                        <div class="muted" style="font-size:12px; margin-top:4px;">
                          {job.job_code ? `Code: ${job.job_code}` : `Start: ${job.start_date || '\u2014'}`}
                        </div>
                      </td>

                      <td>{job.client_name || '\u2014'}</td>

                      <td>
                        <span class={statusBadgeClass}>{status}</span>
                      </td>

                      <td class="right">${fmt(job.contract_amount || 0)}</td>
                      <td class="right">${fmt(job.income_total || 0)}</td>
                      <td class="right">${fmt(job.expense_total || 0)}</td>
                      <td class="right">${fmt(job.labor_total || 0)}</td>
                      <td class="right">${fmt(job.total_costs || 0)}</td>

                      <td class="right">
                        {(job.profit || 0) < 0 ? (
                          <span class="badge badge-bad">${fmt(job.profit || 0)}</span>
                        ) : (
                          <span class="badge badge-good">${fmt(job.profit || 0)}</span>
                        )}
                      </td>

                      <td class="right">
                        {(job.profit_margin || 0) < 0 ? (
                          <span class="badge badge-bad">{fmtPct(job.profit_margin || 0)}%</span>
                        ) : (
                          <span class="badge">{fmtPct(job.profit_margin || 0)}%</span>
                        )}
                      </td>

                      <td class="right">${fmt(job.invoice_total || 0)}</td>
                      <td class="right">${fmt(job.payments_total || 0)}</td>
                      <td class="right">${fmt(job.unpaid_invoice_balance || 0)}</td>
                      <td class="right">${fmt(job.remaining_contract || 0)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colspan={15} class="muted">No jobs found yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JobsListPage;