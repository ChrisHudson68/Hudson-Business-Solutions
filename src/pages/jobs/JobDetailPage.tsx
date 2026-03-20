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
  source_estimate_id?: number | null;
  source_estimate_number?: string | null;
}

interface IncomeRow {
  id: number;
  amount: number;
  date: string | null;
  description: string | null;
  archived_at?: string | null;
}

interface ExpenseRow {
  id: number;
  category: string | null;
  vendor: string | null;
  amount: number;
  date: string | null;
  receipt_filename?: string | null;
  archived_at?: string | null;
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
  archivedIncomes: IncomeRow[];
  expenses: ExpenseRow[];
  archivedExpenses: ExpenseRow[];
  timeEntries: TimeRow[];
  totalIncome: number;
  totalExpenses: number;
  totalLabor: number;
  totalCosts: number;
  profit: number;
  retainageHeld: number;
  csrfToken: string;
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
  archivedIncomes,
  expenses,
  archivedExpenses,
  timeEntries,
  totalIncome,
  totalExpenses,
  totalLabor,
  totalCosts,
  profit,
  retainageHeld,
  csrfToken,
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
          {job.archived_at ? (
            <form method="post" action={`/restore_job/${job.id}`} class="inline-form">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <button class="btn" type="submit">Restore</button>
            </form>
          ) : (
            <form method="post" action={`/archive_job/${job.id}`} class="inline-form">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <button class="btn" type="submit">Archive</button>
            </form>
          )}
        </div>
      </div>

      {job.source_estimate_id ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#BFDBFE; background:#EFF6FF; color:#1E3A8A;"
        >
          <div style="font-weight:800; margin-bottom:6px;">Created from approved estimate</div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <span>
              This job was created automatically from{' '}
              <b>{job.source_estimate_number || `Estimate #${job.source_estimate_id}`}</b>.
            </span>
            <a class="btn" href={`/estimate/${job.source_estimate_id}`}>Open Estimate</a>
          </div>
        </div>
      ) : null}

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
            <div class="mobile-info-row">
              <span class="mobile-info-label">Source Estimate</span>
              <span class="mobile-info-value">
                {job.source_estimate_number || (job.source_estimate_id ? `Estimate #${job.source_estimate_id}` : '—')}
              </span>
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
                            action={`/archive_income/${row.id}`}
                            class="inline-form"
                            onsubmit="return confirm('Archive this income entry?');"
                          >
                            <input type="hidden" name="csrf_token" value={csrfToken} />
                            <button class="btn" type="submit">Archive</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colspan={4} class="muted">No active income records yet.</td>
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
                          <a href={`/uploads/receipts/${row.receipt_filename}`} target="_blank" rel="noreferrer">
                            View
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td class="right">${formatMoney(Number(row.amount || 0))}</td>
                      <td class="right">
                        {job.archived_at ? (
                          <span class="muted">Locked</span>
                        ) : (
                          <form
                            method="post"
                            action={`/archive_expense/${row.id}`}
                            class="inline-form"
                            onsubmit="return confirm('Archive this expense entry?');"
                          >
                            <input type="hidden" name="csrf_token" value={csrfToken} />
                            <button class="btn" type="submit">Archive</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colspan={6} class="muted">No active expense records yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
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

      {(archivedIncomes.length > 0 || archivedExpenses.length > 0) ? (
        <div class="grid grid-2 mobile-section-gap" style="margin-top:14px;">
          <div class="card">
            <b>Archived Income</b>
            <div class="table-wrap table-wrap-tight" style="margin-top:10px;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th class="right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedIncomes.length > 0 ? (
                    archivedIncomes.map((row) => (
                      <tr>
                        <td>{row.date || '—'}</td>
                        <td>{row.description || '—'}</td>
                        <td class="right">${formatMoney(Number(row.amount || 0))}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colspan={3} class="muted">No archived income entries.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <b>Archived Expenses</b>
            <div class="table-wrap table-wrap-tight" style="margin-top:10px;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Vendor</th>
                    <th class="right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedExpenses.length > 0 ? (
                    archivedExpenses.map((row) => (
                      <tr>
                        <td>{row.date || '—'}</td>
                        <td>{row.category || '—'}</td>
                        <td>{row.vendor || '—'}</td>
                        <td class="right">${formatMoney(Number(row.amount || 0))}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colspan={4} class="muted">No archived expense entries.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default JobDetailPage;