import type { FC } from 'hono/jsx';

interface Job {
  id: number;
  job_name: string;
  job_code: string | null;
  client_name: string | null;
  contract_amount: number | null;
  retainage_percent: number | null;
  start_date: string | null;
  status: string | null;
  archived_at?: string | null;
}

interface IncomeRow {
  id: number;
  amount: number;
  date: string | null;
  description: string | null;
}

interface ExpenseRow {
  id: number;
  category: string | null;
  vendor: string | null;
  amount: number;
  date: string | null;
  receipt_filename?: string | null;
}

interface TimeRow {
  id: number;
  employee_name: string;
  date: string;
  hours: number;
  labor_cost: number;
  note: string | null;
}

interface JobDetailPageProps {
  job: Job;
  incomes: IncomeRow[];
  expenses: ExpenseRow[];
  timeEntries: TimeRow[];
  totalIncome: number;
  totalExpenses: number;
  totalLabor: number;
  totalCosts: number;
  profit: number;
  retainageHeld: number;
  csrfToken: string;
  canArchiveJobs?: boolean;
}

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const JobDetailPage: FC<JobDetailPageProps> = ({
  job,
  incomes,
  expenses,
  timeEntries,
  totalIncome,
  totalExpenses,
  totalLabor,
  totalCosts,
  profit,
  retainageHeld,
  csrfToken,
  canArchiveJobs,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>{job.job_name}</h1>
          <p class="muted">
            {job.client_name || 'No client'} • {job.job_code || 'No job code'}
          </p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href="/jobs">Back</a>
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
          ) : null}
        </div>
      </div>

      {job.archived_at ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#FDE68A; background:#FFFBEB; color:#92400E;"
        >
          This job is archived. It is preserved for history and can be restored.
        </div>
      ) : null}

      <div class="grid grid-4 mobile-card-grid" style="margin-bottom:14px;">
        <div class="card mobile-kpi-card">
          <div class="metric-label">Contract</div>
          <div class="metric-value">${formatMoney(Number(job.contract_amount || 0))}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Income</div>
          <div class="metric-value">${formatMoney(totalIncome || 0)}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Costs</div>
          <div class="metric-value">${formatMoney(totalCosts || 0)}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Profit</div>
          <div class="metric-value">${formatMoney(profit || 0)}</div>
        </div>
      </div>

      <div class="grid grid-3 mobile-card-grid" style="margin-bottom:14px;">
        <div class="card mobile-kpi-card">
          <div class="metric-label">Expenses</div>
          <div class="metric-value">${formatMoney(totalExpenses || 0)}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Labor</div>
          <div class="metric-value">${formatMoney(totalLabor || 0)}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Retainage Held</div>
          <div class="metric-value">${formatMoney(retainageHeld || 0)}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:14px;">
        <div class="card">
          <b>Job Info</b>
          <div class="mobile-info-list">
            <div class="mobile-info-row">
              <span class="mobile-info-label">Client</span>
              <span class="mobile-info-value">{job.client_name || '—'}</span>
            </div>
            <div class="mobile-info-row">
              <span class="mobile-info-label">Job Code</span>
              <span class="mobile-info-value">{job.job_code || '—'}</span>
            </div>
            <div class="mobile-info-row">
              <span class="mobile-info-label">Status</span>
              <span class="mobile-info-value">{job.status || '—'}</span>
            </div>
            <div class="mobile-info-row">
              <span class="mobile-info-label">Start Date</span>
              <span class="mobile-info-value">{job.start_date || '—'}</span>
            </div>
            <div class="mobile-info-row">
              <span class="mobile-info-label">Retainage %</span>
              <span class="mobile-info-value">{Number(job.retainage_percent || 0).toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <div class="card">
          <b>Actions</b>
          <div class="actions actions-mobile-stack" style="margin-top:12px;">
            {job.archived_at ? (
              <span class="muted">Restore this job to add new income or expenses.</span>
            ) : (
              <>
                <a class="btn btn-primary" href={`/add_income/${job.id}`}>Add Income</a>
                <a class="btn" href={`/add_expense/${job.id}`}>Add Expense</a>
              </>
            )}
          </div>
          <p class="muted" style="margin-top:10px;">
            Use these to keep job costing and cash flow accurate.
          </p>
        </div>
      </div>

      <div class="grid grid-2 mobile-section-gap">
        <div class="card">
          <b>Income</b>
          <div class="table-wrap table-wrap-tight" style="margin-top:10px;">
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th class="right">Amount</th>
                  <th class="right">Action</th>
                </tr>
              </thead>
              <tbody>
                {incomes.length > 0 ? (
                  incomes.map((row) => (
                    <tr>
                      <td>{row.date || '—'}</td>
                      <td>{row.description || '—'}</td>
                      <td class="right">${formatMoney(Number(row.amount || 0))}</td>
                      <td class="right">
                        {job.archived_at ? (
                          <span class="muted">Locked</span>
                        ) : (
                          <form
                            method="post"
                            action={`/delete_income/${row.id}`}
                            class="inline-form"
                            onsubmit="return confirm('Delete this income entry?');"
                          >
                            <input type="hidden" name="csrf_token" value={csrfToken} />
                            <button class="btn" type="submit">Delete</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colspan={4} class="muted">No income records yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <b>Expenses</b>
          <div class="table-wrap table-wrap-tight" style="margin-top:10px;">
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Vendor</th>
                  <th>Receipt</th>
                  <th class="right">Amount</th>
                  <th class="right">Action</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length > 0 ? (
                  expenses.map((row) => (
                    <tr>
                      <td>{row.date || '—'}</td>
                      <td>{row.category || '—'}</td>
                      <td>{row.vendor || '—'}</td>
                      <td>
                        {row.receipt_filename ? (
                          <a
                            class="btn"
                            href={`/expense-receipts/${row.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View Receipt
                          </a>
                        ) : (
                          <span class="muted">No receipt</span>
                        )}
                      </td>
                      <td class="right">${formatMoney(Number(row.amount || 0))}</td>
                      <td class="right">
                        {job.archived_at ? (
                          <span class="muted">Locked</span>
                        ) : (
                          <div class="actions actions-mobile-stack" style="justify-content:flex-end;">
                            <a class="btn" href={`/edit_expense/${row.id}`}>Edit</a>
                            <form
                              method="post"
                              action={`/delete_expense/${row.id}`}
                              class="inline-form"
                              onsubmit="return confirm('Delete this expense entry?');"
                            >
                              <input type="hidden" name="csrf_token" value={csrfToken} />
                              <button class="btn" type="submit">Delete</button>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colspan={6} class="muted">No expense records yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card mobile-section-gap">
        <b>Labor Entries</b>
        <div class="table-wrap table-wrap-tight" style="margin-top:10px;">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th class="right">Hours</th>
                <th class="right">Labor Cost</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {timeEntries.length > 0 ? (
                timeEntries.map((row) => (
                  <tr>
                    <td>{row.date}</td>
                    <td>{row.employee_name}</td>
                    <td class="right">{Number(row.hours || 0).toFixed(2)}</td>
                    <td class="right">${formatMoney(Number(row.labor_cost || 0))}</td>
                    <td>{row.note || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colspan={5} class="muted">No labor entries yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JobDetailPage;